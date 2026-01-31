# Draft: Supabase RPC error column l.ref_line_id does not exist

## Requirements (confirmed)
- Investigate and plan fix for Supabase RPC error: column l.ref_line_id does not exist on confirm shipment.
- Provide step-by-step plan with parallelizable tasks, suggested agents (category+skills), minimal-risk fix strategy.
- Use provided stack trace and assume repo context will be gathered.
- Include success criteria and test plan.
- Do not modify files or assume schema changes without validation.
- Plan uses manual-only verification.

## Technical Decisions
- None yet.

## Research Findings
- Error 42703 = undefined_column; common causes include stale function definitions, alias/CTE mismatches, and schema drift. Validate functions and confirm actual SQL executed via logs or SQL editor. (Supabase/Postgres docs)

## Open Questions
- Environment(s) that reproduce (dev/stage/prod) and access level.

## Scope Boundaries
- INCLUDE: Investigation steps for cms_fn_confirm_shipment_v3_cost_v1 and client call chain; root-cause analysis; minimal-risk fix approach.
- EXCLUDE: Unvalidated schema changes or direct modifications.

## Additional Context
- Repo contains definitions of cms_fn_confirm_shipment_v3_cost_v1 with no ref_line_id usage:
  - supabase/migrations/20260129225200_cms_0242_receipt_cost_rpcs.sql#L331
  - supabase/migrations/20260201001000_cms_0262_realign_confirm_shipment_chain.sql#L739
- cms_shipment_line schema has no ref_line_id column:
  - supabase/migrations/20260127124309_cms_0002_tables.sql#L245
- Likely mismatch between remote DB function definition and repo migrations.
