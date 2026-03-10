# Market-Linked Weight Option Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace static SIZE option deltas with market-linked computed option-additional amounts while preserving current central rule authority, current mapping/detail contracts, and a separate sync policy for option additional amounts.

**Architecture:** Keep `channel_option_labor_rule_v1` as the authority for SIZE scope and behavior, but stop treating `additive_delta_krw` as the long-term source of SIZE amounts. Add a derived computed weight grid cache keyed by `channel_id + master_item_id + material_code + weight_g`, generated from material market inputs and SIZE rule config. Introduce one shared SIZE resolver used by mapping/detail/recompute, and add a separate option-additional threshold policy for push decisions so base selling price sync policy remains unchanged.

**Tech Stack:** Next.js API routes, TypeScript/JavaScript business logic, Supabase/Postgres migrations, admin settings UI, Cafe24 push flow

---

## 1. Design Summary

### 1.1 What changes

- Today SIZE resolves from stored KRW deltas on `channel_option_labor_rule_v1`.
- After this change, SIZE resolves from a market-linked computed grid.
- Rules define how to compute the grid, not the final KRW per cell.
- Mapping/detail/recompute all read the same resolved SIZE amount.
- Push compares option additional amounts with an option-only threshold policy.

### 1.2 What does not change

- Base product selling price recompute stays as-is.
- Base product sync threshold profile (`GENERAL`, `MARKET_LINKED`) stays separate.
- `channel_option_current_state_v1` remains push/apply state, not rule authority.
- COLOR, DECOR, OTHER keep current contracts in this phase.

### 1.3 Non-negotiable principles

- `channel_option_labor_rule_v1` remains the authority for SIZE rule scope.
- The computed weight grid is derived cache only, never the business source of truth.
- SIZE `axis3` is display-only resolved reference amount, not a user-entered source field.
- One shared SIZE resolver must be used by mapping/detail/recompute.
- Option-additional sync threshold is independent from base selling price threshold.

---

## 2. Current-State Grounding

- Material market pricing already exists in `web/src/lib/material-factors.ts` and `web/src/app/api/pricing/recompute/route.ts`.
- SIZE options are currently expanded/resolved in multiple places:
  - allowlist building in `web/src/lib/shop/mapping-option-details.ts`
  - central option resolution in `web/src/lib/shop/channel-option-central-control.js`
  - pricing recompute in `web/src/app/api/pricing/recompute/route.ts`
- Option push/apply state lives in `channel_option_current_state_v1` and is written by `web/src/app/api/channel-prices/push/route.ts`.
- Base selling price sync thresholds are handled in `web/src/lib/shop/price-sync-policy.js` and `web/src/app/api/price-sync-runs-v2/route.ts`.
- `Option Central Control v2` already treats SIZE as:
  - `axis1 = material`
  - `axis2 = allowed weight`
  - `axis3 = resolved reference amount (read only)`
  - `price = resolved amount from matched SIZE rule set`

---

## 3. Proposed Domain Model

### 3.1 Rule authority table

Keep `channel_option_labor_rule_v1`, but extend SIZE semantics.

For `category_key = 'SIZE'`, the rule row becomes:

- scope
  - `channel_id`
  - `master_item_id`
  - `external_product_no` effective product scope key
  - `scope_material_code`
- range
  - `additional_weight_min_g`
  - `additional_weight_max_g`
- pricing mode
  - `size_price_mode` enum: `MARKET_LINKED`, `FIXED_DELTA`
- market-linked config
  - `rounding_unit_krw`
  - `rounding_mode` enum: `UP`, `NEAREST`, `DOWN`
  - `formula_offset_krw` default `0`
  - `formula_multiplier` default `1`
- fixed fallback config
  - `fixed_delta_krw` nullable
- ops metadata
  - `is_active`
  - `note`

### 3.2 Derived weight grid cache

Add one additive derived cache table:

- `channel_option_weight_grid_v1`

Columns:

- identity
  - `grid_id`
  - `channel_id`
  - `master_item_id`
  - `external_product_no`
  - `material_code`
  - `weight_g`
- computed result
  - `computed_delta_krw`
  - `computed_formula_mode`
  - `computed_source_rule_id`
- snapshots used to derive the value
  - `price_basis_resolved`
  - `effective_tick_krw_g`
  - `purity_rate_resolved`
  - `adjust_factor_resolved`
  - `formula_multiplier_applied`
  - `formula_offset_krw_applied`
  - `rounding_unit_krw_applied`
  - `rounding_mode_applied`
  - `tick_snapshot_at`
  - `computed_at`
- audit
  - `computation_version`
  - `invalidated_reason`

Unique key:

- `channel_id + master_item_id + external_product_no + material_code + weight_g`

Resolver scope rule:

- build and read grid rows in `external_product_no` product context
- if no active scoped SIZE rows exist for that product context, reuse current recompute semantics and fall back to master-shared active rows for the same `master_item_id`

### 3.3 Why a separate grid table

- UI allowlist and read-only amount preview need fast lookup.
- recompute should not recalculate every weight cell per product row.
- push needs stable comparison input for option additional amounts.
- The grid must still be explicitly derived from rules and market inputs.

### 3.4 Rule-to-grid contract

This must be explicit to avoid ambiguity.

For one SIZE cell (`material_code`, `weight_g`):

1. Resolve the effective SIZE rule set in product context first, then master fallback.
2. Select the single effective SIZE rule row whose range contains the weight.
3. If more than one active row matches, treat it as configuration error for that cell.
4. If `size_price_mode = FIXED_DELTA`, `computed_delta_krw = fixed_delta_krw` after rounding normalization.
5. If `size_price_mode = MARKET_LINKED`, compute from market formula.
6. Do not sum multiple SIZE rows under the new market-linked contract.

Reason:

- Current additive accumulation works for static labor deltas.
- Market-derived SIZE amounts need one authoritative rule per cell.
- Overlapping active SIZE rows should become invalid configuration, not additive market math.

---

## 4. Market-Linked SIZE Formula Contract

### 4.1 Formula

For `MARKET_LINKED` SIZE rows:

```text
raw_delta_krw = additional_weight_g
              * effective_tick_krw_g
              * purity_rate_resolved
              * adjust_factor_resolved
              * formula_multiplier

offset_applied_krw = raw_delta_krw + formula_offset_krw

computed_delta_krw = round_by_rule(offset_applied_krw, rounding_unit_krw, rounding_mode)
```

### 4.2 Input sources

- `effective_tick_krw_g`: same material basis logic already used by `pricing/recompute`
- `purity_rate_resolved`: same material config resolution already used by `pricing/recompute`
- `adjust_factor_resolved`: same material config resolution already used by `pricing/recompute`
- `additional_weight_g`: SIZE weight cell value itself

### 4.3 Edge-case rules

- If `price_basis = NONE`, SIZE market-linked computation is invalid for that material.
- If purity or adjust factor is missing, mark the cell invalid and exclude it from selectable SIZE values.
- `0.00g` always resolves to `0 KRW`.
- Weight values are normalized to centigram precision (`0.01g`).
- Grid cells are materialized at centigram precision (`0.01g`) in v1.
- Rounding is applied after full formula and offset.

---

## 5. Shared Resolver Contract

Create one shared resolver module for SIZE, for example:

- `web/src/lib/shop/market-linked-size-grid.ts`

Required functions:

- `buildWeightGridForRuleScope(args)`
- `lookupResolvedSizeAmount(args)`
- `validateSizeRuleCoverage(args)`
- `invalidateWeightGrid(args)`

All consumers must use this shared module:

- `web/src/lib/shop/mapping-option-details.ts`
- `web/src/lib/shop/channel-option-central-control.js`
- `web/src/app/api/pricing/recompute/route.ts`

No consumer may re-implement SIZE amount logic locally after this migration.

---

## 6. UI Design

### 6.1 Rules page

Modify `web/src/app/(app)/settings/shopping/rules/page.tsx`.

Change SIZE editor from static KRW delta entry to formula-config entry.

For each SIZE rule row, show:

- material
- min weight
- max weight
- step
- price mode (`MARKET_LINKED` or `FIXED_DELTA`)
- multiplier
- offset
- rounding unit
- rounding mode
- active toggle
- note

Add a preview grid panel:

- selected material
- list of weight values backed by `0.01g` centigram cells
- computed resolved amount
- formula snapshots used
- invalid cells highlighted

UI note:

- preserve the current banded editor feel from `0.05g` page buckets where helpful
- do not make `0.05g` a persisted rule semantic in v1

### 6.2 Mapping/detail UI

Keep SIZE contract:

- `axis1`: material
- `axis2`: allowed weight values
- `axis3`: read-only resolved amount from the shared grid

Important:

- `axis3` is not saved as the source of truth for SIZE.
- Persist only material selection and weight selection.
- Re-resolve amount from the grid whenever preview/detail is loaded.

### 6.3 Validation UX

Block save when:

- selected weight has no valid computed grid cell
- overlapping SIZE rules produce ambiguous cells
- required material factor input is missing

---

## 7. Recompute Design

### 7.1 Scope

Base product price recompute remains the same.

What changes is how SIZE option delta is resolved.

### 7.2 New flow

In `web/src/app/api/pricing/recompute/route.ts`:

1. Load material factor config and ticks as today.
2. Load active SIZE rules.
3. Ensure the derived weight grid for affected scopes is fresh.
4. For each product/variant row, resolve SIZE amount from the shared grid.
5. Store resolved SIZE delta into snapshot/bucket fields using the shared value.

### 7.3 Invalidation triggers

The weight grid must be recomputed when any of these changes:

- SIZE rule row create/update/delete
- material factor config change
- market tick change
- formula version change
- relevant channel pricing policy that affects option computation
- manual force-rebuild action

### 7.4 Recompute granularity

Do not rebuild the entire channel by default.

Rebuild the minimal affected scope:

- `channel_id`
- `master_item_id`
- `external_product_no`
- `material_code`

---

## 8. Push and Sync Policy Design

### 8.1 Separation of concerns

There are now two independent sync policies.

- base selling price sync policy
- option additional amount sync policy

These must not share threshold presets by accident.

### 8.2 Option additional threshold policy

Add one option-only policy shape, for example on pricing policy or option settings:

- `option_sync_always_sync`
- `option_sync_min_change_krw`
- `option_sync_min_change_rate`

Default proposal from user intent:

- `option_sync_min_change_krw = 1000`
- `option_sync_min_change_rate = 0.01`

### 8.3 Comparison contract

Compare:

- `target_option_additional_amount_krw`
- `last_pushed_additional_amount_krw`

Rule:

```text
passes if
abs(diff_krw) >= option_sync_min_change_krw
OR
abs(diff_krw) >= abs(reference_amount) * option_sync_min_change_rate
```

Reference amount rule:

- if last pushed additional amount is non-zero, use that as percentage base
- if last pushed additional amount is zero, percent rule is ignored and KRW threshold only applies

### 8.4 Push behavior

In `web/src/app/api/price-sync-runs-v2/route.ts`:

- evaluate base price threshold as today for product price
- evaluate option threshold separately for variant additional amount
- if base price does not need sync but option additional amount does, still create option push intent
- preserve existing mismatch recovery behavior for stale current state

In `web/src/app/api/channel-prices/push/route.ts`:

- push the resolved variant additional amount
- verify the pushed additional amount
- write back current state

---

## 9. Persistence Changes

### 9.1 Migration A: SIZE rule schema extension

**Files:**
- Create: `supabase/migrations/20260309xxxxxx_market_linked_size_rule_fields_addonly.sql`
- Modify: `web/src/lib/shop/option-labor-rules.ts`
- Modify: `web/src/app/api/option-labor-rules/route.ts`
- Test: `web/src/lib/shop/__tests__/option-labor-rules.test.ts`

Additive columns on `channel_option_labor_rule_v1` for SIZE only:

- `size_price_mode`
- `formula_multiplier`
- `formula_offset_krw`
- `rounding_unit_krw`
- `rounding_mode`
- `fixed_delta_krw`

### 9.2 Migration B: derived weight grid cache

**Files:**
- Create: `supabase/migrations/20260309xxxxxx_channel_option_weight_grid_v1_addonly.sql`
- Test: `web/src/lib/shop/__tests__/market-linked-size-grid.test.ts`

Create `channel_option_weight_grid_v1` with indexes for:

- scope lookup
- stale row invalidation
- per-material weight lookup

### 9.3 Migration C: option sync policy fields

**Files:**
- Create: `supabase/migrations/20260309xxxxxx_option_additional_sync_policy_addonly.sql`
- Modify: `web/src/app/api/pricing-policies/route.ts`
- Modify: `web/src/lib/shop/price-sync-policy.js`
- Test: `web/src/lib/shop/__tests__/option-sync-policy.test.ts`

Add additive fields for option-only sync threshold settings.

---

## 10. Implementation Tasks

### Task 1: Extend SIZE rule schema and API

**Files:**
- Create: `supabase/migrations/20260309xxxxxx_market_linked_size_rule_fields_addonly.sql`
- Modify: `web/src/lib/shop/option-labor-rules.ts`
- Modify: `web/src/app/api/option-labor-rules/route.ts`
- Test: `web/src/lib/shop/__tests__/option-labor-rules.test.ts`

**Step 1: Write the failing tests**

Add cases for:

- valid `MARKET_LINKED` SIZE row
- valid `FIXED_DELTA` SIZE row
- reject overlapping active SIZE rows in same scope
- reject missing rounding config for market-linked rows

**Step 2: Run test to verify it fails**

Run: `pnpm test -- option-labor-rules`

**Step 3: Write minimal implementation**

- extend types
- extend API validation
- keep non-SIZE categories unchanged

**Step 4: Run test to verify it passes**

Run: `pnpm test -- option-labor-rules`

### Task 2: Add derived weight grid builder and lookup

**Files:**
- Create: `web/src/lib/shop/market-linked-size-grid.ts`
- Create: `web/src/lib/shop/__tests__/market-linked-size-grid.test.ts`
- Modify: `web/src/lib/material-factors.ts`

**Step 1: Write the failing tests**

Add cases for:

- `925` material grid build
- rounding up to `100 KRW`
- zero-weight resolves to zero
- missing factor config marks invalid
- fixed delta mode bypasses market formula

**Step 2: Run test to verify it fails**

Run: `pnpm test -- market-linked-size-grid`

**Step 3: Write minimal implementation**

- shared formula helpers
- grid row builder
- lookup by scope/material/weight

**Step 4: Run test to verify it passes**

Run: `pnpm test -- market-linked-size-grid`

### Task 3: Switch mapping/detail to shared SIZE resolver

**Files:**
- Modify: `web/src/lib/shop/mapping-option-details.ts`
- Modify: `web/src/lib/shop/channel-option-central-control.js`
- Modify: `web/src/app/api/channel-products/variants/route.ts`
- Test: `web/src/lib/shop/__tests__/mapping-option-details.test.ts`

**Step 1: Write the failing tests**

Add cases for:

- SIZE axis2 weight list filtered by valid grid cells
- SIZE axis3 resolves read-only amount from grid
- invalid grid cell blocks mapping resolution

**Step 2: Run test to verify it fails**

Run: `pnpm test -- mapping-option-details`

**Step 3: Write minimal implementation**

- replace local SIZE amount logic with shared lookup
- preserve existing COLOR/DECOR/OTHER behavior

**Step 4: Run test to verify it passes**

Run: `pnpm test -- mapping-option-details`

### Task 4: Switch pricing recompute to shared SIZE resolver

**Files:**
- Modify: `web/src/app/api/pricing/recompute/route.ts`
- Modify: `web/src/types/pricingSnapshot.ts`
- Test: `web/src/app/api/pricing/__tests__/recompute-size-grid.test.ts`

**Step 1: Write the failing tests**

Add cases for:

- recompute uses grid amount, not legacy `additive_delta_krw`
- affected scopes rebuild grid when stale
- invalid SIZE grid marks row unresolved

**Step 2: Run test to verify it fails**

Run: `pnpm test -- recompute-size-grid`

**Step 3: Write minimal implementation**

- load shared resolver
- inject resolved SIZE amount into option buckets
- preserve non-SIZE buckets unchanged

**Step 4: Run test to verify it passes**

Run: `pnpm test -- recompute-size-grid`

### Task 5: Add option-only sync policy and intent evaluation

**Files:**
- Modify: `web/src/lib/shop/price-sync-policy.js`
- Modify: `web/src/app/api/pricing-policies/route.ts`
- Modify: `web/src/app/api/price-sync-runs-v2/route.ts`
- Test: `web/src/lib/shop/__tests__/option-sync-policy.test.ts`

**Step 1: Write the failing tests**

Add cases for:

- base threshold untouched
- option threshold uses `1000 KRW or 1%`
- zero last-pushed amount uses KRW threshold only
- option-only delta can create push intent even if base price is below threshold

**Step 2: Run test to verify it fails**

Run: `pnpm test -- option-sync-policy`

**Step 3: Write minimal implementation**

- introduce option-specific threshold evaluator
- add policy persistence fields
- evaluate option intent independently

**Step 4: Run test to verify it passes**

Run: `pnpm test -- option-sync-policy`

### Task 6: Update rules UI and preview grid

**Files:**
- Modify: `web/src/app/(app)/settings/shopping/rules/page.tsx`
- Modify: `web/src/components/shop/PricingSnapshotDrawer.tsx`
- Test: `web/src/app/(app)/settings/shopping/__tests__/rules-page.test.tsx`

**Step 1: Write the failing tests**

Add cases for:

- SIZE editor shows market-linked fields
- preview grid renders resolved amounts
- invalid overlaps show blocking error state

**Step 2: Run test to verify it fails**

Run: `pnpm test -- rules-page`

**Step 3: Write minimal implementation**

- replace static delta entry controls for SIZE
- render computed preview grid
- keep current headers and central-control contracts

**Step 4: Run test to verify it passes**

Run: `pnpm test -- rules-page`

---

## 11. Rollout Strategy

### Phase 1: Shadow build

- build weight grid
- do not use it for push yet
- compare current SIZE result vs grid-derived SIZE result in debug output

### Phase 2: Read-model migration

- mapping/detail read the grid
- recompute still logs legacy comparison

### Phase 3: Compute migration

- recompute writes snapshot SIZE amounts from grid
- auto-sync run consumes option threshold policy

### Phase 4: Cleanup

- deprecate legacy SIZE `additive_delta_krw` usage
- keep compatibility fallback until data is fully migrated

---

## 12. Risks and Mitigations

- overlapping SIZE rules
  - mitigate with hard validation and block save
- missing material factor config
  - mitigate with invalid cell state and operator warning
- resolver drift
  - mitigate with one shared SIZE resolver module
- stale grid after market/material changes
  - mitigate with explicit invalidation and scope rebuild
- option push noise from small market movement
  - mitigate with separate option threshold policy

---

## 13. Acceptance Criteria

- SIZE rule UI configures formulas, not manual final KRW tables.
- SIZE axis2 shows only valid grid-backed weights.
- SIZE axis3 shows read-only resolved amount from the grid.
- mapping/detail/recompute resolve the same SIZE amount for the same input.
- base selling price threshold behavior is unchanged.
- option additional amount push uses separate threshold policy.
- `channel_option_current_state_v1` reflects the new resolved option target and pushed amount.
- overlapping or invalid market-linked SIZE rules block save and sync.

---

## 14. Locked Decisions

These are now fixed requirements for implementation.

1. `external_product_no` stays part of the effective SIZE scope in v1. Grid rows are built/read in product context, with current recompute-style master fallback when no active scoped SIZE rows exist.
2. `weight_step_g` is not persisted in v1. The current `0.05g` page buckets remain a UI/editor affordance only.
3. The computed SIZE grid materializes `0.01g` centigram cells in v1. UI may group or render those cells through existing bucketed presentation, but resolver truth remains centigram-based.
4. `FIXED_DELTA` remains a permanent compatibility fallback mode in v1.

## 15. Execution Order

Implement in this order:

1. schema and shared SIZE resolver
2. mapping/detail/recompute adoption of the shared resolver
3. option-only sync threshold policy and push integration

Plan complete and saved to `docs/plans/2026-03-09-market-linked-weight-option-implementation-plan.md`.
