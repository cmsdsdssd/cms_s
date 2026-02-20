create or replace function public.cms_fn_ensure_ap_from_receipt_v1(
  p_receipt_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_vendor_party_id uuid;
  v_bill_no text;
  v_memo text;
  v_total_krw numeric;
  v_snap_total numeric;
  v_inbox_total numeric;
  v_rows int := 0;
begin
  if p_receipt_id is null then
    raise exception using errcode='P0001', message='receipt_id required';
  end if;

  select
    r.vendor_party_id,
    r.bill_no,
    r.memo,
    r.total_amount_krw,
    s.total_amount_krw
  into
    v_vendor_party_id,
    v_bill_no,
    v_memo,
    v_inbox_total,
    v_snap_total
  from public.cms_receipt_inbox r
  left join public.cms_receipt_pricing_snapshot s on s.receipt_id = r.receipt_id
  where r.receipt_id = p_receipt_id;

  if not found then
    raise exception using errcode='P0001', message='receipt not found';
  end if;

  v_total_krw := coalesce(v_snap_total, v_inbox_total);
  v_memo := coalesce(p_note, v_memo);

  if v_vendor_party_id is null or v_total_krw is null then
    return jsonb_build_object(
      'ok', true,
      'receipt_id', p_receipt_id,
      'skipped', true,
      'reason', 'missing_vendor_or_total'
    );
  end if;

  insert into public.cms_ap_ledger(
    vendor_party_id, occurred_at, entry_type, amount_krw, receipt_id, bill_no, memo
  ) values (
    v_vendor_party_id,
    now(),
    'BILL'::public.cms_e_ap_entry_type,
    v_total_krw,
    p_receipt_id,
    v_bill_no,
    v_memo
  )
  on conflict (receipt_id) where receipt_id is not null and entry_type = 'BILL'::public.cms_e_ap_entry_type
  do update
  set
    vendor_party_id = excluded.vendor_party_id,
    amount_krw = excluded.amount_krw,
    bill_no = excluded.bill_no,
    memo = excluded.memo;

  get diagnostics v_rows = row_count;

  return jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'total_amount_krw', v_total_krw,
    'upserted', v_rows > 0
  );
end $$;
alter function public.cms_fn_ensure_ap_from_receipt_v1(uuid,text)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_ensure_ap_from_receipt_v1(uuid,text)
  to authenticated, service_role;
