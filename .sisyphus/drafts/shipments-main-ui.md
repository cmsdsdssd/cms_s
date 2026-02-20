# Draft: Shipments Main UI Enhancement

## Requirements (confirmed)
- UI-only enhancement for `web/src/app/(app)/shipments_main/page.tsx`.
- Must keep logic/data flow/handlers/links/routes/params identical.
- No new libraries.
- Goals: workbench header panel, tidy filters/search layout, premium list rows with hover/lift, improved info hierarchy, loading/empty states.
- Optional safe summary cards from existing data only (counts).
- Constraints: no new filters/toggles, no data changes.
- Provide plan with task graph, category+skills, manual verification steps, success criteria on functional immutability.
- Context: uses ActionBar, Card, Button, Input, Select, Badge; filters stored in state; list is `applyFilters` map; empty state text shown when `applyFilters.length === 0`.

## Technical Decisions
- Plan will preserve component structure and event handlers; UI changes limited to layout and styling classes within the page.
- No test infrastructure detected; need user decision on manual-only verification vs adding tests.

## Research Findings
- Internal UI patterns: `web/src/app/(app)/shipments/page.tsx` uses Card headers with `border-b`, `bg-[#fcfcfd]`, rounded panels, hover lift (`hover:-translate-y-0.5`, `hover:shadow-[var(--shadow-sm)]`), and list row hover backgrounds for premium feel. Uses muted text hierarchy and badge tones.
- Pending: external UI best practices for premium list rows and empty/loading states.

## Open Questions
- Test strategy: set up tests vs manual verification only?
- Include optional summary cards (counts) or skip for minimal UI change?

## Scope Boundaries
- INCLUDE: UI layout/styling changes inside `web/src/app/(app)/shipments_main/page.tsx`.
- EXCLUDE: new filters, toggles, data changes, route/handler logic changes, new libraries.
