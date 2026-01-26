# cms_s Project Rules (Read First)

## Mission
- Analyze docs in ./docs and source code in this repo.
- Produce page-by-page UI/UX implementation plan (PRD-level) as Markdown files under ./docs/uiux_plan/.

## Hard Rules
- DO NOT implement features unless explicitly asked. This run is "planning + documentation" only.
- Prefer reading existing docs first, then validate against actual code.
- Every page spec must include: layout, components, data inputs/outputs, actions, states (loading/empty/error), permissions, edge cases, and exact file references.

## Output Contract
- ./docs/uiux_plan/00_INDEX.md
- ./docs/uiux_plan/01_REPO_MAP.md
- ./docs/uiux_plan/pages/<page>.md
- ./docs/uiux_plan/99_CODEX_PROMPTS.md
- Stop only when everything is written and end with: <promise>DONE</promise>
