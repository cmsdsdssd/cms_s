set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1104_option_snapshot_sot_and_cursor_addonly
-- 1) Add category-delta columns to pricing_snapshot for deterministic replay.
-- 2) Add compute cursor table for pinned latest-per-master reads.
-- -----------------------------------------------------------------------------

alter table public.pricing_snapshot
  add column if not exists delta_material_krw integer not null default 0,
  add column if not exists delta_size_krw integer not null default 0,
  add column if not exists delta_color_krw integer not null default 0,
  add column if not exists delta_decor_krw integer not null default 0,
  add column if not exists delta_other_krw integer not null default 0,
  add column if not exists delta_total_krw integer not null default 0;

create table if not exists public.pricing_compute_cursor (
  channel_id uuid not null,
  master_item_id uuid not null,
  compute_request_id uuid not null,
  computed_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (channel_id, master_item_id)
);

create index if not exists ix_pricing_compute_cursor_compute_request
  on public.pricing_compute_cursor (compute_request_id, channel_id, master_item_id);
