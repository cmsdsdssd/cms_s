# Base Labor Multiplier Central Control Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add centrally managed `RULE` vs `MULTIPLIER` base labor sell behavior to pricing policies, apply it only to base labor during catalog saves, and move market-settings saves onto the shared market-config RPC contract.

**Architecture:** Add two additive fields to `pricing_policy`, expose them through the pricing-policy APIs and shopping factors UI, and move the catalog page's base-labor auto-fill decision into a small helper that can switch between rule-pick and multiplier behavior. Align desktop market settings with the existing RPC contract already used by mobile so market-config writes run through one surviving path.

**Tech Stack:** Next.js app routes, React client pages, Supabase migrations, `node:test`, TanStack Query, existing RPC helpers.

---

### Task 1: Add pricing policy schema support

**Files:**
- Create: `supabase/migrations/20260331110000_pricing_policy_base_labor_sell_mode.sql`
- Test: `web/tests/pricing-policies-base-labor-mode.test.ts`

**Step 1: Write the failing test**

Create a `node:test` file that asserts the new migration contains:

- `base_labor_sell_mode`
- `base_labor_sell_multiplier`
- `RULE`
- `MULTIPLIER`

**Step 2: Run test to verify it fails**

Run: `node --test web/tests/pricing-policies-base-labor-mode.test.ts`
Expected: FAIL because the migration file does not exist yet.

**Step 3: Write minimal implementation**

Create an additive migration that:

- adds `base_labor_sell_mode text not null default 'RULE'`
- adds `base_labor_sell_multiplier numeric`
- enforces `RULE | MULTIPLIER`
- enforces a positive multiplier when mode is `MULTIPLIER`

**Step 4: Run test to verify it passes**

Run: `node --test web/tests/pricing-policies-base-labor-mode.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/migrations/20260331110000_pricing_policy_base_labor_sell_mode.sql web/tests/pricing-policies-base-labor-mode.test.ts
git commit -m "feat: add pricing policy base labor sell mode columns"
```

### Task 2: Expose and validate the new pricing policy fields

**Files:**
- Modify: `web/src/app/api/pricing-policies/route.ts`
- Modify: `web/src/app/api/pricing-policies/[id]/route.ts`
- Modify: `web/tests/pricing-policies-base-labor-mode.test.ts`

**Step 1: Write the failing test**

Extend the test to assert both routes mention:

- `base_labor_sell_mode`
- `base_labor_sell_multiplier`

Also assert the routes validate mode values.

**Step 2: Run test to verify it fails**

Run: `node --test web/tests/pricing-policies-base-labor-mode.test.ts`
Expected: FAIL because the routes do not mention the new fields yet.

**Step 3: Write minimal implementation**

Update both routes to:

- include both columns in select lists
- parse `RULE | MULTIPLIER`
- require a positive multiplier when mode is `MULTIPLIER`
- normalize multiplier to `null` in `RULE` mode

**Step 4: Run test to verify it passes**

Run: `node --test web/tests/pricing-policies-base-labor-mode.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add web/src/app/api/pricing-policies/route.ts web/src/app/api/pricing-policies/[id]/route.ts web/tests/pricing-policies-base-labor-mode.test.ts
git commit -m "feat: expose base labor sell mode in pricing policies"
```

### Task 3: Add central-control UI to shopping factors

**Files:**
- Modify: `web/src/app/(app)/settings/shopping/factors/page.tsx`
- Modify: `web/tests/pricing-policies-base-labor-mode.test.ts`

**Step 1: Write the failing test**

Add assertions that the factors page contains:

- `baseLaborSellMode`
- `baseLaborSellMultiplier`
- the UI label for base labor sell calculation

**Step 2: Run test to verify it fails**

Run: `node --test web/tests/pricing-policies-base-labor-mode.test.ts`
Expected: FAIL because the page does not render those controls yet.

**Step 3: Write minimal implementation**

Update the factors page to:

- load the new policy values into local state
- send them in the existing `POST` and `PUT` payload
- render a mode select and multiplier input
- validate multiplier only when mode is `MULTIPLIER`

**Step 4: Run test to verify it passes**

Run: `node --test web/tests/pricing-policies-base-labor-mode.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add web/src/app/(app)/settings/shopping/factors/page.tsx web/tests/pricing-policies-base-labor-mode.test.ts
git commit -m "feat: add central base labor sell controls"
```

### Task 4: Extract base labor sell resolution into a helper

**Files:**
- Create: `web/src/lib/catalog/base-labor-sell-mode.ts`
- Create: `web/tests/base-labor-sell-mode.test.ts`
- Modify: `web/src/app/(app)/catalog/page.tsx`

**Step 1: Write the failing test**

Create helper tests that prove:

- `MULTIPLIER` mode returns `cost * multiplier`
- `RULE` mode delegates to a supplied rule-pick callback
- invalid multiplier input does not silently produce a number

**Step 2: Run test to verify it fails**

Run: `node --test web/tests/base-labor-sell-mode.test.ts`
Expected: FAIL because the helper does not exist.

**Step 3: Write minimal implementation**

Create `resolveBaseLaborSell()` and move only the base-labor decision into it. Keep center, sub, and plating logic untouched in the catalog page.

**Step 4: Run test to verify it passes**

Run: `node --test web/tests/base-labor-sell-mode.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add web/src/lib/catalog/base-labor-sell-mode.ts web/src/app/(app)/catalog/page.tsx web/tests/base-labor-sell-mode.test.ts
git commit -m "feat: centralize base labor sell mode resolution"
```

### Task 5: Wire pricing policy reads into catalog base labor auto-fill

**Files:**
- Modify: `web/src/app/(app)/catalog/page.tsx`
- Modify: `web/tests/base-labor-sell-mode.test.ts`

**Step 1: Write the failing test**

Add a source-contract test asserting the catalog page references:

- `base_labor_sell_mode`
- `base_labor_sell_multiplier`

**Step 2: Run test to verify it fails**

Run: `node --test web/tests/base-labor-sell-mode.test.ts`
Expected: FAIL because the catalog page does not load those fields yet.

**Step 3: Write minimal implementation**

Update the catalog page to:

- read the active pricing policy
- pass mode and multiplier into the new helper for base labor only
- preserve current fallback behavior when no valid policy is available

**Step 4: Run test to verify it passes**

Run: `node --test web/tests/base-labor-sell-mode.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add web/src/app/(app)/catalog/page.tsx web/tests/base-labor-sell-mode.test.ts
git commit -m "feat: apply pricing policy to base labor auto-fill"
```

### Task 6: Align desktop market settings with the market-config RPC

**Files:**
- Create: `web/tests/market-settings-rpc-contract.test.ts`
- Modify: `web/src/app/(app)/market/page.tsx`
- Modify: `web/src/mobile/settings/SettingsAdvancedMobileScreen.tsx`

**Step 1: Write the failing test**

Create a contract test that asserts desktop and mobile market settings both reference `marketTickConfigUpsert`, and that the desktop save path no longer depends on direct `cms_market_tick_config` upsert logic.

**Step 2: Run test to verify it fails**

Run: `node --test web/tests/market-settings-rpc-contract.test.ts`
Expected: FAIL because the desktop page still writes directly to the table.

**Step 3: Write minimal implementation**

Refactor `web/src/app/(app)/market/page.tsx` to use `useRpcMutation` with `CONTRACTS.functions.marketTickConfigUpsert`, matching the mobile screen's survivor contract.

**Step 4: Run test to verify it passes**

Run: `node --test web/tests/market-settings-rpc-contract.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add web/src/app/(app)/market/page.tsx web/src/mobile/settings/SettingsAdvancedMobileScreen.tsx web/tests/market-settings-rpc-contract.test.ts
git commit -m "fix: unify market settings save rpc"
```

### Task 7: Run focused verification

**Files:**
- Test: `web/tests/pricing-policies-base-labor-mode.test.ts`
- Test: `web/tests/base-labor-sell-mode.test.ts`
- Test: `web/tests/market-settings-rpc-contract.test.ts`
- Test: `web/tests/pricing-policies-ending-policy.test.ts`

**Step 1: Run focused tests**

Run: `node --test web/tests/pricing-policies-base-labor-mode.test.ts web/tests/base-labor-sell-mode.test.ts web/tests/market-settings-rpc-contract.test.ts web/tests/pricing-policies-ending-policy.test.ts`
Expected: PASS

**Step 2: Run lint on touched files**

Run: `npm run lint -- --file src/app/(app)/settings/shopping/factors/page.tsx --file src/app/(app)/catalog/page.tsx --file src/app/(app)/market/page.tsx --file src/app/api/pricing-policies/route.ts --file src/app/api/pricing-policies/[id]/route.ts`
Expected: PASS, or actionable lint findings only in touched files.

**Step 3: Manual verification**

Confirm:

- pricing factors page saves `RULE` mode without requiring a multiplier
- pricing factors page saves `MULTIPLIER` mode with a positive multiplier
- catalog save with multiplier `2` stores doubled base labor sell
- center, sub, and plating values stay unchanged
- desktop market settings save succeeds without the deprecated legacy-surface message

**Step 4: Commit**

```bash
git add .
git commit -m "test: verify base labor mode and market settings flows"
```
