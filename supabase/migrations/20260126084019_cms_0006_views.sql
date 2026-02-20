-- 0006: views (security_invoker)

create or replace view cms_v_ar_balance_by_party
with (security_invoker = true)
as
select
  p.party_id,
  p.party_type,
  p.name,
  coalesce(sum(l.amount_krw), 0) as balance_krw,
  max(l.occurred_at) as last_activity_at
from cms_party p
left join cms_ar_ledger l on l.party_id = p.party_id
group by p.party_id, p.party_type, p.name;
create or replace view cms_v_order_worklist
with (security_invoker = true)
as
select
  o.*,
  p.name as customer_name,
  m.master_id as matched_master_id2,
  m.category_code as master_category_code
from cms_order_line o
join cms_party p on p.party_id = o.customer_party_id
left join cms_master_item m on m.model_name = o.model_name;
