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
  v_silver_tick_id uuid;
  v_silver_price numeric;

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
        'confirmed_at', v_hdr.confirmed_at,
        'total_sell_krw', (select coalesce(sum(total_amount_sell_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id),
        'total_cost_krw', (select coalesce(sum(total_amount_cost_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id)
      );
    end if;

    -- confirmed_at은 유지(재정산/backfill 이더라도 timestamp를 새로 찍지 않음)
    v_now := coalesce(v_hdr.confirmed_at, v_now);
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
  select t.tick_id, t.price into v_gold_tick_id, v_gold_price
  from public.cms_fn_latest_tick('GOLD_KRW_PER_G') t;

  select t.tick_id, t.price into v_silver_tick_id, v_silver_price
  from public.cms_fn_latest_tick('SILVER_KRW_PER_G') t;

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

    -- load refs
    if r_line.order_line_id is not null then
      select * into r_order from public.cms_order_line where order_line_id = r_line.order_line_id;
    end if;

    if r_line.repair_line_id is not null then
      select * into r_repair from public.cms_repair_line where repair_line_id = r_line.repair_line_id;
    end if;

    -- derive model & item snapshot defaults
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

    if r_line.size is null and r_order.order_line_id is not null then
      r_line.size := r_order.size;
    end if;

    if r_line.qty is null or r_line.qty <= 0 then
      if r_order.order_line_id is not null then
        r_line.qty := r_order.qty;
      elsif r_repair.repair_line_id is not null then
        r_line.qty := r_repair.qty;
      else
        r_line.qty := 1;
      end if;
    end if;

    -- plating carry over
    if r_line.is_plated is false then
      if r_order.order_line_id is not null then
        r_line.is_plated := r_order.is_plated;
        if r_line.plating_variant_id is null then r_line.plating_variant_id := r_order.plating_variant_id; end if;
      elsif r_repair.repair_line_id is not null then
        r_line.is_plated := r_repair.is_plated;
        if r_line.plating_variant_id is null then r_line.plating_variant_id := r_repair.plating_variant_id; end if;
      end if;
    end if;

    ----------------------------------------------------------------------
    -- master resolve (strict)
    -- - prefer shipment_line.master_id
    -- - else use order_line.matched_master_id
    ----------------------------------------------------------------------
    v_master_id :=
      coalesce(
        r_line.master_id,
        case
          when r_order.order_line_id is not null and r_order.matched_master_id is not null then r_order.matched_master_id
          else null
        end
      );

    -- 주문 기반 출고는 master_id 필수
    if r_line.order_line_id is not null and v_master_id is null then
      raise exception using
        errcode = 'P0001',
        message = format('master_id required for shipment_line_id=%s (order_line_id=%s)', r_line.shipment_line_id, r_line.order_line_id);
    end if;

    if v_master_id is not null then
      select * into r_master
      from public.cms_master_item
      where master_id = v_master_id;

      if not found then
        raise exception using
          errcode = 'P0001',
          message = format('master_item not found for master_id=%s (shipment_line_id=%s)', v_master_id, r_line.shipment_line_id);
      end if;

      -- snapshot: master의 model_name으로 고정
      r_line.model_name := r_master.model_name;
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

    v_deduct := coalesce(r_line.deduction_weight_g, r_master.deduction_weight_default_g, 0);
    v_measured := r_line.measured_weight_g;

    if v_material is not null and v_material <> '00' and r_line.pricing_mode <> 'AMOUNT_ONLY' then
      if v_measured is null then
        raise exception 'measured_weight_g required for shipment_line_id=%', r_line.shipment_line_id;
      end if;
    end if;

    v_net := greatest(coalesce(v_measured, 0) - coalesce(v_deduct, 0), 0);

    if r_repair.repair_line_id is not null then
      v_repair_fee := coalesce(r_line.repair_fee_krw, r_repair.repair_fee_krw, 0);
    else
      v_repair_fee := coalesce(r_line.repair_fee_krw, 0);
    end if;

    -- labor resolve (MANUAL vs BAND)
    if r_master.master_id is not null then
      if upper(coalesce(r_master.labor_profile_mode, 'MANUAL')) = 'BAND'
         and r_master.labor_band_code is not null then

        select b.band_id,
               b.labor_base_sell, b.labor_center_sell, b.labor_sub1_sell, b.labor_sub2_sell, b.labor_bead_sell,
               b.labor_base_cost, b.labor_center_cost, b.labor_sub1_cost, b.labor_sub2_cost, b.labor_bead_cost
          into v_band_id,
               v_labor_base_sell, v_labor_center_sell, v_labor_sub1_sell, v_labor_sub2_sell, v_labor_bead_sell,
               v_labor_base_cost, v_labor_center_cost, v_labor_sub1_cost, v_labor_sub2_cost, v_labor_bead_cost
        from public.cms_fn_pick_labor_band_rule(v_category, r_master.labor_band_code, v_ship_date) b;

        if v_band_id is null then
          v_labor_base_sell := r_master.labor_base_sell;
          v_labor_center_sell := r_master.labor_center_sell;
          v_labor_sub1_sell := r_master.labor_sub1_sell;
          v_labor_sub2_sell := r_master.labor_sub2_sell;
          v_labor_bead_sell := r_master.labor_bead_sell;

          v_labor_base_cost := r_master.labor_base_cost;
          v_labor_center_cost := r_master.labor_center_cost;
          v_labor_sub1_cost := r_master.labor_sub1_cost;
          v_labor_sub2_cost := r_master.labor_sub2_cost;
          v_labor_bead_cost := r_master.labor_bead_cost;
        end if;

      else
        v_labor_base_sell := r_master.labor_base_sell;
        v_labor_center_sell := r_master.labor_center_sell;
        v_labor_sub1_sell := r_master.labor_sub1_sell;
        v_labor_sub2_sell := r_master.labor_sub2_sell;
        v_labor_bead_sell := r_master.labor_bead_sell;

        v_labor_base_cost := r_master.labor_base_cost;
        v_labor_center_cost := r_master.labor_center_cost;
        v_labor_sub1_cost := r_master.labor_sub1_cost;
        v_labor_sub2_cost := r_master.labor_sub2_cost;
        v_labor_bead_cost := r_master.labor_bead_cost;
      end if;
    end if;

    v_labor_total_sell := coalesce(v_labor_base_sell,0) + coalesce(v_labor_center_sell,0) + coalesce(v_labor_sub1_sell,0) + coalesce(v_labor_sub2_sell,0) + coalesce(v_labor_bead_sell,0);
    v_labor_total_cost := coalesce(v_labor_base_cost,0) + coalesce(v_labor_center_cost,0) + coalesce(v_labor_sub1_cost,0) + coalesce(v_labor_sub2_cost,0) + coalesce(v_labor_bead_cost,0);

    v_is_plated := coalesce(r_line.is_plated, false);
    v_plating_variant_id := r_line.plating_variant_id;

    if v_is_plated is true then
      if v_plating_variant_id is null then
        raise exception 'plating_variant_id required when is_plated=true for shipment_line_id=%', r_line.shipment_line_id;
      end if;

      select p.rule_id, p.sell_fixed_krw, p.sell_per_g_krw, p.cost_fixed_krw, p.cost_per_g_krw
        into v_plating_rule_id, v_plating_sell, v_plating_cost, v_labor_base_sell, v_labor_base_cost
      from public.cms_fn_pick_plating_rule(v_plating_variant_id, v_category, v_material, v_ship_date) p;

      v_plating_sell := 0;
      v_plating_cost := 0;

      if v_plating_rule_id is not null then
        select p.sell_fixed_krw, p.sell_per_g_krw, p.cost_fixed_krw, p.cost_per_g_krw
          into v_labor_center_sell, v_labor_center_cost, v_labor_sub1_sell, v_labor_sub1_cost
        from public.cms_fn_pick_plating_rule(v_plating_variant_id, v_category, v_material, v_ship_date) p;

        v_plating_sell := round(coalesce(v_labor_center_sell,0) + coalesce(v_labor_center_cost,0) * v_net, 0);
        v_plating_cost := round(coalesce(v_labor_sub1_sell,0) + coalesce(v_labor_sub1_cost,0) * v_net, 0);
      else
        v_plating_sell := round(coalesce(r_master.plating_price_sell_default,0), 0);
        v_plating_cost := round(coalesce(r_master.plating_price_cost_default,0), 0);
      end if;
    end if;

    if v_material is null or v_material = '00' then
      v_material_amount_sell := 0;
      v_material_amount_cost := 0;
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
        v_material_amount_sell := round(v_silver_price * 0.9250 * coalesce(r_line.silver_adjust_factor, 1.2) * v_net, 0);
      else
        v_material_amount_sell := 0;
      end if;

      v_material_amount_cost := v_material_amount_sell;
    end if;

    v_rule_total_sell := coalesce(v_material_amount_sell,0)
                         + coalesce(v_labor_total_sell,0)
                         + coalesce(v_plating_sell,0)
                         + coalesce(v_repair_fee,0);

    v_rule_total_cost := coalesce(v_material_amount_cost,0)
                         + coalesce(v_labor_total_cost,0)
                         + coalesce(v_plating_cost,0);

    if r_line.pricing_mode = 'AMOUNT_ONLY' then
      if r_line.manual_total_amount_krw is null then
        raise exception 'manual_total_amount_krw required for AMOUNT_ONLY shipment_line_id=%', r_line.shipment_line_id;
      end if;
      v_final_sell := round(r_line.manual_total_amount_krw, 0);
      v_final_cost := round(v_rule_total_cost, 0);
    elsif r_line.pricing_mode = 'UNIT' then
      if r_line.unit_price_krw is null then
        raise exception 'unit_price_krw required for UNIT shipment_line_id=%', r_line.shipment_line_id;
      end if;
      v_final_sell := round(r_line.unit_price_krw * r_line.qty, 0);
      v_final_cost := round(v_rule_total_cost, 0);
    else
      v_final_sell := round(v_rule_total_sell, 0);
      v_final_cost := round(v_rule_total_cost, 0);
    end if;

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

      material_code = v_material,
      material_amount_sell_krw = coalesce(v_material_amount_sell,0),
      material_amount_cost_krw = coalesce(v_material_amount_cost,0),

      is_plated = v_is_plated,
      plating_variant_id = v_plating_variant_id,
      plating_amount_sell_krw = coalesce(v_plating_sell,0),
      plating_amount_cost_krw = coalesce(v_plating_cost,0),

      labor_base_sell_krw = coalesce(v_labor_base_sell,0),
      labor_center_sell_krw = coalesce(v_labor_center_sell,0),
      labor_sub1_sell_krw = coalesce(v_labor_sub1_sell,0),
      labor_sub2_sell_krw = coalesce(v_labor_sub2_sell,0),
      labor_bead_sell_krw = coalesce(v_labor_bead_sell,0),
      labor_total_sell_krw = coalesce(v_labor_total_sell,0),

      labor_base_cost_krw = coalesce(v_labor_base_cost,0),
      labor_center_cost_krw = coalesce(v_labor_center_cost,0),
      labor_sub1_cost_krw = coalesce(v_labor_sub1_cost,0),
      labor_sub2_cost_krw = coalesce(v_labor_sub2_cost,0),
      labor_bead_cost_krw = coalesce(v_labor_bead_cost,0),
      labor_total_cost_krw = coalesce(v_labor_total_cost,0),

      repair_fee_krw = coalesce(v_repair_fee,0),

      total_amount_sell_krw = coalesce(v_final_sell,0),
      total_amount_cost_krw = coalesce(v_final_cost,0),

      is_priced_final = true,
      priced_at = v_now,

      price_calc_trace = jsonb_build_object(
        'pricing_mode', r_line.pricing_mode,
        'rule_total_sell_krw', v_rule_total_sell,
        'rule_total_cost_krw', v_rule_total_cost,
        'master_id', r_master.master_id,
        'labor_source', case when v_band_id is not null then 'BAND' else 'MANUAL_OR_NONE' end,
        'band_id', v_band_id,
        'plating_rule_id', v_plating_rule_id
      )
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
    where entry_type = 'SHIPMENT'
      and shipment_id = p_shipment_id
  ) then
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
grant execute on function public.cms_fn_confirm_shipment(uuid, uuid, text) to authenticated;
