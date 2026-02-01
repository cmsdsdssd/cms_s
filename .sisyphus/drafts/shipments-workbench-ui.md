# Draft: Shipments Workbench UI

## Requirements (confirmed)
- Modernize UI for `web/src/app/(app)/shipments/page.tsx` into workbench layout.
- UI/UX only; keep all data fetching/mutations/logic intact.
- No route changes; no new dependencies.
- Only JSX/component structure + Tailwind styles.
- Add header with title/status hints + sticky actions.
- Tabs for Create/Draft and Confirmed (only if confirmed history exists).
- Workbench layout: left worklist, right detail panel.
- Visual stepper (Lookup -> Prefill -> Draft -> Confirm) driven by existing state.
- Micro-interactions.
- Better loading/empty/error states using existing actions.
- Optional component split in `web/src/components/shipments`.
- Provide plan with parallel tasks and required skills/categories.

## Technical Decisions
- No new queries/mutations; derive UI state from existing page state and query results.
- Use existing stepper state: `selectedOrderLineId`, `currentShipmentId`, `confirmModalOpen`.
- Candidate tab drivers (existing data):
  - Create/Draft: default tab.
  - Confirmed: show only if existing in-page data indicates confirmed history (needs alignment).

## Research Findings
- Current stepper is in-page (`steps` array) and already tied to state.
- State for flow: `lookupOpen`, `searchQuery`, `selectedOrderLineId`, `prefill`, `currentShipmentId`, `confirmModalOpen`.
- No test scripts found in `web/package.json`; only `lint` exists.

## Open Questions
- Test strategy preference (TDD/tests-after/manual verification only).

## Scope Boundaries
- INCLUDE: JSX/Tailwind refactor for layout, header/actions, tabs, worklist/detail, stepper visuals, loading/empty/error UI.
- EXCLUDE: data logic changes, API changes, new routes, new dependencies.
