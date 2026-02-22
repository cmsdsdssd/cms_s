-- cms_0718: AR SOT preflight diagnostics (add-only)

begin;

create or replace view public.v_cms_ar_sot_preflight_v1 as
with confirmed as (
  select
    sh.shipment_id,
    sh.confirmed_at,
    sh.ar_principal_locked_at
  from public.cms_shipment_header sh
  where sh.confirmed_at is not null
),
line_cnt as (
  select
    sl.shipment_id,
    count(*) as line_count
  from public.cms_shipment_line sl
  group by sl.shipment_id
),
inv_cnt as (
  select
    ai.shipment_id,
    count(*) as invoice_count,
    coalesce(sum(ai.total_cash_due_krw), 0) as invoice_total
  from public.cms_ar_invoice ai
  group by ai.shipment_id
),
led_cnt as (
  select
    l.shipment_id,
    count(*) as ledger_row_count,
    coalesce(sum(l.amount_krw), 0) as ledger_total
  from public.cms_ar_ledger l
  where l.entry_type = 'SHIPMENT'
  group by l.shipment_id
),
line_total as (
  select
    sl.shipment_id,
    coalesce(sum(sl.total_amount_sell_krw), 0) as ship_total
  from public.cms_shipment_line sl
  group by sl.shipment_id
),
inv_dups as (
  select
    ai.shipment_line_id,
    count(*) as dup_count
  from public.cms_ar_invoice ai
  where ai.shipment_line_id is not null
  group by ai.shipment_line_id
  having count(*) > 1
),
inv_dup_ship as (
  select
    ai.shipment_id,
    count(*) as invoice_duplicate_line_count
  from public.cms_ar_invoice ai
  join inv_dups d on d.shipment_line_id = ai.shipment_line_id
  group by ai.shipment_id
)
select
  c.shipment_id,
  c.confirmed_at,
  c.ar_principal_locked_at,
  coalesce(lt.ship_total, 0) as ship_total,
  coalesce(iv.invoice_total, 0) as invoice_total,
  coalesce(ld.ledger_total, 0) as ledger_total,
  coalesce(lc.line_count, 0) as line_count,
  coalesce(iv.invoice_count, 0) as invoice_count,
  coalesce(ld.ledger_row_count, 0) as ledger_row_count,
  coalesce(ids.invoice_duplicate_line_count, 0) as invoice_duplicate_line_count,
  (coalesce(iv.invoice_count, 0) > 0 and coalesce(iv.invoice_count, 0) < coalesce(lc.line_count, 0)) as has_partial_invoice,
  (coalesce(ld.ledger_row_count, 0) > 1) as has_duplicate_shipment_ledger,
  (coalesce(ids.invoice_duplicate_line_count, 0) > 0) as has_duplicate_invoice_line,
  (abs(coalesce(iv.invoice_total, 0) - coalesce(ld.ledger_total, 0)) > 0.5) as has_invoice_ledger_mismatch,
  (coalesce(iv.invoice_count, 0) > 0 and abs(coalesce(lt.ship_total, 0) - coalesce(iv.invoice_total, 0)) > 0.5) as has_ship_invoice_mismatch
from confirmed c
left join line_cnt lc on lc.shipment_id = c.shipment_id
left join inv_cnt iv on iv.shipment_id = c.shipment_id
left join led_cnt ld on ld.shipment_id = c.shipment_id
left join line_total lt on lt.shipment_id = c.shipment_id
left join inv_dup_ship ids on ids.shipment_id = c.shipment_id;

create or replace function public.cms_fn_ar_sot_preflight_summary_v1(
  p_limit int default 500
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with rows as (
    select *
    from public.v_cms_ar_sot_preflight_v1
    order by confirmed_at desc
    limit greatest(coalesce(p_limit, 500), 1)
  )
  select jsonb_build_object(
    'ok', true,
    'count', count(*),
    'partial_invoice_count', count(*) filter (where has_partial_invoice),
    'duplicate_shipment_ledger_count', count(*) filter (where has_duplicate_shipment_ledger),
    'duplicate_invoice_line_count', count(*) filter (where has_duplicate_invoice_line),
    'invoice_ledger_mismatch_count', count(*) filter (where has_invoice_ledger_mismatch),
    'ship_invoice_mismatch_count', count(*) filter (where has_ship_invoice_mismatch),
    'rows', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'shipment_id', shipment_id,
          'confirmed_at', confirmed_at,
          'ar_principal_locked_at', ar_principal_locked_at,
          'line_count', line_count,
          'invoice_count', invoice_count,
          'ledger_row_count', ledger_row_count,
          'ship_total', ship_total,
          'invoice_total', invoice_total,
          'ledger_total', ledger_total,
          'invoice_duplicate_line_count', invoice_duplicate_line_count,
          'has_partial_invoice', has_partial_invoice,
          'has_duplicate_shipment_ledger', has_duplicate_shipment_ledger,
          'has_duplicate_invoice_line', has_duplicate_invoice_line,
          'has_invoice_ledger_mismatch', has_invoice_ledger_mismatch,
          'has_ship_invoice_mismatch', has_ship_invoice_mismatch
        )
        order by confirmed_at desc
      ),
      '[]'::jsonb
    )
  )
  from rows;
$$;

grant select on public.v_cms_ar_sot_preflight_v1 to authenticated, service_role;
grant execute on function public.cms_fn_ar_sot_preflight_summary_v1(int) to authenticated, service_role;

commit;
