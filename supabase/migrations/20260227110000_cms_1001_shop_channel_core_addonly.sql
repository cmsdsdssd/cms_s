set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1001_shop_channel_core_addonly
-- Wave1: channel/account/product mapping core
-- -----------------------------------------------------------------------------

-- Compatibility: ensure master_item_id alias exists on cms_master_item.
alter table if exists public.cms_master_item
  add column if not exists master_item_id uuid
  generated always as (master_id) stored;

create unique index if not exists uq_cms_master_item_master_item_id
  on public.cms_master_item(master_item_id);

do $$
begin
  create type public.shop_e_channel_type as enum ('CAFE24');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create type public.shop_e_account_status as enum ('CONNECTED', 'EXPIRED', 'ERROR', 'DISCONNECTED');
exception when duplicate_object then
  null;
end $$;

create table if not exists public.sales_channel (
  channel_id uuid primary key default gen_random_uuid(),
  channel_type public.shop_e_channel_type not null default 'CAFE24',
  channel_code text not null,
  channel_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_sales_channel_code
  on public.sales_channel(channel_code);

do $$
begin
  alter table public.sales_channel
    add constraint sales_channel_code_not_blank
    check (btrim(channel_code) <> '');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sales_channel
    add constraint sales_channel_name_not_blank
    check (btrim(channel_name) <> '');
exception when duplicate_object then
  null;
end $$;

create table if not exists public.sales_channel_account (
  account_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,

  mall_id text not null,
  shop_no int not null default 1,

  client_id_enc text,
  client_secret_enc text,
  access_token_enc text,
  access_token_expires_at timestamptz,
  refresh_token_enc text,
  refresh_token_expires_at timestamptz,
  api_version text,

  status public.shop_e_account_status not null default 'DISCONNECTED',
  last_error_code text,
  last_error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_sales_channel_account_channel
  on public.sales_channel_account(channel_id);

create index if not exists idx_sales_channel_account_status
  on public.sales_channel_account(status, updated_at desc);

do $$
begin
  alter table public.sales_channel_account
    add constraint sales_channel_account_mall_id_not_blank
    check (btrim(mall_id) <> '');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sales_channel_account
    add constraint sales_channel_account_shop_no_positive
    check (shop_no > 0);
exception when duplicate_object then
  null;
end $$;

create table if not exists public.sales_channel_product (
  channel_product_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  master_item_id uuid not null references public.cms_master_item(master_item_id),
  external_product_no text not null,
  external_variant_code text,
  mapping_source text not null default 'MANUAL',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_sales_channel_product_ext
  on public.sales_channel_product(channel_id, external_product_no);

create index if not exists idx_sales_channel_product_master
  on public.sales_channel_product(channel_id, master_item_id);

create index if not exists idx_sales_channel_product_active
  on public.sales_channel_product(channel_id, is_active, updated_at desc);

do $$
begin
  alter table public.sales_channel_product
    add constraint sales_channel_product_external_not_blank
    check (btrim(external_product_no) <> '');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sales_channel_product
    add constraint sales_channel_product_mapping_source_enum
    check (mapping_source in ('MANUAL', 'CSV', 'AUTO'));
exception when duplicate_object then
  null;
end $$;

do $$
begin
  if to_regprocedure('public.cms_fn_set_updated_at()') is not null then
    begin
      create trigger trg_sales_channel_updated_at
      before update on public.sales_channel
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;

    begin
      create trigger trg_sales_channel_account_updated_at
      before update on public.sales_channel_account
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;

    begin
      create trigger trg_sales_channel_product_updated_at
      before update on public.sales_channel_product
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on public.sales_channel to authenticated';
    execute 'grant select on public.sales_channel_product to authenticated';
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on public.sales_channel to service_role';
    execute 'grant select, insert, update, delete on public.sales_channel_account to service_role';
    execute 'grant select, insert, update, delete on public.sales_channel_product to service_role';
  end if;
end $$;
