set search_path = public, pg_temp;

-- Grant usage on schema (redundant if already done, but safe)
grant usage on schema public to anon, authenticated, service_role;

-- Views: Grant SELECT
grant select on public.cms_v_part_master_with_position_v1 to anon, authenticated, service_role;
grant select on public.cms_v_part_move_lines_v1 to anon, authenticated, service_role;
grant select on public.cms_v_part_unlinked_worklist_v1 to anon, authenticated, service_role;
grant select on public.cms_v_part_usage_daily_v1 to anon, authenticated, service_role;

-- Functions: Grant EXECUTE
grant execute on function public.cms_fn_upsert_part_item_v1 to anon, authenticated, service_role;
grant execute on function public.cms_fn_add_part_alias_v1 to anon, authenticated, service_role;
grant execute on function public.cms_fn_record_part_receipt_v1 to anon, authenticated, service_role;
grant execute on function public.cms_fn_record_part_usage_v1 to anon, authenticated, service_role;

-- Tables: RLS policies should handle table access, but if we need direct access (not recommended), grants would go here.
-- v1 uses views/RPC only, so table grants are strictly controlled via RLS and views.
