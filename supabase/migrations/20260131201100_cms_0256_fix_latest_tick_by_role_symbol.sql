-- cms_0256: fix cms_fn_latest_tick_by_role_v1() selecting non-existent t.symbol
-- NOTE: DO NOT change return type. Keep:
-- returns table(tick_id uuid, price numeric, observed_at timestamptz, symbol cms_e_market_symbol)

create or replace function public.cms_fn_latest_tick_by_role_v1(
  p_role_code text
) returns table(
  tick_id uuid,
  price numeric,
  observed_at timestamptz,
  symbol public.cms_e_market_symbol
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_symbol public.cms_e_market_symbol;
begin
  v_symbol := public.cms_fn_get_market_symbol_by_role_v1(p_role_code);

  return query
  select
    t.tick_id,
    t.price,
    t.observed_at,
    v_symbol as symbol
  from public.cms_fn_latest_tick(v_symbol) t;
end;
$$;

comment on function public.cms_fn_latest_tick_by_role_v1(text)
is 'Latest tick by role_code (GOLD/SILVER).';

grant execute on function public.cms_fn_latest_tick_by_role_v1(text) to anon, authenticated;
