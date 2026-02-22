-- 2026-02-22 AR SOT integrity audit set
-- Single-shot audit query returning one JSON report row.

with
preflight as (
  select public.cms_fn_ar_sot_preflight_summary_v1(2000) as v
),
uniqueness_gate as (
  select public.cms_fn_ar_sot_enforce_uniqueness_v1(false) as v
),
legacy_guard as (
  select to_jsonb(t) as v
  from (
    select *
    from public.cms_v_ar_legacy_guard_status
    limit 1
  ) t
),
party_outstanding as (
  select
    p.party_id,
    round(coalesce(sum(p.total_cash_outstanding_krw), 0), 6) as invoice_outstanding_krw
  from public.cms_v_ar_invoice_position_v1 p
  group by p.party_id
),
party_ledger as (
  select
    l.party_id,
    round(coalesce(sum(l.amount_krw), 0), 6) as ledger_outstanding_krw
  from public.cms_ar_ledger l
  group by l.party_id
),
party_mismatch as (
  select
    coalesce(o.party_id, g.party_id) as party_id,
    coalesce(o.invoice_outstanding_krw, 0) as invoice_outstanding_krw,
    coalesce(g.ledger_outstanding_krw, 0) as ledger_outstanding_krw,
    abs(coalesce(o.invoice_outstanding_krw, 0) - coalesce(g.ledger_outstanding_krw, 0)) as diff_krw
  from party_outstanding o
  full join party_ledger g on g.party_id = o.party_id
),
dup_payment_idempotency as (
  select
    party_id,
    idempotency_key,
    count(*) as dup_count
  from public.cms_ar_payment
  where idempotency_key is not null
    and btrim(idempotency_key) <> ''
  group by party_id, idempotency_key
  having count(*) > 1
)
select jsonb_build_object(
  'audit_name', '2026-02-22-ar-sot-integrity-audit-set',
  'generated_at', now(),
  'preflight_summary', (select v from preflight),
  'uniqueness_gate_dry_run', (select v from uniqueness_gate),
  'legacy_guard_status', coalesce((select v from legacy_guard), '{}'::jsonb),
  'party_invoice_ledger_mismatch_count', (
    select count(*)
    from party_mismatch
    where diff_krw > 0.5
  ),
  'party_invoice_ledger_mismatch_top10', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'party_id', party_id,
        'invoice_outstanding_krw', invoice_outstanding_krw,
        'ledger_outstanding_krw', ledger_outstanding_krw,
        'diff_krw', diff_krw
      )
      order by diff_krw desc
    )
    from (
      select *
      from party_mismatch
      where diff_krw > 0.5
      order by diff_krw desc
      limit 10
    ) s
  ), '[]'::jsonb),
  'duplicate_ar_payment_idempotency_count', (select count(*) from dup_payment_idempotency),
  'duplicate_ar_payment_idempotency_top10', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'party_id', party_id,
        'idempotency_key', idempotency_key,
        'dup_count', dup_count
      )
      order by dup_count desc
    )
    from (
      select *
      from dup_payment_idempotency
      order by dup_count desc
      limit 10
    ) d
  ), '[]'::jsonb)
) as audit_report;
