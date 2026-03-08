set search_path = public, pg_temp;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'cms_e_market_symbol'
      and e.enumlabel = 'KRX_GOLD_TICK'
  ) then
    alter type public.cms_e_market_symbol add value 'KRX_GOLD_TICK' after 'GOLD_KRW_PER_G';
  end if;
end $$;
