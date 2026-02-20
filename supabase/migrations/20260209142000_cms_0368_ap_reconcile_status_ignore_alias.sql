-- 20260209142000_cms_0368_ap_reconcile_status_ignore_alias.sql
set search_path = public, pg_temp;
begin;
create or replace function public.cms_fn_ap_set_reconcile_issue_status_v2(
  p_issue_id uuid,
  p_status_text text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_norm text;
  v_status public.cms_reconcile_issue_status;
begin
  if p_issue_id is null then
    raise exception using errcode='P0001', message='issue_id required';
  end if;

  if p_status_text is null or btrim(p_status_text) = '' then
    raise exception using errcode='P0001', message='status required';
  end if;

  v_norm := upper(btrim(p_status_text));

  -- 프론트 호환/별칭 처리
  if v_norm = 'IGNORE' then
    v_status := 'IGNORED'::public.cms_reconcile_issue_status;
  elsif v_norm = 'ACK' then
    v_status := 'ACKED'::public.cms_reconcile_issue_status;
  else
    -- OPEN / ACKED / RESOLVED / IGNORED 등은 그대로 캐스팅
    v_status := v_norm::public.cms_reconcile_issue_status;
  end if;

  return public.cms_fn_ap_set_reconcile_issue_status_v1(p_issue_id, v_status, p_note);
end $$;
alter function public.cms_fn_ap_set_reconcile_issue_status_v2(uuid,text,text)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_ap_set_reconcile_issue_status_v2(uuid,text,text)
  to authenticated, service_role;
commit;
