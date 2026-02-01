# Draft: Dark Theme Tokenization (web/src)

## Requirements (confirmed)
- Focus on UI only; no logic/state/routing changes.
- Token overrides must live in `web/src/app/globals.css` under `html.dark` and `html[data-theme="dark"]`.
- Ensure `body` color uses `var(--foreground)`.
- Replace light-only utility classes for background/border/text with tokenized variants.
- Remove muted text from large containers; keep muted only for labels/hints/meta/placeholder.
- Patch common UI components: `web/src/components/ui/card.tsx`, `web/src/components/ui/modal.tsx`, `web/src/components/ui/field.tsx`, `web/src/components/ui/search-select.tsx`.
- Verification must include `rg "bg-white" web/src` and `rg "text-gray-(4|5|6)|text-muted-foreground" web/src` to reach 0 (or document intentional exceptions).
- Avoid broad refactors.

## Technical Decisions
- Use existing CSS variables (e.g., `--background`, `--foreground`, `--panel`, `--panel-border`, `--hairline`, `--input-bg`, `--input-border`, `--muted`, `--muted-weak`, `--ring`) for tokenization.
- Replace utility classes with `bg-[var(--...)]`, `text-[var(--...)]`, `border-[var(--...)]`.

## Research Findings
- globals.css located at `web/src/app/globals.css` with dark overrides already present.
- Common components located at `web/src/components/ui/*` as listed.
- Many occurrences of `bg-white`, `bg-gray-50`, `text-muted-foreground`, `text-gray-*`, `border-gray-*`, `border-blue-*` across app pages and layout.

## Open Questions
- None outstanding.

## Scope Boundaries
- INCLUDE: UI token override updates, class replacements in `web/src`, component patching.
- EXCLUDE: Logic/state/routing changes, broad refactors.
