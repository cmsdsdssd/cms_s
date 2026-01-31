-- 20260131163000_cms_0253_fix_confirm_shipment_header_ticks_and_material.sql
-- Fix confirm shipment:
-- - DO NOT write non-existent columns on cms_shipment_header (e.g., gold_tick_id)
-- - Fix silver_adjust_factor snapshot logic (use v_material instead of r_master.material)
-- public.cms_* only.

set search_path = public, pg_temp;

create or replace function public.cms_fn_confirm_shipment(
  p_shipment_id uuid,
  p_actor_person_id uuid default null::uuid,
  p_note text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_hdr public.cms_shipment_header%rowtype;
  r_line record;
  r_order record;
  r_repair record;
  r_master record;

  v_now timestamptz := now();

  v_master_id uuid;
  v_category public.cms_e_category_code;
  v_material public.cms_e_material_code;

  v_measured numeric;
  v_deduct numeric;
  v_net numeric;

  v_gold_tick_id uuid;
  v_silver_tick_id uuid;
  v_gold_price numeric;
  v_silver_price numeric;
  v_gold_observed_at timestamptz;
  v_silver_observed_at timestamptz;
  v_gold_symbol public.cms_e_market_symbol;
  v_silver_symbol public.cms_e_market_symbol;
  v_cs_correction_factor_cfg numeric;
  v_silver_adjust_factor_applied numeric;
  v_silver_kr_correction_factor_cfg numeric;
  v_silver_tick_meta jsonb;
  v_silver_factor_snapshot numeric;
  v_silver_factor_embedded_in_tick boolean;
  v_silver_purity numeric := 0.925;

  v_material_amount_sell numeric := 0;
  v_labor_amount_sell numeric := 0;
  v_total_amount_sell numeric := 0;

  v_total_sell numeric := 0;
  v_total_cost numeric := 0;

  v_cost_labor numeric := 0;
  v_cost_material numeric := 0;

begin
  -- 1) lock header
  select *
  into v_hdr
  from public.cms_shipment_header
  where shipment_id = p_shipment_id
  for update;

  if not found then
    raise exception 'shipment not found: %', p_shipment_id;
  end if;

  if v_hdr.status = 'CONFIRMED'::public.cms_e_shipment_status then
    return jsonb_build_object('ok', true, 'already_confirmed', true, 'shipment_id', p_shipment_id);
  end if;

  -- 2) config (fallbacks)
  select
    coalesce(c.cs_correction_factor, 1.200000),
    coalesce(c.silver_kr_correction_factor, c.cs_correction_factor, 1.200000)
  into
    v_cs_correction_factor_cfg,
    v_silver_kr_correction_factor_cfg
  from public.cms_market_tick_config c
  where c.config_key = 'DEFAULT'
  limit 1;

  v_cs_correction_factor_cfg := coalesce(v_cs_correction_factor_cfg, 1.200000);
  v_silver_kr_correction_factor_cfg := coalesce(v_silver_kr_correction_factor_cfg, v_cs_correction_factor_cfg, 1.200000);

  -- 3) latest ticks
  select t.tick_id, t.symbol, t.price, t.observed_at
  into v_gold_tick_id, v_gold_symbol, v_gold_price, v_gold_observed_at
  from public.cms_market_tick t
  where t.symbol = 'GOLD_KRW_PER_G'::public.cms_e_market_symbol
  order by t.observed_at desc
  limit 1;

  select t.tick_id, t.symbol, t.price, t.observed_at, t.meta
  into v_silver_tick_id, v_silver_symbol, v_silver_price, v_silver_observed_at, v_silver_tick_meta
  from public.cms_market_tick t
  where t.symbol = 'SILVER_KRW_PER_G'::public.cms_e_market_symbol
  order by t.observed_at desc
  limit 1;

  -- whether the factor was embedded in tick meta (if n8n already applied)
  v_silver_factor_embedded_in_tick :=
    coalesce((v_silver_tick_meta->>'factor_applied')::boolean, false);

  -- applied factor snapshot: if meta says already applied -> 1.0, else use config
  v_silver_adjust_factor_applied :=
    case
      when v_silver_factor_embedded_in_tick then 1.0
      else v_silver_kr_correction_factor_cfg
    end;

  -- store snapshot value used at confirm time
  v_silver_factor_snapshot := v_silver_adjust_factor_applied;

  -- 4) process each line
  for r_line in
    select *
    from public.cms_shipment_line
    where shipment_id = p_shipment_id
    order by shipment_line_id
    for update
  loop
    v_master_id := null;
    v_category := null;
    v_material := null;

    v_measured := null;
    v_deduct := 0;
    v_net := null;

    v_material_amount_sell := 0;
    v_labor_amount_sell := 0;
    v_total_amount_sell := 0;

    v_cost_labor := 0;
    v_cost_material := 0;

    -- resolve from order_line / repair_line / master
    r_order := null;
    r_repair := null;
    r_master := null;

    if r_line.order_line_id is not null then
      select *
      into r_order
      from public.cms_order_line
      where order_line_id = r_line.order_line_id;

      if found then
        v_master_id := r_order.matched_master_id;
        v_category := r_order.category_code;
      end if;
    end if;

    if r_line.repair_line_id is not null then
      select *
      into r_repair
      from public.cms_repair_line
      where repair_line_id = r_line.repair_line_id;

      if found then
        if v_master_id is null then v_master_id := r_repair.master_id; end if;
        if v_category is null then v_category := r_repair.category_code; end if;
      end if;
    end if;

    if v_master_id is null and r_line.model_name is not null then
      select *
      into r_master
      from public.cms_master_item
      where model_name = trim(r_line.model_name)
      limit 1;

      if found then
        v_master_id := r_master.master_id;
        if v_category is null then v_category := r_master.category_code; end if;
      end if;
    else
      if v_master_id is not null then
        select *
        into r_master
        from public.cms_master_item
        where master_id = v_master_id
        limit 1;
      end if;
    end if;

    v_material := coalesce(r_line.material_code, r_master.material_code_default, r_repair.material_code);

    if v_material is null then
      raise exception 'material_code required for shipment_line_id=%', r_line.shipment_line_id;
    end if;

    -- measured / net
    v_measured := r_line.measured_weight_g;
    v_deduct := coalesce(r_line.deduction_weight_g, r_master.deduction_weight_default_g, 0);
    v_net := case when v_measured is null then null else greatest(v_measured - v_deduct, 0) end;

    -- guards: when material pricing is needed, weight must exist
    if v_material is not null and v_material <> '00' and r_line.pricing_mode <> 'AMOUNT_ONLY' then
      if v_measured is null then
        raise exception 'measured_weight_g required for shipment_line_id=%', r_line.shipment_line_id;
      end if;
    end if;

    -- material amount (sell)
    if v_material is null or v_material = '00' then
      v_material_amount_sell := 0;
    else
      if v_material in ('14','18','24') then
        if v_gold_tick_id is null then raise exception 'missing gold tick in cms_market_tick'; end if;
        v_material_amount_sell :=
          case v_material
            when '14' then round(v_gold_price * 0.6435 * v_net, 0)
            when '18' then round(v_gold_price * 0.8250 * v_net, 0)
            when '24' then round(v_gold_price * 1.0000 * v_net, 0)
          end;
      elsif v_material = '925' then
        if v_silver_tick_id is null then raise exception 'missing silver tick in cms_market_tick'; end if;
        v_material_amount_sell :=
          round(v_silver_price * v_silver_purity * v_net * v_silver_adjust_factor_applied, 0);
      else
        v_material_amount_sell := 0;
      end if;
    end if;

    -- labor amount (sell)
    v_labor_amount_sell := coalesce(r_line.labor_amount_sell_krw, 0);

    -- total sell
    v_total_amount_sell :=
      case
        when r_line.pricing_mode = 'AMOUNT_ONLY' then coalesce(r_line.total_amount_sell_krw, 0)
        when r_line.pricing_mode = 'MANUAL' then coalesce(r_line.total_amount_sell_krw, 0)
        else
          coalesce(v_material_amount_sell, 0) + coalesce(v_labor_amount_sell, 0)
      end;

    -- cost snapshot (basic - 기존 로직 유지)
    v_cost_material := 0;
    v_cost_labor := 0;

    -- update line snapshot (✅ header에는 tick_id 쓰지 않음)
    update public.cms_shipment_line
    set
      master_id = v_master_id,
      category_code = v_category,
      model_name = r_line.model_name,
      suffix = r_line.suffix,
      color = r_line.color,
      size = r_line.size,
      qty = r_line.qty,

      measured_weight_g = r_line.measured_weight_g,
      deduction_weight_g = v_deduct,
      net_weight_g = v_net,

      gold_tick_id = v_gold_tick_id,
      silver_tick_id = v_silver_tick_id,
      gold_tick_krw_per_g = v_gold_price,
      silver_tick_krw_per_g = v_silver_price,

      -- snapshot: store what was actually applied at confirm time
      silver_adjust_factor = case when v_material = '925' then v_silver_factor_snapshot else r_line.silver_adjust_factor end,
      material_code = v_material,
      material_amount_sell_krw = coalesce(v_material_amount_sell, 0),
      labor_amount_sell_krw = coalesce(v_labor_amount_sell, 0),
      total_amount_sell_krw = coalesce(v_total_amount_sell, 0),

      cost_material_krw = coalesce(v_cost_material, 0),
      cost_labor_krw = coalesce(v_cost_labor, 0),
      cost_total_krw = coalesce(v_cost_material, 0) + coalesce(v_cost_labor, 0),

      updated_at = v_now
    where shipment_line_id = r_line.shipment_line_id;

    v_total_sell := v_total_sell + coalesce(v_total_amount_sell, 0);
    v_total_cost := v_total_cost + (coalesce(v_cost_material, 0) + coalesce(v_cost_labor, 0));
  end loop;

  -- 5) confirm header (✅ 존재 컬럼만)
  update public.cms_shipment_header
  set status = 'CONFIRMED',
      confirmed_at = v_now,
      memo = coalesce(public.cms_shipment_header.memo,'')
  where shipment_id = p_shipment_id;

  -- 6) audit log (optional)
  insert into public.cms_audit_log(
    actor_person_id,
    action_type,
    entity_type,
    entity_id,
    memo,
    source_channel,
    correlation_id
  ) values (
    p_actor_person_id,
    'SHIPMENT_CONFIRM',
    'SHIPMENT',
    p_shipment_id,
    coalesce(p_note,''),
    'WEB',
    gen_random_uuid()
  );

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'confirmed_at', v_now,
    'total_sell_krw', v_total_sell,
    'total_cost_krw', v_total_cost
  );
end $function$;
