# Draft: Command Palette (Ctrl+K)

## Requirements (confirmed)
- Add a Ctrl+K command palette with UI-level navigation search results only.
- No changes to existing business logic or APIs.
- No new dependencies.
- Update placeholder text for the search input in the global top bar.
- Use existing Modal if available.
- Use App Router client components for hooks.
- Location context: search input is in `web/src/components/layout/global-top-bar.tsx`.
- Plan must include waves/dependencies, file touch list, success criteria, and suggested delegation categories+skills per task.

## Technical Decisions
- Modal candidate exists: `web/src/components/ui/modal.tsx` (not yet confirmed for reuse in new palette).
- Navigation data source: `web/src/components/layout/nav-items.ts` (navItems + bottomNavItems).

## Research Findings
- `GlobalTopBar` contains search input with placeholder "Search (⌘K)".
- `AppShell` wraps `GlobalTopBar` and `SidebarNav` (App Router client component).
- `nav-items.ts` defines navigation structure and active logic.
- `Modal` component is available in `web/src/components/ui/modal.tsx`.

## Open Questions
- Placeholder text: should it be "Search (Ctrl+K)", "Search (⌘K)", or platform-aware?
- Search scope: include `bottomNavItems` and grouped `navItems`? Should group labels appear in results?
- Matching behavior: label-only vs label+group? prefix vs substring?
- Result ordering: alphabetical vs existing nav order?
- Should the command palette open from the search input focus, Ctrl+K, or both?
- Test strategy: no test infra detected—manual verification only?

## Scope Boundaries
- INCLUDE: new command palette UI, keyboard shortcut handling, navigation-only results, modal UI.
- EXCLUDE: API changes, business logic changes, new dependencies, non-navigation search results.
