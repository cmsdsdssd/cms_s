# Price Single SoT Implementation Plan

## Goal

This document turns the single-SoT pricing blueprint into an implementation plan.

Target outcome:

- calculate pricing once
- persist one publish truth
- push only from that publish truth
- verify live Cafe24 against that same truth
- show publish truth and live verification separately in UI

## Scope

This plan assumes:

- legacy/mock data can be discarded
- new-product flow is the priority
- perfect determinism is more important than preserving backward-compatible side paths

## Phase Order

1. create publish and verification tables
2. route recompute output into publish tables
3. make push read only publish tables
4. make storefront breakdown read only publish tables
5. simplify admin UI to publish truth + live verification
6. lock new-product flow to one product identity
7. demote old current-state tables from input role to result/cache role

## SQL Migration List

### Migration 1: create publish base table

File suggestion:

- `supabase/migrations/20260311xxxx01_price_publish_base_v1.sql`

Create:

```sql
create table if not exists public.product_price_publish_base_v1 (
  channel_id uuid not null,
  master_item_id uuid not null,
  external_product_no text not null,
  published_base_price_krw integer not null check (published_base_price_krw >= 0),
  currency text not null default 'KRW',
  publish_version bigint not null,
  pricing_algo_version text not null,
  status text not null check (status in ('DRAFT','READY','PUSHED','SYNCED','VERIFY_FAILED')),
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (channel_id, master_item_id, external_product_no)
);

create unique index if not exists uq_price_publish_base_version
  on public.product_price_publish_base_v1(channel_id, master_item_id, external_product_no, publish_version);
```

### Migration 2: create publish option entry table

File suggestion:

- `supabase/migrations/20260311xxxx02_price_publish_option_entry_v1.sql`

Create:

```sql
create table if not exists public.product_price_publish_option_entry_v1 (
  channel_id uuid not null,
  master_item_id uuid not null,
  external_product_no text not null,
  option_axis_index integer not null check (option_axis_index >= 1),
  option_name text not null,
  option_value text not null,
  published_delta_krw integer not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  publish_version bigint not null,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (channel_id, master_item_id, external_product_no, option_axis_index, option_name, option_value)
);

create unique index if not exists uq_price_publish_option_entry_version
  on public.product_price_publish_option_entry_v1(
    channel_id, master_item_id, external_product_no,
    option_axis_index, option_name, option_value, publish_version
  );
```

### Migration 3: create derived variant publish table

File suggestion:

- `supabase/migrations/20260311xxxx03_price_publish_variant_v1.sql`

Create:

```sql
create table if not exists public.product_price_publish_variant_v1 (
  channel_id uuid not null,
  master_item_id uuid not null,
  external_product_no text not null,
  external_variant_code text not null,
  selected_option_entry_keys_json jsonb not null default '[]'::jsonb,
  variant_exception_delta_krw integer not null default 0,
  published_additional_amount_krw integer not null,
  published_total_price_krw integer not null,
  publish_version bigint not null,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (channel_id, master_item_id, external_product_no, external_variant_code)
);

create unique index if not exists uq_price_publish_variant_version
  on public.product_price_publish_variant_v1(
    channel_id, master_item_id, external_product_no, external_variant_code, publish_version
  );
```

### Migration 4: create live verification table

File suggestion:

- `supabase/migrations/20260311xxxx04_price_live_state_v1.sql`

Create:

```sql
create table if not exists public.product_price_live_state_v1 (
  channel_id uuid not null,
  master_item_id uuid not null,
  external_product_no text not null,
  external_variant_code text not null default '',
  publish_version bigint not null,
  live_base_price_krw integer,
  live_additional_amount_krw integer,
  live_total_price_krw integer,
  sync_status text not null check (sync_status in ('PENDING','SYNCED','VERIFY_FAILED')),
  last_error_code text,
  last_error_message text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (channel_id, master_item_id, external_product_no, external_variant_code, publish_version)
);
```

### Migration 5: create new-product integrity constraints

File suggestion:

- `supabase/migrations/20260311xxxx05_price_new_product_integrity.sql`

Add constraints:

- one active base row per product
- no duplicate option entries
- no duplicate active variant mapping per `(channel_id, master_item_id, external_variant_code)`
- fail inserts when multiple active `external_product_no` values exist for the same new-product scope

Example checks:

```sql
create unique index if not exists uq_scp_active_base_single_product_no
  on public.sales_channel_product(channel_id, master_item_id)
  where is_active = true and coalesce(btrim(external_variant_code), '') = '';

create unique index if not exists uq_scp_active_variant_single_product_no
  on public.sales_channel_product(channel_id, master_item_id, external_variant_code)
  where is_active = true and coalesce(btrim(external_variant_code), '') <> '';
```

### Migration 6: mark old side-state as result-only

File suggestion:

- `supabase/migrations/20260311xxxx06_price_side_state_demote.sql`

Goal:

- do not delete `channel_option_current_state_v1` yet
- stop treating it as pricing input
- keep it only as apply/result/cache state

Actions:

- add comments to schema
- create view aliases if needed for backward-compatible reads
- remove any future write-path dependency from push intent generation

## API Modification Order

### API 1: `POST /api/pricing/recompute`

File:

- `web/src/app/api/pricing/recompute/route.ts`

Required changes:

1. compute base once
2. compute option entry deltas once
3. derive variant additional amounts from option entries only
4. write publish tables in one transaction/version
5. stop using `channel_option_current_state_v1` as authoritative pricing output

Keep:

- cost/labor/guardrail math
- option rule engine
- size/color/decor rule resolution

Remove from authoritative output role:

- `final_target_additional_amount_krw` as push input truth
- state reuse as a pricing dependency

New response fields:

- `publish_version`
- `published_base_price_krw`
- `published_option_entries`
- `published_variant_rows`

### API 2: `POST /api/channel-prices/push`

File:

- `web/src/app/api/channel-prices/push/route.ts`

Required changes:

1. input must be pinned `publish_version`
2. read only `product_price_publish_base_v1`
3. read only `product_price_publish_variant_v1`
4. push base price
5. push variant `additional_amount`
6. read back live values immediately
7. write `product_price_live_state_v1`

Must remove:

- push-time price derivation from dashboard rows
- push-time override sourcing from `channel_option_current_state_v1`
- mapping repair inside push execution
- verify-pending-as-success behavior

New status model:

- `PUSHED_PENDING_VERIFY`
- `SYNCED`
- `VERIFY_FAILED`

### API 3: `POST /api/price-sync-runs-v2`

Files:

- `web/src/app/api/price-sync-runs-v2/route.ts`
- `web/src/app/api/price-sync-runs-v2/[run_id]/execute/route.ts`

Required changes:

1. generate run items from publish version, not mutable current-state
2. store publish version on every run item
3. execution result must distinguish:
 
   - `SUCCEEDED`
   - `SKIPPED`
   - `VERIFY_FAILED`
   - `FAILED`
4. never downgrade `SKIPPED` into `FAILED`

### API 4: `GET /api/public/storefront-option-breakdown`

File:

- `web/src/app/api/public/storefront-option-breakdown/route.ts`

Required changes:

1. stop reading live Cafe24 variants as the main source
2. stop reverse-engineering first-axis/second-axis deltas from combinations
3. read `product_price_publish_option_entry_v1`
4. return publish deltas directly
5. optionally add live verification block from `product_price_live_state_v1`

Keep only as optional metadata:

- `resolved_product_no`
- live mismatch warning

### API 5: `GET /api/channel-products/variants`

File:

- `web/src/app/api/channel-products/variants/route.ts`

Required changes:

- make this a diagnostic endpoint only
- label fields as `publish`, `live`, `legacy-state`
- never present `legacy-state` as the main truth block

## UI Change Matrix

### Screen: auto-price / dashboard

Files likely involved:

- `web/src/app/(app)/settings/shopping/auto-price/page.tsx`
- `web/src/app/(app)/settings/shopping/dashboard/page.tsx`
- `web/src/components/shop/*`

#### Keep

- published base price
- published option entry delta
- published variant total
- live base price
- live variant additional amount
- sync status
- publish version
- compute request id

#### Remove from primary display

- raw delta
- resolved delta
- sync delta
- final target additional amount
- storefront-derived delta
- heuristic axis residual explanation
- canonical alias candidate display in normal operator view

#### Move to advanced/debug only

- labor-rule bucket breakdown
- material/color/decor intermediate deltas
- legacy current-state rows
- resolved product_no diagnostics

### Screen: product detail / snapshot drawer

Keep:

- final published price
- published option entries
- live verification comparison

Remove from default view:

- mixed-source option blocks where one table is computed and another is live-derived

### Screen: storefront helper script

File:

- `web/public/storefront-option-breakdown.js`

Keep:

- DOM patching behavior
- suffix rendering

Change:

- consume direct publish deltas from API
- stop trusting live-reconstructed breakdown values as pricing truth

## Identity Rules

For perfect SoT behavior, these are mandatory:

1. one new product gets one `external_product_no`
2. no canonical preference logic in new-product flow
3. if duplicate active mappings exist, fail fast
4. if Cafe24 resolves a different product_no than requested, verification must fail loudly
5. no silent repair during push

## Exact File-Level Worklist

### Must change first

- `web/src/app/api/pricing/recompute/route.ts`
- `web/src/app/api/channel-prices/push/route.ts`
- `web/src/app/api/public/storefront-option-breakdown/route.ts`

### Must change second

- `web/src/app/api/price-sync-runs-v2/route.ts`
- `web/src/app/api/price-sync-runs-v2/[run_id]/execute/route.ts`
- `web/public/storefront-option-breakdown.js`

### Must constrain or isolate

- `web/src/lib/shop/canonical-mapping.ts`
- `web/src/lib/shop/cafe24.ts`
- `web/src/app/api/channel-products/variants/route.ts`
- `web/src/app/api/channel-option-categories/rebuild/route.ts`

## Acceptance Criteria

A rollout is complete only when all are true:

1. recompute writes one publish version that fully describes base and option truth
2. push reads only that publish version
3. storefront breakdown returns only that publish version's option deltas
4. live verification is recorded against that same publish version
5. admin UI clearly separates publish truth from live verification
6. new-product flow cannot create multi-product identity drift
7. no live reverse-engineering path remains in the critical pricing flow

## Recommended Execution Sequence

1. ship DB tables and version model
2. update recompute writer
3. update push reader + strict verify
4. update public storefront breakdown
5. update admin UI labels and field visibility
6. disable old side-state as input
7. run new-product-only rollout behind feature flag

## Risks To Watch

- existing duplicate mappings will surface immediately once silent canonical repair is removed
- verify failures will temporarily increase because `verify_pending` will stop counting as success
- any consumer expecting live-derived storefront payloads may need a transitional response shape

## Minimum Non-Negotiable Set

If time is limited, these are the must-have changes for correctness:

1. push must stop reading mutable current-state as pricing truth
2. storefront breakdown must stop reconstructing deltas from live variants
3. new-product flow must use exactly one product identity
4. verify-pending must stop counting as success
