# Draft: AR Dashboard UI/UX Enhancement

## Requirements (confirmed)
- UI/UX-only enhancement for web/src/app/(app)/ar/page.tsx.
- Must not change logic, handlers, data flow, or network requests.
- Tone: financial dashboard, premium header.
- KPI cards only if existing data supports them.
- Clean up filter panel UX.
- Improve table UX (sticky header if safe), badges, hover/focus states.
- Add/adjust skeleton and empty states.
- Use existing components (Card/Button/Badge/Skeleton).
- No new dependencies.
- Plan must include steps, success criteria, verification, parallel task graph, todo list, category+skills per task.

## Technical Decisions
- Not decided yet; pending codebase review of page structure and available data.

## Research Findings
- Premium dashboard UX best practices: sticky headers via CSS `position: sticky` require careful overflow context; ensure scroll container supports sticky behavior and z-index layering.
- KPI cards should use existing data only; emphasize clear hierarchy (label/value/trend) and consistent spacing.
- Filter UX: group controls, show active state clarity, avoid clutter; maintain accessibility with focus-visible.
- Badges: semantic tones for status; keep compact sizes for tables.
- Skeleton/empty states: preserve layout dimensions with Skeleton placeholders; empty states should be informative and actionable.

## Open Questions
- Which KPIs are safe to display given current data in page.tsx?
- Are there existing design system tokens/typography for premium header styling?
- Table implementation details (custom table vs component) to assess sticky header feasibility.
- Current empty/skeleton state handling in this page.
- Test strategy decision (no test infra detected): set up tests vs manual verification?

## Scope Boundaries
- INCLUDE: visual/styling/layout changes in page.tsx using existing components.
- EXCLUDE: logic/handler/data flow/network changes, new dependencies.
