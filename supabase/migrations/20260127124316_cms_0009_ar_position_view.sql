set search_path = public, pg_temp;

-- cms_0009: AR position view (receivable vs credit)
-- ADD-ONLY: new view only
drop view if exists public.cms_v_ar_position_by_party;
create view public.cms_v_ar_position_by_party as
select
  party_id,
  party_type,
  name,
  balance_krw,
  greatest(balance_krw, 0)   as receivable_krw,  -- 獄쏆룇????沃섎챷??
  greatest(-balance_krw, 0)  as credit_krw,      -- ?醫롫땾疫??怨댄???랁닋?疫??怨뺚봺揶?餓???
  last_activity_at
from public.cms_v_ar_balance_by_party;
