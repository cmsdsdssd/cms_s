set search_path = public, pg_temp;

revoke all on public.cms_bom_recipe from anon, authenticated;
revoke all on public.cms_bom_recipe_line from anon, authenticated;

grant select on public.cms_bom_recipe to authenticated;
grant select on public.cms_bom_recipe_line to authenticated;

alter table public.cms_bom_recipe enable row level security;
alter table public.cms_bom_recipe_line enable row level security;

drop policy if exists cms_select_authenticated on public.cms_bom_recipe;
create policy cms_select_authenticated on public.cms_bom_recipe
for select to authenticated using (true);

drop policy if exists cms_select_authenticated on public.cms_bom_recipe_line;
create policy cms_select_authenticated on public.cms_bom_recipe_line
for select to authenticated using (true);

grant select on public.cms_v_bom_recipe_worklist_v1 to authenticated;
grant select on public.cms_v_bom_recipe_lines_enriched_v1 to authenticated;

grant execute on function public.cms_fn_resolve_bom_recipe_v1(uuid,text) to authenticated;
grant execute on function public.cms_fn_upsert_bom_recipe_v1(uuid,text,boolean,text,jsonb,uuid,uuid,text,uuid) to authenticated;

-- ✅ 시그니처 변경 반영 (numeric이 3번째)
grant execute on function public.cms_fn_add_bom_recipe_line_v1(
  uuid,
  public.cms_e_inventory_item_ref_type,
  numeric,
  uuid,
  uuid,
  text,
  text,
  jsonb,
  uuid,
  text,
  uuid
) to authenticated;

grant execute on function public.cms_fn_void_bom_recipe_line_v1(uuid,text,uuid,text,uuid) to authenticated;
