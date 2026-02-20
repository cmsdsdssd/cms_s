-- 1) 테스트용: DRAFT 출고에서 master_id NULL 라인 제거
delete from public.cms_shipment_line sl
using public.cms_shipment_header sh
where sl.shipment_id = sh.shipment_id
  and sh.status = 'DRAFT'
  and sl.master_id is null;
-- 2) order_line: matched_master_id 비어있으면 model_name trim 매칭으로 채움
update public.cms_order_line o
set
  matched_master_id = m.master_id,
  match_state = 'AUTO_MATCHED',
  updated_at = now()
from public.cms_master_item m
where o.matched_master_id is null
  and lower(trim(o.model_name)) = lower(trim(m.model_name));
-- 3) shipment_line: order_line -> master_id 백필 (없으면 model_name trim 매칭)
update public.cms_shipment_line sl
set master_id = coalesce(o.matched_master_id, m.master_id)
from public.cms_order_line o
left join public.cms_master_item m
  on lower(trim(o.model_name)) = lower(trim(m.model_name))
where sl.order_line_id = o.order_line_id
  and sl.master_id is null;
