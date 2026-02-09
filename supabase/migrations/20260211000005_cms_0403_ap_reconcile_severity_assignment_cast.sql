-- cms_0403
-- Add-only hotfix for AP reconcile v2 severity enum mismatch.
-- Symptom: column "severity" is of type cms_reconcile_issue_severity but expression is of type text.

create or replace function public.cms_cast_text_to_reconcile_issue_severity(value text)
returns public.cms_reconcile_issue_severity
language sql
immutable
strict
as $$
  select value::public.cms_reconcile_issue_severity
$$;

do $$
begin
  if to_regtype('public.cms_reconcile_issue_severity') is null then
    raise notice 'cms_reconcile_issue_severity type not found, skip cast creation';
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
      with function public.cms_cast_text_to_reconcile_issue_severity(text)
      as assignment;
  end if;
end $$;
