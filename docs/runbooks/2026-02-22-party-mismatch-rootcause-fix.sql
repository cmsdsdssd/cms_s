-- 2026-02-22 party mismatch root-cause + corrective action SQL
-- Scope: party-level invoice_outstanding vs ledger_sum drift

-- Target parties from latest audit
with target_party as (
  select unnest(array[
    'c6c9a52c-8416-43fa-aaf0-d3958093abc8'::uuid,
    '267b879b-9c8a-4406-889a-182ae5472503'::uuid
  ]) as party_id
),
invoice_sum as (
  select p.party_id, coalesce(sum(p.total_cash_outstanding_krw), 0)::numeric as invoice_outstanding
  from public.cms_v_ar_invoice_position_v1 p
  join target_party t on t.party_id = p.party_id
  group by p.party_id
),
ledger_sum as (
  select l.party_id, coalesce(sum(l.amount_krw), 0)::numeric as ledger_outstanding
  from public.cms_ar_ledger l
  join target_party t on t.party_id = l.party_id
  group by l.party_id
),
party_diff as (
  select
    t.party_id,
    coalesce(i.invoice_outstanding, 0) as invoice_outstanding,
    coalesce(g.ledger_outstanding, 0) as ledger_outstanding,
    (coalesce(i.invoice_outstanding, 0) - coalesce(g.ledger_outstanding, 0)) as diff_krw
  from target_party t
  left join invoice_sum i on i.party_id = t.party_id
  left join ledger_sum g on g.party_id = t.party_id
)
select *
from party_diff
order by abs(diff_krw) desc;

-- Entry type decomposition
with target_party as (
  select unnest(array[
    'c6c9a52c-8416-43fa-aaf0-d3958093abc8'::uuid,
    '267b879b-9c8a-4406-889a-182ae5472503'::uuid
  ]) as party_id
)
select
  l.party_id,
  l.entry_type,
  round(sum(l.amount_krw), 6) as amount_sum,
  count(*) as row_count
from public.cms_ar_ledger l
join target_party t on t.party_id = l.party_id
group by l.party_id, l.entry_type
order by l.party_id, l.entry_type;

-- Root-cause probe for anomalous writeoff payment (known row)
select
  p.payment_id,
  p.party_id,
  p.paid_at,
  p.cash_krw,
  coalesce(sum(a.alloc_cash_krw), 0) as alloc_cash_krw_sum,
  coalesce(sum(a.alloc_labor_krw), 0) as alloc_labor_krw_sum,
  coalesce(sum(a.alloc_material_krw), 0) as alloc_material_krw_sum,
  (p.cash_krw - coalesce(sum(a.alloc_cash_krw), 0)) as payment_minus_alloc_cash
from public.cms_ar_payment p
left join public.cms_ar_payment_alloc a on a.payment_id = p.payment_id
where p.payment_id = 'e44eda98-8b71-4b76-9dae-01e23d37ef90'::uuid
group by p.payment_id, p.party_id, p.paid_at, p.cash_krw;

-- --------------------------------------------------------------------
-- Corrective action SQL (OPTIONAL): balancing ADJUST ledger entry
-- Use only after human review. This preserves existing rows (append-only style).
-- --------------------------------------------------------------------

-- 1) Generate candidate balancing entries (do not execute inserts yet)
with target_party as (
  select unnest(array[
    'c6c9a52c-8416-43fa-aaf0-d3958093abc8'::uuid,
    '267b879b-9c8a-4406-889a-182ae5472503'::uuid
  ]) as party_id
),
invoice_sum as (
  select p.party_id, coalesce(sum(p.total_cash_outstanding_krw), 0)::numeric as invoice_outstanding
  from public.cms_v_ar_invoice_position_v1 p
  join target_party t on t.party_id = p.party_id
  group by p.party_id
),
ledger_sum as (
  select l.party_id, coalesce(sum(l.amount_krw), 0)::numeric as ledger_outstanding
  from public.cms_ar_ledger l
  join target_party t on t.party_id = l.party_id
  group by l.party_id
),
delta as (
  select
    t.party_id,
    (coalesce(i.invoice_outstanding, 0) - coalesce(g.ledger_outstanding, 0)) as diff_krw
  from target_party t
  left join invoice_sum i on i.party_id = t.party_id
  left join ledger_sum g on g.party_id = t.party_id
)
select
  party_id,
  round(diff_krw, 6) as diff_krw,
  case
    when abs(diff_krw) <= 0.5 then '-- skip (within epsilon)'
    else
      format(
        $$insert into public.cms_ar_ledger(party_id, occurred_at, entry_type, amount_krw, payment_id, memo)
values ('%s'::uuid, now(), 'ADJUST', %s, null, '[PARTY_BALANCE_RECONCILE 2026-02-22]');$$,
        party_id::text,
        round(diff_krw, 6)::text
      )
  end as candidate_sql
from delta
order by abs(diff_krw) desc;

-- 2) After manual review, execute generated candidate SQL.
-- 3) Re-run the first query in this file and ensure abs(diff_krw) <= 0.5.
