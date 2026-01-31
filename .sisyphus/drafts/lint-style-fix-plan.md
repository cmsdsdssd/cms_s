# Draft: Lint Style Auto-Fix Plan

## Requirements (confirmed)
- User wants analysis of `npm run lint` errors and auto-fix for style-related errors only.
- No functional changes allowed; style-only fixes.
- Output should be a plan with steps, classification, safe fix strategy, task graph with category+skills, and verification plan.
- User provided lint summary with rule violations across `scripts/`, `src/app/`, `src/components/`, `src/hooks/`, `src/lib/`, `src/app/api/*`.
- Constraint: do not touch logic-related rules (hooks, any, purity, etc.).
- Scope: `web/` only; do not touch root `scripts/*`.
- Style-only rules allowed to fix: `react/no-unescaped-entities`, `prefer-const`.
- Skip: `next/no-img-element`, `no-require-imports`, `no-unused-vars` (warnings), and all logic-related rules.
- Verification: lint-only run after fixes.

## Technical Decisions
- Lint tooling appears in `web` package using ESLint 9 with Next.js presets (core-web-vitals + typescript).

## Research Findings
- `web/package.json` has `lint` script: `eslint`.
- `web/eslint.config.mjs` extends `eslint-config-next` presets and uses `globalIgnores` to override ignores.

## Open Questions
- None.

## Scope Boundaries
- INCLUDE: Style-only auto-fixes for lint errors.
- EXCLUDE: Any behavior changes, refactors beyond style, or functional modifications.
