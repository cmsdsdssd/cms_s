# Price Sync Pressure Policy Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep fast upward protection while replacing one-way upward ratcheting with controlled, low-noise downward corrections.

**Architecture:** Keep the current threshold unit `T = max(5000 KRW, current_price * 0.02)`. Preserve immediate upward sync and replace blanket AUTO downsync suppression with per-product pressure memory, large-drop immediate release, and short cooldown.

**Tech Stack:** Next.js App Router, Supabase PostgREST, SQL migrations, Node test runner.

---

## Recommended Policy

- Upward unit: `T = max(5000, round(current_price * 0.02))`
- Upward AUTO: if `desired - current >= T`, sync immediately
- Large downward AUTO: if `desired - current <= -2.0T`, sync immediately
- Normal downward AUTO: accumulate normalized pressure until release
- Downward release threshold: `pressure_units <= -1.25`
- Downward cooldown: `60 minutes`
- Cooldown override: allow downsync during cooldown if `desired - current <= -1.5T`
- Staleness release: if no downward sync for `12 hours` and gap is `<= -0.75T`, allow one downsync
- Downward target on release: move directly to current `desired_price_krw`

## Data Design

Create `price_sync_auto_state_v1`.

**Create:** `supabase/migrations/<timestamp>_cms_price_sync_auto_state_v1_addonly.sql`

Suggested columns:
- `channel_id`
- `channel_product_id`
- `master_item_id`
- `external_product_no`
- `external_variant_code`
- `pressure_units`
- `last_gap_units`
- `last_seen_target_krw`
- `last_seen_current_krw`
- `last_auto_sync_at`
- `last_upsync_at`
- `last_downsync_at`
- `cooldown_until`
- timestamps

Reason:
- `price_sync_run_v2` and `price_sync_intent_v2` store execution history, not reusable directional memory
- This repo already uses current-state patterns elsewhere, so a dedicated state row per product fits the codebase

## Runtime Logic

For each eligible row:

```text
T = max(5000, round(current_price * 0.02))
gap = desired_price - current_price
u = gap / T
```

Rules:
- If `u >= 1.0`, create upsync intent now
- If `u <= -2.0`, create downsync intent now
- If `u >= 0`, decay negative pressure toward zero
- If in cooldown, block downsync unless `u <= -1.5`
- Else update pressure with a damped accumulation formula
- If `pressure_units <= -1.25`, create downsync intent and reset pressure
- If no downsync for 12h and `u <= -0.75`, allow one staleness-release downsync

## Verification

Tests:
- Create: `web/tests/price-sync-pressure-policy.test.mjs`
- Modify: `web/tests/price-sync-policy.test.mjs`

Required cases:
- Upward threshold unchanged
- Intermittent down gaps accumulate pressure
- Large down gap releases immediately
- Cooldown blocks repeated downsyncs
- Cooldown override works
- Staleness release works
- Force-full sync bypass still works
- Market-gap uplift still works

Run:

```bash
node --test tests/price-sync-policy.test.mjs tests/price-sync-pressure-policy.test.mjs
npm run build
```

## Rollout

### Phase 1
- Add state table and telemetry only
- Calculate pressure and counters, but do not release downsyncs yet

### Phase 2
- Enable only large immediate downsyncs (`u <= -2.0`)

### Phase 3
- Enable full pressure-release and cooldown logic

## Minimal-change fallback

- Keep current upward rule unchanged
- Keep normal AUTO downsync suppressed
- Run force-full sync only in a low-traffic overnight window with jitter
- Do not implement fixed-step or strict-consecutive downsync

This is not the best design, but it is safer than fixed-step downsync.
## File Changes

### Core policy
- Modify: `web/src/app/api/price-sync-runs-v2/route.ts`
- Create: `web/src/lib/shop/price-sync-pressure-policy.js` or `.ts`

Changes:
- Load `price_sync_auto_state_v1` for participating `channel_product_id`s
- Replace the current `desired <= currentRounded` suppression branch with pressure-policy evaluation
- Keep `forceFullSync` as an override path
- Keep market-gap forced uplift behavior for base products

### State persistence
- Modify: `web/src/app/api/price-sync-runs-v2/[run_id]/execute/route.ts`

Changes:
- On successful upsync, update `last_upsync_at`, `last_auto_sync_at`, `last_gap_units`
- On successful downsync, update `last_downsync_at`, `cooldown_until`, reset pressure

### Summary and observability
- Modify: `web/src/lib/shop/price-sync-run-summary.js`
- Modify: `web/src/app/api/price-sync-runs-v2/route.ts`

Add counters:
- `pressure_downsync_release_count`
- `large_downsync_release_count`
- `cooldown_block_count`
- `staleness_release_count`
- `pressure_decay_count`

### UI
- Modify: `web/src/app/(app)/settings/shopping/auto-price/page.tsx`
- Add explanatory copy and new run-summary counters

