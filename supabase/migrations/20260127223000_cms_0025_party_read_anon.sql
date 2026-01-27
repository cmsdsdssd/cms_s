-- cms_0025: allow anon read for party related tables (read-only UI)

set search_path = public, pg_temp;

-- grant select for anon on read-only party tables
grant select on public.cms_party_address to anon;
grant select on public.cms_party_person_link to anon;
grant select on public.cms_vendor_prefix_map to anon;
grant select on public.cms_person to anon;
grant select on public.cms_return_line to anon;

-- allow anon select via RLS policies
do $$
begin
  execute 'drop policy if exists cms_select_anon on public.cms_party_address';
  execute 'create policy cms_select_anon on public.cms_party_address for select to anon using (true)';

  execute 'drop policy if exists cms_select_anon on public.cms_party_person_link';
  execute 'create policy cms_select_anon on public.cms_party_person_link for select to anon using (true)';

  execute 'drop policy if exists cms_select_anon on public.cms_vendor_prefix_map';
  execute 'create policy cms_select_anon on public.cms_vendor_prefix_map for select to anon using (true)';

  execute 'drop policy if exists cms_select_anon on public.cms_person';
  execute 'create policy cms_select_anon on public.cms_person for select to anon using (true)';

  execute 'drop policy if exists cms_select_anon on public.cms_return_line';
  execute 'create policy cms_select_anon on public.cms_return_line for select to anon using (true)';
end $$;
