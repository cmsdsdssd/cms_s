set search_path = public, pg_temp;

-- add-only: expose header meta on inventory move lines view
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
  h.bin_code,
  h.ref_doc_type,
  h.ref_doc_id,
  h.memo as move_memo,
  h.source as move_source,
  h.meta as move_meta,
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

grant select on public.cms_v_inventory_move_lines_enriched_v1 to anon, authenticated;
