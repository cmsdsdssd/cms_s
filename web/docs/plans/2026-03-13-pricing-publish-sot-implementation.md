# Pricing Publish SOT Implementation Plan

> For Claude: REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

Goal: Make publish option pricing derive only from canonical option rows, make publish variant totals derive only from publish option entries, and make SIZE fail closed with no synthetic fallback.

Architecture: Canonical option rows become the only authored option-price truth. Recompute writes product_price_publish_option_entry_v1 directly from canonical rows, then derives product_price_publish_variant_v1 from selected publish entries. SIZE resolution and validation require persisted grid cells everywhere; missing grids or missing cells block publish/save instead of synthesizing values.

Tech Stack: Next.js route handlers, Supabase, shared pricing helpers in src/lib/shop, Node test runner.

---

## Task 1: Remove SIZE synthetic fallback in shared helpers

Files:
- Modify: web/src/lib/shop/mapping-option-details.ts
- Modify: web/src/lib/shop/weight-grid-store.js
- Modify: web/src/lib/shop/channel-option-central-control.js
- Modify: web/src/lib/shop/option-labor-rules-impl.js
- Test: web/tests/mapping-option-details.test.ts
- Test: web/tests/channel-option-central-control.test.mjs

Steps:
1. Delete the synthetic SIZE allowlist branch in buildMappingOptionAllowlist().
2. Make SIZE validation require membership in sizes_by_material[material].
3. Remove the implicit valid 0.00 SIZE cell path unless a persisted row exists.
4. Remove runtime fallback from persisted grid lookup to market-linked size lookup.
5. Update tests so missing persisted grid and missing cells fail closed.

QA:
- buildMappingOptionAllowlist() returns empty size choices when no persisted grid exists.
- resolveCentralOptionMapping() returns UNRESOLVED for missing SIZE grid/cell.
- computeOptionLaborBuckets() no longer computes SIZE from live market context when persisted grid is absent.

## Task 2: Make mapping save APIs grid-backed

Files:
- Modify: web/src/app/api/channel-products/route.ts
- Modify: web/src/app/api/channel-products/bulk/route.ts
- Reuse: web/src/lib/shop/weight-grid-store.js

Steps:
1. Load persisted grid rows for the canonical scope before validating mappings.
2. Build allowlists with persistedSizeLookup instead of rules-only SIZE choices.
3. Reject mapping saves when selected SIZE is not present in the persisted grid-backed allowlist.

QA:
- Single save with stale/out-of-grid SIZE returns 422.
- Bulk save with stale/out-of-grid SIZE returns 422.

## Task 3: Add canonical publish builder path

Files:
- Modify: web/src/lib/shop/single-sot-pricing.js
- Create or extract helper if needed under web/src/lib/shop/
- Reuse pattern from web/src/app/api/channel-products/variants/route.ts
- Reuse builder from web/src/lib/shop/mapping-option-details.ts

Steps:
1. Add or centralize helpers that convert canonical rows into publish option entries.
2. Use buildVariantBreakdownFromCanonicalRows() as the only publish-variant derivation path.
3. Keep validateAdditiveBreakdown() and apply it to canonical-row-derived publish output.
4. Remove reverse-decomposition helper usage from the publish write path.

QA:
- Canonical rows with additive deltas produce matching publish option entries.
- Variant totals equal the sum of selected publish option entry deltas.

## Task 4: Rewrite recompute publish generation

Files:
- Modify: web/src/app/api/pricing/recompute/route.ts

Steps:
1. Remove the block that fetches Cafe24 variants and reconstructs option entries from published_additional_amount_krw.
2. Build canonical rows per canonical product scope inside recompute.
3. Fail recompute if any canonical publish row is unresolved or non-additive.
4. Upsert product_price_publish_option_entry_v1 from canonical rows.
5. Derive product_price_publish_variant_v1 from selected publish option entries only.

QA:
- Recompute no longer writes product_price_publish_option_entry_v1 from variant residual decomposition.
- Publish rows and publish variant totals share the same publish_version and additive semantics.

## Task 5: Align downstream reads and UI semantics

Files:
- Modify: web/src/app/api/channel-products/variants/route.ts
- Modify: web/src/app/api/public/storefront-option-breakdown/route.ts if needed
- Modify: web/src/app/(app)/settings/shopping/mappings/page.tsx
- Modify docs:
  - web/docs/shopping-option-sot-contract.md
  - 260311/price-single-sot-publish-blueprint.md

Steps:
1. Keep variants as a diagnostic endpoint that clearly separates canonical vs published truth.
2. Disable or block SIZE UI flows when persisted grid choices are missing.
3. Preserve publish-only storefront reads.
4. Update docs to match the new one-way truth flow.

## Task 6: Regression tests and manual verification

Files:
- Modify: web/tests/single-sot-pricing.test.mjs
- Modify: web/tests/mapping-option-details.test.ts
- Modify: web/tests/channel-option-central-control.test.mjs
- Modify: web/tests/persisted-size-grid-rebuild.test.ts

Steps:
1. Replace tests that bless reverse decomposition as publish truth.
2. Add regression coverage for the product 33 style case where material=0 and size or color or decor is positive.
3. Add fail-closed SIZE validation coverage.
4. Run targeted tests, diagnostics, and manual recompute/DB verification.
