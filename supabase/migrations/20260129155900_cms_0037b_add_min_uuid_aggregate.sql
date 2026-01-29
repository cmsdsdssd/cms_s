set search_path = public, pg_temp;

-- Provide min(uuid) aggregate for environments where it's missing.
-- This unblocks 0038 which uses: min(m.master_id) where master_id is uuid.

create or replace function public.cms_uuid_min(a uuid, b uuid)
returns uuid
language sql
immutable
as $$
  select case
    when a is null then b
    when b is null then a
    when a < b then a
    else b
  end;
$$;

do $$
begin
  -- If public.min(uuid) aggregate doesn't exist, create it.
  if not exists (
    select 1
    from pg_aggregate ag
    join pg_proc p on p.oid = ag.aggfnoid
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'min'
      and pg_get_function_identity_arguments(p.oid) = 'uuid'
  ) then
    execute 'create aggregate public.min(uuid) (sfunc = public.cms_uuid_min, stype = uuid)';
  end if;
end $$;
