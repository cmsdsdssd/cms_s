# Draft: Orders Main Workbench

## Requirements (confirmed)
- UI/UX-only redesign of `web/src/app/(app)/orders_main/page.tsx` to a "주문 작업대" workbench style.
- Must not change any logic/data flow/handlers/routes/queries.
- Allowed: layout/styles/Tailwind, hover/transition, a11y focus, skeleton/empty states in existing branches, presentational components only.
- Forbidden: new features, filters, toggles, changing fetch/handlers, new libs.
- Run manual verification plus `npm run lint` and `npm run build` if available.
- Report using the user's fixed reporting format from instructions.

## Technical Decisions
- Single-file UI-only changes limited to `web/src/app/(app)/orders_main/page.tsx`.
- Keep existing data mapping and filter logic unchanged; only restructure layout and Tailwind classes.
- Add skeleton/empty states using existing query/loading branches only.
- Maintain ActionBar, Card, Button, Input, Select, Badge usage patterns; no new dependencies.
- Verification strategy: manual checks plus `npm run lint` and `npm run build` from `web` if available.

## Research Findings
- Workbench patterns emphasize a tool-rail + main bench layout, strong section headers, dense data grids, and clear focus/hover states; split-view is optional but not required.
- Accessibility: maintain focus-visible rings, ensure text contrast, and provide keyboard-focusable controls.

## Open Questions
- None. User approved proceeding without Metis due to tool restriction.

## Scope Boundaries
- INCLUDE: Visual redesign of filters and list sections, improved row styling, headers/labels, subtle background/gradient/pattern, hover/focus, and skeleton/empty states.
- EXCLUDE: Any new behaviors, data transformations, list virtualization, filters, or routing changes; no new libraries.
