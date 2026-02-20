set search_path = public, pg_temp;
-- add-only hotfix: ensure app roles can read inventory position views
do $$
begin
  if to_regclass('public.cms_v_inventory_position_by_master_item_location_v1') is not null then
    execute 'grant select on public.cms_v_inventory_position_by_master_item_location_v1 to anon, authenticated';
  end if;
end $$;
do $$
begin
  if to_regclass('public.cms_v_inventory_position_by_master_item_v1') is not null then
    execute 'grant select on public.cms_v_inventory_position_by_master_item_v1 to anon, authenticated';
  end if;
end $$;
