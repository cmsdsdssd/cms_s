-- =============================================================
-- cms_0603_margin_engine_backend_sql_patch
--
-- 목적:
--  - Backend patch(Next.js API routes)에서 기대하는 스키마/컬럼 호환성 제공
--  - BUY 마진 프로파일/흡수공임 API 호환 컬럼 추가
--  - master_item_id 호환 컬럼(=master_id) 추가
--  - 흡수공임 vendor_party_id(공장) 스코프 지원 + v5 confirm 반영
--
-- 주의: add-only 성격 유지(컬럼/트리거/함수 추가, 함수 body replace)
-- =============================================================

set search_path = public, pg_temp;
-- =============================================================
-- A) cms_master_item: master_item_id 호환 컬럼 추가 (읽기/필터링용)
-- =============================================================
alter table public.cms_master_item
  add column if not exists master_item_id uuid
  generated always as (master_id) stored;
create unique index if not exists uq_cms_master_item_master_item_id
  on public.cms_master_item(master_item_id);
-- =============================================================
-- B) cms_buy_margin_profile_v1: API 호환 컬럼 + profile_code default + sync trigger
--    - API expects: margin_center_krw / margin_sub1_krw / margin_sub2_krw
--    - Engine uses : center_margin_krw_per_stone / sub1_margin_krw_per_stone / sub2_margin_krw_per_stone
-- =============================================================
alter table public.cms_buy_margin_profile_v1
  add column if not exists margin_center_krw numeric,
  add column if not exists margin_sub1_krw numeric,
  add column if not exists margin_sub2_krw numeric;
-- API에서 profile_code를 주지 않아도 INSERT가 되도록 default 부여
alter table public.cms_buy_margin_profile_v1
  alter column profile_code set default ('profile_' || substring(md5(gen_random_uuid()::text), 1, 8));
-- API 컬럼 기본값(표시/정렬 편의)
alter table public.cms_buy_margin_profile_v1
  alter column margin_center_krw set default 0;
alter table public.cms_buy_margin_profile_v1
  alter column margin_sub1_krw set default 0;
alter table public.cms_buy_margin_profile_v1
  alter column margin_sub2_krw set default 0;
-- 기존 row backfill
update public.cms_buy_margin_profile_v1
set
  margin_center_krw = coalesce(margin_center_krw, center_margin_krw_per_stone),
  margin_sub1_krw   = coalesce(margin_sub1_krw,   sub1_margin_krw_per_stone),
  margin_sub2_krw   = coalesce(margin_sub2_krw,   sub2_margin_krw_per_stone)
where
  margin_center_krw is null
  or margin_sub1_krw is null
  or margin_sub2_krw is null;
-- profile_code가 비어있는 row가 혹시 있으면 채움(안전)
update public.cms_buy_margin_profile_v1
set profile_code = ('profile_' || substring(md5(gen_random_uuid()::text), 1, 8))
where profile_code is null or btrim(profile_code) = '';
create or replace function public.cms_fn_sync_buy_margin_profile_api_cols_v1()
returns trigger
language plpgsql
as $$
begin
  -- profile_code 안전장치
  if new.profile_code is null or btrim(new.profile_code) = '' then
    new.profile_code := 'profile_' || substring(md5(gen_random_uuid()::text), 1, 8);
  end if;

  -- API -> engine
  new.center_margin_krw_per_stone := coalesce(new.margin_center_krw, new.center_margin_krw_per_stone, 0);
  new.sub1_margin_krw_per_stone   := coalesce(new.margin_sub1_krw,   new.sub1_margin_krw_per_stone,   0);
  new.sub2_margin_krw_per_stone   := coalesce(new.margin_sub2_krw,   new.sub2_margin_krw_per_stone,   0);

  -- engine -> API (항상 동일값 유지)
  new.margin_center_krw := new.center_margin_krw_per_stone;
  new.margin_sub1_krw   := new.sub1_margin_krw_per_stone;
  new.margin_sub2_krw   := new.sub2_margin_krw_per_stone;

  return new;
end;
$$;
do $$
begin
  create trigger trg_cms_buy_margin_profile_v1_api_sync
  before insert or update on public.cms_buy_margin_profile_v1
  for each row execute function public.cms_fn_sync_buy_margin_profile_api_cols_v1();
exception when duplicate_object then null;
end $$;
-- =============================================================
-- C) cms_master_absorb_labor_item_v1: API 호환 컬럼 + vendor_party_id + sync trigger
--    - API expects: absorb_item_id(또는 유사), reason, vendor_party_id
--    - Engine uses : absorb_id, label
-- =============================================================
alter table public.cms_master_absorb_labor_item_v1
  add column if not exists vendor_party_id uuid references public.cms_party(party_id),
  add column if not exists reason text,
  add column if not exists absorb_item_id uuid,
  add column if not exists absorb_labor_item_id uuid,
  add column if not exists master_absorb_labor_item_id uuid,
  add column if not exists item_id uuid;
-- 기존 row backfill (id alias, reason)
update public.cms_master_absorb_labor_item_v1
set
  absorb_item_id = coalesce(absorb_item_id, absorb_id),
  absorb_labor_item_id = coalesce(absorb_labor_item_id, absorb_id),
  master_absorb_labor_item_id = coalesce(master_absorb_labor_item_id, absorb_id),
  item_id = coalesce(item_id, absorb_id),
  reason = coalesce(reason, label)
where
  absorb_item_id is null
  or absorb_labor_item_id is null
  or master_absorb_labor_item_id is null
  or item_id is null
  or reason is null;
create or replace function public.cms_fn_sync_master_absorb_labor_item_api_cols_v1()
returns trigger
language plpgsql
as $$
declare
  v_id uuid;
  v_reason text;
begin
  -- 1) id alias -> absorb_id(=PK)로 승격
  v_id := coalesce(
    new.absorb_item_id,
    new.absorb_labor_item_id,
    new.master_absorb_labor_item_id,
    new.item_id,
    new.absorb_id
  );

  if v_id is null then
    v_id := gen_random_uuid();
  end if;

  new.absorb_id := v_id;
  new.absorb_item_id := v_id;
  new.absorb_labor_item_id := v_id;
  new.master_absorb_labor_item_id := v_id;
  new.item_id := v_id;

  -- 2) reason/label 동기화 (label NOT NULL 보장)
  v_reason := nullif(btrim(coalesce(new.reason, new.label)), '');
  if v_reason is null then
    v_reason := '흡수공임';
  end if;

  new.label := v_reason;
  new.reason := v_reason;

  return new;
end;
$$;
do $$
begin
  create trigger trg_cms_master_absorb_labor_item_v1_api_sync
  before insert or update on public.cms_master_absorb_labor_item_v1
  for each row execute function public.cms_fn_sync_master_absorb_labor_item_api_cols_v1();
exception when duplicate_object then null;
end $$;
-- delete/filter 성능 + 중복 방지(사실상 PK와 동일 값)
create unique index if not exists uq_cms_master_absorb_labor_item_v1_absorb_item_id
  on public.cms_master_absorb_labor_item_v1(absorb_item_id);
create index if not exists idx_cms_master_absorb_labor_item_v1_vendor
  on public.cms_master_absorb_labor_item_v1(vendor_party_id);
-- =============================================================
-- D) vendor-aware 흡수공임 JSON 함수(v2)
-- =============================================================
create or replace function public.cms_fn_master_absorb_labor_items_json_v2(
  p_master_id uuid,
  p_vendor_party_id uuid default null,
  p_qty int default 1
) returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(x.item order by x.priority asc, x.absorb_id asc), '[]'::jsonb)
  from (
    select
      a.priority,
      a.absorb_id,
      jsonb_build_object(
        'type', 'ABSORB',
        'label', coalesce(nullif(btrim(a.reason), ''), a.label),
        'amount', (case when a.is_per_piece then a.amount_krw * p_qty else a.amount_krw end),
        'meta', jsonb_build_object(
          'id', a.absorb_id::text,
          'bucket', a.bucket::text,
          'is_per_piece', a.is_per_piece,
          'priority', a.priority,
          'vendor_party_id', a.vendor_party_id::text
        )
      ) as item
    from public.cms_master_absorb_labor_item_v1 a
    where a.master_id = p_master_id
      and a.is_active = true
      and (
        (p_vendor_party_id is null and a.vendor_party_id is null)
        or
        (p_vendor_party_id is not null and (a.vendor_party_id is null or a.vendor_party_id = p_vendor_party_id))
      )
  ) x;
$$;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.cms_fn_master_absorb_labor_items_json_v2(uuid, uuid, int) to authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.cms_fn_master_absorb_labor_items_json_v2(uuid, uuid, int) to service_role';
  end if;
end $$;
-- =============================================================
-- E) receipt match confirm v5: vendor-aware absorb items 반영
--    - 변경점:
--      * cms_fn_master_absorb_labor_items_json_v1 -> v2
--      * absorb_total 계산 시 vendor_party_id 스코프 적용
-- =============================================================
create or replace function public.cms_fn_receipt_line_match_confirm_v5(
  p_receipt_id uuid,
  p_receipt_line_uuid uuid,
  p_order_line_id uuid,
  p_selected_weight_g numeric default null,
  p_selected_material_code public.cms_e_material_code default null,
  p_selected_factory_labor_basic_cost_krw numeric default null,
  p_selected_factory_labor_other_cost_krw numeric default null,
  p_selected_factory_total_cost_krw numeric default null,
  p_actor_person_id uuid default null,
  p_note text default null,

  -- only meaningful for FACTORY scope (optional)
  p_factory_billing_shape public.cms_e_factory_billing_shape default null
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
  v_total_amount numeric;

  v_qty int;

  -- stone sources (NULL => master default => FACTORY)
  v_center_source public.cms_e_stone_supply_source;
  v_sub1_source   public.cms_e_stone_supply_source;
  v_sub2_source   public.cms_e_stone_supply_source;

  -- scope precedence: SELF > PROVIDED > FACTORY
  v_scope public.cms_e_pricing_rule_scope;
  v_mixed_supply_warn boolean := false;

  -- billing shape (for FACTORY)
  v_billing_shape public.cms_e_factory_billing_shape;
  v_shape_text text := null;

  -- parsed optional costs
  v_setting_fee_cost_total numeric := 0;
  v_factory_stone_cost_total_snapshot numeric := 0;
  v_factory_package_cost_total numeric := 0;
  v_self_stone_cost_total_snapshot numeric := 0;

  -- stone qty/unit_cost (receipt)
  v_center_qty_rcpt numeric := null;
  v_sub1_qty_rcpt numeric := null;
  v_sub2_qty_rcpt numeric := null;

  v_center_unit_cost numeric := 0;
  v_sub1_unit_cost numeric := 0;
  v_sub2_unit_cost numeric := 0;

  v_center_qty_total numeric := 0;
  v_sub1_qty_total numeric := 0;
  v_sub2_qty_total numeric := 0;

  v_self_qty_total numeric := 0;
  v_factory_qty_total numeric := 0;

  v_self_avg_unit_cost numeric := null;
  v_factory_avg_unit_cost numeric := null;

  v_self_stone_cost_total_calc numeric := 0;
  v_factory_stone_cost_total_calc numeric := 0;

  -- base labor: global rule
  v_base_cost_per_piece numeric := 0;
  v_base_markup_unit numeric := 0;
  v_base_rule_id uuid := null;
  v_base_margin_total numeric := 0;
  v_base_sell numeric := 0;
  v_missing_base_rule_warn boolean := false;

  -- setting fee markup (기존 룰 활용)
  v_setting_cost_per_piece numeric := 0;
  v_setting_markup_unit numeric := 0;
  v_setting_rule_id uuid := null;
  v_setting_margin_total numeric := 0;

  -- package markup (bundled)
  v_package_cost_per_piece numeric := 0;
  v_package_markup_unit numeric := 0;
  v_package_rule_id uuid := null;
  v_package_margin_total numeric := 0;

  -- BUY margin profile
  v_buy_profile_id uuid := null;
  v_buy_profile record;
  v_buy_center_margin_unit numeric := 0;
  v_buy_sub1_margin_unit numeric := 0;
  v_buy_sub2_margin_unit numeric := 0;
  v_buy_stone_margin_total numeric := 0;
  v_missing_buy_profile_warn boolean := false;

  -- FACTORY per-stone rules (role별)
  v_factory_center_rule_id uuid := null;
  v_factory_sub1_rule_id uuid := null;
  v_factory_sub2_rule_id uuid := null;

  v_factory_center_margin_unit numeric := 0;
  v_factory_sub1_margin_unit numeric := 0;
  v_factory_sub2_margin_unit numeric := 0;

  v_factory_stone_margin_total numeric := 0;
  v_missing_factory_stone_rule_warn boolean := false;

  -- master addon margin (legacy)
  v_master_setting_addon_per_piece numeric := 0;
  v_master_stone_addon_per_piece numeric := 0;
  v_addon_margin_total numeric := 0;

  -- absorb items
  v_absorb_items jsonb := '[]'::jsonb;
  v_absorb_total numeric := 0;

  -- totals
  v_extra_cost_total numeric := 0;
  v_extra_margin_total numeric := 0;
  v_extra_sell numeric := 0;

  -- warnings
  v_missing_setting_fee_warn boolean := false;
  v_missing_self_stone_cost_warn boolean := false;
  v_missing_factory_cost_warn boolean := false;
  v_missing_unit_cost_warn boolean := false;

  -- weight warn
  v_master_effective_weight numeric;
  v_weight_warn boolean := false;
  v_weight_deviation_pct numeric := null;

  -- shipment
  v_shipment_id uuid;
  v_shipment_line_id uuid;

  -- bookkeeping
  v_overridden jsonb := '{}'::jsonb;
  v_extra_items jsonb := '[]'::jsonb;
begin
  if p_receipt_id is null or p_receipt_line_uuid is null or p_order_line_id is null then
    raise exception 'receipt_id, receipt_line_uuid, order_line_id required';
  end if;

  -- already confirmed?
  select * into v_existing
  from public.cms_receipt_line_match
  where receipt_id = p_receipt_id
    and receipt_line_uuid = p_receipt_line_uuid
    and status = 'CONFIRMED'::public.cms_e_receipt_line_match_status
  limit 1;

  if found then
    if v_existing.order_line_id <> p_order_line_id then
      raise exception 'receipt line already confirmed to another order_line (existing=%, requested=%)',
        v_existing.order_line_id, p_order_line_id;
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

  -- receipt line load
  select vendor_party_id, material_code,
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

  -- order line load
  select ol.*, po.vendor_party_id as po_vendor_party_id
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
    'WAITING_INBOUND'::public.cms_e_order_status
  ) then
    raise exception 'order_line not matchable in current status: %', v_order.status;
  end if;

  -- master load (include new defaults + legacy addon margins)
  select
    m.master_id,
    m.weight_default_g, m.deduction_weight_default_g,
    m.center_stone_source_default,
    m.sub1_stone_source_default,
    m.sub2_stone_source_default,
    m.buy_margin_profile_id,
    m.setting_addon_margin_krw_per_piece,
    m.stone_addon_margin_krw_per_piece
  into v_master
  from public.cms_master_item m
  where m.master_id = v_order.matched_master_id;

  if not found then
    raise exception 'master item not found: master_id=%', v_order.matched_master_id;
  end if;

  v_qty := coalesce(v_order.qty, 1);

  -- selected (overrides)
  v_selected_weight := coalesce(p_selected_weight_g, v_factory_weight, 0);
  v_selected_material := coalesce(p_selected_material_code, v_receipt_material, v_order.material_code);

  v_basic_cost := coalesce(p_selected_factory_labor_basic_cost_krw, v_factory_basic, 0);
  v_other_cost_base := coalesce(p_selected_factory_labor_other_cost_krw, v_factory_other, 0);
  v_total_amount := coalesce(p_selected_factory_total_cost_krw, v_factory_total, 0);

  -- overridden fields tracking
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

  -- stone source resolution: order override > master default > FACTORY
  v_center_source := coalesce(v_order.center_stone_source, v_master.center_stone_source_default, 'FACTORY'::public.cms_e_stone_supply_source);
  v_sub1_source   := coalesce(v_order.sub1_stone_source,   v_master.sub1_stone_source_default,   'FACTORY'::public.cms_e_stone_supply_source);
  v_sub2_source   := coalesce(v_order.sub2_stone_source,   v_master.sub2_stone_source_default,   'FACTORY'::public.cms_e_stone_supply_source);

  -- scope precedence: SELF > PROVIDED > FACTORY
  if (v_center_source = 'SELF'::public.cms_e_stone_supply_source)
     or (v_sub1_source = 'SELF'::public.cms_e_stone_supply_source)
     or (v_sub2_source = 'SELF'::public.cms_e_stone_supply_source) then
    v_scope := 'SELF'::public.cms_e_pricing_rule_scope;
  elsif (v_center_source = 'PROVIDED'::public.cms_e_stone_supply_source)
     or (v_sub1_source = 'PROVIDED'::public.cms_e_stone_supply_source)
     or (v_sub2_source = 'PROVIDED'::public.cms_e_stone_supply_source) then
    v_scope := 'PROVIDED'::public.cms_e_pricing_rule_scope;
  else
    v_scope := 'FACTORY'::public.cms_e_pricing_rule_scope;
  end if;

  if (v_center_source is distinct from v_sub1_source) or (v_center_source is distinct from v_sub2_source) then
    v_mixed_supply_warn := true;
  end if;

  -- billing shape (factory only)
  if v_scope = 'FACTORY'::public.cms_e_pricing_rule_scope then
    if p_factory_billing_shape is not null then
      v_billing_shape := p_factory_billing_shape;
    else
      v_shape_text := nullif(trim(coalesce(v_line_item_json->>'factory_billing_shape','')), '');
      if v_shape_text = 'SETTING_ONLY' then
        v_billing_shape := 'SETTING_ONLY'::public.cms_e_factory_billing_shape;
      elsif v_shape_text = 'SPLIT' then
        v_billing_shape := 'SPLIT'::public.cms_e_factory_billing_shape;
      else
        v_billing_shape := 'BUNDLED_PACKAGE'::public.cms_e_factory_billing_shape;
      end if;
    end if;
  else
    v_billing_shape := null;
  end if;

  -- parse setting fee cost (fallback = other_cost_base)
  v_setting_fee_cost_total := case when (v_line_item_json->>'setting_fee_total_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'setting_fee_total_cost_krw')::numeric
    else null end;
  if v_setting_fee_cost_total is null then
    v_setting_fee_cost_total := coalesce(v_other_cost_base, 0);
    if coalesce(v_setting_fee_cost_total,0) = 0 then
      v_missing_setting_fee_warn := true;
    end if;
  end if;

  -- parse snapshots
  v_self_stone_cost_total_snapshot := case when (v_line_item_json->>'self_stone_total_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'self_stone_total_cost_krw')::numeric else 0 end;

  v_factory_stone_cost_total_snapshot := case when (v_line_item_json->>'factory_stone_total_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'factory_stone_total_cost_krw')::numeric else 0 end;

  v_factory_package_cost_total := case when (v_line_item_json->>'factory_package_total_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'factory_package_total_cost_krw')::numeric else 0 end;

  if v_scope = 'FACTORY'::public.cms_e_pricing_rule_scope
     and v_billing_shape = 'BUNDLED_PACKAGE'::public.cms_e_factory_billing_shape
     and coalesce(v_factory_package_cost_total,0) = 0 then
    v_factory_package_cost_total := coalesce(v_other_cost_base, 0);
    if coalesce(v_factory_package_cost_total,0) = 0 then
      v_missing_factory_cost_warn := true;
    end if;
  end if;

  if v_scope = 'FACTORY'::public.cms_e_pricing_rule_scope
     and v_billing_shape = 'SPLIT'::public.cms_e_factory_billing_shape
     and coalesce(v_factory_stone_cost_total_snapshot,0) = 0 then
    v_missing_factory_cost_warn := true;
  end if;

  -- parse stone qty/unit_cost (receipt)
  v_center_qty_rcpt := case when (v_line_item_json->>'stone_center_qty') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'stone_center_qty')::numeric else null end;
  v_sub1_qty_rcpt := case when (v_line_item_json->>'stone_sub1_qty') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'stone_sub1_qty')::numeric else null end;
  v_sub2_qty_rcpt := case when (v_line_item_json->>'stone_sub2_qty') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'stone_sub2_qty')::numeric else null end;

  v_center_unit_cost := case when (v_line_item_json->>'stone_center_unit_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'stone_center_unit_cost_krw')::numeric else 0 end;
  v_sub1_unit_cost := case when (v_line_item_json->>'stone_sub1_unit_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'stone_sub1_unit_cost_krw')::numeric else 0 end;
  v_sub2_unit_cost := case when (v_line_item_json->>'stone_sub2_unit_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'stone_sub2_unit_cost_krw')::numeric else 0 end;

  -- qty totals:
  --  - receipt qty 존재 => line total로 보고 qty 곱하지 않음
  --  - 없으면 order default(per piece) * qty
  v_center_qty_total := greatest(coalesce(v_center_qty_rcpt, coalesce(v_order.center_stone_qty,0)::numeric * v_qty, 0), 0);
  v_sub1_qty_total   := greatest(coalesce(v_sub1_qty_rcpt,   coalesce(v_order.sub1_stone_qty,0)::numeric * v_qty, 0), 0);
  v_sub2_qty_total   := greatest(coalesce(v_sub2_qty_rcpt,   coalesce(v_order.sub2_stone_qty,0)::numeric * v_qty, 0), 0);

  -- self/factory stone qty totals (only roles that match)
  v_self_qty_total :=
    (case when v_center_source = 'SELF'::public.cms_e_stone_supply_source then v_center_qty_total else 0 end) +
    (case when v_sub1_source   = 'SELF'::public.cms_e_stone_supply_source then v_sub1_qty_total else 0 end) +
    (case when v_sub2_source   = 'SELF'::public.cms_e_stone_supply_source then v_sub2_qty_total else 0 end);

  v_factory_qty_total :=
    (case when v_center_source = 'FACTORY'::public.cms_e_stone_supply_source then v_center_qty_total else 0 end) +
    (case when v_sub1_source   = 'FACTORY'::public.cms_e_stone_supply_source then v_sub1_qty_total else 0 end) +
    (case when v_sub2_source   = 'FACTORY'::public.cms_e_stone_supply_source then v_sub2_qty_total else 0 end);

  if v_self_qty_total > 0 and coalesce(v_self_stone_cost_total_snapshot,0) > 0 then
    v_self_avg_unit_cost := v_self_stone_cost_total_snapshot / v_self_qty_total;
  end if;

  if v_factory_qty_total > 0 and coalesce(v_factory_stone_cost_total_snapshot,0) > 0 then
    v_factory_avg_unit_cost := v_factory_stone_cost_total_snapshot / v_factory_qty_total;
  end if;

  -- cost calc (role별 unit cost가 0이면 snapshot avg로 대체, 그래도 없으면 warn)
  if v_center_source = 'SELF'::public.cms_e_stone_supply_source then
    if coalesce(v_center_unit_cost,0) > 0 then
      v_self_stone_cost_total_calc := v_self_stone_cost_total_calc + (v_center_qty_total * v_center_unit_cost);
    elsif v_self_avg_unit_cost is not null then
      v_self_stone_cost_total_calc := v_self_stone_cost_total_calc + (v_center_qty_total * v_self_avg_unit_cost);
      v_missing_unit_cost_warn := true;
    elsif v_center_qty_total > 0 then
      v_missing_unit_cost_warn := true;
    end if;
  elsif v_center_source = 'FACTORY'::public.cms_e_stone_supply_source then
    if coalesce(v_center_unit_cost,0) > 0 then
      v_factory_stone_cost_total_calc := v_factory_stone_cost_total_calc + (v_center_qty_total * v_center_unit_cost);
    elsif v_factory_avg_unit_cost is not null then
      v_factory_stone_cost_total_calc := v_factory_stone_cost_total_calc + (v_center_qty_total * v_factory_avg_unit_cost);
      v_missing_unit_cost_warn := true;
    elsif v_center_qty_total > 0 then
      v_missing_unit_cost_warn := true;
    end if;
  end if;

  if v_sub1_source = 'SELF'::public.cms_e_stone_supply_source then
    if coalesce(v_sub1_unit_cost,0) > 0 then
      v_self_stone_cost_total_calc := v_self_stone_cost_total_calc + (v_sub1_qty_total * v_sub1_unit_cost);
    elsif v_self_avg_unit_cost is not null then
      v_self_stone_cost_total_calc := v_self_stone_cost_total_calc + (v_sub1_qty_total * v_self_avg_unit_cost);
      v_missing_unit_cost_warn := true;
    elsif v_sub1_qty_total > 0 then
      v_missing_unit_cost_warn := true;
    end if;
  elsif v_sub1_source = 'FACTORY'::public.cms_e_stone_supply_source then
    if coalesce(v_sub1_unit_cost,0) > 0 then
      v_factory_stone_cost_total_calc := v_factory_stone_cost_total_calc + (v_sub1_qty_total * v_sub1_unit_cost);
    elsif v_factory_avg_unit_cost is not null then
      v_factory_stone_cost_total_calc := v_factory_stone_cost_total_calc + (v_sub1_qty_total * v_factory_avg_unit_cost);
      v_missing_unit_cost_warn := true;
    elsif v_sub1_qty_total > 0 then
      v_missing_unit_cost_warn := true;
    end if;
  end if;

  if v_sub2_source = 'SELF'::public.cms_e_stone_supply_source then
    if coalesce(v_sub2_unit_cost,0) > 0 then
      v_self_stone_cost_total_calc := v_self_stone_cost_total_calc + (v_sub2_qty_total * v_sub2_unit_cost);
    elsif v_self_avg_unit_cost is not null then
      v_self_stone_cost_total_calc := v_self_stone_cost_total_calc + (v_sub2_qty_total * v_self_avg_unit_cost);
      v_missing_unit_cost_warn := true;
    elsif v_sub2_qty_total > 0 then
      v_missing_unit_cost_warn := true;
    end if;
  elsif v_sub2_source = 'FACTORY'::public.cms_e_stone_supply_source then
    if coalesce(v_sub2_unit_cost,0) > 0 then
      v_factory_stone_cost_total_calc := v_factory_stone_cost_total_calc + (v_sub2_qty_total * v_sub2_unit_cost);
    elsif v_factory_avg_unit_cost is not null then
      v_factory_stone_cost_total_calc := v_factory_stone_cost_total_calc + (v_sub2_qty_total * v_factory_avg_unit_cost);
      v_missing_unit_cost_warn := true;
    elsif v_sub2_qty_total > 0 then
      v_missing_unit_cost_warn := true;
    end if;
  end if;

  if v_scope = 'SELF'::public.cms_e_pricing_rule_scope and coalesce(v_self_stone_cost_total_calc,0) = 0 and v_self_qty_total > 0 then
    v_missing_self_stone_cost_warn := true;
  end if;

  -- =========================================================
  -- Base labor sell = basic_cost + BASE_LABOR rule margin(per piece)
  -- =========================================================
  v_base_cost_per_piece := case when v_qty > 0 then (coalesce(v_basic_cost,0) / v_qty) else 0 end;

  select markup_krw, picked_rule_id
    into v_base_markup_unit, v_base_rule_id
  from public.cms_fn_pick_pricing_rule_markup_v2(
    'BASE_LABOR'::public.cms_e_pricing_rule_component,
    'FACTORY'::public.cms_e_pricing_rule_scope,
    'PER_PIECE'::public.cms_e_pricing_rule_apply_unit,
    null,
    v_vendor_party_id,
    v_base_cost_per_piece
  );

  if v_base_rule_id is null then
    v_missing_base_rule_warn := true;
    v_base_markup_unit := 0;
  end if;

  v_base_margin_total := coalesce(v_base_markup_unit,0) * v_qty;
  v_base_sell := greatest(coalesce(v_basic_cost,0) + v_base_margin_total, 0);

  -- =========================================================
  -- Extra cost base
  --   - bundle: package only (+ self stones if any)
  --   - split/setting_only: setting_fee + (factory stones if any) + (self stones if any)
  -- =========================================================
  if v_scope = 'FACTORY'::public.cms_e_pricing_rule_scope
     and v_billing_shape = 'BUNDLED_PACKAGE'::public.cms_e_factory_billing_shape then
    v_extra_cost_total := coalesce(v_factory_package_cost_total,0) + coalesce(v_self_stone_cost_total_calc,0);
  else
    v_extra_cost_total :=
      coalesce(v_setting_fee_cost_total,0)
      + coalesce(v_factory_stone_cost_total_calc,0)
      + coalesce(v_self_stone_cost_total_calc,0);
  end if;

  -- =========================================================
  -- Setting/Package margin (per piece rule)
  -- =========================================================
  if v_scope = 'FACTORY'::public.cms_e_pricing_rule_scope
     and v_billing_shape = 'BUNDLED_PACKAGE'::public.cms_e_factory_billing_shape then

    v_package_cost_per_piece := case when v_qty > 0 then (coalesce(v_factory_package_cost_total,0) / v_qty) else 0 end;

    select markup_krw, picked_rule_id
      into v_package_markup_unit, v_package_rule_id
    from public.cms_fn_pick_pricing_rule_markup_v2(
      'PACKAGE'::public.cms_e_pricing_rule_component,
      'FACTORY'::public.cms_e_pricing_rule_scope,
      'PER_PIECE'::public.cms_e_pricing_rule_apply_unit,
      null,
      v_vendor_party_id,
      v_package_cost_per_piece
    );

    v_package_margin_total := coalesce(v_package_markup_unit,0) * v_qty;
    v_setting_margin_total := 0;

  else
    v_setting_cost_per_piece := case when v_qty > 0 then (coalesce(v_setting_fee_cost_total,0) / v_qty) else 0 end;

    select markup_krw, picked_rule_id
      into v_setting_markup_unit, v_setting_rule_id
    from public.cms_fn_pick_pricing_rule_markup_v2(
      'SETTING'::public.cms_e_pricing_rule_component,
      v_scope,
      'PER_PIECE'::public.cms_e_pricing_rule_apply_unit,
      null,
      v_vendor_party_id,
      v_setting_cost_per_piece
    );

    v_setting_margin_total := coalesce(v_setting_markup_unit,0) * v_qty;
    v_package_margin_total := 0;
  end if;

  -- =========================================================
  -- BUY profile margin (SELF stones): role별 per-stone
  -- =========================================================
  v_buy_profile_id := coalesce(v_order.buy_margin_profile_id, v_master.buy_margin_profile_id);

  if v_self_qty_total > 0 then
    if v_buy_profile_id is not null then
      select *
        into v_buy_profile
      from public.cms_buy_margin_profile_v1
      where profile_id = v_buy_profile_id
        and is_active = true;

      if not found then
        v_missing_buy_profile_warn := true;
        v_buy_center_margin_unit := 0;
        v_buy_sub1_margin_unit := 0;
        v_buy_sub2_margin_unit := 0;
      else
        v_buy_center_margin_unit := coalesce(v_buy_profile.center_margin_krw_per_stone,0);
        v_buy_sub1_margin_unit   := coalesce(v_buy_profile.sub1_margin_krw_per_stone,0);
        v_buy_sub2_margin_unit   := coalesce(v_buy_profile.sub2_margin_krw_per_stone,0);
      end if;
    else
      v_missing_buy_profile_warn := true;
    end if;

    v_buy_stone_margin_total :=
      (case when v_center_source='SELF'::public.cms_e_stone_supply_source then v_center_qty_total * v_buy_center_margin_unit else 0 end)
      + (case when v_sub1_source='SELF'::public.cms_e_stone_supply_source then v_sub1_qty_total * v_buy_sub1_margin_unit else 0 end)
      + (case when v_sub2_source='SELF'::public.cms_e_stone_supply_source then v_sub2_qty_total * v_buy_sub2_margin_unit else 0 end);
  end if;

  -- =========================================================
  -- FACTORY stone margin rules (PER_STONE + role)
  --  * only meaningful when factory stone qty > 0 and billing is not bundled_package
  -- =========================================================
  if v_factory_qty_total > 0 and not (v_scope='FACTORY'::public.cms_e_pricing_rule_scope and v_billing_shape='BUNDLED_PACKAGE'::public.cms_e_factory_billing_shape) then

    if v_center_source='FACTORY'::public.cms_e_stone_supply_source and v_center_qty_total > 0 then
      select markup_krw, picked_rule_id
        into v_factory_center_margin_unit, v_factory_center_rule_id
      from public.cms_fn_pick_pricing_rule_markup_v2(
        'STONE'::public.cms_e_pricing_rule_component,
        'FACTORY'::public.cms_e_pricing_rule_scope,
        'PER_STONE'::public.cms_e_pricing_rule_apply_unit,
        'CENTER'::public.cms_e_stone_role,
        v_vendor_party_id,
        greatest(coalesce(v_center_unit_cost, v_factory_avg_unit_cost, 0), 0)
      );
      if v_factory_center_rule_id is null then v_missing_factory_stone_rule_warn := true; v_factory_center_margin_unit := 0; end if;
      v_factory_stone_margin_total := v_factory_stone_margin_total + (v_center_qty_total * coalesce(v_factory_center_margin_unit,0));
    end if;

    if v_sub1_source='FACTORY'::public.cms_e_stone_supply_source and v_sub1_qty_total > 0 then
      select markup_krw, picked_rule_id
        into v_factory_sub1_margin_unit, v_factory_sub1_rule_id
      from public.cms_fn_pick_pricing_rule_markup_v2(
        'STONE'::public.cms_e_pricing_rule_component,
        'FACTORY'::public.cms_e_pricing_rule_scope,
        'PER_STONE'::public.cms_e_pricing_rule_apply_unit,
        'SUB1'::public.cms_e_stone_role,
        v_vendor_party_id,
        greatest(coalesce(v_sub1_unit_cost, v_factory_avg_unit_cost, 0), 0)
      );
      if v_factory_sub1_rule_id is null then v_missing_factory_stone_rule_warn := true; v_factory_sub1_margin_unit := 0; end if;
      v_factory_stone_margin_total := v_factory_stone_margin_total + (v_sub1_qty_total * coalesce(v_factory_sub1_margin_unit,0));
    end if;

    if v_sub2_source='FACTORY'::public.cms_e_stone_supply_source and v_sub2_qty_total > 0 then
      select markup_krw, picked_rule_id
        into v_factory_sub2_margin_unit, v_factory_sub2_rule_id
      from public.cms_fn_pick_pricing_rule_markup_v2(
        'STONE'::public.cms_e_pricing_rule_component,
        'FACTORY'::public.cms_e_pricing_rule_scope,
        'PER_STONE'::public.cms_e_pricing_rule_apply_unit,
        'SUB2'::public.cms_e_stone_role,
        v_vendor_party_id,
        greatest(coalesce(v_sub2_unit_cost, v_factory_avg_unit_cost, 0), 0)
      );
      if v_factory_sub2_rule_id is null then v_missing_factory_stone_rule_warn := true; v_factory_sub2_margin_unit := 0; end if;
      v_factory_stone_margin_total := v_factory_stone_margin_total + (v_sub2_qty_total * coalesce(v_factory_sub2_margin_unit,0));
    end if;

  end if;

  -- legacy addon margin (keep)
  v_master_setting_addon_per_piece := coalesce(v_master.setting_addon_margin_krw_per_piece, 0);
  v_master_stone_addon_per_piece   := coalesce(v_master.stone_addon_margin_krw_per_piece, 0);
  v_addon_margin_total := (v_master_setting_addon_per_piece + v_master_stone_addon_per_piece) * v_qty;

  -- absorb items (SKU-specific exceptions)
  v_absorb_items := public.cms_fn_master_absorb_labor_items_json_v2(v_master.master_id, v_vendor_party_id, v_qty);

  select coalesce(sum(case when a.is_per_piece then a.amount_krw * v_qty else a.amount_krw end), 0)
    into v_absorb_total
  from public.cms_master_absorb_labor_item_v1 a
  where a.master_id = v_master.master_id
    and a.is_active = true
    and (a.vendor_party_id is null or a.vendor_party_id = v_vendor_party_id);

  -- extra margin total
  v_extra_margin_total :=
    coalesce(v_setting_margin_total,0)
    + coalesce(v_package_margin_total,0)
    + coalesce(v_buy_stone_margin_total,0)
    + coalesce(v_factory_stone_margin_total,0)
    + coalesce(v_addon_margin_total,0)
    + coalesce(v_absorb_total,0);

  v_extra_sell := greatest(coalesce(v_extra_cost_total,0) + v_extra_margin_total, 0);

  -- weight warn (same policy as existing)
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

  -- evidence items (extra_labor_items)
  v_extra_items := jsonb_build_array(
    jsonb_build_object(
      'type','COST_BASIS',
      'label','원가 구성',
      'amount', v_extra_cost_total,
      'meta', jsonb_build_object(
        'scope', v_scope::text,
        'billing_shape', coalesce(v_billing_shape::text, null),
        'qty', v_qty,
        'setting_fee_cost_total_krw', v_setting_fee_cost_total,
        'self_stone_cost_total_krw', v_self_stone_cost_total_calc,
        'factory_stone_cost_total_krw', v_factory_stone_cost_total_calc,
        'factory_package_cost_total_krw', v_factory_package_cost_total
      )
    ),
    jsonb_build_object(
      'type','MARGINS',
      'label','마진 구성',
      'amount', v_extra_margin_total,
      'meta', jsonb_build_object(
        'base_labor', jsonb_build_object(
          'base_rule_id', v_base_rule_id,
          'unit_markup_krw', v_base_markup_unit,
          'total_margin_krw', v_base_margin_total
        ),
        'setting', jsonb_build_object(
          'rule_id', v_setting_rule_id,
          'unit_markup_krw', v_setting_markup_unit,
          'total_margin_krw', v_setting_margin_total
        ),
        'package', jsonb_build_object(
          'rule_id', v_package_rule_id,
          'unit_markup_krw', v_package_markup_unit,
          'total_margin_krw', v_package_margin_total
        ),
        'buy_profile', jsonb_build_object(
          'profile_id', v_buy_profile_id,
          'center_margin_unit_krw', v_buy_center_margin_unit,
          'sub1_margin_unit_krw', v_buy_sub1_margin_unit,
          'sub2_margin_unit_krw', v_buy_sub2_margin_unit,
          'total_margin_krw', v_buy_stone_margin_total
        ),
        'factory_stone_rules', jsonb_build_object(
          'center_rule_id', v_factory_center_rule_id,
          'sub1_rule_id', v_factory_sub1_rule_id,
          'sub2_rule_id', v_factory_sub2_rule_id,
          'center_margin_unit_krw', v_factory_center_margin_unit,
          'sub1_margin_unit_krw', v_factory_sub1_margin_unit,
          'sub2_margin_unit_krw', v_factory_sub2_margin_unit,
          'total_margin_krw', v_factory_stone_margin_total
        ),
        'legacy_master_addon_margin_total_krw', v_addon_margin_total,
        'absorb_total_krw', v_absorb_total
      )
    )
  );

  -- append absorb items as visible extra lines
  v_extra_items := v_extra_items || coalesce(v_absorb_items, '[]'::jsonb);

  -- warnings
  if v_mixed_supply_warn or v_missing_setting_fee_warn or v_missing_self_stone_cost_warn or v_missing_factory_cost_warn or v_missing_unit_cost_warn or v_missing_buy_profile_warn or v_missing_factory_stone_rule_warn or v_missing_base_rule_warn then
    v_extra_items := v_extra_items || jsonb_build_array(
      jsonb_build_object(
        'type','WARN',
        'label','경고',
        'amount', 0,
        'meta', jsonb_build_object(
          'mixed_supply_warn', v_mixed_supply_warn,
          'missing_setting_fee_warn', v_missing_setting_fee_warn,
          'missing_self_stone_cost_warn', v_missing_self_stone_cost_warn,
          'missing_factory_cost_warn', v_missing_factory_cost_warn,
          'missing_unit_cost_warn', v_missing_unit_cost_warn,
          'missing_buy_profile_warn', v_missing_buy_profile_warn,
          'missing_factory_stone_rule_warn', v_missing_factory_stone_rule_warn,
          'missing_base_rule_warn', v_missing_base_rule_warn
        )
      )
    );
  end if;

  -- create shipment draft + line (same workflow)
  v_shipment_id := public.cms_fn_create_shipment_header_v1(v_order.customer_party_id, current_date, null);

  v_shipment_line_id := public.cms_fn_add_shipment_line_from_order_v1(
    v_shipment_id,
    p_order_line_id,
    v_qty,
    'RULE'::public.cms_e_pricing_mode,
    null,
    v_selected_material,
    v_order.is_plated,
    v_order.plating_variant_id,
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

  -- match record
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
    v_basic_cost, v_other_cost_base, v_total_amount,
    (v_overridden || jsonb_build_object(
      'pricing_v5', true,
      'pricing_scope', v_scope::text,
      'factory_billing_shape', coalesce(v_billing_shape::text, null),
      'rule_ids', jsonb_build_object(
        'base_labor', v_base_rule_id,
        'setting', v_setting_rule_id,
        'package', v_package_rule_id,
        'factory_stone_center', v_factory_center_rule_id,
        'factory_stone_sub1', v_factory_sub1_rule_id,
        'factory_stone_sub2', v_factory_sub2_rule_id
      ),
      'buy_profile_id', v_buy_profile_id,
      'absorb_total_krw', v_absorb_total
    )),
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

  -- reject other suggestions for same receipt line
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
    'base_labor_margin_total_krw', v_base_margin_total,
    'base_labor_rule_id', v_base_rule_id,

    'extra_labor_sell_krw', v_extra_sell,
    'extra_cost_total_krw', v_extra_cost_total,
    'extra_margin_total_krw', v_extra_margin_total,

    'buy_profile_id', v_buy_profile_id,
    'absorb_total_krw', v_absorb_total,

    'pricing_scope', v_scope::text,
    'factory_billing_shape', coalesce(v_billing_shape::text, null),

    'weight_deviation_pct', v_weight_deviation_pct,
    'weight_deviation_warn', v_weight_warn,

    'mixed_supply_warn', v_mixed_supply_warn,
    'missing_setting_fee_warn', v_missing_setting_fee_warn,
    'missing_self_stone_cost_warn', v_missing_self_stone_cost_warn,
    'missing_factory_cost_warn', v_missing_factory_cost_warn,
    'missing_unit_cost_warn', v_missing_unit_cost_warn,
    'missing_buy_profile_warn', v_missing_buy_profile_warn,
    'missing_factory_stone_rule_warn', v_missing_factory_stone_rule_warn,
    'missing_base_rule_warn', v_missing_base_rule_warn
  );
end $$;
-- NOTE: v5 RPC는 파라미터가 많고(기본값 존재), 배포 브랜치마다 overload/시그니처가 달라질 수 있음.
-- 따라서 특정 시그니처로 GRANT 하면 마이그레이션이 깨질 수 있어, 이름 기준으로 동적 GRANT 처리.
do $$
declare
  r record;
begin
  for r in
    select
      n.nspname as schema_name,
      p.proname as func_name,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cms_fn_receipt_line_match_confirm_v5'
  loop
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('grant execute on function %I.%I(%s) to authenticated', r.schema_name, r.func_name, r.args);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %I.%I(%s) to service_role', r.schema_name, r.func_name, r.args);
    end if;
  end loop;
end $$;
