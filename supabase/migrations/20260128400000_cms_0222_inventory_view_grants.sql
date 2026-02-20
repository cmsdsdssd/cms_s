set search_path = public, pg_temp;
-- Grant SELECT on inventory views to both authenticated AND anon users
grant select on public.cms_v_inventory_position_by_item_label_v1 to anon, authenticated;
grant select on public.cms_v_inventory_position_by_master_item_v1 to anon, authenticated;
grant select on public.cms_v_inventory_move_worklist_v1 to anon, authenticated;
grant select on public.cms_v_inventory_move_lines_enriched_v1 to anon, authenticated;
grant select on public.cms_v_inventory_count_sessions_v1 to anon, authenticated;
grant select on public.cms_v_inventory_count_lines_enriched_v1 to anon, authenticated;
grant select on public.cms_v_inventory_stocktake_variance_v1 to anon, authenticated;
-- Grant SELECT on master item lookup view
grant select on public.v_cms_master_item_lookup to anon, authenticated;
