-- 20260130183000_cms_0252_fix_confirm_shipment_config_table_and_material.sql
-- 목적:
-- 1) confirm_shipment이 참조해야 하는 설정 테이블은 public.cms_market_tick_config (ZIP SoT)인데
--    현재 DB에 public.cms_market_config를 참조하는 버전이 올라가 있어 42P01 발생.
-- 2) ZIP의 cms_0248 confirm 함수 내에 잘못된 참조(r_master.material)가 있어 42703 발생 가능.
--    => v_material (enum: cms_e_material_code)로 판별하도록 수정.

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

  r_line public.cms_shipment_line%rowtype;

  r_order public.cms_order_line%rowtype;
  r_repair public.cms_repair_line%rowtype;
  r_master public.cms_master_item%rowtype;

  v_category public.cms_e_category_code;
  v_material public.cms_e_material_code;

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

  v_material_amount_sell numeric := 0;
  v_material_amount_cost numeric := 0;
  v_plating_amount_sell numeric := 0;
  v_plating_amount_cost numeric := 0;
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

  v_ship_date := coalesce(v_hdr.ship_date, current_date);

  -- latest ticks by role (requires cms_0250 applied if your DB still had the old version)
  select t.tick_id, t.price, t.observed_at, t.symbol
    into v_gold_tick_id, v_gold_price, v_gold_observed_at, v_gold_symbol
  from public.cms_fn_latest_tick_by_role_v1('GOLD') t;

  select t.tick_id, t.price, t.observed_at, t.symbol
    into v_silver_tick_id, v_silver_price, v_silver_observed_at, v_silver_symbol
  from public.cms_fn_latest_tick_by_role_v1('SILVER') t;

  -- ✅ SoT: public.cms_market_tick_config (ZIP 기준 존재)
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

  v_silver_tick_meta := null;
  if v_silver_tick_id is not null then
    select t.meta into v_silver_tick_meta
    from public.cms_market_tick t
    where t.tick_id = v_silver_tick_id;
  end if;

  v_silver_factor_embedded_in_tick := coalesce((v_silver_tick_meta->>'factor_applied')::boolean, false);

  v_silver_factor_snapshot :=
    case
      when v_silver_factor_embedded_in_tick then 1.0
      else v_silver_kr_correction_factor_cfg
    end;

  update public.cms_shipment_header
  set
    status = 'CONFIRMED'::public.cms_e_shipment_status,
    confirmed_at = v_now,
    ship_date = v_ship_date,
    gold_tick_id = v_gold_tick_id,
    silver_tick_id = v_silver_tick_id,
    updated_at = v_now
  where shipment_id = p_shipment_id;

  for r_line in
    select *
    from public.cms_shipment_line
    where shipment_id = p_shipment_id
    order by created_at
  loop
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

    -- master resolve (existing logic)
    if coalesce(r_line.master_id, r_order.matched_master_id, r_repair.matched_master_id) is not null then
      select * into r_master
      from public.cms_master_item
      where master_id = coalesce(r_line.master_id, r_order.matched_master_id, r_repair.matched_master_id);
    end if;

    v_category := coalesce(r_line.category_code, r_master.category_code, r_line.ad_hoc_category_code);
    if v_category is null then
      raise exception 'category_code required for shipment_line_id=%', r_line.shipment_line_id;
    end if;

    v_material := coalesce(r_line.material_code, r_master.material_code_default, r_repair.material_code);
    if r_line.pricing_mode <> 'AMOUNT_ONLY' and v_material is null then
      raise exception 'material_code required for shipment_line_id=%', r_line.shipment_line_id;
    end if;

    v_measured := coalesce(r_line.measured_weight_g, 0);
    v_deduct := coalesce(r_line.deduction_weight_g, r_master.deduction_weight_default_g, 0);
    v_net := greatest(v_measured - v_deduct, 0);

    -- material amount
    select
      public.cms_fn_calc_material_amount_sell_v1(v_category, v_material, v_net, v_gold_price, v_silver_price, v_silver_factor_snapshot),
      public.cms_fn_calc_material_amount_cost_v1(v_category, v_material, v_net, v_gold_price, v_silver_price, v_silver_factor_snapshot)
    into v_material_amount_sell, v_material_amount_cost;

    -- labor amounts (existing function)
    select
      public.cms_fn_calc_labor_amount_sell_v1(r_line.shipment_line_id),
      public.cms_fn_calc_labor_amount_cost_v1(r_line.shipment_line_id)
    into v_labor_base_sell, v_labor_base_cost;

    update public.cms_shipment_line
    set
      category_code = v_category,
      material_code = v_material,

      measured_weight_g = v_measured,
      deduction_weight_g = v_deduct,
      net_weight_g = v_net,

      gold_tick_id = v_gold_tick_id,
      silver_tick_id = v_silver_tick_id,
      gold_tick_krw_per_g = v_gold_price,
      silver_tick_krw_per_g = v_silver_price,

      -- ✅ FIX: r_master.material(존재하지 않음) 대신 v_material(enum)로 판별
      silver_adjust_factor = case
        when v_material = '925'::public.cms_e_material_code then v_silver_factor_snapshot
        else r_line.silver_adjust_factor
      end,

      material_amount_sell_krw = coalesce(v_material_amount_sell, 0),
      material_amount_cost_krw = coalesce(v_material_amount_cost, 0),

      updated_at = v_now
    where shipment_line_id = r_line.shipment_line_id;

    v_total_sell := v_total_sell + coalesce(r_line.total_amount_sell_krw, 0);
    v_total_cost := v_total_cost + coalesce(v_material_amount_cost, 0);
  end loop;

  update public.cms_shipment_header
  set
    total_amount_sell_krw = v_total_sell,
    total_amount_cost_krw = v_total_cost,
    updated_at = v_now
  where shipment_id = p_shipment_id;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'confirmed_at', v_now,
    'total_sell_krw', v_total_sell,
    'total_cost_krw', v_total_cost
  );
end $function$;
