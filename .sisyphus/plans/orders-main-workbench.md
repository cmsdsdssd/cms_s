# Orders Main Workbench UI Redesign

## TL;DR

> **Quick Summary**: Restyle `web/src/app/(app)/orders_main/page.tsx` into a "주문 작업대" workbench with a tool-rail + bench layout, richer sectioning, improved row styling, and accessible focus/hover states while preserving all logic and data flow.
>
> **Deliverables**:
> - Updated layout/styling in `web/src/app/(app)/orders_main/page.tsx`
> - Workbench-like filters rail and bench list presentation
> - Improved empty/skeleton visuals using existing branches
>
> **Estimated Effort**: Short
> **Parallel Execution**: NO - sequential due to single-file edits
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4

---

## Context

### Original Request
UI/UX-only redesign of `web/src/app/(app)/orders_main/page.tsx` to a "주문 작업대" workbench style. Keep logic/handlers/routes/queries unchanged. Allowed: layout/styles/Tailwind, hover/transition, a11y focus, skeleton/empty states in existing branches, presentational components only. Forbidden: new features/filters/toggles, changing fetch/handlers, new libs. Run manual verification plus `npm run lint` and `npm run build` if available. Use fixed reporting format from instructions.

### Interview Summary
**Key Discussions**:
- Only styling/layout changes; no data or behavior changes.
- Manual verification plus `npm run lint`/`npm run build`.

**Research Findings**:
- Workbench UIs emphasize a tool-rail + bench layout, strong section headers, dense data grids, and clear focus/hover states. Split-view is optional.
- Accessibility: focus-visible rings and sufficient contrast.

### Metis Review
**Identified Gaps** (addressed):
- Metis tool unavailable in this session. User approved proceeding without Metis; note in guardrails and acceptance criteria.

---

## Work Objectives

### Core Objective
Transform the orders page into a "주문 작업대" workbench visual language while preserving all existing logic and data flow.

### Concrete Deliverables
- `web/src/app/(app)/orders_main/page.tsx` updated with:
  - Workbench layout hierarchy (tool rail + bench)
  - Section headers, improved spacing, and visual grouping
  - Row styling with clearer grid alignment and hover/focus states
  - Enhanced empty/skeleton visuals in existing branches

### Definition of Done
- [ ] No changes to queries, handlers, routes, or data shape.
- [ ] Workbench layout is visually clear on desktop and mobile.
- [ ] Empty state and skeleton states appear in existing branches only.
- [ ] `npm run lint` and `npm run build` succeed from `web`.

### Must Have
- Workbench-like tool rail and bench layout without new features.
- Clear section headings and column labeling.
- A11y-visible focus rings for interactive controls.

### Must NOT Have (Guardrails)
- No changes to data fetching, filter logic, or routing.
- No new filters, toggles, summary widgets, or features.
- No new libraries or component dependencies.
- Avoid introducing new state beyond presentational needs.

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: NO
- **User wants tests**: Manual-only
- **Framework**: none

### Manual Verification Plan
1. Run the page locally and visually confirm the workbench layout on desktop and mobile breakpoints.
2. Verify filters rail and list bench have clear section headers and grouping.
3. Verify hover and focus states are visible for filter inputs and action buttons.
4. Simulate empty state (e.g., date filter with no results) and confirm the new empty UI.
5. Trigger loading state and confirm skeleton rows appear (use slow network or devtools throttling).

### Required Commands
Run from `web`:
- `npm run lint` (expect exit code 0)
- `npm run build` (expect exit code 0)

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
└── Task 1: Workbench layout scaffolding

Wave 2 (After Wave 1):
└── Task 2: Filters rail refinements

Wave 3 (After Wave 2):
└── Task 3: Bench list styling + column headers

Wave 4 (After Wave 3):
└── Task 4: Skeleton + empty state visuals
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|----------------------|
| 1 | None | 2, 3, 4 | None |
| 2 | 1 | 3, 4 | None |
| 3 | 2 | 4 | None |
| 4 | 3 | None | None |

---

## TODOs

- [ ] 1. Workbench layout scaffolding in root and section framing

  **What to do**:
  - Restructure top-level layout to express a tool-rail + bench hierarchy using existing grid.
  - Add a subtle background/bench atmosphere (e.g., gradient or pattern via Tailwind utilities) without new assets.
  - Update ActionBar text to match "주문 작업대" language while retaining existing component usage.

  **Must NOT do**:
  - Do not introduce new panels requiring new data or interactions.

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
    - Reason: UI layout and visual hierarchy work.
  - **Skills**: `frontend-ui-ux`, `frontend-patterns`
    - `frontend-ui-ux`: Workbench visual direction and composition.
    - `frontend-patterns`: Responsive layout and Tailwind idioms.
  - **Skills Evaluated but Omitted**:
    - `backend-patterns`: No backend changes.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 2, Task 3, Task 4
  - **Blocked By**: None

  **References**:
  - `web/src/app/(app)/orders_main/page.tsx:41` - Root layout and ActionBar section.
  - `web/src/components/layout/action-bar.tsx` - ActionBar layout patterns and typography.
  - `web/src/components/ui/card.tsx` - Card container defaults (border, bg, shadow) to align with new layout.

  **Acceptance Criteria**:
  - [ ] Page top-level layout clearly reads as tool-rail + bench on large screens.
  - [ ] ActionBar title/subtitle updated to workbench tone without logic changes.

- [ ] 2. Refine filters as a tool rail

  **What to do**:
  - Enhance filter Card header and body spacing to look like a tool rail.
  - Improve filter row grouping and labels while keeping existing controls and logic.
  - Add focus/hover visuals via wrappers and utility classes (no new inputs).

  **Must NOT do**:
  - Do not add new filter types or change existing filter behavior.

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
    - Reason: Tight UI refinements and interaction states.
  - **Skills**: `frontend-ui-ux`, `coding-standards`
    - `frontend-ui-ux`: Tool-rail styling, spacing, and hierarchy.
    - `coding-standards`: Keep classnames consistent with current patterns.
  - **Skills Evaluated but Omitted**:
    - `security-review`: No auth/input handling changes.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 3, Task 4
  - **Blocked By**: Task 1

  **References**:
  - `web/src/app/(app)/orders_main/page.tsx:56` - Filters Card markup and filter row structure.
  - `web/src/components/ui/field.tsx` - Input/Select focus and sizing styles.
  - `web/src/components/ui/badge.tsx` - Badge tone styles for filter chips.

  **Acceptance Criteria**:
  - [ ] Filter rail reads as a distinct tool area with improved grouping.
  - [ ] Inputs/selects remain unchanged functionally and focus-visible ring is clear.

- [ ] 3. Rebuild list bench visuals and column labeling

  **What to do**:
  - Add a column header row (presentational only) to clarify the dense grid.
  - Improve row surface styling: zebra or inset separators, refined typography, and hover elevation.
  - Keep action button placement and links unchanged.

  **Must NOT do**:
  - Do not change data order, column content, or link targets.

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
    - Reason: Dense data grid styling and visual hierarchy.
  - **Skills**: `frontend-ui-ux`, `frontend-patterns`
    - `frontend-ui-ux`: Grid readability and workbench styling.
    - `frontend-patterns`: Tailwind layout primitives for grids.
  - **Skills Evaluated but Omitted**:
    - `backend-patterns`: No data changes.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 4
  - **Blocked By**: Task 2

  **References**:
  - `web/src/app/(app)/orders_main/page.tsx:328` - List Card header and current row grid.
  - `web/src/components/ui/button.tsx` - Button variants for hover/focus.
  - `web/src/components/ui/card.tsx` - Card shell styling for the bench area.

  **Acceptance Criteria**:
  - [ ] Column labels improve scanability without changing data.
  - [ ] Row styling supports workbench density and hover clarity.

- [ ] 4. Add skeleton and empty-state visuals

  **What to do**:
  - Use existing query states (`ordersQuery`) to render skeleton rows in loading branches.
  - Enhance empty state message with structured layout (icon-free unless already available) and subtle visuals.

  **Must NOT do**:
  - Do not add new loading logic or new data fetching.

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
    - Reason: Skeleton/empty visual polish.
  - **Skills**: `frontend-ui-ux`, `frontend-patterns`
    - `frontend-ui-ux`: Empty state composition.
    - `frontend-patterns`: Conditional rendering patterns.
  - **Skills Evaluated but Omitted**:
    - `security-review`: No sensitive data handling.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: Task 3

  **References**:
  - `web/src/app/(app)/orders_main/page.tsx:335` - Current empty state placement.
  - `web/src/components/ui/card.tsx` - Card body spacing for empty states.

  **Acceptance Criteria**:
  - [ ] Skeleton rows appear during loading without altering data flow.
  - [ ] Empty state is more expressive but uses the same existing branch.

---

## Commit Strategy

- Commit: NO (single-file UI changes; commit only if explicitly requested)

---

## Success Criteria

### Verification Commands
```bash
# from web/
npm run lint
npm run build
```

### Final Checklist
- [ ] `web/src/app/(app)/orders_main/page.tsx` updated with workbench visual layout only.
- [ ] No logic/query/handler changes introduced.
- [ ] Manual UI verification completed for desktop and mobile breakpoints.
- [ ] `npm run lint` and `npm run build` exit code 0.
