# Base Labor Multiplier In Settings Global Margin Design

**Date:** 2026-03-31

**Goal:**
Move the base labor sell calculation mode from the mistakenly added shopping policy surface to the main settings page so `settings > global margin > base labor` becomes the only source of truth for catalog base labor auto-calculation.

## Problem

The current implementation added `RULE` vs `MULTIPLIER` controls under `web/src/app/(app)/settings/shopping/factors/page.tsx` and stored the setting in `pricing_policy`.

That is the wrong product surface.

The intended authoring location is:

- `http://localhost:3000/settings`
- `Global Margin`
- `Base Labor`

The user also clarified that this change is separate from shopping settings, and shopping behavior must not be changed as part of this feature.

## Decision

### Source Of Truth Moves To Main Settings

The source of truth for base labor sell mode moves to the main settings page in `web/src/app/(app)/settings/page.tsx`.

It belongs in the existing `BASE_FACTORY` tab, which is already labeled `기본공임`.

The setting controls are:

- `판매가 계산 방식`: `RULE` | `MULTIPLIER`
- `배수`: positive numeric value, used only in `MULTIPLIER` mode

### Shopping Surface Must Not Own This Setting

The multiplier UI and storage added under shopping factors are removed.

Files to unwind from ownership of this feature:

- `web/src/app/(app)/settings/shopping/factors/page.tsx`
- `web/src/app/api/pricing-policies/route.ts`
- `web/src/app/api/pricing-policies/[id]/route.ts`

Shopping settings return to their original scope and should not store or present base labor multiplier controls.

## Functional Scope

### What Changes

Only catalog base labor auto-calculation changes.

When the catalog calculates `BASE_LABOR` sell from cost:

- `RULE` mode uses the existing base labor pricing rule lookup
- `MULTIPLIER` mode uses `labor_base_cost * multiplier`

### What Must Not Change

This feature must not alter:

- shopping settings behavior
- channel pricing policy semantics
- center labor calculation
- sub1 labor calculation
- sub2 labor calculation
- plating calculation
- market settings save behavior

## Persistence Strategy

### Recommended Storage

Persist the new setting alongside the existing main settings data model, not inside shopping pricing policy rows.

Because `settings/page.tsx` already reads and writes global configuration through RPC-backed settings flows, the cleanest direction is:

- add global config fields for base labor sell mode and multiplier
- load them in `settings/page.tsx`
- save them through a dedicated global settings path
- have catalog read the same global settings path

### Required Behavior

- default mode: `RULE`
- multiplier required only in `MULTIPLIER`
- invalid or missing multiplier in multiplier mode must fail closed to `RULE`

## UI Placement

### Main Settings Page

Within `web/src/app/(app)/settings/page.tsx`, add the controls in the `기본공임` tab near the existing global base labor rule authoring controls.

Recommended placement:

- after the tab help text
- before or above the rule-band table

This keeps the mode selector adjacent to the base labor rules it can override.

### Display Rules

- show `배수` input only when `MULTIPLIER` is selected, or disable it in `RULE`
- explain that this affects catalog base labor automatic sell calculation only

## Catalog Runtime Behavior

`web/src/app/(app)/catalog/page.tsx` continues to use the extracted helper in `web/src/lib/catalog/base-labor-sell-mode.ts`.

The difference is only the config source:

- before: active shopping pricing policies
- after: main settings global base labor config

The helper contract remains useful:

- one path for `RULE`
- one path for `MULTIPLIER`
- fail closed on invalid input

## Error Handling

Main settings save must reject:

- invalid mode values
- multiplier mode without a positive multiplier

Catalog must fail closed:

- if global settings fail to load, use `RULE`
- if multiplier data is invalid, use `RULE`

This is preferable to silently applying stale or partially saved multiplier values.

## Migration / Cleanup

### Feature Cleanup

The shopping-bound multiplier changes become dead-end work and must be removed from active behavior.

That cleanup includes:

- remove shopping UI controls for multiplier authoring
- remove shopping API fields added only for this mistaken placement, if they are no longer needed
- remove catalog dependency on shopping pricing policy for base labor mode

### Database Caution

The already-pushed `pricing_policy` columns now exist remotely. Because they were already applied, cleanup must be handled carefully:

- do not destructively drop columns as part of the first corrective patch unless explicitly desired
- it is acceptable to leave them unused temporarily while moving the real source of truth to main settings

## Testing Strategy

Add or update tests to prove:

- main settings page renders the mode and multiplier controls in `기본공임`
- shopping factors no longer renders multiplier controls
- catalog reads main settings, not shopping pricing policy, for base labor mode
- mixed shopping policies do not matter anymore for this feature
- `RULE` and `MULTIPLIER` both work in live smoke tests from `http://localhost:3000/settings`

## Success Criteria

- user can set `RULE` vs `MULTIPLIER` from `http://localhost:3000/settings`
- the controls live under `글로벌 마진 > 기본공임`
- shopping pages do not own or present this feature
- catalog base labor follows the main settings choice only
- center/sub/plating logic remains unchanged
- market settings save remains fixed
