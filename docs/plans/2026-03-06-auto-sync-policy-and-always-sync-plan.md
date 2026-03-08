# Auto Sync Policy And Always Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a persisted auto-sync policy that supports rule-based syncing with a hybrid threshold (`max(min_change_krw, current_price * min_change_rate)`) and a default-off `always sync` mode that forces full push every 5 minutes.

**Architecture:** Store the channel-level sync policy on the active `pricing_policy` row so the existing auto-price page can load and save it with the rest of the pricing configuration. Extract threshold decision logic into a reusable helper, use it in `price-sync-runs-v2`, and have the cron route honor the persisted `always sync` flag by setting `force_full_sync` automatically.

**Tech Stack:** Next.js App Router, React client components, TanStack Query, Supabase PostgREST, SQL migrations, Node test runner.

---

### Task 1: Extend pricing policy persistence for auto-sync settings

**Files:**
- Create: `supabase/migrations/20260306190000_cms_1122_pricing_policy_auto_sync_settings_addonly.sql`
- Modify: `web/src/app/api/pricing-policies/route.ts`
- Modify: `web/src/app/api/pricing-policies/[id]/route.ts`

**Steps:**
1. Add migration columns on `public.pricing_policy` for `auto_sync_force_full boolean not null default false`, `auto_sync_min_change_krw integer not null default 5000`, and `auto_sync_min_change_rate numeric(12,6) not null default 0.010000`.
2. Add SQL constraints so amount is non-negative and rate is between `0` and `1` inclusive.
3. Extend pricing policy GET/POST/PUT selects and payload validation to round/store the new values.
4. Keep backward compatibility for rows created before the migration by relying on defaults and DB-side initialization.

### Task 2: Extract and test reusable auto-sync policy logic

**Files:**
- Create: `web/src/lib/shop/price-sync-policy.js`
- Create: `web/tests/price-sync-policy.test.mjs`

**Steps:**
1. Write failing tests for rule-based threshold resolution, always-sync bypass behavior, and validation fallbacks.
2. Implement helper functions to normalize persisted policy values and compute the effective threshold as `max(min_change_krw, round(current_price * min_change_rate))`.
3. Add a helper that returns whether a row should be filtered, forced, or downsync-suppressed under AUTO mode.
4. Re-run the targeted test file until it passes.

### Task 3: Use persisted policy in run creation and cron execution

**Files:**
- Modify: `web/src/app/api/price-sync-runs-v2/route.ts`
- Modify: `web/src/app/api/cron/shop-sync-v2/route.ts`

**Steps:**
1. Replace the hard-coded env-first threshold handling in run creation with active policy loading from `pricing_policy`.
2. Persist the resolved mode and threshold summary into `request_payload.summary` so the UI and history remain explainable.
3. In AUTO mode, apply rule-based filtering with the new hybrid threshold helper; when `always sync` is enabled, bypass threshold/downsync suppression by treating the run as `force_full_sync`.
4. Update cron run creation so the persisted `always sync` setting automatically forces every scheduled run without requiring manual request flags.

### Task 4: Add UI controls in auto-price page

**Files:**
- Modify: `web/src/app/(app)/settings/shopping/auto-price/page.tsx`

**Steps:**
1. Extend the `PricingPolicy` type and save payloads with the new sync-policy fields.
2. Add `min change amount` and `min change rate` inputs to the pricing policy card so rule-based thresholds are editable.
3. Add a default-off `무조건 동기화` checkbox beside `도금공임 포함` in the preview drawer header, bound to the persisted active policy.
4. Save the checkbox immediately through the pricing policy mutation and surface loading/error state without breaking the existing preview interactions.
5. Show the resolved current policy in the run summary area so users can see whether a run used rule-based or always-sync behavior.

### Task 5: Verification and regression coverage

**Files:**
- Verify: `web/src/app/api/pricing-policies/route.ts`
- Verify: `web/src/app/api/pricing-policies/[id]/route.ts`
- Verify: `web/src/app/api/price-sync-runs-v2/route.ts`
- Verify: `web/src/app/api/cron/shop-sync-v2/route.ts`
- Verify: `web/src/app/(app)/settings/shopping/auto-price/page.tsx`
- Verify: `web/tests/price-sync-policy.test.mjs`

**Steps:**
1. Run LSP diagnostics on all touched TS/TSX files and fix every reported error.
2. Run `node --test tests/price-sync-policy.test.mjs` in `web/`.
3. Run `npm run lint` in `web/`.
4. Run `npm run build` in `web/`.
5. Confirm final defaults: `always sync = false`, `min_change_krw = 5000`, `min_change_rate = 0.01`.
