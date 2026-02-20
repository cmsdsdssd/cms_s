set search_path = public, pg_temp;
begin;
-- ============================================================
-- 0414) AR 결제(금/은) “저울 2자리 + 현금차액” 추천 + 1,000원 이하 서비스 완불(로그)
-- - 기존 AR FIFO 결제 로직을 깨지 않고(ADD-ONLY),
--   UI에서 3자리/6자리 정밀표시 + 저울입력(2자리) 추천값을 만들 수 있게 한다.
-- - “서비스 완불”은 총 미수(현금 등가) 잔액이 1,000원 이하일 때만 가능.
--   (한 번에 0으로 만드는 방식 → 다회 반복으로 커지는 리스크 차단)
-- ============================================================

-- ------------------------------------------------------------
-- 1) 서비스 완불(Action) 로그 테이블
-- ------------------------------------------------------------
create table if not exists public.cms_ar_service_writeoff_action (
  action_id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.cms_party(party_id) on delete cascade,

  occurred_at timestamptz not null,

  -- 실제로 "깎아준" 현금 등가(원)
  writeoff_cash_krw numeric not null,

  -- 참고용(분석용): 이 writeoff로 함께 정리된 commodity g 합
  writeoff_gold_g numeric(18,6) not null default 0,
  writeoff_silver_g numeric(18,6) not null default 0,

  reason_detail text,

  payment_id uuid references public.cms_ar_payment(payment_id),
  ar_ledger_id uuid references public.cms_ar_ledger(ar_ledger_id),

  -- 파티 단위 유니크 (프론트에서 uuid/correlation_id 등을 넣어 dedupe)
  idempotency_key text not null,

  created_by uuid references public.cms_person(person_id),
  created_at timestamptz not null default now()
);
create unique index if not exists idx_cms_ar_service_writeoff_party_idempotency
  on public.cms_ar_service_writeoff_action(party_id, idempotency_key);
create index if not exists idx_cms_ar_service_writeoff_party_occurred
  on public.cms_ar_service_writeoff_action(party_id, occurred_at desc);
alter table public.cms_ar_service_writeoff_action enable row level security;
drop policy if exists cms_select_authenticated on public.cms_ar_service_writeoff_action;
create policy cms_select_authenticated on public.cms_ar_service_writeoff_action
  for select to authenticated using (true);
grant select on public.cms_ar_service_writeoff_action to authenticated;
create table if not exists public.cms_ar_service_writeoff_action_alloc (
  action_alloc_id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.cms_ar_service_writeoff_action(action_id) on delete cascade,

  alloc_id uuid not null references public.cms_ar_payment_alloc(alloc_id) on delete cascade,
  payment_id uuid not null references public.cms_ar_payment(payment_id) on delete cascade,
  ar_id uuid not null references public.cms_ar_invoice(ar_id) on delete cascade,

  alloc_cash_krw numeric not null default 0,
  alloc_labor_krw numeric not null default 0,
  alloc_material_krw numeric not null default 0,
  alloc_gold_g numeric(18,6) not null default 0,
  alloc_silver_g numeric(18,6) not null default 0,

  created_at timestamptz not null default now()
);
create index if not exists idx_cms_ar_service_writeoff_alloc_action
  on public.cms_ar_service_writeoff_action_alloc(action_id);
alter table public.cms_ar_service_writeoff_action_alloc enable row level security;
drop policy if exists cms_select_authenticated on public.cms_ar_service_writeoff_action_alloc;
create policy cms_select_authenticated on public.cms_ar_service_writeoff_action_alloc
  for select to authenticated using (true);
grant select on public.cms_ar_service_writeoff_action_alloc to authenticated;
-- (분석/조회 편의)
create or replace view public.cms_v_ar_service_writeoff_action_v1
with (security_invoker = true)
as
select
  a.action_id,
  a.party_id,
  p.party_type,
  p.name as party_name,
  a.occurred_at,
  a.writeoff_cash_krw,
  a.writeoff_gold_g,
  a.writeoff_silver_g,
  a.reason_detail,
  a.payment_id,
  a.ar_ledger_id,
  a.idempotency_key,
  a.created_by,
  per.name as created_by_name,
  a.created_at
from public.cms_ar_service_writeoff_action a
join public.cms_party p on p.party_id = a.party_id
left join public.cms_person per on per.person_id = a.created_by;
grant select on public.cms_v_ar_service_writeoff_action_v1 to authenticated;
-- ------------------------------------------------------------
-- 2) AR 결제 입력(저울) 추천/정밀표시용 RPC
-- ------------------------------------------------------------
-- 반환 JSON 예시:
-- {
--   ok: true,
--   party_id,
--   as_of,
--   scale_decimals: 2,
--   totals: { labor_cash_outstanding_krw, material_cash_outstanding_krw, total_cash_outstanding_krw },
--   gold:   { outstanding_g, outstanding_value_krw, scale_g, scale_value_krw, tail_g, tail_value_krw },
--   silver: { ... }
-- }

do $$
begin
  if exists (
    select 1 from pg_proc
    where proname = 'cms_fn_ar_get_settlement_recommendation_v1'
      and pg_function_is_visible(oid)
  ) then
    raise exception 'cms_fn_ar_get_settlement_recommendation_v1 already exists';
  end if;
end $$;
create function public.cms_fn_ar_get_settlement_recommendation_v1(
  p_party_id uuid,
  p_scale_decimals int default 2
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_scale int := greatest(0, least(6, coalesce(p_scale_decimals, 2)));

  v_labor_out numeric := 0;
  v_material_out numeric := 0;
  v_total_out numeric := 0;

  v_gold_out_g numeric := 0;
  v_silver_out_g numeric := 0;
  v_gold_out_value numeric := 0;
  v_silver_out_value numeric := 0;

  v_gold_scale_g numeric := 0;
  v_silver_scale_g numeric := 0;

  v_gold_scale_value numeric := 0;
  v_silver_scale_value numeric := 0;

  v_remain numeric;
  v_alloc numeric;
  r record;

  v_eps numeric := 0.0000000001;

begin
  select
    round(coalesce(sum(labor_cash_outstanding_krw), 0), 0),
    round(coalesce(sum(material_cash_outstanding_krw), 0), 0),
    round(coalesce(sum(total_cash_outstanding_krw), 0), 0)
  into v_labor_out, v_material_out, v_total_out
  from public.cms_v_ar_invoice_position_v1
  where party_id = p_party_id;

  select
    round(coalesce(sum(case when commodity_type = 'gold' then commodity_outstanding_g else 0 end), 0), 6),
    round(coalesce(sum(case when commodity_type = 'silver' then commodity_outstanding_g else 0 end), 0), 6),
    round(coalesce(sum(case when commodity_type = 'gold' then commodity_outstanding_g * coalesce(commodity_price_snapshot_krw_per_g, 0) else 0 end), 0), 0),
    round(coalesce(sum(case when commodity_type = 'silver' then commodity_outstanding_g * coalesce(commodity_price_snapshot_krw_per_g, 0) else 0 end), 0), 0)
  into v_gold_out_g, v_silver_out_g, v_gold_out_value, v_silver_out_value
  from public.cms_v_ar_invoice_position_v1
  where party_id = p_party_id;

  v_gold_scale_g := trunc(v_gold_out_g, v_scale);
  v_silver_scale_g := trunc(v_silver_out_g, v_scale);

  -- gold: scale_g를 FIFO로 태웠을 때의 "가치"(=material 차감분) 계산
  v_remain := v_gold_scale_g;
  for r in
    select
      ar_id,
      commodity_outstanding_g,
      coalesce(commodity_price_snapshot_krw_per_g, 0) as price
    from public.cms_v_ar_invoice_position_v1
    where party_id = p_party_id
      and commodity_type = 'gold'
      and commodity_outstanding_g > 0
    order by occurred_at, created_at, ar_id
  loop
    exit when v_remain <= v_eps;
    v_alloc := least(v_remain, r.commodity_outstanding_g);
    v_gold_scale_value := v_gold_scale_value + (v_alloc * r.price);
    v_remain := v_remain - v_alloc;
  end loop;

  -- silver
  v_remain := v_silver_scale_g;
  for r in
    select
      ar_id,
      commodity_outstanding_g,
      coalesce(commodity_price_snapshot_krw_per_g, 0) as price
    from public.cms_v_ar_invoice_position_v1
    where party_id = p_party_id
      and commodity_type = 'silver'
      and commodity_outstanding_g > 0
    order by occurred_at, created_at, ar_id
  loop
    exit when v_remain <= v_eps;
    v_alloc := least(v_remain, r.commodity_outstanding_g);
    v_silver_scale_value := v_silver_scale_value + (v_alloc * r.price);
    v_remain := v_remain - v_alloc;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'party_id', p_party_id,
    'as_of', now(),
    'scale_decimals', v_scale,
    'totals', jsonb_build_object(
      'labor_cash_outstanding_krw', v_labor_out,
      'material_cash_outstanding_krw', v_material_out,
      'total_cash_outstanding_krw', v_total_out
    ),
    'gold', jsonb_build_object(
      'outstanding_g', v_gold_out_g,
      'outstanding_value_krw', v_gold_out_value,
      'scale_g', v_gold_scale_g,
      'scale_value_krw', round(v_gold_scale_value, 0),
      'tail_g', round(v_gold_out_g - v_gold_scale_g, 6),
      'tail_value_krw', round(v_gold_out_value - v_gold_scale_value, 0)
    ),
    'silver', jsonb_build_object(
      'outstanding_g', v_silver_out_g,
      'outstanding_value_krw', v_silver_out_value,
      'scale_g', v_silver_scale_g,
      'scale_value_krw', round(v_silver_scale_value, 0),
      'tail_g', round(v_silver_out_g - v_silver_scale_g, 6),
      'tail_value_krw', round(v_silver_out_value - v_silver_scale_value, 0)
    )
  );
end $$;
grant execute on function public.cms_fn_ar_get_settlement_recommendation_v1(uuid, int) to authenticated;
-- ------------------------------------------------------------
-- 3) 서비스 완불(<=limit) RPC
-- ------------------------------------------------------------
-- 조건: 현재 파티의 "총 미수(현금 등가)" 잔액이 limit 이하일 때만 0으로 만든다.
-- - 총 미수 = cms_v_ar_invoice_position_v1.total_cash_outstanding_krw 합
-- - FIFO 순서로 (1)공임 → (2)소재 순서로 alloc
-- - 소재가 commodity(gold/silver)인 경우: cash alloc과 함께 alloc_gold_g/alloc_silver_g도 같이 기록해서
--   결제 후 AR 화면에서 g가 남지 않게 만든다.

do $$
begin
  if exists (
    select 1 from pg_proc
    where proname = 'cms_fn_ar_apply_service_writeoff_under_limit_v1'
      and pg_function_is_visible(oid)
  ) then
    raise exception 'cms_fn_ar_apply_service_writeoff_under_limit_v1 already exists';
  end if;
end $$;
create function public.cms_fn_ar_apply_service_writeoff_under_limit_v1(
  p_party_id uuid,
  p_idempotency_key text,
  p_limit_krw numeric default 1000,
  p_occurred_at timestamptz default null,
  p_reason_detail text default null,
  p_actor_person_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text := coalesce(nullif(trim(p_idempotency_key), ''), '');
  v_limit numeric := coalesce(p_limit_krw, 1000);
  v_at timestamptz := coalesce(p_occurred_at, now());
  v_actor uuid := coalesce(p_actor_person_id, auth.uid());

  v_action_id uuid := gen_random_uuid();
  v_payment_id uuid := gen_random_uuid();
  v_ar_ledger_id uuid;

  v_req numeric := 0;
  v_remaining numeric := 0;

  v_eps numeric := 0.000001;

  v_applied_cash numeric := 0;
  v_applied_labor numeric := 0;
  v_applied_material numeric := 0;
  v_applied_gold_g numeric := 0;
  v_applied_silver_g numeric := 0;

  v_alloc_id uuid;

  r record;
  v_cash_for_labor numeric;
  v_cash_for_material numeric;
  v_alloc_gold numeric;
  v_alloc_silver numeric;
begin
  if v_key = '' then
    raise exception 'idempotency_key is required';
  end if;

  -- dedupe (action 기준)
  select action_id, payment_id, ar_ledger_id, writeoff_cash_krw
    into r
  from public.cms_ar_service_writeoff_action
  where party_id = p_party_id
    and idempotency_key = v_key;

  if found then
    return jsonb_build_object(
      'ok', true,
      'deduped', true,
      'action_id', r.action_id,
      'payment_id', r.payment_id,
      'ar_ledger_id', r.ar_ledger_id,
      'writeoff_cash_krw', r.writeoff_cash_krw
    );
  end if;

  -- 현재 잔액(현금 등가) 계산
  select round(coalesce(sum(total_cash_outstanding_krw), 0), 0)
    into v_req
  from public.cms_v_ar_invoice_position_v1
  where party_id = p_party_id;

  if v_req <= 0 then
    raise exception 'no outstanding to write off. outstanding=%', v_req;
  end if;

  if v_req > v_limit + 0.5 then
    raise exception 'writeoff limit exceeded. outstanding=% limit=%', v_req, v_limit;
  end if;

  v_remaining := v_req;

  -- payment (실물 수금이 아니라 "서비스 완불"임을 note로 명확히)
  insert into public.cms_ar_payment(
    payment_id, party_id, paid_at,
    cash_krw, gold_g, silver_g,
    note, created_by,
    idempotency_key
  )
  values (
    v_payment_id, p_party_id, v_at,
    v_req, 0, 0,
    '[SERVICE_WRITEOFF<= '||round(v_limit, 0)||'] '||coalesce(p_reason_detail, ''),
    v_actor,
    'SERVICE_WRITEOFF:'||v_key
  );

  insert into public.cms_payment_header(
    payment_id, party_id, paid_at, memo, total_amount_krw
  )
  values (
    v_payment_id, p_party_id, v_at,
    '[SERVICE_WRITEOFF] '||coalesce(p_reason_detail, ''),
    round(v_req, 0)
  )
  on conflict (payment_id) do update
    set total_amount_krw = excluded.total_amount_krw,
        memo = excluded.memo,
        paid_at = excluded.paid_at,
        party_id = excluded.party_id;

  insert into public.cms_ar_ledger(
    party_id, occurred_at, entry_type, amount_krw, payment_id, memo
  )
  values (
    p_party_id, v_at, 'ADJUST', -round(v_req, 0), v_payment_id,
    '[SERVICE_WRITEOFF] action_id='||v_action_id::text||' '||coalesce(p_reason_detail, '')
  )
  returning ar_ledger_id into v_ar_ledger_id;

  -- action header(선기록) → alloc 매핑을 위해 필요
  insert into public.cms_ar_service_writeoff_action(
    action_id, party_id, occurred_at,
    writeoff_cash_krw,
    writeoff_gold_g, writeoff_silver_g,
    reason_detail,
    payment_id, ar_ledger_id,
    idempotency_key,
    created_by
  )
  values (
    v_action_id, p_party_id, v_at,
    round(v_req, 0),
    0, 0,
    p_reason_detail,
    v_payment_id, v_ar_ledger_id,
    v_key,
    v_actor
  );

  -- (1) labor 먼저
  for r in
    select
      ar_id,
      coalesce(labor_cash_outstanding_krw, 0) as labor_out,
      occurred_at,
      created_at
    from public.cms_v_ar_invoice_position_v1
    where party_id = p_party_id
      and coalesce(labor_cash_outstanding_krw, 0) > 0
    order by occurred_at, created_at, ar_id
  loop
    exit when v_remaining <= v_eps;

    v_cash_for_labor := least(v_remaining, r.labor_out);

    if v_cash_for_labor > 0 then
      insert into public.cms_ar_payment_alloc(
        payment_id, ar_id,
        alloc_cash_krw,
        alloc_gold_g, alloc_silver_g,
        alloc_value_krw,
        alloc_labor_krw, alloc_material_krw
      )
      values (
        v_payment_id, r.ar_id,
        v_cash_for_labor,
        0, 0,
        0,
        v_cash_for_labor, 0
      )
      returning alloc_id into v_alloc_id;

      insert into public.cms_ar_service_writeoff_action_alloc(
        action_id, alloc_id, payment_id, ar_id,
        alloc_cash_krw, alloc_labor_krw, alloc_material_krw,
        alloc_gold_g, alloc_silver_g
      )
      values (
        v_action_id, v_alloc_id, v_payment_id, r.ar_id,
        v_cash_for_labor, v_cash_for_labor, 0,
        0, 0
      );

      v_applied_cash := v_applied_cash + v_cash_for_labor;
      v_applied_labor := v_applied_labor + v_cash_for_labor;
      v_remaining := v_remaining - v_cash_for_labor;
    end if;
  end loop;

  -- (2) material
  for r in
    select
      ar_id,
      coalesce(material_cash_outstanding_krw, 0) as material_out,
      commodity_type,
      coalesce(commodity_outstanding_g, 0) as commodity_out_g,
      coalesce(commodity_price_snapshot_krw_per_g, 0) as price,
      occurred_at,
      created_at
    from public.cms_v_ar_invoice_position_v1
    where party_id = p_party_id
      and coalesce(material_cash_outstanding_krw, 0) > 0
    order by occurred_at, created_at, ar_id
  loop
    exit when v_remaining <= v_eps;

    v_cash_for_material := least(v_remaining, r.material_out);

    if v_cash_for_material <= 0 then
      continue;
    end if;

    v_alloc_gold := 0;
    v_alloc_silver := 0;

    -- commodity가 있는 invoice면: cash alloc과 함께 g도 같이 기록 → 결제 후 g가 남지 않게
    if r.commodity_type = 'gold' and r.price > 0 and r.commodity_out_g > 0 then
      if abs(v_cash_for_material - r.material_out) <= 0.5 then
        v_alloc_gold := r.commodity_out_g;
      else
        v_alloc_gold := least(r.commodity_out_g, round(v_cash_for_material / r.price, 6));
      end if;
    elsif r.commodity_type = 'silver' and r.price > 0 and r.commodity_out_g > 0 then
      if abs(v_cash_for_material - r.material_out) <= 0.5 then
        v_alloc_silver := r.commodity_out_g;
      else
        v_alloc_silver := least(r.commodity_out_g, round(v_cash_for_material / r.price, 6));
      end if;
    end if;

    insert into public.cms_ar_payment_alloc(
      payment_id, ar_id,
      alloc_cash_krw,
      alloc_gold_g, alloc_silver_g,
      alloc_value_krw,
      alloc_labor_krw, alloc_material_krw
    )
    values (
      v_payment_id, r.ar_id,
      v_cash_for_material,
      v_alloc_gold, v_alloc_silver,
      0,
      0, v_cash_for_material
    )
    returning alloc_id into v_alloc_id;

    insert into public.cms_ar_service_writeoff_action_alloc(
      action_id, alloc_id, payment_id, ar_id,
      alloc_cash_krw, alloc_labor_krw, alloc_material_krw,
      alloc_gold_g, alloc_silver_g
    )
    values (
      v_action_id, v_alloc_id, v_payment_id, r.ar_id,
      v_cash_for_material, 0, v_cash_for_material,
      v_alloc_gold, v_alloc_silver
    );

    v_applied_cash := v_applied_cash + v_cash_for_material;
    v_applied_material := v_applied_material + v_cash_for_material;
    v_applied_gold_g := v_applied_gold_g + v_alloc_gold;
    v_applied_silver_g := v_applied_silver_g + v_alloc_silver;

    v_remaining := v_remaining - v_cash_for_material;
  end loop;

  if v_remaining > v_eps then
    raise exception 'service_writeoff allocation incomplete. remaining=%', v_remaining;
  end if;

  update public.cms_ar_service_writeoff_action
  set
    writeoff_gold_g = round(v_applied_gold_g, 6),
    writeoff_silver_g = round(v_applied_silver_g, 6)
  where action_id = v_action_id;

  return jsonb_build_object(
    'ok', true,
    'action_id', v_action_id,
    'payment_id', v_payment_id,
    'ar_ledger_id', v_ar_ledger_id,
    'writeoff_cash_krw', round(v_req, 0),
    'applied_cash_krw', round(v_applied_cash, 0),
    'applied_labor_krw', round(v_applied_labor, 0),
    'applied_material_krw', round(v_applied_material, 0),
    'applied_gold_g', round(v_applied_gold_g, 6),
    'applied_silver_g', round(v_applied_silver_g, 6)
  );
end $$;
grant execute on function public.cms_fn_ar_apply_service_writeoff_under_limit_v1(
  uuid, text, numeric, timestamptz, text, uuid
) to authenticated;
commit;
