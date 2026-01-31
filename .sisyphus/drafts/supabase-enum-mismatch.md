# Draft: Supabase enum mismatch (cms_e_pricing_mode)

## Requirements (confirmed)
- Fix Supabase RPC error: invalid input value for enum cms_e_pricing_mode: "MANUAL"
- Error triggered by cms_fn_confirm_shipment_v3_cost_v1
- Migration already added realigning confirm chain
- Need plan to resolve enum mismatch (likely add enum value or adjust function)
- Provide parallel task graph and required checks

## Technical Decisions
- Pending: enum change vs function adjustment
- Pending: environment rollout strategy

## Research Findings
- Enum defined without MANUAL: `supabase/migrations/20260126084014_cms_0001_types.sql` defines cms_e_pricing_mode as ('RULE','UNIT','AMOUNT_ONLY').
- Confirm chain uses MANUAL: `supabase/migrations/20260131233000_cms_0259_realign_confirm_shipment_chain.sql` references 'MANUAL'::cms_e_pricing_mode in cms_fn_confirm_shipment_v3_cost_v1.
- Function entry point: `supabase/migrations/20260129225200_cms_0242_receipt_cost_rpcs.sql` defines cms_fn_confirm_shipment_v3_cost_v1.
- Web RPC contract: `web/src/lib/contracts.ts` defaults RPC name to cms_fn_confirm_shipment_v3_cost_v1.
- Test infra: `web/package.json` has no test scripts; no test framework detected.
- Docs: PostgreSQL allows ALTER TYPE ADD VALUE; Supabase guidance warns against removing enum values. Adding new enum values should occur before code uses them and is not usable until transaction commit.
- Explore agents failed (JSON parse error). Manual grep/read used instead.

## Open Questions
- Preferred fix: add enum value "MANUAL" or map to existing enum value?
- Are schema changes allowed in production (enum alterations) or should we avoid them?
- Test strategy preference once infra is confirmed (TDD/tests-after/manual)?

## Scope Boundaries
- INCLUDE: resolve enum mismatch for cms_fn_confirm_shipment_v3_cost_v1 and related confirm chain
- EXCLUDE: unrelated pricing logic changes outside confirm chain
