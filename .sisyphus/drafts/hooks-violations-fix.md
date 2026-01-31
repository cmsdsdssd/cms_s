# Draft: Fix Hooks Rule Violations (web/)

## Requirements (confirmed)
- Fix hooks rule violations only: react-hooks/* and purity.
- Scope limited to web/ only.
- Minimal change; no functionality changes.
- No unrelated lint fixes.
- Provide step-by-step plan, risk notes, and verification plan.
- Include task graph with category+skills for each fix.

## Technical Decisions
- Not decided yet.

## Research Findings
- None yet.

## Open Questions
- Which test strategy should be used (TDD, tests-after, or manual verification)?
- Any preferred lint command or CI check to verify fixes?

## Scope Boundaries
- INCLUDE: web/ sources with react-hooks/* and purity violations only.
- EXCLUDE: non-web/ paths; any non-hook/purity lint fixes; behavior changes.
