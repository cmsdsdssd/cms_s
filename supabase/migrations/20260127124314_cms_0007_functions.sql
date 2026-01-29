set search_path = public, pg_temp;

-- 0007: functions (RPC)
-- Phase1 紐⑺몴: "遺꾩꽍 1?쒖쐞 + ?댁쁺 ?덉젙??2?쒖쐞"瑜??꾪빐
-- 異쒓퀬?뺤젙/寃곗젣/諛섑뭹? 諛섎뱶???⑥닔濡????몃옖??뀡 泥섎━

-- ------------------------------------------------------------
-- Helper: latest tick
-- ------------------------------------------------------------
create or replace function cms_fn_latest_tick(p_symbol cms_e_market_symbol)
returns table(tick_id uuid, price numeric, observed_at timestamptz)
language sql stable as $$
  select t.tick_id, t.price, t.observed_at
  from cms_market_tick t
  where t.symbol = p_symbol
  order by t.observed_at desc
  limit 1;
$$;

-- ------------------------------------------------------------
-- Helper: pick plating rule (most specific first, then priority)
-- ------------------------------------------------------------
create or replace function cms_fn_pick_plating_rule(
  p_plating_variant_id uuid,
  p_category_code cms_e_category_code,
  p_material_code cms_e_material_code,
  p_on_date date
)
returns table(
  rule_id uuid,
  sell_fixed_krw numeric,
  sell_per_g_krw numeric,
  cost_fixed_krw numeric,
  cost_per_g_krw numeric
)
language sql stable as $$
  select
    r.rule_id,
    r.sell_fixed_krw,
    r.sell_per_g_krw,
    r.cost_fixed_krw,
    r.cost_per_g_krw
  from cms_plating_price_rule r
  where r.is_active = true
    and r.plating_variant_id = p_plating_variant_id
    and r.effective_from <= p_on_date
    and (r.category_code is null or r.category_code = p_category_code)
    and (r.material_code is null or r.material_code = p_material_code)
  order by
    (r.category_code is not null) desc,
    (r.material_code is not null) desc,
    r.priority asc,
    r.effective_from desc
  limit 1;
$$;

-- ------------------------------------------------------------
-- Helper: pick labor band rule
-- ------------------------------------------------------------
create or replace function cms_fn_pick_labor_band_rule(
  p_category_code cms_e_category_code,
  p_band_code text,
  p_on_date date
)
returns table(
  band_id uuid,
  labor_base_sell numeric,
  labor_center_sell numeric,
  labor_sub1_sell numeric,
  labor_sub2_sell numeric,
  labor_bead_sell numeric,
  labor_base_cost numeric,
  labor_center_cost numeric,
  labor_sub1_cost numeric,
  labor_sub2_cost numeric,
  labor_bead_cost numeric
)
language sql stable as $$
  select
    b.band_id,
    b.labor_base_sell,
    b.labor_center_sell,
    b.labor_sub1_sell,
    b.labor_sub2_sell,
    b.labor_bead_sell,
    b.labor_base_cost,
    b.labor_center_cost,
    b.labor_sub1_cost,
    b.labor_sub2_cost,
    b.labor_bead_cost
  from cms_labor_band_rule b
  where b.is_active = true
    and b.category_code = p_category_code
    and b.band_code = p_band_code
    and b.effective_from <= p_on_date
  order by b.effective_from desc
  limit 1;
$$;

-- ------------------------------------------------------------
-- RPC #1: 異쒓퀬 ?뺤젙 (媛寃??ㅻ깄???좉툑 + AR ?먯옣 + ?곹깭 ?낅뜲?댄듃)
-- ------------------------------------------------------------
create or replace function cms_fn_confirm_shipment(
  p_shipment_id uuid,
  p_actor_person_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
as $$
declare
  v_hdr cms_shipment_header%rowtype;
  v_ship_date date;
  v_now timestamptz := now();

  v_gold_tick_id uuid;
  v_gold_price numeric;
  v_silver_tick_id uuid;
  v_silver_price numeric;

  v_total_sell numeric := 0;
  v_total_cost numeric := 0;

  r_line cms_shipment_line%rowtype;

  r_order cms_order_line%rowtype;
  r_repair cms_repair_line%rowtype;
  r_master cms_master_item%rowtype;

  v_category cms_e_category_code;
  v_material cms_e_material_code;

  v_measured numeric;
  v_deduct numeric;
  v_net numeric;

  -- labor snapshot
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

  -- material snapshot
  v_material_amount_sell numeric := 0;
  v_material_amount_cost numeric := 0;

  -- plating snapshot
  v_is_plated boolean := false;
  v_plating_variant_id uuid;
  v_plating_rule_id uuid;
  v_plating_sell numeric := 0;
  v_plating_cost numeric := 0;

  -- repair fee (sell only)
  v_repair_fee numeric := 0;

  -- rule totals
  v_rule_total_sell numeric := 0;
  v_rule_total_cost numeric := 0;

  -- final totals by mode
  v_final_sell numeric := 0;
  v_final_cost numeric := 0;

  -- band rule
  v_band_id uuid;

  -- shipped qty aggregates
  v_shipped_qty int;
begin
  -- lock header
  select * into v_hdr
  from cms_shipment_header
  where shipment_id = p_shipment_id
  for update;

  if not found then
    raise exception 'shipment not found: %', p_shipment_id;
  end if;

  -- idempotent: already confirmed -> return totals
  if v_hdr.status = 'CONFIRMED'::cms_e_shipment_status then
    return jsonb_build_object(
      'ok', true,
      'already_confirmed', true,
      'shipment_id', p_shipment_id,
      'confirmed_at', v_hdr.confirmed_at,
      'total_sell_krw', (select coalesce(sum(total_amount_sell_krw),0) from cms_shipment_line where shipment_id = p_shipment_id),
      'total_cost_krw', (select coalesce(sum(total_amount_cost_krw),0) from cms_shipment_line where shipment_id = p_shipment_id)
    );
  end if;

  v_ship_date := coalesce(v_hdr.ship_date, current_date);

  -- ticks (latest)
  select t.tick_id, t.price into v_gold_tick_id, v_gold_price
  from cms_fn_latest_tick('GOLD_KRW_PER_G') t;

  select t.tick_id, t.price into v_silver_tick_id, v_silver_price
  from cms_fn_latest_tick('SILVER_KRW_PER_G') t;

  -- loop lines
  for r_line in
    select *
    from cms_shipment_line
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
      select * into r_order from cms_order_line where order_line_id = r_line.order_line_id;
    end if;

    if r_line.repair_line_id is not null then
      select * into r_repair from cms_repair_line where repair_line_id = r_line.repair_line_id;
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

    -- master match by model_name
    if r_line.model_name is not null then
      select * into r_master
      from cms_master_item
      where model_name = r_line.model_name;
    end if;

    -- category resolve
    v_category := coalesce(r_line.category_code, r_master.category_code, r_line.ad_hoc_category_code);
    if v_category is null then
      raise exception 'category_code required for shipment_line_id=%', r_line.shipment_line_id;
    end if;

    -- material resolve
    v_material := coalesce(r_line.material_code, r_master.material_code_default, r_repair.material_code);
    -- material can be null only for AMOUNT_ONLY; otherwise require
    if r_line.pricing_mode <> 'AMOUNT_ONLY' and v_material is null then
      raise exception 'material_code required for shipment_line_id=%', r_line.shipment_line_id;
    end if;

    -- deduction resolve
    v_deduct := coalesce(r_line.deduction_weight_g, r_master.deduction_weight_default_g, 0);

    -- measured resolve
    v_measured := r_line.measured_weight_g;

    -- require measured for weight-based materials when not AMOUNT_ONLY
    if v_material is not null and v_material <> '00' and r_line.pricing_mode <> 'AMOUNT_ONLY' then
      if v_measured is null then
        raise exception 'measured_weight_g required for shipment_line_id=%', r_line.shipment_line_id;
      end if;
    end if;

    v_net := greatest(coalesce(v_measured, 0) - coalesce(v_deduct, 0), 0);

    -- repair fee (sell only)
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
        from cms_fn_pick_labor_band_rule(v_category, r_master.labor_band_code, v_ship_date) b;

        -- if band not found -> fallback to master manual
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
        -- manual
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

    -- plating resolve + compute
    v_is_plated := coalesce(r_line.is_plated, false);
    v_plating_variant_id := r_line.plating_variant_id;

    if v_is_plated is true then
      if v_plating_variant_id is null then
        raise exception 'plating_variant_id required when is_plated=true for shipment_line_id=%', r_line.shipment_line_id;
      end if;

      -- rule pick
      select p.rule_id
        into v_plating_rule_id
      from cms_fn_pick_plating_rule(v_plating_variant_id, v_category, v_material, v_ship_date) p;

      if v_plating_rule_id is not null then
        select p.sell_fixed_krw, p.sell_per_g_krw, p.cost_fixed_krw, p.cost_per_g_krw
          into v_plating_sell, v_labor_center_cost, v_plating_cost, v_labor_sub1_cost
        from cms_fn_pick_plating_rule(v_plating_variant_id, v_category, v_material, v_ship_date) p;

        -- v_plating_sell = sell_fixed, v_labor_center_cost = sell_per_g
        -- v_plating_cost = cost_fixed, v_labor_sub1_cost = cost_per_g
        v_plating_sell := round(coalesce(v_plating_sell,0) + coalesce(v_labor_center_cost,0) * v_net, 0);
        v_plating_cost := round(coalesce(v_plating_cost,0) + coalesce(v_labor_sub1_cost,0) * v_net, 0);
      else
        -- fallback to master defaults as fixed
        v_plating_sell := round(coalesce(r_master.plating_price_sell_default,0), 0);
        v_plating_cost := round(coalesce(r_master.plating_price_cost_default,0), 0);
      end if;
    end if;

    -- material amount compute (sell/cost ?숈씪 ?곸슜: Phase1 湲곕낯)
    if v_material is null or v_material = '00' then
      v_material_amount_sell := 0;
      v_material_amount_cost := 0;
    else
      if v_material in ('14','18','24') then
        if v_gold_tick_id is null then
          raise exception 'missing gold tick in cms_market_tick';
        end if;

        v_material_amount_sell :=
          case v_material
            when '14' then round(v_gold_price * 0.6435 * v_net, 0)
            when '18' then round(v_gold_price * 0.8250 * v_net, 0)
            when '24' then round(v_gold_price * 1.0000 * v_net, 0)
          end;

      elsif v_material = '925' then
        if v_silver_tick_id is null then
          raise exception 'missing silver tick in cms_market_tick';
        end if;

        v_material_amount_sell := round(v_silver_price * 0.9250 * coalesce(r_line.silver_adjust_factor, 1.2) * v_net, 0);
      else
        v_material_amount_sell := 0;
      end if;

      v_material_amount_cost := v_material_amount_sell;
    end if;

    -- RULE totals
    v_rule_total_sell := coalesce(v_material_amount_sell,0)
                         + coalesce(v_labor_total_sell,0)
                         + coalesce(v_plating_sell,0)
                         + coalesce(v_repair_fee,0);

    v_rule_total_cost := coalesce(v_material_amount_cost,0)
                         + coalesce(v_labor_total_cost,0)
                         + coalesce(v_plating_cost,0);

    -- FINAL totals by mode
    if r_line.pricing_mode = 'AMOUNT_ONLY' then
      if r_line.manual_total_amount_krw is null then
        raise exception 'manual_total_amount_krw required for AMOUNT_ONLY shipment_line_id=%', r_line.shipment_line_id;
      end if;
      v_final_sell := round(r_line.manual_total_amount_krw, 0);
      v_final_cost := round(v_rule_total_cost, 0); -- 遺꾩꽍?? cost??RULE濡?異붿젙
    elsif r_line.pricing_mode = 'UNIT' then
      if r_line.unit_price_krw is null then
        raise exception 'unit_price_krw required for UNIT shipment_line_id=%', r_line.shipment_line_id;
      end if;
      v_final_sell := round(r_line.unit_price_krw * r_line.qty, 0); -- ?④?(?꾧툑 ?ы븿)
      v_final_cost := round(v_rule_total_cost, 0); -- 遺꾩꽍??cost??RULE 異붿젙
    else
      v_final_sell := round(v_rule_total_sell, 0);
      v_final_cost := round(v_rule_total_cost, 0);
    end if;

    -- update snapshot on shipment_line (lock)
    update cms_shipment_line
    set
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

  -- confirm header
  update cms_shipment_header
  set status = 'CONFIRMED'::cms_e_shipment_status,
      confirmed_at = v_now,
      memo = coalesce(cms_shipment_header.memo,'')
  where shipment_id = p_shipment_id;

  -- AR ledger (single row per shipment) - idempotent
  if not exists (
    select 1 from cms_ar_ledger
    where entry_type = 'SHIPMENT'
      and shipment_id = p_shipment_id
  ) then
    insert into cms_ar_ledger(
      party_id, occurred_at, entry_type, amount_krw,
      shipment_id, memo
    )
    values (
      v_hdr.customer_party_id, v_now, 'SHIPMENT', v_total_sell,
      p_shipment_id, p_note
    );
  end if;

  -- update order_line status (cumulative shipped in CONFIRMED shipments)
  update cms_order_line o
  set status = case
    when s.shipped_qty >= o.qty then 'SHIPPED'::cms_e_order_status
    else 'READY_TO_SHIP'::cms_e_order_status
  end
  from (
    select sl.order_line_id, sum(sl.qty)::int as shipped_qty
    from cms_shipment_line sl
    join cms_shipment_header sh on sh.shipment_id = sl.shipment_id
    where sh.status = 'CONFIRMED'::cms_e_shipment_status
      and sl.order_line_id is not null
    group by sl.order_line_id
  ) s
  where o.order_line_id = s.order_line_id
    and o.status <> 'CANCELLED'::cms_e_order_status;

  -- update repair_line status (cumulative shipped in CONFIRMED shipments)
  update cms_repair_line r
  set status = case
    when s.shipped_qty >= r.qty then 'SHIPPED'::cms_e_repair_status
    else 'READY_TO_SHIP'::cms_e_repair_status
  end
  from (
    select sl.repair_line_id, sum(sl.qty)::int as shipped_qty
    from cms_shipment_line sl
    join cms_shipment_header sh on sh.shipment_id = sl.shipment_id
    where sh.status = 'CONFIRMED'::cms_e_shipment_status
      and sl.repair_line_id is not null
    group by sl.repair_line_id
  ) s
  where r.repair_line_id = s.repair_line_id
    and r.status <> 'CANCELLED'::cms_e_repair_status;

  -- decision log (one row)
  insert into cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, note)
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
end $$;

-- ------------------------------------------------------------
-- RPC #2: 寃곗젣 ?깅줉 (蹂듭닔 ?섎떒) + AR ?먯옣(PAYMENT)
-- p_tenders: jsonb array [{method:'BANK', amount_krw:12345, meta:{...}}, ...]
-- ------------------------------------------------------------
create or replace function cms_fn_record_payment(
  p_party_id uuid,
  p_paid_at timestamptz,
  p_tenders jsonb,
  p_memo text default null
)
returns jsonb
language plpgsql
as $$
declare
  v_payment_id uuid;
  v_total numeric := 0;
  v_elem jsonb;
  v_method cms_e_payment_method;
  v_amount numeric;
  v_meta jsonb;
begin
  if p_tenders is null or jsonb_typeof(p_tenders) <> 'array' then
    raise exception 'p_tenders must be a jsonb array';
  end if;

  insert into cms_payment_header(party_id, paid_at, memo, total_amount_krw)
  values (p_party_id, p_paid_at, p_memo, 0)
  returning payment_id into v_payment_id;

  for v_elem in select * from jsonb_array_elements(p_tenders)
  loop
    v_method := (v_elem->>'method')::cms_e_payment_method;
    v_amount := (v_elem->>'amount_krw')::numeric;
    v_meta := coalesce(v_elem->'meta', '{}'::jsonb);

    if v_amount is null or v_amount <= 0 then
      raise exception 'invalid amount_krw in tender: %', v_elem;
    end if;

    insert into cms_payment_tender_line(payment_id, method, amount_krw, meta)
    values (v_payment_id, v_method, v_amount, v_meta);

    v_total := v_total + v_amount;
  end loop;

  update cms_payment_header
  set total_amount_krw = round(v_total, 0)
  where payment_id = v_payment_id;

  insert into cms_ar_ledger(party_id, occurred_at, entry_type, amount_krw, payment_id, memo)
  values (p_party_id, p_paid_at, 'PAYMENT', -round(v_total,0), v_payment_id, p_memo);

  return jsonb_build_object(
    'ok', true,
    'payment_id', v_payment_id,
    'total_amount_krw', round(v_total,0)
  );
end $$;

-- ------------------------------------------------------------
-- RPC #3: 諛섑뭹 ?깅줉(遺遺꾨컲??+ override) + AR ?먯옣(RETURN)
-- override ?놁쑝硫? (異쒓퀬?쇱씤湲덉븸/異쒓퀬?쇱씤?섎웾)*諛섑뭹?섎웾
-- ------------------------------------------------------------
create or replace function cms_fn_record_return(
  p_shipment_line_id uuid,
  p_return_qty int,
  p_occurred_at timestamptz,
  p_override_amount_krw numeric default null,
  p_reason text default null
)
returns jsonb
language plpgsql
as $$
declare
  r_sl record;
  v_auto numeric;
  v_final numeric;
  v_return_id uuid;
begin
  if p_return_qty is null or p_return_qty <= 0 then
    raise exception 'return_qty must be > 0';
  end if;

  select sl.*, sh.customer_party_id
  into r_sl
  from cms_shipment_line sl
  join cms_shipment_header sh on sh.shipment_id = sl.shipment_id
  where sl.shipment_line_id = p_shipment_line_id
  for update;

  if not found then
    raise exception 'shipment_line not found: %', p_shipment_line_id;
  end if;

  if r_sl.qty is null or r_sl.qty <= 0 then
    raise exception 'invalid shipment_line.qty for %', p_shipment_line_id;
  end if;

  if p_return_qty > r_sl.qty then
    raise exception 'return_qty exceeds shipped qty (return_qty=%, shipped_qty=%) for %', p_return_qty, r_sl.qty, p_shipment_line_id;
  end if;

  v_auto := round((r_sl.total_amount_sell_krw / r_sl.qty) * p_return_qty, 0);
  v_final := round(coalesce(p_override_amount_krw, v_auto), 0);

  insert into cms_return_line(
    party_id, shipment_line_id, return_qty,
    auto_return_amount_krw, final_return_amount_krw,
    reason, occurred_at
  )
  values (
    r_sl.customer_party_id, p_shipment_line_id, p_return_qty,
    v_auto, v_final,
    p_reason, p_occurred_at
  )
  returning return_line_id into v_return_id;

  insert into cms_ar_ledger(
    party_id, occurred_at, entry_type, amount_krw,
    shipment_id, shipment_line_id, return_line_id, memo
  )
  values (
    r_sl.customer_party_id, p_occurred_at, 'RETURN', -v_final,
    r_sl.shipment_id, p_shipment_line_id, v_return_id, p_reason
  );

  return jsonb_build_object(
    'ok', true,
    'return_line_id', v_return_id,
    'auto_amount_krw', v_auto,
    'final_amount_krw', v_final
  );
end $$;
