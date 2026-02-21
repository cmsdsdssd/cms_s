set search_path = public, pg_temp;
begin;

drop view if exists public.cms_v_shipped_model_latest_v1;
create view public.cms_v_shipped_model_latest_v1
with (security_invoker = true)
as
select distinct on (h.customer_party_id, l.model_name)
  h.customer_party_id,
  l.model_name,
  l.suffix,
  l.color,
  l.material_code,
  coalesce(h.ship_date::timestamptz, h.confirmed_at, h.created_at) as last_shipped_at
from public.cms_shipment_line l
join public.cms_shipment_header h on h.shipment_id = l.shipment_id
where l.model_name is not null
order by h.customer_party_id, l.model_name, coalesce(h.ship_date::timestamptz, h.confirmed_at, h.created_at) desc;

grant select on public.cms_v_shipped_model_latest_v1 to authenticated, service_role;

commit;
