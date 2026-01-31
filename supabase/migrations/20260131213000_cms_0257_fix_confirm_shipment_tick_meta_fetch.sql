set search_path = public, pg_temp;

-- cms_0257: confirm_shipment should not read t.meta from cms_fn_latest_tick_by_role_v1()
-- Instead, fetch meta from cms_market_tick by tick_id.

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
  v_now timestamptz := now();

  v_hdr public.cms_shipment_header%rowtype;

  r_line public.cms_shipment_line%rowtype;

  r_order public.cms_order_line%rowtype;
  r_repair public.cms_repair_line%rowtype;
  r_master public.cms_master_item%rowtype;

  v_master_id uuid;

  v_category cms_e_category_code;
  v_material cms_e_material_code;

  v_measured numeric;
  v_deduct numeric;
  v_net numeric;

  v_gold_tick_id uuid;
  v_gold_price numeric;
  v_silver_tick_id uuid;
  v_silver_price numeric;

  v_total_sell numeric := 0;
  v_total_cost numeric := 0;

  -- silver factor snapshot
  v_cs_correction_factor_cfg numeric;
  v_silver_kr_correction_factor_cfg numeric;
  v_silver_adjust_factor_applied numeric;
  v_silver_factor_snapshot numeric;
  v_silver_factor_embedded_in_tick boolean;
  v_silver_tick_meta jsonb;
  v_silver_purity numeric := 0.925;

  -- calc fields
  v_labor_total_sell numeric := 0;
  v_labor_total_cost numeric := 0;

  v_material_amount_sell numeric := 0;
  v_material_amount_cost numeric := 0;

  v_final_sell numeric := 0;
  v_final_cost numeric := 0;

begin
  -- lock header
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

  -- config (DEFAULT)
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

  -- ------------------------------------------------------------
  -- latest ticks (v1 returns: tick_id, price, observed_at, symbol)
  -- ------------------------------------------------------------
  select t.tick_id, t.price
    into v_gold_tick_id, v_gold_price
  from public.cms_fn_latest_tick_by_role_v1('GOLD') t;

  select t.tick_id, t.price
    into v_silver_tick_id, v_silver_price
  from public.cms_fn_latest_tick_by_role_v1('SILVER') t;

  -- tick meta는 market_tick 테이블에서 직접 조회
  v_silver_tick_meta := '{}'::jsonb;
  if v_silver_tick_id is not null then
    select mt.meta
      into v_silver_tick_meta
    from public.cms_market_tick mt
    where mt.tick_id = v_silver_tick_id;
    v_silver_tick_meta := coalesce(v_silver_tick_meta, '{}'::jsonb);
  end if;

  v_silver_factor_embedded_in_tick :=
    coalesce((v_silver_tick_meta->>'factor_applied')::boolean, false);

  v_silver_adjust_factor_applied :=
    case
      when v_silver_factor_embedded_in_tick then 1.0
      else v_silver_kr_correction_factor_cfg
    end;

  v_silver_factor_snapshot := v_silver_adjust_factor_applied;

  -- loop shipment lines
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

    v_labor_total_sell := 0;
    v_labor_total_cost := 0;

    v_material_amount_sell := 0;
    v_material_amount_cost := 0;

    v_final_sell := 0;
    v_final_cost := 0;

    -- refs
    r_order := null;
    r_repair := null;
    r_master := null;

    if r_line.order_line_id is not null then
      select * into r_order from public.cms_order_line where order_line_id = r_line.order_line_id;
    end if;

    if r_line.repair_line_id is not null then
      select * into r_repair from public.cms_repair_line where repair_line_id = r_line.repair_line_id;
    end if;

    -- derive model snapshot defaults
    if r_line.model_name is null then
      if r_order.order_line_id is not null then
        r_line.model_name := r_order.model_name;
      elsif r_repair.repair_line_id is not null then
        r_line.model_name := r_repair.model_name;
      end if;
    end if;

    if r_line.suffix is null then
      if r_order.order_line_id is not null then
        r_line.suffix := r_order.suffix;
      elsif r_repair.repair_line_id is not null then
        r_line.suffix := r_repair.suffix;
      end if;
    end if;

    if r_line.color is null then
      if r_order.order_line_id is not null then
        r_line.color := r_order.color;
      elsif r_repair.repair_line_id is not null then
        r_line.color := r_repair.color;
      end if;
    end if;

    if r_line.size is null then
      if r_order.order_line_id is not null then
        r_line.size := r_order.size;
      end if;
    end if;

    if r_line.qty is null then
      if r_order.order_line_id is not null then
        r_line.qty := r_order.qty;
      elsif r_repair.repair_line_id is not null then
        r_line.qty := r_repair.qty;
      end if;
    end if;

    -- master resolve
    if r_order.order_line_id is not null and r_order.matched_master_id is not null then
      v_master_id := r_order.matched_master_id;
    end if;

    if v_master_id is not null then
      select * into r_master from public.cms_master_item where master_id = v_master_id;
    elsif r_line.model_name is not null then
      select * into r_master
      from public.cms_master_item
      where model_name = trim(r_line.model_name)
      limit 1;

      if r_master.master_id is not null then
        v_master_id := r_master.master_id;
      end if;
    end if;

    if r_line.model_name is null and r_master.master_id is not null then
      r_line.model_name := r_master.model_name;
    end if;

    -- category resolve (✅ r_order.category_code 사용 금지)
    v_category := coalesce(r_line.category_code, r_master.category_code, r_line.ad_hoc_category_code);
    if v_category is null then
      raise exception 'category_code required for shipment_line_id=%', r_line.shipment_line_id;
    end if;

    -- material resolve
    v_material := coalesce(r_line.material_code, r_master.material_code_default, r_repair.material_code);
    if v_material is null then
      raise exception 'material_code required for shipment_line_id=%', r_line.shipment_line_id;
    end if;

    v_measured := r_line.measured_weight_g;
    v_deduct := coalesce(r_line.deduction_weight_g, r_master.deduction_weight_default_g, 0);
    v_net := case when v_measured is null then null else greatest(v_measured - v_deduct, 0) end;

    if v_material <> '00'::public.cms_e_material_code
      and r_line.pricing_mode <> 'AMOUNT_ONLY'::public.cms_e_pricing_mode
    then
      if v_measured is null then
        raise exception 'measured_weight_g required for shipment_line_id=%', r_line.shipment_line_id;
      end if;
    end if;

    -- material sell/cost
    if v_material in ('14'::public.cms_e_material_code,'18'::public.cms_e_material_code,'24'::public.cms_e_material_code) then
      if v_gold_tick_id is null then raise exception 'missing gold tick'; end if;

      v_material_amount_sell :=
        case v_material
          when '14'::public.cms_e_material_code then round(v_gold_price * 0.6435 * v_net, 0)
          when '18'::public.cms_e_material_code then round(v_gold_price * 0.8250 * v_net, 0)
          when '24'::public.cms_e_material_code then round(v_gold_price * 1.0000 * v_net, 0)
        end;

      v_material_amount_cost := v_material_amount_sell;

    elsif v_material = '925'::public.cms_e_material_code then
      if v_silver_tick_id is null then raise exception 'missing silver tick'; end if;

      v_material_amount_sell :=
        round(v_silver_price * v_silver_purity * v_net * v_silver_adjust_factor_applied, 0);

      v_material_amount_cost := v_material_amount_sell;

    else
      v_material_amount_sell := 0;
      v_material_amount_cost := 0;
    end if;

    -- labor totals (existing columns)
    v_labor_total_sell :=
      coalesce(r_line.labor_total_sell_krw,
        coalesce(r_master.labor_basic_sell_krw,0)
        + coalesce(r_master.labor_center_sell_krw,0)
        + coalesce(r_master.labor_sub1_sell_krw,0)
        + coalesce(r_master.labor_sub2_sell_krw,0)
        + coalesce(r_master.labor_bead_sell_krw,0)
      );

    v_labor_total_cost :=
      coalesce(r_line.labor_total_cost_krw,
        coalesce(r_master.labor_basic_cost_krw,0)
        + coalesce(r_master.labor_center_cost_krw,0)
        + coalesce(r_master.labor_sub1_cost_krw,0)
        + coalesce(r_master.labor_sub2_cost_krw,0)
        + coalesce(r_master.labor_bead_cost_krw,0)
      );

    v_final_sell :=
      case
        when r_line.pricing_mode = 'MANUAL'::public.cms_e_pricing_mode then coalesce(r_line.manual_total_amount_krw,0)
        when r_line.pricing_mode = 'AMOUNT_ONLY'::public.cms_e_pricing_mode then coalesce(r_line.manual_total_amount_krw,0)
        else
          coalesce(v_material_amount_sell,0)
          + coalesce(v_labor_total_sell,0)
          + coalesce(r_line.plating_amount_sell_krw,0)
      end;

    v_final_cost :=
      coalesce(v_material_amount_cost,0)
      + coalesce(v_labor_total_cost,0)
      + coalesce(r_line.plating_amount_cost_krw,0);

    -- update line snapshots
    update public.cms_shipment_line
    set
      category_code = v_category,
      model_name = r_line.model_name,
      suffix = r_line.suffix,
      color = r_line.color,
      size = r_line.size,
      qty = r_line.qty,

      master_id = v_master_id,

      measured_weight_g = r_line.measured_weight_g,
      deduction_weight_g = v_deduct,
      net_weight_g = v_net,

      material_code = v_material,

      gold_tick_id = v_gold_tick_id,
      silver_tick_id = v_silver_tick_id,
      gold_tick_krw_per_g = v_gold_price,
      silver_tick_krw_per_g = v_silver_price,

      silver_adjust_factor =
        case when v_material in ('925')
          then v_silver_factor_snapshot
          else r_line.silver_adjust_factor
        end,

      material_amount_sell_krw = coalesce(v_material_amount_sell,0),
      material_amount_cost_krw = coalesce(v_material_amount_cost,0),

      labor_total_sell_krw = coalesce(v_labor_total_sell,0),
      labor_total_cost_krw = coalesce(v_labor_total_cost,0),

      total_amount_sell_krw = coalesce(v_final_sell,0),
      total_amount_cost_krw = coalesce(v_final_cost,0),

      is_priced_final = true,
      priced_at = v_now,
      updated_at = v_now

    where shipment_line_id = r_line.shipment_line_id;

    v_total_sell := v_total_sell + coalesce(v_final_sell,0);
    v_total_cost := v_total_cost + coalesce(v_final_cost,0);
  end loop;

  update public.cms_shipment_header
  set status = 'CONFIRMED',
      confirmed_at = v_now,
      memo = coalesce(public.cms_shipment_header.memo,'')
  where shipment_id = p_shipment_id;

  if not exists (
    select 1 from public.cms_ar_ledger
    where source_entity_type = 'SHIPMENT'
      and source_entity_id = p_shipment_id
  ) then
    perform public.cms_fn_ar_post_shipment_confirmed_v1(
      p_shipment_id,
      p_actor_person_id,
      p_note
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'confirmed_at', v_now,
    'total_sell_krw', v_total_sell,
    'total_cost_krw', v_total_cost
  );
end $function$;
