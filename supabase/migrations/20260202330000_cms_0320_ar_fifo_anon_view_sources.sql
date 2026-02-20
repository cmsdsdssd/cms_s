set search_path = public, pg_temp;
alter table public.cms_party enable row level security;
alter table public.cms_ar_ledger enable row level security;
alter table public.cms_shipment_line enable row level security;
alter table public.cms_return_line enable row level security;
drop policy if exists cms_select_anon on public.cms_party;
create policy cms_select_anon on public.cms_party
  for select to anon using (true);
drop policy if exists cms_select_anon on public.cms_ar_ledger;
create policy cms_select_anon on public.cms_ar_ledger
  for select to anon using (true);
drop policy if exists cms_select_anon on public.cms_shipment_line;
create policy cms_select_anon on public.cms_shipment_line
  for select to anon using (true);
drop policy if exists cms_select_anon on public.cms_return_line;
create policy cms_select_anon on public.cms_return_line
  for select to anon using (true);
grant select on public.cms_party to anon;
grant select on public.cms_ar_ledger to anon;
grant select on public.cms_shipment_line to anon;
grant select on public.cms_return_line to anon;
