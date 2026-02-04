set search_path = public, pg_temp;

-- 1) master_id backfill (order_line -> model_name)
update public.cms_shipment_line sl
set master_id = o.matched_master_id
from public.cms_order_line o
where sl.order_line_id = o.order_line_id
  and sl.master_id is null
  and o.matched_master_id is not null;

update public.cms_shipment_line sl
set master_id = m.master_id
from public.cms_master_item m
where sl.master_id is null
  and sl.model_name is not null
  and trim(sl.model_name) = m.model_name;

-- 2) category/material backfill (master + ad-hoc + order_line material)
update public.cms_shipment_line sl
set
  category_code = coalesce(
    sl.category_code,
    (select m1.category_code from public.cms_master_item m1 where m1.master_id = o.matched_master_id),
    (select m2.category_code from public.cms_master_item m2 where m2.master_id = sl.master_id),
    sl.ad_hoc_category_code
  ),
  material_code = coalesce(
    sl.material_code,
    o.material_code,
    (select m1.material_code_default from public.cms_master_item m1 where m1.master_id = o.matched_master_id),
    (select m2.material_code_default from public.cms_master_item m2 where m2.master_id = sl.master_id),
    (select r.material_code from public.cms_repair_line r where r.repair_line_id = sl.repair_line_id)
  )
from public.cms_order_line o
where sl.order_line_id = o.order_line_id
  and (sl.category_code is null or sl.material_code is null);

update public.cms_shipment_line sl
set
  category_code = coalesce(
    sl.category_code,
    (select m.category_code from public.cms_master_item m where m.master_id = sl.master_id),
    sl.ad_hoc_category_code
  ),
  material_code = coalesce(
    sl.material_code,
    (select m.material_code_default from public.cms_master_item m where m.master_id = sl.master_id),
    (select r.material_code from public.cms_repair_line r where r.repair_line_id = sl.repair_line_id)
  )
where sl.order_line_id is null
  and sl.master_id is not null
  and (sl.category_code is null or sl.material_code is null);

-- 3) weight backfill (repair -> master default) for non-00 materials
update public.cms_shipment_line sl
set measured_weight_g = r.weight_received_g
from public.cms_repair_line r
where sl.repair_line_id = r.repair_line_id
  and sl.measured_weight_g is null
  and r.weight_received_g is not null
  and coalesce(sl.material_code, r.material_code) <> '00'::public.cms_e_material_code;

update public.cms_shipment_line sl
set measured_weight_g = (m.weight_default_g * sl.qty)
from public.cms_master_item m
where sl.master_id = m.master_id
  and sl.measured_weight_g is null
  and m.weight_default_g is not null
  and sl.material_code <> '00'::public.cms_e_material_code;
