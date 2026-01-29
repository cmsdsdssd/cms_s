set search_path = public, pg_temp;

create or replace function public.cms_fn_confirm_shipment(
  p_shipment_id uuid,
  p_actor_person_id uuid default null::uuid,
  p_note text default null::text
) returns jsonb
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

  v_line_cnt int := 0;

  -- NEW
  v_master_id uuid;
begin
  select * into v_hdr
  from public.cms_shipment_header
  where shipment_id = p_shipment_id
  for update;

  if not found then
    raise exception 'shipment not found: %', p_shipment_id;
  end if;

  if v_hdr.status = 'CONFIRMED' then
    return jsonb_build_object(
      'ok', true,
      'already_confirmed', true,
      'shipment_id', p_shipment_id,
      'confirmed_at', v_hdr.confirmed_at,
      'total_sell_krw', (select coalesce(sum(total_amount_sell_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id),
      'total_cost_krw', (select coalesce(sum(total_amount_cost_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id)
    );
  end if;

  select count(*) into v_line_cnt
  from public.cms_shipment_line
  where shipment_id = p_shipment_id;

  if v_line_cnt <= 0 then
    raise exception 'cannot confirm shipment with no lines (shipment_id=%)', p_shipment_id;
  end if;

  v_ship_date := coalesce(v_hdr.ship_date, current_date);

  select t.tick_id, t.price into v_gold_tick_id, v_gold_price
  from public.cms_fn_latest_tick('GOLD_KRW_PER_G') t;

  select t.tick_id, t.price into v_silver_tick_id, v_silver_price
  from public.cms_fn_latest_tick('SILVER_KRW_PER_G') t;

  for r_line in
    select *
    from public.cms_shipment_line
    where shipment_id = p_shipment_id
    order by created_at asc
    for update
  loop
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

    -- carry over basic fields (unchanged)
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
    -- NEW: resolve master_id strictly (no model_name matching)
    ----------------------------------------------------------------------
    v_master_id :=
      coalesce(
        r_line.master_id,
        case
          when r_order.order_line_id is not null and r_order.match_state = 'MATCHED' then r_order.matched_master_id
          else null
        end
      );

    -- 정책: 주문/출고는 마스터 필수 (repair는 필요 시 예외 가능)
    if r_line.order_line_id is not null then
      if v_master_id is null then
        raise exception using
          errcode = 'P0001',
          message = format('master_id required for shipment_line_id=%s (order_line_id=%s)', r_line.shipment_line_id, r_line.order_line_id);
      end if;
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

      -- snapshot은 마스터의 model_name으로 고정(표시용)
      r_line.model_name := r_master.model_name;
    end if;

    -- category resolve: master 우선 (주문/출고는 결국 master에서 와야 함)
    v_category := coalesce(r_line.category_code, r_master.category_code, r_line.ad_hoc_category_code);
    if v_category is null then
      raise exception using
        errcode = 'P0001',
        message = format('category_code required for shipment_line_id=%s', r_line.shipment_line_id);
    end if;

    -- material resolve
    v_material := coalesce(r_line.material_code, r_master.material_code_default, r_repair.material_code);
    if r_line.pricing_mode <> 'AMOUNT_ONLY' and v_material is null then
      raise exception using
        errcode = 'P0001',
        message = format('material_code required for shipment_line_id=%s', r_line.shipment_line_id);
    end if;

    v_deduct := coalesce(r_line.deduction_weight_g, r_master.deduction_weight_default_g, 0);
    v_measured := r_line.measured_weight_g;

    if v_material is not null and v_material <> '00' and r_line.pricing_mode <> 'AMOUNT_ONLY' then
      if v_measured is null then
        raise exception using
          errcode = 'P0001',
          message = format('measured_weight_g required for shipment_line_id=%s', r_line.shipment_line_id);
      end if;
    end if;

    v_net := greatest(coalesce(v_measured, 0) - coalesce(v_deduct, 0), 0);

    if r_repair.repair_line_id is not null then
      v_repair_fee := coalesce(r_line.repair_fee_krw, r_repair.repair_fee_krw, 0);
    else
      v_repair_fee := coalesce(r_line.repair_fee_krw, 0);
    end if;

    -- labor resolve (원본 로직 유지: r_master 있으면 적용)
    if r_master.master_id is not null then
      -- (여기 아래 labor band/manual 분기 ~ plating/재질계산 ~ update 로직은 네 원본 그대로 두되)
      -- NOTE: 아래 update에는 master_id도 함께 저장하도록만 추가하면 됨.
      null;
    end if;

    ----------------------------------------------------------------------
    -- IMPORTANT: 네 원본의 "update cms_shipment_line set ..." 블록에
    -- master_id = v_master_id
    -- model_name = r_line.model_name (이미 master로 스냅샷 고정됨)
    -- 을 추가해줘야 함.
    --
    -- 아래는 'update set'에서 핵심만 보여주는 형태(너 원본 update 블록에 합쳐넣기)
    ----------------------------------------------------------------------
    update public.cms_shipment_line
    set
      master_id = v_master_id,
      category_code = v_category,
      model_name = r_line.model_name,
      suffix = r_line.suffix,
      color = r_line.color,
      size = r_line.size,
      qty = r_line.qty
      -- 나머지 원본 update set 항목들은 그대로 유지
    where shipment_line_id = r_line.shipment_line_id;

    -- ※ 너 원본엔 v_total_sell/cost 누적이 있으니 거기 로직 유지
  end loop;

  -- header confirm + AR ledger + status updates + decision log + return
  -- (이 아래는 네 원본 그대로 유지)

  update public.cms_shipment_header
  set status = 'CONFIRMED',
      confirmed_at = v_now,
      memo = coalesce(public.cms_shipment_header.memo,'')
  where shipment_id = p_shipment_id;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'confirmed_at', v_now
  );
end $function$;
