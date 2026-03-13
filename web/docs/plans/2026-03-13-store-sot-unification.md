# Store-SOT Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make storefront-facing shopping previews prefer store/published truth first, while isolating internal compute/target data as secondary operational context.

**Architecture:** Keep `current/published` data as the only source for anything labeled storefront, shop, current, or applied. Preserve `pricing_snapshot` and run/intent data for operator/debug views, but separate them clearly in both API source selection and UI language. Start with the highest-risk divergence point: `public/storefront-option-breakdown` preferring `canonical_rows` over `published_entries`.

**Tech Stack:** Next.js app routes, shared JS pricing helpers in `src/lib/shop`, Node test runner, Supabase-backed published/current-state tables.

---

### Task 1: Flip storefront breakdown to store/published-first

**Files:**
- Modify: `src/app/api/public/storefront-option-breakdown/route.ts`
- Modify: `src/lib/shop/single-sot-pricing.js`
- Test: `tests/single-sot-pricing.test.ts`

**Step 1: Write the failing test**

Add a helper-level test that proves published entries win when both published and canonical data are present.

```ts
test("prefer published storefront source when both published and canonical data exist", () => {
  const result = selectStorefrontBreakdownSource({
    canonicalOptionRows: [{ axis_index: 1, option_name: "색상", option_value: "골드", resolved_delta_krw: 0 }],
    canonicalVariants: [{ variantCode: "V1", options: [{ name: "색상", value: "골드" }] }],
    optionEntryRows: [{ option_axis_index: 1, option_name: "색상", option_value: "골드", published_delta_krw: 3000 }],
  });

  assert.equal(result.previewSource, "published_entries");
  assert.equal(result.breakdown.byVariant[0]?.total_delta_krw, 3000);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/single-sot-pricing.test.ts`
Expected: FAIL because `selectStorefrontBreakdownSource` does not exist yet.

**Step 3: Write minimal implementation**

Add a shared helper in `src/lib/shop/single-sot-pricing.js` that:
- prefers `optionEntryRows` when present
- falls back to canonical rows only if published entries are unavailable
- returns `{ axis, breakdown, previewSource }`

Then update `src/app/api/public/storefront-option-breakdown/route.ts` to call that helper instead of manually preferring canonical rows.

**Step 4: Run test to verify it passes**

Run: `node --test tests/single-sot-pricing.test.ts`
Expected: PASS

**Step 5: Verify route behavior stays compatible**

Confirm the route still returns:
- `axis`
- `by_variant`
- `canonical_option_rows`
- `preview_source`

but `preview_source` now resolves to `published_entries` whenever published data exists.

### Task 2: Separate applied/store truth from target/compute truth in auto-price UI

**Files:**
- Modify: `src/app/(app)/settings/shopping/auto-price/page.tsx`
- Modify: `src/app/api/channel-products/editor/route.ts`
- Test: targeted UI/helper tests if a new helper is introduced

**Step 1: Keep store-SOT block strictly current/applied**

The storefront card should show only:
- current applied price
- last option push
- last verify
- sync badge

**Step 2: Move compute-only values into a separate block**

Treat these as internal/operator context:
- target value
- last compute
- computed option amount

**Step 3: Preserve mixed visibility but stop mixed semantics**

Keep both blocks on screen if useful, but never label compute values as storefront/current/applied.

### Task 3: Fix run-summary profile ambiguity

**Files:**
- Modify: `src/app/api/price-sync-runs-v2/route.ts`
- Modify: `src/app/api/price-sync-runs-v2/[run_id]/route.ts`
- Modify: any run-detail UI consuming those routes

**Step 1: Keep channel summary and product-effective profile separate**

Do not overload one `threshold_profile` field with two meanings.

**Step 2: Add explicit naming**

Suggested shape:

```ts
channel_threshold_profile
effective_product_threshold_profile
```

**Step 3: Render both in operator/debug views only**

These are internal sync/debug signals, not storefront truth.

### Task 4: Update SoT contract doc

**Files:**
- Modify: `docs/shopping-option-sot-contract.md`

**Step 1: Split truth domains explicitly**

Document:
- storefront truth = `current/published`
- compute truth = `pricing_snapshot`

**Step 2: Ban canonical/snapshot values in storefront-labeled surfaces**

Add a rule that any UI/API labeled `storefront`, `shop`, `current`, or `applied` must not prefer `canonical_rows` or snapshot-only values.

### Task 5: Full verification

**Files:**
- Test: `tests/single-sot-pricing.test.ts`
- Test: any added helper/UI tests
- Verify: modified route/UI files with LSP diagnostics

**Step 1: Run targeted tests**

Run: `node --test tests/single-sot-pricing.test.ts`

**Step 2: Run diagnostics**

Check modified files with `lsp_diagnostics`.

**Step 3: Run build**

Run: `npm run build`
Expected: exit code 0

**Step 4: Do not commit automatically**

Leave changes ready for review since git commit was not requested.
