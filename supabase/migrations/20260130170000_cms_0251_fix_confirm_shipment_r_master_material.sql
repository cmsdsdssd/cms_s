-- cms_0251: fix cms_fn_confirm_shipment() referencing non-existent r_master.material
-- Root cause: r_master is cms_master_item%rowtype and has no column "material".
-- Fix: use the resolved v_material (cms_e_material_code) for the 925 check.

set search_path = public, pg_temp;

-- ------------------------------------------------------------
-- cms_0248: confirm_shipment silver factor snapshot + no-double-apply
--
-- - Snapshot correction factor into shipment_line.silver_adjust_factor
-- - Apply the factor at confirm-time ONLY when tick meta does not
--   indicate it was already applied (backward compatible)
-- ------------------------------------------------------------

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

  v_total_sell numeric := 0;
  v_total_cost numeric := 0;

  v_line_cnt int := 0;

  v_cs_factor numeric;
  v_silver_kr_factor numeric;
  v_silver_factor_snapshot numeric;

  -- loop vars
  r_line public.cms_shipment_line%rowtype;
  r_order public.cms_order_line%rowtype;
  r_repair public.cms_repair_line%rowtype;
  r_master public.cms_master_item%rowtype;

  v_master_id uuid;
  v_category public.cms_e_category_code;
  v_material public.cms_e_material_code;
  v_is_plated boolean;
  v_plating_variant_id uuid;

  v_deduct numeric;
  v_net numeric;

  v_material_amount_sell numeric;
  v_material_amount_cost numeric;

  v_plating_amount_sell numeric;
  v_plating_amount_cost numeric;
begin
  select * into v_hdr
  from public.cms_shipment_header
  where shipment_id = p_shipment_id
  for update;

  if not found then
    raise exception 'shipment not found: %', p_shipment_id;
  end if;

  if v_hdr.status = 'CONFIRMED'::public.cms_e_shipment_status then
    raise exception 'shipment already confirmed: %', p_shipment_id;
  end if;

-- ✅ NEW GUARD: must have at least 1 line
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
    -- Config (SoT)
  -- - cs_correction_factor: used by n8n when computing SILVER_CN_KRW_PER_G (CS)
  -- - silver_kr_correction_factor: used as fallback for KR silver pricing when the tick meta does NOT embed the factor
  select
    coalesce(c.cs_correction_factor, 1.200000),
    coalesce(c.silver_kr_correction_factor, c.cs_correction_factor, 1.200000)
  into v_cs_factor, v_silver_kr_factor
  from public.cms_market_config c
  limit 1;

  -- snapshot factor chosen for this shipment (store into silver_adjust_factor)
  -- if tick meta indicates factor already applied, snapshot=1.0 else snapshot=fallback factor
  v_silver_factor_snapshot :=
    case
      when coalesce(public.cms_fn_tick_meta_has_factor_applied_v1(v_silver_tick_id), false) then 1.0
      else v_silver_kr_factor
    end;

  update public.cms_shipment_header
  set
    status = 'CONFIRMED'::public.cms_e_shipment_status,
    confirmed_at = v_now,
    ship_date = v_ship_date,
    gold_tick_id = v_gold_tick_id,
    silver_tick_id = v_silver_tick_id,
    memo = coalesce(v_hdr.memo, ''),
    updated_at = v_now
  where shipment_id = p_shipment_id;

  for r_line in
    select *
    from public.cms_shipment_line
    where shipment_id = p_shipment_id
    order by created_at
  loop
    -- hydrate order/repair/master
    if r_line.order_line_id is not null then
      select * into r_order
      from public.cms_order_line
      where order_line_id = r_line.order_line_id;
    end if;

    if r_line.repair_line_id is not null then
      select * into r_repair
      from public.cms_repair_line
      where repair_line_id = r_line.repair_line_id;
    end if;

    v_master_id := coalesce(r_line.master_id, r_order.matched_master_id, r_repair.matched_master_id);
    if v_master_id is not null then
      select * into r_master
      from public.cms_master_item
      where master_id = v_master_id;
    end if;

    -- category resolve
    v_category := coalesce(r_line.category_code, r_master.category_code, r_line.ad_hoc_category_code);
    if v_category is null then
      raise exception 'category_code required for shipment_line_id=%', r_line.shipment_line_id;
    end if;

    -- material resolve
    v_material := coalesce(r_line.material_code, r_master.material_code_default, r_repair.material_code);
    if r_line.pricing_mode <> 'AMOUNT_ONLY' and v_material is null then
      raise exception 'material_code required for shipment_line_id=%', r_line.shipment_line_id;
    end if;

    v_deduct := coalesce(r_line.deduction_weight_g, r_master.deduction_weight_g, 0);
    v_net := greatest(coalesce(r_line.measured_weight_g, 0) - v_deduct, 0);

    v_is_plated := coalesce(r_line.is_plated, r_order.is_plated, r_master.is_plated_default, false);
    v_plating_variant_id := coalesce(r_line.plating_variant_id, r_master.plating_variant_id_default);

    -- material sell/cost (existing logic 그대로)
    select
      public.cms_fn_calc_material_amount_sell_v1(v_category, v_material, v_net, v_gold_price, v_silver_price, v_silver_factor_snapshot),
      public.cms_fn_calc_material_amount_cost_v1(v_category, v_material, v_net, v_gold_price, v_silver_price, v_silver_factor_snapshot)
    into v_material_amount_sell, v_material_amount_cost;

    select
      public.cms_fn_calc_plating_amount_sell_v1(v_is_plated, v_plating_variant_id),
      public.cms_fn_calc_plating_amount_cost_v1(v_is_plated, v_plating_variant_id)
    into v_plating_amount_sell, v_plating_amount_cost;

    update public.cms_shipment_line
    set
      category_code = v_category,
      qty = r_line.qty,

      measured_weight_g = r_line.measured_weight_g,
      deduction_weight_g = v_deduct,
      net_weight_g = v_net,

      gold_tick_id = v_gold_tick_id,
      silver_tick_id = v_silver_tick_id,
      gold_tick_krw_per_g = v_gold_price,
      silver_tick_krw_per_g = v_silver_price,

      -- snapshot: store what was actually applied at confirm time
      silver_adjust_factor = case when v_material = '925'::public.cms_e_material_code then v_silver_factor_snapshot else r_line.silver_adjust_factor end,
      material_code = v_material,
      material_amount_sell_krw = coalesce(v_material_amount_sell,0),
      material_amount_cost_krw = coalesce(v_material_amount_cost,0),

      is_plated = v_is_plated,
      plating_variant_id = v_plating_variant_id,
      plating_amount_sell_krw = coalesce(v_plating_amount_sell,0),
      plating_amount_cost_krw = coalesce(v_plating_amount_cost,0),

      updated_at = v_now
    where shipment_line_id = r_line.shipment_line_id;

    v_total_sell := v_total_sell + coalesce(r_line.total_amount_sell_krw, 0);
    v_total_cost := v_total_cost
      + coalesce(v_material_amount_cost, 0)
      + coalesce(v_plating_amount_cost, 0);
  end loop;

  update public.cms_shipment_header
  set
    total_amount_sell_krw = v_total_sell,
    total_amount_cost_krw = v_total_cost,
    updated_at = v_now
  where shipment_id = p_shipment_id;

  if exists (
    select 1 from public.cms_ar_ledger
    where shipment_id = p_shipment_id
      and entry_type = 'SHIPMENT'
  ) then
    null;
  else
    insert into public.cms_ar_ledger(
      party_id, occurred_at, entry_type, amount_krw,
      shipment_id, memo
    )
    values (
      v_hdr.customer_party_id, v_now, 'SHIPMENT', v_total_sell,
      p_shipment_id, p_note
    );
  end if;

  update public.cms_order_line o
  set status = case
    when s.shipped_qty >= o.qty then 'SHIPPED'::cms_e_order_status
    else 'READY_TO_SHIP'::cms_e_order_status
  end
  from (
    select sl.order_line_id, sum(sl.qty)::int as shipped_qty
    from public.cms_shipment_line sl
    join public.cms_shipment_header sh on sh.shipment_id = sl.shipment_id
    where sh.status = 'CONFIRMED'
      and sl.order_line_id is not null
    group by sl.order_line_id
  ) s
  where o.order_line_id = s.order_line_id
    and o.status <> 'CANCELLED'::cms_e_order_status;

  update public.cms_repair_line r
  set status = case
    when s.shipped_qty >= r.qty then 'SHIPPED'::cms_e_repair_status
    else 'READY_TO_SHIP'::cms_e_repair_status
  end
  from (
    select sl.repair_line_id, sum(sl.qty)::int as shipped_qty
    from public.cms_shipment_line sl
    join public.cms_shipment_header sh on sh.shipment_id = sl.shipment_id
    where sh.status = 'CONFIRMED'
      and sl.repair_line_id is not null
    group by sl.repair_line_id
  ) s
  where r.repair_line_id = s.repair_line_id
    and r.status <> 'CANCELLED'::cms_e_repair_status;

  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, note)
  values (
    'SHIPMENT_HEADER', p_shipment_id, 'CONFIRM_SHIPMENT',
    jsonb_build_object('status', v_hdr.status),
    jsonb_build_object('status', 'CONFIRMED', 'total_sell_krw', v_total_sell, 'total_cost_krw', v_total_cost),
    p_actor_person_id,
    p_note
  );

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'confirmed_at', v_now,
    'total_sell_krw', v_total_sell,
    'total_cost_krw', v_total_cost
  );
end $function$;
