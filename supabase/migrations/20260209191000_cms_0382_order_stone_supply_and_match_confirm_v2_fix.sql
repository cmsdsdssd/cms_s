set search_path = public, pg_temp;
-- ============================================================
-- 1) ENUM: stone supply type
-- ============================================================
do $$
begin
  create type public.cms_e_stone_supply_type as enum ('SELF', 'PROVIDED');
exception
  when duplicate_object then null;
end $$;
-- ============================================================
-- 2) Columns on cms_order_line
-- ============================================================
alter table if exists public.cms_order_line
  add column if not exists center_stone_supply_type public.cms_e_stone_supply_type,
  add column if not exists sub1_stone_supply_type   public.cms_e_stone_supply_type,
  add column if not exists sub2_stone_supply_type   public.cms_e_stone_supply_type;
-- ============================================================
-- 3) RPC: upsert order line v4 (v3 + supply types)
-- ============================================================
create or replace function public.cms_fn_upsert_order_line_v5(
  p_customer_party_id uuid,
  p_master_id uuid,
  p_qty int default 1,
  p_size text default null,
  p_is_plated boolean default false,
  p_plating_variant_id uuid default null,
  p_plating_color_code text default null,
  p_requested_due_date date default null,
  p_priority_code public.cms_e_priority_code default 'NORMAL',
  p_source_channel text default null,
  p_memo text default null,
  p_order_line_id uuid default null,
  p_center_stone_name text default null,
  p_center_stone_qty int default null,
  p_center_stone_supply_type public.cms_e_stone_supply_type default null,
  p_sub1_stone_name text default null,
  p_sub1_stone_qty int default null,
  p_sub1_stone_supply_type public.cms_e_stone_supply_type default null,
  p_sub2_stone_name text default null,
  p_sub2_stone_qty int default null,
  p_sub2_stone_supply_type public.cms_e_stone_supply_type default null,
  p_actor_person_id uuid default null,
  p_suffix text default null,
  p_color text default null,
  p_material_code public.cms_e_material_code default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_master_model_name text;
  v_master_category text;
  v_master_color text;
  v_old_status public.cms_e_order_status;
  v_suffix text;
  v_color text;

  v_center_supply public.cms_e_stone_supply_type;
  v_sub1_supply   public.cms_e_stone_supply_type;
  v_sub2_supply   public.cms_e_stone_supply_type;
begin
  if p_customer_party_id is null then raise exception 'customer_party_id required'; end if;
  if p_master_id is null then raise exception 'P0001: master_id required (strict mode)'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'qty must be > 0'; end if;

  if coalesce(p_is_plated,false) = true and (p_plating_variant_id is null) then
    raise exception 'plating_variant_id required when is_plated=true';
  end if;
  if coalesce(p_is_plated,false) = true and (nullif(trim(coalesce(p_plating_color_code,'')), '') is null) then
    raise exception 'color_code required when is_plated=true';
  end if;

  -- 기존 v3와 동일: stone name/qty 유효성
  if (p_center_stone_name is null and coalesce(p_center_stone_qty, 0) > 0) then
    raise exception 'center_stone_name required when center_stone_qty > 0';
  end if;
  if (p_center_stone_name is not null and coalesce(p_center_stone_qty, 0) <= 0) then
    raise exception 'center_stone_qty must be > 0 when center_stone_name provided';
  end if;

  if (p_sub1_stone_name is null and coalesce(p_sub1_stone_qty, 0) > 0) then
    raise exception 'sub1_stone_name required when sub1_stone_qty > 0';
  end if;
  if (p_sub1_stone_name is not null and coalesce(p_sub1_stone_qty, 0) <= 0) then
    raise exception 'sub1_stone_qty must be > 0 when sub1_stone_name provided';
  end if;

  if (p_sub2_stone_name is null and coalesce(p_sub2_stone_qty, 0) > 0) then
    raise exception 'sub2_stone_name required when sub2_stone_qty > 0';
  end if;
  if (p_sub2_stone_name is not null and coalesce(p_sub2_stone_qty, 0) <= 0) then
    raise exception 'sub2_stone_qty must be > 0 when sub2_stone_name provided';
  end if;

  -- supply type 기본값 규칙:
  -- stone_name이 있으면 기본 SELF, stone_name 없으면 null로 정리
  v_center_supply := case
    when p_center_stone_name is null then null
    else coalesce(p_center_stone_supply_type, 'SELF'::public.cms_e_stone_supply_type)
  end;
  v_sub1_supply := case
    when p_sub1_stone_name is null then null
    else coalesce(p_sub1_stone_supply_type, 'SELF'::public.cms_e_stone_supply_type)
  end;
  v_sub2_supply := case
    when p_sub2_stone_name is null then null
    else coalesce(p_sub2_stone_supply_type, 'SELF'::public.cms_e_stone_supply_type)
  end;

  select model_name, category_code, color
    into v_master_model_name, v_master_category, v_master_color
  from public.cms_master_item
  where master_id = p_master_id;

  if not found then
    raise exception 'P0001: master_id not found in registry';
  end if;

  v_suffix := nullif(trim(coalesce(p_suffix,'')), '');
  if v_suffix is null then
    v_suffix := nullif(trim(coalesce(v_master_category,'')), '');
  end if;
  if v_suffix is null then
    v_suffix := 'UNSPECIFIED';
  end if;

  v_color := nullif(trim(coalesce(p_color,'')), '');
  if v_color is null then
    v_color := nullif(trim(coalesce(v_master_color,'')), '');
  end if;
  if v_color is null then
    v_color := 'NONE';
  end if;

  v_id := coalesce(p_order_line_id, gen_random_uuid());

  if p_order_line_id is not null then
    select status into v_old_status
    from public.cms_order_line
    where order_line_id = p_order_line_id;

    if found and v_old_status::text not in ('ORDER_PENDING', 'ORDER_ACCEPTED') then
      null;
    end if;
  end if;

  insert into public.cms_order_line(
    order_line_id,
    customer_party_id,
    model_name,
    model_name_raw,
    suffix,
    color,
    material_code,
    size,
    qty,
    is_plated,
    plating_variant_id,
    plating_color_code,
    requested_due_date,
    priority_code,
    source_channel,
    memo,
    center_stone_name,
    center_stone_qty,
    center_stone_supply_type,
    sub1_stone_name,
    sub1_stone_qty,
    sub1_stone_supply_type,
    sub2_stone_name,
    sub2_stone_qty,
    sub2_stone_supply_type,
    matched_master_id,
    match_state,
    updated_by,
    updated_at
  )
  values(
    v_id,
    p_customer_party_id,
    v_master_model_name,
    v_master_model_name,
    v_suffix,
    v_color,
    p_material_code,
    p_size,
    p_qty,
    coalesce(p_is_plated,false),
    p_plating_variant_id,
    p_plating_color_code,
    p_requested_due_date,
    p_priority_code,
    p_source_channel,
    p_memo,
    p_center_stone_name,
    p_center_stone_qty,
    v_center_supply,
    p_sub1_stone_name,
    p_sub1_stone_qty,
    v_sub1_supply,
    p_sub2_stone_name,
    p_sub2_stone_qty,
    v_sub2_supply,
    p_master_id,
    'MATCHED'::public.cms_e_order_match_state,
    p_actor_person_id,
    now()
  )
  on conflict (order_line_id) do update
  set customer_party_id = excluded.customer_party_id,
      model_name = excluded.model_name,
      model_name_raw = excluded.model_name_raw,
      suffix = excluded.suffix,
      color = excluded.color,
      material_code = excluded.material_code,
      size = excluded.size,
      qty = excluded.qty,
      is_plated = excluded.is_plated,
      plating_variant_id = excluded.plating_variant_id,
      plating_color_code = excluded.plating_color_code,
      requested_due_date = excluded.requested_due_date,
      priority_code = excluded.priority_code,
      source_channel = excluded.source_channel,
      memo = excluded.memo,
      center_stone_name = excluded.center_stone_name,
      center_stone_qty = excluded.center_stone_qty,
      center_stone_supply_type = excluded.center_stone_supply_type,
      sub1_stone_name = excluded.sub1_stone_name,
      sub1_stone_qty = excluded.sub1_stone_qty,
      sub1_stone_supply_type = excluded.sub1_stone_supply_type,
      sub2_stone_name = excluded.sub2_stone_name,
      sub2_stone_qty = excluded.sub2_stone_qty,
      sub2_stone_supply_type = excluded.sub2_stone_supply_type,
      matched_master_id = excluded.matched_master_id,
      match_state = excluded.match_state,
      updated_by = excluded.updated_by,
      updated_at = now();

  return v_id;
end $$;
grant execute on function public.cms_fn_upsert_order_line_v5 to anon, authenticated, service_role;
-- ============================================================
-- 4) RPC: receipt-line match confirm v2 (stone qty * (margin + self cost))
-- ============================================================
create or replace function public.cms_fn_receipt_line_match_confirm_v2(
  p_receipt_id uuid,
  p_receipt_line_uuid uuid,
  p_order_line_id uuid,
  p_selected_weight_g numeric default null,
  p_selected_material_code public.cms_e_material_code default null,
  p_selected_factory_labor_basic_cost_krw numeric default null,
  p_selected_factory_labor_other_cost_krw numeric default null,
  p_selected_factory_total_cost_krw numeric default null,
  p_actor_person_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing record;

  v_vendor_party_id uuid;
  v_factory_weight numeric;
  v_factory_basic numeric;
  v_factory_other numeric;
  v_factory_total numeric;
  v_line_item_json jsonb;
  v_receipt_material public.cms_e_material_code;

  v_order record;
  v_master record;

  v_selected_weight numeric;
  v_selected_material public.cms_e_material_code;
  v_basic_cost numeric;

  v_other_cost_base numeric;
  v_stone_cost_total_self numeric := 0;
  v_other_cost numeric;

  -- parsed stone qty / unit cost
  v_center_qty numeric := 0;
  v_sub1_qty numeric := 0;
  v_sub2_qty numeric := 0;
  v_center_unit_cost numeric := 0;
  v_sub1_unit_cost numeric := 0;
  v_sub2_unit_cost numeric := 0;

  -- supply types (default SELF when stone exists)
  v_center_supply public.cms_e_stone_supply_type;
  v_sub1_supply public.cms_e_stone_supply_type;
  v_sub2_supply public.cms_e_stone_supply_type;

  -- margins (master per-stone margin * qty)
  v_center_unit_margin numeric := 0;
  v_sub1_unit_margin numeric := 0;
  v_sub2_unit_margin numeric := 0;
  v_center_margin_total numeric := 0;
  v_sub1_margin_total numeric := 0;
  v_sub2_margin_total numeric := 0;
  v_bead_diff numeric := 0;

  v_base_diff numeric;
  v_base_sell numeric;
  v_extra_sell numeric;

  v_master_effective_weight numeric;
  v_weight_warn boolean := false;
  v_weight_deviation_pct numeric := null;

  v_shipment_id uuid;
  v_shipment_line_id uuid;

  v_overridden jsonb := '{}'::jsonb;
  v_extra_items jsonb := '[]'::jsonb;

  -- helpers
  v_num text;
begin
  if p_receipt_id is null or p_receipt_line_uuid is null or p_order_line_id is null then
    raise exception 'receipt_id, receipt_line_uuid, order_line_id required';
  end if;

  select * into v_existing
  from public.cms_receipt_line_match
  where receipt_id = p_receipt_id
    and receipt_line_uuid = p_receipt_line_uuid
    and status = 'CONFIRMED'::public.cms_e_receipt_line_match_status
  limit 1;

  if found then
    if v_existing.order_line_id <> p_order_line_id then
      raise exception 'receipt line already confirmed to another order_line (existing=%, requested=%)', v_existing.order_line_id, p_order_line_id;
    end if;

    return jsonb_build_object(
      'ok', true,
      'already_confirmed', true,
      'receipt_id', p_receipt_id,
      'receipt_line_uuid', p_receipt_line_uuid,
      'order_line_id', p_order_line_id,
      'shipment_id', v_existing.shipment_id,
      'shipment_line_id', v_existing.shipment_line_id,
      'selected_weight_g', v_existing.selected_weight_g,
      'selected_material_code', v_existing.selected_material_code
    );
  end if;

  select vendor_party_id,
         material_code,
         factory_weight_g, factory_labor_basic_cost_krw, factory_labor_other_cost_krw, factory_total_amount_krw,
         line_item_json
    into v_vendor_party_id, v_receipt_material,
         v_factory_weight, v_factory_basic, v_factory_other, v_factory_total,
         v_line_item_json
  from public.cms_v_receipt_line_items_flat_v1
  where receipt_id = p_receipt_id
    and receipt_line_uuid = p_receipt_line_uuid;

  if not found then
    raise exception 'receipt line not found: receipt_id=%, line=%', p_receipt_id, p_receipt_line_uuid;
  end if;

  if v_vendor_party_id is null then
    raise exception 'receipt vendor_party_id required for confirm (receipt_id=%)', p_receipt_id;
  end if;

  select
    ol.*,
    po.vendor_party_id as po_vendor_party_id
  into v_order
  from public.cms_order_line ol
  left join public.cms_factory_po po on po.po_id = ol.factory_po_id
  where ol.order_line_id = p_order_line_id;

  if not found then
    raise exception 'order_line not found: %', p_order_line_id;
  end if;

  if v_order.po_vendor_party_id is distinct from v_vendor_party_id then
    raise exception 'vendor mismatch (receipt vendor %, order vendor %)', v_vendor_party_id, v_order.po_vendor_party_id;
  end if;

  if v_order.status not in (
    'SENT_TO_VENDOR'::public.cms_e_order_status,
    'WAITING_INBOUND'::public.cms_e_order_status,
    'READY_TO_SHIP'::public.cms_e_order_status
  ) then
    raise exception 'order_line status not matchable: %, status=%', p_order_line_id, v_order.status;
  end if;

  if v_order.matched_master_id is null then
    raise exception 'order_line.matched_master_id required (strict master mode): %', p_order_line_id;
  end if;

  select
    m.master_id,
    m.weight_default_g,
    m.deduction_weight_default_g,
    m.material_code_default,
    m.labor_base_sell, m.labor_base_cost,
    m.labor_center_sell, m.labor_center_cost,
    m.labor_sub1_sell,   m.labor_sub1_cost,
    m.labor_sub2_sell,   m.labor_sub2_cost,
    m.labor_bead_sell,   m.labor_bead_cost
  into v_master
  from public.cms_master_item m
  where m.master_id = v_order.matched_master_id;

  if not found then
    raise exception 'master not found: %', v_order.matched_master_id;
  end if;

  v_selected_material := coalesce(
    p_selected_material_code,
    v_receipt_material,
    v_order.material_code,
    v_master.material_code_default
  );
  if v_selected_material is null then
    raise exception 'material_code required at match time (receipt_line=%)', p_receipt_line_uuid;
  end if;

  v_selected_weight := round(coalesce(p_selected_weight_g, v_factory_weight)::numeric, 2);
  if v_selected_material = '00'::public.cms_e_material_code then
    v_selected_weight := coalesce(v_selected_weight, 0);
  end if;
  if v_selected_weight is null or v_selected_weight <= 0 then
    raise exception 'selected_weight_g required and must be > 0';
  end if;

  v_basic_cost := coalesce(p_selected_factory_labor_basic_cost_krw, v_factory_basic, 0);
  v_other_cost_base := coalesce(p_selected_factory_labor_other_cost_krw, v_factory_other, 0);

  -- override flags (기존 v1과 동일)
  if p_selected_weight_g is not null and v_factory_weight is not null and round(p_selected_weight_g::numeric, 2) <> round(v_factory_weight::numeric, 2) then
    v_overridden := v_overridden || jsonb_build_object('weight_g', true);
  end if;
  if p_selected_material_code is not null and v_receipt_material is not null and p_selected_material_code <> v_receipt_material then
    v_overridden := v_overridden || jsonb_build_object('material_code', true);
  end if;
  if p_selected_factory_labor_basic_cost_krw is not null and v_factory_basic is not null and p_selected_factory_labor_basic_cost_krw <> v_factory_basic then
    v_overridden := v_overridden || jsonb_build_object('labor_basic_cost_krw', true);
  end if;
  if p_selected_factory_labor_other_cost_krw is not null and v_factory_other is not null and p_selected_factory_labor_other_cost_krw <> v_factory_other then
    v_overridden := v_overridden || jsonb_build_object('labor_other_cost_krw', true);
  end if;
  if p_selected_factory_total_cost_krw is not null and v_factory_total is not null and p_selected_factory_total_cost_krw <> v_factory_total then
    v_overridden := v_overridden || jsonb_build_object('total_cost_krw', true);
  end if;

  -- weight deviation warn (기존 v1과 동일)
  if v_master.weight_default_g is not null then
    v_master_effective_weight := greatest(coalesce(v_master.weight_default_g, 0) - coalesce(v_master.deduction_weight_default_g, 0), 0);
    v_master_effective_weight := round(v_master_effective_weight::numeric, 2);
    if v_master_effective_weight > 0 then
      v_weight_deviation_pct := abs(v_selected_weight - v_master_effective_weight) / v_master_effective_weight;
      if v_weight_deviation_pct > 0.10 then
        v_weight_warn := true;
      end if;
    end if;
  end if;

  -- ------------------------------
  -- Parse receipt stone qty / unit cost (fallback: order_line qty)
  -- ------------------------------
  v_num := v_line_item_json->>'stone_center_qty';
  if v_num ~ '^-?[0-9]+(\.[0-9]+)?$' then v_center_qty := v_num::numeric; else v_center_qty := coalesce(v_order.center_stone_qty::numeric, 0); end if;

  v_num := v_line_item_json->>'stone_sub1_qty';
  if v_num ~ '^-?[0-9]+(\.[0-9]+)?$' then v_sub1_qty := v_num::numeric; else v_sub1_qty := coalesce(v_order.sub1_stone_qty::numeric, 0); end if;

  v_num := v_line_item_json->>'stone_sub2_qty';
  if v_num ~ '^-?[0-9]+(\.[0-9]+)?$' then v_sub2_qty := v_num::numeric; else v_sub2_qty := coalesce(v_order.sub2_stone_qty::numeric, 0); end if;

  v_num := v_line_item_json->>'stone_center_unit_cost_krw';
  if v_num ~ '^-?[0-9]+(\.[0-9]+)?$' then v_center_unit_cost := v_num::numeric; else v_center_unit_cost := 0; end if;

  v_num := v_line_item_json->>'stone_sub1_unit_cost_krw';
  if v_num ~ '^-?[0-9]+(\.[0-9]+)?$' then v_sub1_unit_cost := v_num::numeric; else v_sub1_unit_cost := 0; end if;

  v_num := v_line_item_json->>'stone_sub2_unit_cost_krw';
  if v_num ~ '^-?[0-9]+(\.[0-9]+)?$' then v_sub2_unit_cost := v_num::numeric; else v_sub2_unit_cost := 0; end if;

  -- supply types: stone name이 있으면 기본 SELF, 없으면 null
  v_center_supply := case
    when v_order.center_stone_name is null then null
    else coalesce(v_order.center_stone_supply_type, 'SELF'::public.cms_e_stone_supply_type)
  end;
  v_sub1_supply := case
    when v_order.sub1_stone_name is null then null
    else coalesce(v_order.sub1_stone_supply_type, 'SELF'::public.cms_e_stone_supply_type)
  end;
  v_sub2_supply := case
    when v_order.sub2_stone_name is null then null
    else coalesce(v_order.sub2_stone_supply_type, 'SELF'::public.cms_e_stone_supply_type)
  end;

  -- self stone cost only
  v_stone_cost_total_self :=
    (case when v_center_supply = 'SELF'::public.cms_e_stone_supply_type then greatest(v_center_qty,0) * greatest(v_center_unit_cost,0) else 0 end)
    + (case when v_sub1_supply   = 'SELF'::public.cms_e_stone_supply_type then greatest(v_sub1_qty,0)   * greatest(v_sub1_unit_cost,0)   else 0 end)
    + (case when v_sub2_supply   = 'SELF'::public.cms_e_stone_supply_type then greatest(v_sub2_qty,0)   * greatest(v_sub2_unit_cost,0)   else 0 end);

  v_other_cost := greatest(v_other_cost_base,0) + greatest(v_stone_cost_total_self,0);

  -- master per-stone margin (sell - cost) * qty
  v_center_unit_margin := coalesce(v_master.labor_center_sell,0) - coalesce(v_master.labor_center_cost,0);
  v_sub1_unit_margin   := coalesce(v_master.labor_sub1_sell,0)   - coalesce(v_master.labor_sub1_cost,0);
  v_sub2_unit_margin   := coalesce(v_master.labor_sub2_sell,0)   - coalesce(v_master.labor_sub2_cost,0);
  v_bead_diff          := coalesce(v_master.labor_bead_sell,0)   - coalesce(v_master.labor_bead_cost,0);

  v_center_margin_total := greatest(v_center_qty,0) * v_center_unit_margin;
  v_sub1_margin_total   := greatest(v_sub1_qty,0)   * v_sub1_unit_margin;
  v_sub2_margin_total   := greatest(v_sub2_qty,0)   * v_sub2_unit_margin;

  v_base_diff := coalesce(v_master.labor_base_sell, 0) - coalesce(v_master.labor_base_cost, 0);
  v_base_sell := greatest(v_basic_cost + v_base_diff, 0);

  -- extra sell = extra cost + (stone margins + bead diff)
  v_extra_sell := greatest(
    v_other_cost
    + coalesce(v_center_margin_total,0)
    + coalesce(v_sub1_margin_total,0)
    + coalesce(v_sub2_margin_total,0)
    + coalesce(v_bead_diff,0)
  , 0);

  -- extra_labor_items must be [{type,label,amount}] for shipments UI
  if coalesce(v_center_margin_total,0) <> 0 then
    v_extra_items := v_extra_items || jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type', 'CENTER',
        'label', '중심공임 마진 x' || greatest(v_center_qty,0)::text,
        'amount', v_center_margin_total,
        'meta', jsonb_build_object('qty', v_center_qty, 'unit_margin', v_center_unit_margin, 'supply', coalesce(v_center_supply::text,'NULL'), 'unit_cost', v_center_unit_cost)
      )
    );
  end if;

  if coalesce(v_sub1_margin_total,0) <> 0 then
    v_extra_items := v_extra_items || jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type', 'SUB1',
        'label', '보조1공임 마진 x' || greatest(v_sub1_qty,0)::text,
        'amount', v_sub1_margin_total,
        'meta', jsonb_build_object('qty', v_sub1_qty, 'unit_margin', v_sub1_unit_margin, 'supply', coalesce(v_sub1_supply::text,'NULL'), 'unit_cost', v_sub1_unit_cost)
      )
    );
  end if;

  if coalesce(v_sub2_margin_total,0) <> 0 then
    v_extra_items := v_extra_items || jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type', 'SUB2',
        'label', '보조2공임 마진 x' || greatest(v_sub2_qty,0)::text,
        'amount', v_sub2_margin_total,
        'meta', jsonb_build_object('qty', v_sub2_qty, 'unit_margin', v_sub2_unit_margin, 'supply', coalesce(v_sub2_supply::text,'NULL'), 'unit_cost', v_sub2_unit_cost)
      )
    );
  end if;

  if coalesce(v_bead_diff,0) <> 0 then
    v_extra_items := v_extra_items || jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type', 'OTHER',
        'label', '비드공임 마진',
        'amount', v_bead_diff
      )
    );
  end if;

  -- shipment 생성/라인 생성/업데이트 (기존 v1 로직 유지)
  v_shipment_id := public.cms_fn_create_shipment_header_v1(v_order.customer_party_id, current_date, null);

  v_shipment_line_id := public.cms_fn_add_shipment_line_from_order_v1(
    v_shipment_id,
    p_order_line_id,
    coalesce(v_order.qty, 1),
    'RULE'::public.cms_e_pricing_mode,
    null,
    v_selected_material,
    null,
    null,
    null,
    null,
    p_note
  );

  perform public.cms_fn_shipment_update_line_v1(
    v_shipment_line_id,
    v_selected_weight,
    0,
    v_base_sell,
    v_extra_sell,
    v_extra_items
  );

  update public.cms_shipment_line
  set purchase_receipt_id = p_receipt_id,
      purchase_receipt_line_uuid = p_receipt_line_uuid,
      material_code = v_selected_material,
      updated_at = now()
  where shipment_line_id = v_shipment_line_id;

  insert into public.cms_receipt_usage(receipt_id, entity_type, entity_id, note)
  values
    (p_receipt_id, 'SHIPMENT_HEADER', v_shipment_id, p_note),
    (p_receipt_id, 'SHIPMENT_LINE', v_shipment_line_id, p_note)
  on conflict do nothing;

  update public.cms_receipt_inbox
  set status = 'LINKED'::public.cms_e_receipt_status,
      updated_at = now()
  where receipt_id = p_receipt_id
    and status = 'UPLOADED'::public.cms_e_receipt_status;

  update public.cms_order_line
  set status = 'READY_TO_SHIP'::public.cms_e_order_status,
      inbound_at = coalesce(inbound_at, now()),
      updated_at = now()
  where order_line_id = p_order_line_id
    and status in ('SENT_TO_VENDOR'::public.cms_e_order_status, 'WAITING_INBOUND'::public.cms_e_order_status);

  insert into public.cms_receipt_line_match(
    receipt_id, receipt_line_uuid, order_line_id,
    status,
    shipment_id, shipment_line_id,
    selected_weight_g, selected_material_code,
    selected_factory_labor_basic_cost_krw, selected_factory_labor_other_cost_krw, selected_factory_total_cost_krw,
    overridden_fields,
    note,
    confirmed_at, confirmed_by
  )
  values(
    p_receipt_id, p_receipt_line_uuid, p_order_line_id,
    'CONFIRMED'::public.cms_e_receipt_line_match_status,
    v_shipment_id, v_shipment_line_id,
    v_selected_weight, v_selected_material,
    v_basic_cost, v_other_cost, coalesce(p_selected_factory_total_cost_krw, v_factory_total),
    v_overridden,
    p_note,
    now(), p_actor_person_id
  )
  on conflict (receipt_id, receipt_line_uuid, order_line_id) do update
    set status = 'CONFIRMED'::public.cms_e_receipt_line_match_status,
        shipment_id = excluded.shipment_id,
        shipment_line_id = excluded.shipment_line_id,
        selected_weight_g = excluded.selected_weight_g,
        selected_material_code = excluded.selected_material_code,
        selected_factory_labor_basic_cost_krw = excluded.selected_factory_labor_basic_cost_krw,
        selected_factory_labor_other_cost_krw = excluded.selected_factory_labor_other_cost_krw,
        selected_factory_total_cost_krw = excluded.selected_factory_total_cost_krw,
        overridden_fields = excluded.overridden_fields,
        note = excluded.note,
        confirmed_at = excluded.confirmed_at,
        confirmed_by = excluded.confirmed_by,
        updated_at = now();

  update public.cms_receipt_line_match
  set status = 'REJECTED'::public.cms_e_receipt_line_match_status,
      updated_at = now()
  where receipt_id = p_receipt_id
    and receipt_line_uuid = p_receipt_line_uuid
    and status = 'SUGGESTED'::public.cms_e_receipt_line_match_status
    and order_line_id <> p_order_line_id;

  return jsonb_build_object(
    'ok', true,
    'already_confirmed', false,
    'receipt_id', p_receipt_id,
    'receipt_line_uuid', p_receipt_line_uuid,
    'order_line_id', p_order_line_id,
    'shipment_id', v_shipment_id,
    'shipment_line_id', v_shipment_line_id,
    'selected_weight_g', v_selected_weight,
    'selected_material_code', v_selected_material,
    'base_labor_sell_krw', v_base_sell,
    'extra_labor_sell_krw', v_extra_sell,
    'stone_cost_included_self_krw', v_stone_cost_total_self,
    'master_effective_weight_g', v_master_effective_weight,
    'weight_deviation_pct', v_weight_deviation_pct,
    'weight_deviation_warn', v_weight_warn
  );
end $$;
grant execute on function public.cms_fn_receipt_line_match_confirm_v2(uuid, uuid, uuid, numeric, public.cms_e_material_code, numeric, numeric, numeric, uuid, text) to authenticated;
grant execute on function public.cms_fn_receipt_line_match_confirm_v2(uuid, uuid, uuid, numeric, public.cms_e_material_code, numeric, numeric, numeric, uuid, text) to service_role;
