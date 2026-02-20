# Shipments Main UI Enhancement Plan

## TL;DR

> **Quick Summary**: Refine the Shipments Main page UI only (layout, hierarchy, visual polish), keeping all data flow, handlers, and routes intact. Add optional summary cards derived from existing counts, and improve loading/empty states without introducing new filters or libraries.
>
> **Deliverables**:
> - Updated workbench header/panel layout
> - Tidy filter/search layout with existing controls only
> - Premium list row styling with hover/lift and clearer hierarchy
> - Loading and empty states for list rendering
> - Optional count-based summary cards derived from existing data
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 3

---

## Context

### Original Request
UI-only enhancement for `web/src/app/(app)/shipments_main/page.tsx`. Keep logic/data flow/handlers/links/routes/params identical; no new libs. Goals: workbench header panel, tidy filters/search layout, premium list rows with hover/lift, improved info hierarchy, loading/empty states, optional safe summary cards (counts). No new filters/toggles and no data changes.

### Interview Summary
**Key Decisions**:
- Manual-only verification (no test infra setup).
- Include optional summary cards derived safely from existing data counts/lengths; no new fetches.

**Research Findings**:
- Internal patterns from `web/src/app/(app)/shipments/page.tsx`: card headers with `border-b` and `bg-[#fcfcfd]`, rounded panels, subtle lift hover (`hover:-translate-y-0.5`, `hover:shadow-[var(--shadow-sm)]`), muted hierarchy, and list hover patterns.
- External UI patterns: premium rows favor subtle hover shadows, truncation with hierarchy, and compact meta lines; empty/loading states use centered messaging and skeleton/pulse patterns without new libs.

---

## Work Objectives

### Core Objective
Deliver a refined, premium UI presentation for the shipments list and filters while preserving all behavior, events, and data usage.

### Concrete Deliverables
- Updated layout/styling in `web/src/app/(app)/shipments_main/page.tsx` only.
- Summary cards section using `applyFilters.length` and existing query data counts only.
- Loading and empty states aligned to current structure.

### Definition of Done
- The page renders with the enhanced header, filters, list row styles, and states.
- No new filters/toggles or data fields added.
- All existing handlers, routes, parameters, and query behavior remain unchanged.

### Must Have
- Visual enhancements only; no logic or data changes.
- Summary cards based solely on existing counts/lengths.

### Must NOT Have (Guardrails)
- No new libraries or components.
- No changes to query keys, query functions, or filter logic.
- No new filters, toggles, or actions.
- No changes to Link routes (`/shipments`).

---

## Verification Strategy (Manual-only)

### Test Decision
- **Infrastructure exists**: NO (no test framework detected)
- **User wants tests**: NO
- **Framework**: none

### Manual Verification Steps (Agent-Executable)
1. Run `npm run dev` (or `pnpm dev`/`yarn dev`) in `web/` and load `http://localhost:3000`.
2. Navigate to the shipments main page (same route as before). Confirm:
   - Header/workbench area shows the enhanced panel layout.
   - Filters layout is tidy and uses only existing controls.
   - List rows show improved hierarchy and hover/lift.
   - Loading state appears while queries are in flight (driven only by existing `useQuery` flags).
   - Empty state appears when filters return zero rows.
   - Optional summary cards show correct counts based on existing data.
3. Loading verification (deterministic):
   - Use DevTools Network throttling (e.g., Slow 3G) and hard refresh to observe loading skeletons.
4. Functional immutability check:
   - Verify no new buttons/filters/toggles are added.
   - Confirm “출고 입력” link route remains `/shipments`.
   - Ensure filter interactions (add/update/remove) behave exactly as before.
5. Mobile viewport check (layout-only):
   - Resize to mobile width; verify cards and list stack naturally without layout breaks.
6. Code immutability check:
   - Review diff for `web/src/app/(app)/shipments_main/page.tsx` and confirm changes are limited to layout/styling/markup reorganization only, with no changes to query definitions, handlers, or filter logic.

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately):
├── Task 1: Audit and map UI sections for safe edit zones
└── Task 2: Define summary cards + header/filters layout plan

Wave 2 (After Wave 1):
└── Task 3: Implement UI layout + row styling + loading/empty states

Critical Path: Task 1 → Task 2 → Task 3

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|----------------------|
| 1 | None | 3 | 2 |
| 2 | 1 | 3 | 1 |
| 3 | 1, 2 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 2 | quick + frontend-patterns |
| 2 | 3 | artistry + frontend-ui-ux |

---

## TODOs

- [ ] 1. Map UI zones and guardrails in `shipments_main` page

  **What to do**:
  - Identify UI-only sections: ActionBar, filters card, list card, list rows, empty state.
  - Mark locations that must not change (queries, handlers, links).

  **Must NOT do**:
  - Do not alter data queries (`useQuery` blocks) or `applyFilters` logic.
  - Do not change route targets or event handlers.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: straightforward mapping and guardrail review.
  - **Skills**: [`frontend-patterns`, `coding-standards`]
    - `frontend-patterns`: identify existing UI pattern conventions.
    - `coding-standards`: avoid unintended logic changes.
  - **Skills Evaluated but Omitted**:
    - `tdd-workflow`: no test infra and manual verification chosen.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 3
  - **Blocked By**: None

  **References**:
  - `web/src/app/(app)/shipments_main/page.tsx:58` - `useQuery` blocks to remain unchanged.
  - `web/src/app/(app)/shipments_main/page.tsx:142` - `applyFilters` logic to preserve.
  - `web/src/app/(app)/shipments_main/page.tsx:185` - ActionBar with `/shipments` link to keep intact.

  **Acceptance Criteria**:
  - [ ] Guardrail list produced and used during implementation.

- [ ] 2. Define summary cards + header/filters layout plan

  **What to do**:
  - Plan summary cards derived from counts only (e.g., `applyFilters.length`, total shipments count, filtered vs total).
  - Draft header/workbench arrangement using existing components.
  - Ensure filters/search layout uses current controls only.

  **Must NOT do**:
  - Do not introduce new filters or toggles.
  - Do not add new data sources or fetches.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: layout planning and safe data sourcing.
  - **Skills**: [`frontend-patterns`, `frontend-ui-ux`]
    - `frontend-patterns`: align with existing cards/layout.
    - `frontend-ui-ux`: improve hierarchy and composition.
  - **Skills Evaluated but Omitted**:
    - `backend-patterns`: not relevant (UI-only).

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 3
  - **Blocked By**: Task 1

  **References**:
  - `web/src/app/(app)/shipments_main/page.tsx:198` - existing filter card to reorganize.
  - `web/src/app/(app)/shipments_main/page.tsx:267` - list header area for summary counts.
  - `web/src/app/(app)/shipments/page.tsx:610` - workbench header and panel styling pattern.

  **Acceptance Criteria**:
  - [ ] Summary cards spec uses only existing counts/lengths.
  - [ ] Header/filters layout plan preserves controls and handlers.

- [ ] 3. Implement UI enhancements (layout, rows, loading/empty states)

  **What to do**:
  - Apply header/workbench and filter layout styling updates.
  - Add summary cards (count-based only) without new data.
  - Enhance list rows: hierarchy, spacing, hover/lift, muted meta lines.
  - Add loading state for queries and improved empty state presentation (conditional rendering only).

  **Must NOT do**:
  - No modifications to query keys/functions, filter logic, or event handlers.
  - No new routes or links.
  - No new filters/toggles.

  **Recommended Agent Profile**:
  - **Category**: `artistry`
    - Reason: UI polish and hierarchy improvements.
  - **Skills**: [`frontend-ui-ux`, `frontend-patterns`]
    - `frontend-ui-ux`: premium row styling and spacing.
    - `frontend-patterns`: consistent component usage.
  - **Skills Evaluated but Omitted**:
    - `security-review`: no auth/input handling changes.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential)
  - **Blocks**: None
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `web/src/app/(app)/shipments_main/page.tsx:185` - ActionBar workbench area.
  - `web/src/app/(app)/shipments_main/page.tsx:198` - filter layout block.
  - `web/src/app/(app)/shipments_main/page.tsx:267` - list container and rows.
  - `web/src/app/(app)/shipments_main/page.tsx:303` - empty state text.
  - `web/src/app/(app)/shipments/page.tsx:647` - card header styling and hover lift pattern.

  **Acceptance Criteria**:
  - [ ] Summary cards show correct counts derived from existing data only.
  - [ ] Loading state appears while shipments/customers/lines are fetching using existing query flags only.
  - [ ] Empty state is visually distinct and clear when `applyFilters.length === 0`.
  - [ ] No new filters/toggles introduced.
  - [ ] Handlers, links, and query logic remain unchanged.

---

## Commit Strategy

- Commit: NO (user did not request)

---

## Success Criteria

### Functional Immutability
- Filter add/update/remove behavior is identical to current behavior.
- Link route for “출고 입력” remains `/shipments`.
- `useQuery` blocks and `applyFilters` logic remain unchanged.

### Visual Outcome
- Header/workbench area is cohesive and premium.
- Filters/search area is tidy and space-efficient.
- List rows have stronger hierarchy and subtle hover lift.
- Loading and empty states are clear and consistent.

### Verification Commands
```bash
cd web
npm run dev
```

---

## Next Step
After review, run `/start-work` to execute this plan.
