-- cms_0405
-- Fix for reconcile v2 insert failure:
-- column "severity" is of type cms_reconcile_issue_severity but expression is of type text
--
-- NOTE:
-- - Previous function-based cast (cms_0403) caused recursion and was rolled back by cms_0404.
-- - This migration adds a safe assignment cast using INOUT (no custom function).

do $$
begin
  if to_regtype('public.cms_reconcile_issue_severity') is null then
    raise notice 'cms_reconcile_issue_severity type not found; skip cast creation';
    return;
  end if;

  if not exists (
    select 1
    from pg_cast c
    join pg_type src on src.oid = c.castsource
    join pg_type dst on dst.oid = c.casttarget
    join pg_namespace ns on ns.oid = dst.typnamespace
    where src.typname = 'text'
      and ns.nspname = 'public'
      and dst.typname = 'cms_reconcile_issue_severity'
  ) then
    create cast (text as public.cms_reconcile_issue_severity)
      with inout
      as assignment;
  end if;
end $$;
