# Shipments Order Search Filters Plan

## TL;DR

> **Quick Summary**: Add default filters for `is_store_pickup = false` on `/shipments` order lookup and `/shipments_main` unshipped list, with a “매장출고” toggle and AND/OR operator for combining “미출고만” + “매장출고” while keeping search text as AND.
>
> **Deliverables**:
> - Updated order lookup query/view to expose `is_store_pickup` (latest shipment header; missing -> false)
> - UI toggles and filter logic on `/shipments` and `/shipments_main`
> - Agent-executed QA scenarios (no automated tests)
>
> **Estimated Effort**: Short
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Update lookup data source → Update `/shipments` UI/filter → Update `/shipments_main` UI/filter

---

## Context

### Original Request
Shipments와 shipments_main에 기본 활성 필터로 `is_store_pickup=false`를 추가하고, 매장출고 토글 on/off를 제공. 기본은 OFF. 미출고만 기본 필터 유지. AND/OR로 필터 엮기.

### Interview Summary
**Key Discussions**:
- 기본 필터는 “미출고만” + `is_store_pickup=false`.
- “매장출고” 토글은 OFF 기본, ON/OFF로 필터 적용.
- AND/OR는 “미출고만” + “매장출고” 조합에만 적용, 검색어는 항상 AND.
- `is_store_pickup`은 주문검색 쿼리에서 최신 shipment_header 조인으로 판단(없으면 false).
- `/shipments_main`에도 동일한 기본 필터/토글 적용.

**Research Findings**:
- Order lookup API: `web/src/app/api/order-lookup/route.ts` uses `v_cms_order_lookup` (no `is_store_pickup` today).
- `/shipments` lookup filters: `onlyReadyToShip` + `filteredLookupRows` client filtering in `web/src/app/(app)/shipments/page.tsx`.
- `/shipments_main` already has `filterOperator` (AND/OR) pattern in `web/src/app/(app)/shipments_main/page.tsx`.
- `is_store_pickup` exists on `cms_shipment_header` (default false).
- No automated test framework configured; rely on agent-executed QA scenarios.

### Metis Review
**Identified Gaps** (addressed):
- Ensure data source exposes `is_store_pickup` for both pages (update lookup view and unshipped view if needed).
- Define explicit guardrails to avoid altering shipment confirm/save flow.

---

## Work Objectives

### Core Objective
Make “미출고만 + 매장출고 제외” the default for order search and unshipped list, with a visible “매장출고” toggle and AND/OR operator to combine these two filters.

### Concrete Deliverables
- `v_cms_order_lookup` (or API query) extended to expose `is_store_pickup` using latest `cms_shipment_header` per order_line; fallback false if none.
- `/shipments` UI: new “매장출고” toggle + AND/OR control; default states applied.
- `/shipments_main` UI: same toggle + operator applied to unshipped list filtering.

### Definition of Done
- Default filter state on both pages: 미출고만 ON, 매장출고 OFF.
- Toggling 매장출고 ON/OFF updates list as expected (AND/OR respected).
- Search text always AND with other filters.
- No changes to shipment confirm/save flow and RPCs.

### Must Have
- `is_store_pickup=false` default filter active on both pages.
- “매장출고” toggle with OFF default and visible label.
- AND/OR operator applied only to 미출고만 + 매장출고 combination.

### Must NOT Have (Guardrails)
- No changes to shipment confirm/confirm store pickup flows or RPC parameters.
- No new libraries or framework changes.
- No modification to unrelated filtering logic outside `/shipments` and `/shipments_main`.

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO (Playwright dependency only)
- **Automated tests**: None
- **Framework**: none

### Agent-Executed QA Scenarios (MANDATORY)

Scenario: Default filters applied on `/shipments` order lookup
  Tool: Playwright
  Preconditions: Dev server running on http://localhost:3000
  Steps:
    1. Navigate to: http://localhost:3000/shipments
    2. Open order lookup panel (use existing trigger on page)
    3. Assert: “미출고만” toggle is ON by default
    4. Assert: “매장출고” toggle is OFF by default
    5. Assert: list does not include rows marked as store pickup when toggle OFF
    6. Screenshot: .sisyphus/evidence/task-1-shipments-default-filters.png
  Expected Result: Default filter state visible and list reflects `is_store_pickup=false`
  Evidence: .sisyphus/evidence/task-1-shipments-default-filters.png

Scenario: AND/OR operator affects only 미출고+매장출고
  Tool: Playwright
  Preconditions: Dev server running, dataset contains at least one store pickup and one non-store pickup
  Steps:
    1. Navigate to: http://localhost:3000/shipments
    2. Set 검색어 to a value that matches both a store pickup and non-store pickup order
    3. Toggle 매장출고 ON
    4. Toggle operator to OR; assert both types appear
    5. Toggle operator to AND; assert only items matching both filters remain
    6. Screenshot: .sisyphus/evidence/task-1-shipments-and-or.png
  Expected Result: Operator changes only the combination of 미출고+매장출고; search always AND
  Evidence: .sisyphus/evidence/task-1-shipments-and-or.png

Scenario: Default filters applied on `/shipments_main`
  Tool: Playwright
  Preconditions: Dev server running on http://localhost:3000
  Steps:
    1. Navigate to: http://localhost:3000/shipments_main
    2. Assert: default filter includes 미출고만
    3. Assert: “매장출고” toggle OFF by default
    4. Toggle 매장출고 ON and verify list changes accordingly
    5. Screenshot: .sisyphus/evidence/task-2-shipments-main-default.png
  Expected Result: Unshipped list reflects default `is_store_pickup=false` and toggle behavior
  Evidence: .sisyphus/evidence/task-2-shipments-main-default.png

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately):
├── Task 1: Update data source to expose is_store_pickup in order/unshipped views

Wave 2 (After Wave 1):
├── Task 2: Update /shipments UI + filter logic
└── Task 3: Update /shipments_main UI + filter logic

Critical Path: Task 1 → Task 2/Task 3

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|----------------------|
| 1 | None | 2,3 | None |
| 2 | 1 | None | 3 |
| 3 | 1 | None | 2 |

---

## TODOs

- [ ] 1. Expose `is_store_pickup` for lookup/unshipped data

  **What to do**:
  - Update `v_cms_order_lookup` (or API query) to join latest `cms_shipment_header` per `order_line_id`.
  - Add `is_store_pickup` field to lookup output; default false when no shipment header exists.
  - If `/shipments_main` uses `cms_v_unshipped_order_lines` without this field, extend that view similarly.

  **Must NOT do**:
  - Do not change shipment confirm/store pickup RPC behavior.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: DB view changes + data contract changes.
  - **Skills**: `backend-patterns`
    - `backend-patterns`: Needed for SQL/view changes and data shaping.
  - **Skills Evaluated but Omitted**:
    - `security-review`: No new auth/input handling.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (sequential start)
  - **Blocks**: Tasks 2, 3
  - **Blocked By**: None

  **References**:
  - `supabase/migrations/20260208300002_cms_0355_order_lookup_client_code_fix.sql` - current `v_cms_order_lookup` definition
  - `supabase/migrations/20260202220000_cms_0290_store_pickup_pricing_lock.sql` - `is_store_pickup` column
  - `web/src/app/api/order-lookup/route.ts` - order lookup API uses the view
  - `web/src/app/(app)/shipments_main/page.tsx` - unshipped list consumes `cms_v_unshipped_order_lines`

  **Acceptance Criteria**:
  - [ ] Lookup API returns `is_store_pickup` field for each row
  - [ ] Missing shipment header yields `is_store_pickup = false`
  - [ ] `/shipments_main` data source exposes `is_store_pickup` for filtering

- [ ] 2. Add default filters + “매장출고” toggle + AND/OR to `/shipments`

  **What to do**:
  - Add state for `isStorePickupFilter` (default false) and `filterOperator` (default AND/OR as specified).
  - Update `orderLookupQuery` or client filtering to apply `is_store_pickup` with operator rules.
  - Add UI controls: “매장출고” toggle + AND/OR selector near existing “미출고만” filter.

  **Must NOT do**:
  - No changes to shipment save/confirm flows (`handleSaveShipment`, RPCs).

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: localized UI state + filtering change.
  - **Skills**: `frontend-patterns`
    - `frontend-patterns`: ensure state/filters align with existing UI patterns.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: UI is minor and must match existing patterns.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: None
  - **Blocked By**: Task 1

  **References**:
  - `web/src/app/(app)/shipments/page.tsx` - `onlyReadyToShip`, `filteredLookupRows`, order lookup UI
  - `web/src/components/ui/field` and button patterns in existing filters
  - `web/src/app/(app)/shipments_main/page.tsx` - AND/OR toggle pattern for reference

  **Acceptance Criteria**:
  - [ ] Default state: 미출고만 ON, 매장출고 OFF
  - [ ] 매장출고 ON/OFF updates list according to AND/OR rule
  - [ ] Search text always AND with other filters

- [ ] 3. Apply same filter/toggle behavior to `/shipments_main`

  **What to do**:
  - Add `isStorePickupFilter` state and UI control labeled “매장출고” with default OFF.
  - Integrate `is_store_pickup` into `applyFilters` using existing `filterOperator`.
  - Ensure default filters include `is_store_pickup=false` and existing status defaults remain.

  **Must NOT do**:
  - Avoid altering pagination or sorting logic.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: localized filter logic/UI change.
  - **Skills**: `frontend-patterns`
    - `frontend-patterns`: align with existing filter operator patterns.
  - **Skills Evaluated but Omitted**:
    - `backend-patterns`: no DB changes in this task.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 2)
  - **Blocks**: None
  - **Blocked By**: Task 1

  **References**:
  - `web/src/app/(app)/shipments_main/page.tsx` - `filters`, `filterOperator`, `applyFilters`
  - `web/src/components/layout/unified-toolbar.tsx` - toolbar layout pattern

  **Acceptance Criteria**:
  - [ ] Default state matches `/shipments`: 미출고만 ON + 매장출고 OFF
  - [ ] AND/OR operator affects only 미출고+매장출고 combination
  - [ ] List updates when 매장출고 toggled

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1-3 | `feat(shipments): default store-pickup filters` | view/route + page files | QA scenarios only |

---

## Success Criteria

### Verification Commands
```bash
# Run dev server (if not already running)
npm run dev
```

### Final Checklist
- [ ] `/shipments` default filters active (미출고만 + 매장출고 OFF)
- [ ] `/shipments_main` default filters active (미출고만 + 매장출고 OFF)
- [ ] AND/OR operator behaves as specified; search remains AND
- [ ] No changes to shipment confirm/save flow
