-- 1) 라인 삭제 이벤트 로그 테이블
create table if not exists public.cms_receipt_line_event (
  event_id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null,
  line_uuid uuid not null,
  event_type text not null check (event_type in ('DELETE')),
  reason text null,
  note text null,
  line_item_before jsonb null,
  created_at timestamptz not null default now(),
  created_by uuid null,
  correlation_id uuid not null
);
create index if not exists cms_receipt_line_event_receipt_idx
  on public.cms_receipt_line_event (receipt_id, created_at desc);
-- 2) 라인 삭제 + snapshot 재저장 + AP 재동기화 RPC
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
  v_line_items jsonb;
  v_deleted jsonb;
  v_new_items jsonb;

  v_total_amount numeric := 0;
  v_weight_g numeric := 0;
  v_labor_basic numeric := 0;
  v_labor_other numeric := 0;

  v_actor uuid := coalesce(p_actor_person_id, auth.uid());
  v_upsert jsonb;
  v_ap jsonb;
begin
  if p_receipt_id is null then
    raise exception using errcode='P0001', message='receipt_id required';
  end if;
  if p_line_uuid is null then
    raise exception using errcode='P0001', message='line_uuid required';
  end if;

  -- snapshot 존재/잠금
  select s.line_items
    into v_line_items
  from public.cms_receipt_pricing_snapshot s
  where s.receipt_id = p_receipt_id
  for update;

  if v_line_items is null then
    raise exception using errcode='P0001', message='no pricing snapshot yet (save lines first)';
  end if;

  -- 삭제 대상 라인 찾기
  select li
    into v_deleted
  from jsonb_array_elements(coalesce(v_line_items,'[]'::jsonb)) li
  where coalesce(li->>'line_uuid','') = p_line_uuid::text
  limit 1;

  -- 이미 없으면(= 이미 삭제됨) idempotent 처리
  if v_deleted is null then
    return jsonb_build_object(
      'ok', true,
      'already_deleted', true,
      'receipt_id', p_receipt_id,
      'line_uuid', p_line_uuid
    );
  end if;

  -- 새 line_items 만들기(삭제 라인 제외)
  with kept as (
    select li
    from jsonb_array_elements(coalesce(v_line_items,'[]'::jsonb)) li
    where coalesce(li->>'line_uuid','') <> p_line_uuid::text
  )
  select coalesce(jsonb_agg(li), '[]'::jsonb)
    into v_new_items
  from kept;

  -- totals 재계산(프론트 로직과 동일: qty 곱)
  with kept as (
    select li
    from jsonb_array_elements(v_new_items) li
  ),
  x as (
    select
      coalesce((li->>'qty')::numeric, 1) as qty,
      coalesce((li->>'weight_g')::numeric, 0) as weight_g_unit,
      coalesce((li->>'labor_basic_cost_krw')::numeric, 0) as labor_basic_unit,
      coalesce((li->>'labor_other_cost_krw')::numeric, 0) as labor_other_unit,
      coalesce(
        (li->>'total_amount_krw')::numeric,
        coalesce((li->>'labor_basic_cost_krw')::numeric,0) + coalesce((li->>'labor_other_cost_krw')::numeric,0)
      ) as total_unit
    from kept
  )
  select
    coalesce(sum(total_unit * qty), 0),
    coalesce(sum(weight_g_unit * qty), 0),
    coalesce(sum(labor_basic_unit * qty), 0),
    coalesce(sum(labor_other_unit * qty), 0)
  into v_total_amount, v_weight_g, v_labor_basic, v_labor_other
  from x;

  -- 삭제 이벤트 로그
  insert into public.cms_receipt_line_event(
    receipt_id, line_uuid, event_type, reason, note, line_item_before,
    created_by, correlation_id
  ) values (
    p_receipt_id, p_line_uuid, 'DELETE',
    nullif(trim(p_reason),''), nullif(trim(p_note),''),
    v_deleted,
    v_actor,
    p_correlation_id
  );

  -- pricing snapshot 업데이트(기존 v2 upsert 재사용)
  v_upsert := public.cms_fn_upsert_receipt_pricing_snapshot_v2(
    p_receipt_id,
    'KRW',
    v_total_amount,
    v_weight_g,
    v_labor_basic,
    v_labor_other,
    v_new_items,
    v_actor,
    ('line_delete:'||p_line_uuid::text||' reason='||coalesce(nullif(trim(p_reason),''),'(none)')),
    p_correlation_id
  );

  -- AP 재동기화(중요)
  v_ap := public.cms_fn_ensure_ap_from_receipt_v1(
    p_receipt_id,
    v_actor,
    ('line_delete:'||p_line_uuid::text||' reason='||coalesce(nullif(trim(p_reason),''),'(none)')),
    p_correlation_id
  );

  return jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'line_uuid', p_line_uuid,
    'snapshot', v_upsert,
    'ap', v_ap
  );
end $$;
grant execute on function public.cms_fn_receipt_line_delete_v1(uuid,uuid,text,uuid,text,uuid)
to authenticated, service_role;
