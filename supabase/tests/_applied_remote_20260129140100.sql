set search_path = public, pg_temp;

-- Backfill master_id from order_line when it exists
update public.cms_shipment_line sl
set master_id = o.matched_master_id
from public.cms_order_line o
where sl.order_line_id = o.order_line_id
  and sl.master_id is null
  and o.matched_master_id is not null;
