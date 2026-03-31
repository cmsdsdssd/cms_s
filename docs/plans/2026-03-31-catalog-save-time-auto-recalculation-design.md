# Catalog Save-Time Auto-Recalculation Design

**Date:** 2026-03-31

**Goal:**
Ensure catalog saves always persist the latest auto-calculated sell values even when the user edits cost fields and clicks save without blurring the input first.

## Problem

The catalog editor currently recalculates several sell fields from cost fields during field-level interactions such as blur.

That creates a race in the save path:

- user edits a cost field
- user clicks `저장` immediately
- `handleSave` builds the payload from current state before the blur-driven recalculation fully updates sell state

Result:

- sell values can be saved without the latest rule or multiplier applied
- users must click elsewhere first to reliably persist the calculated result

## Decision

### Save Must Recalculate Before Payload Creation

`web/src/app/(app)/catalog/page.tsx` should perform a final save-time normalization step before it constructs the `/api/master-item` payload.

That normalization recomputes all currently auto-calculated sell fields from the latest cost inputs, using the same logic the editor already uses during blur-time recalculation.

### Scope

The user confirmed the save-time recalculation should cover the full auto-calculation surface, not just base labor.

That includes every field in the current editor that follows cost-to-sell auto-application logic, including:

- base labor
- stone labor branches currently auto-calculated from cost
- plating sell from plating cost
- any other current cost-to-sell automatic derivations in the save flow

## Recommended Approach

### Centralize The Calculation Step

The best fix is to extract the existing auto-calculation behavior into a reusable save-time normalization function.

Flow becomes:

1. user edits fields normally
2. blur-time helpers may still update visible state for immediate feedback
3. on `저장`, `handleSave` runs save-time normalization using the latest raw input state
4. normalized values are used to build the final payload
5. save proceeds only after normalization completes successfully

This avoids depending on event ordering between click, blur, and state flush timing.

## Why This Approach

### Better Than Change-Time Recalculation

Running pricing-rule fetches on every keystroke would:

- increase network chatter
- create UI flicker
- make partial input states noisy and error-prone

### Better Than Server-Only Recalculation

Re-implementing catalog auto-calculation only on the server would:

- duplicate rule logic
- widen the change scope substantially
- risk divergence between UI preview and saved result

Save-time normalization preserves the current client-side model while fixing the persistence bug.

## Intended Behavior

### Normal Editing

Existing blur-based behavior remains.

If the user tabs out of a field, the editor may still immediately show the updated sell value.

### Save Button

When the user clicks `저장`:

- the editor recomputes all auto-calculated sell fields from the latest cost fields
- the final computed values are used for the save payload
- save does not proceed with stale pre-recalculation sell values

### Failure Handling

If any required save-time recalculation fails:

- do not save partial or stale values
- show an error toast
- keep the editor open so the user can retry

This is safer than silently saving outdated sell amounts.

## Architectural Shape

### Reusable Normalization Function

Introduce a helper used by `handleSave` that returns a fully normalized snapshot for save.

That helper should:

- read current editor state values
- invoke the same rule and multiplier logic used by field-level helpers
- return normalized sell values without requiring the user to trigger blur first

The helper should be narrow and focused on save-time data preparation, not on UI rendering.

### State Update Policy

Preferred behavior:

- use normalized values for payload construction immediately
- also push normalized values back into React state before or after successful save so the visible editor stays aligned with what was persisted

This prevents post-save mismatch between displayed values and saved values.

## Non-Goals

This fix should not change:

- rule definitions
- multiplier definitions
- settings ownership of base labor mode
- shopping settings behavior
- market settings save behavior
- non-auto-calculated manual fields

## Testing Strategy

Add regression coverage for:

- saving immediately after editing a cost field without blur
- `RULE` mode applying correctly at save time
- `MULTIPLIER` mode applying correctly at save time
- stone and plating auto-calculation still normalizing on save
- unchanged behavior when the user already blurred before saving

Add a real browser smoke test that:

- edits cost
- clicks save directly
- verifies persisted values reflect the latest calculated sell values

## Success Criteria

- user no longer needs to click elsewhere before saving
- save button always applies the latest auto-calculation logic
- stale sell values are not saved when a newer cost edit exists
- `RULE` and `MULTIPLIER` both work in save-time normalization
- non-auto-calculated fields remain unchanged
