set search_path = public, pg_temp;

-- ============================================================
-- 0379: Order stone source + Match confirm v2 (stone qty*(margin + unit_cost))
-- - ADD ONLY: 기존 v1 / v3 유지
-- - NEW:
--   * enum: cms_e_stone_supply_source ('SELF','PROVIDED')
--   * cms_order_line 컬럼 3개: center/sub1/sub2_stone_source
--   * cms_fn_upsert_order_line_v4: source 저장 포함
--   * cms_fn_receipt_line_match_confirm_v2:
--       - stone_source=PROVIDED면 stone unit_cost는 0 처리(원가 제외)
--       - stone margin은 "역할별 qty * (master labor_role_sell - labor_role_cost)"로 스케일링
--       - extra_labor_sell = other_cost_base + stone_cost(self only) + (stone_margin_total + bead_diff)
-- ============================================================

-- 1) ENUM (자입/타입 구분)
do $$
begin
  create type public.cms_e_stone_supply_source as enum ('SELF', 'PROVIDED');
exception
  when duplicate_object then
    null;
end $$;

-- 2) cms_order_line: role별 stone source 컬럼 추가 (NULL 허용 = "미정")
alter table if exists public.cms_order_line
  add column if not exists center_stone_source public.cms_e_stone_supply_source,
  add column if not exists sub1_stone_source   public.cms_e_stone_supply_source,
  add column if not exists sub2_stone_source   public.cms_e_stone_supply_source;

-- 3) 주문 upsert v4 (기존 v3 유지, source 저장만 추가)
create or replace function public.cms_fn_upsert_order_line_v4(
  p_customer_party_id uuid,
  p_master_id uuid,
  p_qty int default 1,
  p_size text default null,
  p_is_plated boolean default false,
  p_plating_variant_id uuid default null,
  p_plating_color_code text default null,
  p_requested_due_date date default null,
  p_priority_code cms_e_priority_code default 'NORMAL',
  p_source_channel text default null,
  p_memo text default null,
  p_order_line_id uuid default null,
  p_center_stone_name text default null,
  p_center_stone_qty int default null,
  p_sub1_stone_name text default null,
  p_sub1_stone_qty int default null,
  p_sub2_stone_name text default null,
  p_sub2_stone_qty int default null,
  p_actor_person_id uuid default null,
  p_suffix text default null,
  p_color text default null,
  p_material_code cms_e_material_code default null,

  -- NEW
  p_center_stone_source public.cms_e_stone_supply_source default null,
  p_sub1_stone_source   public.cms_e_stone_supply_source default null,
  p_sub2_stone_source   public.cms_e_stone_supply_source default null
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
  v_old_status cms_e_order_status;
  v_suffix text;
  v_color text;
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
    sub1_stone_name,
    sub1_stone_qty,
    sub2_stone_name,
    sub2_stone_qty,

    -- NEW
    center_stone_source,
    sub1_stone_source,
    sub2_stone_source,

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
    nullif(trim(coalesce(p_size,'')), ''),
    p_qty,
    coalesce(p_is_plated,false),
    p_plating_variant_id,
    nullif(trim(coalesce(p_plating_color_code,'')), ''),
    p_requested_due_date,
    coalesce(p_priority_code, 'NORMAL'),
    nullif(trim(coalesce(p_source_channel,'')), ''),
    p_memo,
    nullif(trim(coalesce(p_center_stone_name,'')), ''),
    p_center_stone_qty,
    nullif(trim(coalesce(p_sub1_stone_name,'')), ''),
    p_sub1_stone_qty,
    nullif(trim(coalesce(p_sub2_stone_name,'')), ''),
    p_sub2_stone_qty,

    -- NEW
    p_center_stone_source,
    p_sub1_stone_source,
    p_sub2_stone_source,

    p_master_id,
    'HUMAN_CONFIRMED',
    p_actor_person_id,
    now()
  )
  on conflict (order_line_id) do update set
    customer_party_id   = excluded.customer_party_id,
    model_name          = excluded.model_name,
    model_name_raw      = excluded.model_name_raw,
    suffix              = excluded.suffix,
    color               = excluded.color,
    material_code       = coalesce(excluded.material_code, public.cms_order_line.material_code),
    size                = excluded.size,
    qty                 = excluded.qty,
    is_plated           = excluded.is_plated,
    plating_variant_id  = excluded.plating_variant_id,
    plating_color_code  = excluded.plating_color_code,
    requested_due_date  = excluded.requested_due_date,
    priority_code       = excluded.priority_code,
    source_channel      = excluded.source_channel,
    memo                = excluded.memo,
    center_stone_name   = excluded.center_stone_name,
    center_stone_qty    = excluded.center_stone_qty,
    sub1_stone_name     = excluded.sub1_stone_name,
    sub1_stone_qty      = excluded.sub1_stone_qty,
    sub2_stone_name     = excluded.sub2_stone_name,
    sub2_stone_qty      = excluded.sub2_stone_qty,

    -- NEW (null이면 기존값 유지해서 "미정" 유지 가능)
    center_stone_source = coalesce(excluded.center_stone_source, public.cms_order_line.center_stone_source),
    sub1_stone_source   = coalesce(excluded.sub1_stone_source,   public.cms_order_line.sub1_stone_source),
    sub2_stone_source   = coalesce(excluded.sub2_stone_source,   public.cms_order_line.sub2_stone_source),

    matched_master_id   = excluded.matched_master_id,
    match_state         = excluded.match_state,
    updated_by          = excluded.updated_by,
    updated_at          = excluded.updated_at;

  return v_id;
end $$;

grant execute on function public.cms_fn_upsert_order_line_v4(
  uuid, uuid, int, text, boolean, uuid, text, date, cms_e_priority_code, text, text, uuid,
  text, int, text, int, text, int, uuid, text, text, cms_e_material_code,
  public.cms_e_stone_supply_source, public.cms_e_stone_supply_source, public.cms_e_stone_supply_source
) to anon, authenticated, service_role;

-- 4) Match confirm v2: stone qty*(stone_margin + receipt_unit_cost) 반영
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
  v_receipt_model text;
  v_receipt_seq int;
  v_receipt_customer_code text;

  v_order record;
  v_master record;

  v_selected_weight numeric;
  v_selected_material public.cms_e_material_code;
  v_basic_cost numeric;
  v_other_cost numeric;
  v_other_cost_base numeric;
  v_total_amount numeric;

  -- stone qty/cost from receipt json (or fallback to order_line qty*order.qty)
  v_rcpt_center_qty numeric;
  v_rcpt_sub1_qty numeric;
  v_rcpt_sub2_qty numeric;

  v_center_qty_total numeric := 0;
  v_sub1_qty_total numeric := 0;
  v_sub2_qty_total numeric := 0;

  v_center_unit_cost numeric := 0;
  v_sub1_unit_cost numeric := 0;
  v_sub2_unit_cost numeric := 0;

  v_center_source public.cms_e_stone_supply_source;
  v_sub1_source public.cms_e_stone_supply_source;
  v_sub2_source public.cms_e_stone_supply_source;

  v_center_cost_total numeric := 0;
  v_sub1_cost_total numeric := 0;
  v_sub2_cost_total numeric := 0;
  v_stone_cost_total numeric := 0;

  -- master diffs
  v_base_diff numeric;
  v_bead_diff numeric;
  v_center_diff_per_stone numeric;
  v_sub1_diff_per_stone numeric;
  v_sub2_diff_per_stone numeric;

  v_center_margin_total numeric := 0;
  v_sub1_margin_total numeric := 0;
  v_sub2_margin_total numeric := 0;
  v_stone_margin_total numeric := 0;

  v_extra_diff numeric;
  v_base_sell numeric;
  v_extra_sell numeric;

  v_master_effective_weight numeric;
  v_weight_warn boolean := false;
  v_weight_deviation_pct numeric := null;

  v_shipment_id uuid;
  v_shipment_line_id uuid;

  v_overridden jsonb := '{}'::jsonb;
  v_extra_items jsonb := '[]'::jsonb;

  v_missing_unit_cost_warn boolean := false;
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

  select vendor_party_id, model_name, material_code, vendor_seq_no, customer_factory_code,
         factory_weight_g, factory_labor_basic_cost_krw, factory_labor_other_cost_krw, factory_total_amount_krw,
         line_item_json
    into v_vendor_party_id, v_receipt_model, v_receipt_material, v_receipt_seq, v_receipt_customer_code,
         v_factory_weight, v_factory_basic, v_factory_other, v_factory_total, v_line_item_json
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

    m.labor_base_sell,  m.labor_base_cost,
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
  v_total_amount := coalesce(p_selected_factory_total_cost_krw, v_factory_total);

  -- ---------- Parse receipt stone qty / unit cost ----------
  v_rcpt_center_qty := case when (v_line_item_json->>'stone_center_qty') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'stone_center_qty')::numeric else null end;
  v_rcpt_sub1_qty := case when (v_line_item_json->>'stone_sub1_qty') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'stone_sub1_qty')::numeric else null end;
  v_rcpt_sub2_qty := case when (v_line_item_json->>'stone_sub2_qty') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'stone_sub2_qty')::numeric else null end;

  v_center_unit_cost := case when (v_line_item_json->>'stone_center_unit_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'stone_center_unit_cost_krw')::numeric else 0 end;
  v_sub1_unit_cost := case when (v_line_item_json->>'stone_sub1_unit_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'stone_sub1_unit_cost_krw')::numeric else 0 end;
  v_sub2_unit_cost := case when (v_line_item_json->>'stone_sub2_unit_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'stone_sub2_unit_cost_krw')::numeric else 0 end;

  -- qty_total 우선순위:
  -- 1) receipt json qty (총개수 제공되면 그걸 신뢰)
  -- 2) order_line stone_qty * order_line.qty (주문 입력이 "개당"이라고 가정)
  v_center_qty_total := coalesce(nullif(v_rcpt_center_qty, 0), (coalesce(v_order.center_stone_qty, 0)::numeric) * coalesce(v_order.qty, 1), 0);
  v_sub1_qty_total   := coalesce(nullif(v_rcpt_sub1_qty, 0),   (coalesce(v_order.sub1_stone_qty, 0)::numeric)   * coalesce(v_order.qty, 1), 0);
  v_sub2_qty_total   := coalesce(nullif(v_rcpt_sub2_qty, 0),   (coalesce(v_order.sub2_stone_qty, 0)::numeric)   * coalesce(v_order.qty, 1), 0);

  -- source (NULL은 레거시 호환: SELF로 취급)
  v_center_source := coalesce(v_order.center_stone_source, 'SELF'::public.cms_e_stone_supply_source);
  v_sub1_source   := coalesce(v_order.sub1_stone_source,   'SELF'::public.cms_e_stone_supply_source);
  v_sub2_source   := coalesce(v_order.sub2_stone_source,   'SELF'::public.cms_e_stone_supply_source);

  -- stone cost: PROVIDED면 0 (원가 제외)
  v_center_cost_total := case when v_center_source = 'PROVIDED'::public.cms_e_stone_supply_source then 0 else v_center_qty_total * v_center_unit_cost end;
  v_sub1_cost_total   := case when v_sub1_source   = 'PROVIDED'::public.cms_e_stone_supply_source then 0 else v_sub1_qty_total   * v_sub1_unit_cost end;
  v_sub2_cost_total   := case when v_sub2_source   = 'PROVIDED'::public.cms_e_stone_supply_source then 0 else v_sub2_qty_total   * v_sub2_unit_cost end;

  v_stone_cost_total := coalesce(v_center_cost_total, 0) + coalesce(v_sub1_cost_total, 0) + coalesce(v_sub2_cost_total, 0);

  -- self인데 qty>0인데 unit_cost가 0이면 경고(막지는 않음)
  if (v_center_source = 'SELF'::public.cms_e_stone_supply_source and v_center_qty_total > 0 and coalesce(v_center_unit_cost,0) = 0)
    or (v_sub1_source = 'SELF'::public.cms_e_stone_supply_source and v_sub1_qty_total > 0 and coalesce(v_sub1_unit_cost,0) = 0)
    or (v_sub2_source = 'SELF'::public.cms_e_stone_supply_source and v_sub2_qty_total > 0 and coalesce(v_sub2_unit_cost,0) = 0)
  then
    v_missing_unit_cost_warn := true;
  end if;

  -- other cost = factory other + stone_cost(self only)
  v_other_cost := v_other_cost_base + v_stone_cost_total;

  -- ---------- master diffs ----------
  v_base_diff := coalesce(v_master.labor_base_sell, 0) - coalesce(v_master.labor_base_cost, 0);

  v_center_diff_per_stone := coalesce(v_master.labor_center_sell, 0) - coalesce(v_master.labor_center_cost, 0);
  v_sub1_diff_per_stone   := coalesce(v_master.labor_sub1_sell, 0)   - coalesce(v_master.labor_sub1_cost, 0);
  v_sub2_diff_per_stone   := coalesce(v_master.labor_sub2_sell, 0)   - coalesce(v_master.labor_sub2_cost, 0);
  v_bead_diff             := coalesce(v_master.labor_bead_sell, 0)   - coalesce(v_master.labor_bead_cost, 0);

  -- stone margin total = qty_total * diff_per_stone (너 요구사항)
  v_center_margin_total := greatest(v_center_qty_total * v_center_diff_per_stone, 0);
  v_sub1_margin_total   := greatest(v_sub1_qty_total   * v_sub1_diff_per_stone,   0);
  v_sub2_margin_total   := greatest(v_sub2_qty_total   * v_sub2_diff_per_stone,   0);
  v_stone_margin_total  := coalesce(v_center_margin_total,0) + coalesce(v_sub1_margin_total,0) + coalesce(v_sub2_margin_total,0);

  -- extra_diff = (stone margin totals) + bead diff
  v_extra_diff := coalesce(v_stone_margin_total, 0) + coalesce(v_bead_diff, 0);

  -- sells
  v_base_sell := greatest(v_basic_cost + v_base_diff, 0);

  -- 핵심: extra_sell = other_cost_base + stone_cost(self only) + stone_margin_total(+bead)
  -- == Σ role qty*(unit_cost + margin) + 기타 other_cost_base + bead_diff
  v_extra_sell := greatest(v_other_cost + v_extra_diff, 0);

  -- overridden fields 기록
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

  -- weight warn
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

  -- extra items breakdown (UI/디버깅용)
  v_extra_items := jsonb_build_array(
    jsonb_build_object('kind','RECEIPT','base_cost_krw', v_basic_cost, 'extra_cost_krw', v_other_cost_base),
    jsonb_build_object(
      'kind','STONE_DETAIL',
      'label','보석(개수*(마진+원가))',
      'missing_unit_cost_warn', v_missing_unit_cost_warn,
      'center', jsonb_build_object(
        'qty', v_center_qty_total,
        'unit_cost_krw', v_center_unit_cost,
        'source', v_center_source::text,
        'cost_included_krw', v_center_cost_total,
        'margin_per_stone_krw', v_center_diff_per_stone,
        'margin_total_krw', v_center_margin_total
      ),
      'sub1', jsonb_build_object(
        'qty', v_sub1_qty_total,
        'unit_cost_krw', v_sub1_unit_cost,
        'source', v_sub1_source::text,
        'cost_included_krw', v_sub1_cost_total,
        'margin_per_stone_krw', v_sub1_diff_per_stone,
        'margin_total_krw', v_sub1_margin_total
      ),
      'sub2', jsonb_build_object(
        'qty', v_sub2_qty_total,
        'unit_cost_krw', v_sub2_unit_cost,
        'source', v_sub2_source::text,
        'cost_included_krw', v_sub2_cost_total,
        'margin_per_stone_krw', v_sub2_diff_per_stone,
        'margin_total_krw', v_sub2_margin_total
      ),
      'stone_cost_total_krw', v_stone_cost_total,
      'stone_margin_total_krw', v_stone_margin_total
    ),
    jsonb_build_object(
      'kind','MASTER_DIFF',
      'base_diff_krw', v_base_diff,
      'bead_diff_krw', v_bead_diff,
      'extra_diff_krw', v_extra_diff
    )
  );

  -- 레거시 호환(기존 UI에서 "알공임" 라벨 보고 싶으면 유지)
  if v_stone_cost_total > 0 then
    v_extra_items := v_extra_items || jsonb_build_array(
      jsonb_build_object('kind','STONE_LABOR','label','알공임','extra_cost_krw', v_stone_cost_total)
    );
  end if;

  -- create shipment draft + line
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
    v_basic_cost, v_other_cost, v_total_amount,
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
    'master_effective_weight_g', v_master_effective_weight,
    'weight_deviation_pct', v_weight_deviation_pct,
    'weight_deviation_warn', v_weight_warn,
    'missing_unit_cost_warn', v_missing_unit_cost_warn
  );
end $$;

grant execute on function public.cms_fn_receipt_line_match_confirm_v2(
  uuid, uuid, uuid, numeric, public.cms_e_material_code,
  numeric, numeric, numeric, uuid, text
) to authenticated, service_role;
