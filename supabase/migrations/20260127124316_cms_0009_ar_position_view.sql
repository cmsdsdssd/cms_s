set search_path = public, pg_temp;

-- cms_0009: AR position view (receivable vs credit)
-- ADD-ONLY: new view only

create or replace view public.cms_v_ar_position_by_party as
select
  party_id,
  party_type,
  name,
  balance_krw,
  greatest(balance_krw, 0)   as receivable_krw,  -- 諛쏆쓣 ??誘몄닔)
  greatest(-balance_krw, 0)  as credit_krw,      -- ?좎닔湲??곴퀎/?섍툒?湲??곕━媛 以???
  last_activity_at
from public.cms_v_ar_balance_by_party;
