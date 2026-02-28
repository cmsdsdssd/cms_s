set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1018_shop_sync_rule_engine_addonly
-- R1/R2/R3 option-rule engine tables + rule set binding.
-- -----------------------------------------------------------------------------

create table if not exists public.sync_rule_set (
  rule_set_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.sync_rule_set
    add constraint sync_rule_set_name_not_blank
    check (btrim(name) <> '');
exception when duplicate_object then
  null;
end $$;

create unique index if not exists uq_sync_rule_set_channel_name
  on public.sync_rule_set(channel_id, lower(name));

create index if not exists idx_sync_rule_set_channel_active
  on public.sync_rule_set(channel_id, is_active, updated_at desc);

create table if not exists public.sync_rule_r1_material_delta (
  rule_id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.sync_rule_set(rule_set_id) on delete cascade,
  source_material_code text,
  target_material_code text not null,
  match_category_code text,
  weight_min_g numeric(12,3),
  weight_max_g numeric(12,3),
  option_weight_multiplier numeric(12,6) not null default 1,
  rounding_unit int not null default 100,
  rounding_mode public.shop_e_rounding_mode not null default 'ROUND',
  priority int not null default 100,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.sync_rule_r1_material_delta
    add constraint sync_rule_r1_target_material_not_blank
    check (btrim(target_material_code) <> '');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sync_rule_r1_material_delta
    add constraint sync_rule_r1_weight_range_valid
    check (
      (weight_min_g is null and weight_max_g is null)
      or
      (weight_min_g is not null and weight_max_g is not null and weight_min_g <= weight_max_g)
    );
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sync_rule_r1_material_delta
    add constraint sync_rule_r1_multiplier_positive
    check (option_weight_multiplier > 0);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sync_rule_r1_material_delta
    add constraint sync_rule_r1_rounding_unit_positive
    check (rounding_unit > 0);
exception when duplicate_object then
  null;
end $$;

create index if not exists idx_sync_rule_r1_lookup
  on public.sync_rule_r1_material_delta(rule_set_id, is_active, priority, updated_at desc);

create table if not exists public.sync_rule_r2_size_weight (
  rule_id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.sync_rule_set(rule_set_id) on delete cascade,
  match_material_code text,
  match_category_code text,
  weight_min_g numeric(12,3) not null,
  weight_max_g numeric(12,3) not null,
  option_range_expr text not null,
  delta_krw numeric(14,2) not null,
  rounding_unit int not null default 100,
  rounding_mode public.shop_e_rounding_mode not null default 'ROUND',
  priority int not null default 100,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.sync_rule_r2_size_weight
    add constraint sync_rule_r2_weight_range_valid
    check (weight_min_g <= weight_max_g);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sync_rule_r2_size_weight
    add constraint sync_rule_r2_option_range_not_blank
    check (btrim(option_range_expr) <> '');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sync_rule_r2_size_weight
    add constraint sync_rule_r2_rounding_unit_positive
    check (rounding_unit > 0);
exception when duplicate_object then
  null;
end $$;

create index if not exists idx_sync_rule_r2_lookup
  on public.sync_rule_r2_size_weight(rule_set_id, is_active, priority, updated_at desc);

create table if not exists public.sync_rule_r3_color_margin (
  rule_id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.sync_rule_set(rule_set_id) on delete cascade,
  color_code text not null,
  margin_min_krw numeric(14,2) not null,
  margin_max_krw numeric(14,2) not null,
  delta_krw numeric(14,2) not null,
  rounding_unit int not null default 100,
  rounding_mode public.shop_e_rounding_mode not null default 'ROUND',
  priority int not null default 100,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.sync_rule_r3_color_margin
    add constraint sync_rule_r3_color_not_blank
    check (btrim(color_code) <> '');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sync_rule_r3_color_margin
    add constraint sync_rule_r3_margin_range_valid
    check (margin_min_krw <= margin_max_krw);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sync_rule_r3_color_margin
    add constraint sync_rule_r3_rounding_unit_positive
    check (rounding_unit > 0);
exception when duplicate_object then
  null;
end $$;

create index if not exists idx_sync_rule_r3_lookup
  on public.sync_rule_r3_color_margin(rule_set_id, is_active, priority, updated_at desc);

alter table if exists public.sales_channel_product
  add column if not exists sync_rule_set_id uuid references public.sync_rule_set(rule_set_id) on delete set null;

create index if not exists idx_sales_channel_product_sync_rule_set
  on public.sales_channel_product(channel_id, sync_rule_set_id, is_active, updated_at desc)
  where sync_rule_set_id is not null;

do $$
begin
  if to_regprocedure('public.cms_fn_set_updated_at()') is not null then
    begin
      create trigger trg_sync_rule_set_updated_at
      before update on public.sync_rule_set
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;

    begin
      create trigger trg_sync_rule_r1_updated_at
      before update on public.sync_rule_r1_material_delta
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;

    begin
      create trigger trg_sync_rule_r2_updated_at
      before update on public.sync_rule_r2_size_weight
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;

    begin
      create trigger trg_sync_rule_r3_updated_at
      before update on public.sync_rule_r3_color_margin
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on public.sync_rule_set to authenticated';
    execute 'grant select on public.sync_rule_r1_material_delta to authenticated';
    execute 'grant select on public.sync_rule_r2_size_weight to authenticated';
    execute 'grant select on public.sync_rule_r3_color_margin to authenticated';
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on public.sync_rule_set to service_role';
    execute 'grant select, insert, update, delete on public.sync_rule_r1_material_delta to service_role';
    execute 'grant select, insert, update, delete on public.sync_rule_r2_size_weight to service_role';
    execute 'grant select, insert, update, delete on public.sync_rule_r3_color_margin to service_role';
  end if;
end $$;
