-- cms_0404
-- Rollback hotfix cast from cms_0403.
-- Reason: custom text->enum cast function recurses and causes max_stack_depth errors.

do $$
begin
  if to_regtype('public.cms_reconcile_issue_severity') is not null then
    drop cast if exists (text as public.cms_reconcile_issue_severity);
  end if;
exception
  when others then
    raise notice 'drop cast skipped: %', sqlerrm;
end $$;
drop function if exists public.cms_cast_text_to_reconcile_issue_severity(text);
