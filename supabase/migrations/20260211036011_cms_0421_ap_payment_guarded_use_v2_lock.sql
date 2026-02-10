-- 20260211037010_cms_0421_ap_payment_guarded_use_v2_lock.sql
set search_path = public, pg_temp;

begin;

-- ------------------------------------------------------------
-- 결제 안전 가드 RPC 수정(ADD-ONLY):
-- - 기존 시그니처/권한/리턴 형태 유지
-- - 내부 호출을 v1 -> v2(advisory lock)로 전환하여 FIFO 레이스 방지
-- ------------------------------------------------------------
create or replace function public.cms_fn_ap2_pay_and_fifo_guarded_v1(
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
  v_err int;
begin
  select coalesce(error_count,0) into v_err
  from public.cms_v_ap_reconcile_open_by_vendor_v1
  where vendor_party_id = p_vendor_party_id;

  if coalesce(v_err,0) > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'PAYMENT_BLOCKED: vendor has %s open reconcile ERROR issue(s). Resolve/ACK/adjust in AP Reconcile first.',
        v_err
      );
  end if;

  -- 핵심 변경점: FIFO는 v2(=vendor 단위 advisory lock)로 실행
  return public.cms_fn_ap2_pay_and_fifo_v2(
    p_vendor_party_id,
    p_paid_at,
    p_legs,
    p_note,
    p_idempotency_key
  );
end $$;

alter function public.cms_fn_ap2_pay_and_fifo_guarded_v1(uuid,timestamptz,jsonb,text,text)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_ap2_pay_and_fifo_guarded_v1(uuid,timestamptz,jsonb,text,text)
  to authenticated, service_role;

commit;
