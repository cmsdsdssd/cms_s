-- 20260128302400_cms_0219_stocktake_entity_type.sql
set search_path = public, pg_temp;

do $$
begin
  -- 타입 존재 확인
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'cms_e_entity_type'
  ) then
    raise exception 'public.cms_e_entity_type not found';
  end if;

  -- STOCKTAKE_SESSION 추가
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname='public'
      and t.typname='cms_e_entity_type'
      and e.enumlabel='STOCKTAKE_SESSION'
  ) then
    execute 'alter type public.cms_e_entity_type add value ''STOCKTAKE_SESSION''';
  end if;

  -- (미래 대비) STOCKTAKE_LINE도 같이 추가
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname='public'
      and t.typname='cms_e_entity_type'
      and e.enumlabel='STOCKTAKE_LINE'
  ) then
    execute 'alter type public.cms_e_entity_type add value ''STOCKTAKE_LINE''';
  end if;
end $$;
