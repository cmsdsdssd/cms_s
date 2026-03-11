# Price Single SoT Fail-Closed Implementation Checklist

## Goal

Lock the shopping price system into a fail-closed mode where wrong prices are never silently pushed or displayed.

## Operating Principle

- publish rows are the only pricing truth
- live state is verification only
- snapshot/current-state may exist, but they must not become runtime pricing truth
- if publish truth is missing or inconsistent, the system must fail instead of guessing

## Workstream A - Runtime Fail-Closed

### A1. Push must require publish rows

Files:
- `web/src/app/api/channel-prices/push/route.ts`
- `web/src/lib/shop/publish-price-state.ts`

Required behavior:
- if `publish_version`/`compute_request_id` is provided, publish rows are mandatory
- if publish base/variant rows are missing, return error
- do not fall back to `pricing_snapshot_latest` or other mutable state for actual push values

Definition of done:
- push can only proceed from `product_price_publish_base_v1` and `product_price_publish_variant_v1`
- missing publish rows produce explicit errors

### A2. Run creation must require publish-backed rows

Files:
- `web/src/app/api/price-sync-runs-v2/route.ts`
- `web/src/lib/shop/publish-price-state.ts`

Required behavior:
- intent generation must reject rows that do not have matching publish rows for the selected version
- snapshot can still supply extended analytics fields, but not truth eligibility
- if publish rows are absent for the requested version, fail closed

Definition of done:
- no run item is created from snapshot alone
- publish-version mismatch prevents run creation

### A3. Storefront must be publish-only

Files:
- `web/src/app/api/public/storefront-option-breakdown/route.ts`

Required behavior:
- price display comes from publish tables only
- publish option-entry rows are mandatory
- do not backfill option-entry rows at read time
- if publish rows are missing, return explicit error

Definition of done:
- storefront never invents pricing from live variant amounts
- read path is publish-only for price values

## Workstream B - New Product Integrity

### B1. DB uniqueness for active mappings

Files:
- new migration under `supabase/migrations/`

Required constraints:
- one active base mapping per `(channel_id, master_item_id)` where `external_variant_code = ''`
- one active variant mapping per `(channel_id, master_item_id, external_variant_code)` where `external_variant_code <> ''`

Definition of done:
- duplicate active base rows are impossible
- duplicate active variant rows are impossible

### B2. API validation for mapping writes

Files:
- `web/src/app/api/channel-products/route.ts`
- `web/src/app/api/channel-products/[id]/route.ts`
- `web/src/app/api/channel-products/bulk/route.ts`
- shared helper in `web/src/lib/shop/`

Required behavior:
- reject writes that would create multiple active base rows for one `(channel_id, master_item_id)`
- reject writes that would create duplicate active variant rows
- reject writes that would introduce multiple active `external_product_no` values for the same `(channel_id, master_item_id)`

Definition of done:
- bad data is blocked before hitting the DB constraint
- error messages explain exactly which invariant was violated

## Workstream C - Response Contract Cleanup

### C1. Prefer publish_version naming

Files:
- `web/src/app/api/pricing/recompute/route.ts`
- `web/src/app/api/channel-prices/push/route.ts`
- `web/src/app/api/price-sync-runs-v2/route.ts`

Required behavior:
- runtime response payloads expose `publish_version` / `publish_versions`
- `compute_request_id` can remain only as compatibility alias

Definition of done:
- operators can follow one runtime concept: publish_version

## Verification Checklist

After implementation, verify all of the following:

1. `npx supabase db push` succeeds
2. LSP diagnostics are clean for all touched files
3. `node --test tests/price-sync-policy.test.mjs tests/single-sot-pricing.test.mjs` passes
4. `npm run build` passes
5. a recompute for one real product creates publish base, variant, and option-entry rows
6. a push using that publish version succeeds or fails explicitly without any snapshot fallback
7. storefront returns publish-driven rows or a hard error, never backfilled price guesses
