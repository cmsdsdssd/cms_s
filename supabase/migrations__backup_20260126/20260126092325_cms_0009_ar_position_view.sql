-- cms_0009: AR position view (receivable vs credit)
-- ADD-ONLY: new view only

create or replace view public.cms_v_ar_position_by_party as
select
  party_id,
  party_type,
  name,
  balance_krw,
  greatest(balance_krw, 0)   as receivable_krw,  -- 받을 돈(미수)
  greatest(-balance_krw, 0)  as credit_krw,      -- 선수금/상계/환급대기(우리가 줄 돈)
  last_activity_at
from public.cms_v_ar_balance_by_party;
