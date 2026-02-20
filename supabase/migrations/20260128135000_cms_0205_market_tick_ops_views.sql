-- 20260128135000_cms_0205_market_tick_ops_views.sql
-- Ops-safe latest views: exclude TEST/DEMO and prefer MANUAL on tie.

set search_path = public;
-- 1) Ops-safe latest per symbol
drop view if exists public.cms_v_market_tick_latest_by_symbol_ops_v1 cascade;
create view public.cms_v_market_tick_latest_by_symbol_ops_v1 as
with base as (
  select
    t.symbol,
    t.tick_id,
    t.price as price_krw_per_g,
    t.observed_at,
    coalesce(t.source, 'MANUAL') as source,
    t.meta,
    t.created_at,
    t.updated_at,
    case coalesce(t.source, 'MANUAL')
      when 'MANUAL' then 0
      when 'N8N' then 1
      else 9
    end as source_priority
  from public.cms_market_tick t
  where t.is_void = false
    and coalesce(t.source, 'MANUAL') not in ('TEST','DEMO')
),
ranked as (
  select
    *,
    row_number() over (
      partition by symbol
      order by observed_at desc, source_priority asc, created_at desc
    ) as rn
  from base
)
select
  symbol,
  tick_id,
  price_krw_per_g,
  observed_at,
  source,
  meta,
  created_at,
  updated_at
from ranked
where rn = 1;
comment on view public.cms_v_market_tick_latest_by_symbol_ops_v1
is 'Ops-safe latest tick per symbol (excludes TEST/DEMO; tie-break prefers MANUAL then N8N).';
-- 2) Ops-safe GOLD/SILVER single row using role mapping
drop view if exists public.cms_v_market_tick_latest_gold_silver_ops_v1;
create view public.cms_v_market_tick_latest_gold_silver_ops_v1 as
with latest as (
  select * from public.cms_v_market_tick_latest_by_symbol_ops_v1
),
rg as (
  select max(symbol) as symbol
  from public.cms_market_symbol_role
  where role_code = 'GOLD' and is_active = true
),
rs as (
  select max(symbol) as symbol
  from public.cms_market_symbol_role
  where role_code = 'SILVER' and is_active = true
)
select
  g.tick_id as gold_tick_id,
  g.price_krw_per_g as gold_price_krw_per_g,
  g.observed_at as gold_observed_at,
  g.source as gold_source,

  s.tick_id as silver_tick_id,
  s.price_krw_per_g as silver_price_krw_per_g,
  s.observed_at as silver_observed_at,
  s.source as silver_source,

  now() as as_of
from rg
left join latest g on g.symbol = rg.symbol
cross join rs
left join latest s on s.symbol = rs.symbol;
comment on view public.cms_v_market_tick_latest_gold_silver_ops_v1
is 'Ops-safe latest GOLD/SILVER (excludes TEST/DEMO).';
