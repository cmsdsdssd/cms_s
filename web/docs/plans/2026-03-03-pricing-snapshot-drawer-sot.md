# Pricing Snapshot Drawer SoT Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a drawer UI that shows full pricing build-up (master/base -> margin -> adjustments -> per-axis deltas -> final target) from a pinned `compute_request_id`, and make this the canonical explanation path.

**Architecture:** Keep `sales_channel_product` as write SoT and `pricing_snapshot` as compute-output SoT. UI reads pinned snapshot by `compute_request_id` and never derives explanation from mixed live tables. Base and option bulk edits stay on one page but produce a single recompute snapshot for display and push.

**Tech Stack:** Next.js App Router, React Query, Supabase (PostgREST), TypeScript.

---

### Task 1: Define Drawer Data Contract

**Files:**
- Modify: `web/docs/shopping-option-sot-contract.md`
- Create: `web/src/types/pricingSnapshot.ts`

Checklist:
- [ ] Define `PricingSnapshotExplainRow` interface with required fields:
  - `master_base_price_krw`
  - `shop_margin_multiplier`
  - `price_after_margin_krw`
  - `base_adjust_krw`
  - `delta_material_krw`, `delta_size_krw`, `delta_color_krw`, `delta_decor_krw`, `delta_other_krw`, `delta_total_krw`
  - `final_target_price_krw`, `compute_request_id`, `computed_at`
- [ ] Document invariant: `delta_total_krw = sum(axis deltas)`.

### Task 2: Add Snapshot Explain API (Pinned)

**Files:**
- Create: `web/src/app/api/channel-price-snapshot-explain/route.ts`

Checklist:
- [ ] Require query params: `channel_id`, `master_item_id`, `compute_request_id`.
- [ ] Read rows from `pricing_snapshot` only (no fallback joins for explanation values).
- [ ] Return normalized explain DTO for drawer.
- [ ] Reject missing/invalid params with 4xx.

### Task 3: Wire Drawer State and Query

**Files:**
- Modify: `web/src/app/(app)/settings/shopping/dashboard/page.tsx`

Checklist:
- [ ] Add `isSnapshotDrawerOpen`, `selectedMasterIdForDrawer` state.
- [ ] Add React Query call to `/api/channel-price-snapshot-explain` using pinned `compute_request_id`.
- [ ] Ensure drawer query is disabled unless all required ids exist.

### Task 4: Implement Drawer UI Composition

**Files:**
- Create: `web/src/components/shop/PricingSnapshotDrawer.tsx`
- Modify: `web/src/app/(app)/settings/shopping/dashboard/page.tsx`

Checklist:
- [ ] Section A: `원래 마스터가 -> 마진 곱 -> 기본 보정`.
- [ ] Section B: axis deltas table (material/size/color/decor/other/total).
- [ ] Section C: final equation line with exact numbers.
- [ ] Section D: metadata (`compute_request_id`, `computed_at`).
- [ ] Add open button near master summary panel.

### Task 5: Single-Page Save Flow Clarification

**Files:**
- Modify: `web/src/app/(app)/settings/shopping/dashboard/page.tsx`

Checklist:
- [ ] Keep one-page actions: base edit + option bulk edit.
- [ ] Save flow: `save -> recompute` (no implicit push).
- [ ] On recompute success, set pinned `compute_request_id` and refresh drawer query.

### Task 6: Push Safety Bound to Snapshot

**Files:**
- Modify: `web/src/app/api/channel-prices/push/route.ts`
- Modify: `web/src/app/(app)/settings/shopping/dashboard/page.tsx`

Checklist:
- [ ] Push action requires explicit `compute_request_id`.
- [ ] UI shows “현재 반영 기준 compute_request_id”.
- [ ] If missing pin, block push with actionable message.

### Task 7: Verification Scenarios (Must Pass)

**Files:**
- Create: `web/docs/plans/fixtures/pricing-snapshot-drawer-checklist.md`

Checklist:
- [ ] Scenario 1: size/color inputs (1k..5k) -> verify expected totals per variant.
- [ ] Scenario 2: direct-setting with no rule id -> no residual rule delta.
- [ ] Scenario 3: recompute twice, pinned id A remains stable until explicitly changed.
- [ ] Scenario 4: push with pinned compute id succeeds and verify matches.

### Task 8: Run Quality Gates

**Files:**
- N/A

Checklist:
- [ ] `lsp_diagnostics` clean for modified files.
- [ ] `npx eslint` on modified files (errors 0).
- [ ] `npm run build` success.
