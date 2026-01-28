-- 20260128302200_cms_0215_inventory_stocktake_views.sql
set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 1) Sessions list
-- ---------------------------------------------------------------------
create or replace view public.cms_v_inventory_count_sessions_v1
with (security_invoker = true)
as
select
  s.session_id,
  s.session_no,
  s.session_code,
  s.snapshot_at,
  s.location_code,
  s.status,
  s.memo,
  s.meta,
  s.generated_move_id,
  mh.move_no as generated_move_no,
  mh.status as generated_move_status,
  s.finalized_at,
  s.voided_at,
  s.void_reason,
  s.created_at,
  s.updated_at,

  count(l.count_line_id) filter (where l.is_void=false) as line_count,
  count(l.count_line_id) filter (where l.is_void=false and coalesce(l.delta_qty,0) <> 0) as delta_line_count,
  coalesce(sum(abs(coalesce(l.delta_qty,0))) filter (where l.is_void=false), 0) as sum_abs_delta
from public.cms_inventory_count_session s
left join public.cms_inventory_count_line l
  on l.session_id = s.session_id
left join public.cms_inventory_move_header mh
  on mh.move_id = s.generated_move_id
group by
  s.session_id, s.session_no, s.session_code, s.snapshot_at, s.location_code, s.status,
  s.memo, s.meta, s.generated_move_id, mh.move_no, mh.status,
  s.finalized_at, s.voided_at, s.void_reason, s.created_at, s.updated_at;

-- ---------------------------------------------------------------------
-- 2) Lines enriched
-- ---------------------------------------------------------------------
create or replace view public.cms_v_inventory_count_lines_enriched_v1
with (security_invoker = true)
as
select
  s.session_id,
  s.session_no,
  s.session_code,
  s.snapshot_at,
  s.location_code,
  s.status as session_status,
  s.generated_move_id,

  l.count_line_id,
  l.line_no,
  l.item_ref_type,
  l.master_id,
  m.model_name as master_model_name,
  l.part_id,
  l.item_name,
  l.variant_hint,
  l.counted_qty,
  l.system_qty_asof,
  l.delta_qty,
  abs(coalesce(l.delta_qty,0)) as abs_delta_qty,
  l.note,
  l.meta,
  l.is_void,
  l.void_reason,
  l.created_at,
  l.updated_at
from public.cms_inventory_count_session s
join public.cms_inventory_count_line l
  on l.session_id = s.session_id
left join public.cms_master_item m
  on m.master_id = l.master_id;

-- ---------------------------------------------------------------------
-- 3) Variance (top deltas first)
-- ---------------------------------------------------------------------
create or replace view public.cms_v_inventory_stocktake_variance_v1
with (security_invoker = true)
as
select
  session_id,
  session_no,
  session_code,
  snapshot_at,
  location_code,
  session_status,
  generated_move_id,
  count_line_id,
  line_no,
  item_ref_type,
  master_id,
  master_model_name,
  item_name,
  variant_hint,
  counted_qty,
  system_qty_asof,
  delta_qty,
  abs_delta_qty,
  is_void,
  void_reason,
  created_at
from public.cms_v_inventory_count_lines_enriched_v1
where is_void = false
order by abs_delta_qty desc, line_no asc;

grant select on public.cms_v_inventory_count_sessions_v1 to authenticated;
grant select on public.cms_v_inventory_count_lines_enriched_v1 to authenticated;
grant select on public.cms_v_inventory_stocktake_variance_v1 to authenticated;
