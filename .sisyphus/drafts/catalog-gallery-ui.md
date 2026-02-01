# Draft: Catalog Gallery UI Adjustments

## Requirements (confirmed)
- Reduce gallery page size to 4 items (gallery view only).
- Move pagination controls to the top of the gallery list panel.
- Tighten CatalogGalleryCard layout by merging estimated weight + labor into one row and reducing vertical height.
- No new dependencies.
- No interaction changes; keep double-click behaviors intact.
- Only UI/layout changes.
- Do not touch list view or business logic unrelated to gallery pagination.

## Technical Decisions
- Pending: exact merged row label/format for estimated weight + labor.
- Manual verification checklist requested by user (no automated tests).

## Research Findings
- Page size currently derived from `view` with `activePageSize = view === "gallery" ? 12 : 5` in `web/src/app/(app)/catalog/page.tsx`.
- Pagination controls currently rendered at bottom of left panel (sticky bottom bar) in `web/src/app/(app)/catalog/page.tsx`.
- Gallery card layout defined in `web/src/components/catalog/CatalogGalleryCard.tsx` with three metric blocks (estimated total, estimated weight, labor sell) in a grid.

## Open Questions
- Merged row format for estimated weight + labor (label and value formatting).

## Scope Boundaries
- INCLUDE: gallery page size, pagination placement, gallery card layout density.
- EXCLUDE: list view UI, non-gallery pagination logic, catalog business logic, new deps.
