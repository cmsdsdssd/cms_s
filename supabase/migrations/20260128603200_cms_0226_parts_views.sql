set search_path = public, pg_temp;
-- 1) part master + on_hand + avg_cost
drop view if exists public.cms_v_part_master_with_position_v1;
create view public.cms_v_part_master_with_position_v1 as
with ledger as (
  select
    l.part_id,
    sum(case when l.direction='IN' then l.qty else -l.qty end) as on_hand_qty,
    max(h.occurred_at) as last_move_at,
    max(case when h.move_type='RECEIPT' then h.occurred_at end) as last_receipt_at,
    max(case when h.move_type='ISSUE' then h.occurred_at end) as last_issue_at
  from public.cms_inventory_move_line l
  join public.cms_inventory_move_header h on h.move_id=l.move_id
  where h.status='POSTED'
    and l.is_void=false
    and l.item_ref_type='PART'
    and l.part_id is not null
  group by l.part_id
),
avg_cost as (
  select
    l.part_id,
    case when sum(l.qty) filter (where h.move_type='RECEIPT' and l.direction='IN' and l.unit_cost_krw is not null) = 0
      then null
      else
        sum(l.qty * l.unit_cost_krw) filter (where h.move_type='RECEIPT' and l.direction='IN' and l.unit_cost_krw is not null)
        /
        sum(l.qty) filter (where h.move_type='RECEIPT' and l.direction='IN' and l.unit_cost_krw is not null)
    end as weighted_avg_unit_cost_krw
  from public.cms_inventory_move_line l
  join public.cms_inventory_move_header h on h.move_id=l.move_id
  where h.status='POSTED'
    and l.is_void=false
    and l.item_ref_type='PART'
    and l.part_id is not null
  group by l.part_id
)
select
  p.*,
  coalesce(g.on_hand_qty,0) as on_hand_qty,
  g.last_move_at,
  g.last_receipt_at,
  g.last_issue_at,
  a.weighted_avg_unit_cost_krw
from public.cms_part_item p
left join ledger g on g.part_id=p.part_id
left join avg_cost a on a.part_id=p.part_id;
-- 2) parts ledger (lines)
drop view if exists public.cms_v_part_move_lines_v1 cascade;
create view public.cms_v_part_move_lines_v1 as
select
  h.move_id,
  h.move_type,
  h.occurred_at,
  h.status,
  h.location_code,
  h.memo as move_memo,
  h.source,
  h.ref_doc_type,
  h.ref_doc_id,
  h.meta as header_meta,

  l.line_no,
  l.direction,
  l.qty,
  l.unit,
  l.item_ref_type,
  l.part_id,
  p.part_name,
  p.part_kind,
  p.family_name,
  l.item_name as entered_name,
  l.unit_cost_krw,
  l.amount_krw,
  l.meta as line_meta,
  l.is_void,
  l.void_reason
from public.cms_inventory_move_header h
join public.cms_inventory_move_line l on l.move_id=h.move_id
left join public.cms_part_item p on p.part_id=l.part_id
where h.status='POSTED'
  and l.is_void=false
  and (l.item_ref_type='PART' or (l.item_ref_type='UNLINKED' and (h.meta->>'module')='PARTS'));
-- 3) unlinked worklist
drop view if exists public.cms_v_part_unlinked_worklist_v1;
create view public.cms_v_part_unlinked_worklist_v1 as
select *
from public.cms_v_part_move_lines_v1
where item_ref_type='UNLINKED';
-- 4) daily usage stats (analysis)
drop view if exists public.cms_v_part_usage_daily_v1;
create view public.cms_v_part_usage_daily_v1 as
select
  date_trunc('day', h.occurred_at) as day,
  coalesce(p.part_kind, 'PART'::public.cms_e_part_kind) as part_kind,
  coalesce(p.family_name, '(no_family)') as family_name,
  coalesce(p.part_id, null) as part_id,
  coalesce(p.part_name, l.item_name) as part_name,
  sum(l.qty) as used_qty,
  max(l.unit) as unit,
  sum(coalesce(l.amount_krw,0)) as used_amount_krw
from public.cms_inventory_move_header h
join public.cms_inventory_move_line l on l.move_id=h.move_id
left join public.cms_part_item p on p.part_id=l.part_id
where h.status='POSTED'
  and l.is_void=false
  and h.move_type='ISSUE'
  and (
    l.item_ref_type='PART'
    or (l.item_ref_type='UNLINKED' and (h.meta->>'module')='PARTS')
  )
group by 1,2,3,4,5;
