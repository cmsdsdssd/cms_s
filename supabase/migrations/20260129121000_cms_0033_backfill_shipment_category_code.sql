-- Fix existing shipment_line records with null category_code
-- Backfill category_code from master_item where possible
set search_path = public, pg_temp;

-- Update existing shipment_line records that have null category_code
-- but can be resolved from master_item
update public.cms_shipment_line sl
set category_code = m.category_code
from public.cms_master_item m
where sl.category_code is null
  and sl.model_name is not null
  and sl.model_name = m.model_name
  and m.category_code is not null;

-- If there are still shipment_lines with null model_name but have order_line_id,
-- try to populate from order
update public.cms_shipment_line sl
set model_name = o.model_name,
    category_code = m.category_code
from public.cms_order_line o
join public.cms_master_item m on m.model_name = o.model_name
where sl.model_name is null
  and sl.order_line_id is not null
  and sl.order_line_id = o.order_line_id
  and m.category_code is not null;

comment on table public.cms_shipment_line 
is 'Backfilled category_code from master_item for existing records';
