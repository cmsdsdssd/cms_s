set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1112_option_category_material_scoped_delta_addonly
-- Material-scoped category delta source of truth for recompute/sync
-- -----------------------------------------------------------------------------

create table if not exists public.channel_option_category_delta_v1 (
  delta_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  master_item_id uuid not null references public.cms_master_item(master_item_id),
  external_product_no text not null,
  category_key text not null,
  scope_material_code text,
  sync_delta_krw integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text
);

do $$
begin
  alter table public.channel_option_category_delta_v1
    add constraint channel_option_category_delta_v1_category_enum
    check (category_key in ('MATERIAL', 'SIZE', 'COLOR_PLATING', 'DECOR', 'OTHER'));
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_category_delta_v1
    add constraint channel_option_category_delta_v1_non_blank
    check (btrim(external_product_no) <> '');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_category_delta_v1
    add constraint channel_option_category_delta_v1_scope_non_blank
    check (scope_material_code is null or btrim(scope_material_code) <> '');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_category_delta_v1
    add constraint channel_option_category_delta_v1_sync_delta_range
    check (sync_delta_krw between -1000000 and 1000000);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_category_delta_v1
    add constraint channel_option_category_delta_v1_sync_delta_step
    check (mod(sync_delta_krw, 1000) = 0);
exception when duplicate_object then
  null;
end $$;

create unique index if not exists uq_channel_option_category_delta_v1_default
  on public.channel_option_category_delta_v1(channel_id, master_item_id, external_product_no, category_key)
  where scope_material_code is null;

create unique index if not exists uq_channel_option_category_delta_v1_scoped
  on public.channel_option_category_delta_v1(channel_id, master_item_id, external_product_no, category_key, scope_material_code)
  where scope_material_code is not null;

create index if not exists idx_channel_option_category_delta_v1_lookup
  on public.channel_option_category_delta_v1(channel_id, master_item_id, external_product_no, updated_at desc);

do $$
begin
  if to_regprocedure('public.cms_fn_set_updated_at()') is not null then
    begin
      create trigger trg_channel_option_category_delta_v1_updated_at
      before update on public.channel_option_category_delta_v1
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;
