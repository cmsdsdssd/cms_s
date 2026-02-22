-- cms_0726: reconcile locked shipment line sell totals to AR invoice principal
-- Scope: only shipments flagged by preflight as ship_invoice_mismatch=true
--        while invoice_ledger_mismatch=false and principal is locked.

begin;

create table if not exists public.cms_ar_ship_invoice_reconcile_audit (
  audit_id uuid primary key default gen_random_uuid(),
  executed_at timestamptz not null default now(),
  shipment_id uuid not null,
  shipment_line_id uuid not null,
  old_total_amount_sell_krw numeric not null,
  new_total_amount_sell_krw numeric not null,
  reason text not null,
  actor text not null default 'cms_0726_migration'
);

with targets as (
  select
    p.shipment_id
  from public.v_cms_ar_sot_preflight_v1 p
  where p.has_ship_invoice_mismatch
    and not p.has_invoice_ledger_mismatch
    and p.ar_principal_locked_at is not null
),
line_targets as (
  select
    sl.shipment_id,
    sl.shipment_line_id,
    sl.total_amount_sell_krw as old_total,
    ai.total_cash_due_krw as new_total
  from public.cms_shipment_line sl
  join public.cms_ar_invoice ai
    on ai.shipment_line_id = sl.shipment_line_id
  join targets t
    on t.shipment_id = sl.shipment_id
  where abs(coalesce(sl.total_amount_sell_krw, 0) - coalesce(ai.total_cash_due_krw, 0)) > 0.5
),
audit_ins as (
  insert into public.cms_ar_ship_invoice_reconcile_audit(
    shipment_id,
    shipment_line_id,
    old_total_amount_sell_krw,
    new_total_amount_sell_krw,
    reason
  )
  select
    lt.shipment_id,
    lt.shipment_line_id,
    lt.old_total,
    lt.new_total,
    'align shipment_line.total_amount_sell_krw to locked invoice principal'
  from line_targets lt
  returning shipment_line_id
)
update public.cms_shipment_line sl
set
  total_amount_sell_krw = lt.new_total,
  updated_at = now()
from line_targets lt
where sl.shipment_line_id = lt.shipment_line_id;

do $$
declare
  v_remaining integer;
begin
  select count(*)
    into v_remaining
  from public.v_cms_ar_sot_preflight_v1 p
  where p.has_ship_invoice_mismatch
    and not p.has_invoice_ledger_mismatch
    and p.ar_principal_locked_at is not null;

  if v_remaining > 0 then
    raise exception 'cms_0726 failed: ship-invoice mismatches still remain for locked shipments (% rows)', v_remaining;
  end if;
end $$;

commit;
