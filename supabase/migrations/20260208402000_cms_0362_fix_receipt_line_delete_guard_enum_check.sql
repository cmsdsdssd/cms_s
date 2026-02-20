set search_path = public, pg_temp;
create or replace function public.cms_fn_receipt_line_delete_v1(
  p_receipt_id uuid,
  p_line_uuid uuid,
  p_reason text default null::text,
  p_actor_person_id uuid default null::uuid,
  p_note text default null::text,
  p_correlation_id uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if p_receipt_id is null then
    raise exception using errcode='P0001', message='receipt_id required';
  end if;
  if p_line_uuid is null then
    raise exception using errcode='P0001', message='line_uuid required';
  end if;

  -- Guard 1) 매칭 확정된 라인은 삭제 불가 (먼저 match_clear)
  if exists (
    select 1
    from public.cms_receipt_line_match m
    where m.receipt_id = p_receipt_id
      and m.receipt_line_uuid = p_line_uuid
      and m.status = 'CONFIRMED'::public.cms_e_receipt_line_match_status
    limit 1
  ) then
    raise exception using errcode='P0001',
      message='cannot delete: receipt line is MATCH_CONFIRMED (clear match first)';
  end if;

  -- Guard 2) 출고확정된 shipment에 연결된 라인은 삭제 불가
  if exists (
    select 1
    from public.cms_shipment_line sl
    join public.cms_shipment_header sh on sh.shipment_id = sl.shipment_id
    where sl.purchase_receipt_id = p_receipt_id
      and sl.purchase_receipt_line_uuid = p_line_uuid
      and sh.status = 'CONFIRMED'::public.cms_e_shipment_status
    limit 1
  ) then
    raise exception using errcode='P0001',
      message='cannot delete: linked shipment already CONFIRMED';
  end if;

  -- Guard 3) vendor_bill_allocation 이미 있으면(원가 배분) 삭제 금지
  if to_regclass('public.cms_vendor_bill_allocation') is not null then
    if exists (
      select 1
      from public.cms_vendor_bill_allocation a
      where a.bill_id = p_receipt_id
      limit 1
    ) then
      raise exception using errcode='P0001',
        message='cannot delete: vendor_bill_allocation exists';
    end if;
  end if;

  -- Guard 4) AP2 alloc 이미 있으면 삭제 금지
  if to_regclass('public.cms_ap_invoice') is not null and to_regclass('public.cms_ap_alloc') is not null then
    if exists (
      select 1
      from public.cms_ap_invoice i
      join public.cms_ap_alloc a on a.ap_id = i.ap_id
      where i.receipt_id = p_receipt_id
      limit 1
    ) then
      raise exception using errcode='P0001',
        message='cannot delete: AP alloc exists';
    end if;
  end if;

  -- Guard 5) legacy ap_ledger가 BILL 외로 진행된 경우 삭제 금지
  -- enum 타입 체크는 to_regtype로 해야 안전함
  if to_regclass('public.cms_ap_ledger') is not null
     and to_regtype('public.cms_e_ap_entry_type') is not null then
    if exists (
      select 1
      from public.cms_ap_ledger l
      where l.receipt_id = p_receipt_id
        and l.entry_type <> 'BILL'::public.cms_e_ap_entry_type
      limit 1
    ) then
      raise exception using errcode='P0001',
        message='cannot delete: legacy AP ledger already progressed';
    end if;
  end if;

  return public.cms_fn_receipt_line_delete_core_v1(
    p_receipt_id,
    p_line_uuid,
    p_reason,
    p_actor_person_id,
    p_note,
    p_correlation_id
  );
end $function$;
grant execute on function public.cms_fn_receipt_line_delete_v1(uuid,uuid,text,uuid,text,uuid)
to authenticated, service_role;
