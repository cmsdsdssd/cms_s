set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1021_shop_sync_rule4_decoration_addonly
-- Add decoration option fields and Rule4 decoration table.
-- -----------------------------------------------------------------------------

alter table if exists public.sales_channel_product
  add column if not exists option_decoration_code text,
  add column if not exists sync_rule_decoration_enabled boolean not null default true;

do $$
begin
  alter table public.sales_channel_product
    add constraint sales_channel_product_option_decoration_code_not_blank
    check (option_decoration_code is null or btrim(option_decoration_code) <> '');
exception when duplicate_object then
  null;
end $$;

create table if not exists public.sync_rule_r4_decoration (
  rule_id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.sync_rule_set(rule_set_id) on delete cascade,
  linked_r1_rule_id uuid references public.sync_rule_r1_material_delta(rule_id) on delete set null,
  match_decoration_code text not null,
  match_material_code text,
  match_category_code text,
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
  alter table public.sync_rule_r4_decoration
    add constraint sync_rule_r4_decoration_code_not_blank
    check (btrim(match_decoration_code) <> '');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sync_rule_r4_decoration
    add constraint sync_rule_r4_rounding_unit_positive
    check (rounding_unit > 0);
exception when duplicate_object then
  null;
end $$;

create index if not exists idx_sync_rule_r4_lookup
  on public.sync_rule_r4_decoration(rule_set_id, is_active, priority, updated_at desc);

create index if not exists idx_sales_channel_product_rule4
  on public.sales_channel_product(channel_id, option_decoration_code, sync_rule_decoration_enabled)
  where is_active = true;

do $$
begin
  if to_regprocedure('public.cms_fn_set_updated_at()') is not null then
    begin
      create trigger trg_sync_rule_r4_updated_at
      before update on public.sync_rule_r4_decoration
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on public.sync_rule_r4_decoration to authenticated';
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on public.sync_rule_r4_decoration to service_role';
  end if;
end $$;
