-- 20260206021000_cms_0353b_fix_receipt_line_delete_v1.sql
-- ADD-ONLY: fix receipt line delete RPC (ensure_ap signature, CTE syntax, weight calc)

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
  v_corr uuid := coalesce(p_correlation_id, gen_random_uuid());
  v_ap_note text;

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

  -- 이미 없으면 idempotent
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

  -- totals 재계산 (qty 곱)
  with kept as (
    select li
    from jsonb_array_elements(coalesce(v_new_items,'[]'::jsonb)) li
  ),
  x as (
    select
      coalesce(nullif(li->>'qty','')::numeric, 1) as qty,

      -- weight_g 우선, 없으면 (raw - deduct) fallback (0 미만 방지)
      coalesce(
        nullif(li->>'weight_g','')::numeric,
        greatest(
          coalesce(nullif(li->>'weight_raw_g','')::numeric, 0)
          - coalesce(nullif(li->>'weight_deduct_g','')::numeric, 0),
          0
        ),
        0
      ) as weight_g_unit,

      coalesce(nullif(li->>'labor_basic_cost_krw','')::numeric, 0) as labor_basic_unit,
      coalesce(nullif(li->>'labor_other_cost_krw','')::numeric, 0) as labor_other_unit,

      -- total_amount_krw 우선, 없으면 labor 합
      coalesce(
        nullif(li->>'total_amount_krw','')::numeric,
        coalesce(nullif(li->>'labor_basic_cost_krw','')::numeric,0)
        + coalesce(nullif(li->>'labor_other_cost_krw','')::numeric,0)
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

  v_ap_note :=
    'line_delete:'||p_line_uuid::text
    ||' reason='||coalesce(nullif(trim(p_reason),''),'(none)')
    ||case when p_note is not null and nullif(trim(p_note),'') is not null
           then ' note='||trim(p_note)
           else ''
      end;

  -- 삭제 이벤트 로그 (테이블은 0353에서 생성돼 있어야 함)
  insert into public.cms_receipt_line_event(
    receipt_id, line_uuid, event_type, reason, note, line_item_before,
    created_by, correlation_id
  ) values (
    p_receipt_id, p_line_uuid, 'DELETE',
    nullif(trim(p_reason),''), nullif(trim(p_note),''),
    v_deleted,
    v_actor,
    v_corr
  );

  -- pricing snapshot 업데이트(v2 upsert 재사용)
  v_upsert := public.cms_fn_upsert_receipt_pricing_snapshot_v2(
    p_receipt_id,
    'KRW',
    v_total_amount,
    v_weight_g,
    v_labor_basic,
    v_labor_other,
    v_new_items,
    v_actor,
    v_ap_note,
    v_corr
  );

  -- AP 재동기화(중요): ensure_ap는 (uuid, text) 2개 인자
  v_ap := public.cms_fn_ensure_ap_from_receipt_v1(
    p_receipt_id,
    v_ap_note
  );

  return jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'line_uuid', p_line_uuid,
    'snapshot', v_upsert,
    'ap', v_ap
  );
end $$;

alter function public.cms_fn_receipt_line_delete_v1(uuid,uuid,text,uuid,text,uuid)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_receipt_line_delete_v1(uuid,uuid,text,uuid,text,uuid)
to authenticated, service_role;
