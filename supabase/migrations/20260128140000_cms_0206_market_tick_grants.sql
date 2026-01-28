-- 20260128140000_cms_0206_market_tick_grants.sql
-- Grant permissions for market tick views, tables, and functions
-- ADD-ONLY. public.cms_* only.

set search_path = public;

-- Grant SELECT on base table
grant select on public.cms_market_tick to anon, authenticated;

-- Grant SELECT on role mapping table
grant select on public.cms_market_symbol_role to anon, authenticated;

-- Grant SELECT on all market tick views
grant select on public.cms_v_market_tick_latest_by_symbol_v1 to anon, authenticated;
grant select on public.cms_v_market_tick_latest_gold_silver_v1 to anon, authenticated;
grant select on public.cms_v_market_tick_latest_by_symbol_ops_v1 to anon, authenticated;
grant select on public.cms_v_market_tick_latest_gold_silver_ops_v1 to anon, authenticated;
grant select on public.cms_v_market_tick_series_v1 to anon, authenticated;
grant select on public.cms_v_market_tick_daily_ohlc_v1 to anon, authenticated;
grant select on public.cms_v_market_tick_health_v1 to anon, authenticated;
grant select on public.cms_v_market_symbol_role_v1 to anon, authenticated;

-- Grant EXECUTE on RPC functions
grant execute on function public.cms_fn_upsert_market_tick_by_role_v1(text, numeric, timestamptz, text, jsonb, uuid, uuid, text) to anon, authenticated;
grant execute on function public.cms_fn_get_market_symbol_by_role_v1(text) to anon, authenticated;
grant execute on function public.cms_fn_latest_tick_by_role_v1(text) to anon, authenticated;
grant execute on function public.cms_fn_set_market_symbol_role_v1(text, public.cms_e_market_symbol, uuid, uuid, text) to anon, authenticated;

-- Grant on underlying market tick functions (if they exist)
do $$
begin
  if to_regprocedure('public.cms_fn_upsert_market_tick_v1(public.cms_e_market_symbol, numeric, timestamptz, text, jsonb, uuid, uuid, text)') is not null then
    grant execute on function public.cms_fn_upsert_market_tick_v1(public.cms_e_market_symbol, numeric, timestamptz, text, jsonb, uuid, uuid, text) to anon, authenticated;
  end if;

  if to_regprocedure('public.cms_fn_void_market_tick_v1(uuid, text, uuid, uuid, text)') is not null then
    grant execute on function public.cms_fn_void_market_tick_v1(uuid, text, uuid, uuid, text) to anon, authenticated;
  end if;

  if to_regprocedure('public.cms_fn_latest_tick(public.cms_e_market_symbol)') is not null then
    grant execute on function public.cms_fn_latest_tick(public.cms_e_market_symbol) to anon, authenticated;
  end if;

  if to_regprocedure('public.cms_fn_seed_market_tick_demo_v1(uuid, uuid, boolean)') is not null then
    grant execute on function public.cms_fn_seed_market_tick_demo_v1(uuid, uuid, boolean) to anon, authenticated;
  end if;
end$$;

comment on table public.cms_market_tick is 'Market tick data with anon/authenticated SELECT access';
comment on table public.cms_market_symbol_role is 'Role mapping with anon/authenticated SELECT access';
