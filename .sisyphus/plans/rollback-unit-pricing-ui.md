# Rollback UNIT Pricing UI

## TL;DR

> **Quick Summary**: Roll back only the UNIT pricing-mode UI and unit policy settings while preserving existing RULE and pre-existing AMOUNT_ONLY behavior. Remove pricing RPC usage for line pricing and unit policy, keeping confirm on `cms_fn_confirm_shipment_v3_cost_v1`.
> 
> **Deliverables**:
> - Remove UNIT/pricing_mode UI and related state/handlers in shipment UIs
> - Remove pricing RPC usage (`cms_fn_update_shipment_line_pricing_v1`)
> - Remove unit policy settings UI and RPC (`cms_fn_set_unit_pricing_policy_v1`)
> - Keep confirm flow on `cms_fn_confirm_shipment_v3_cost_v1`
> 
> **Estimated Effort**: Short
> **Parallel Execution**: NO - sequential (shared files)
> **Critical Path**: Update contracts → update shipment UIs → update settings → verification

---

## Context

### Original Request
Rollback only UNIT pricing-mode UI and unit policy settings. Keep RULE behavior and pre-existing AMOUNT_ONLY. Remove pricing RPC usage. Confirm must still use `cms_fn_confirm_shipment_v3_cost_v1`. No tests, manual verification only.

### Interview Summary
**Key Discussions**:
- AMOUNT_ONLY (총액 덮어쓰기) existed before UNIT work and must be preserved.
- Remove pricing_mode dropdown and UNIT-only inputs/state/handlers.
- Remove pricing update RPC (`cms_fn_update_shipment_line_pricing_v1`) and unit policy RPC (`cms_fn_set_unit_pricing_policy_v1`).
- Keep confirm flow on `cms_fn_confirm_shipment_v3_cost_v1`.
- No automated tests; manual verification required.

**Research Findings**:
- `web/src/lib/contracts.ts` contains `shipmentUpdateLinePricing` and `unitPricingPolicySet`.
- `web/src/components/shipment/inline-shipment-panel.tsx` contains pricing_mode dropdown, UNIT inputs, and `shipmentUpdateLinePricing` call.
- `web/src/app/(app)/shipments/page.tsx` contains pricing_mode dropdown, UNIT inputs, and `shipmentUpdateLinePricing` calls.
- `web/src/app/(app)/settings/page.tsx` includes unit_pricing_* fields, unit policy UI, and RPC call.

### Metis Review
**Identified Gaps** (addressed):
- Metis tool invocation failed due to tool error (JSON parse). Proceeding with explicit guardrails and self-review.

---

## Work Objectives

### Core Objective
Remove only the UNIT/pricing_mode UI and unit pricing policy settings while preserving existing RULE and AMOUNT_ONLY functionality and confirm flow.

### Concrete Deliverables
- No pricing_mode dropdown or UNIT-only inputs in shipment UIs.
- No calls to `cms_fn_update_shipment_line_pricing_v1` or `cms_fn_set_unit_pricing_policy_v1`.
- AMOUNT_ONLY UI/behavior preserved.
- Confirm flow still uses `cms_fn_confirm_shipment_v3_cost_v1`.

### Definition of Done
- `rg` finds zero occurrences of: `cms_fn_update_shipment_line_pricing_v1`, `cms_fn_set_unit_pricing_policy_v1`, `unit_pricing_min_margin_rate`, `unit_pricing_rounding_unit_krw`, and `UNIT` within shipment UI files.
- Shipment UIs show no pricing_mode dropdown and no UNIT fields; AMOUNT_ONLY remains if it existed.
- Settings page shows no unit pricing policy card.
- Confirm path still references `cms_fn_confirm_shipment_v3_cost_v1`.

### Must Have
- Rollback ONLY UNIT/pricing_mode UI and unit policy settings.
- Preserve RULE and existing AMOUNT_ONLY behavior.

### Must NOT Have (Guardrails)
- Do not refactor unrelated code.
- Do not touch DB migrations or SQL.
- Do not alter confirm RPC away from `cms_fn_confirm_shipment_v3_cost_v1`.

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.
> This is NOT conditional — it applies to EVERY task.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: NO
- **Framework**: None

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

Use Playwright for UI verification and Bash for grep/build checks.

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately):
- Task 1 (contracts cleanup)

Wave 2 (After Wave 1):
- Task 2 (inline shipment UI rollback)
- Task 3 (shipments page rollback)

Wave 3 (After Wave 2):
- Task 4 (settings UI rollback)

Wave 4 (After Wave 3):
- Task 5 (verification)

Critical Path: Task 1 → Task 2/3 → Task 4 → Task 5

---

## TODOs

- [ ] 1. Remove UNIT/pricing RPC keys from contracts

  **What to do**:
  - Remove `shipmentUpdateLinePricing` and `unitPricingPolicySet` from `CONTRACTS.functions`.
  - Ensure `shipmentConfirmV3Cost` remains mapped to `cms_fn_confirm_shipment_v3_cost_v1`.

  **Must NOT do**:
  - Do not change other RPC mappings.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single-file key removal.
  - **Skills**: `git-master`
    - `git-master`: Track minimal diff for rollback-only change.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No UI design needed.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (Sequential)
  - **Blocks**: Tasks 2–5
  - **Blocked By**: None

  **References**:
  - `web/src/lib/contracts.ts` — contains `shipmentUpdateLinePricing` and `unitPricingPolicySet` entries to remove.

  **Acceptance Criteria**:
  - `shipmentUpdateLinePricing` is removed from `CONTRACTS.functions`.
  - `unitPricingPolicySet` is removed from `CONTRACTS.functions`.
  - `shipmentConfirmV3Cost` remains mapped to `cms_fn_confirm_shipment_v3_cost_v1`.

  **Agent-Executed QA Scenarios**:
  Scenario: Contracts keys removed
    Tool: Bash (rg)
    Preconditions: repo at root
    Steps:
      1. Run: `rg "shipmentUpdateLinePricing|unitPricingPolicySet" web/src/lib/contracts.ts`
      2. Assert: no matches
    Expected Result: keys removed
    Evidence: stdout capture

- [ ] 2. Roll back UNIT/pricing_mode UI in inline shipment panel

  **What to do**:
  - Remove pricing_mode dropdown and UNIT-only inputs/state/handlers.
  - Remove calls to `cms_fn_update_shipment_line_pricing_v1`.
  - Preserve existing AMOUNT_ONLY UI/behavior (총액 덮어쓰기) if it existed pre-UNIT.
  - Ensure save flow only calls `cms_fn_shipment_update_line_v1` and refetches.

  **Must NOT do**:
  - Do not remove AMOUNT_ONLY behavior.
  - Do not alter unrelated cost/weight logic.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multi-section UI rollback with careful preservation.
  - **Skills**: `frontend-patterns`, `coding-standards`
    - `frontend-patterns`: Maintain existing UI patterns.
    - `coding-standards`: Avoid unintended logic changes.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No new design needed.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1

  **References**:
  - `web/src/components/shipment/inline-shipment-panel.tsx` — pricing_mode dropdown, UNIT block, and pricing RPC call.

  **Acceptance Criteria**:
  - No pricing_mode dropdown in inline panel UI.
  - No UNIT-only fields or state remain.
  - No call to `cms_fn_update_shipment_line_pricing_v1`.
  - AMOUNT_ONLY UI remains if it existed before UNIT work.

  **Agent-Executed QA Scenarios**:
  Scenario: Inline panel has no pricing_mode dropdown
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Navigate to shipment inline panel context
      2. Assert: no select/label containing "Pricing Mode" or "UNIT"
      3. Screenshot: `.sisyphus/evidence/task-2-inline-no-pricing-mode.png`
    Expected Result: dropdown removed
    Evidence: screenshot

  Scenario: AMOUNT_ONLY input still present (if pre-existing)
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Navigate to inline panel edit area
      2. Locate total override input (총액/덮어쓰기)
      3. Assert: input exists and is usable
      4. Screenshot: `.sisyphus/evidence/task-2-inline-amount-only.png`
    Expected Result: AMOUNT_ONLY retained
    Evidence: screenshot

- [ ] 3. Roll back UNIT/pricing_mode UI in shipments page

  **What to do**:
  - Remove pricing_mode dropdown and UNIT-only inputs/state/handlers.
  - Remove pricing RPC mutation usage.
  - Keep AMOUNT_ONLY if it existed pre-UNIT.
  - Ensure save flow only uses `cms_fn_shipment_update_line_v1` and refetches line data.

  **Must NOT do**:
  - Do not alter confirm flow or RULE calculations.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multiple UI sections + save flow adjustments.
  - **Skills**: `frontend-patterns`, `coding-standards`
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No new design required.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (with Task 2)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1

  **References**:
  - `web/src/app/(app)/shipments/page.tsx` — pricing_mode dropdown, UNIT block, pricing RPC mutation and calls.

  **Acceptance Criteria**:
  - No pricing_mode dropdown in shipments page UI.
  - No UNIT-only fields or state remain.
  - No call to `cms_fn_update_shipment_line_pricing_v1`.
  - AMOUNT_ONLY UI remains if it existed before UNIT work.

  **Agent-Executed QA Scenarios**:
  Scenario: Shipments page has no pricing_mode dropdown
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Navigate to shipments page
      2. Assert: no select/label containing "Pricing Mode" or "UNIT"
      3. Screenshot: `.sisyphus/evidence/task-3-shipments-no-pricing-mode.png`
    Expected Result: dropdown removed
    Evidence: screenshot

- [ ] 4. Remove unit pricing policy settings UI and RPC

  **What to do**:
  - Remove `unit_pricing_min_margin_rate` and `unit_pricing_rounding_unit_krw` fields from settings page types, state, select clause, and UI.
  - Remove `unitPricingPolicySet` mutation and save handler.

  **Must NOT do**:
  - Do not alter other settings cards or existing market tick config save.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Contained removal in one file.
  - **Skills**: `coding-standards`
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No new design work.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 5
  - **Blocked By**: Tasks 2–3

  **References**:
  - `web/src/app/(app)/settings/page.tsx` — unit policy UI, state, mutation, and select clause.
  - `web/src/lib/contracts.ts` — `unitPricingPolicySet` mapping to remove.

  **Acceptance Criteria**:
  - No unit pricing policy card in settings UI.
  - No usage of `unit_pricing_min_margin_rate` or `unit_pricing_rounding_unit_krw` in settings code.

  **Agent-Executed QA Scenarios**:
  Scenario: Settings page has no unit pricing policy card
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Navigate to settings page
      2. Assert: no card/title containing "단가제 정책"
      3. Screenshot: `.sisyphus/evidence/task-4-settings-no-unit-policy.png`
    Expected Result: unit policy card removed
    Evidence: screenshot

- [ ] 5. Verification and regressions

  **What to do**:
  - Run rg checks to confirm zero occurrences of removed strings.
  - Run `npm run build` and report any failures (note pre-existing issues if encountered).
  - Confirm confirm RPC still uses `cms_fn_confirm_shipment_v3_cost_v1` via contracts or call sites.

  **Must NOT do**:
  - Do not fix unrelated build issues unless explicitly asked.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: Tasks 1–4

  **References**:
  - `web/src/lib/contracts.ts` — confirm RPC mapping.
  - `web/src/components/shipment/inline-shipment-panel.tsx` — shipment UI.
  - `web/src/app/(app)/shipments/page.tsx` — shipment UI.
  - `web/src/app/(app)/settings/page.tsx` — settings UI.

  **Acceptance Criteria**:
  - `rg "cms_fn_update_shipment_line_pricing_v1|cms_fn_set_unit_pricing_policy_v1|unit_pricing_min_margin_rate|unit_pricing_rounding_unit_krw" web -g "*.ts*"` → no matches.
  - `rg "UNIT" web/src/components/shipment/inline-shipment-panel.tsx web/src/app/(app)/shipments/page.tsx` → no matches (except comments if any).
  - `npm run build` executed and result reported.
  - Confirm mapping still points to `cms_fn_confirm_shipment_v3_cost_v1`.

  **Agent-Executed QA Scenarios**:
  Scenario: rg checks pass
    Tool: Bash (rg)
    Preconditions: repo at root
    Steps:
      1. Run rg commands above
      2. Assert: zero matches
    Expected Result: removed strings not present
    Evidence: stdout capture

---

## Commit Strategy

| After Task | Message | Files | Verification |
|-----------|---------|-------|--------------|
| 5 | `chore(rollback): remove unit pricing UI` | UI + contracts files | rg + build |

---

## Success Criteria

### Verification Commands
```bash
rg "cms_fn_update_shipment_line_pricing_v1|cms_fn_set_unit_pricing_policy_v1|unit_pricing_min_margin_rate|unit_pricing_rounding_unit_krw" web -g "*.ts*"
rg "UNIT" web/src/components/shipment/inline-shipment-panel.tsx web/src/app/(app)/shipments/page.tsx
npm run build
```

### Final Checklist
- [ ] Pricing_mode dropdown removed in both shipment UIs
- [ ] UNIT-only inputs and state removed
- [ ] AMOUNT_ONLY retained
- [ ] Unit pricing policy settings removed
- [ ] No pricing RPC usage remains
- [ ] Confirm RPC still v3 cost
