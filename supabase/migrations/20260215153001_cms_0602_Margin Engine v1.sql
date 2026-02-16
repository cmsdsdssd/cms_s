set search_path = public, pg_temp;

-- ============================================================
-- CMS Margin Engine v1 (ADD-ONLY)
--  - Base labor margin via global pricing rules (BASE_LABOR)
--  - Stone margin:
--      * BUY(SELF) => buy margin profiles (role-based)
--      * FACTORY   => pricing rules (role + per-stone + vendor + cost-band)
--  - Plating margin via separate markup rules (fixed + per_g)
--  - SKU absorb labor items auto-injected into shipment extra items
-- ============================================================

-- ============================================================
-- 0) ENUM 확장/추가 (ADD-ONLY)
-- ============================================================

-- 0-1) pricing rule component에 BASE_LABOR 추가 (기존 SETTING/STONE/PACKAGE 유지)
do $$
begin
  -- create type if missing (in case branch differs)
  begin
    create type public.cms_e_pricing_rule_component as enum ('SETTING','STONE','PACKAGE','BASE_LABOR');
  exception when duplicate_object then
    null;
  end;

  -- add BASE_LABOR if missing
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typnamespace = 'public'::regnamespace
      and t.typname = 'cms_e_pricing_rule_component'
      and e.enumlabel = 'BASE_LABOR'
  ) then
    begin
      alter type public.cms_e_pricing_rule_component add value 'BASE_LABOR';
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- 0-2) pricing rule apply unit (per piece / per stone / per gram)
do $$
begin
  create type public.cms_e_pricing_rule_apply_unit as enum ('PER_PIECE','PER_STONE','PER_G');
exception when duplicate_object then
  null;
end $$;

-- 0-3) stone role enum (center/sub1/sub2/bead)
do $$
begin
  create type public.cms_e_stone_role as enum ('CENTER','SUB1','SUB2','BEAD');
exception when duplicate_object then
  null;
end $$;

-- 0-4) absorb labor bucket enum
do $$
begin
  create type public.cms_e_absorb_labor_bucket as enum ('BASE_LABOR','STONE_LABOR','PLATING','ETC');
exception when duplicate_object then
  null;
end $$;


-- ============================================================
-- 1) cms_pricing_rule_v1 확장 (ADD-ONLY)
--    - apply_unit + stone_role
-- ============================================================

alter table if exists public.cms_pricing_rule_v1
  add column if not exists apply_unit public.cms_e_pricing_rule_apply_unit not null default 'PER_PIECE',
  add column if not exists stone_role public.cms_e_stone_role;

-- per-stone 룰은 STONE + stone_role 필수 (신규 룰 품질 방어)
do $$
begin
  alter table public.cms_pricing_rule_v1
    add constraint cms_pricing_rule_v1_per_stone_requires_role
    check (
      apply_unit <> 'PER_STONE'::public.cms_e_pricing_rule_apply_unit
      or (component = 'STONE'::public.cms_e_pricing_rule_component and stone_role is not null)
    );
exception when duplicate_object then null;
end $$;

create index if not exists idx_cms_pricing_rule_v1_lookup_v2
  on public.cms_pricing_rule_v1(
    component, scope, apply_unit, stone_role, is_active, vendor_party_id, priority, min_cost_krw
  );


-- ============================================================
-- 2) BUY 마진 프로파일 (role별 per-stone 마진)
-- ============================================================

create table if not exists public.cms_buy_margin_profile_v1 (
  profile_id uuid primary key default gen_random_uuid(),
  profile_code text,
  name text not null,

  center_margin_krw_per_stone numeric not null default 0,
  sub1_margin_krw_per_stone   numeric not null default 0,
  sub2_margin_krw_per_stone   numeric not null default 0,

  -- 필요하면 비드/기타를 piece 단위로도 대응
  bead_margin_krw_per_piece   numeric not null default 0,

  is_active boolean not null default true,
  note text,

  created_at timestamptz not null default now(),
  created_by uuid references public.cms_person(person_id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.cms_person(person_id)
);

create unique index if not exists uq_cms_buy_margin_profile_v1_code
  on public.cms_buy_margin_profile_v1(profile_code)
  where profile_code is not null;

do $$
begin
  alter table public.cms_buy_margin_profile_v1
    add constraint cms_buy_margin_profile_v1_nonneg
    check (
      center_margin_krw_per_stone >= 0
      and sub1_margin_krw_per_stone >= 0
      and sub2_margin_krw_per_stone >= 0
      and bead_margin_krw_per_piece >= 0
    );
exception when duplicate_object then null;
end $$;

do $$
begin
  create trigger trg_cms_buy_margin_profile_v1_updated_at
  before update on public.cms_buy_margin_profile_v1
  for each row execute function public.cms_fn_set_updated_at();
exception when duplicate_object then null;
end $$;

-- grants (role 존재할 때만)
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select, insert, update, delete on public.cms_buy_margin_profile_v1 to authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on public.cms_buy_margin_profile_v1 to service_role';
  end if;
end $$;


-- ============================================================
-- 3) 카탈로그(UI)에서 buy/factory 설정용: master + order 확장 (ADD-ONLY)
--    - 기본은 NULL 허용, 계산 시 NULL => FACTORY 로 해석
-- ============================================================

alter table if exists public.cms_master_item
  add column if not exists center_stone_source_default public.cms_e_stone_supply_source,
  add column if not exists sub1_stone_source_default   public.cms_e_stone_supply_source,
  add column if not exists sub2_stone_source_default   public.cms_e_stone_supply_source,
  add column if not exists buy_margin_profile_id uuid references public.cms_buy_margin_profile_v1(profile_id);

create index if not exists idx_cms_master_item_buy_margin_profile_id
  on public.cms_master_item(buy_margin_profile_id);

alter table if exists public.cms_order_line
  add column if not exists buy_margin_profile_id uuid references public.cms_buy_margin_profile_v1(profile_id);

create index if not exists idx_cms_order_line_buy_margin_profile_id
  on public.cms_order_line(buy_margin_profile_id);


-- ============================================================
-- 4) SKU별 흡수공임(예외) 테이블 (ADD-ONLY)
-- ============================================================

create table if not exists public.cms_master_absorb_labor_item_v1 (
  absorb_id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.cms_master_item(master_id) on delete cascade,

  bucket public.cms_e_absorb_labor_bucket not null default 'ETC'::public.cms_e_absorb_labor_bucket,
  label text not null,              -- 사유/라벨 (예: "기본공임 마진 추가")
  amount_krw numeric not null,      -- 금액(원)
  is_per_piece boolean not null default true, -- true면 qty 곱함, false면 라인 고정

  priority int not null default 100,
  is_active boolean not null default true,
  note text,

  created_at timestamptz not null default now(),
  created_by uuid references public.cms_person(person_id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.cms_person(person_id)
);

create index if not exists idx_cms_master_absorb_labor_item_v1_master
  on public.cms_master_absorb_labor_item_v1(master_id);

create index if not exists idx_cms_master_absorb_labor_item_v1_active
  on public.cms_master_absorb_labor_item_v1(master_id, is_active)
  where is_active = true;

do $$
begin
  alter table public.cms_master_absorb_labor_item_v1
    add constraint cms_master_absorb_labor_item_v1_nonneg
    check (amount_krw >= 0);
exception when duplicate_object then null;
end $$;

do $$
begin
  create trigger trg_cms_master_absorb_labor_item_v1_updated_at
  before update on public.cms_master_absorb_labor_item_v1
  for each row execute function public.cms_fn_set_updated_at();
exception when duplicate_object then null;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select, insert, update, delete on public.cms_master_absorb_labor_item_v1 to authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on public.cms_master_absorb_labor_item_v1 to service_role';
  end if;
end $$;

-- master_id + qty 기준으로 "shipment extra_labor_items에 바로 붙일 jsonb array" 생성
create or replace function public.cms_fn_master_absorb_labor_items_json_v1(
  p_master_id uuid,
  p_qty int default 1
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', a.absorb_id::text,
        'type', 'ABSORB_LABOR',
        'label', a.label,
        'amount', (case when a.is_per_piece then a.amount_krw * greatest(coalesce(p_qty,1),1) else a.amount_krw end),
        'meta', jsonb_build_object(
          'bucket', a.bucket::text,
          'is_per_piece', a.is_per_piece,
          'qty', greatest(coalesce(p_qty,1),1),
          'raw_amount_krw', a.amount_krw,
          'note', a.note
        )
      )
      order by a.priority asc, a.created_at asc
    ),
    '[]'::jsonb
  )
  from public.cms_master_absorb_labor_item_v1 a
  where a.master_id = p_master_id
    and a.is_active = true;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.cms_fn_master_absorb_labor_items_json_v1(uuid,int) to authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.cms_fn_master_absorb_labor_items_json_v1(uuid,int) to service_role';
  end if;
end $$;


-- ============================================================
-- 5) 도금 마진 룰 분리 (ADD-ONLY)
--    - cost는 기존 cms_plating_price_rule의 cost_*를 사용
--    - margin만 cms_plating_markup_rule_v1에서 관리
-- ============================================================

create table if not exists public.cms_plating_markup_rule_v1 (
  rule_id uuid primary key default gen_random_uuid(),
  plating_variant_id uuid not null references public.cms_plating_variant(plating_variant_id) on delete cascade,

  category_code public.cms_e_category_code,
  material_code public.cms_e_material_code,

  effective_from date not null default current_date,
  margin_fixed_krw numeric not null default 0,
  margin_per_g_krw numeric not null default 0,

  priority int not null default 100,
  is_active boolean not null default true,
  note text,

  created_at timestamptz not null default now(),
  created_by uuid references public.cms_person(person_id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.cms_person(person_id)
);

do $$
begin
  alter table public.cms_plating_markup_rule_v1
    add constraint cms_plating_markup_rule_v1_nonneg
    check (margin_fixed_krw >= 0 and margin_per_g_krw >= 0);
exception when duplicate_object then null;
end $$;

create index if not exists idx_cms_plating_markup_rule_v1_lookup
  on public.cms_plating_markup_rule_v1(
    plating_variant_id, is_active, effective_from desc, priority asc
  );

create index if not exists idx_cms_plating_markup_rule_v1_cat_mat
  on public.cms_plating_markup_rule_v1(plating_variant_id, category_code, material_code);

do $$
begin
  create trigger trg_cms_plating_markup_rule_v1_updated_at
  before update on public.cms_plating_markup_rule_v1
  for each row execute function public.cms_fn_set_updated_at();
exception when duplicate_object then null;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select, insert, update, delete on public.cms_plating_markup_rule_v1 to authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on public.cms_plating_markup_rule_v1 to service_role';
  end if;
end $$;

create or replace function public.cms_fn_pick_plating_markup_rule_v1(
  p_plating_variant_id uuid,
  p_category_code public.cms_e_category_code,
  p_material_code public.cms_e_material_code,
  p_on_date date
)
returns table(
  rule_id uuid,
  margin_fixed_krw numeric,
  margin_per_g_krw numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    r.rule_id,
    r.margin_fixed_krw,
    r.margin_per_g_krw
  from public.cms_plating_markup_rule_v1 r
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

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute $g$grant execute on function public.cms_fn_pick_plating_markup_rule_v1(uuid,public.cms_e_category_code,public.cms_e_material_code,date) to authenticated$g$;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute $g$grant execute on function public.cms_fn_pick_plating_markup_rule_v1(uuid,public.cms_e_category_code,public.cms_e_material_code,date) to service_role$g$;
  end if;
end $$;

-- plating sell = plating cost(from price_rule.cost_*) + plating margin(from markup_rule)
create or replace function public.cms_fn_calc_plating_amounts_v2(
  p_plating_variant_id uuid,
  p_category_code public.cms_e_category_code,
  p_material_code public.cms_e_material_code,
  p_on_date date,
  p_net_weight_g numeric
)
returns table(
  price_rule_id uuid,
  markup_rule_id uuid,
  cost_amount_krw numeric,
  sell_amount_krw numeric,
  breakdown jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_price_rule_id uuid;
  v_cost_fixed numeric := 0;
  v_cost_per_g numeric := 0;

  v_markup_rule_id uuid;
  v_margin_fixed numeric := 0;
  v_margin_per_g numeric := 0;

  v_w numeric := greatest(coalesce(p_net_weight_g,0),0);
  v_cost numeric := 0;
  v_margin numeric := 0;
  v_sell numeric := 0;
begin
  -- cost rule (existing)
  select rule_id, cost_fixed_krw, cost_per_g_krw
    into v_price_rule_id, v_cost_fixed, v_cost_per_g
  from public.cms_fn_pick_plating_rule(
    p_plating_variant_id,
    p_category_code,
    p_material_code,
    coalesce(p_on_date, current_date)
  );

  -- margin rule (new)
  select rule_id, margin_fixed_krw, margin_per_g_krw
    into v_markup_rule_id, v_margin_fixed, v_margin_per_g
  from public.cms_fn_pick_plating_markup_rule_v1(
    p_plating_variant_id,
    p_category_code,
    p_material_code,
    coalesce(p_on_date, current_date)
  );

  v_cost := coalesce(v_cost_fixed,0) + coalesce(v_cost_per_g,0) * v_w;
  v_margin := coalesce(v_margin_fixed,0) + coalesce(v_margin_per_g,0) * v_w;
  v_sell := greatest(v_cost + v_margin, 0);

  return query
  select
    v_price_rule_id,
    v_markup_rule_id,
    v_cost,
    v_sell,
    jsonb_build_object(
      'weight_g', v_w,
      'cost_fixed_krw', coalesce(v_cost_fixed,0),
      'cost_per_g_krw', coalesce(v_cost_per_g,0),
      'margin_fixed_krw', coalesce(v_margin_fixed,0),
      'margin_per_g_krw', coalesce(v_margin_per_g,0),
      'cost_amount_krw', v_cost,
      'margin_amount_krw', v_margin,
      'sell_amount_krw', v_sell
    );
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute $g$grant execute on function public.cms_fn_calc_plating_amounts_v2(uuid,public.cms_e_category_code,public.cms_e_material_code,date,numeric) to authenticated$g$;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute $g$grant execute on function public.cms_fn_calc_plating_amounts_v2(uuid,public.cms_e_category_code,public.cms_e_material_code,date,numeric) to service_role$g$;
  end if;
end $$;


-- ============================================================
-- 6) Pricing rule pick 함수 v2 (apply_unit + stone_role 지원)
-- ============================================================

create or replace function public.cms_fn_pick_pricing_rule_markup_v2(
  p_component public.cms_e_pricing_rule_component,
  p_scope public.cms_e_pricing_rule_scope,
  p_apply_unit public.cms_e_pricing_rule_apply_unit,
  p_stone_role public.cms_e_stone_role default null,
  p_vendor_party_id uuid default null,
  p_cost_basis_krw numeric default 0
)
returns table(
  markup_krw numeric,
  picked_rule_id uuid
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with c as (
    select
      r.rule_id,
      r.markup_value_krw as markup_krw,
      r.priority,
      r.min_cost_krw,
      (case when r.vendor_party_id is null then 1 else 0 end) as vendor_rank,
      (case
        when p_stone_role is null then 0
        when r.stone_role is null then 1
        else 0
      end) as role_rank
    from public.cms_pricing_rule_v1 r
    where r.is_active = true
      and r.component = p_component
      and r.apply_unit = coalesce(p_apply_unit, 'PER_PIECE'::public.cms_e_pricing_rule_apply_unit)
      and (r.scope = 'ANY'::public.cms_e_pricing_rule_scope or r.scope = p_scope)
      and (r.vendor_party_id is null or r.vendor_party_id = p_vendor_party_id)
      and (
        -- p_stone_role가 NULL이면 stone_role도 NULL만 허용 (BASE_LABOR 등)
        (p_stone_role is null and r.stone_role is null)
        or
        -- p_stone_role가 있으면 role-specific 우선, 없으면 global(stone_role null)도 허용
        (p_stone_role is not null and (r.stone_role is null or r.stone_role = p_stone_role))
      )
      and coalesce(p_cost_basis_krw,0) >= coalesce(r.min_cost_krw,0)
      and (r.max_cost_krw is null or coalesce(p_cost_basis_krw,0) <= r.max_cost_krw)
  )
  select c.markup_krw, c.rule_id
  from c
  order by
    c.vendor_rank asc,   -- vendor 지정이 더 구체적
    c.role_rank asc,     -- role 지정이 더 구체적
    c.priority asc,
    c.min_cost_krw desc  -- 같은 priority면 더 높은 min_cost(더 타이트한 밴드) 우선
  limit 1;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute $g$grant execute on function public.cms_fn_pick_pricing_rule_markup_v2(
      public.cms_e_pricing_rule_component,
      public.cms_e_pricing_rule_scope,
      public.cms_e_pricing_rule_apply_unit,
      public.cms_e_stone_role,
      uuid,
      numeric
    ) to authenticated$g$;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute $g$grant execute on function public.cms_fn_pick_pricing_rule_markup_v2(
      public.cms_e_pricing_rule_component,
      public.cms_e_pricing_rule_scope,
      public.cms_e_pricing_rule_apply_unit,
      public.cms_e_stone_role,
      uuid,
      numeric
    ) to service_role$g$;
  end if;
end $$;


-- ============================================================
-- 7) (핵심) 영수증 라인 매칭 CONFIRM v5
--    - base labor: receipt basic cost + BASE_LABOR 룰(Per-piece)
--    - stone labor:
--        * SELF(BUY): buy margin profile (role별 per-stone)
--        * FACTORY: STONE 룰(Per-stone, role별, vendor별, cost-band)
--    - absorb labor items: master에서 자동 append
--    - 기존 워크플로(Shipment draft 생성, receipt_usage 기록 등) 동일 유지
-- ============================================================

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
  v_absorb_items := public.cms_fn_master_absorb_labor_items_json_v1(v_master.master_id, v_qty);

  select coalesce(sum(case when a.is_per_piece then a.amount_krw * v_qty else a.amount_krw end), 0)
    into v_absorb_total
  from public.cms_master_absorb_labor_item_v1 a
  where a.master_id = v_master.master_id
    and a.is_active = true;

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

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute $g$grant execute on function public.cms_fn_receipt_line_match_confirm_v5(
      uuid, uuid, uuid,
      numeric, public.cms_e_material_code,
      numeric, numeric, numeric,
      uuid, text,
      public.cms_e_factory_billing_shape
    ) to authenticated$g$;
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute $g$grant execute on function public.cms_fn_receipt_line_match_confirm_v5(
      uuid, uuid, uuid,
      numeric, public.cms_e_material_code,
      numeric, numeric, numeric,
      uuid, text,
      public.cms_e_factory_billing_shape
    ) to service_role$g$;
  end if;
end $$;


-- ============================================================
-- (선택) 초기 시드 예시 (원하는 값으로 직접 수정해서 쓰세요)
-- ============================================================
-- 1) 기본공임 글로벌 마진 룰 (예: 40,000원/개)
-- insert into public.cms_pricing_rule_v1(component, scope, apply_unit, min_cost_krw, max_cost_krw, markup_kind, markup_value_krw, priority, is_active, note)
-- values
-- ('BASE_LABOR','ANY','PER_PIECE',0,null,'ADD_KRW',40000,10,true,'기본공임 글로벌 마진(원/개)')
-- on conflict do nothing;

-- 2) FACTORY 스톤 마진 룰 (예: vendor별, role별, unit cost band별)
-- insert into public.cms_pricing_rule_v1(component, scope, apply_unit, stone_role, vendor_party_id, min_cost_krw, max_cost_krw, markup_kind, markup_value_krw, priority, is_active, note)
-- values
-- ('STONE','FACTORY','PER_STONE','CENTER','<vendor_uuid>',0,2000,'ADD_KRW',200,10,true,'센터석 unit_cost 0~2000 => +200원/개'),
-- ('STONE','FACTORY','PER_STONE','CENTER','<vendor_uuid>',2000,999999999,'ADD_KRW',300,10,true,'센터석 unit_cost 2000+ => +300원/개');
