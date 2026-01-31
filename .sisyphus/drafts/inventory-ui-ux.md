# Draft: Inventory UI/UX Upgrade

## Requirements (confirmed)
- "Produce a step-by-step plan to upgrade inventory page UI/UX only, preserving all logic."
- UI/UX only for `web/src/app/(app)/inventory/page.tsx`; no data/logic/handlers/routes changes.
- Must use existing components; no new deps.
- Include loading/empty states; propose layout changes per spec.
- Design goal: "Explorer UI + Workbench 연결감" with premium inventory exploration UX.
- Required tools for planning: Read, Glob, Grep, LSP only (no Bash, no edits).

## Technical Decisions
- None yet (awaiting user input on scope focus and test strategy).

## Research Findings
- Current inventory page layout is tabbed (Position/Moves/Stocktake) with cards and table-heavy UI in `web/src/app/(app)/inventory/page.tsx`.
- Existing loading/empty states are simple text strings across app (e.g., `web/src/app/(app)/market/page.tsx`).

## Open Questions
- Which tabs should be redesigned first if we need to prioritize (Position, Moves, Stocktake, or all equally)?
- Preferred loading/empty state style: minimal text, skeletons, or richer empty-state illustrations using existing components only?
- Test strategy for the plan: TDD, tests-after, or manual verification only (no new test infra found yet)?

## Scope Boundaries
- INCLUDE: Inventory page UI layout, typography, spacing, visual hierarchy, loading/empty states, and tab-level structure.
- EXCLUDE: Any data fetching changes, business logic, handlers, routes, or new dependencies.
