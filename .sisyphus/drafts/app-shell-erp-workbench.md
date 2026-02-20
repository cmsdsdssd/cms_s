# Draft: AppShell ERP Workbench Refactor Plan

## Requirements (confirmed)
- Refactor AppShell into a modern ERP workbench (UI/UX only).
- No behavior changes, no new routes, no backend changes.
- Use Next.js App Router patterns.
- Include sidebar collapse + mobile drawer, global top bar, nav tree per spec, settings fixed at bottom.
- Create `sidebar-nav.tsx` and `global-top-bar.tsx`; `top-nav.tsx` may be deprecated.
- Optional `nav-items.ts` for nav structure.

## Technical Decisions
- Pending: align new components with existing Tailwind + token usage in `app-shell.tsx` and `top-nav.tsx`.

## Research Findings
- `web/src/components/layout/app-shell.tsx` currently renders only `TopNav` and main content; no sidebar integration.
- `web/src/components/layout/top-nav.tsx` contains nav items, mobile modal menu, and `MarketTicker` usage.
- `web/src/components/layout/sidebar.tsx` defines a separate sidebar nav but is not referenced elsewhere.
- App Router layout uses `web/src/app/(app)/layout.tsx` to wrap pages with `AppShell`.
- No test infrastructure found (no test scripts/configs, no `*.test.*` files).

## Open Questions
- Where is the nav tree spec defined (doc, ticket, or existing file)?
- Given no test infra and no new deps allowed, should verification be manual-only?

## Scope Boundaries
- INCLUDE: UI layout refactor, sidebar + top bar components, nav tree wiring, settings fixed at bottom.
- EXCLUDE: API changes, backend changes, new routes, behavior changes, new dependencies.
