# Draft: Orders UI/UX Enhancement

## Requirements (confirmed)
- UI/UX-only enhancement for `web/src/app/(app)/orders/page.tsx`.
- Must not change logic, handlers, `searchParams`, data flow, API/RPC.
- Goal: premium form + workbench with carded sections, header, matching UI, line edit styling, feedback improvements.
- Use existing components: `Card`, `Button`, `Badge`, `Input`, `Select`, `Textarea`, `Skeleton`.

## Technical Decisions
- None yet.

## Research Findings
- Existing orders page uses Cards for header/info panels and a table for line items.
- UI components defined in `web/src/components/ui/*` (Card, Button, Badge, Input/Select/Textarea, Skeleton).
- No test scripts found in `web/package.json`.

## Open Questions
- Desired visual direction (premium styling choices, density, tone)?
- Test strategy preference (manual verification vs. add tests)?

## Scope Boundaries
- INCLUDE: UI/UX changes in `web/src/app/(app)/orders/page.tsx` only.
- EXCLUDE: Logic changes, data/handlers, search params, API/RPC, backend.
