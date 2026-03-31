# Base Labor Multiplier In Settings Global Margin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the base labor multiplier feature to `http://localhost:3000/settings` under `Global Margin > Base Labor`, remove shopping ownership of the feature, and make catalog base labor auto-calculation read only the main settings source of truth.

**Architecture:** Re-home the UI and persistence path from shopping pricing policies to the main settings page and its global configuration flow, then repoint catalog base labor calculation to that global settings source while leaving all non-base labor behavior untouched. Keep shopping behavior unchanged by removing the mistaken shopping UI and no longer using shopping pricing-policy fields for this feature.

**Tech Stack:** Next.js app routes, React client pages, Supabase-backed settings/RPC flows, `node:test`, Playwright-based browser smoke checks.

---

### Task 1: Add regression tests for the corrected ownership boundary

**Files:**
- Modify: `web/tests/pricing-policies-base-labor-mode.test.ts`
- Modify: `web/tests/base-labor-sell-mode.test.ts`
- Create: `web/tests/settings-base-labor-multiplier.test.ts`

**Step 1: Write the failing test**

Add source-contract tests that prove:

- `web/src/app/(app)/settings/page.tsx` contains the base labor mode UI under the main settings page
- `web/src/app/(app)/settings/shopping/factors/page.tsx` does not contain `공임 판매 계산 방식` or `공임 판매 배수`
- `web/src/app/(app)/catalog/page.tsx` no longer depends on shopping pricing policy for base labor mode

**Step 2: Run test to verify it fails**

Run: `node --test tests/settings-base-labor-multiplier.test.ts tests/base-labor-sell-mode.test.ts tests/pricing-policies-base-labor-mode.test.ts`
Expected: FAIL because the feature still lives in shopping files and settings main page does not own it yet.

**Step 3: Write minimal implementation**

Only after the failing assertions are in place, update the source-contract tests to match the corrected architecture and keep them narrow enough to be stable.

**Step 4: Run test to verify it passes**

Run: `node --test tests/settings-base-labor-multiplier.test.ts tests/base-labor-sell-mode.test.ts tests/pricing-policies-base-labor-mode.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add web/tests/settings-base-labor-multiplier.test.ts web/tests/base-labor-sell-mode.test.ts web/tests/pricing-policies-base-labor-mode.test.ts
git commit -m "test: lock multiplier ownership to main settings"
```

### Task 2: Add main settings state and persistence for base labor mode

**Files:**
- Modify: `web/src/app/(app)/settings/page.tsx`
- Modify: relevant settings persistence helper or RPC contract file used by `settings/page.tsx`
- Test: `web/tests/settings-base-labor-multiplier.test.ts`

**Step 1: Write the failing test**

Extend the new settings test so it expects:

- a mode selector on `settings/page.tsx`
- a multiplier input in the `기본공임` area
- save-path references in main settings code, not shopping factors code

**Step 2: Run test to verify it fails**

Run: `node --test tests/settings-base-labor-multiplier.test.ts`
Expected: FAIL because the main settings page does not yet own those controls.

**Step 3: Write minimal implementation**

Add the UI and state to `web/src/app/(app)/settings/page.tsx` using the existing `BASE_FACTORY` tab. Reuse the current main-settings persistence path if it can safely carry the new fields; otherwise add the smallest dedicated global settings write path required.

Required behavior:

- `RULE` and `MULTIPLIER` options
- positive multiplier required only in `MULTIPLIER`
- helper text says this affects catalog base labor auto-calculation only

**Step 4: Run test to verify it passes**

Run: `node --test tests/settings-base-labor-multiplier.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add web/src/app/(app)/settings/page.tsx web/tests/settings-base-labor-multiplier.test.ts
git commit -m "feat: add base labor multiplier controls to settings"
```

### Task 3: Remove shopping ownership of multiplier controls

**Files:**
- Modify: `web/src/app/(app)/settings/shopping/factors/page.tsx`
- Modify: `web/src/app/api/pricing-policies/route.ts`
- Modify: `web/src/app/api/pricing-policies/[id]/route.ts`
- Modify: `web/tests/pricing-policies-base-labor-mode.test.ts`

**Step 1: Write the failing test**

Add assertions that shopping factors no longer renders or persists:

- `공임 판매 계산 방식`
- `공임 판매 배수`
- `base_labor_sell_mode`
- `base_labor_sell_multiplier`

**Step 2: Run test to verify it fails**

Run: `node --test tests/pricing-policies-base-labor-mode.test.ts`
Expected: FAIL because shopping still owns these fields.

**Step 3: Write minimal implementation**

Remove shopping UI and any shopping-only API handling for multiplier mode. Do not destructively remove remote columns from `pricing_policy`; just stop using them for this feature.

**Step 4: Run test to verify it passes**

Run: `node --test tests/pricing-policies-base-labor-mode.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add web/src/app/(app)/settings/shopping/factors/page.tsx web/src/app/api/pricing-policies/route.ts web/src/app/api/pricing-policies/[id]/route.ts web/tests/pricing-policies-base-labor-mode.test.ts
git commit -m "refactor: remove shopping ownership of base labor multiplier"
```

### Task 4: Repoint catalog base labor to main settings only

**Files:**
- Modify: `web/src/app/(app)/catalog/page.tsx`
- Modify: `web/src/lib/catalog/base-labor-sell-mode.ts`
- Modify: `web/tests/base-labor-sell-mode.test.ts`

**Step 1: Write the failing test**

Update catalog tests so they now prove:

- catalog reads main settings global base labor config
- catalog does not depend on shopping pricing policy for base labor mode
- base labor alone can switch between `RULE` and `MULTIPLIER`
- center/sub/plating branches stay untouched

**Step 2: Run test to verify it fails**

Run: `node --test tests/base-labor-sell-mode.test.ts`
Expected: FAIL because catalog still references the wrong source.

**Step 3: Write minimal implementation**

Change the catalog config read to the main settings source, keeping the helper split intact. Preserve `RULE` fallback on missing or invalid config.

**Step 4: Run test to verify it passes**

Run: `node --test tests/base-labor-sell-mode.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add web/src/app/(app)/catalog/page.tsx web/src/lib/catalog/base-labor-sell-mode.ts web/tests/base-labor-sell-mode.test.ts
git commit -m "feat: source catalog base labor mode from settings"
```

### Task 5: Re-verify market settings save regression boundary

**Files:**
- Modify: `web/tests/market-settings-rpc-contract.test.ts`
- Modify: `web/src/app/(app)/market/page.tsx` only if a regression is found
- Modify: `web/src/mobile/settings/SettingsAdvancedMobileScreen.tsx` only if a regression is found

**Step 1: Write the failing test**

If needed, extend the market settings regression test to assert that this refactor does not reintroduce shopping legacy save behavior.

**Step 2: Run test to verify it fails**

Run: `node --test tests/market-settings-rpc-contract.test.ts`
Expected: Either already PASS or fail only if the refactor disturbed the market save boundary.

**Step 3: Write minimal implementation**

Only fix regressions if the test reveals one.

**Step 4: Run test to verify it passes**

Run: `node --test tests/market-settings-rpc-contract.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add web/tests/market-settings-rpc-contract.test.ts web/src/app/(app)/market/page.tsx web/src/mobile/settings/SettingsAdvancedMobileScreen.tsx
git commit -m "test: preserve market settings rpc boundary"
```

### Task 6: Run real browser smoke tests from the corrected surface

**Files:**
- Modify: none required
- Test: live app at `http://localhost:3000/settings`, `http://localhost:3000/catalog`, `http://localhost:3000/market`

**Step 1: Verify main settings UI path**

Use browser automation to confirm the multiplier controls are visible at:

- `http://localhost:3000/settings`
- `글로벌 마진 > 기본공임`

**Step 2: Verify RULE path**

Set the mode to `RULE`, save, then confirm in catalog that base labor cost `1000` follows the rule lookup path rather than forced multiplier behavior.

**Step 3: Verify MULTIPLIER path**

Set the mode to `MULTIPLIER` with multiplier `2`, save, then confirm in catalog that base labor cost `1000` becomes sell `2000`.

**Step 4: Verify isolation**

Confirm:

- shopping factors no longer shows multiplier UI
- center/sub/plating behavior still follows previous logic
- market settings save still succeeds without the deprecated shopping runtime message

**Step 5: Commit**

```bash
git add .
git commit -m "test: verify settings-based base labor multiplier flow"
```

### Task 7: Run focused automated verification

**Files:**
- Test: `web/tests/settings-base-labor-multiplier.test.ts`
- Test: `web/tests/pricing-policies-base-labor-mode.test.ts`
- Test: `web/tests/base-labor-sell-mode.test.ts`
- Test: `web/tests/market-settings-rpc-contract.test.ts`
- Test: `web/tests/pricing-policies-ending-policy.test.ts`

**Step 1: Run focused tests**

Run: `node --test tests/settings-base-labor-multiplier.test.ts tests/pricing-policies-base-labor-mode.test.ts tests/base-labor-sell-mode.test.ts tests/market-settings-rpc-contract.test.ts tests/pricing-policies-ending-policy.test.ts`
Expected: PASS

**Step 2: Run lint on touched files**

Run: `npm run lint -- "src/app/(app)/settings/page.tsx" "src/app/(app)/settings/shopping/factors/page.tsx" "src/app/(app)/catalog/page.tsx" "src/app/api/pricing-policies/route.ts" "src/app/api/pricing-policies/[id]/route.ts" "src/lib/catalog/base-labor-sell-mode.ts" "tests/settings-base-labor-multiplier.test.ts" "tests/pricing-policies-base-labor-mode.test.ts" "tests/base-labor-sell-mode.test.ts"`
Expected: PASS, or clear report of any remaining pre-existing issues.

**Step 3: Manual verification summary**

Document the final checked behaviors:

- multiplier lives only in `settings`
- shopping does not own the feature
- catalog base labor follows settings only
- market save regression remains fixed

**Step 4: Commit**

```bash
git add .
git commit -m "test: verify settings-owned base labor multiplier"
```
