set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1004_shop_snapshot_sync_tables_addonly
-- Wave1: snapshots + sync jobs + future bucket tables
-- -----------------------------------------------------------------------------

do $$
begin
  create type public.shop_e_sync_job_status as enum ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED', 'CANCELLED');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create type public.shop_e_sync_item_status as enum ('SUCCESS', 'FAILED', 'SKIPPED');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create type public.shop_e_run_type as enum ('MANUAL', 'AUTO');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create type public.shop_e_bucket_type as enum ('COLLECTION', 'TAG_GROUP', 'CAMPAIGN');
exception when duplicate_object then
  null;
end $$;

create table if not exists public.pricing_snapshot (
  snapshot_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  master_item_id uuid not null references public.cms_master_item(master_item_id),
  channel_product_id uuid references public.sales_channel_product(channel_product_id) on delete set null,

  computed_at timestamptz not null default now(),
  tick_as_of timestamptz,
  tick_source text,
  tick_gold_krw_g numeric(18,4),
  tick_silver_krw_g numeric(18,4),

  net_weight_g numeric(18,4),
  material_raw_krw numeric(18,4) not null default 0,
  factor_set_id_used uuid references public.material_factor_set(factor_set_id),
  material_factor_multiplier_used numeric(12,6) not null default 1,
  material_final_krw numeric(18,4) not null default 0,

  labor_raw_krw numeric(18,4) not null default 0,
  labor_pre_margin_adj_krw numeric(18,4) not null default 0,
  labor_post_margin_adj_krw numeric(18,4) not null default 0,
  total_pre_margin_adj_krw numeric(18,4) not null default 0,
  total_post_margin_adj_krw numeric(18,4) not null default 0,

  base_total_pre_margin_krw numeric(18,4) not null default 0,
  margin_multiplier_used numeric(12,6) not null default 1,
  total_after_margin_krw numeric(18,4) not null default 0,
  target_price_raw_krw numeric(18,4) not null default 0,

  rounding_unit_used int not null default 1000,
  rounding_mode_used public.shop_e_rounding_mode not null default 'CEIL',
  rounded_target_price_krw numeric(18,0) not null default 0,

  override_price_krw numeric(18,0),
  final_target_price_krw numeric(18,0) not null default 0,

  applied_adjustment_ids jsonb not null default '[]'::jsonb,
  breakdown_json jsonb not null default '{}'::jsonb,
  compute_request_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pricing_snapshot_latest
  on public.pricing_snapshot(channel_id, master_item_id, computed_at desc);

create index if not exists idx_pricing_snapshot_channel_product
  on public.pricing_snapshot(channel_id, channel_product_id, computed_at desc);

create index if not exists idx_pricing_snapshot_computed_at
  on public.pricing_snapshot(computed_at desc);

create table if not exists public.channel_price_snapshot (
  channel_price_snapshot_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  channel_product_id uuid references public.sales_channel_product(channel_product_id) on delete set null,
  master_item_id uuid references public.cms_master_item(master_item_id),
  external_product_no text not null,
  current_price_krw numeric(18,0),
  currency text not null default 'KRW',
  fetched_at timestamptz not null default now(),
  http_status int,
  fetch_status text not null default 'SUCCESS',
  error_code text,
  error_message text,
  raw_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.channel_price_snapshot
    add constraint channel_price_snapshot_external_not_blank
    check (btrim(external_product_no) <> '');
exception when duplicate_object then
  null;
end $$;

create index if not exists idx_channel_price_snapshot_latest
  on public.channel_price_snapshot(channel_id, external_product_no, fetched_at desc);

create index if not exists idx_channel_price_snapshot_master
  on public.channel_price_snapshot(channel_id, master_item_id, fetched_at desc);

create table if not exists public.price_sync_job (
  job_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  run_type public.shop_e_run_type not null default 'MANUAL',
  status public.shop_e_sync_job_status not null default 'RUNNING',
  requested_by uuid references public.cms_person(person_id),
  request_payload jsonb,
  success_count int not null default 0,
  failed_count int not null default 0,
  skipped_count int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_price_sync_job_channel_started
  on public.price_sync_job(channel_id, started_at desc);

create index if not exists idx_price_sync_job_status
  on public.price_sync_job(status, started_at desc);

create table if not exists public.price_sync_job_item (
  job_item_id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.price_sync_job(job_id) on delete cascade,
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  channel_product_id uuid references public.sales_channel_product(channel_product_id) on delete set null,
  master_item_id uuid references public.cms_master_item(master_item_id),
  external_product_no text not null,
  before_price_krw numeric(18,0),
  target_price_krw numeric(18,0) not null,
  after_price_krw numeric(18,0),
  status public.shop_e_sync_item_status not null default 'SUCCESS',
  http_status int,
  error_code text,
  error_message text,
  raw_response_json jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_price_sync_job_item_job
  on public.price_sync_job_item(job_id);

create index if not exists idx_price_sync_job_item_master
  on public.price_sync_job_item(channel_id, master_item_id, updated_at desc);

create index if not exists idx_price_sync_job_item_status
  on public.price_sync_job_item(status, updated_at desc);

create table if not exists public.bucket (
  bucket_id uuid primary key default gen_random_uuid(),
  bucket_type public.shop_e_bucket_type not null,
  name text not null,
  slug text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_bucket_slug
  on public.bucket(slug)
  where slug is not null;

create table if not exists public.bucket_master_item (
  bucket_id uuid not null references public.bucket(bucket_id) on delete cascade,
  master_item_id uuid not null references public.cms_master_item(master_item_id),
  sort_order int,
  created_at timestamptz not null default now(),
  primary key (bucket_id, master_item_id)
);

create index if not exists idx_bucket_master_item_sort
  on public.bucket_master_item(bucket_id, sort_order nulls last, created_at desc);

do $$
begin
  if to_regprocedure('public.cms_fn_set_updated_at()') is not null then
    begin
      create trigger trg_pricing_snapshot_updated_at
      before update on public.pricing_snapshot
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then null;
    end;

    begin
      create trigger trg_channel_price_snapshot_updated_at
      before update on public.channel_price_snapshot
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then null;
    end;

    begin
      create trigger trg_price_sync_job_updated_at
      before update on public.price_sync_job
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then null;
    end;

    begin
      create trigger trg_bucket_updated_at
      before update on public.bucket
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then null;
    end;
  end if;
end $$;
