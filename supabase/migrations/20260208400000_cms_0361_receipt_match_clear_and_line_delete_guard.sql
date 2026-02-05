-- 20260208391000_cms_0361_receipt_match_clear_and_delete_guard.sql
-- 목적:
-- 1) receipt_line_match CONFIRMED 상태를 안전하게 되돌리는 RPC 추가 (shipment DRAFT일 때만)
-- 2) receipt line 삭제 RPC에 "매칭/다운스트림 존재 시 삭제 금지" 가드 복구(재귀 없이)
-- 3) (안전장치) upsert_receipt_pricing_snapshot_v2: line_items=NULL로 덮어쓰기 방지

set search_path = public, pg_temp;

-- =========================================================
-- 0) audit columns for match clear (ADD-ONLY)
-- =========================================================
alter table public.cms_receipt_line_match
  add column if not exists cleared_at timestamptz,
  add column if not exists cleared_by uuid references public.cms_person(person_id),
  add column if not exists cleared_reason text;

-- =========================================================
-- 1) RPC: match clear (CONFIRMED -> CLEARED)
-- =========================================================
create or replace function public.cms_fn_receipt_line_match_clear_v1(
  p_receipt_id uuid,
  p_receipt_line_uuid uuid,
  p_reason text default null,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := coalesce(p_actor_person_id, auth.uid());
  v_corr uuid := coalesce(p_correlation_id, gen_random_uuid());

  v_match record;
  v_ship record;
  v_sl record;

  v_ship_line_cnt int := 0;
  v_shipment_cancelled boolean := false;
  v_receipt_status_reverted boolean := false;
  v_order_reverted boolean := false;

  v_prev_confirmed_at timestamptz;

  v_order_status public.cms_e_order_status;
  v_order_inbound_at timestamptz;
begin
  if p_receipt_id is null then
    raise exception using errcode='P0001', message='receipt_id required';
  end if;
  if p_receipt_line_uuid is null then
    raise exception using errcode='P0001', message='receipt_line_uuid required';
  end if;

  -- lock confirmed match row (1 per receipt_line enforced by unique index)
  select *
    into v_match
  from public.cms_receipt_line_match m
  where m.receipt_id = p_receipt_id
    and m.receipt_line_uuid = p_receipt_line_uuid
    and m.status = 'CONFIRMED'::public.cms_e_receipt_line_match_status
  order by m.confirmed_at desc nulls last
  limit 1
  for update;

  if not found then
    return jsonb_build_object(
      'ok', true,
      'already_cleared', true,
      'receipt_id', p_receipt_id,
      'receipt_line_uuid', p_receipt_line_uuid
    );
  end if;

  v_prev_confirmed_at := v_match.confirmed_at;

  -- If shipment link missing, still clear match safely.
  if v_match.shipment_id is not null then
    select * into v_ship
    from public.cms_shipment_header sh
    where sh.shipment_id = v_match.shipment_id
    for update;

    if found then
      if v_ship.status <> 'DRAFT'::public.cms_e_shipment_status then
        raise exception using errcode='P0001',
          message = format('cannot clear: shipment not DRAFT (status=%s)', v_ship.status);
      end if;
    end if;
  end if;

  if v_match.shipment_line_id is not null then
    select * into v_sl
    from public.cms_shipment_line sl
    where sl.shipment_line_id = v_match.shipment_line_id
    for update;

    if found then
      -- sanity: must still be linked to this receipt/line
      if v_sl.purchase_receipt_id is distinct from p_receipt_id
         or v_sl.purchase_receipt_line_uuid is distinct from p_receipt_line_uuid then
        raise exception using errcode='P0001',
          message='cannot clear: shipment_line receipt link mismatch (manual review required)';
      end if;

      -- downstream guard: purchase cost already ACTUAL
      if v_sl.purchase_cost_status = 'ACTUAL'::public.cms_e_cost_status then
        raise exception using errcode='P0001',
          message='cannot clear: purchase_cost_status already ACTUAL';
      end if;
    end if;
  end if;

  -- downstream guard: AR ledger exists?
  if to_regclass('public.cms_ar_ledger') is not null then
    if exists (
      select 1
      from public.cms_ar_ledger ar
      where (v_match.shipment_id is not null and ar.shipment_id = v_match.shipment_id)
         or (v_match.shipment_line_id is not null and ar.shipment_line_id = v_match.shipment_line_id)
      limit 1
    ) then
      raise exception using errcode='P0001', message='cannot clear: AR ledger exists';
    end if;
  end if;

  -- downstream guard: inventory ISSUE exists?
  if to_regclass('public.cms_inventory_move_header') is not null then
    if v_match.shipment_id is not null and exists (
      select 1
      from public.cms_inventory_move_header h
      where h.ref_doc_type = 'SHIPMENT'
        and h.ref_doc_id = v_match.shipment_id
        and h.move_type = 'ISSUE'::public.cms_e_inventory_move_type
        and h.status <> 'VOID'::public.cms_e_inventory_move_status
      limit 1
    ) then
      raise exception using errcode='P0001', message='cannot clear: inventory ISSUE move exists';
    end if;
  end if;

  if to_regclass('public.cms_inventory_move_line') is not null and to_regclass('public.cms_inventory_move_header') is not null then
    if v_match.shipment_line_id is not null and exists (
      select 1
      from public.cms_inventory_move_line ml
      join public.cms_inventory_move_header mh on mh.move_id = ml.move_id
      where ml.ref_entity_type = 'SHIPMENT_LINE'
        and ml.ref_entity_id = v_match.shipment_line_id
        and ml.is_void = false
        and mh.status <> 'VOID'::public.cms_e_inventory_move_status
      limit 1
    ) then
      raise exception using errcode='P0001', message='cannot clear: inventory move line exists';
    end if;
  end if;

  -- downstream guard: vendor bill allocation exists?
  if to_regclass('public.cms_vendor_bill_allocation') is not null then
    if exists (
      select 1
      from public.cms_vendor_bill_allocation a
      where a.bill_id = p_receipt_id
         or (v_match.shipment_id is not null and a.shipment_id = v_match.shipment_id)
      limit 1
    ) then
      raise exception using errcode='P0001', message='cannot clear: vendor_bill_allocation exists';
    end if;
  end if;

  -- downstream guard: AP2 alloc exists?
  if to_regclass('public.cms_ap_invoice') is not null and to_regclass('public.cms_ap_alloc') is not null then
    if exists (
      select 1
      from public.cms_ap_invoice i
      join public.cms_ap_alloc a on a.ap_id = i.ap_id
      where i.receipt_id = p_receipt_id
      limit 1
    ) then
      raise exception using errcode='P0001', message='cannot clear: AP alloc exists';
    end if;
  end if;

  -- downstream guard: legacy ap_ledger has non-BILL entries for this receipt?
  if to_regclass('public.cms_ap_ledger') is not null and to_regclass('public.cms_e_ap_entry_type') is not null then
    if exists (
      select 1
      from public.cms_ap_ledger l
      where l.receipt_id = p_receipt_id
        and l.entry_type <> 'BILL'::public.cms_e_ap_entry_type
      limit 1
    ) then
      raise exception using errcode='P0001', message='cannot clear: legacy AP ledger already progressed';
    end if;
  end if;

  -- 1) clear confirmed match
  update public.cms_receipt_line_match m
     set status = 'CLEARED'::public.cms_e_receipt_line_match_status,
         cleared_at = now(),
         cleared_by = v_actor,
         cleared_reason = nullif(trim(p_reason),''),
         shipment_id = null,
         shipment_line_id = null,
         note = trim(both from coalesce(m.note,'') ||
                case when coalesce(m.note,'')='' then '' else E'\n' end ||
                '[MATCH_CLEARED] '||coalesce(nullif(trim(p_reason),''),'(no reason)')||
                case when p_note is null or trim(p_note)='' then '' else ' / '||trim(p_note) end),
         updated_at = now()
   where m.receipt_id = p_receipt_id
     and m.receipt_line_uuid = p_receipt_line_uuid
     and m.order_line_id = v_match.order_line_id;

  -- 2) reopen rejected suggestions for this receipt line (UX: 바로 다시 추천/확정 가능)
  update public.cms_receipt_line_match
     set status = 'SUGGESTED'::public.cms_e_receipt_line_match_status,
         updated_at = now()
   where receipt_id = p_receipt_id
     and receipt_line_uuid = p_receipt_line_uuid
     and status = 'REJECTED'::public.cms_e_receipt_line_match_status;

  -- 3) unlink receipt_usage (shipment header/line)
  delete from public.cms_receipt_usage u
   where u.receipt_id = p_receipt_id
     and (
       (u.entity_type = 'SHIPMENT_HEADER' and v_match.shipment_id is not null and u.entity_id = v_match.shipment_id)
       or
       (u.entity_type = 'SHIPMENT_LINE' and v_match.shipment_line_id is not null and u.entity_id = v_match.shipment_line_id)
     );

  -- 4) delete shipment line (draft only) + cancel empty shipment
  if v_match.shipment_line_id is not null then
    delete from public.cms_shipment_line
     where shipment_line_id = v_match.shipment_line_id;
  end if;

  if v_match.shipment_id is not null then
    select count(*) into v_ship_line_cnt
    from public.cms_shipment_line
    where shipment_id = v_match.shipment_id;

    if v_ship_line_cnt = 0 then
      update public.cms_shipment_header
         set status = 'CANCELLED'::public.cms_e_shipment_status,
             memo = trim(both from coalesce(memo,'') ||
                    case when coalesce(memo,'')='' then '' else E'\n' end ||
                    '[AUTO_CANCEL_BY_MATCH_CLEAR] '||coalesce(nullif(trim(p_reason),''),'(no reason)')),
             updated_at = now()
       where shipment_id = v_match.shipment_id
         and status = 'DRAFT'::public.cms_e_shipment_status;

      v_shipment_cancelled := true;
    end if;
  end if;

  -- 5) receipt inbox status rollback (no more usage => UPLOADED)
  if not exists (select 1 from public.cms_receipt_usage u where u.receipt_id = p_receipt_id limit 1) then
    update public.cms_receipt_inbox
       set status = 'UPLOADED'::public.cms_e_receipt_status,
           updated_at = now()
     where receipt_id = p_receipt_id
       and status = 'LINKED'::public.cms_e_receipt_status;

    v_receipt_status_reverted := true;
  end if;

  -- 6) (conservative) revert order_line READY_TO_SHIP only when it was very likely set by this confirm
  select ol.status, ol.inbound_at
    into v_order_status, v_order_inbound_at
  from public.cms_order_line ol
  where ol.order_line_id = v_match.order_line_id
  for update;

  if v_order_status = 'READY_TO_SHIP'::public.cms_e_order_status
     and v_order_inbound_at is not null
     and v_prev_confirmed_at is not null
     and abs(extract(epoch from (v_order_inbound_at - v_prev_confirmed_at))) < 120
     and not exists (
       select 1
       from public.cms_shipment_line sl2
       join public.cms_shipment_header sh2 on sh2.shipment_id = sl2.shipment_id
       where sl2.order_line_id = v_match.order_line_id
         and sh2.status <> 'CANCELLED'::public.cms_e_shipment_status
       limit 1
     )
     and not exists (
       select 1
       from public.cms_receipt_line_match m2
       where m2.order_line_id = v_match.order_line_id
         and m2.status = 'CONFIRMED'::public.cms_e_receipt_line_match_status
       limit 1
     )
  then
    update public.cms_order_line
       set status = 'WAITING_INBOUND'::public.cms_e_order_status,
           inbound_at = null,
           updated_at = now()
     where order_line_id = v_match.order_line_id;

    v_order_reverted := true;
  end if;

  return jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'receipt_line_uuid', p_receipt_line_uuid,
    'shipment_id', v_match.shipment_id,
    'shipment_line_id', v_match.shipment_line_id,
    'shipment_cancelled', v_shipment_cancelled,
    'receipt_status_reverted', v_receipt_status_reverted,
    'order_reverted', v_order_reverted,
    'correlation_id', v_corr
  );
end $$;

alter function public.cms_fn_receipt_line_match_clear_v1(uuid,uuid,text,uuid,text,uuid)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_receipt_line_match_clear_v1(uuid,uuid,text,uuid,text,uuid)
to authenticated, service_role;

-- =========================================================
-- 2) receipt line delete: core + wrapper (재귀 없이 가드)
-- =========================================================

-- 2-1) core (현재 v1 본문을 그대로 유지)
create or replace function public.cms_fn_receipt_line_delete_core_v1(
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

-- 2-2) wrapper: "매칭/다운스트림 존재 시 삭제 금지" 가드 후 core 호출
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
begin
  if p_receipt_id is null then
    raise exception using errcode='P0001', message='receipt_id required';
  end if;
  if p_line_uuid is null then
    raise exception using errcode='P0001', message='line_uuid required';
  end if;

  -- Guard 1) 매칭 확정된 라인은 삭제 불가 (먼저 match_clear)
  if exists (
    select 1
    from public.cms_receipt_line_match m
    where m.receipt_id = p_receipt_id
      and m.receipt_line_uuid = p_line_uuid
      and m.status = 'CONFIRMED'::public.cms_e_receipt_line_match_status
    limit 1
  ) then
    raise exception using errcode='P0001',
      message='cannot delete: receipt line is MATCH_CONFIRMED (clear match first)';
  end if;

  -- Guard 2) 출고확정된 shipment에 연결된 라인은 삭제 불가
  if exists (
    select 1
    from public.cms_shipment_line sl
    join public.cms_shipment_header sh on sh.shipment_id = sl.shipment_id
    where sl.purchase_receipt_id = p_receipt_id
      and sl.purchase_receipt_line_uuid = p_line_uuid
      and sh.status = 'CONFIRMED'::public.cms_e_shipment_status
    limit 1
  ) then
    raise exception using errcode='P0001',
      message='cannot delete: linked shipment already CONFIRMED';
  end if;

  -- Guard 3) vendor_bill_allocation 이미 있으면(원가 배분) 삭제 금지
  if to_regclass('public.cms_vendor_bill_allocation') is not null then
    if exists (
      select 1
      from public.cms_vendor_bill_allocation a
      where a.bill_id = p_receipt_id
      limit 1
    ) then
      raise exception using errcode='P0001',
        message='cannot delete: vendor_bill_allocation exists';
    end if;
  end if;

  -- Guard 4) AP2 alloc 이미 있으면 삭제 금지
  if to_regclass('public.cms_ap_invoice') is not null and to_regclass('public.cms_ap_alloc') is not null then
    if exists (
      select 1
      from public.cms_ap_invoice i
      join public.cms_ap_alloc a on a.ap_id = i.ap_id
      where i.receipt_id = p_receipt_id
      limit 1
    ) then
      raise exception using errcode='P0001',
        message='cannot delete: AP alloc exists';
    end if;
  end if;

  -- Guard 5) legacy ap_ledger가 BILL 외로 진행된 경우 삭제 금지
  if to_regclass('public.cms_ap_ledger') is not null and to_regclass('public.cms_e_ap_entry_type') is not null then
    if exists (
      select 1
      from public.cms_ap_ledger l
      where l.receipt_id = p_receipt_id
        and l.entry_type <> 'BILL'::public.cms_e_ap_entry_type
      limit 1
    ) then
      raise exception using errcode='P0001',
        message='cannot delete: legacy AP ledger already progressed';
    end if;
  end if;

  return public.cms_fn_receipt_line_delete_core_v1(
    p_receipt_id,
    p_line_uuid,
    p_reason,
    p_actor_person_id,
    p_note,
    p_correlation_id
  );
end $$;

alter function public.cms_fn_receipt_line_delete_core_v1(uuid,uuid,text,uuid,text,uuid)
  security definer
  set search_path = public, pg_temp;

alter function public.cms_fn_receipt_line_delete_v1(uuid,uuid,text,uuid,text,uuid)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_receipt_line_delete_v1(uuid,uuid,text,uuid,text,uuid)
to authenticated, service_role;

-- =========================================================
-- 3) Safety patch: prevent line_items NULL overwrite in upsert v2
-- =========================================================
create or replace function public.cms_fn_upsert_receipt_pricing_snapshot_v2(
  p_receipt_id uuid,
  p_currency_code text default null,
  p_total_amount numeric default null,
  p_weight_g numeric default null,
  p_labor_basic numeric default null,
  p_labor_other numeric default null,
  p_line_items jsonb default null,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_currency text;
  v_total_krw numeric;
  v_fx_rate numeric;
  v_fx_tick_id uuid;
  v_fx_observed_at timestamptz;
  v_fx_field text;
  v_meta jsonb := '{}'::jsonb;
  v_exists int;
begin
  if p_receipt_id is null then
    raise exception using errcode='P0001', message='receipt_id required';
  end if;

  select 1 into v_exists from public.cms_receipt_inbox r where r.receipt_id = p_receipt_id;
  if v_exists is null then
    raise exception using errcode='P0001', message='receipt not found';
  end if;

  -- currency: prefer explicit param, else receipt_inbox.currency_code, else KRW
  select upper(coalesce(nullif(trim(p_currency_code),''), r.currency_code, 'KRW'))
    into v_currency
  from public.cms_receipt_inbox r
  where r.receipt_id = p_receipt_id;

  if v_currency not in ('KRW','CNY') then
    raise exception using errcode='P0001', message='currency_code must be KRW or CNY';
  end if;

  if p_total_amount is not null and p_total_amount < 0 then
    raise exception using errcode='P0001', message='total_amount must be >= 0';
  end if;

  if v_currency = 'KRW' then
    v_total_krw := p_total_amount;
    v_fx_rate := null;
    v_fx_tick_id := null;
    v_fx_observed_at := null;
    v_fx_field := null;
  else
    -- fx from latest SILVER_CN_KRW_PER_G meta: { krw_per_1_adj | krw_per_1_raw }
    select t.tick_id,
           nullif((t.meta->>'krw_per_1_adj')::text,'')::numeric,
           t.observed_at
      into v_fx_tick_id, v_fx_rate, v_fx_observed_at
    from public.cms_market_tick t
    where t.symbol = 'SILVER_CN_KRW_PER_G'::public.cms_e_market_symbol
    order by t.observed_at desc
    limit 1;

    v_fx_field := 'krw_per_1_adj';

    if v_fx_rate is null then
      select nullif((t.meta->>'krw_per_1_raw')::text,'')::numeric
        into v_fx_rate
      from public.cms_market_tick t
      where t.tick_id = v_fx_tick_id;
      v_fx_field := 'krw_per_1_raw';
    end if;

    if v_fx_rate is null then
      raise exception using errcode='P0001', message='FX not available: market tick SILVER_CN_KRW_PER_G missing krw_per_1_adj/raw';
    end if;

    v_total_krw := case when p_total_amount is null then null else round(p_total_amount * v_fx_rate, 0) end;

    v_meta := jsonb_strip_nulls(jsonb_build_object(
      'fx_symbol', 'SILVER_CN_KRW_PER_G',
      'fx_tick_id', v_fx_tick_id,
      'fx_observed_at', v_fx_observed_at,
      'fx_field', v_fx_field,
      'fx_rate_krw_per_1', v_fx_rate,
      'correlation_id', p_correlation_id,
      'note', p_note
    ));
  end if;

  insert into public.cms_receipt_pricing_snapshot(
    receipt_id, currency_code, total_amount, weight_g, labor_basic, labor_other,
    total_amount_krw, fx_rate_krw_per_unit, fx_tick_id, meta, line_items
  ) values (
    p_receipt_id, v_currency, p_total_amount, p_weight_g, p_labor_basic, p_labor_other,
    v_total_krw, v_fx_rate, v_fx_tick_id, coalesce(v_meta,'{}'::jsonb), p_line_items
  )
  on conflict (receipt_id) do update set
    currency_code = excluded.currency_code,
    total_amount = excluded.total_amount,
    weight_g = excluded.weight_g,
    labor_basic = excluded.labor_basic,
    labor_other = excluded.labor_other,
    total_amount_krw = excluded.total_amount_krw,
    fx_rate_krw_per_unit = excluded.fx_rate_krw_per_unit,
    fx_tick_id = excluded.fx_tick_id,
    meta = coalesce(public.cms_receipt_pricing_snapshot.meta,'{}'::jsonb) || coalesce(excluded.meta,'{}'::jsonb),
    -- 핵심: p_line_items=NULL이면 기존 값을 유지(실수로 라인 통째로 날리는 장애 방지)
    line_items = coalesce(excluded.line_items, public.cms_receipt_pricing_snapshot.line_items),
    updated_at = now();

  return jsonb_strip_nulls(jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'currency_code', v_currency,
    'total_amount', p_total_amount,
    'total_amount_krw', v_total_krw,
    'fx_tick_id', v_fx_tick_id,
    'fx_rate_krw_per_unit', v_fx_rate
  ));
end $$;

grant execute on function public.cms_fn_upsert_receipt_pricing_snapshot_v2(uuid,text,numeric,numeric,numeric,numeric,jsonb,uuid,text,uuid)
  to anon, authenticated, service_role;
