# Base Labor Multiplier Central Control Design

**Date:** 2026-03-31

**Goal:**
Add a centrally managed pricing-policy switch for base labor sell calculation so catalog saves can use either the existing rule-band flow or a new multiplier flow, while keeping all non-base labor behavior unchanged and removing deprecated market-settings save paths.

## Problem

The catalog page currently auto-fills `labor_base_sell` from `labor_base_cost` through the existing pricing-rule pick flow in `web/src/app/(app)/catalog/page.tsx`.

That works for the current band and rule model, but the business now needs a second mode:

- keep the current rule-band calculation intact
- optionally calculate base labor sell as `labor_base_cost * multiplier`
- manage that choice centrally, not per catalog record

At the same time, saving market settings can surface this message:

- `Deprecated legacy shopping runtime surface. Use the Rule-only SOT mappings/publish flow instead.`

That indicates at least one settings save path still depends on a retired shopping runtime surface instead of the surviving RPC contract.

## Decision

### Central Control Lives In Pricing Policy

The active `pricing_policy` row for a channel becomes the source of truth for base labor sell mode.

New policy fields:

- `base_labor_sell_mode`: `RULE` or `MULTIPLIER`
- `base_labor_sell_multiplier`: positive numeric value, nullable unless mode is `MULTIPLIER`

This keeps control in `web/src/app/(app)/settings/shopping/factors/page.tsx`, where channel pricing behavior is already authored.

### Catalog Remains A Result Writer

The catalog page does not own the multiplier setting.

Instead, `web/src/app/(app)/catalog/page.tsx` reads the active policy and computes the next `labor_base_sell` value before sending the existing save payload to `web/src/app/api/master-item/route.ts`.

That preserves the current data split:

- policy = calculation rule source
- master item = stored numeric result at save time

Changing the policy affects future saves only. Existing saved master rows remain unchanged until re-saved.

## Calculation Contract

### Base Labor

`RULE` mode:

- keep the existing `/api/pricing-rule-pick` path
- preserve vendor-aware fallback behavior
- preserve `labor_profile_mode = BAND` and `labor_band_code = DEFAULT`

`MULTIPLIER` mode:

- compute `labor_base_sell = labor_base_cost * base_labor_sell_multiplier`
- round to the same integer KRW storage shape currently used by the catalog save flow
- skip the rule-pick call for base labor only

### Other Labor Components

No behavior changes for:

- center labor
- sub1 labor
- sub2 labor
- plating

Those remain on their current calculation paths.

## UI Changes

### Settings / Shopping Factors

`web/src/app/(app)/settings/shopping/factors/page.tsx` adds:

- a select for `base labor sell mode`
- an input for `base labor sell multiplier`
- validation that only requires the multiplier when mode is `MULTIPLIER`

Recommended UX:

- default mode stays `RULE`
- multiplier input is disabled or hidden when mode is `RULE`
- helper text explains that only future catalog saves are affected

### Catalog

The catalog page should not let the user override central control locally. If the mode is surfaced, it should be read-only context only.

## API And Persistence Changes

### Pricing Policy APIs

These routes need to expose the new fields:

- `web/src/app/api/pricing-policies/route.ts`
- `web/src/app/api/pricing-policies/[id]/route.ts`

Required behavior:

- include the new fields in select lists
- validate `RULE | MULTIPLIER`
- enforce positive numeric multiplier when mode is `MULTIPLIER`
- allow null multiplier when mode is `RULE`

### Database

Add an additive migration for `pricing_policy` with:

- a mode column
- a multiplier column
- default mode `RULE`
- a check constraint for valid mode values
- a check tying multiplier validity to mode

## Market Settings Save Fix

The surviving market config write contract is already declared in `web/src/lib/contracts.ts` as `CONTRACTS.functions.marketTickConfigUpsert`.

Mobile settings already use it through `useRpcMutation` in `web/src/mobile/settings/SettingsAdvancedMobileScreen.tsx`.

Desktop market settings in `web/src/app/(app)/market/page.tsx` still perform a direct table upsert. The fix is to align desktop with the same RPC contract so all market-config saves run through one surviving path.

## Error Handling

Pricing policy write errors should return user-facing validation messages for:

- invalid mode
- missing multiplier in multiplier mode
- non-positive multiplier

Catalog behavior should fail closed like this:

- if active policy fetch fails, keep existing displayed values and show a toast
- if multiplier mode is active but policy data is invalid, do not silently compute with a fallback multiplier
- if rule mode is active and rule lookup fails, preserve the current behavior of leaving the current input value in place

## Testing Strategy

Add regression coverage to prove:

- pricing policy routes expose the new columns
- settings factors page renders the new controls
- catalog base labor calculation switches correctly between rule and multiplier modes
- desktop and mobile market settings both use the same RPC contract

## Success Criteria

- active pricing policy centrally controls base labor sell calculation mode
- `RULE` mode preserves current catalog behavior
- `MULTIPLIER` mode saves `labor_base_sell = labor_base_cost * multiplier`
- center, sub, and plating calculations do not change
- market settings save succeeds without deprecated legacy-surface errors
- desktop and mobile market config writes use the same RPC contract
