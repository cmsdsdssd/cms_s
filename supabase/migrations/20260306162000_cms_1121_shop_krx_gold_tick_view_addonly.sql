set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1121_shop_krx_gold_tick_view_addonly
-- Shopping pricing tick view:
-- - GOLD prefers symbol KRX_GOLD_TICK when present
-- - otherwise falls back to current GOLD role mapping
-- - SILVER keeps current role mapping
-- -----------------------------------------------------------------------------

drop view if exists public.shop_v_market_tick_latest_gold_silver_ops_v1;

create view public.shop_v_market_tick_latest_gold_silver_ops_v1 as
with latest as (
  select *
  from public.cms_v_market_tick_latest_by_symbol_ops_v1
),
gold_role as (
  select max(symbol) as symbol
  from public.cms_market_symbol_role
  where role_code = 'GOLD'
    and is_active = true
),
silver_role as (
  select max(symbol) as symbol
  from public.cms_market_symbol_role
  where role_code = 'SILVER'
    and is_active = true
),
gold_krx as (
  select
    l.tick_id,
    l.price_krw_per_g,
    l.observed_at,
    l.source
  from latest l
  where l.symbol::text = 'KRX_GOLD_TICK'
  order by l.observed_at desc, l.created_at desc
  limit 1
)
select
  coalesce(gk.tick_id, gr.tick_id) as gold_tick_id,
  coalesce(gk.price_krw_per_g, gr.price_krw_per_g) as gold_price_krw_per_g,
  coalesce(gk.observed_at, gr.observed_at) as gold_observed_at,
  coalesce(gk.source, gr.source) as gold_source,

  s.tick_id as silver_tick_id,
  s.price_krw_per_g as silver_price_krw_per_g,
  s.observed_at as silver_observed_at,
  s.source as silver_source,

  now() as as_of
from (select 1 as anchor_key) anchor
left join gold_role rg on true
left join latest gr on gr.symbol = rg.symbol
left join gold_krx gk on true
left join silver_role rs on true
left join latest s on s.symbol = rs.symbol;

comment on view public.shop_v_market_tick_latest_gold_silver_ops_v1 is
  'Shopping pricing ticks: GOLD prefers KRX_GOLD_TICK when available; SILVER uses role mapping.';

grant select on public.shop_v_market_tick_latest_gold_silver_ops_v1 to anon, authenticated;
