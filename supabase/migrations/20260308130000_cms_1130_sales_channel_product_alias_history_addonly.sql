set search_path = public, pg_temp;

create table if not exists public.sales_channel_product_alias_history (
  alias_history_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  canonical_channel_product_id uuid references public.sales_channel_product(channel_product_id) on delete set null,
  master_item_id uuid references public.cms_master_item(master_item_id) on delete set null,
  canonical_external_product_no text not null,
  alias_external_product_no text not null,
  external_variant_code text not null default '',
  reason text not null default 'CANONICALIZED',
  created_at timestamptz not null default now()
);

do $$
begin
  alter table public.sales_channel_product_alias_history
    add constraint sales_channel_product_alias_history_canonical_not_blank
    check (btrim(canonical_external_product_no) <> '');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sales_channel_product_alias_history
    add constraint sales_channel_product_alias_history_alias_not_blank
    check (btrim(alias_external_product_no) <> '');
exception when duplicate_object then
  null;
end $$;

create index if not exists idx_sales_channel_product_alias_history_alias_lookup
  on public.sales_channel_product_alias_history(channel_id, alias_external_product_no, created_at desc);

create index if not exists idx_sales_channel_product_alias_history_master
  on public.sales_channel_product_alias_history(channel_id, master_item_id, created_at desc);

create index if not exists idx_sales_channel_product_alias_history_canonical_channel_product
  on public.sales_channel_product_alias_history(canonical_channel_product_id, created_at desc);

do $$
begin
  execute 'grant select on public.sales_channel_product_alias_history to authenticated';
exception when insufficient_privilege then
  null;
end $$;

do $$
begin
  execute 'grant select, insert, update, delete on public.sales_channel_product_alias_history to service_role';
exception when insufficient_privilege then
  null;
end $$;
