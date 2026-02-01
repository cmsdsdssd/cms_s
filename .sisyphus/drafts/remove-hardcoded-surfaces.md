# Draft: Remove Hardcoded Light Surfaces

## Requirements (confirmed)
- Create a precise plan to remove hardcoded light surfaces and muted text on containers in major pages/common components.
- Keep UI-only changes; no logic/state/RPC/route changes.
- Replace bg-white/text-gray-* with semantic tokens where possible.
- Ensure container text uses foreground; muted only for labels/meta.
- Disallowed patterns: bg-white, text-gray-400/500/600, text-muted-foreground on containers.
- Plan should include task graph, steps, file targets, manual verification checklist, and grep/rg validation alternatives.

## Technical Decisions
- TBD: identify semantic token conventions used in repo (e.g., bg-background, text-foreground, text-muted-foreground) once patterns are found.

## Research Findings
- Pending: codebase occurrences of disallowed patterns.
- Pending: external guidance on semantic color tokens.

## Open Questions
- Which pages/components count as "major" in this repo (pages dir, app routes, top-level layout, common UI library)?

## Scope Boundaries
- INCLUDE: UI-only class replacements in major pages/common components.
- EXCLUDE: logic/state/RPC/route changes.
