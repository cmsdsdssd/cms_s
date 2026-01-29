set search_path = public, pg_temp;
drop view if exists public.v_cms_shipment_history_by_model;
create view public.v_cms_shipment_history_by_model
with (security_invoker = true)
as
select
  l.shipment_line_id,
  l.shipment_id,
  l.order_line_id,
  h.ship_date,
  h.status as shipment_status,
  l.model_name,
  l.suffix,
  l.color,
  l.qty,
  l.is_plated,
  l.plating_variant_id,
  l.manual_total_amount_krw,
  l.created_at
from public.cms_shipment_line l
join public.cms_shipment_header h on h.shipment_id = l.shipment_id;

grant select on public.v_cms_shipment_history_by_model to anon, authenticated;
