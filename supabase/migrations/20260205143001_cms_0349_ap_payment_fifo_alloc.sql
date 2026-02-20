-- 20260205143001_cms_0349_ap_payment_fifo_alloc.sql
set search_path = public, pg_temp;
begin;
-- ============================================================
-- 1) Views: payment별 미배정(unallocated) 잔액 / alloc 상세
-- ============================================================

-- payment leg - allocated(alloc_leg sum) = unallocated
create or replace view public.cms_v_ap_payment_unallocated_v1
with (security_invoker = true)
as
with alloc_sum as (
  select
    a.payment_id,
    al.asset_code,
    coalesce(sum(al.qty),0) as alloc_qty
  from public.cms_ap_alloc a
  join public.cms_ap_alloc_leg al on al.alloc_id = a.alloc_id
  group by a.payment_id, al.asset_code
)
select
  p.payment_id,
  p.vendor_party_id,
  p.paid_at,
  p.note,
  pl.asset_code,
  pl.qty as paid_qty,
  coalesce(s.alloc_qty,0) as allocated_qty,
  (pl.qty - coalesce(s.alloc_qty,0)) as unallocated_qty
from public.cms_ap_payment p
join public.cms_ap_payment_leg pl on pl.payment_id = p.payment_id
left join alloc_sum s
  on s.payment_id = p.payment_id and s.asset_code = pl.asset_code;
grant select on public.cms_v_ap_payment_unallocated_v1 to authenticated;
grant select on public.cms_v_ap_payment_unallocated_v1 to anon;
-- payment -> alloc -> invoice -> receipt까지 내려주는 상세 뷰 (UI용)
create or replace view public.cms_v_ap_payment_alloc_detail_v1
with (security_invoker = true)
as
select
  p.payment_id,
  p.vendor_party_id,
  p.paid_at,
  p.note as payment_note,

  a.alloc_id,
  a.ap_id,
  i.receipt_id,
  i.occurred_at,
  i.movement_code,
  i.memo as invoice_memo,

  al.asset_code,
  al.qty as alloc_qty
from public.cms_ap_payment p
join public.cms_ap_alloc a on a.payment_id = p.payment_id
join public.cms_ap_invoice i on i.ap_id = a.ap_id
join public.cms_ap_alloc_leg al on al.alloc_id = a.alloc_id;
grant select on public.cms_v_ap_payment_alloc_detail_v1 to authenticated;
grant select on public.cms_v_ap_payment_alloc_detail_v1 to anon;
-- ============================================================
-- 2) RPC: 결제 생성 + FIFO 상계
--    - 자산별 FIFO (XAU_G / XAG_G / KRW_LABOR / KRW_MATERIAL)
--    - invoice의 outstanding(>0)만 대상으로 oldest first
--    - 남은 결제분은 "미배정(unallocated)"으로 남김 (추후 수동배정/크레딧 처리 가능)
--    - idempotency_key가 있으면 중복 결제 생성 방지 + 기존 결제 반환
-- ============================================================

-- 입력 예시:
-- select public.cms_fn_ap2_pay_and_fifo_v1(
--   'vendor_uuid',
--   now(),
--   '[{"asset_code":"XAU_G","qty":1.25},{"asset_code":"KRW_LABOR","qty":350000}]'::jsonb,
--   '2/5 결제',
--   'vendor-20260205-001'
-- );

create or replace function public.cms_fn_ap2_pay_and_fifo_v1(
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

  -- 1) idempotency 처리: 기존 결제면 재상계하지 않고 그대로 반환
  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    select payment_id into v_payment_id
    from public.cms_ap_payment
    where vendor_party_id = p_vendor_party_id
      and idempotency_key = p_idempotency_key
    limit 1;

    if v_payment_id is not null then
      v_existing := true;

      -- 기존 결제의 미배정/alloc 요약 반환
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

  -- legs replace(결제 생성 직후이므로 단순 insert)
  for r_leg in
    select
      (e->>'asset_code')::public.cms_asset_code as asset_code,
      coalesce(nullif(e->>'qty','')::numeric, 0) as qty
    from jsonb_array_elements(p_legs) as t(e)
  loop
    if r_leg.qty <= 0 then
      -- 0/음수는 무시(나중에 환불/역결제 기능으로 확장 가능)
      continue;
    end if;

    insert into public.cms_ap_payment_leg(payment_id, asset_code, qty)
    values (v_payment_id, r_leg.asset_code, r_leg.qty)
    on conflict (payment_id, asset_code)
    do update set qty = excluded.qty;
  end loop;

  -- 3) FIFO 상계: 자산별로 oldest invoice부터 outstanding 상계
  for r_leg in
    select
      (e->>'asset_code')::public.cms_asset_code as asset_code,
      coalesce(nullif(e->>'qty','')::numeric, 0) as qty
    from jsonb_array_elements(p_legs) as t(e)
  loop
    v_asset := r_leg.asset_code;
    v_remaining := r_leg.qty;

    if v_remaining <= 0 then
      continue;
    end if;

    -- FIFO 대상 invoice 목록: 해당 자산 outstanding > 0 인 것만
    for r_inv in
      select
        i.ap_id,
        i.occurred_at,
        l.due_qty,
        coalesce(sum(al.qty),0) as alloc_qty
      from public.cms_ap_invoice i
      join public.cms_ap_invoice_leg l
        on l.ap_id = i.ap_id
       and l.asset_code = v_asset
      left join public.cms_ap_alloc a
        on a.ap_id = i.ap_id
      left join public.cms_ap_alloc_leg al
        on al.alloc_id = a.alloc_id
       and al.asset_code = v_asset
      where i.vendor_party_id = p_vendor_party_id
      group by i.ap_id, i.occurred_at, l.due_qty
      having (l.due_qty - coalesce(sum(al.qty),0)) > v_eps
      order by i.occurred_at asc, i.ap_id asc
    loop
      exit when v_remaining <= v_eps;

      v_outstanding := (r_inv.due_qty - r_inv.alloc_qty);
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
        jsonb_build_object(
          'alloc_id', v_alloc_id,
          'ap_id', r_inv.ap_id,
          'asset_code', v_asset,
          'qty', v_alloc_qty
        )
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
alter function public.cms_fn_ap2_pay_and_fifo_v1(uuid,timestamptz,jsonb,text,text)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_ap2_pay_and_fifo_v1(uuid,timestamptz,jsonb,text,text)
  to authenticated, service_role;
-- ============================================================
-- 3) RPC: 결제의 "미배정"을 특정 invoice에 수동 배정 (옵션이지만 운영에 유용)
--    - FIFO 이후 남은 크레딧을 특정 영수증에 붙이고 싶을 때 사용
-- ============================================================
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
  v_unalloc numeric(18,6);
  v_outstanding numeric(18,6);
  v_alloc_qty numeric(18,6);
  v_alloc_id uuid;
begin
  if p_payment_id is null or p_ap_id is null then
    raise exception 'payment_id and ap_id required';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'qty must be > 0';
  end if;

  select vendor_party_id into v_vendor
  from public.cms_ap_payment
  where payment_id = p_payment_id;

  if v_vendor is null then
    raise exception 'payment not found';
  end if;

  -- 미배정 잔액 체크
  select unallocated_qty into v_unalloc
  from public.cms_v_ap_payment_unallocated_v1
  where payment_id = p_payment_id and asset_code = p_asset_code;

  v_unalloc := coalesce(v_unalloc,0);
  if v_unalloc <= 0 then
    raise exception 'no unallocated balance for this asset';
  end if;

  -- invoice outstanding 체크
  select outstanding_qty into v_outstanding
  from public.cms_v_ap_invoice_position_v1
  where ap_id = p_ap_id and asset_code = p_asset_code;

  v_outstanding := coalesce(v_outstanding,0);
  if v_outstanding <= 0 then
    raise exception 'invoice has no outstanding for this asset';
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
