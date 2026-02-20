create or replace function public.cms_fn_receipt_line_delete_v1(
  p_receipt_id uuid,
  p_line_uuid uuid,
  p_reason text default null,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_actor uuid := coalesce(p_actor_person_id, auth.uid());
  v_is_confirmed boolean;
  v_is_used_in_shipment boolean;
begin
  -- (0) 다운스트림 가드: CONFIRMED 매칭/출고연결 있으면 삭제 금지
  select exists (
    select 1
    from public.cms_receipt_line_match m
    where m.receipt_id = p_receipt_id
      and m.receipt_line_uuid = p_line_uuid
      and m.status = 'CONFIRMED'::public.cms_e_receipt_line_match_status
  ) into v_is_confirmed;

  if v_is_confirmed then
    raise exception using errcode='P0001', message='cannot delete: line is CONFIRMED matched (unmatch first)';
  end if;

  select exists (
    select 1
    from public.cms_shipment_line sl
    where sl.purchase_receipt_id = p_receipt_id
      and sl.purchase_receipt_line_uuid = p_line_uuid
  ) into v_is_used_in_shipment;

  if v_is_used_in_shipment then
    raise exception using errcode='P0001', message='cannot delete: line is linked to shipment (revert link first)';
  end if;

  -- (1) CONFIRMED가 아닌 match 잔여물은 정리(선택사항이지만 강추)
  delete from public.cms_receipt_line_match
   where receipt_id = p_receipt_id
     and receipt_line_uuid = p_line_uuid
     and status <> 'CONFIRMED'::public.cms_e_receipt_line_match_status;

  -- (2) 이후 기존 구현(스냅샷에서 라인 제거→totals 재계산→로그→snapshot upsert→ensure ap)
  -- ※ 여기 아래는 이미 네가 넣어둔 본문을 그대로 유지하면 됨
  return public.cms_fn_receipt_line_delete_v1(p_receipt_id, p_line_uuid, p_reason, v_actor, p_note, p_correlation_id);
end $$;
alter function public.cms_fn_receipt_line_delete_v1(uuid,uuid,text,uuid,text,uuid)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_receipt_line_delete_v1(uuid,uuid,text,uuid,text,uuid)
  to authenticated, service_role;
