set search_path = public, pg_temp;

-- add-only grant hotfix for orders_main inventory detail modal
do $$
begin
  if to_regclass('public.cms_v_inventory_move_lines_enriched_v1') is not null then
    execute 'grant select on public.cms_v_inventory_move_lines_enriched_v1 to anon, authenticated';
  end if;
end $$;
