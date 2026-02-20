# Draft: Shipment Confirm Debug (260131)

## Requirements (confirmed)
- Read and analyze `docs/260131/debug.md` for issues and context.
- Identify the `shipment_id=eq.null` request origin.
- Trace the `cms_fn_confirm_shipment_v3_cost_v1` chain to `part_id` usage.
- Propose a minimal frontend fix and a new SQL migration file.
- Evidence-based output with references; only use `public.cms_*` objects.
- Do not provide direct table update guidance.
- Do not include secrets.
- Provide full file contents for frontend change and full SQL migration file in final response.
- Verify with diagnostics/tests if applicable.
- Include parallel task graph and detailed TODOs with category + skills per task.

## Technical Decisions
- Drafting plan only (Prometheus): no implementation or file edits.
- Use repository evidence where available; call out missing function definitions in repo.

## Research Findings
- `web/src/app/(app)/shipments/page.tsx` uses `readView("cms_shipment_line", ...)` with filter `shipment_id=eq` when `currentShipmentId` is set.
- `web/src/lib/supabase/read.ts` uses `query.eq(column, value)` for filters; if value is `"null"` this becomes `shipment_id=eq.null` in PostgREST.
- Inventory emit function `public.cms_fn_emit_inventory_issue_from_shipment_confirmed_v1` calls `cms_fn_upsert_inventory_move_line_v1` with `p_part_id` and writes to `cms_inventory_move_line` (requires `part_id` column).
- Existing migration `supabase/migrations/20260128300250_cms_0209b_inventory_move_line_part_id_backfill.sql` adds `part_id` column + index with `if not exists`.
- `cms_fn_confirm_shipment_v3_cost_v1` definition is not found in repo migrations (must confirm in DB).
- PostgREST null filter uses `is.null` rather than `eq.null`.

## Open Questions
- Should the minimal frontend fix be scoped to `ShipmentsPage` only (guard/normalize `currentShipmentId`), or should the shared `readView` helper handle `null/"null"` values globally?

## Scope Boundaries
- INCLUDE: minimal guard against `shipment_id=eq.null`, tracing confirm chain to inventory functions, new migration to ensure `cms_inventory_move_line.part_id` exists.
- EXCLUDE: schema rewrites, data backfills/updates, or non-`public.cms_*` objects.
