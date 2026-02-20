-- 20260128133500_cms_0202_market_tick_views_v2.sql
-- MARKET TICK read views (v2) - no hardcoded enum labels.

set search_path = public;
-- Latest per symbol
drop view if exists public.cms_v_market_tick_latest_by_symbol_v1 cascade;
create view public.cms_v_market_tick_latest_by_symbol_v1 as
with ranked as (
  select
    t.symbol,
    t.tick_id,
    t.price as price_krw_per_g,
    t.observed_at,
    coalesce(t.source, 'MANUAL') as source,
    t.meta,
    t.created_at,
    t.updated_at,
    row_number() over (
      partition by t.symbol
      order by t.observed_at desc, t.created_at desc
    ) as rn
  from public.cms_market_tick t
  where t.is_void = false
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
comment on view public.cms_v_market_tick_latest_by_symbol_v1
is 'Latest active tick per symbol (KRW per g).';
-- GOLD/SILVER one-row view via role mapping table
drop view if exists public.cms_v_market_tick_latest_gold_silver_v1;
create view public.cms_v_market_tick_latest_gold_silver_v1 as
with latest as (
  select * from public.cms_v_market_tick_latest_by_symbol_v1
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
comment on view public.cms_v_market_tick_latest_gold_silver_v1
is 'Single-row latest GOLD/SILVER using cms_market_symbol_role mapping (KRW per g).';
-- Series
drop view if exists public.cms_v_market_tick_series_v1;
create view public.cms_v_market_tick_series_v1 as
select
  t.tick_id,
  t.symbol,
  t.price as price_krw_per_g,
  t.observed_at,
  coalesce(t.source, 'MANUAL') as source,
  t.meta,
  t.correlation_id,
  t.created_at,
  t.updated_at
from public.cms_market_tick t
where t.is_void = false;
comment on view public.cms_v_market_tick_series_v1
is 'Active tick time-series (KRW per g).';
-- Daily OHLC
drop view if exists public.cms_v_market_tick_daily_ohlc_v1;
create view public.cms_v_market_tick_daily_ohlc_v1 as
with base as (
  select
    date_trunc('day', t.observed_at)::date as day,
    t.symbol,
    t.observed_at,
    t.created_at,
    t.price as price_krw_per_g,
    row_number() over (
      partition by date_trunc('day', t.observed_at), t.symbol
      order by t.observed_at asc, t.created_at asc
    ) as rn_asc,
    row_number() over (
      partition by date_trunc('day', t.observed_at), t.symbol
      order by t.observed_at desc, t.created_at desc
    ) as rn_desc
  from public.cms_market_tick t
  where t.is_void = false
)
select
  day,
  symbol,
  max(price_krw_per_g) filter (where rn_asc = 1) as open_krw_per_g,
  max(price_krw_per_g) filter (where rn_desc = 1) as close_krw_per_g,
  max(price_krw_per_g) as high_krw_per_g,
  min(price_krw_per_g) as low_krw_per_g,
  avg(price_krw_per_g) as avg_krw_per_g,
  count(*) as tick_count
from base
group by day, symbol;
comment on view public.cms_v_market_tick_daily_ohlc_v1
is 'Daily OHLC+avg for ticks (KRW per g).';
-- Health (no hardcoded labels)
drop view if exists public.cms_v_market_tick_health_v1;
create view public.cms_v_market_tick_health_v1 as
with symbols as (
  select unnest(enum_range(null::public.cms_e_market_symbol)) as symbol
),
latest as (
  select * from public.cms_v_market_tick_latest_by_symbol_v1
)
select
  s.symbol,
  l.tick_id,
  l.observed_at as last_observed_at,
  case
    when l.observed_at is null then null
    else round(extract(epoch from (now() - l.observed_at)) / 60.0, 2)
  end as age_minutes,
  case
    when l.observed_at is null then true
    when now() - l.observed_at > interval '6 hours' then true
    else false
  end as is_stale
from symbols s
left join latest l on l.symbol = s.symbol;
comment on view public.cms_v_market_tick_health_v1
is 'Tick freshness view. is_stale=true if missing or older than 6 hours.';
