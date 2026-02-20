set search_path = public, pg_temp;
-- ============================================================
-- 0381: Global pricing rules (SETTING/STONE/PACKAGE) + master addon margins (margin-only)
-- Add-only + idempotent + safety guards
--
-- What this migration does:
-- 1) Ensure/extend cms_e_stone_supply_source enum to include 'FACTORY'
-- 2) Create new enums for billing_shape and rule system (if not exists)
-- 3) Add master addon margins (2 columns, margin-only, per piece) with default 0
-- 4) Create cms_pricing_rule_v1 table (if not exists) + index + constraint
-- 5) Create rule pick function cms_fn_pick_pricing_rule_markup_v1 (security definer)
-- 6) Safe grants (only if roles exist)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Ensure/extend stone supply enum: cms_e_stone_supply_source
--    - If type doesn't exist: create ('SELF','PROVIDED','FACTORY')
--    - If exists but lacks 'FACTORY': add it
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'cms_e_stone_supply_source'
  ) then
    execute $sql$create type public.cms_e_stone_supply_source as enum ('SELF','PROVIDED','FACTORY')$sql$;
  else
    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public'
        and t.typname = 'cms_e_stone_supply_source'
        and e.enumlabel = 'FACTORY'
    ) then
      -- add value at end (safe, additive)
      execute $sql$alter type public.cms_e_stone_supply_source add value 'FACTORY'$sql$;
    end if;
  end if;
end $$;
-- ------------------------------------------------------------
-- 2) New enums (create only if missing)
-- ------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typname='cms_e_factory_billing_shape'
  ) then
    execute $sql$create type public.cms_e_factory_billing_shape as enum ('SETTING_ONLY','BUNDLED_PACKAGE','SPLIT')$sql$;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typname='cms_e_pricing_rule_component'
  ) then
    execute $sql$create type public.cms_e_pricing_rule_component as enum ('SETTING','STONE','PACKAGE')$sql$;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typname='cms_e_pricing_rule_scope'
  ) then
    execute $sql$create type public.cms_e_pricing_rule_scope as enum ('ANY','SELF','PROVIDED','FACTORY')$sql$;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typname='cms_e_pricing_rule_markup_kind'
  ) then
    execute $sql$create type public.cms_e_pricing_rule_markup_kind as enum ('ADD_KRW')$sql$;
  end if;
end $$;
-- ------------------------------------------------------------
-- 3) Master addon margins (margin-only, per piece)
--    - default 0, NOT NULL
-- ------------------------------------------------------------
alter table if exists public.cms_master_item
  add column if not exists setting_addon_margin_krw_per_piece numeric not null default 0,
  add column if not exists stone_addon_margin_krw_per_piece   numeric not null default 0;
-- ------------------------------------------------------------
-- 4) Rule table: cms_pricing_rule_v1
-- ------------------------------------------------------------
create table if not exists public.cms_pricing_rule_v1 (
  rule_id uuid primary key default gen_random_uuid(),

  component public.cms_e_pricing_rule_component not null,
  scope public.cms_e_pricing_rule_scope not null default 'ANY',

  -- optional vendor override (null => global)
  vendor_party_id uuid null,

  -- basis range
  min_cost_krw numeric not null,
  max_cost_krw numeric null,

  markup_kind public.cms_e_pricing_rule_markup_kind not null default 'ADD_KRW',
  markup_value_krw numeric not null default 0,

  -- lower is stronger
  priority int not null default 100,

  is_active boolean not null default true,
  note text null,

  created_at timestamptz not null default now(),
  created_by uuid null,
  updated_at timestamptz not null default now(),
  updated_by uuid null,

  constraint cms_pricing_rule_v1_range_check
    check (max_cost_krw is null or max_cost_krw >= min_cost_krw)
);
create index if not exists idx_cms_pricing_rule_v1_lookup
  on public.cms_pricing_rule_v1(component, scope, is_active, vendor_party_id, priority, min_cost_krw);
-- ------------------------------------------------------------
-- 5) Pick rule function (SECURITY DEFINER)
--    - vendor-specific wins over global
--    - scope: ANY or exact scope
--    - range: min <= basis <= max (max null => infinity)
--    - priority asc, then higher min_cost_krw first (more specific)
-- ------------------------------------------------------------
create or replace function public.cms_fn_pick_pricing_rule_markup_v1(
  p_component public.cms_e_pricing_rule_component,
  p_scope public.cms_e_pricing_rule_scope,
  p_vendor_party_id uuid,
  p_cost_basis_krw numeric
)
returns table(markup_krw numeric, picked_rule_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_basis numeric := coalesce(p_cost_basis_krw, 0);
begin
  return query
  with candidates as (
    select
      r.rule_id,
      r.markup_value_krw,
      r.priority,
      case when r.vendor_party_id is null then 1 else 0 end as vendor_rank,
      r.min_cost_krw
    from public.cms_pricing_rule_v1 r
    where r.is_active = true
      and r.component = p_component
      and (r.scope = 'ANY'::public.cms_e_pricing_rule_scope or r.scope = p_scope)
      and (r.vendor_party_id is null or r.vendor_party_id = p_vendor_party_id)
      and r.min_cost_krw <= v_basis
      and (r.max_cost_krw is null or v_basis <= r.max_cost_krw)
  )
  select
    coalesce(c.markup_value_krw, 0)::numeric as markup_krw,
    c.rule_id as picked_rule_id
  from candidates c
  order by
    c.vendor_rank asc,
    c.priority asc,
    c.min_cost_krw desc
  limit 1;

  if not found then
    markup_krw := 0;
    picked_rule_id := null;
    return next;
  end if;
end $$;
-- ------------------------------------------------------------
-- 6) Safe grants (only if roles exist)
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute $g$grant execute on function public.cms_fn_pick_pricing_rule_markup_v1(
      public.cms_e_pricing_rule_component,
      public.cms_e_pricing_rule_scope,
      uuid,
      numeric
    ) to authenticated$g$;
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute $g$grant execute on function public.cms_fn_pick_pricing_rule_markup_v1(
      public.cms_e_pricing_rule_component,
      public.cms_e_pricing_rule_scope,
      uuid,
      numeric
    ) to service_role$g$;
  end if;
end $$;
-- Done.;
