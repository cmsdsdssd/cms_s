set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1002_shop_policy_factor_addonly
-- Wave1: pricing policy + factor set
-- -----------------------------------------------------------------------------

do $$
begin
  create type public.shop_e_rounding_mode as enum ('CEIL', 'ROUND', 'FLOOR');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create type public.shop_e_factor_scope as enum ('GLOBAL', 'CHANNEL');
exception when duplicate_object then
  null;
end $$;

create table if not exists public.material_factor_set (
  factor_set_id uuid primary key default gen_random_uuid(),
  scope public.shop_e_factor_scope not null,
  channel_id uuid references public.sales_channel(channel_id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  is_global_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.material_factor_set
    add constraint material_factor_set_scope_channel_guard
    check (
      (scope = 'GLOBAL' and channel_id is null)
      or
      (scope = 'CHANNEL' and channel_id is not null)
    );
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.material_factor_set
    add constraint material_factor_set_name_not_blank
    check (btrim(name) <> '');
exception when duplicate_object then
  null;
end $$;

create unique index if not exists uq_material_factor_set_global_default
  on public.material_factor_set(is_global_default)
  where scope = 'GLOBAL' and is_global_default = true;

create index if not exists idx_material_factor_set_channel
  on public.material_factor_set(channel_id, is_active, updated_at desc)
  where scope = 'CHANNEL';

create index if not exists idx_material_factor_set_global
  on public.material_factor_set(is_active, updated_at desc)
  where scope = 'GLOBAL';

create table if not exists public.material_factor (
  factor_id uuid primary key default gen_random_uuid(),
  factor_set_id uuid not null references public.material_factor_set(factor_set_id) on delete cascade,
  material_code text not null,
  multiplier numeric(12,6) not null default 1.000000,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_material_factor_set_code
  on public.material_factor(factor_set_id, material_code);

create index if not exists idx_material_factor_set
  on public.material_factor(factor_set_id, updated_at desc);

do $$
begin
  alter table public.material_factor
    add constraint material_factor_multiplier_positive
    check (multiplier > 0);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.material_factor
    add constraint material_factor_code_not_blank
    check (btrim(material_code) <> '');
exception when duplicate_object then
  null;
end $$;

create table if not exists public.pricing_policy (
  policy_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  policy_name text not null,
  margin_multiplier numeric(12,6) not null default 1.000000,
  rounding_unit int not null default 1000,
  rounding_mode public.shop_e_rounding_mode not null default 'CEIL',
  material_factor_set_id uuid references public.material_factor_set(factor_set_id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.pricing_policy
  add column if not exists policy_id uuid,
  add column if not exists channel_id uuid,
  add column if not exists policy_name text,
  add column if not exists margin_multiplier numeric(12,6),
  add column if not exists rounding_unit int,
  add column if not exists rounding_mode public.shop_e_rounding_mode,
  add column if not exists material_factor_set_id uuid,
  add column if not exists is_active boolean,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.pricing_policy
set policy_id = coalesce(policy_id, gen_random_uuid()),
    policy_name = coalesce(policy_name, 'DEFAULT_POLICY'),
    margin_multiplier = coalesce(margin_multiplier, 1.000000),
    rounding_unit = coalesce(rounding_unit, 1000),
    rounding_mode = coalesce(rounding_mode, 'CEIL'::public.shop_e_rounding_mode),
    is_active = coalesce(is_active, true),
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now())
where policy_id is null
   or policy_name is null
   or margin_multiplier is null
   or rounding_unit is null
   or rounding_mode is null
   or is_active is null
   or created_at is null
   or updated_at is null;

alter table public.pricing_policy
  alter column policy_id set default gen_random_uuid(),
  alter column policy_name set default 'DEFAULT_POLICY',
  alter column margin_multiplier set default 1.000000,
  alter column rounding_unit set default 1000,
  alter column rounding_mode set default 'CEIL'::public.shop_e_rounding_mode,
  alter column is_active set default true,
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.pricing_policy
  alter column policy_id set not null,
  alter column policy_name set not null,
  alter column margin_multiplier set not null,
  alter column rounding_unit set not null,
  alter column rounding_mode set not null,
  alter column is_active set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

create unique index if not exists uq_pricing_policy_policy_id
  on public.pricing_policy(policy_id);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pricing_policy'
      and column_name = 'policy_name'
  ) then
    alter table public.pricing_policy
      add constraint pricing_policy_name_not_blank
      check (btrim(policy_name) <> '');
  end if;
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.pricing_policy
    add constraint pricing_policy_margin_nonneg
    check (margin_multiplier >= 0);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.pricing_policy
    add constraint pricing_policy_rounding_unit_positive
    check (rounding_unit > 0);
exception when duplicate_object then
  null;
end $$;

create unique index if not exists uq_pricing_policy_channel_active
  on public.pricing_policy(channel_id)
  where is_active = true;

create index if not exists idx_pricing_policy_channel
  on public.pricing_policy(channel_id, updated_at desc);

create table if not exists public.pricing_policy_rule (
  rule_id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.pricing_policy(policy_id) on delete cascade,
  match_material_code text,
  match_category_code text,
  margin_multiplier_override numeric(12,6),
  rounding_unit_override int,
  rounding_mode_override public.shop_e_rounding_mode,
  priority int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pricing_policy_rule_lookup
  on public.pricing_policy_rule(policy_id, is_active, priority, updated_at desc);

do $$
begin
  alter table public.pricing_policy_rule
    add constraint pricing_policy_rule_rounding_unit_positive
    check (rounding_unit_override is null or rounding_unit_override > 0);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  if to_regprocedure('public.cms_fn_set_updated_at()') is not null then
    begin
      create trigger trg_material_factor_set_updated_at
      before update on public.material_factor_set
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;

    begin
      create trigger trg_material_factor_updated_at
      before update on public.material_factor
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;

    begin
      create trigger trg_pricing_policy_updated_at
      before update on public.pricing_policy
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;

    begin
      create trigger trg_pricing_policy_rule_updated_at
      before update on public.pricing_policy_rule
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on public.material_factor_set to authenticated';
    execute 'grant select on public.material_factor to authenticated';
    execute 'grant select on public.pricing_policy to authenticated';
    execute 'grant select on public.pricing_policy_rule to authenticated';
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on public.material_factor_set to service_role';
    execute 'grant select, insert, update, delete on public.material_factor to service_role';
    execute 'grant select, insert, update, delete on public.pricing_policy to service_role';
    execute 'grant select, insert, update, delete on public.pricing_policy_rule to service_role';
  end if;
end $$;
