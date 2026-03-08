# Channel Option Central Control Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a channel-scoped central option rule system that drives product option mapping and auto-price calculations from approved business categories.

**Architecture:** Add dedicated rule, mapping, and audit APIs around the current shopping rules surface; then refactor `auto-price` to consume canonical resolved option mappings instead of the current mixed `optionName` and `entryKey` draft model. Preserve legacy data during rollout and surface legacy warnings instead of destructive invalidation.

**Tech Stack:** Next.js App Router, React, TanStack Query, TypeScript, Supabase-backed API routes, existing shopping settings pages

---

## Task 1: Lock document references

**Files:**
- Read: `docs/plans/2026-03-07-channel-option-central-control-prd.md`
- Read: `docs/plans/2026-03-07-channel-option-central-control-erd.md`
- Update: `docs/plans/2026-03-07-channel-option-central-control-checklist.md`

**Steps:**

1. Copy the final PRD decisions into the checklist header.
2. Copy the final ERD table names into the checklist header.
3. Add explicit verification targets for APIs, UI, and calculations.

## Task 2: Baseline central-rule integration points

**Files:**
- Read: `web/src/app/(app)/settings/shopping/rules/page.tsx`
- Read: `web/src/app/api/option-labor-rules/route.ts`
- Read: `web/src/app/api/option-labor-rule-pools/route.ts`
- Read: `web/src/app/(app)/settings/shopping/auto-price/page.tsx`

**Steps:**

1. Identify which existing rules-page sections can be reused for size/color/decor/other.
2. Identify where current allowlists are built for auto-price.
3. Record exact type names and response shapes to minimize duplicate models.

## Task 3: Add failing tests for rule resolution helpers

**Files:**
- Create: `web/tests/channel-option-central-control.test.mjs`
- Modify if needed: `web/package.json`

**Steps:**

1. Write a failing test for `material_autofill_from_master`.
2. Write a failing test for `size_price_by_material_and_weight`.
3. Write a failing test for `color_price_by_material_and_color`.
4. Write a failing test for `decor_additive_price_with_snapshot_metadata`.
5. Write a failing test for `legacy_mapping_kept_with_warning_when_rule_removed`.
6. Run only this test file and confirm it fails for the missing helper behavior.

## Task 4: Implement canonical rule-resolution helpers

**Files:**
- Create: `web/src/lib/shop/channel-option-central-control.ts`
- Test: `web/tests/channel-option-central-control.test.mjs`
- Update if needed: `web/src/lib/shop/mapping-option-details.ts`

**Steps:**

1. Add normalized types for central rule entries, product option mappings, and legacy status.
2. Implement material autofill resolver from master context.
3. Implement size resolver from `material + weight` under additive rules.
4. Implement color resolver from `material + color` under additive rules.
5. Implement decor resolver from selected decor master and snapshot metadata.
6. Implement legacy-state derivation for out-of-range or inactive rules.
7. Run the targeted test file until it passes.

## Task 5: Add server-side API contracts for central rules

**Files:**
- Create: `web/src/app/api/channel-option-rule-catalogs/route.ts`
- Create: `web/src/app/api/channel-option-rule-entries/route.ts`
- Create: `web/src/app/api/channel-product-option-mappings-v2/route.ts`
- Create: `web/src/app/api/channel-product-option-mapping-logs/route.ts`

**Steps:**

1. Define GET and POST validation contracts based on the ERD.
2. Implement rule-entry filtering by `channel_id`, `category_key`, and active state.
3. Implement mapping upsert keyed by `channel_id + master_item_id + external_product_no + option_name + option_value`.
4. Implement write-path logging for mapping changes and `other` reason changes.
5. Add read-path legacy compatibility fields needed by `auto-price`.

## Task 6: Extend central rules UI on shopping rules page

**Files:**
- Modify: `web/src/app/(app)/settings/shopping/rules/page.tsx`
- Possibly modify: `web/src/components/ui/field.tsx`

**Steps:**

1. Rework rules-page drafts around the approved categories.
2. Make size rules material-scoped and weight-range based.
3. Make color rules material-scoped and color-based.
4. Make decor rules selectable from default component masters first with optional full-master expansion.
5. Add `other` rule authoring path for reusable templates where appropriate.
6. Add operator-facing copy explaining additive overlap behavior.

## Task 7: Wire auto-price to new mapping API

**Files:**
- Modify: `web/src/app/(app)/settings/shopping/auto-price/page.tsx`
- Modify if needed: `web/src/app/api/channel-products/variants/route.ts`

**Steps:**

1. Replace the current `optionCategoryDrafts` per-name logic with canonical mapping rows.
2. Load resolved product option mappings and central allowed-value choices from the new API.
3. Keep row-first UI with one row per option value.
4. Render category-specific controls:
   - material: read-only resolved value
   - size: material-scoped weight dropdown
   - color: material-scoped color dropdown
   - decor: decor master dropdown with component-only default filter
   - other: amount dropdown + reason input
5. Show legacy warnings without erasing saved values.
6. Save through `channel-product-option-mappings-v2` instead of the current flat category save path.

## Task 8: Reconnect variant additional-price calculation

**Files:**
- Modify: `web/src/app/(app)/settings/shopping/auto-price/page.tsx`
- Modify if needed: `web/src/lib/shop/mapping-option-details.ts`
- Modify if needed: `web/src/app/api/channel-products/editor/route.ts`

**Steps:**

1. Compute each option row's `resolved_delta_krw` from canonical mapping data.
2. Sum the row deltas per variant.
3. Preserve explicit manual override precedence.
4. Ensure preview, snapshot summary, and push payloads all use the same resolved numbers.
5. Add regression coverage for the `2 x 3 => 5 rows drive 6 variant prices` case.

## Task 9: Add audit and explainability surfaces

**Files:**
- Modify: `web/src/app/(app)/settings/shopping/auto-price/page.tsx`
- Modify or create: related API routes returning logs

**Steps:**

1. Show `legacy` badges and warning reasons in product editing UI.
2. Show latest mapping or `other reason` history where useful.
3. Show source rule reference or source summary for resolved deltas.
4. Keep snapshot/history explanation text aligned with real data conditions.

## Task 10: Legacy migration and fallback

**Files:**
- Modify: `web/src/app/api/channel-products/variants/route.ts`
- Modify: `web/src/lib/shop/mapping-option-details.ts`

**Steps:**

1. Read legacy `saved_option_categories` only for migration-prefill purposes.
2. Convert what can be converted into new mapping defaults.
3. Mark non-convertible rows as unresolved or legacy warning instead of silently discarding them.
4. Keep old data visible until a new mapping is saved.

## Task 11: Verification

**Files:**
- Test: `web/tests/channel-option-central-control.test.mjs`
- Test existing: `web/tests/price-sync-policy.test.mjs`

**Steps:**

1. Run `lsp_diagnostics` on all modified files.
2. Run targeted tests for new central-control helpers.
3. Run existing impacted tests.
4. Run `npm run build` in `web`.
5. Update the checklist document with pass/fail status and any residual risks.


## Oracle Review Delta

1. Keep one shared canonical resolver as the executable core and reuse it from editor load, preview, and recompute-adjacent paths.
2. Treat additive overlap as multi-source resolution and persist trace rows instead of one source rule pointer.
3. Preserve current snapshot and state output contracts until the full cutover is complete.
4. Backfill from both `channel_option_category_v2` and `channel_option_labor_rule_v1`.
5. Keep category compatibility with existing runtime labels where bridge code still expects `COLOR_PLATING`.
