# Draft: BOM env error handling + UX adjustments

## Requirements (confirmed)
- Produce a plan with waves, dependencies, and per-task category+skills.
- Include verification steps and test plan.
- Must handle env errors in API + UI.
- Must keep MASTER-first UX.
- Must include canWrite guardrails and confirm modal for void.
- Must include layout adjustments.
- Must NOT add dependencies or alter RPC behavior.
- Must NOT do RPC/DB changes.
- Target files: web/src/app/(app)/bom/page.tsx, web/src/app/api/master-items/route.ts, web/src/app/api/part-items/route.ts.
- Copy + UX decisions from user: API env error JSON payload, UI env error card, canWrite guardrails, MASTER-first UX, VOID confirm modal, layout changes.

## Technical Decisions
- Use provided copy verbatim for API error payload and UI messaging.
- No new dependencies; preserve RPC behavior; no DB changes.
- Test strategy: manual/agent-executable verification (no test infra detected).

## Research Findings
- API routes already guard missing env via getSupabaseAdmin() returning null; will align error payload to new copy.
- BOM UI uses fetchJson() throw on error; canWrite computed from NEXT_PUBLIC_CMS_ACTOR_ID + RPC config.

## Open Questions
- None (user provided concrete copy and UX decisions).

## Scope Boundaries
- INCLUDE: BOM UI/API env error handling, MASTER-first UX, canWrite guardrails, confirm modal for void, layout adjustments.
- EXCLUDE: RPC behavior changes, DB changes, new dependencies.
