-- [ADD-ONLY] return_line soft-void + unconfirm v2 handles return/inventory void
-- filename example: 20260208099999_cms_xxxx_unconfirm_void_return.sql

-- 1) return_line에 void 컬럼 추가 (근거는 남기되 효력만 취소용)
alter table if exists public.cms_return_line
  add column if not exists voided_at timestamptz null,
  add column if not exists void_reason text null,
  add column if not exists void_note text null,
  add column if not exists void_actor_person_id uuid null,
  add column if not exists void_correlation_id uuid null;
create index if not exists cms_return_line_active_by_shipment_line_idx
  on public.cms_return_line (shipment_line_id, occurred_at desc)
  where voided_at is null;
-- 2) record_return_v2: remaining_qty 계산 시 voided 제외 (핵심 1줄)
create or replace function public.cms_fn_record_return_v2(
  p_shipment_line_id uuid,
  p_return_qty integer,
  p_reason text,
  p_occurred_at timestamptz default now(),
  p_actor_person_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sl public.cms_shipment_line;
  v_sh public.cms_shipment_header;
  v_returned_before integer;
  v_remaining integer;
  v_auto_amount numeric;
  v_final_amount numeric;
  v_return_line_id uuid;
begin
  select * into v_sl
  from public.cms_shipment_line
  where shipment_line_id = p_shipment_line_id;

  if not found then
    raise exception 'Shipment line not found: %', p_shipment_line_id;
  end if;

  select * into v_sh
  from public.cms_shipment_header
  where shipment_id = v_sl.shipment_id;

  if not found then
    raise exception 'Shipment header not found: %', v_sl.shipment_id;
  end if;

  if v_sh.status <> 'CONFIRMED'::public.cms_e_shipment_status then
    raise exception 'Shipment must be CONFIRMED to return. shipment_id=% status=%', v_sh.shipment_id, v_sh.status;
  end if;

  if p_return_qty is null or p_return_qty <= 0 then
    raise exception 'return_qty must be > 0';
  end if;

  -- ✅ voided_at is null 필터 추가 (중요)
  select coalesce(sum(rl.return_qty), 0)
    into v_returned_before
  from public.cms_return_line rl
  where rl.shipment_line_id = p_shipment_line_id
    and rl.voided_at is null;

  v_remaining := v_sl.qty - v_returned_before;

  if p_return_qty > v_remaining then
    raise exception 'Return qty exceeds remaining. remaining=% requested=%', v_remaining, p_return_qty;
  end if;

  -- 금액 자동계산: "해당 라인 총 미수 * (반품수량/라인수량)"
  v_auto_amount :=
    round(
      coalesce(v_sl.total_cash_due_krw, 0) * (p_return_qty::numeric / nullif(v_sl.qty::numeric, 0)),
      0
    );

  v_final_amount := v_auto_amount;

  insert into public.cms_return_line(
    return_line_id,
    party_id,
    shipment_line_id,
    return_qty,
    auto_return_amount_krw,
    final_return_amount_krw,
    reason,
    occurred_at,
    created_at
  )
  values(
    gen_random_uuid(),
    v_sh.party_id,
    p_shipment_line_id,
    p_return_qty,
    v_auto_amount,
    v_final_amount,
    p_reason,
    p_occurred_at,
    now()
  )
  returning return_line_id into v_return_line_id;

  -- AR 원장에 RETURN 기록
  insert into public.cms_ar_ledger(
    party_id,
    occurred_at,
    entry_type,
    amount_krw,
    shipment_id,
    shipment_line_id,
    payment_id,
    return_line_id,
    memo
  )
  values(
    v_sh.party_id,
    p_occurred_at,
    'RETURN'::public.cms_e_ar_entry_type,
    -v_final_amount,
    v_sh.shipment_id,
    p_shipment_line_id,
    null,
    v_return_line_id,
    p_reason
  );

  return jsonb_build_object(
    'ok', true,
    'remaining_qty', (v_remaining - p_return_qty),
    'return_line_id', v_return_line_id,
    'auto_amount_krw', v_auto_amount,
    'final_amount_krw', v_final_amount
  );
end $$;
alter function public.cms_fn_record_return_v2(uuid, integer, text, timestamptz, uuid) security definer;
grant execute on function public.cms_fn_record_return_v2(uuid, integer, text, timestamptz, uuid) to authenticated;
-- 3) unconfirm v2: 반품 + 재고이동 VOID/무효화까지 같이 처리
create or replace function public.cms_fn_unconfirm_shipment_v2(
  p_shipment_id uuid,
  p_reason text,
  p_correlation_id uuid default gen_random_uuid(),
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sh public.cms_shipment_header;
  v_reason text := coalesce(nullif(p_reason,''), 'unconfirm');
  v_void_ship_moves int := 0;
  v_void_return_moves int := 0;
  v_void_return_lines int := 0;
  v_deleted_invoices int := 0;
  v_deleted_allocs int := 0;
  v_move_id uuid;
  v_return_line_id uuid;
begin
  select * into v_sh
  from public.cms_shipment_header
  where shipment_id = p_shipment_id;

  if not found then
    raise exception 'Shipment not found: %', p_shipment_id;
  end if;

  if v_sh.status <> 'CONFIRMED'::public.cms_e_shipment_status then
    raise exception 'Shipment must be CONFIRMED to unconfirm. shipment_id=% status=%', p_shipment_id, v_sh.status;
  end if;

  -- (A) 출고(Shipment)로 생성된 재고이동 VOID
  for v_move_id in
    select mh.move_id
    from public.cms_inventory_move_header mh
    where mh.ref_doc_type = 'SHIPMENT'
      and mh.ref_doc_id = p_shipment_id
      and mh.voided_at is null
  loop
    perform public.cms_fn_void_inventory_move_v1(
      v_move_id,
      null,
      'unconfirm_shipment',
      p_note,
      p_correlation_id
    );
    v_void_ship_moves := v_void_ship_moves + 1;
  end loop;

  -- (B) 이 shipment에 딸린 return_line들: (1) return 재고이동 VOID (2) return_line void 처리
  for v_return_line_id in
    select rl.return_line_id
    from public.cms_return_line rl
    join public.cms_shipment_line sl on sl.shipment_line_id = rl.shipment_line_id
    where sl.shipment_id = p_shipment_id
      and rl.voided_at is null
  loop
    -- (B-1) 반품(RETURN_LINE)로 생성된 재고이동 VOID
    for v_move_id in
      select mh.move_id
      from public.cms_inventory_move_header mh
      where mh.ref_doc_type = 'RETURN_LINE'
        and mh.ref_doc_id = v_return_line_id
        and mh.voided_at is null
    loop
      perform public.cms_fn_void_inventory_move_v1(
        v_move_id,
        null,
        'unconfirm_shipment_return',
        p_note,
        p_correlation_id
      );
      v_void_return_moves := v_void_return_moves + 1;
    end loop;

    -- (B-2) return_line 무효화(근거는 남김)
    update public.cms_return_line
      set voided_at = now(),
          void_reason = v_reason,
          void_note = p_note,
          void_actor_person_id = null,
          void_correlation_id = p_correlation_id
    where return_line_id = v_return_line_id;

    v_void_return_lines := v_void_return_lines + 1;

    -- (B-3) AR balance(ledger)에서 RETURN 효력 취소: ADJUST로 상쇄(근거 유지)
    insert into public.cms_ar_ledger(
      party_id, occurred_at, entry_type, amount_krw,
      shipment_id, shipment_line_id, payment_id, return_line_id, memo
    )
    select
      l.party_id,
      now(),
      'ADJUST'::public.cms_e_ar_entry_type,
      (-1) * l.amount_krw, -- RETURN은 음수 -> 양수로 상쇄
      l.shipment_id,
      l.shipment_line_id,
      null,
      l.return_line_id,
      v_reason || ' (VOID_RETURN via unconfirm)'
    from public.cms_ar_ledger l
    where l.return_line_id = v_return_line_id
      and l.entry_type = 'RETURN'::public.cms_e_ar_entry_type
    order by l.created_at desc
    limit 1;
  end loop;

  -- (C) AR balance(ledger)에서 SHIPMENT 효력 취소: ADJUST로 상쇄(근거 유지)
  insert into public.cms_ar_ledger(
    party_id, occurred_at, entry_type, amount_krw,
    shipment_id, shipment_line_id, payment_id, return_line_id, memo
  )
  select
    l.party_id,
    now(),
    'ADJUST'::public.cms_e_ar_entry_type,
    (-1) * l.amount_krw, -- SHIPMENT은 양수 -> 음수로 상쇄
    l.shipment_id,
    null,
    null,
    null,
    v_reason || ' (VOID_SHIPMENT via unconfirm)'
  from public.cms_ar_ledger l
  where l.shipment_id = p_shipment_id
    and l.entry_type = 'SHIPMENT'::public.cms_e_ar_entry_type
  order by l.created_at desc
  limit 1;

  -- (D) invoice/alloc은 재확정 재생성을 위해 제거 (근거는 ledger/return_line/move로 남음)
  with inv as (
    select ai.ar_id
    from public.cms_ar_invoice ai
    where ai.shipment_id = p_shipment_id
  ),
  del_alloc as (
    delete from public.cms_ar_payment_alloc pa
    using inv
    where pa.ar_id = inv.ar_id
    returning 1
  ),
  del_inv as (
    delete from public.cms_ar_invoice ai
    where ai.shipment_id = p_shipment_id
    returning 1
  )
  select
    (select count(*) from del_alloc),
    (select count(*) from del_inv)
  into v_deleted_allocs, v_deleted_invoices;

  -- (E) valuation 제거
  delete from public.cms_shipment_valuation sv
  where sv.shipment_id = p_shipment_id;

  -- (F) shipment_line reset
  update public.cms_shipment_line
  set gold_tick_id = null,
      silver_tick_id = null,
      gold_tick_krw_per_g = null,
      silver_tick_krw_per_g = null,
      silver_adjust_factor = 1.2,
      is_priced_final = false,
      updated_at = now()
  where shipment_id = p_shipment_id;

  -- (G) header reset
  update public.cms_shipment_header
  set status = 'DRAFT'::public.cms_e_shipment_status,
      confirmed_at = null,
      updated_at = now()
  where shipment_id = p_shipment_id;

  -- (H) repair_line 상태 재계산(기존 v1 로직 유지)
  update public.cms_repair_line r
  set status = 'READY_TO_SHIP'::public.cms_e_repair_status
  where r.repair_line_id in (
    select sl.repair_line_id
    from public.cms_shipment_line sl
    where sl.shipment_id = p_shipment_id
      and sl.repair_line_id is not null
  )
    and r.status <> 'CANCELLED'::public.cms_e_repair_status
    and not exists (
      select 1
      from public.cms_shipment_line sl2
      join public.cms_shipment_header sh2 on sh2.shipment_id = sl2.shipment_id
      where sh2.status = 'CONFIRMED'::public.cms_e_shipment_status
        and sl2.repair_line_id = r.repair_line_id
    );

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'status', 'DRAFT',
    'reason', v_reason,
    'void_ship_moves', v_void_ship_moves,
    'void_return_moves', v_void_return_moves,
    'void_return_lines', v_void_return_lines,
    'deleted_invoices', v_deleted_invoices,
    'deleted_allocs', v_deleted_allocs
  );
end $$;
alter function public.cms_fn_unconfirm_shipment_v2(uuid, text, uuid, text) security definer;
grant execute on function public.cms_fn_unconfirm_shipment_v2(uuid, text, uuid, text) to authenticated;
