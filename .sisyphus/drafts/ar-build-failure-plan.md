# Draft: AR page ListCard subtitle type error

## Requirements (confirmed)
- Resolve build failure in `web/src/app/(app)/ar/page.tsx` caused by `Type 'Element' is not assignable to type 'string'` on `ListCard` subtitle around line ~509.
- Keep functionality unchanged; minimal UI-only changes.
- No logic/data/handler changes; no new dependencies.
- Provide step-by-step plan and include verification steps (lint/build).
- Decide whether to address lint warnings (no-img-element, unused vars) and provide guidance.
- Allowed tools for planning: Read, Grep, LSP only (no Bash, no edits).

## Technical Decisions
- Candidate fix: widen `ListCard` prop types for `subtitle`/`meta` to `React.ReactNode` to accept the existing `<span>` usage without changing logic.
- Alternative fix: convert `subtitle` to plain string and drop inline `<span>` styling (would be UI change).

## Research Findings
- `ListCard` prop types currently require `subtitle?: string` and `meta?: string` in `web/src/components/ui/list-card.tsx`.
- `ListCard` renders `subtitle` and `meta` inside `<p>` nodes; other usages pass strings (e.g., `web/src/components/party/PartyList.tsx`).
- Offending usage in `web/src/app/(app)/ar/page.tsx` passes JSX element to `subtitle` (`<span className=...>`).
- LSP diagnostics did not report issues for the file (tsserver/lint not surfaced via LSP in this environment).
- Explore agent failed to return results; manual reads used instead.

## Open Questions
- None. Decision: defer lint warning fixes; provide guidance only.

## Scope Boundaries
- INCLUDE: Type error resolution for `ListCard` subtitle in `web/src/app/(app)/ar/page.tsx` and decision guidance for lint warnings.
- EXCLUDE: Any behavioral changes, data/handler logic changes, or new dependencies.
