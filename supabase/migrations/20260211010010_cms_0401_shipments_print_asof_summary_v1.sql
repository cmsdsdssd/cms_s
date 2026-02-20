-- cms_0401: as-of AR summary for shipments_print (add-only)
-- Purpose: provide stable "previous receivable" snapshot at KST day-start

create or replace function public.cms_fn_ar_position_asof_v1(
  p_party_ids uuid[] default null,
  p_asof timestamptz default now()
)
returns table (
  party_id uuid,
  receivable_krw numeric,
  labor_cash_outstanding_krw numeric,
  gold_outstanding_g numeric,
  silver_outstanding_g numeric
)
language sql
security definer
set search_path to 'public', 'pg_temp'
as $$
with party_set as (
  select distinct l.party_id
  from public.cms_ar_ledger l
  where l.occurred_at < p_asof
    and (p_party_ids is null or l.party_id = any(p_party_ids))
  union
  select distinct i.party_id
  from public.cms_ar_invoice i
  where i.occurred_at < p_asof
    and (p_party_ids is null or i.party_id = any(p_party_ids))
  union
  select unnest(p_party_ids)
  where p_party_ids is not null
),
ledger_asof as (
  select
    l.party_id,
    greatest(coalesce(sum(l.amount_krw), 0), 0) as receivable_krw
  from public.cms_ar_ledger l
  where l.occurred_at < p_asof
    and (p_party_ids is null or l.party_id = any(p_party_ids))
  group by l.party_id
),
alloc_asof as (
  select
    a.ar_id,
    coalesce(sum(a.alloc_labor_krw), 0) as alloc_labor_krw,
    coalesce(sum(a.alloc_material_krw), 0) as alloc_material_krw,
    coalesce(sum(a.alloc_gold_g), 0) as alloc_gold_g,
    coalesce(sum(a.alloc_silver_g), 0) as alloc_silver_g
  from public.cms_ar_payment_alloc a
  join public.cms_ar_payment p on p.payment_id = a.payment_id
  where p.paid_at < p_asof
  group by a.ar_id
),
returns_asof as (
  select
    r.shipment_line_id,
    coalesce(sum(r.final_return_amount_krw), 0) as return_amount_krw
  from public.cms_return_line r
  where r.occurred_at < p_asof
  group by r.shipment_line_id
),
invoice_position_asof as (
  select
    i.party_id,
    greatest(
      coalesce(i.labor_cash_due_krw, 0)
      - coalesce(a.alloc_labor_krw, 0)
      - case
          when coalesce(i.total_cash_due_krw, 0) > 0
            then coalesce(r.return_amount_krw, 0) * (coalesce(i.labor_cash_due_krw, 0) / i.total_cash_due_krw)
          else 0
        end,
      0
    ) as labor_cash_outstanding_krw,
    case
      when i.commodity_type = 'gold'::public.cms_e_commodity_type then
        greatest(
          coalesce(i.commodity_due_g, 0)
          - coalesce(a.alloc_gold_g, 0)
          - case
              when coalesce(i.commodity_price_snapshot_krw_per_g, 0) > 0 then
                case
                  when coalesce(i.total_cash_due_krw, 0) > 0
                    then coalesce(r.return_amount_krw, 0) * (coalesce(i.material_cash_due_krw, 0) / i.total_cash_due_krw)
                  else 0
                end / i.commodity_price_snapshot_krw_per_g
              else 0
            end,
          0
        )
      else 0
    end as gold_outstanding_g,
    case
      when i.commodity_type = 'silver'::public.cms_e_commodity_type then
        greatest(
          coalesce(i.commodity_due_g, 0)
          - coalesce(a.alloc_silver_g, 0)
          - case
              when coalesce(i.commodity_price_snapshot_krw_per_g, 0) > 0 then
                case
                  when coalesce(i.total_cash_due_krw, 0) > 0
                    then coalesce(r.return_amount_krw, 0) * (coalesce(i.material_cash_due_krw, 0) / i.total_cash_due_krw)
                  else 0
                end / i.commodity_price_snapshot_krw_per_g
              else 0
            end,
          0
        )
      else 0
    end as silver_outstanding_g
  from public.cms_ar_invoice i
  left join alloc_asof a on a.ar_id = i.ar_id
  left join returns_asof r on r.shipment_line_id = i.shipment_line_id
  where i.occurred_at < p_asof
    and (p_party_ids is null or i.party_id = any(p_party_ids))
),
invoice_agg_asof as (
  select
    party_id,
    coalesce(sum(labor_cash_outstanding_krw), 0) as labor_cash_outstanding_krw,
    coalesce(sum(gold_outstanding_g), 0) as gold_outstanding_g,
    coalesce(sum(silver_outstanding_g), 0) as silver_outstanding_g
  from invoice_position_asof
  group by party_id
)
select
  p.party_id,
  coalesce(l.receivable_krw, 0) as receivable_krw,
  coalesce(i.labor_cash_outstanding_krw, 0) as labor_cash_outstanding_krw,
  coalesce(i.gold_outstanding_g, 0) as gold_outstanding_g,
  coalesce(i.silver_outstanding_g, 0) as silver_outstanding_g
from party_set p
left join ledger_asof l on l.party_id = p.party_id
left join invoice_agg_asof i on i.party_id = p.party_id
order by p.party_id;
$$;
alter function public.cms_fn_ar_position_asof_v1(uuid[], timestamptz)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_ar_position_asof_v1(uuid[], timestamptz)
  to authenticated;
