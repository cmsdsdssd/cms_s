create table if not exists public.product_price_publish_base_v1 (
  channel_product_id uuid not null,
  channel_id uuid not null,
  master_item_id uuid not null,
  external_product_no text not null,
  publish_version text not null,
  pricing_algo_version text,
  target_price_raw_krw integer,
  published_base_price_krw integer not null check (published_base_price_krw >= 0),
  published_total_price_krw integer not null check (published_total_price_krw >= 0),
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (channel_product_id, publish_version)
);

create index if not exists idx_product_price_publish_base_v1_channel_product
  on public.product_price_publish_base_v1(channel_id, channel_product_id, computed_at desc);

create index if not exists idx_product_price_publish_base_v1_product
  on public.product_price_publish_base_v1(channel_id, external_product_no, computed_at desc);

create table if not exists public.product_price_publish_option_entry_v1 (
  channel_id uuid not null,
  master_item_id uuid not null,
  external_product_no text not null,
  option_axis_index integer not null check (option_axis_index >= 1),
  option_name text not null,
  option_value text not null,
  publish_version text not null,
  published_delta_krw integer not null,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (
    channel_id,
    master_item_id,
    external_product_no,
    option_axis_index,
    option_name,
    option_value,
    publish_version
  )
);

create table if not exists public.product_price_publish_variant_v1 (
  channel_product_id uuid not null,
  channel_id uuid not null,
  master_item_id uuid not null,
  external_product_no text not null,
  external_variant_code text not null,
  publish_version text not null,
  pricing_algo_version text,
  target_price_raw_krw integer,
  published_base_price_krw integer not null check (published_base_price_krw >= 0),
  published_additional_amount_krw integer not null,
  published_total_price_krw integer not null check (published_total_price_krw >= 0),
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (channel_product_id, publish_version)
);

create index if not exists idx_product_price_publish_variant_v1_channel_product
  on public.product_price_publish_variant_v1(channel_id, channel_product_id, computed_at desc);

create index if not exists idx_product_price_publish_variant_v1_product
  on public.product_price_publish_variant_v1(channel_id, external_product_no, computed_at desc);

create table if not exists public.product_price_live_state_v1 (
  channel_product_id uuid not null,
  channel_id uuid not null,
  master_item_id uuid,
  external_product_no text not null,
  external_variant_code text not null default '',
  publish_version text not null,
  live_base_price_krw integer,
  live_additional_amount_krw integer,
  live_total_price_krw integer,
  sync_status text not null check (sync_status in ('PENDING', 'SYNCED', 'VERIFY_FAILED', 'FAILED')),
  last_error_code text,
  last_error_message text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (channel_product_id, publish_version)
);

create index if not exists idx_product_price_live_state_v1_product
  on public.product_price_live_state_v1(channel_id, external_product_no, updated_at desc);
