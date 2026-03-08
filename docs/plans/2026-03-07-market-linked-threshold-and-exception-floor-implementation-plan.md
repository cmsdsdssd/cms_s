# Implementation Plan: Market-Linked Threshold and Manual Exception Floor

- Document version: v1.0
- Date: 2026-03-07
- Status: Ready to implement
- Depends on: `docs/plans/2026-03-07-market-linked-threshold-and-exception-floor-prd.md`, `docs/plans/2026-03-07-market-linked-threshold-and-exception-floor-erd-delta.md`

---

## Goal

Implement the next sync-policy phase without changing Pricing V2 recompute math.

1. Split sync threshold behavior into `GENERAL` and `MARKET_LINKED`.
2. Keep downsync on the existing pressure and cooldown path.
3. Apply manual exception floor only in the sync decision layer.
4. Keep manual override as the highest-precedence operator control.
5. Expose enough UI and debug context to explain why an intent price was chosen.

## Non-Goals

- no rewrite of `pricing/recompute`
- no automatic inventory-cost floor engine
- no metal-tier or weight-tier matrix
- no defaulting all market-linked SKUs to `always_sync=true`

## Current-Code Baseline

### Runtime facts already true

- `web/src/lib/shop/price-sync-policy.js` already resolves `max(min_change_krw, current_price * min_change_rate)`.
- `web/src/app/api/price-sync-runs-v2/route.ts` already compares `current_price_krw` vs desired sync price.
- `web/src/app/api/price-sync-runs-v2/route.ts` already uses `evaluateAutoSyncPressurePolicy()` for downsync gating.
- `web/src/app/api/channel-floor-guards/route.ts` already stores active `product_price_guard_v2.floor_price_krw`.
- `web/src/app/api/pricing-overrides/route.ts` already stores manual explicit final price overrides.

### Gaps to close in this phase

- no threshold-profile concept yet for `GENERAL` vs `MARKET_LINKED`
- no sync-layer read and apply of manual floor during intent creation
- no explicit override then floor then target precedence in the main auto-sync run path
- no stable API and UI field exposing threshold profile choice
- run detail and debug output do not yet explain when override or floor changed the final desired price

## Target Behavior

### Threshold profiles

- `GENERAL`
  - `min_change_krw = 5000`
  - `min_change_rate = 0.02`
- `MARKET_LINKED`
  - `min_change_krw = 500`
  - `min_change_rate = 0.005`

### Decision order

For each candidate sync row:

1. start from recomputed `final_target_price_v2_krw`
2. apply existing market forced uplift logic if it raises the desired price
3. apply active manual override if present
4. clamp upward to manual exception floor if desired price is below floor
5. evaluate threshold
6. if move is down, still pass through existing pressure and cooldown rules
7. create intent and task only if the final desired price survives threshold and pressure rules

### Semantic rules

- override and floor both mean final channel selling price KRW
- floor never rewrites snapshot target columns
- `floor_applied=true` means the sync-layer desired price was raised by floor
- `always_sync` remains opt-in and separate from threshold profile

## Workstreams

## 1. Persistence and API contract

### Add threshold-profile storage on `pricing_policy`

Add one additive field on `pricing_policy`:

- `auto_sync_threshold_profile`
  - allowed values: `GENERAL`, `MARKET_LINKED`
  - default: `GENERAL`

Why:

- the profile belongs to sync policy, not recompute output
- it keeps the rollout channel-scoped and small
- it avoids introducing per-SKU classification in this phase

### Update pricing policy API

Patch `web/src/app/api/pricing-policies/route.ts` so GET and POST include:

- `auto_sync_force_full`
- `auto_sync_min_change_krw`
- `auto_sync_min_change_rate`
- `auto_sync_threshold_profile`

Validation:

- reject unknown profile values
- if profile is missing on older rows, treat as `GENERAL`
- preserve explicit per-policy raw threshold values during transition

### Migration shape

Create one additive migration that:

1. adds `auto_sync_threshold_profile`
2. backfills existing rows to `GENERAL`
3. optionally adds a simple check constraint for allowed values

Do not delete existing `auto_sync_min_change_krw` or `auto_sync_min_change_rate` in this phase.

## 2. Runtime policy resolution

### Extend sync policy helper

Update `web/src/lib/shop/price-sync-policy.js`:

- introduce profile constants for `GENERAL` and `MARKET_LINKED`
- add a resolver that maps profile to `{ min_change_krw, min_change_rate }`
- keep existing `normalizePriceSyncPolicy()` and `shouldSyncPriceChange()` intact where possible

Preferred structure:

- `DEFAULT_PRICE_SYNC_THRESHOLD_PROFILE = "GENERAL"`
- `PRICE_SYNC_THRESHOLD_PROFILE_PRESETS = { GENERAL: {...}, MARKET_LINKED: {...} }`
- helper like `resolvePriceSyncPolicyFromProfile({ profile, always_sync, overrides })`

### Read profile in run creation path

Patch `web/src/app/api/price-sync-runs-v2/route.ts`:

- include `auto_sync_threshold_profile` in the `pricing_policy` query
- normalize it once near `normalizeAutoSyncPolicy`
- if request body explicitly overrides min-change values, allow them to win for manual runs
- otherwise derive min-change values from profile preset

Recommended precedence:

1. request-level explicit `min_change_krw` and `min_change_rate` for ad hoc manual run
2. profile preset from `auto_sync_threshold_profile`
3. legacy stored raw `auto_sync_min_change_*` as transition fallback
4. global default `GENERAL`

## 3. Manual override and manual floor in run assembly

### Load active override and floor rows once per run

Patch `web/src/app/api/price-sync-runs-v2/route.ts` to read active rows for the current channel and target master items from:

- `pricing_override`
- `product_price_guard_v2`

Build maps keyed by `master_item_id`.

### Resolve effective desired price per row

In the intent assembly loop:

1. compute base desired from snapshot target
2. apply market forced uplift logic already in place
3. if active override exists, replace desired with `override_price_krw`
4. if active floor exists, set `desired = max(desired, floor_price_krw)`
5. record metadata for explainability

Suggested in-memory metadata per row:

- `snapshot_desired_price_krw`
- `override_price_krw`
- `floor_price_krw`
- `effective_desired_price_krw`
- `desired_price_source`

### Dedupe behavior

Keep the current dedupe strategy that preserves the maximum desired price for the same logical target.

Rationale:

- it is already commercially safer
- floor and override are also upward-protective in practice
- changing dedupe semantics now would widen rollout risk

Update dedupe metadata so `floor_applied` remains true if any merged row was floor-clamped.

## 4. Run detail and explainability

### Persist reason context if schema expansion is acceptable

Preferred option:

- add an additive JSON field on `price_sync_intent_v2`, such as `decision_context_json`

Store compact context such as:

- snapshot desired price
- override price if used
- floor price if used
- effective desired price
- threshold profile
- threshold numbers
- pressure result summary for downsync cases

If that is too much for this phase, at minimum enrich run summary and detail response from in-memory values before insert.

### Update run detail API

Patch `web/src/app/api/price-sync-runs-v2/[run_id]/route.ts` to expose:

- `snapshot_desired_price_krw`
- `effective_desired_price_krw`
- `override_price_krw` when used
- `floor_price_krw` and `floor_applied`
- profile and threshold values from run summary

## 5. Settings and operator UI

### Auto-price policy section

Update `web/src/app/(app)/settings/shopping/auto-price/page.tsx`:

- add threshold-profile control with two choices: `GENERAL`, `MARKET_LINKED`
- keep existing `always_sync` checkbox default off
- keep raw threshold inputs only if they are still needed for debugging or transition

Recommended UX:

- primary control is profile select
- secondary text shows effective rule
  - `GENERAL: max(5,000 KRW, 2 percent of current selling price)`
  - `MARKET_LINKED: max(500 KRW, 0.5 percent of current selling price)`

### Preview and explain surfaces

In the snapshot preview or run preview area, show when present:

- snapshot target
- override price
- exception floor
- effective desired sync price
- sync threshold profile

### Floor management copy hardening

Wherever floor is created or edited, add helper text that says floor is based on final selling price KRW.

## 6. Backward compatibility and rollout

### Safe rollout order

1. ship migration and pricing policy API support
2. ship runtime profile resolution with fallback to old raw thresholds
3. ship manual override and floor application in run path
4. ship UI for profile selection and clearer floor wording
5. backfill selected channels to `MARKET_LINKED` only where explicitly desired

### Rollback posture

- if market-linked proves too chatty, switch affected channel back to `GENERAL`
- if manual floor causes confusion, deactivate the guard row
- no destructive rollback is needed because all changes are additive

## 7. Test plan

### Unit tests

Update or add tests around `web/src/lib/shop/price-sync-policy.js`:

- `GENERAL` preset resolves to `5000 + 2 percent`
- `MARKET_LINKED` preset resolves to `500 + 0.5 percent`
- explicit request override beats profile preset
- `always_sync=true` still bypasses threshold

Extend `web/tests/price-sync-policy.test.mjs` for these cases.

### Route and runtime tests

Add focused coverage for `price-sync-runs-v2` behavior:

- snapshot target below threshold means no intent for `GENERAL`
- same row above threshold means intent for `MARKET_LINKED`
- override replaces snapshot target
- floor clamps desired price upward
- downsync still blocked by pressure policy even with `MARKET_LINKED`
- upsync caused by floor still goes through threshold logic with final desired price

### Manual verification

On the auto-price page:

1. save `GENERAL`, verify UI reload shows preset values
2. save `MARKET_LINKED`, verify run summary shows `500` and `0.5 percent`
3. add manual floor for one SKU, run sync, verify desired price clamps upward
4. add manual override for same SKU, verify override beats floor
5. inspect run detail, verify operator can tell why the final price was chosen

## 8. Files expected to change

### Runtime

- `web/src/lib/shop/price-sync-policy.js`
- `web/src/app/api/price-sync-runs-v2/route.ts`
- `web/src/app/api/price-sync-runs-v2/[run_id]/route.ts`

### API and settings

- `web/src/app/api/pricing-policies/route.ts`
- `web/src/app/api/channel-floor-guards/route.ts`
- `web/src/app/(app)/settings/shopping/auto-price/page.tsx`

### Persistence

- new migration under `supabase/migrations/`

### Tests

- `web/tests/price-sync-policy.test.mjs`
- additional runtime test file if needed

## 9. Acceptance checklist

- `GENERAL` and `MARKET_LINKED` are selectable and persisted
- runtime derives the correct threshold preset from the selected profile
- manual override beats floor
- manual floor only clamps final selling price upward in sync layer
- recompute output remains unchanged
- downsync still depends on pressure and cooldown policy
- run detail explains snapshot vs effective desired price
- existing channels without the new field still behave as `GENERAL`

## 10. Recommended implementation sequence

1. add migration and pricing policy API support
2. refactor `price-sync-policy.js` to support profile presets
3. patch `price-sync-runs-v2/route.ts` to resolve profile, override, and floor
4. enrich run detail response for debug visibility
5. patch auto-price settings UI
6. run tests, type or build verification, and one manual operator flow
