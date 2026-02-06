set search_path = public, pg_temp;

begin;

-- ============================================================
-- cms_0372: AP / AP Reconcile UI helper views (NAMED)
-- 목적: 기존 v1 뷰는 그대로 두고, UI에서 필요한 vendor_name/region/is_active를
--       DB에서 join해서 제공하는 "새 뷰"만 추가한다. (Breaking change 0)
-- ============================================================

-- 1) AP vendor position + vendor info
drop view if exists public.cms_v_ap_position_by_vendor_named_v1 cascade;
create view public.cms_v_ap_position_by_vendor_named_v1
with (security_invoker = true)
as
select
  v.vendor_party_id,
  p.name      as vendor_name,
  p.region    as vendor_region,
  p.is_active as vendor_is_active,

  v.asset_code,
  v.outstanding_qty,
  v.credit_qty
from public.cms_v_ap_position_by_vendor_v1 v
left join public.cms_party p
  on p.party_id = v.vendor_party_id;

grant select on public.cms_v_ap_position_by_vendor_named_v1 to authenticated;
grant select on public.cms_v_ap_position_by_vendor_named_v1 to anon;


-- 2) AP reconcile open summary by vendor + vendor info
drop view if exists public.cms_v_ap_reconcile_open_by_vendor_named_v1 cascade;
create view public.cms_v_ap_reconcile_open_by_vendor_named_v1
with (security_invoker = true)
as
select
  v.vendor_party_id,
  p.name      as vendor_name,
  p.region    as vendor_region,
  p.is_active as vendor_is_active,

  v.open_count,
  v.error_count,
  v.warn_count,
  v.last_open_at
from public.cms_v_ap_reconcile_open_by_vendor_v1 v
left join public.cms_party p
  on p.party_id = v.vendor_party_id;

grant select on public.cms_v_ap_reconcile_open_by_vendor_named_v1 to authenticated;
grant select on public.cms_v_ap_reconcile_open_by_vendor_named_v1 to anon;


-- 3) AP reconcile issue list + vendor info
drop view if exists public.cms_v_ap_reconcile_issue_list_named_v1 cascade;
create view public.cms_v_ap_reconcile_issue_list_named_v1
with (security_invoker = true)
as
select
  i.issue_id,
  i.run_id,
  i.vendor_party_id,
  p.name      as vendor_name,
  p.region    as vendor_region,
  p.is_active as vendor_is_active,

  i.receipt_id,
  i.issue_type,
  i.severity,
  i.status,
  i.summary,
  i.created_at,
  i.snapshot_version,
  i.calc_version
from public.cms_v_ap_reconcile_issue_list_v1 i
left join public.cms_party p
  on p.party_id = i.vendor_party_id;

grant select on public.cms_v_ap_reconcile_issue_list_named_v1 to authenticated;
grant select on public.cms_v_ap_reconcile_issue_list_named_v1 to anon;

commit;
