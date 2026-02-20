set search_path = public, pg_temp;
-- Allow anon to read shipment headers (used by shipments_print/workbench)
alter table public.cms_shipment_header enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'cms_shipment_header'
      and policyname = 'allow_anon_select_shipment_header'
  ) then
    create policy allow_anon_select_shipment_header on public.cms_shipment_header
      for select to anon using (true);
  end if;
end $$;
grant select on public.cms_shipment_header to anon;
