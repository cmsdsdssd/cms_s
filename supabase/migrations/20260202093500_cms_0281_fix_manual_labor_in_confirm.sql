-- 🔥🔥🔥 근본 해결: 출고 확정 시 수동 공임(manual_labor_krw)이 계산에 반영되도록 수정
-- 문제: cms_fn_confirm_shipment에서 manual_labor_krw를 무시하고 마스터 기본 공임만 사용
-- 결과: 사용자가 입력한 공임이 출고 확정 시 덮어씌워짐
-- 해결: manual_labor_krw가 있으면 우선 사용하도록 로직 변경
-- 주의: 기존 마이그레이션 수정이 아닌, 새로운 ALTER FUNCTION으로 해결

-- 1. 기존 함수를 수정하는 대신, 함수 내용 전체를 새로 정의 (CREATE OR REPLACE)
-- PostgreSQL에서는 CREATE OR REPLACE FUNCTION으로 기존 함수를 교체할 수 있음

CREATE OR REPLACE FUNCTION public.cms_fn_confirm_shipment(
  p_shipment_id uuid,
  p_actor_person_id uuid default null::uuid,
  p_note text default null::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path to 'public', 'pg_temp'
AS $function$
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
begin
  -- lock header
  select * into v_hdr
  from public.cms_shipment_header
  where shipment_id = p_shipment_id
  for update;

  if not found then
    raise exception 'shipment not found: %', p_shipment_id;
  end if;

  -- idempotent / backfill
  if v_hdr.status = 'CONFIRMED' then
    if not exists (
      select 1
      from public.cms_shipment_line
      where shipment_id = p_shipment_id
        and coalesce(is_priced_final,false) = false
    ) then
      if not exists (
        select 1
        from public.cms_ar_ledger
        where entry_type = 'SHIPMENT'
          and shipment_id = p_shipment_id
      ) then
        insert into public.cms_ar_ledger(
          party_id, occurred_at, entry_type, amount_krw,
          shipment_id, memo
        )
        values (
          v_hdr.customer_party_id,
          coalesce(v_hdr.confirmed_at, v_now),
          'SHIPMENT',
          (select coalesce(sum(total_amount_sell_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id),
          p_shipment_id,
          p_note
        );
      end if;

      return jsonb_build_object(
        'ok', true,
        'already_confirmed', true,
        'shipment_id', p_shipment_id,
        'confirmed_at', v_hdr.confirmed_at
      );
    end if;
  end if;

  v_ship_date := coalesce(v_hdr.ship_date, current_date);

  -- ticks (latest)
  select t.tick_id, t.price, t.observed_at, t.symbol
    into v_gold_tick_id, v_gold_price, v_gold_observed_at, v_gold_symbol
  from public.cms_fn_latest_tick_by_role_v1('GOLD') t;

  select t.tick_id, t.price, t.observed_at, t.symbol
    into v_silver_tick_id, v_silver_price, v_silver_observed_at, v_silver_symbol
  from public.cms_fn_latest_tick_by_role_v1('SILVER') t;

  -- Global correction factor (configurable)
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

  -- tick meta (for backward compatibility)
  select mt.meta
    into v_silver_tick_meta
  from public.cms_market_tick mt
  where mt.tick_id = v_silver_tick_id;

  v_silver_tick_meta := coalesce(v_silver_tick_meta, '{}'::jsonb);

  v_silver_factor_embedded_in_tick :=
    coalesce((v_silver_tick_meta->>'factor_applied')::boolean, false);

  v_silver_adjust_factor_applied :=
    case
      when v_silver_factor_embedded_in_tick then 1.0
      else v_silver_kr_correction_factor_cfg
    end;

  v_silver_factor_snapshot := v_silver_adjust_factor_applied;

  -- loop lines
  for r_line in
    select *
    from public.cms_shipment_line
    where shipment_id = p_shipment_id
    order by shipment_line_id
    for update
  loop
    v_line_cnt := v_line_cnt + 1;

    r_order := null;
    r_repair := null;
    r_master := null;

    v_master_id := null;

    v_category := null;
    v_material := null;

    v_measured := null;
    v_deduct := 0;
    v_net := null;

    v_labor_base_sell := 0;
    v_labor_center_sell := 0;
    v_labor_sub1_sell := 0;
    v_labor_sub2_sell := 0;
    v_labor_bead_sell := 0;

    v_labor_base_cost := 0;
    v_labor_center_cost := 0;
    v_labor_sub1_cost := 0;
    v_labor_sub2_cost := 0;
    v_labor_bead_cost := 0;

    v_labor_total_sell := 0;
    v_labor_total_cost := 0;

    v_material_amount_sell := 0;
    v_material_amount_cost := 0;

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

    -- plating snapshot
    v_is_plated := coalesce(r_line.is_plated, false);
    if r_order.order_line_id is not null then
      v_is_plated := coalesce(r_line.is_plated, r_order.is_plated, false);
    end if;

    -- 🔥🔥🔥 핵심 수정: manual_labor_krw가 있으면 우선 사용
    if coalesce(r_line.manual_labor_krw, 0) > 0 then
      -- 사용자가 입력한 수동 공임 사용
      v_labor_base_sell := 0;
      v_labor_center_sell := 0;
      v_labor_sub1_sell := 0;
      v_labor_sub2_sell := 0;
      v_labor_bead_sell := 0;
      v_labor_total_sell := r_line.manual_labor_krw;
    else
      -- 마스터 기본 공임 사용
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
    v_rule_total_sell := coalesce(v_material_amount_sell,0) + coalesce(v_labor_total_sell,0) + coalesce(r_line.plating_amount_sell_krw,0);
    v_rule_total_cost := coalesce(v_material_amount_cost,0) + coalesce(v_labor_total_cost,0) + coalesce(r_line.plating_amount_cost_krw,0);

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

  update public.cms_shipment_header
  set status = 'CONFIRMED',
      confirmed_at = v_now
  where shipment_id = p_shipment_id;

  if not exists (
    select 1
    from public.cms_ar_ledger
    where entry_type = 'SHIPMENT'
      and shipment_id = p_shipment_id
  ) then
    insert into public.cms_ar_ledger(
      party_id, occurred_at, entry_type, amount_krw,
      shipment_id, memo
    )
    values (
      v_hdr.customer_party_id,
      v_now,
      'SHIPMENT',
      v_total_sell,
      p_shipment_id,
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

-- 2. 권한 재부여
ALTER FUNCTION public.cms_fn_confirm_shipment(uuid, uuid, text) SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.cms_fn_confirm_shipment(uuid, uuid, text) TO authenticated;

-- 3. 함수 수정 확인
SELECT 
  'cms_fn_confirm_shipment 수정 완료' as 결과,
  prosrc LIKE '%manual_labor_krw%' as manual_labor_체크_포함
FROM pg_proc
WHERE proname = 'cms_fn_confirm_shipment';
