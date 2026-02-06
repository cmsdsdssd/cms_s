-- 20260209151000_cms_0370_ap_pay_and_fifo_v2_lock.sql
set search_path = public, pg_temp;

begin;

-- ============================================================
-- v2: vendor 단위 advisory lock으로 FIFO 레이스 방지
-- - v1은 그대로 둔다(호환/무충돌).
-- - 프론트는 v2를 사용하도록 전환.
-- ============================================================
create or replace function public.cms_fn_ap2_pay_and_fifo_v2(
  p_vendor_party_id uuid,
  p_paid_at timestamptz,
  p_legs jsonb,
  p_note text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment_id uuid;
  v_existing boolean := false;

  r_leg record;

  v_allocations jsonb := '[]'::jsonb;
  v_unallocated jsonb := '[]'::jsonb;

  v_remaining numeric(18,6);
  v_asset public.cms_asset_code;

  r_inv record;
  v_outstanding numeric(18,6);
  v_alloc_qty numeric(18,6);
  v_alloc_id uuid;

  v_eps numeric(18,6) := 0.000001;

  -- advisory lock keys (vendor 기준)
  v_lock1 int;
  v_lock2 int;
begin
  if p_vendor_party_id is null then
    raise exception using errcode='P0001', message='vendor_party_id required';
  end if;

  if p_paid_at is null then
    raise exception using errcode='P0001', message='paid_at required';
  end if;

  if jsonb_typeof(coalesce(p_legs,'[]'::jsonb)) <> 'array' then
    raise exception using errcode='P0001', message='legs must be json array';
  end if;

  -- vendor 단위 동시성 방지 lock (v2끼리만이 아니라, reverse 등도 여기 패턴을 따라갈 것)
  v_lock1 := ('x'||substr(md5(p_vendor_party_id::text),1,8))::bit(32)::int;
  v_lock2 := ('x'||substr(md5(p_vendor_party_id::text),9,8))::bit(32)::int;
  perform pg_advisory_xact_lock(v_lock1, v_lock2);

  -- 1) idempotency 처리: 기존 결제면 재상계하지 않고 그대로 반환
  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    select payment_id into v_payment_id
    from public.cms_ap_payment
    where vendor_party_id = p_vendor_party_id
      and idempotency_key = p_idempotency_key
    limit 1;

    if v_payment_id is not null then
      v_existing := true;

      select jsonb_agg(jsonb_build_object('asset_code', asset_code, 'unallocated_qty', unallocated_qty) order by asset_code)
        into v_unallocated
      from public.cms_v_ap_payment_unallocated_v1
      where payment_id = v_payment_id
        and abs(unallocated_qty) > v_eps;

      select jsonb_agg(jsonb_build_object('alloc_id', alloc_id, 'ap_id', ap_id, 'receipt_id', receipt_id, 'asset_code', asset_code, 'qty', alloc_qty) order by alloc_id)
        into v_allocations
      from public.cms_v_ap_payment_alloc_detail_v1
      where payment_id = v_payment_id;

      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'payment_id', v_payment_id,
        'allocations', coalesce(v_allocations,'[]'::jsonb),
        'unallocated', coalesce(v_unallocated,'[]'::jsonb)
      );
    end if;
  end if;

  -- 2) 결제 생성
  insert into public.cms_ap_payment(
    vendor_party_id, paid_at, note, idempotency_key, created_by
  )
  values (
    p_vendor_party_id, p_paid_at, p_note, p_idempotency_key, auth.uid()
  )
  returning payment_id into v_payment_id;

  -- legs insert (v1과 동일: 0/음수 무시. reverse는 별도 RPC 사용)
  for r_leg in
    select
      (e->>'asset_code')::public.cms_asset_code as asset_code,
      coalesce(nullif(e->>'qty','')::numeric, 0) as qty
    from jsonb_array_elements(p_legs) as t(e)
  loop
    if r_leg.qty <= 0 then
      continue;
    end if;

    insert into public.cms_ap_payment_leg(payment_id, asset_code, qty)
    values (v_payment_id, r_leg.asset_code, r_leg.qty)
    on conflict (payment_id, asset_code)
    do update set qty = excluded.qty;
  end loop;

  -- 3) FIFO 상계: invoice_position view 사용 (sum 기반) / oldest first
  for r_leg in
    select
      (e->>'asset_code')::public.cms_asset_code as asset_code,
      coalesce(nullif(e->>'qty','')::numeric, 0) as qty
    from jsonb_array_elements(p_legs) as t(e)
  loop
    v_asset := r_leg.asset_code;
    v_remaining := r_leg.qty;

    if v_remaining <= v_eps then
      continue;
    end if;

    for r_inv in
      select
        ap_id,
        occurred_at,
        outstanding_qty
      from public.cms_v_ap_invoice_position_v1
      where vendor_party_id = p_vendor_party_id
        and asset_code = v_asset
        and outstanding_qty > v_eps
      order by occurred_at asc, ap_id asc
    loop
      exit when v_remaining <= v_eps;

      v_outstanding := r_inv.outstanding_qty;
      if v_outstanding <= v_eps then
        continue;
      end if;

      v_alloc_qty := least(v_remaining, v_outstanding);
      if v_alloc_qty <= v_eps then
        continue;
      end if;

      insert into public.cms_ap_alloc(payment_id, ap_id, created_by)
      values (v_payment_id, r_inv.ap_id, auth.uid())
      returning alloc_id into v_alloc_id;

      insert into public.cms_ap_alloc_leg(alloc_id, asset_code, qty)
      values (v_alloc_id, v_asset, v_alloc_qty);

      v_remaining := v_remaining - v_alloc_qty;

      v_allocations := v_allocations || jsonb_build_array(
        jsonb_build_object('alloc_id', v_alloc_id, 'ap_id', r_inv.ap_id, 'asset_code', v_asset, 'qty', v_alloc_qty)
      );
    end loop;

    if v_remaining > v_eps then
      v_unallocated := v_unallocated || jsonb_build_array(
        jsonb_build_object('asset_code', v_asset, 'qty', v_remaining)
      );
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'payment_id', v_payment_id,
    'allocations', coalesce(v_allocations,'[]'::jsonb),
    'unallocated', coalesce(v_unallocated,'[]'::jsonb)
  );
end $$;

alter function public.cms_fn_ap2_pay_and_fifo_v2(uuid,timestamptz,jsonb,text,text)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_ap2_pay_and_fifo_v2(uuid,timestamptz,jsonb,text,text)
  to authenticated, service_role;

commit;
