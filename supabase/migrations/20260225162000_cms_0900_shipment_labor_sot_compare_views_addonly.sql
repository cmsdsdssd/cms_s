-- Compare-only rollout for shipment labor SoT observability.
-- This migration does NOT change write/confirm/unconfirm logic.
-- It adds read-only views for side-by-side comparison.

begin;
set search_path = public, pg_temp;

drop view if exists public.v_cms_shipment_labor_sot_v1;
create view public.v_cms_shipment_labor_sot_v1
with (security_invoker = true)
as
select
  sl.shipment_line_id,
  sl.shipment_id,
  sh.status as shipment_status,
  sh.confirmed_at,
  sh.ar_principal_locked_at,
  sl.pricing_mode,
  sl.base_labor_krw,
  sl.extra_labor_krw,
  sl.manual_labor_krw,
  sl.labor_total_sell_krw,
  sl.extra_labor_items,
  sl.material_amount_sell_krw,
  sl.total_amount_sell_krw,
  coalesce(
    sl.labor_total_sell_krw,
    sl.manual_labor_krw,
    coalesce(sl.base_labor_krw, 0) + coalesce(sl.extra_labor_krw, 0),
    0
  ) as sot_labor_krw,
  (coalesce(sh.status::text, '') = 'DRAFT') as is_draft,
  (
    sh.confirmed_at is not null
    or coalesce(sh.status::text, '') = 'CONFIRMED'
    or sh.ar_principal_locked_at is not null
  ) as is_locked,
  sl.created_at,
  sl.updated_at
from public.cms_shipment_line sl
join public.cms_shipment_header sh
  on sh.shipment_id = sl.shipment_id;

comment on view public.v_cms_shipment_labor_sot_v1 is
  'Compare-only facade for persisted shipment labor fields. No write logic change.';

grant select on public.v_cms_shipment_labor_sot_v1 to authenticated, service_role;

drop view if exists public.v_cms_shipment_labor_sot_audit_v1;
create view public.v_cms_shipment_labor_sot_audit_v1
as
select
  s.shipment_line_id,
  s.shipment_id,
  s.shipment_status,
  s.confirmed_at,
  s.ar_principal_locked_at,
  s.pricing_mode,
  s.base_labor_krw,
  s.extra_labor_krw,
  s.manual_labor_krw,
  s.labor_total_sell_krw,
  s.sot_labor_krw,
  s.extra_labor_items,
  s.material_amount_sell_krw,
  s.total_amount_sell_krw,
  s.is_draft,
  s.is_locked,
  i.sanitized_sum_krw,
  i.delta_krw,
  i.has_mismatch,
  i.has_material_master,
  mod(coalesce(s.base_labor_krw, 0), 100) as base_mod_100,
  mod(coalesce(s.extra_labor_krw, 0), 100) as extra_mod_100,
  mod(coalesce(s.sot_labor_krw, 0), 100) as sot_mod_100,
  s.created_at,
  s.updated_at
from public.v_cms_shipment_labor_sot_v1 s
left join public.v_cms_shipment_labor_integrity_v1 i
  on i.shipment_line_id = s.shipment_line_id;

comment on view public.v_cms_shipment_labor_sot_audit_v1 is
  'Compare-only audit view joining labor SoT facade with integrity diagnostics.';

grant select on public.v_cms_shipment_labor_sot_audit_v1 to authenticated, service_role;

commit;
