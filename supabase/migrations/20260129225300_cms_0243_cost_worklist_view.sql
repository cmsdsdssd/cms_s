-- 20260129225300_cms_0243_cost_worklist_view.sql
set search_path = public, pg_temp;

drop view if exists public.cms_v_purchase_cost_worklist_v1;

create view public.cms_v_purchase_cost_worklist_v1 as
select
  sh.shipment_id,
  sh.customer_party_id,
  p.name as customer_name,
  sh.ship_date,
  sh.status,
  sh.confirmed_at,

  sl.shipment_line_id,
  sl.master_id,
  sl.model_name,
  sl.category_code,
  sl.qty,

  sl.total_amount_sell_krw,
  sl.total_amount_cost_krw,

  sl.purchase_unit_cost_krw,
  sl.purchase_total_cost_krw,
  sl.purchase_cost_status,
  sl.purchase_cost_source,
  sl.purchase_receipt_id,
  sl.purchase_cost_trace,
  sl.purchase_cost_finalized_at,
  sl.purchase_cost_finalized_by,

  sl.updated_at as line_updated_at
from public.cms_shipment_header sh
join public.cms_shipment_line sl
  on sl.shipment_id = sh.shipment_id
left join public.cms_party p
  on p.party_id = sh.customer_party_id
where
  sh.status = 'CONFIRMED'
  and (
    sl.purchase_total_cost_krw is null
    or sl.purchase_unit_cost_krw is null
    or sl.purchase_receipt_id is null
    or sl.purchase_cost_status is null
  );
