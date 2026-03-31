# Catalog Save-Time Auto-Recalculation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make catalog saves recompute all current auto-calculated sell fields immediately before payload creation so users can click save without blurring edited cost inputs first.

**Architecture:** Keep the existing blur-driven UX for interactive feedback, but add a dedicated save-time normalization pass in the catalog editor that reuses the same calculation rules before building the final `/api/master-item` payload. The fix stays client-side, preserves current RULE and MULTIPLIER behavior, and aborts save on recalculation failure rather than persisting stale sell values.

**Tech Stack:** Next.js client page, React state, existing catalog pricing helpers, browser-based smoke verification, `node:test`.

---

### Task 1: Add regression tests for save-without-blur behavior

**Files:**
- Modify: `web/tests/base-labor-sell-mode.test.ts`
- Create: `web/tests/catalog-save-time-normalization.test.ts`

**Step 1: Write the failing test**

Add tests that assert the catalog page source contains a save-time normalization step before payload creation and does not rely only on blur-driven helper calls.

Minimum source-contract expectations:

- `handleSave` calls a dedicated normalization helper before constructing the payload
- the normalization helper touches base labor, stone labor, and plating sell derivations
- payload fields are built from normalized values, not directly from stale UI state alone

**Step 2: Run test to verify it fails**

Run: `node --test tests/catalog-save-time-normalization.test.ts tests/base-labor-sell-mode.test.ts`
Expected: FAIL because save currently uses raw state and blur timing.

**Step 3: Write minimal implementation**

Only after the failing tests exist, keep the tests narrow and resilient to refactors while still proving save-time normalization exists.

**Step 4: Run test to verify it passes**

Run: `node --test tests/catalog-save-time-normalization.test.ts tests/base-labor-sell-mode.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add web/tests/catalog-save-time-normalization.test.ts web/tests/base-labor-sell-mode.test.ts
git commit -m "test: cover catalog save-time normalization"
```

### Task 2: Extract reusable catalog save-time normalization helper

**Files:**
- Create: `web/src/lib/catalog/catalog-save-normalization.ts`
- Modify: `web/src/lib/catalog/base-labor-sell-mode.ts`
- Test: `web/tests/catalog-save-time-normalization.test.ts`

**Step 1: Write the failing test**

Add unit tests for a new helper that takes current catalog editor values and returns normalized sell values for all auto-calculated fields.

Cover at least:

- base labor in `RULE`
- base labor in `MULTIPLIER`
- stone labor branches using existing rule pick logic hooks
- plating sell derived from plating cost
- invalid normalization input rejects rather than silently persisting stale values

**Step 2: Run test to verify it fails**

Run: `node --test tests/catalog-save-time-normalization.test.ts`
Expected: FAIL because the helper does not exist.

**Step 3: Write minimal implementation**

Create a focused helper that:

- accepts current cost/sell editor snapshot
- accepts async callbacks for rule-based lookups already used in the page
- returns a normalized snapshot for payload construction
- does not own UI state directly

**Step 4: Run test to verify it passes**

Run: `node --test tests/catalog-save-time-normalization.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add web/src/lib/catalog/catalog-save-normalization.ts web/src/lib/catalog/base-labor-sell-mode.ts web/tests/catalog-save-time-normalization.test.ts
git commit -m "feat: add catalog save-time normalization helper"
```

### Task 3: Wire save-time normalization into catalog handleSave

**Files:**
- Modify: `web/src/app/(app)/catalog/page.tsx`
- Modify: `web/tests/catalog-save-time-normalization.test.ts`

**Step 1: Write the failing test**

Extend the test so it proves `handleSave`:

- awaits normalization before payload construction
- uses normalized sell values for `labor_base_sell`, stone labor sells, and `plating_price_sell_default`
- aborts save on normalization failure with a visible error path

**Step 2: Run test to verify it fails**

Run: `node --test tests/catalog-save-time-normalization.test.ts`
Expected: FAIL because `handleSave` still reads stale state directly.

**Step 3: Write minimal implementation**

In `web/src/app/(app)/catalog/page.tsx`:

- call the new normalization helper at the start of `handleSave`
- build payload from the normalized snapshot
- optionally sync normalized values back into React state so the editor matches what was saved
- do not change manual fields or unrelated save logic

**Step 4: Run test to verify it passes**

Run: `node --test tests/catalog-save-time-normalization.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add web/src/app/(app)/catalog/page.tsx web/tests/catalog-save-time-normalization.test.ts
git commit -m "fix: normalize catalog auto-calculations before save"
```

### Task 4: Verify settings-owned base labor mode still drives normalization

**Files:**
- Modify: `web/tests/base-labor-sell-mode.test.ts`
- Modify: `web/src/app/(app)/catalog/page.tsx` only if needed

**Step 1: Write the failing test**

Extend catalog/base labor tests so they prove save-time normalization still uses the settings-owned base labor mode source and not shopping pricing policies.

**Step 2: Run test to verify it fails**

Run: `node --test tests/base-labor-sell-mode.test.ts tests/catalog-save-time-normalization.test.ts`
Expected: FAIL if the new save path bypasses the settings-owned config.

**Step 3: Write minimal implementation**

Keep the save-time helper wired to the same `RULE` and `MULTIPLIER` config source already used by the editor.

**Step 4: Run test to verify it passes**

Run: `node --test tests/base-labor-sell-mode.test.ts tests/catalog-save-time-normalization.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add web/tests/base-labor-sell-mode.test.ts web/src/app/(app)/catalog/page.tsx
git commit -m "test: keep save-time normalization on settings-owned mode"
```

### Task 5: Run real browser smoke tests for save-without-blur

**Files:**
- Modify: none required
- Test: live app at `http://localhost:3000/settings` and `http://localhost:3000/catalog`

**Step 1: Verify RULE without blur**

Use browser automation to:

- keep base labor mode in `RULE`
- open catalog editor
- type a new cost value
- click save immediately without blurring first
- verify persisted or immediately reflected sell value matches rule-based calculation

**Step 2: Verify MULTIPLIER without blur**

Use browser automation to:

- set `MULTIPLIER=2` in settings
- open catalog editor
- type base labor cost `1000`
- click save immediately without blurring first
- verify saved result is `2000`

**Step 3: Verify broader auto-calculation scope**

Repeat the same save-without-blur pattern for at least one stone-labor and plating path that currently auto-calculates from cost.

**Step 4: Verify editor state alignment**

Confirm the editor UI after save reflects the normalized values that were actually persisted.

**Step 5: Commit**

```bash
git add .
git commit -m "test: verify catalog save-time auto recalculation"
```

### Task 6: Run focused automated verification

**Files:**
- Test: `web/tests/settings-base-labor-multiplier.test.ts`
- Test: `web/tests/base-labor-sell-mode.test.ts`
- Test: `web/tests/catalog-save-time-normalization.test.ts`
- Test: `web/tests/pricing-policies-base-labor-mode.test.ts`
- Test: `web/tests/pricing-policies-ending-policy.test.ts`
- Test: `web/tests/market-settings-rpc-contract.test.ts`

**Step 1: Run focused tests**

Run: `node --test tests/settings-base-labor-multiplier.test.ts tests/base-labor-sell-mode.test.ts tests/catalog-save-time-normalization.test.ts tests/pricing-policies-base-labor-mode.test.ts tests/pricing-policies-ending-policy.test.ts tests/market-settings-rpc-contract.test.ts`
Expected: PASS

**Step 2: Run build verification**

Run: `npm run build`
Expected: PASS

**Step 3: Summarize final verified behaviors**

Document that:

- save-without-blur now applies current auto-calculation logic
- RULE and MULTIPLIER both normalize correctly on save
- shopping ownership remains removed
- market save regression remains fixed

**Step 4: Commit**

```bash
git add .
git commit -m "test: verify catalog save-time normalization"
```
