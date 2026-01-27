set search_path = public, pg_temp;

alter table if exists public.cms_shipment_line
  alter column manual_labor_krw set default 0;

update public.cms_shipment_line
set manual_labor_krw = 0
where manual_labor_krw is null;
