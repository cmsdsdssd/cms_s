# Draft: AR Page Select Strings & Readability

## Requirements (confirmed)
- Fix truncated `.select()` strings in `web/src/app/(app)/ar/page.tsx` so missing fields are loaded.
- Improve ledger UI readability and consistent +/- coloring.
- No backend/RPC changes; no new dependencies; no data-flow refactors.
- Keep toast behavior as-is.
- Add fallback for missing `shipment_line` data.
- Apply `Intl.NumberFormat("ko-KR")` and `tabular-nums` for numeric formatting.
- Introduce CSS variables for colors.
- Add an amount pill component.
- Update select strings exactly as specified by user.

## Technical Decisions
- Stay within UI/readability changes in `web/src/app/(app)/ar/page.tsx` and shared styling tokens in `web/src/app/globals.css` only if needed.
- Preserve existing queries and mutations; only adjust select string field lists.

## Research Findings
- AR page currently uses `formatKrw` / `formatSignedKrw` with `Intl.NumberFormat("ko-KR")` in `web/src/app/(app)/ar/page.tsx`.
- CSS variables defined in `web/src/app/globals.css` for `--warning`, `--success`, `--primary`, `--muted`, etc.
- No test infrastructure detected in `web/package.json` (scripts only include dev/build/start/lint).

## Open Questions
- Confirm exact select string corrections and any new UI strings to apply (user referenced “exactly as specified”).
- Test strategy preference given no test framework (manual QA vs add tests).

## Scope Boundaries
- INCLUDE: AR page UI/readability adjustments, select string corrections, amount pill component, fallbacks, numeric formatting.
- EXCLUDE: RPC changes, backend changes, dependency additions, data-flow refactors.
