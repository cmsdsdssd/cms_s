-- 20260209150000_cms_0366_ar_manual_offset_adjust.sql
set search_path = public, pg_temp;
--------------------------------------------------------------------------------
-- 0) Admin whitelist table (누가 조정/상계 실행 가능한지)
--------------------------------------------------------------------------------
create table if not exists public.cms_admin_user (
  person_id uuid primary key references public.cms_person(person_id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);
-- RLS: 본인 row만 select 가능(관리자 목록 노출 최소화)
alter table public.cms_admin_user enable row level security;
drop policy if exists cms_select_self on public.cms_admin_user;
create policy cms_select_self on public.cms_admin_user
  for select to authenticated
  using (person_id = auth.uid());
grant select on public.cms_admin_user to authenticated;
--------------------------------------------------------------------------------
-- 1) Manual action audit tables (상계/조정 “감사 로그”)
--------------------------------------------------------------------------------
create table if not exists public.cms_ar_manual_action (
  action_id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.cms_party(party_id),

  action_kind text not null check (action_kind in ('OFFSET','ADJUST_DOWN','ADJUST_UP')),
  occurred_at timestamptz not null,

  cash_krw numeric not null default 0, -- 의도된 처리 금액(현금 기준)
  reason_code text not null,
  reason_detail text,

  -- 연결(있을 수도/없을 수도)
  payment_id uuid references public.cms_ar_payment(payment_id),
  ar_id uuid references public.cms_ar_invoice(ar_id),
  ar_ledger_id uuid references public.cms_ar_ledger(ar_ledger_id),

  -- 중복 방지 키(파티 단위로 유니크)
  idempotency_key text not null,

  created_by uuid references public.cms_person(person_id),
  created_at timestamptz not null default now()
);
create unique index if not exists idx_cms_ar_manual_action_party_idempotency
  on public.cms_ar_manual_action(party_id, idempotency_key);
create index if not exists idx_cms_ar_manual_action_party_occurred
  on public.cms_ar_manual_action(party_id, occurred_at desc);
alter table public.cms_ar_manual_action enable row level security;
drop policy if exists cms_select_authenticated on public.cms_ar_manual_action;
create policy cms_select_authenticated on public.cms_ar_manual_action
  for select to authenticated using (true);
grant select on public.cms_ar_manual_action to authenticated;
-- 상계/조정이 실제로 만든 alloc들을 “action”에 매핑해서 추적 가능하게
create table if not exists public.cms_ar_manual_action_alloc (
  action_alloc_id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.cms_ar_manual_action(action_id) on delete cascade,

  alloc_id uuid not null references public.cms_ar_payment_alloc(alloc_id) on delete cascade,
  payment_id uuid not null references public.cms_ar_payment(payment_id) on delete cascade,
  ar_id uuid not null references public.cms_ar_invoice(ar_id) on delete cascade,

  alloc_cash_krw numeric not null default 0,
  alloc_labor_krw numeric not null default 0,
  alloc_material_krw numeric not null default 0,

  created_at timestamptz not null default now()
);
create index if not exists idx_cms_ar_manual_action_alloc_action
  on public.cms_ar_manual_action_alloc(action_id);
alter table public.cms_ar_manual_action_alloc enable row level security;
drop policy if exists cms_select_authenticated on public.cms_ar_manual_action_alloc;
create policy cms_select_authenticated on public.cms_ar_manual_action_alloc
  for select to authenticated using (true);
grant select on public.cms_ar_manual_action_alloc to authenticated;
--------------------------------------------------------------------------------
-- 2) Admin check helper (충돌 방지: “새 이름”)
--------------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cms_fn_ar_require_admin_for_manual_ar_v1'
  ) then
    raise exception 'Refusing to overwrite existing function: public.cms_fn_ar_require_admin_for_manual_ar_v1';
  end if;
end $$;
create function public.cms_fn_ar_require_admin_for_manual_ar_v1(
  p_actor_person_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_actor uuid := coalesce(p_actor_person_id, auth.uid());
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.cms_admin_user au
    where au.person_id = v_actor
  ) then
    raise exception 'admin only';
  end if;
end $$;
grant execute on function public.cms_fn_ar_require_admin_for_manual_ar_v1(uuid)
  to authenticated;
--------------------------------------------------------------------------------
-- 3) OFFSET (상계): “미할당 선수금(현금)”을 기존 payment들에서 꺼내서 alloc만 추가
--    - 새 payment 생성 X (돈을 새로 만들지 않음)
--    - 원장(balance) 변화 0, outstanding만 줄어들어 “꼬임”을 정상화
--------------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cms_fn_ar_apply_offset_from_unallocated_cash_v1'
  ) then
    raise exception 'Refusing to overwrite existing function: public.cms_fn_ar_apply_offset_from_unallocated_cash_v1';
  end if;
end $$;
create function public.cms_fn_ar_apply_offset_from_unallocated_cash_v1(
  p_party_id uuid,
  p_idempotency_key text,
  p_offset_cash_krw numeric,
  p_occurred_at timestamptz default now(),
  p_reason_code text default 'OFFSET',
  p_reason_detail text default null,
  p_actor_person_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_actor uuid := coalesce(p_actor_person_id, auth.uid());
  v_key text := 'OFFSET:' || btrim(coalesce(p_idempotency_key,''));
  v_at timestamptz := coalesce(p_occurred_at, now());
  v_epsilon numeric := 0.0001;

  v_action_id uuid := gen_random_uuid();
  v_ar_ledger_id uuid;

  v_req numeric := round(coalesce(p_offset_cash_krw, 0), 6);
  v_remaining numeric := 0;

  v_outstanding_total numeric := 0;

  v_pay_sum numeric := 0;
  v_alloc_sum numeric := 0;
  v_unallocated_total numeric := 0;

  v_applied_cash numeric := 0;
  v_applied_labor numeric := 0;
  v_applied_material numeric := 0;

  -- invoice loop
  r_inv record;

  -- payment cursor (미할당 선수금 있는 payment들)
  cur_pay refcursor;
  v_pay_id uuid;
  v_pay_cash_rem numeric := 0;

  -- per-invoice needs
  v_need_labor numeric := 0;
  v_need_material numeric := 0;

  -- chunk allocation from a payment to an invoice
  v_chunk_total numeric := 0;
  v_chunk_labor numeric := 0;
  v_chunk_material numeric := 0;

  v_alloc_id uuid;

  v_dup public.cms_ar_manual_action%rowtype;
begin
  perform public.cms_fn_ar_require_admin_for_manual_ar_v1(v_actor);

  if p_party_id is null then
    raise exception 'party_id is required';
  end if;

  if v_key = 'OFFSET:' then
    raise exception 'idempotency_key is required';
  end if;

  if v_req <= 0 then
    raise exception 'offset_cash_krw must be > 0';
  end if;

  -- party 존재 확인 + (가벼운) 동시성 방지
  perform pg_advisory_xact_lock(hashtext('ar_manual:' || p_party_id::text));

  perform 1
  from public.cms_party
  where party_id = p_party_id;

  if not found then
    raise exception 'party not found: %', p_party_id;
  end if;

  -- 중복 방지(이미 같은 idempotency로 실행된 경우 그대로 반환)
  select * into v_dup
  from public.cms_ar_manual_action
  where party_id = p_party_id
    and idempotency_key = v_key;

  if found then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'action_id', v_dup.action_id,
      'ar_ledger_id', v_dup.ar_ledger_id
    );
  end if;

  -- outstanding 총액(현금 기준) 체크
  select round(coalesce(sum(total_cash_outstanding_krw), 0), 6)
    into v_outstanding_total
  from public.cms_v_ar_invoice_position_v1
  where party_id = p_party_id;

  if v_req > v_outstanding_total + v_epsilon then
    raise exception 'offset exceeds outstanding cash. outstanding=% requested=%',
      v_outstanding_total, v_req;
  end if;

  -- 미할당 선수금(현금) 총액 = sum(pay.cash) - sum(alloc.cash)
  select round(coalesce(sum(p.cash_krw), 0), 6)
    into v_pay_sum
  from public.cms_ar_payment p
  where p.party_id = p_party_id;

  select round(coalesce(sum(a.alloc_cash_krw), 0), 6)
    into v_alloc_sum
  from public.cms_ar_payment_alloc a
  join public.cms_ar_payment p on p.payment_id = a.payment_id
  where p.party_id = p_party_id;

  v_unallocated_total := round(v_pay_sum - v_alloc_sum, 6);

  if v_req > v_unallocated_total + v_epsilon then
    raise exception 'insufficient unallocated cash credit. available=% requested=%',
      v_unallocated_total, v_req;
  end if;

  v_remaining := v_req;

  -- ledger(0원) 먼저 박아두고 action_id로 추적 (실패 시 트랜잭션 롤백)
  insert into public.cms_ar_ledger(
    party_id, occurred_at, entry_type, amount_krw, memo
  )
  values (
    p_party_id, v_at, 'OFFSET', 0,
    '[OFFSET] action_id='||v_action_id::text||' '||coalesce(p_reason_code,'')||' '||coalesce(p_reason_detail,'')
  )
  returning ar_ledger_id into v_ar_ledger_id;

  insert into public.cms_ar_manual_action(
    action_id, party_id, action_kind, occurred_at, cash_krw,
    reason_code, reason_detail,
    ar_ledger_id, idempotency_key, created_by
  )
  values (
    v_action_id, p_party_id, 'OFFSET', v_at, round(v_req, 0),
    coalesce(p_reason_code,'OFFSET'), p_reason_detail,
    v_ar_ledger_id, v_key, v_actor
  );

  -- payment cursor open: 남아있는 cash가 있는 payment만
  open cur_pay for
    with pay as (
      select
        p.payment_id,
        p.paid_at,
        p.created_at,
        round(p.cash_krw - coalesce(sum(a.alloc_cash_krw), 0), 6) as cash_remaining
      from public.cms_ar_payment p
      left join public.cms_ar_payment_alloc a on a.payment_id = p.payment_id
      where p.party_id = p_party_id
      group by p.payment_id, p.paid_at, p.created_at, p.cash_krw
      having round(p.cash_krw - coalesce(sum(a.alloc_cash_krw), 0), 6) > v_epsilon
      order by p.paid_at, p.created_at, p.payment_id
    )
    select payment_id, cash_remaining
    from pay;

  fetch cur_pay into v_pay_id, v_pay_cash_rem;
  if not found then
    raise exception 'no unallocated cash credit found';
  end if;

  for r_inv in
    select ar_id, labor_cash_outstanding_krw, material_cash_outstanding_krw
    from public.cms_v_ar_invoice_position_v1
    where party_id = p_party_id
      and total_cash_outstanding_krw > 0
    order by occurred_at, created_at, ar_id
  loop
    exit when v_remaining <= v_epsilon;

    v_need_labor := least(v_remaining, round(coalesce(r_inv.labor_cash_outstanding_krw, 0), 6));
    v_need_material := 0;
    if (v_remaining - v_need_labor) > v_epsilon then
      v_need_material := least(
        v_remaining - v_need_labor,
        round(coalesce(r_inv.material_cash_outstanding_krw, 0), 6)
      );
    end if;

    -- 이 인보이스에서 필요한 (labor+material)을 payment들에서 꺼내서 배분
    while (v_need_labor + v_need_material) > v_epsilon loop
      -- 현재 payment가 바닥나면 다음 payment로 이동
      while v_pay_cash_rem <= v_epsilon loop
        fetch cur_pay into v_pay_id, v_pay_cash_rem;
        if not found then
          raise exception 'insufficient unallocated cash while allocating (should not happen if precheck passed)';
        end if;
      end loop;

      v_chunk_total := least(v_pay_cash_rem, v_need_labor + v_need_material);
      v_chunk_labor := least(v_need_labor, v_chunk_total);
      v_chunk_material := v_chunk_total - v_chunk_labor;

      if v_chunk_material > v_need_material then
        v_chunk_material := v_need_material;
        v_chunk_total := v_chunk_labor + v_chunk_material;
      end if;

      insert into public.cms_ar_payment_alloc(
        payment_id, ar_id,
        alloc_cash_krw, alloc_labor_krw, alloc_material_krw
      )
      values (
        v_pay_id, r_inv.ar_id,
        v_chunk_total, v_chunk_labor, v_chunk_material
      )
      returning alloc_id into v_alloc_id;

      insert into public.cms_ar_manual_action_alloc(
        action_id, alloc_id, payment_id, ar_id,
        alloc_cash_krw, alloc_labor_krw, alloc_material_krw
      )
      values (
        v_action_id, v_alloc_id, v_pay_id, r_inv.ar_id,
        v_chunk_total, v_chunk_labor, v_chunk_material
      );

      v_applied_cash := v_applied_cash + v_chunk_total;
      v_applied_labor := v_applied_labor + v_chunk_labor;
      v_applied_material := v_applied_material + v_chunk_material;

      v_pay_cash_rem := round(v_pay_cash_rem - v_chunk_total, 6);
      v_need_labor := round(v_need_labor - v_chunk_labor, 6);
      v_need_material := round(v_need_material - v_chunk_material, 6);
      v_remaining := round(v_remaining - v_chunk_total, 6);
    end loop;
  end loop;

  close cur_pay;

  if v_remaining > v_epsilon then
    raise exception 'offset allocation incomplete. remaining=%', v_remaining;
  end if;

  return jsonb_build_object(
    'ok', true,
    'action_id', v_action_id,
    'ar_ledger_id', v_ar_ledger_id,
    'applied_cash_krw', round(v_applied_cash, 0),
    'applied_labor_krw', round(v_applied_labor, 0),
    'applied_material_krw', round(v_applied_material, 0)
  );
end $$;
grant execute on function public.cms_fn_ar_apply_offset_from_unallocated_cash_v1(
  uuid, text, numeric, timestamptz, text, text, uuid
) to authenticated;
--------------------------------------------------------------------------------
-- 4) ADJUST_DOWN (조정-차감): 원장(-) + outstanding 감소(alloc) = “정정”
--    - 실제 수금이 아니라 “회계/오류정정” 이므로 entry_type='ADJUST'
--    - 충돌 방지: idempotency_key는 'ADJUST_DOWN:' prefix를 강제
--------------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cms_fn_ar_apply_adjustment_down_fifo_v1'
  ) then
    raise exception 'Refusing to overwrite existing function: public.cms_fn_ar_apply_adjustment_down_fifo_v1';
  end if;
end $$;
create function public.cms_fn_ar_apply_adjustment_down_fifo_v1(
  p_party_id uuid,
  p_idempotency_key text,
  p_adjust_cash_krw numeric,
  p_occurred_at timestamptz default now(),
  p_reason_code text default 'ADJUST_DOWN',
  p_reason_detail text default null,
  p_actor_person_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_actor uuid := coalesce(p_actor_person_id, auth.uid());
  v_key text := 'ADJUST_DOWN:' || btrim(coalesce(p_idempotency_key,''));
  v_at timestamptz := coalesce(p_occurred_at, now());
  v_epsilon numeric := 0.0001;

  v_action_id uuid := gen_random_uuid();
  v_payment_id uuid;
  v_ar_ledger_id uuid;

  v_req numeric := round(coalesce(p_adjust_cash_krw, 0), 6);
  v_remaining numeric := 0;

  v_outstanding_total numeric := 0;

  v_applied_cash numeric := 0;
  v_applied_labor numeric := 0;
  v_applied_material numeric := 0;

  r_inv record;
  v_cash_for_labor numeric;
  v_cash_for_material numeric;
  v_alloc_id uuid;

  v_dup public.cms_ar_manual_action%rowtype;
begin
  perform public.cms_fn_ar_require_admin_for_manual_ar_v1(v_actor);

  if p_party_id is null then
    raise exception 'party_id is required';
  end if;

  if v_key = 'ADJUST_DOWN:' then
    raise exception 'idempotency_key is required';
  end if;

  if v_req <= 0 then
    raise exception 'adjust_cash_krw must be > 0';
  end if;

  perform pg_advisory_xact_lock(hashtext('ar_manual:' || p_party_id::text));

  -- party 존재 확인
  perform 1 from public.cms_party where party_id = p_party_id;
  if not found then
    raise exception 'party not found: %', p_party_id;
  end if;

  -- 중복 방지(같은 키로 이미 실행된 경우 반환)
  select * into v_dup
  from public.cms_ar_manual_action
  where party_id = p_party_id
    and idempotency_key = v_key;

  if found then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'action_id', v_dup.action_id,
      'payment_id', v_dup.payment_id,
      'ar_ledger_id', v_dup.ar_ledger_id
    );
  end if;

  -- outstanding 총액(현금)보다 크게 차감 금지 (크레딧 생성 방지)
  select round(coalesce(sum(total_cash_outstanding_krw), 0), 6)
    into v_outstanding_total
  from public.cms_v_ar_invoice_position_v1
  where party_id = p_party_id;

  if v_req > v_outstanding_total + v_epsilon then
    raise exception 'adjust_down exceeds outstanding cash. outstanding=% requested=%',
      v_outstanding_total, v_req;
  end if;

  v_remaining := v_req;

  -- “조정”도 alloc 구조를 재사용하기 위해 cms_ar_payment를 만든다(표시는 note로 구분)
  insert into public.cms_ar_payment(
    party_id, paid_at, cash_krw, gold_g, silver_g,
    note, created_by, idempotency_key
  )
  values (
    p_party_id, v_at, v_remaining, 0, 0,
    '[ADJUST_DOWN] '||coalesce(p_reason_code,'')||' '||coalesce(p_reason_detail,''),
    v_actor, v_key
  )
  returning payment_id into v_payment_id;

  -- FIFO alloc (labor -> material)
  for r_inv in
    select ar_id, labor_cash_outstanding_krw, material_cash_outstanding_krw
    from public.cms_v_ar_invoice_position_v1
    where party_id = p_party_id
      and total_cash_outstanding_krw > 0
    order by occurred_at, created_at, ar_id
  loop
    exit when v_remaining <= v_epsilon;

    v_cash_for_labor := least(v_remaining, round(coalesce(r_inv.labor_cash_outstanding_krw, 0), 6));
    v_remaining := round(v_remaining - v_cash_for_labor, 6);

    v_cash_for_material := 0;
    if v_remaining > v_epsilon then
      v_cash_for_material := least(v_remaining, round(coalesce(r_inv.material_cash_outstanding_krw, 0), 6));
      v_remaining := round(v_remaining - v_cash_for_material, 6);
    end if;

    if (v_cash_for_labor + v_cash_for_material) > v_epsilon then
      insert into public.cms_ar_payment_alloc(
        payment_id, ar_id,
        alloc_cash_krw, alloc_labor_krw, alloc_material_krw
      )
      values (
        v_payment_id, r_inv.ar_id,
        v_cash_for_labor + v_cash_for_material,
        v_cash_for_labor,
        v_cash_for_material
      )
      returning alloc_id into v_alloc_id;

      v_applied_cash := v_applied_cash + (v_cash_for_labor + v_cash_for_material);
      v_applied_labor := v_applied_labor + v_cash_for_labor;
      v_applied_material := v_applied_material + v_cash_for_material;

      -- action_alloc은 action_id가 필요하므로, action header는 아래에서 만든 뒤에 채운다
    end if;
  end loop;

  if v_remaining > v_epsilon then
    raise exception 'adjust_down allocation incomplete. remaining=%', v_remaining;
  end if;

  -- payment_header upsert (기존 PAYMENT RPC와 동일 패턴: FK/리포트 안정성)
  insert into public.cms_payment_header(
    payment_id, party_id, paid_at, memo, total_amount_krw
  )
  values (
    v_payment_id, p_party_id, v_at,
    '[ADJUST_DOWN] '||coalesce(p_reason_code,'')||' '||coalesce(p_reason_detail,''),
    round(v_req, 0)
  )
  on conflict (payment_id) do update
    set total_amount_krw = excluded.total_amount_krw,
        memo = excluded.memo,
        paid_at = excluded.paid_at,
        party_id = excluded.party_id;

  -- ledger (-): receivable 감소
  insert into public.cms_ar_ledger(
    party_id, occurred_at, entry_type, amount_krw, payment_id, memo
  )
  values (
    p_party_id, v_at, 'ADJUST', -round(v_req, 0), v_payment_id,
    '[ADJUST_DOWN] action_id='||v_action_id::text||' '||coalesce(p_reason_code,'')||' '||coalesce(p_reason_detail,'')
  )
  returning ar_ledger_id into v_ar_ledger_id;

  -- action header
  insert into public.cms_ar_manual_action(
    action_id, party_id, action_kind, occurred_at, cash_krw,
    reason_code, reason_detail,
    payment_id, ar_ledger_id, idempotency_key, created_by
  )
  values (
    v_action_id, p_party_id, 'ADJUST_DOWN', v_at, round(v_req, 0),
    coalesce(p_reason_code,'ADJUST_DOWN'), p_reason_detail,
    v_payment_id, v_ar_ledger_id, v_key, v_actor
  );

  -- action_alloc 채우기: 방금 생성된 payment_id의 alloc 전부를 action에 매핑
  insert into public.cms_ar_manual_action_alloc(
    action_id, alloc_id, payment_id, ar_id,
    alloc_cash_krw, alloc_labor_krw, alloc_material_krw
  )
  select
    v_action_id,
    a.alloc_id,
    a.payment_id,
    a.ar_id,
    a.alloc_cash_krw,
    a.alloc_labor_krw,
    a.alloc_material_krw
  from public.cms_ar_payment_alloc a
  where a.payment_id = v_payment_id;

  return jsonb_build_object(
    'ok', true,
    'action_id', v_action_id,
    'payment_id', v_payment_id,
    'ar_ledger_id', v_ar_ledger_id,
    'applied_cash_krw', round(v_applied_cash, 0),
    'applied_labor_krw', round(v_applied_labor, 0),
    'applied_material_krw', round(v_applied_material, 0)
  );
end $$;
grant execute on function public.cms_fn_ar_apply_adjustment_down_fifo_v1(
  uuid, text, numeric, timestamptz, text, text, uuid
) to authenticated;
--------------------------------------------------------------------------------
-- 5) ADJUST_UP (조정-증가): synthetic invoice 생성 + ledger(+)로 receivable 증가
--    - shipment/shipment_line 없이도 생성 가능 (정정용)
--    - labor/material 분리 입력 지원(기본: 전액 labor)
--------------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cms_fn_ar_create_adjustment_up_invoice_v1'
  ) then
    raise exception 'Refusing to overwrite existing function: public.cms_fn_ar_create_adjustment_up_invoice_v1';
  end if;
end $$;
create function public.cms_fn_ar_create_adjustment_up_invoice_v1(
  p_party_id uuid,
  p_idempotency_key text,
  p_total_cash_due_krw numeric,
  p_occurred_at timestamptz default now(),
  p_labor_cash_due_krw numeric default null,
  p_material_cash_due_krw numeric default null,
  p_reason_code text default 'ADJUST_UP',
  p_reason_detail text default null,
  p_actor_person_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_actor uuid := coalesce(p_actor_person_id, auth.uid());
  v_key text := 'ADJUST_UP:' || btrim(coalesce(p_idempotency_key,''));
  v_at timestamptz := coalesce(p_occurred_at, now());

  v_total numeric := round(coalesce(p_total_cash_due_krw, 0), 6);
  v_labor numeric := round(coalesce(p_labor_cash_due_krw, v_total), 6);
  v_material numeric := round(coalesce(p_material_cash_due_krw, 0), 6);

  v_action_id uuid := gen_random_uuid();
  v_ar_id uuid;
  v_ar_ledger_id uuid;

  v_dup public.cms_ar_manual_action%rowtype;
begin
  perform public.cms_fn_ar_require_admin_for_manual_ar_v1(v_actor);

  if p_party_id is null then
    raise exception 'party_id is required';
  end if;

  if v_key = 'ADJUST_UP:' then
    raise exception 'idempotency_key is required';
  end if;

  if v_total <= 0 then
    raise exception 'total_cash_due_krw must be > 0';
  end if;

  if v_labor < 0 or v_material < 0 then
    raise exception 'labor/material must be non-negative';
  end if;

  if round(v_labor + v_material, 6) <> v_total then
    -- 호출자가 labor/material 넣었는데 합이 total과 다르면 에러(데이터 일관성 강제)
    raise exception 'labor_cash_due_krw + material_cash_due_krw must equal total_cash_due_krw';
  end if;

  perform pg_advisory_xact_lock(hashtext('ar_manual:' || p_party_id::text));

  -- party 존재 확인
  perform 1 from public.cms_party where party_id = p_party_id;
  if not found then
    raise exception 'party not found: %', p_party_id;
  end if;

  -- 중복 방지
  select * into v_dup
  from public.cms_ar_manual_action
  where party_id = p_party_id
    and idempotency_key = v_key;

  if found then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'action_id', v_dup.action_id,
      'ar_id', v_dup.ar_id,
      'ar_ledger_id', v_dup.ar_ledger_id
    );
  end if;

  -- synthetic invoice (commodity은 사용 안 함: 정정 최소단위 = 현금)
  insert into public.cms_ar_invoice(
    party_id,
    shipment_id,
    shipment_line_id,
    occurred_at,
    labor_cash_due_krw,
    commodity_type,
    commodity_due_g,
    commodity_price_snapshot_krw_per_g,
    material_cash_due_krw,
    total_cash_due_krw
  )
  values (
    p_party_id,
    null,
    null,
    v_at,
    v_labor,
    null,
    0,
    0,
    v_material,
    v_total
  )
  returning ar_id into v_ar_id;

  -- ledger (+): receivable 증가
  insert into public.cms_ar_ledger(
    party_id, occurred_at, entry_type, amount_krw, memo
  )
  values (
    p_party_id, v_at, 'ADJUST', round(v_total, 0),
    '[ADJUST_UP] action_id='||v_action_id::text||' ar_id='||v_ar_id::text||' '||
    coalesce(p_reason_code,'')||' '||coalesce(p_reason_detail,'')
  )
  returning ar_ledger_id into v_ar_ledger_id;

  insert into public.cms_ar_manual_action(
    action_id, party_id, action_kind, occurred_at, cash_krw,
    reason_code, reason_detail,
    ar_id, ar_ledger_id, idempotency_key, created_by
  )
  values (
    v_action_id, p_party_id, 'ADJUST_UP', v_at, round(v_total, 0),
    coalesce(p_reason_code,'ADJUST_UP'), p_reason_detail,
    v_ar_id, v_ar_ledger_id, v_key, v_actor
  );

  return jsonb_build_object(
    'ok', true,
    'action_id', v_action_id,
    'ar_id', v_ar_id,
    'ar_ledger_id', v_ar_ledger_id,
    'labor_cash_due_krw', round(v_labor, 0),
    'material_cash_due_krw', round(v_material, 0),
    'total_cash_due_krw', round(v_total, 0)
  );
end $$;
grant execute on function public.cms_fn_ar_create_adjustment_up_invoice_v1(
  uuid, text, numeric, timestamptz, numeric, numeric, text, text, uuid
) to authenticated;
