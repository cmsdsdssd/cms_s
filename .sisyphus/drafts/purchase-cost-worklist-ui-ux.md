# Draft: Purchase Cost Worklist UI/UX Enhancement

## Requirements (confirmed)
- UI/UX enhancement only for purchase_cost_worklist.
- Must not change logic/handlers/data flow.
- Target file: web/src/app/(app)/purchase_cost_worklist/page.tsx.
- Goals: strong left list/right detail workbench layout, premium rows, consistent badges, detail panel with summary/body/actions, improved header, skeleton/empty states, subtle micro-interactions.
- Constraints: use existing components (Card/Button/Badge/Skeleton); no new deps; no functional changes.
- Deliverable: structured plan with steps/checks, parallel task graph, todo list, category+skills per task, success criteria + verification steps.

## Technical Decisions
- UI-only refactor within existing page component using current styling utilities and components.
- Preserve all state, handlers, mutations, and data flow; only adjust layout and classes.
- Verification will be manual UI checks in dev (no new test infra).

## Research Findings
- Current layout uses ActionBar, Card, CardHeader/Body, Button, Badge, Input/Select/Textarea in page.tsx.
- Existing app pages (e.g., orders, inventory) show richer card headers, badges, hover states, and grid layouts.

## Open Questions
- Metis gap analysis is required before plan generation, but the Metis tool call is currently blocked in this environment.

## Scope Boundaries
- INCLUDE: visual hierarchy, spacing, typography, card structure, row styling, badges, header treatments, empty/skeleton states, micro-interactions.
- EXCLUDE: logic changes, data model changes, new dependencies, API changes.
