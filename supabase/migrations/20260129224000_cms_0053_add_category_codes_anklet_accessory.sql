-- 20260129224000_cms_0053_add_category_codes_anklet_accessory.sql
set search_path = public, pg_temp;

do $$
begin
  -- enum 존재 확인
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'cms_e_category_code'
  ) then
    raise exception 'public.cms_e_category_code not found';
  end if;

  -- 이미 있으면 스킵 (중복 실행 안전)
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname='public'
      and t.typname='cms_e_category_code'
      and e.enumlabel='ANKLET'
  ) then
    alter type public.cms_e_category_code add value 'ANKLET';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname='public'
      and t.typname='cms_e_category_code'
      and e.enumlabel='ACCESSORY'
  ) then
    alter type public.cms_e_category_code add value 'ACCESSORY';
  end if;

exception
  when duplicate_object then
    -- race/중복 실행 방어
    null;
end $$;
