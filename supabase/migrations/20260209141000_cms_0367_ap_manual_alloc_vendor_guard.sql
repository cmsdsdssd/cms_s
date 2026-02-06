-- 20260209141000_cms_0367_ap_manual_alloc_vendor_guard.sql
set search_path = public, pg_temp;

begin;

create or replace function public.cms_fn_ap2_manual_alloc_v1(
  p_payment_id uuid,
  p_ap_id uuid,
  p_asset_code public.cms_asset_code,
  p_qty numeric,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_vendor uuid;
  v_inv_vendor uuid;

  v_unalloc numeric(18,6);
  v_outstanding numeric(18,6);
  v_alloc_qty numeric(18,6);
  v_alloc_id uuid;
begin
  if p_payment_id is null or p_ap_id is null then
    raise exception using errcode='P0001', message='payment_id and ap_id required';
  end if;

  if p_asset_code is null then
    raise exception using errcode='P0001', message='asset_code required';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception using errcode='P0001', message='qty must be > 0';
  end if;

  select vendor_party_id into v_vendor
  from public.cms_ap_payment
  where payment_id = p_payment_id;

  if v_vendor is null then
    raise exception using errcode='P0001', message='payment not found';
  end if;

  select vendor_party_id into v_inv_vendor
  from public.cms_ap_invoice
  where ap_id = p_ap_id;

  if v_inv_vendor is null then
    raise exception using errcode='P0001', message='invoice not found';
  end if;

  if v_inv_vendor <> v_vendor then
    raise exception using errcode='P0001',
      message = format('vendor mismatch: payment.vendor_party_id=%s, invoice.vendor_party_id=%s', v_vendor, v_inv_vendor);
  end if;

  -- 미배정 잔액 체크
  select unallocated_qty into v_unalloc
  from public.cms_v_ap_payment_unallocated_v1
  where payment_id = p_payment_id and asset_code = p_asset_code;

  v_unalloc := coalesce(v_unalloc,0);
  if v_unalloc <= 0 then
    raise exception using errcode='P0001', message='no unallocated balance for this asset';
  end if;

  -- invoice outstanding 체크
  select outstanding_qty into v_outstanding
  from public.cms_v_ap_invoice_position_v1
  where ap_id = p_ap_id and asset_code = p_asset_code;

  v_outstanding := coalesce(v_outstanding,0);
  if v_outstanding <= 0 then
    raise exception using errcode='P0001', message='invoice has no outstanding for this asset';
  end if;

  v_alloc_qty := least(p_qty, v_unalloc, v_outstanding);

  insert into public.cms_ap_alloc(payment_id, ap_id, created_by)
  values (p_payment_id, p_ap_id, auth.uid())
  returning alloc_id into v_alloc_id;

  insert into public.cms_ap_alloc_leg(alloc_id, asset_code, qty)
  values (v_alloc_id, p_asset_code, v_alloc_qty);

  return jsonb_build_object(
    'ok', true,
    'alloc_id', v_alloc_id,
    'payment_id', p_payment_id,
    'ap_id', p_ap_id,
    'asset_code', p_asset_code,
    'qty', v_alloc_qty,
    'note', p_note
  );
end $$;

alter function public.cms_fn_ap2_manual_alloc_v1(uuid,uuid,public.cms_asset_code,numeric,text)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_ap2_manual_alloc_v1(uuid,uuid,public.cms_asset_code,numeric,text)
  to authenticated, service_role;

commit;
