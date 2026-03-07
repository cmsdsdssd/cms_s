set search_path = public, pg_temp;

create table if not exists public.price_sync_auto_state_v1 (
  state_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  channel_product_id uuid not null references public.sales_channel_product(channel_product_id) on delete cascade,
  master_item_id uuid references public.cms_master_item(master_item_id),
  external_product_no text not null,
  external_variant_code text,
  pressure_units numeric(12,6) not null default 0,
  last_gap_units numeric(12,6) not null default 0,
  last_seen_target_krw integer,
  last_seen_current_krw integer,
  last_auto_sync_at timestamptz,
  last_upsync_at timestamptz,
  last_downsync_at timestamptz,
  cooldown_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_price_sync_auto_state_v1_channel_product
  on public.price_sync_auto_state_v1(channel_id, channel_product_id);

create index if not exists idx_price_sync_auto_state_v1_channel_master
  on public.price_sync_auto_state_v1(channel_id, master_item_id, updated_at desc);
