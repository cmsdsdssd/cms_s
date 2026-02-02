set search_path = public, pg_temp;

alter table public.cms_ar_ledger
  add column if not exists total_weight_g numeric null,
  add column if not exists total_labor_krw numeric null;

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
  v_ship_date date;
  v_now timestamptz := now();

  v_gold_tick_id uuid;
  v_gold_price numeric;
  v_gold_observed_at timestamptz;

  v_silver_tick_id uuid;
  v_silver_price numeric;
  v_silver_observed_at timestamptz;

  v_gold_symbol public.cms_e_market_symbol;
  v_silver_symbol public.cms_e_market_symbol;
  v_cs_correction_factor_cfg numeric;
  v_silver_adjust_factor_applied numeric;
  v_silver_kr_correction_factor_cfg numeric;
  v_silver_tick_meta jsonb;
  v_silver_factor_snapshot numeric;
  v_silver_factor_embedded_in_tick boolean;
  v_silver_purity numeric := 0.9250;

  v_total_sell numeric := 0;
  v_total_cost numeric := 0;
  v_total_weight numeric := 0;
  v_total_labor numeric := 0;

  r_line public.cms_shipment_line%rowtype;

  r_order public.cms_order_line%rowtype;
  r_repair public.cms_repair_line%rowtype;
  r_master public.cms_master_item%rowtype;

  v_category cms_e_category_code;
  v_material cms_e_material_code;

  v_measured numeric;
  v_deduct numeric;
  v_net numeric;

  v_labor_base_sell numeric := 0;
  v_labor_center_sell numeric := 0;
  v_labor_sub1_sell numeric := 0;
  v_labor_sub2_sell numeric := 0;
  v_labor_bead_sell numeric := 0;

  v_labor_base_cost numeric := 0;
  v_labor_center_cost numeric := 0;
  v_labor_sub1_cost numeric := 0;
  v_labor_sub2_cost numeric := 0;
  v_labor_bead_cost numeric := 0;

  v_labor_total_sell numeric := 0;
  v_labor_total_cost numeric := 0;

  v_material_amount_sell numeric := 0;
  v_material_amount_cost numeric := 0;

  v_is_plated boolean := false;
  v_plating_variant_id uuid;
  v_plating_rule_id uuid;
  v_plating_sell numeric := 0;
  v_plating_cost numeric := 0;

  v_repair_fee numeric := 0;

  v_rule_total_sell numeric := 0;
  v_rule_total_cost numeric := 0;

  v_final_sell numeric := 0;
  v_final_cost numeric := 0;

  v_band_id uuid;

  v_master_id uuid;

  v_line_cnt int := 0;
  v_is_store_pickup boolean := false;
  v_pricing_source text;
  v_pricing_locked_at timestamptz;
begin
  -- lock header
  select * into v_hdr
  from public.cms_shipment_header
  where shipment_id = p_shipment_id
  for update;

  if not found then
    raise exception 'shipment not found: %', p_shipment_id;
  end if;

  v_is_store_pickup := coalesce(v_hdr.is_store_pickup, false);
  v_pricing_source := case when v_is_store_pickup then 'STORE_PICKUP_CONFIRM' else 'CONFIRM_SHIPMENT' end;
  if v_hdr.pricing_source is not null then
    v_pricing_source := v_hdr.pricing_source;
  end if;

  -- idempotent / backfill
  -- - 이미 CONFIRMED 인데, 라인 정산(is_priced_final)이 끝난 경우: 재정산하지 않고 AR ledger만 보정(backfill) 후 반환
  -- - 라인 정산이 안 된 경우(레거시/깨진 confirm): 아래 로직으로 정산 + AR ledger 생성
  if v_hdr.status = 'CONFIRMED' then
    if not exists (
      select 1
      from public.cms_shipment_line
      where shipment_id = p_shipment_id
        and coalesce(is_priced_final,false) = false
    ) then
      -- ledger만 없으면 생성(중복 방지)
      if not exists (
        select 1
        from public.cms_ar_ledger
        where entry_type = 'SHIPMENT'
          and shipment_id = p_shipment_id
      ) then
        insert into public.cms_ar_ledger(
          party_id, occurred_at, entry_type, amount_krw,
          shipment_id, memo, total_weight_g, total_labor_krw
        )
        values (
          v_hdr.customer_party_id,
          coalesce(v_hdr.confirmed_at, v_now),
          'SHIPMENT',
          (select coalesce(sum(total_amount_sell_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id),
          p_shipment_id,
          p_note,
          (select coalesce(sum(net_weight_g),0) from public.cms_shipment_line where shipment_id = p_shipment_id),
          (select coalesce(sum(labor_total_sell_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id)
        );
      end if;

      return jsonb_build_object(
        'ok', true,
        'already_confirmed', true,
        'shipment_id', p_shipment_id,
        'confirmed_at', v_hdr.confirmed_at,
        'total_sell_krw', (select coalesce(sum(total_amount_sell_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id),
        'total_cost_krw', (select coalesce(sum(total_amount_cost_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id)
      );
    end if;

    -- confirmed_at은 유지(재정산/backfill 이더라도 timestamp를 새로 찍지 않음)
    v_now := coalesce(v_hdr.confirmed_at, v_now);
  end if;

  -- must have at least 1 line
  select count(*) into v_line_cnt
  from public.cms_shipment_line
  where shipment_id = p_shipment_id;

  if v_line_cnt <= 0 then
    raise exception 'cannot confirm shipment with no lines (shipment_id=%)', p_shipment_id;
  end if;

  v_ship_date := coalesce(v_hdr.ship_date, current_date);

  -- ticks (latest)
  select t.tick_id, t.price, t.observed_at, t.symbol
    into v_gold_tick_id, v_gold_price, v_gold_observed_at, v_gold_symbol
  from public.cms_fn_latest_tick_by_role_v1('GOLD') t;

  select t.tick_id, t.price, t.observed_at, t.symbol
    into v_silver_tick_id, v_silver_price, v_silver_observed_at, v_silver_symbol
  from public.cms_fn_latest_tick_by_role_v1('SILVER') t;

  -- Global correction factor (configurable). Note: if the SILVER role points to
  -- SILVER_CN_KRW_PER_G, the tick already includes this factor; we must NOT apply it twice.
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

  -- Tick meta: used to (1) detect 'factor already applied in tick', and (2) snapshot the factor into shipment_line
  v_silver_tick_meta := null;
  if v_silver_tick_id is not null then
    select t.meta into v_silver_tick_meta
    from public.cms_market_tick t
    where t.tick_id = v_silver_tick_id;
  end if;

  -- Prefer factor from tick meta (producer responsibility: if meta includes a correction factor, it is assumed to be already applied to krw_per_g)
  v_silver_factor_snapshot := null;
  if v_silver_tick_meta is not null then
    begin
      if v_silver_tick_meta ? 'cs_correction_factor' then
        v_silver_factor_snapshot := (v_silver_tick_meta->>'cs_correction_factor')::numeric;
      elsif v_silver_tick_meta ? 'silver_kr_correction_factor' then
        v_silver_factor_snapshot := (v_silver_tick_meta->>'silver_kr_correction_factor')::numeric;
      elsif v_silver_tick_meta ? 'krx_correction_factor' then
        v_silver_factor_snapshot := (v_silver_tick_meta->>'krx_correction_factor')::numeric;
      end if;
    exception when others then
      v_silver_factor_snapshot := null;
    end;
  end if;

  -- CN tick: correction factor is already embedded in the tick value (CS formula). Snapshot factor separately.
  if v_silver_symbol = 'SILVER_CN_KRW_PER_G'::public.cms_e_market_symbol then
    v_silver_factor_embedded_in_tick := true;
    v_silver_factor_snapshot := coalesce(v_silver_factor_snapshot, v_cs_correction_factor_cfg, 1.200000);
  else
    -- KR tick: treat meta factor as embedded; if missing, apply fallback cfg at confirm time (backward compatible)
    v_silver_factor_embedded_in_tick := (v_silver_factor_snapshot is not null);
    v_silver_factor_snapshot := coalesce(v_silver_factor_snapshot, v_silver_kr_correction_factor_cfg, 1.200000);
  end if;

  -- factor actually multiplied at confirm time (1.0 if embedded in tick)
  v_silver_adjust_factor_applied := case when v_silver_factor_embedded_in_tick then 1.000000 else v_silver_factor_snapshot end;

  -- loop lines
  for r_line in
    select *
    from public.cms_shipment_line
    where shipment_id = p_shipment_id
    order by created_at asc
    for update
  loop
    -- reset per line
    r_order := null;
    r_repair := null;
    r_master := null;

    v_category := null;
    v_material := null;

    v_measured := null;
    v_deduct := 0;
    v_net := null;

    v_labor_base_sell := 0; v_labor_center_sell := 0; v_labor_sub1_sell := 0; v_labor_sub2_sell := 0; v_labor_bead_sell := 0;
    v_labor_base_cost := 0; v_labor_center_cost := 0; v_labor_sub1_cost := 0; v_labor_sub2_cost := 0; v_labor_bead_cost := 0;
    v_labor_total_sell := 0; v_labor_total_cost := 0;

    v_material_amount_sell := 0; v_material_amount_cost := 0;

    v_is_plated := false;
    v_plating_variant_id := null;
    v_plating_rule_id := null;
    v_plating_sell := 0;
    v_plating_cost := 0;

    v_repair_fee := 0;

    v_rule_total_sell := 0;
    v_rule_total_cost := 0;

    v_final_sell := 0;
    v_final_cost := 0;

    v_band_id := null;
    v_master_id := null;

    -- load refs
    if r_line.order_line_id is not null then
      select * into r_order from public.cms_order_line where order_line_id = r_line.order_line_id;
    end if;

    if r_line.repair_line_id is not null then
      select * into r_repair from public.cms_repair_line where repair_line_id = r_line.repair_line_id;
    end if;

    -- fill missing snapshot fields from order/repair
    if r_line.model_name is null then
      r_line.model_name := coalesce(r_order.model_name, r_repair.model_name);
    end if;

    if r_line.suffix is null then
      r_line.suffix := coalesce(r_order.suffix, r_repair.suffix);
    end if;

    if r_line.color is null then
      r_line.color := coalesce(r_order.color, r_repair.color);
    end if;

    if r_line.size is null then
      r_line.size := r_order.size;
    end if;

    if r_line.qty is null then
      r_line.qty := coalesce(r_order.qty, r_repair.qty);
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

    -- category/material resolve (NO r_order.category_code usage)
    v_category := coalesce(r_line.category_code, r_master.category_code, r_line.ad_hoc_category_code);
    if v_category is null then
      raise exception 'category_code required for shipment_line_id=%', r_line.shipment_line_id;
    end if;

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

    v_total_weight := v_total_weight + coalesce(v_net, 0);

    -- plating snapshot
    v_is_plated := coalesce(r_line.is_plated, false);
    if r_order.order_line_id is not null then
      v_is_plated := coalesce(r_line.is_plated, r_order.is_plated, false);
    end if;

    -- manual labor first
    if coalesce(r_line.manual_labor_krw, 0) > 0 then
      v_labor_base_sell := 0;
      v_labor_center_sell := 0;
      v_labor_sub1_sell := 0;
      v_labor_sub2_sell := 0;
      v_labor_bead_sell := 0;
      v_labor_total_sell := r_line.manual_labor_krw;
    else
      v_labor_base_sell := coalesce(r_master.labor_base_sell, 0);
      v_labor_center_sell := coalesce(r_master.labor_center_sell, 0);
      v_labor_sub1_sell := coalesce(r_master.labor_sub1_sell, 0);
      v_labor_sub2_sell := coalesce(r_master.labor_sub2_sell, 0);
      v_labor_bead_sell := coalesce(r_master.labor_bead_sell, 0);
      v_labor_total_sell := v_labor_base_sell + v_labor_center_sell + v_labor_sub1_sell + v_labor_sub2_sell + v_labor_bead_sell;
    end if;

    v_labor_base_cost := coalesce(r_master.labor_base_cost, 0);
    v_labor_center_cost := coalesce(r_master.labor_center_cost, 0);
    v_labor_sub1_cost := coalesce(r_master.labor_sub1_cost, 0);
    v_labor_sub2_cost := coalesce(r_master.labor_sub2_cost, 0);
    v_labor_bead_cost := coalesce(r_master.labor_bead_cost, 0);
    v_labor_total_cost := v_labor_base_cost + v_labor_center_cost + v_labor_sub1_cost + v_labor_sub2_cost + v_labor_bead_cost;

    v_total_labor := v_total_labor + coalesce(v_labor_total_sell, 0);

    -- material sell/cost (same policy as repo)
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

      v_material_amount_sell := round(v_silver_price * v_silver_purity * v_net * v_silver_adjust_factor_applied, 0);
      v_material_amount_cost := v_material_amount_sell;
    else
      v_material_amount_sell := 0;
      v_material_amount_cost := 0;
    end if;

    -- final amounts
    v_rule_total_sell := coalesce(v_material_amount_sell,0) + coalesce(v_labor_total_sell,0);
    v_rule_total_cost := coalesce(v_material_amount_cost,0) + coalesce(v_labor_total_cost,0);

    v_final_sell :=
      case
        when r_line.pricing_mode = 'MANUAL'::public.cms_e_pricing_mode then coalesce(r_line.manual_total_amount_krw,0)
        when r_line.pricing_mode = 'AMOUNT_ONLY'::public.cms_e_pricing_mode then coalesce(r_line.manual_total_amount_krw,0)
        else v_rule_total_sell
      end;

    v_final_cost := v_rule_total_cost;

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

      silver_adjust_factor = case when v_material in ('925') then v_silver_factor_snapshot else r_line.silver_adjust_factor end,

      material_amount_sell_krw = coalesce(v_material_amount_sell,0),
      material_amount_cost_krw = coalesce(v_material_amount_cost,0),

      labor_base_sell_krw = v_labor_base_sell,
      labor_center_sell_krw = v_labor_center_sell,
      labor_sub1_sell_krw = v_labor_sub1_sell,
      labor_sub2_sell_krw = v_labor_sub2_sell,
      labor_bead_sell_krw = v_labor_bead_sell,
      labor_total_sell_krw = v_labor_total_sell,

      labor_base_cost_krw = v_labor_base_cost,
      labor_center_cost_krw = v_labor_center_cost,
      labor_sub1_cost_krw = v_labor_sub1_cost,
      labor_sub2_cost_krw = v_labor_sub2_cost,
      labor_bead_cost_krw = v_labor_bead_cost,
      labor_total_cost_krw = v_labor_total_cost,

      total_amount_sell_krw = coalesce(v_final_sell,0),
      total_amount_cost_krw = coalesce(v_final_cost,0),

      is_priced_final = true,
      priced_at = v_now,
      updated_at = v_now
    where shipment_line_id = r_line.shipment_line_id;

    v_total_sell := v_total_sell + coalesce(v_final_sell,0);
    v_total_cost := v_total_cost + coalesce(v_final_cost,0);
  end loop;

  v_pricing_locked_at := coalesce(v_hdr.pricing_locked_at, v_now);

  update public.cms_shipment_header
  set status = 'CONFIRMED',
      confirmed_at = v_now,
      pricing_locked_at = coalesce(pricing_locked_at, v_pricing_locked_at),
      pricing_source = coalesce(pricing_source, v_pricing_source)
  where shipment_id = p_shipment_id;

  insert into public.cms_shipment_valuation(
    shipment_id, pricing_locked_at, pricing_source,
    gold_tick_id, silver_tick_id,
    gold_krw_per_g_snapshot, silver_krw_per_g_snapshot, silver_adjust_factor_snapshot,
    material_value_krw, labor_value_krw, total_value_krw, breakdown
  )
  values (
    p_shipment_id, v_pricing_locked_at, v_pricing_source,
    v_gold_tick_id, v_silver_tick_id,
    v_gold_price, v_silver_price, v_silver_adjust_factor_applied,
    (select coalesce(sum(material_amount_sell_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id),
    (select coalesce(sum(labor_total_sell_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id),
    v_total_sell,
    jsonb_build_object(
      'silver_factor_embedded_in_tick', v_silver_factor_embedded_in_tick,
      'silver_factor_snapshot', v_silver_factor_snapshot,
      'silver_factor_applied', v_silver_adjust_factor_applied
    )
  )
  on conflict (shipment_id) do update
    set pricing_locked_at = excluded.pricing_locked_at,
        pricing_source = excluded.pricing_source,
        gold_tick_id = excluded.gold_tick_id,
        silver_tick_id = excluded.silver_tick_id,
        gold_krw_per_g_snapshot = excluded.gold_krw_per_g_snapshot,
        silver_krw_per_g_snapshot = excluded.silver_krw_per_g_snapshot,
        silver_adjust_factor_snapshot = excluded.silver_adjust_factor_snapshot,
        material_value_krw = excluded.material_value_krw,
        labor_value_krw = excluded.labor_value_krw,
        total_value_krw = excluded.total_value_krw,
        breakdown = excluded.breakdown;

  if not exists (
    select 1
    from public.cms_ar_ledger
    where entry_type = 'SHIPMENT'
      and shipment_id = p_shipment_id
  ) then
    insert into public.cms_ar_ledger(
      party_id, occurred_at, entry_type, amount_krw,
      shipment_id, memo, total_weight_g, total_labor_krw
    )
    values (
      v_hdr.customer_party_id,
      v_now,
      'SHIPMENT',
      v_total_sell,
      p_shipment_id,
      p_note,
      v_total_weight,
      v_total_labor
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

alter function public.cms_fn_confirm_shipment(uuid, uuid, text) security definer;
grant execute on function public.cms_fn_confirm_shipment(uuid, uuid, text) to authenticated;

create or replace function public.create_ar_from_shipment()
returns trigger as $$
begin
  -- CONFIRMED로 변경될 때만 실행
  if new.status = 'CONFIRMED' and old.status != 'CONFIRMED' then
    -- 해당 출고의 모든 라인에 대해 AR 생성
    insert into public.cms_ar_ledger (
      ar_ledger_id,
      party_id,
      occurred_at,
      entry_type,
      amount_krw,
      shipment_id,
      shipment_line_id,
      memo,
      total_weight_g,
      total_labor_krw,
      created_at
    )
    select 
      gen_random_uuid(),
      new.customer_party_id,
      new.confirmed_at,
      'SHIPMENT',
      sl.total_amount_sell_krw,
      new.shipment_id,
      sl.shipment_line_id,
      'Auto-generated from shipment confirm',
      coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g,0) - coalesce(sl.deduction_weight_g,0), 0)),
      coalesce(sl.labor_total_sell_krw, sl.manual_labor_krw, 0),
      now()
    from public.cms_shipment_line sl
    where sl.shipment_id = new.shipment_id
    -- 이미 AR이 없는 경우에만 생성 (중복 방지)
    and not exists (
      select 1 from public.cms_ar_ledger ar
      where ar.shipment_line_id = sl.shipment_line_id
      and ar.entry_type = 'SHIPMENT'
    );
    
    -- 주문 상태도 SHIPPED로 업데이트
    update public.cms_order_line
    set 
      status = 'SHIPPED',
      updated_at = now()
    where order_line_id in (
      select order_line_id 
      from public.cms_shipment_line 
      where shipment_id = new.shipment_id
      and order_line_id is not null
    );
  end if;
  
  return new;
end;
$$ language plpgsql;
