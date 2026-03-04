set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1103_snapshot_table_hardening_addonly
-- Snapshot hardening for deterministic reads/writes.
-- 1) Enforce one row per compute_request/channel/product/master tuple.
-- 2) Add read indexes for latest + compute_request pinned lookups.
-- 3) Recreate latest view with explicit deterministic order.
-- -----------------------------------------------------------------------------

-- 1) uniqueness per compute run (append-only across runs is still allowed)
create unique index if not exists ux_pricing_snapshot_compute_tuple
  on public.pricing_snapshot (
    compute_request_id,
    channel_id,
    coalesce(channel_product_id, '00000000-0000-0000-0000-000000000000'::uuid),
    master_item_id
  );

-- 2) read indexes (compute pinned + latest path)
create index if not exists ix_pricing_snapshot_channel_compute
  on public.pricing_snapshot (channel_id, compute_request_id, master_item_id, channel_product_id);

create index if not exists ix_pricing_snapshot_latest_pick
  on public.pricing_snapshot (
    channel_id,
    coalesce(channel_product_id, '00000000-0000-0000-0000-000000000000'::uuid),
    master_item_id,
    computed_at desc,
    created_at desc,
    snapshot_id desc
  );

-- 3) latest view recreation (deterministic tie-break)
create or replace view public.pricing_snapshot_latest
with (security_invoker = true)
as
with ranked as (
  select
    ps.*,
    row_number() over (
      partition by
        ps.channel_id,
        coalesce(ps.channel_product_id, '00000000-0000-0000-0000-000000000000'::uuid),
        ps.master_item_id
      order by
        ps.computed_at desc,
        ps.created_at desc,
        ps.snapshot_id desc
    ) as rn
  from public.pricing_snapshot ps
)
select *
from ranked
where rn = 1;
