# Draft: AR Workbench Refactor Plan

## Requirements (confirmed)
- Produce a precise, step-by-step plan to refactor `web/src/app/(app)/ar/page.tsx` into a Summary -> Ledger -> Actions workbench UI.
- Provide a parallel task graph with dependencies and a structured TODO list.
- Use read-only access; request specific files if needed.
- Preserve all business logic, RPC calls, queries, and routes.
- Only change layout/styling/componentization/state/hover/transition behavior.
- Respect existing UI component conventions (ActionBar, FilterBar, SplitLayout, Card, ListCard, Button, Skeleton, Input/Select/Textarea/SearchSelect).
- Include loading skeletons, empty states, inline errors.
- Keep existing toast behavior.
- Add hover/active micro-interactions and panel open/close transitions with no new libs.
- No new data fetching, schema changes, or route changes.
- No new libraries.
- Current AR page uses ActionBar + FilterBar + SplitLayout, left list (summary + parties), right detail (selected party summary + inline tabs for ledger/payment/return).
- Ledger table, payment form, return form already exist; logic/queries/mutations/states must remain unchanged.
- Tabs pattern can follow simple button tabs with `cn` and active styles (per `PartyDetail`).

## Technical Decisions
- Keep SplitLayout grid structure; refactor into Summary -> Ledger -> Actions workbench within existing layout components.
- Use existing tab styles from `web/src/components/party/PartyDetail.tsx` for Actions panel tabs (payment/return).

## Research Findings
- `web/src/app/(app)/ar/page.tsx` contains all state and data logic; UI refactor must avoid touching query/mutation logic.
- ActionBar, FilterBar, SplitLayout, Card, ListCard conventions confirmed; hover/transition styles already present in Card/ListCard.
- `package.json` has no test framework configured.

## Open Questions
- Test strategy choice needed: set up testing vs manual verification.

## Scope Boundaries
- INCLUDE: UI layout changes to Summary/Ledger/Actions workbench, componentization, transitions, micro-interactions, skeletons, empty states, inline errors.
- EXCLUDE: Any changes to data fetching, schema, routes, or libraries.
