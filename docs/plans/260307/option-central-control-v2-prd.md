# Option Central Control v2 PRD (2026-03-07)

## 1) Goal
- Standardize option pricing control with fixed `1차분류 / 2차분류 / 3차분류` headers and central rules as the source of truth.
- Keep quick-edit dropdown driven and block save/sync when any option row remains legacy or unresolved.
- Preserve one-click pipeline as `save -> recompute -> push`, while separating save success from sync failure in status messaging.

## 2) Core Decisions
- Only values defined by central rules are selectable in quick edit for rule-backed categories.
- Legacy or unresolved rows are not allowed to proceed to save or sync.
- Preview and quick-edit status/warnings must reflect the current compact-row evaluation, not stale canonical labels.

## 3) Category Contracts

### 3.1 MATERIAL
- axis1: master material (auto)
- axis2: unused
- axis3: unused
- price: `0`

### 3.2 SIZE
- axis1: material (auto from master or selected mapping)
- axis2: allowed weight values from central SIZE rules
- axis3: resolved reference amount (read only)
- price: resolved amount from matched SIZE rule set

### 3.3 COLOR_PLATING
- axis1: material
- axis2: color code
- axis3: allowed amount choices from matched COLOR rules only
- price: final resolved amount
- resolution rule: the selected axis3 amount is the canonical `resolved_delta_krw`; do not sum every matched COLOR rule.
- source rules: `source_rule_entry_ids` only include rules whose `delta_krw` matches the resolved amount.
- fallback rule: if persisted `resolved_delta_krw` is not in the allowed amount set, keep the row as legacy/warning.

### 3.4 DECOR
- axis1: material text (read only, auto from selected decor model snapshot/material)
- axis2: decor model selector
- axis3: read-only reference summary formatted as `weight | labor`
- price: final stored amount (read only)
- final amount continues to come from stored decor rule result (`base labor + additive`).

### 3.5 OTHER
- axis1: material
- axis2: reason
- axis3: amount
- price: entered amount

### 3.6 NOTICE
- axis1: notice value
- axis2: unused
- axis3: unused
- price: `0`

## 4) Save / Sync Policy
1. Validate quick-edit state using the current compact rows.
2. If any row is legacy or unresolved, disable `옵션값 저장` and fail fast if save is attempted programmatically.
3. On successful save, continue with recompute and push.
4. Show save success and sync failure as separate states so operators can distinguish persisted data from downstream push issues.

## 5) Acceptance Criteria
1. Fixed headers remain `1차분류`, `2차분류`, `3차분류`.
2. COLOR axis3 only shows rule-defined amounts for the selected material + color.
3. COLOR resolved result equals the selected axis3 amount.
4. DECOR quick-edit shows material in axis1, model selector in axis2, reference summary in axis3, and final amount in price.
5. Any legacy/unresolved row blocks save and sync.
6. Preview and quick-edit warnings/counts use the current compact-row evaluation.
