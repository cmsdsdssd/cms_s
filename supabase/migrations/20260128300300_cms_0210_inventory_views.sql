-- 20260128300300_cms_0210_inventory_views.sql
set search_path = public, pg_temp;
drop view if exists public.cms_v_inventory_move_worklist_v1;
create view public.cms_v_inventory_move_worklist_v1
with (security_invoker = true)
as
select
  h.move_id,
  h.move_no,
  h.move_type,
  h.status,
  h.occurred_at,
  h.party_id,
  p.name as party_name,
  h.location_code,
  h.ref_doc_type,
  h.ref_doc_id,
  h.memo,
  h.source,
  h.meta,
  h.idempotency_key,
  h.posted_at,
  h.voided_at,
  h.void_reason,
  h.created_at,
  h.updated_at,
  count(l.move_line_id) filter (where l.is_void = false) as line_count,
  coalesce(sum(case when l.is_void=false and l.direction='IN'  then l.qty else 0 end),0) as total_in_qty,
  coalesce(sum(case when l.is_void=false and l.direction='OUT' then l.qty else 0 end),0) as total_out_qty
from public.cms_inventory_move_header h
left join public.cms_party p on p.party_id = h.party_id
left join public.cms_inventory_move_line l on l.move_id = h.move_id
group by
  h.move_id, h.move_no, h.move_type, h.status, h.occurred_at,
  h.party_id, p.name, h.location_code, h.ref_doc_type, h.ref_doc_id,
  h.memo, h.source, h.meta, h.idempotency_key, h.posted_at,
  h.voided_at, h.void_reason, h.created_at, h.updated_at;
drop view if exists public.cms_v_inventory_move_lines_enriched_v1;
create view public.cms_v_inventory_move_lines_enriched_v1
with (security_invoker = true)
as
select
  h.move_id,
  h.move_no,
  h.move_type,
  h.status as move_status,
  h.occurred_at,
  h.party_id,
  p.name as party_name,
  h.location_code,
  h.ref_doc_type,
  h.ref_doc_id,
  h.memo as move_memo,
  h.source as move_source,

  l.move_line_id,
  l.line_no,
  l.direction,
  l.qty,
  l.unit,

  l.item_ref_type,
  l.master_id,
  m.model_name as master_model_name,
  l.item_name,
  l.variant_hint,
  l.note as line_note,
  l.meta as line_meta,
  l.is_void,
  l.void_reason,
  l.ref_entity_type,
  l.ref_entity_id,

  case when l.direction='IN' then l.qty else -l.qty end as signed_qty,

  l.created_at as line_created_at,
  l.updated_at as line_updated_at
from public.cms_inventory_move_header h
join public.cms_inventory_move_line l on l.move_id = h.move_id
left join public.cms_party p on p.party_id = h.party_id
left join public.cms_master_item m on m.master_id = l.master_id;
drop view if exists public.cms_v_inventory_position_by_item_label_v1 cascade;
create view public.cms_v_inventory_position_by_item_label_v1
with (security_invoker = true)
as
select
  l.item_ref_type,
  l.item_name,
  nullif(trim(coalesce(l.variant_hint,'')), '') as variant_hint,
  sum(case when l.direction='IN' then l.qty else -l.qty end) as on_hand_qty,
  max(h.occurred_at) as last_move_at
from public.cms_inventory_move_line l
join public.cms_inventory_move_header h on h.move_id = l.move_id
where h.status = 'POSTED'
  and l.is_void = false
group by l.item_ref_type, l.item_name, nullif(trim(coalesce(l.variant_hint,'')), '');
drop view if exists public.cms_v_inventory_position_by_master_item_v1;
create view public.cms_v_inventory_position_by_master_item_v1
with (security_invoker = true)
as
select
  l.master_id,
  m.model_name,
  sum(case when l.direction='IN' then l.qty else -l.qty end) as on_hand_qty,
  max(h.occurred_at) as last_move_at
from public.cms_inventory_move_line l
join public.cms_inventory_move_header h on h.move_id = l.move_id
join public.cms_master_item m on m.master_id = l.master_id
where h.status = 'POSTED'
  and l.is_void = false
  and l.master_id is not null
group by l.master_id, m.model_name;
drop view if exists public.cms_v_inventory_exceptions_v1;
create view public.cms_v_inventory_exceptions_v1
with (security_invoker = true)
as
select
  'UNLINKED_POSTED'::text as exception_type,
  2::int as severity,
  h.move_id as entity_id,
  h.occurred_at,
  jsonb_build_object(
    'move_no', h.move_no,
    'move_type', h.move_type,
    'item_name', l.item_name,
    'variant_hint', l.variant_hint,
    'qty', l.qty,
    'direction', l.direction
  ) as details
from public.cms_inventory_move_header h
join public.cms_inventory_move_line l on l.move_id = h.move_id
where h.status='POSTED'
  and l.is_void=false
  and l.item_ref_type='UNLINKED'

union all
select
  'NEGATIVE_STOCK'::text as exception_type,
  1::int as severity,
  null::uuid as entity_id,
  now() as occurred_at,
  jsonb_build_object(
    'item_ref_type', x.item_ref_type,
    'item_name', x.item_name,
    'variant_hint', x.variant_hint,
    'on_hand_qty', x.on_hand_qty,
    'last_move_at', x.last_move_at
  ) as details
from public.cms_v_inventory_position_by_item_label_v1 x
where x.on_hand_qty < 0

union all
select
  'STALE_DRAFT'::text as exception_type,
  3::int as severity,
  h.move_id as entity_id,
  h.updated_at as occurred_at,
  jsonb_build_object(
    'move_no', h.move_no,
    'move_type', h.move_type,
    'updated_at', h.updated_at
  ) as details
from public.cms_inventory_move_header h
where h.status='DRAFT'
  and h.updated_at < (now() - interval '24 hours');
