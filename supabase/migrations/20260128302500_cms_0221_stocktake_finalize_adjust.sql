-- 20260128302500_cms_0219_stocktake_finalize_adjust.sql
set search_path = public, pg_temp;
create or replace function public.cms_fn_finalize_inventory_count_session_v1(
  p_session_id uuid,
  p_generate_adjust boolean default true,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s public.cms_inventory_count_session%rowtype;
  v_asof timestamptz;

  r public.cms_inventory_count_line%rowtype;
  v_sys numeric;

  v_nonzero int;
  v_move_id uuid;
  v_move_status public.cms_e_inventory_move_status;
  v_line_no int;

  v_idempo text;

  v_before jsonb;
  v_after jsonb;
begin
  if p_session_id is null then
    raise exception 'session_id required';
  end if;

  -- lock session
  select * into v_s
  from public.cms_inventory_count_session
  where session_id = p_session_id
  for update;

  if not found then
    raise exception 'stocktake session not found: %', p_session_id;
  end if;

  if v_s.status = 'VOID'::public.cms_e_inventory_count_status then
    raise exception 'cannot finalize VOID session: %', p_session_id;
  end if;

  -- idempotent: already finalized
  if v_s.status = 'FINALIZED'::public.cms_e_inventory_count_status then
    return jsonb_build_object(
      'ok', true,
      'session_id', p_session_id,
      'status', 'FINALIZED',
      'generated_move_id', v_s.generated_move_id
    );
  end if;

  v_asof := v_s.snapshot_at;

  -- 1) compute system_qty_asof + delta_qty (as-of snapshot)
  for r in
    select *
    from public.cms_inventory_count_line
    where session_id = p_session_id
      and is_void = false
    order by line_no asc
    for update
  loop
    if r.item_ref_type = 'MASTER'::public.cms_e_inventory_item_ref_type and r.master_id is not null then
      v_sys := public.cms_fn_inventory_qty_asof_by_master_v1(r.master_id, v_asof);
    else
      v_sys := public.cms_fn_inventory_qty_asof_by_label_v1(r.item_ref_type, r.item_name, r.variant_hint, v_asof);
    end if;

    update public.cms_inventory_count_line
    set system_qty_asof = v_sys,
        delta_qty = (r.counted_qty - v_sys)
    where count_line_id = r.count_line_id;
  end loop;

  select count(*) into v_nonzero
  from public.cms_inventory_count_line
  where session_id = p_session_id
    and is_void = false
    and coalesce(delta_qty,0) <> 0;

  v_before := jsonb_build_object(
    'status', v_s.status,
    'generated_move_id', v_s.generated_move_id,
    'nonzero_delta_lines', v_nonzero
  );

  -- 2) delta=0이면 ADJUST 생성/POST 없이 FINALIZE만
  if v_nonzero = 0 or not p_generate_adjust then
    update public.cms_inventory_count_session
    set status = 'FINALIZED'::public.cms_e_inventory_count_status,
        finalized_at = now(),
        generated_move_id = null
    where session_id = p_session_id;

    insert into public.cms_status_event(entity_type, entity_id, from_status, to_status, occurred_at, actor_person_id, reason, correlation_id)
    values ('STOCKTAKE_SESSION', p_session_id, 'DRAFT', 'FINALIZED', now(), p_actor_person_id, 'finalize_no_adjust', p_correlation_id);

    v_after := jsonb_build_object(
      'status', 'FINALIZED',
      'generated_move_id', null,
      'nonzero_delta_lines', v_nonzero
    );

    insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, occurred_at, note)
    values ('STOCKTAKE_SESSION', p_session_id, 'FINALIZE_NO_ADJUST', v_before, v_after, p_actor_person_id, now(),
            coalesce(p_note,'') || ' corr=' || p_correlation_id::text);

    return jsonb_build_object(
      'ok', true,
      'session_id', p_session_id,
      'status', 'FINALIZED',
      'generated_move_id', null,
      'nonzero_delta_lines', v_nonzero
    );
  end if;

  -- 3) ADJUST move header (멱등: idempotency_key 기반)
  v_idempo := 'STOCKTAKE:' || p_session_id::text;

  select h.move_id, h.status
    into v_move_id, v_move_status
  from public.cms_inventory_move_header h
  where h.idempotency_key = v_idempo
  limit 1
  for update;

  if v_move_id is null then
    v_move_id := gen_random_uuid();

    insert into public.cms_inventory_move_header(
      move_id,
      move_type,
      occurred_at,
      status,
      party_id,
      location_code,
      ref_doc_type,
      ref_doc_id,
      memo,
      source,
      meta,
      idempotency_key
    )
    values (
      v_move_id,
      'ADJUST'::public.cms_e_inventory_move_type,
      v_asof,
      'DRAFT'::public.cms_e_inventory_move_status,
      null,
      v_s.location_code,
      'STOCKTAKE_SESSION',
      p_session_id,
      coalesce(v_s.memo, 'stocktake adjust'),
      'STOCKTAKE',
      jsonb_build_object('stocktake_session_id', p_session_id, 'snapshot_at', v_asof),
      v_idempo
    );

    v_move_status := 'DRAFT'::public.cms_e_inventory_move_status;
  end if;

  if v_move_status = 'VOID'::public.cms_e_inventory_move_status then
    raise exception 'cannot finalize: ADJUST move is VOID (move_id=%)', v_move_id;
  end if;

  -- 4) 이미 POSTED면 그대로 세션만 FINALIZE 처리 (멱등)
  if v_move_status = 'POSTED'::public.cms_e_inventory_move_status then
    update public.cms_inventory_count_session
    set status='FINALIZED'::public.cms_e_inventory_count_status,
        finalized_at=now(),
        generated_move_id=v_move_id
    where session_id=p_session_id;

    insert into public.cms_status_event(entity_type, entity_id, from_status, to_status, occurred_at, actor_person_id, reason, correlation_id)
    values ('STOCKTAKE_SESSION', p_session_id, 'DRAFT', 'FINALIZED', now(), p_actor_person_id, 'finalize_already_posted', p_correlation_id);

    return jsonb_build_object(
      'ok', true,
      'session_id', p_session_id,
      'status', 'FINALIZED',
      'generated_move_id', v_move_id,
      'nonzero_delta_lines', v_nonzero,
      'note', 'already_posted'
    );
  end if;

  -- 5) 라인 rebuild: 기존 라인은 void 처리(DELETE 금지)
  update public.cms_inventory_move_line
  set is_void = true,
      void_reason = 'stocktake_rebuild'
  where move_id = v_move_id
    and is_void = false;

  v_line_no := 0;

  -- 6) delta 라인 생성
  for r in
    select *
    from public.cms_inventory_count_line
    where session_id = p_session_id
      and is_void = false
      and coalesce(delta_qty,0) <> 0
    order by abs(delta_qty) desc, line_no asc
  loop
    v_line_no := v_line_no + 1;

    insert into public.cms_inventory_move_line(
      move_id,
      line_no,
      direction,
      qty,
      unit,
      item_ref_type,
      master_id,
      part_id,
      item_name,
      variant_hint,
      ref_entity_type,
      ref_entity_id,
      meta,
      is_void
    )
    values (
      v_move_id,
      v_line_no,
      case when r.delta_qty > 0
           then 'IN'::public.cms_e_inventory_direction
           else 'OUT'::public.cms_e_inventory_direction
      end,
      abs(r.delta_qty),
      'EA',
      r.item_ref_type,
      r.master_id,
      r.part_id,
      r.item_name,
      r.variant_hint,
      'STOCKTAKE_LINE',
      r.count_line_id,
      jsonb_build_object(
        'stocktake_session_id', p_session_id,
        'stocktake_line_id', r.count_line_id,
        'counted_qty', r.counted_qty,
        'system_qty_asof', r.system_qty_asof,
        'delta_qty', r.delta_qty,
        'snapshot_at', v_asof
      ),
      false
    );
  end loop;

  -- 7) POST move
  update public.cms_inventory_move_header
  set status = 'POSTED'::public.cms_e_inventory_move_status,
      posted_at = now()
  where move_id = v_move_id
    and status = 'DRAFT'::public.cms_e_inventory_move_status;

  -- refresh status
  select status into v_move_status
  from public.cms_inventory_move_header
  where move_id = v_move_id;

  if v_move_status <> 'POSTED'::public.cms_e_inventory_move_status then
    raise exception 'failed to POST adjust move (move_id=% status=%)', v_move_id, v_move_status;
  end if;

  -- 8) finalize session
  update public.cms_inventory_count_session
  set status = 'FINALIZED'::public.cms_e_inventory_count_status,
      finalized_at = now(),
      generated_move_id = v_move_id
  where session_id = p_session_id;

  insert into public.cms_status_event(entity_type, entity_id, from_status, to_status, occurred_at, actor_person_id, reason, correlation_id)
  values ('STOCKTAKE_SESSION', p_session_id, 'DRAFT', 'FINALIZED', now(), p_actor_person_id, 'finalize', p_correlation_id);

  v_after := jsonb_build_object(
    'status', 'FINALIZED',
    'generated_move_id', v_move_id,
    'nonzero_delta_lines', v_nonzero
  );

  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, occurred_at, note)
  values ('STOCKTAKE_SESSION', p_session_id, 'FINALIZE', v_before, v_after, p_actor_person_id, now(),
          coalesce(p_note,'') || ' corr=' || p_correlation_id::text);

  return jsonb_build_object(
    'ok', true,
    'session_id', p_session_id,
    'status', 'FINALIZED',
    'generated_move_id', v_move_id,
    'nonzero_delta_lines', v_nonzero
  );
end $$;
-- 권한(이미 grant 되어있어도 안전)
grant execute on function public.cms_fn_finalize_inventory_count_session_v1(uuid,boolean,uuid,text,uuid) to authenticated;
