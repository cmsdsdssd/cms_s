-- 20260209150000_cms_0369_ap_reverse_payment.sql
set search_path = public, pg_temp;
begin;
-- ============================================================
-- 0) Link table: 원 결제(payment) -> reverse 결제(payment)
--    - 원 결제는 "한 번만" reverse 가능(유니크)
--    - reverse 결제는 원 결제를 참조(감사/추적)
-- ============================================================
create table if not exists public.cms_ap_payment_reversal_link (
  original_payment_id uuid not null,
  reversal_payment_id uuid not null,

  created_at timestamptz not null default now(),
  created_by uuid,

  primary key (original_payment_id)
);
create unique index if not exists cms_ap_payment_reversal_link_reversal_unique
  on public.cms_ap_payment_reversal_link (reversal_payment_id);
do $$
begin
  -- FK는 존재할 때만 (ADD-ONLY 안전)
  begin
    alter table public.cms_ap_payment_reversal_link
      add constraint cms_ap_payment_reversal_link_original_fk
      foreign key (original_payment_id) references public.cms_ap_payment(payment_id)
      on delete restrict;
  exception when duplicate_object then null;
  end;

  begin
    alter table public.cms_ap_payment_reversal_link
      add constraint cms_ap_payment_reversal_link_reversal_fk
      foreign key (reversal_payment_id) references public.cms_ap_payment(payment_id)
      on delete restrict;
  exception when duplicate_object then null;
  end;
end $$;
-- ============================================================
-- 1) Guard trigger: "reversed 된 original payment"에는 새 alloc 금지
--    - 원 결제의 alloc이 역으로 되돌려진 이후, 실수로 추가 manual alloc 붙는 사고 차단
--    - reverse payment(reversal_payment_id)는 허용(역alloc 생성에 필요)
-- ============================================================
create or replace function public.cms_fn_ap2_block_alloc_on_reversed_payment_v1()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- original_payment_id로 reverse link가 있으면, 그 payment_id에는 새 alloc 금지
  if exists (
    select 1
    from public.cms_ap_payment_reversal_link l
    where l.original_payment_id = new.payment_id
  ) then
    raise exception using errcode='P0001', message='payment has been reversed; additional alloc is blocked';
  end if;

  return new;
end $$;
do $$
begin
  if to_regclass('public.cms_ap_alloc') is not null then
    begin
      create trigger cms_tr_ap_alloc_block_reversed_payment
      before insert on public.cms_ap_alloc
      for each row
      execute function public.cms_fn_ap2_block_alloc_on_reversed_payment_v1();
    exception when duplicate_object then null;
    end;
  end if;
end $$;
-- ============================================================
-- 2) RPC: Reverse payment (취소/정정)
--    - 기존 payment / alloc / legs 를 수정/삭제하지 않음
--    - reversal payment 생성:
--        payment_leg: 원 legs의 -qty
--        alloc: 원 alloc과 동일한 ap_id로 새 alloc 생성
--        alloc_leg: 원 alloc_leg의 -qty
--    - 결과적으로 invoice position(outstanding)이 원복됨 (sum 기반)
-- ============================================================
create or replace function public.cms_fn_ap2_reverse_payment_v1(
  p_original_payment_id uuid,
  p_reversed_at timestamptz default now(),
  p_note text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_vendor uuid;
  v_rev_payment_id uuid;
  v_existing_rev uuid;
  v_idem text;

  v_lock1 int;
  v_lock2 int;

  r_alloc record;
  v_new_alloc_id uuid;

  v_rev_alloc_cnt int := 0;
  v_rev_leg_cnt int := 0;
begin
  if p_original_payment_id is null then
    raise exception using errcode='P0001', message='original_payment_id required';
  end if;

  -- 원 결제 존재/벤더 확인
  select vendor_party_id into v_vendor
  from public.cms_ap_payment
  where payment_id = p_original_payment_id;

  if v_vendor is null then
    raise exception using errcode='P0001', message='original payment not found';
  end if;

  -- 동시 호출 방지: 원 결제 기준 advisory lock
  v_lock1 := ('x'||substr(md5(p_original_payment_id::text),1,8))::bit(32)::int;
  v_lock2 := ('x'||substr(md5(p_original_payment_id::text),9,8))::bit(32)::int;
  perform pg_advisory_xact_lock(v_lock1, v_lock2);

  -- 이미 reverse 되었으면 그대로 반환 (idempotent)
  select reversal_payment_id into v_existing_rev
  from public.cms_ap_payment_reversal_link
  where original_payment_id = p_original_payment_id;

  if v_existing_rev is not null then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'original_payment_id', p_original_payment_id,
      'reversal_payment_id', v_existing_rev
    );
  end if;

  -- idempotency_key 기본값 (vendor별 unique)
  v_idem := nullif(btrim(p_idempotency_key),'');
  if v_idem is null then
    v_idem := 'REV:' || p_original_payment_id::text;
  end if;

  -- reverse payment 생성 (unique_violation이면 기존 사용)
  begin
    insert into public.cms_ap_payment(
      vendor_party_id, paid_at, note, idempotency_key, created_by
    )
    values (
      v_vendor,
      coalesce(p_reversed_at, now()),
      concat('[REVERSAL of ', p_original_payment_id::text, '] ', coalesce(p_note,'')),
      v_idem,
      auth.uid()
    )
    returning payment_id into v_rev_payment_id;
  exception when unique_violation then
    select payment_id into v_rev_payment_id
    from public.cms_ap_payment
    where vendor_party_id = v_vendor and idempotency_key = v_idem
    limit 1;

    if v_rev_payment_id is null then
      raise;
    end if;
  end;

  -- payment_leg: 원 legs의 -qty
  insert into public.cms_ap_payment_leg(payment_id, asset_code, qty)
  select
    v_rev_payment_id,
    pl.asset_code,
    -pl.qty
  from public.cms_ap_payment_leg pl
  where pl.payment_id = p_original_payment_id;

  get diagnostics v_rev_leg_cnt = row_count;

  -- alloc reverse: 원 alloc별로 새 alloc 생성 + alloc_leg -qty 복제
  for r_alloc in
    select alloc_id, ap_id
    from public.cms_ap_alloc
    where payment_id = p_original_payment_id
    order by created_at asc, alloc_id asc
  loop
    insert into public.cms_ap_alloc(payment_id, ap_id, created_by)
    values (v_rev_payment_id, r_alloc.ap_id, auth.uid())
    returning alloc_id into v_new_alloc_id;

    insert into public.cms_ap_alloc_leg(alloc_id, asset_code, qty)
    select
      v_new_alloc_id,
      al.asset_code,
      -al.qty
    from public.cms_ap_alloc_leg al
    where al.alloc_id = r_alloc.alloc_id;

    v_rev_alloc_cnt := v_rev_alloc_cnt + 1;
  end loop;

  -- link 기록 (원 결제는 1회만 reverse)
  insert into public.cms_ap_payment_reversal_link(original_payment_id, reversal_payment_id, created_by)
  values (p_original_payment_id, v_rev_payment_id, auth.uid())
  on conflict (original_payment_id) do nothing;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'original_payment_id', p_original_payment_id,
    'reversal_payment_id', v_rev_payment_id,
    'reversed_payment_leg_rows', v_rev_leg_cnt,
    'reversed_alloc_cnt', v_rev_alloc_cnt
  );
end $$;
alter function public.cms_fn_ap2_reverse_payment_v1(uuid,timestamptz,text,text)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_ap2_reverse_payment_v1(uuid,timestamptz,text,text)
  to authenticated, service_role;
commit;
