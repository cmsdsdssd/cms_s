# Draft: Shipments UI Workbench

## Requirements (confirmed)
- UI-only enhancement for `web/src/app/(app)/shipments/page.tsx`.
- Keep logic/data flow/handlers/links/routes/params identical.
- No new libraries; use existing UI components (ActionBar, Card, Button, Input, Badge, Modal, SearchSelect).
- Add workbench layout: ActionBar + progress strip; 2-column desktop main/side; section card wrappers for summary/basic info, lines, receipts, confirm.
- Add hover lift on cards and subtle list row hover.
- Polish modal spacing (header/body/footer) and typography hierarchy.
- Use tabular numerals for numeric fields.
- Mobile should stack.
- Provide plan with task graph, category+skills, and manual verification steps; no tests setup.

## Technical Decisions
- Treat as UI-only refactor within existing component tree; no changes to queries/mutations/state handlers.
- Manual verification only (no test setup requested).

## Research Findings
- Current layout: ActionBar + two Cards in `lg:grid-cols-2`; confirm Modal with 2-column grid inside and table list.
- Uses existing CSS vars (`--panel-border`, `--muted`, `--foreground`) and Tailwind utility classes for layout and spacing.

## Open Questions
- Visual preference for progress strip style (minimal steps vs pill badges) and any color constraints?
- Any constraints on maximum modal width/height beyond current `max-w-6xl`?

## Scope Boundaries
- INCLUDE: Layout restructuring and styling refinements in `web/src/app/(app)/shipments/page.tsx` only.
- EXCLUDE: Any changes to RPC/API calls, handlers, routes, params, or data flow.
