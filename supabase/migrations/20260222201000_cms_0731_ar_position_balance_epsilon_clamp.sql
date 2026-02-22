-- cms_0731: clamp tiny AR balance residuals in position view
-- Prevents UI showing red 0 due to floating dust (e.g. 0.00000026 KRW)

begin;

create or replace view public.cms_v_ar_position_by_party_v2
with (security_invoker = true)
as
with base as (
  select
    b.party_id,
    b.party_type,
    b.name,
    case
      when abs(coalesce(b.balance_krw, 0)) <= 0.5 then 0::numeric
      else coalesce(b.balance_krw, 0)
    end as balance_krw,
    b.last_activity_at
  from public.cms_v_ar_balance_by_party b
)
select
  base.party_id,
  base.party_type,
  base.name,
  base.balance_krw,
  greatest(base.balance_krw, 0) as receivable_krw,
  greatest(-base.balance_krw, 0) as credit_krw,
  base.last_activity_at,
  coalesce(sum(p.labor_cash_outstanding_krw), 0) as labor_cash_outstanding_krw,
  coalesce(sum(p.material_cash_outstanding_krw), 0) as material_cash_outstanding_krw,
  coalesce(sum(p.total_cash_outstanding_krw), 0) as total_cash_outstanding_krw,
  coalesce(sum(case when p.commodity_type = 'gold' then p.commodity_outstanding_g else 0 end), 0) as gold_outstanding_g,
  coalesce(sum(case when p.commodity_type = 'silver' then p.commodity_outstanding_g else 0 end), 0) as silver_outstanding_g
from base
left join public.cms_v_ar_invoice_position_v1 p on p.party_id = base.party_id
group by base.party_id, base.party_type, base.name, base.balance_krw, base.last_activity_at;

grant select on public.cms_v_ar_position_by_party_v2 to authenticated;

commit;
