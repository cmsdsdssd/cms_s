# Draft: Catalog Gallery Selection & Pagination Affordance

## Requirements (confirmed)
- Create a precise plan to improve selection affordance on gallery cards and keep pagination visible within viewport across zoom/resolutions.
- UI/UX only: no business logic changes, no data/pagination logic changes, no new dependencies.
- Do not change interactions; do not modify list view.
- Focus on `web/src/components/catalog/CatalogGalleryCard.tsx` and catalog page layout around grid/pagination.
- Ensure selection ring visibility and reduce vertical growth or make pagination sticky/visible.
- Required tools for planning: Read, Grep.

## Technical Decisions
- None yet.

## Research Findings
- `web/src/components/catalog/CatalogGalleryCard.tsx` uses `ring-2 ring-[var(--primary)]` on selection and hover opacity for unselected cards.
- Gallery grid layout lives in `web/src/components/catalog/CatalogGalleryGrid.tsx`.
- Catalog page left panel (`web/src/app/(app)/catalog/page.tsx`) wraps gallery/list with a flex column; pagination footer uses `mt-auto` and sits after the grid.

## Open Questions
- Should pagination become sticky within the left panel container, or should the grid/panel height be constrained so pagination remains in view (no sticky)?
- Any specific zoom/resolution targets we must validate (e.g., 125%/150% zoom or 1366x768)?

## Scope Boundaries
- INCLUDE: Gallery card selection affordance styling; gallery grid/pagination layout adjustments to keep pagination visible.
- EXCLUDE: List view changes; data logic; pagination logic; interaction behavior changes; new dependencies.
