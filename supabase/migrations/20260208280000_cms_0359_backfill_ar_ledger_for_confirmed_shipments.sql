set search_path = public, pg_temp;
-- Insert missing AR ledger rows for confirmed shipments
insert into public.cms_ar_ledger (
  ar_ledger_id,
  party_id,
  occurred_at,
  entry_type,
  amount_krw,
  shipment_id,
  memo,
  created_at
)
select
  gen_random_uuid(),
  sh.customer_party_id,
  sh.confirmed_at,
  'SHIPMENT',
  coalesce(sum(sl.total_amount_sell_krw), 0),
  sh.shipment_id,
  'Auto-backfill: missing AR',
  now()
from public.cms_shipment_header sh
join public.cms_shipment_line sl on sl.shipment_id = sh.shipment_id
where sh.status = 'CONFIRMED'
group by sh.shipment_id, sh.customer_party_id, sh.confirmed_at
having not exists (
  select 1
  from public.cms_ar_ledger ar
  where ar.shipment_id = sh.shipment_id
    and ar.entry_type = 'SHIPMENT'
);
-- Fix zero amount rows when shipment totals exist
update public.cms_ar_ledger ar
set
  amount_krw = s.total_amount_krw,
  occurred_at = coalesce(ar.occurred_at, s.confirmed_at)
from (
  select
    sh.shipment_id,
    sh.confirmed_at,
    coalesce(sum(sl.total_amount_sell_krw), 0) as total_amount_krw
  from public.cms_shipment_header sh
  join public.cms_shipment_line sl on sl.shipment_id = sh.shipment_id
  where sh.status = 'CONFIRMED'
  group by sh.shipment_id, sh.confirmed_at
) s
where ar.entry_type = 'SHIPMENT'
  and ar.shipment_id = s.shipment_id
  and coalesce(ar.amount_krw, 0) = 0
  and s.total_amount_krw > 0;
