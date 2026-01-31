# Draft: App Chrome UI/UX Upgrade

## Requirements (confirmed)
- Upgrade global App Chrome UI/UX only (no logic changes).
- Target files: web/src/app/globals.css, web/src/components/layout/app-shell.tsx, web/src/components/layout/top-nav.tsx.
- Optional minimal changes to web/src/components/ui/button.tsx and web/src/components/ui/card.tsx only if necessary.
- Constraints: no new libraries; no route/link/label/icon changes; no API/logic/data changes; no DB/SQL; no params changes; maintain functionality.
- Goal: premium SaaS tone with subtle depth/glass, hairline borders, micro-interactions; sticky header blur; tidy main spacing; active tab pill/underline; hover lift; consistent mobile menu.

## Technical Decisions
- Current chrome structure uses sticky header with border and backdrop blur in `web/src/components/layout/app-shell.tsx`.
- Top nav uses active chip styles, hover shadow, and modal mobile menu in `web/src/components/layout/top-nav.tsx`.
- UI tokens and shadows are defined in `web/src/app/globals.css`.
- Button/Card components provide baseline rounded/shadow/transition styles if minimal adjustments are needed.

## Research Findings
- Pending librarian guidance on premium SaaS chrome patterns.

## Open Questions
- Test strategy preference once test infrastructure is assessed.
- Any brand constraints (colors/typography) beyond current CSS variables?

## Scope Boundaries
- INCLUDE: visual/style updates to chrome and navigation UI in specified files; optional minimal adjustments in button/card if needed to align chrome styling.
- EXCLUDE: logic changes; routing; labels/icons; API/data/db; parameter changes; new libraries.
