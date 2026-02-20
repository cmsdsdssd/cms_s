set search_path = public, pg_temp;
do $$
begin
  -- parts views: 존재할 때만 grant
  if to_regclass('public.cms_v_part_move_lines_v1') is not null then
    execute 'grant select on public.cms_v_part_move_lines_v1 to anon, authenticated, service_role';
  end if;

  if to_regclass('public.cms_v_part_master_with_position_v1') is not null then
    execute 'grant select on public.cms_v_part_master_with_position_v1 to anon, authenticated, service_role';
  end if;

  if to_regclass('public.cms_v_part_unlinked_worklist_v1') is not null then
    execute 'grant select on public.cms_v_part_unlinked_worklist_v1 to anon, authenticated, service_role';
  end if;

  if to_regclass('public.cms_v_part_usage_daily_v1') is not null then
    execute 'grant select on public.cms_v_part_usage_daily_v1 to anon, authenticated, service_role';
  end if;
end $$;
