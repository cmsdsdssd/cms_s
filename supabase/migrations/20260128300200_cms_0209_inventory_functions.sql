-- 20260128300200_cms_0209_inventory_functions.sql
-- cms_0209: inventory RPCs (RPC-only writes) - FIX default-parameter ordering

set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 공통 유틸: move_type에 따른 direction 규칙 (ADJUST는 자유)
-- ---------------------------------------------------------------------
create or replace function public.cms_fn_inventory_expected_direction_v1(
  p_move_type public.cms_e_inventory_move_type
)
returns public.cms_e_inventory_direction
language plpgsql
as $$
begin
  if p_move_type = 'RECEIPT' then
    return 'IN'::public.cms_e_inventory_direction;
  elsif p_move_type = 'ISSUE' then
    return 'OUT'::public.cms_e_inventory_direction;
  else
    -- ADJUST는 검증 스킵용(호출부에서 처리)
    return 'IN'::public.cms_e_inventory_direction;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 1) 헤더 upsert (멱등키 지원)
-- ---------------------------------------------------------------------
create or replace function public.cms_fn_upsert_inventory_move_header_v1(
  p_move_type public.cms_e_inventory_move_type,
  p_occurred_at timestamptz default now(),
  p_party_id uuid default null,
  p_location_code text default null,
  p_ref_doc_type text default null,
  p_ref_doc_id uuid default null,
  p_memo text default null,
  p_source text default 'MANUAL',
  p_meta jsonb default '{}'::jsonb,
  p_move_id uuid default null,
  p_idempotency_key text default null,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing uuid;
  v_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_hdr public.cms_inventory_move_header%rowtype;
begin
  if p_move_type is null then
    raise exception 'move_type required';
  end if;

  -- 멱등키가 있으면 기존 move_id 반환
  if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
    select move_id into v_existing
    from public.cms_inventory_move_header
    where idempotency_key = trim(p_idempotency_key)
    limit 1;

    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  -- update path
  if p_move_id is not null then
    select * into v_hdr
    from public.cms_inventory_move_header
    where move_id = p_move_id
    for update;

    if found then
      if v_hdr.status <> 'DRAFT'::public.cms_e_inventory_move_status then
        raise exception 'cannot update inventory move header when status=% (move_id=%)', v_hdr.status, v_hdr.move_id;
      end if;

      v_before := jsonb_build_object(
        'move_type', v_hdr.move_type,
        'status', v_hdr.status,
        'occurred_at', v_hdr.occurred_at,
        'party_id', v_hdr.party_id,
        'location_code', v_hdr.location_code,
        'ref_doc_type', v_hdr.ref_doc_type,
        'ref_doc_id', v_hdr.ref_doc_id,
        'memo', v_hdr.memo,
        'source', v_hdr.source,
        'meta', v_hdr.meta,
        'idempotency_key', v_hdr.idempotency_key
      );

      update public.cms_inventory_move_header
      set
        move_type = p_move_type,
        occurred_at = coalesce(p_occurred_at, v_hdr.occurred_at),
        party_id = p_party_id,
        location_code = p_location_code,
        ref_doc_type = p_ref_doc_type,
        ref_doc_id = p_ref_doc_id,
        memo = p_memo,
        source = coalesce(nullif(trim(coalesce(p_source,'')), ''), v_hdr.source),
        meta = coalesce(p_meta, '{}'::jsonb),
        idempotency_key = coalesce(nullif(trim(coalesce(p_idempotency_key,'')), ''), v_hdr.idempotency_key)
      where move_id = v_hdr.move_id;

      v_after := jsonb_build_object(
        'move_type', p_move_type,
        'status', v_hdr.status,
        'occurred_at', coalesce(p_occurred_at, v_hdr.occurred_at),
        'party_id', p_party_id,
        'location_code', p_location_code,
        'ref_doc_type', p_ref_doc_type,
        'ref_doc_id', p_ref_doc_id,
        'memo', p_memo,
        'source', coalesce(nullif(trim(coalesce(p_source,'')), ''), v_hdr.source),
        'meta', coalesce(p_meta, '{}'::jsonb),
        'idempotency_key', coalesce(nullif(trim(coalesce(p_idempotency_key,'')), ''), v_hdr.idempotency_key)
      );

      insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, occurred_at, note)
      values ('INVENTORY_MOVE', v_hdr.move_id, 'UPSERT_HEADER', v_before, v_after, p_actor_person_id, now(), coalesce(p_note,'') || ' corr=' || p_correlation_id::text);

      return v_hdr.move_id;
    end if;
  end if;

  -- insert path
  v_id := coalesce(p_move_id, gen_random_uuid());

  insert into public.cms_inventory_move_header(
    move_id, move_type, occurred_at, party_id, location_code,
    ref_doc_type, ref_doc_id,
    memo, source, meta, idempotency_key
  )
  values (
    v_id,
    p_move_type,
    coalesce(p_occurred_at, now()),
    p_party_id,
    p_location_code,
    nullif(trim(coalesce(p_ref_doc_type,'')), ''),
    p_ref_doc_id,
    p_memo,
    coalesce(nullif(trim(coalesce(p_source,'')), ''), 'MANUAL'),
    coalesce(p_meta, '{}'::jsonb),
    nullif(trim(coalesce(p_idempotency_key,'')), '')
  );

  v_after := jsonb_build_object(
    'move_type', p_move_type,
    'status', 'DRAFT',
    'occurred_at', coalesce(p_occurred_at, now()),
    'party_id', p_party_id,
    'location_code', p_location_code,
    'ref_doc_type', nullif(trim(coalesce(p_ref_doc_type,'')), ''),
    'ref_doc_id', p_ref_doc_id,
    'memo', p_memo,
    'source', coalesce(nullif(trim(coalesce(p_source,'')), ''), 'MANUAL'),
    'meta', coalesce(p_meta, '{}'::jsonb),
    'idempotency_key', nullif(trim(coalesce(p_idempotency_key,'')), '')
  );

  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, occurred_at, note)
  values ('INVENTORY_MOVE', v_id, 'CREATE_HEADER', '{}'::jsonb, v_after, p_actor_person_id, now(), coalesce(p_note,'') || ' corr=' || p_correlation_id::text);

  return v_id;
end $$;


-- ---------------------------------------------------------------------
-- 2) 라인 upsert (DRAFT에서만)  ★필수 파라미터를 앞에 배치(에러 fix)
-- ---------------------------------------------------------------------
create or replace function public.cms_fn_upsert_inventory_move_line_v1(
  p_move_id uuid,
  p_line_no int,
  p_direction public.cms_e_inventory_direction,
  p_qty numeric,
  p_item_name text,                         -- 필수(앞으로 이동)
  p_unit text default 'EA',
  p_item_ref_type public.cms_e_inventory_item_ref_type default 'UNLINKED',
  p_master_id uuid default null,
  p_part_id uuid default null,
  p_variant_hint text default null,
  p_note text default null,
  p_meta jsonb default '{}'::jsonb,
  p_ref_entity_type text default null,
  p_ref_entity_id uuid default null,
  p_move_line_id uuid default null,
  p_actor_person_id uuid default null,
  p_note2 text default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hdr public.cms_inventory_move_header%rowtype;
  v_expected public.cms_e_inventory_direction;
  v_existing_line_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_id uuid;
begin
  if p_move_id is null then
    raise exception 'move_id required';
  end if;
  if p_line_no is null or p_line_no <= 0 then
    raise exception 'line_no must be positive';
  end if;
  if p_direction is null then
    raise exception 'direction required';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'qty must be > 0';
  end if;
  if p_item_name is null or length(trim(p_item_name)) = 0 then
    raise exception 'item_name required';
  end if;

  select * into v_hdr
  from public.cms_inventory_move_header
  where move_id = p_move_id
  for update;

  if not found then
    raise exception 'inventory move not found: %', p_move_id;
  end if;

  if v_hdr.status <> 'DRAFT'::public.cms_e_inventory_move_status then
    raise exception 'cannot modify line when header status=% (move_id=%)', v_hdr.status, v_hdr.move_id;
  end if;

  -- move_type별 direction 실수 방지(운영 편의)
  if v_hdr.move_type <> 'ADJUST'::public.cms_e_inventory_move_type then
    v_expected := public.cms_fn_inventory_expected_direction_v1(v_hdr.move_type);
    if p_direction <> v_expected then
      raise exception 'direction mismatch: move_type=% expects %, got %', v_hdr.move_type, v_expected, p_direction;
    end if;
  end if;

  -- item_ref_type 최소 검증
  if p_item_ref_type = 'MASTER'::public.cms_e_inventory_item_ref_type then
    if p_master_id is null or p_part_id is not null then
      raise exception 'MASTER ref requires master_id and part_id must be null';
    end if;
  elsif p_item_ref_type = 'PART'::public.cms_e_inventory_item_ref_type then
    if p_part_id is null or p_master_id is not null then
      raise exception 'PART ref requires part_id and master_id must be null';
    end if;
  else
    if p_master_id is not null or p_part_id is not null then
      raise exception 'UNLINKED ref requires both master_id and part_id null';
    end if;
  end if;

  -- update by move_line_id
  if p_move_line_id is not null then
    select move_line_id into v_existing_line_id
    from public.cms_inventory_move_line
    where move_line_id = p_move_line_id
    for update;

    if v_existing_line_id is null then
      raise exception 'inventory move line not found: %', p_move_line_id;
    end if;

    select jsonb_build_object(
      'line_no', line_no, 'direction', direction, 'qty', qty, 'unit', unit,
      'item_ref_type', item_ref_type, 'master_id', master_id, 'part_id', part_id,
      'item_name', item_name, 'variant_hint', variant_hint,
      'note', note, 'meta', meta,
      'is_void', is_void, 'void_reason', void_reason,
      'ref_entity_type', ref_entity_type, 'ref_entity_id', ref_entity_id
    )
    into v_before
    from public.cms_inventory_move_line
    where move_line_id = p_move_line_id;

    update public.cms_inventory_move_line
    set
      line_no = p_line_no,
      direction = p_direction,
      qty = p_qty,
      unit = coalesce(nullif(trim(coalesce(p_unit,'')), ''), 'EA'),
      item_ref_type = p_item_ref_type,
      master_id = p_master_id,
      part_id = p_part_id,
      item_name = trim(p_item_name),
      variant_hint = nullif(trim(coalesce(p_variant_hint,'')), ''),
      note = nullif(trim(coalesce(p_note,'')), ''),
      meta = coalesce(p_meta, '{}'::jsonb),
      ref_entity_type = nullif(trim(coalesce(p_ref_entity_type,'')), ''),
      ref_entity_id = p_ref_entity_id
    where move_line_id = p_move_line_id;

    v_after := jsonb_build_object(
      'line_no', p_line_no, 'direction', p_direction, 'qty', p_qty, 'unit', coalesce(nullif(trim(coalesce(p_unit,'')), ''), 'EA'),
      'item_ref_type', p_item_ref_type, 'master_id', p_master_id, 'part_id', p_part_id,
      'item_name', trim(p_item_name), 'variant_hint', nullif(trim(coalesce(p_variant_hint,'')), ''),
      'note', nullif(trim(coalesce(p_note,'')), ''), 'meta', coalesce(p_meta, '{}'::jsonb),
      'ref_entity_type', nullif(trim(coalesce(p_ref_entity_type,'')), ''), 'ref_entity_id', p_ref_entity_id
    );

    insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, occurred_at, note)
    values ('INVENTORY_MOVE', p_move_id, 'UPSERT_LINE', v_before, v_after, p_actor_person_id, now(), coalesce(p_note2,'') || ' corr=' || p_correlation_id::text);

    return p_move_line_id;
  end if;

  -- upsert by (move_id, line_no) for alive line
  select move_line_id into v_existing_line_id
  from public.cms_inventory_move_line
  where move_id = p_move_id
    and line_no = p_line_no
    and is_void = false
  limit 1
  for update;

  if v_existing_line_id is not null then
    select jsonb_build_object(
      'line_no', line_no, 'direction', direction, 'qty', qty, 'unit', unit,
      'item_ref_type', item_ref_type, 'master_id', master_id, 'part_id', part_id,
      'item_name', item_name, 'variant_hint', variant_hint,
      'note', note, 'meta', meta,
      'is_void', is_void, 'void_reason', void_reason,
      'ref_entity_type', ref_entity_type, 'ref_entity_id', ref_entity_id
    )
    into v_before
    from public.cms_inventory_move_line
    where move_line_id = v_existing_line_id;

    update public.cms_inventory_move_line
    set
      direction = p_direction,
      qty = p_qty,
      unit = coalesce(nullif(trim(coalesce(p_unit,'')), ''), 'EA'),
      item_ref_type = p_item_ref_type,
      master_id = p_master_id,
      part_id = p_part_id,
      item_name = trim(p_item_name),
      variant_hint = nullif(trim(coalesce(p_variant_hint,'')), ''),
      note = nullif(trim(coalesce(p_note,'')), ''),
      meta = coalesce(p_meta, '{}'::jsonb),
      ref_entity_type = nullif(trim(coalesce(p_ref_entity_type,'')), ''),
      ref_entity_id = p_ref_entity_id
    where move_line_id = v_existing_line_id;

    v_after := jsonb_build_object(
      'line_no', p_line_no, 'direction', p_direction, 'qty', p_qty, 'unit', coalesce(nullif(trim(coalesce(p_unit,'')), ''), 'EA'),
      'item_ref_type', p_item_ref_type, 'master_id', p_master_id, 'part_id', p_part_id,
      'item_name', trim(p_item_name), 'variant_hint', nullif(trim(coalesce(p_variant_hint,'')), ''),
      'note', nullif(trim(coalesce(p_note,'')), ''), 'meta', coalesce(p_meta, '{}'::jsonb),
      'ref_entity_type', nullif(trim(coalesce(p_ref_entity_type,'')), ''), 'ref_entity_id', p_ref_entity_id
    );

    insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, occurred_at, note)
    values ('INVENTORY_MOVE', p_move_id, 'UPSERT_LINE', v_before, v_after, p_actor_person_id, now(), coalesce(p_note2,'') || ' corr=' || p_correlation_id::text);

    return v_existing_line_id;
  end if;

  -- insert new line
  v_id := gen_random_uuid();

  insert into public.cms_inventory_move_line(
    move_line_id, move_id, line_no,
    direction, qty, unit,
    item_ref_type, master_id, part_id,
    item_name, variant_hint,
    note, meta,
    ref_entity_type, ref_entity_id
  )
  values (
    v_id,
    p_move_id,
    p_line_no,
    p_direction,
    p_qty,
    coalesce(nullif(trim(coalesce(p_unit,'')), ''), 'EA'),
    p_item_ref_type,
    p_master_id,
    p_part_id,
    trim(p_item_name),
    nullif(trim(coalesce(p_variant_hint,'')), ''),
    nullif(trim(coalesce(p_note,'')), ''),
    coalesce(p_meta, '{}'::jsonb),
    nullif(trim(coalesce(p_ref_entity_type,'')), ''),
    p_ref_entity_id
  );

  v_after := jsonb_build_object(
    'line_no', p_line_no, 'direction', p_direction, 'qty', p_qty, 'unit', coalesce(nullif(trim(coalesce(p_unit,'')), ''), 'EA'),
    'item_ref_type', p_item_ref_type, 'master_id', p_master_id, 'part_id', p_part_id,
    'item_name', trim(p_item_name), 'variant_hint', nullif(trim(coalesce(p_variant_hint,'')), ''),
    'note', nullif(trim(coalesce(p_note,'')), ''), 'meta', coalesce(p_meta, '{}'::jsonb),
    'ref_entity_type', nullif(trim(coalesce(p_ref_entity_type,'')), ''), 'ref_entity_id', p_ref_entity_id
  );

  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, occurred_at, note)
  values ('INVENTORY_MOVE', p_move_id, 'CREATE_LINE', '{}'::jsonb, v_after, p_actor_person_id, now(), coalesce(p_note2,'') || ' corr=' || p_correlation_id::text);

  return v_id;
end $$;


-- ---------------------------------------------------------------------
-- 2-1) 라인 추가(자동 line_no) - 운영 편의
-- ---------------------------------------------------------------------
create or replace function public.cms_fn_add_inventory_move_line_v1(
  p_move_id uuid,
  p_direction public.cms_e_inventory_direction,
  p_qty numeric,
  p_item_name text,                         -- 필수(앞으로 이동)
  p_unit text default 'EA',
  p_item_ref_type public.cms_e_inventory_item_ref_type default 'UNLINKED',
  p_master_id uuid default null,
  p_part_id uuid default null,
  p_variant_hint text default null,
  p_note text default null,
  p_meta jsonb default '{}'::jsonb,
  p_ref_entity_type text default null,
  p_ref_entity_id uuid default null,
  p_actor_person_id uuid default null,
  p_note2 text default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hdr public.cms_inventory_move_header%rowtype;
  v_next int;
begin
  select * into v_hdr
  from public.cms_inventory_move_header
  where move_id = p_move_id
  for update;

  if not found then
    raise exception 'inventory move not found: %', p_move_id;
  end if;

  if v_hdr.status <> 'DRAFT'::public.cms_e_inventory_move_status then
    raise exception 'cannot add line when header status=%', v_hdr.status;
  end if;

  select coalesce(max(line_no), 0) + 1 into v_next
  from public.cms_inventory_move_line
  where move_id = p_move_id;

  return public.cms_fn_upsert_inventory_move_line_v1(
    p_move_id := p_move_id,
    p_line_no := v_next,
    p_direction := p_direction,
    p_qty := p_qty,
    p_item_name := p_item_name,
    p_unit := p_unit,
    p_item_ref_type := p_item_ref_type,
    p_master_id := p_master_id,
    p_part_id := p_part_id,
    p_variant_hint := p_variant_hint,
    p_note := p_note,
    p_meta := p_meta,
    p_ref_entity_type := p_ref_entity_type,
    p_ref_entity_id := p_ref_entity_id,
    p_move_line_id := null,
    p_actor_person_id := p_actor_person_id,
    p_note2 := p_note2,
    p_correlation_id := p_correlation_id
  );
end $$;


-- ---------------------------------------------------------------------
-- 3) 라인 void(삭제 금지)
-- ---------------------------------------------------------------------
create or replace function public.cms_fn_void_inventory_move_line_v1(
  p_move_line_id uuid,
  p_reason text,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line public.cms_inventory_move_line%rowtype;
  v_hdr public.cms_inventory_move_header%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  if p_move_line_id is null then
    raise exception 'move_line_id required';
  end if;

  select * into v_line
  from public.cms_inventory_move_line
  where move_line_id = p_move_line_id
  for update;

  if not found then
    raise exception 'inventory move line not found: %', p_move_line_id;
  end if;

  select * into v_hdr
  from public.cms_inventory_move_header
  where move_id = v_line.move_id
  for update;

  if v_hdr.status <> 'DRAFT'::public.cms_e_inventory_move_status then
    raise exception 'cannot void line when header status=%', v_hdr.status;
  end if;

  v_before := jsonb_build_object('is_void', v_line.is_void, 'void_reason', v_line.void_reason);

  update public.cms_inventory_move_line
  set
    is_void = true,
    void_reason = nullif(trim(coalesce(p_reason,'')), '')
  where move_line_id = p_move_line_id;

  v_after := jsonb_build_object('is_void', true, 'void_reason', nullif(trim(coalesce(p_reason,'')), ''));

  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, occurred_at, note)
  values ('INVENTORY_MOVE', v_line.move_id, 'VOID_LINE', v_before, v_after, p_actor_person_id, now(), coalesce(p_note,'') || ' corr=' || p_correlation_id::text);
end $$;


-- ---------------------------------------------------------------------
-- 4) POST(확정): DRAFT -> POSTED (불변 전환)
-- ---------------------------------------------------------------------
create or replace function public.cms_fn_post_inventory_move_v1(
  p_move_id uuid,
  p_actor_person_id uuid default null,
  p_reason text default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hdr public.cms_inventory_move_header%rowtype;
  v_line_cnt int;
  v_before jsonb;
  v_after jsonb;
begin
  if p_move_id is null then
    raise exception 'move_id required';
  end if;

  select * into v_hdr
  from public.cms_inventory_move_header
  where move_id = p_move_id
  for update;

  if not found then
    raise exception 'inventory move not found: %', p_move_id;
  end if;

  if v_hdr.status = 'POSTED'::public.cms_e_inventory_move_status then
    return;
  end if;

  if v_hdr.status = 'VOID'::public.cms_e_inventory_move_status then
    raise exception 'cannot post VOID move: %', p_move_id;
  end if;

  select count(*) into v_line_cnt
  from public.cms_inventory_move_line
  where move_id = p_move_id
    and is_void = false;

  if v_line_cnt <= 0 then
    raise exception 'cannot post: no active lines (move_id=%)', p_move_id;
  end if;

  if v_hdr.move_type = 'RECEIPT'::public.cms_e_inventory_move_type then
    if exists (
      select 1 from public.cms_inventory_move_line
      where move_id = p_move_id and is_void=false and direction <> 'IN'::public.cms_e_inventory_direction
    ) then
      raise exception 'RECEIPT must have only IN lines (move_id=%)', p_move_id;
    end if;
  elsif v_hdr.move_type = 'ISSUE'::public.cms_e_inventory_move_type then
    if exists (
      select 1 from public.cms_inventory_move_line
      where move_id = p_move_id and is_void=false and direction <> 'OUT'::public.cms_e_inventory_direction
    ) then
      raise exception 'ISSUE must have only OUT lines (move_id=%)', p_move_id;
    end if;
  end if;

  v_before := jsonb_build_object(
    'status', v_hdr.status,
    'posted_at', v_hdr.posted_at,
    'line_count', v_line_cnt
  );

  update public.cms_inventory_move_header
  set
    status = 'POSTED'::public.cms_e_inventory_move_status,
    posted_at = now()
  where move_id = p_move_id;

  v_after := jsonb_build_object(
    'status', 'POSTED',
    'posted_at', now(),
    'line_count', v_line_cnt
  );

  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, occurred_at, note)
  values ('INVENTORY_MOVE', p_move_id, 'POST', v_before, v_after, p_actor_person_id, now(), coalesce(p_note,'') || ' corr=' || p_correlation_id::text);

  insert into public.cms_status_event(entity_type, entity_id, from_status, to_status, occurred_at, actor_person_id, reason, correlation_id)
  values ('INVENTORY_MOVE', p_move_id, v_hdr.status::text, 'POSTED', now(), p_actor_person_id, p_reason, p_correlation_id);
end $$;


-- ---------------------------------------------------------------------
-- 5) VOID(취소): POSTED/DRAFT -> VOID (기록은 남김)
-- ---------------------------------------------------------------------
create or replace function public.cms_fn_void_inventory_move_v1(
  p_move_id uuid,
  p_reason text,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hdr public.cms_inventory_move_header%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  if p_move_id is null then
    raise exception 'move_id required';
  end if;

  select * into v_hdr
  from public.cms_inventory_move_header
  where move_id = p_move_id
  for update;

  if not found then
    raise exception 'inventory move not found: %', p_move_id;
  end if;

  if v_hdr.status = 'VOID'::public.cms_e_inventory_move_status then
    return;
  end if;

  v_before := jsonb_build_object('status', v_hdr.status, 'voided_at', v_hdr.voided_at, 'void_reason', v_hdr.void_reason);

  update public.cms_inventory_move_header
  set
    status = 'VOID'::public.cms_e_inventory_move_status,
    voided_at = now(),
    void_reason = nullif(trim(coalesce(p_reason,'')), '')
  where move_id = p_move_id;

  v_after := jsonb_build_object('status', 'VOID', 'voided_at', now(), 'void_reason', nullif(trim(coalesce(p_reason,'')), ''));

  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, occurred_at, note)
  values ('INVENTORY_MOVE', p_move_id, 'VOID', v_before, v_after, p_actor_person_id, now(), coalesce(p_note,'') || ' corr=' || p_correlation_id::text);

  insert into public.cms_status_event(entity_type, entity_id, from_status, to_status, occurred_at, actor_person_id, reason, correlation_id)
  values ('INVENTORY_MOVE', p_move_id, v_hdr.status::text, 'VOID', now(), p_actor_person_id, p_reason, p_correlation_id);
end $$;


-- ---------------------------------------------------------------------
-- 6) quick 기록(1줄짜리 입고/출고를 한 방에 POST까지)  ★필수 파라미터를 앞으로
-- ---------------------------------------------------------------------
create or replace function public.cms_fn_quick_inventory_move_v1(
  p_move_type public.cms_e_inventory_move_type,
  p_item_name text,              -- 필수
  p_qty numeric,                 -- 필수
  p_occurred_at timestamptz default now(),
  p_party_id uuid default null,
  p_variant_hint text default null,
  p_unit text default 'EA',
  p_source text default 'MANUAL',
  p_memo text default null,
  p_meta jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_move_id uuid;
  v_dir public.cms_e_inventory_direction;
begin
  if p_move_type is null then raise exception 'move_type required'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'qty must be > 0'; end if;
  if p_item_name is null or length(trim(p_item_name))=0 then raise exception 'item_name required'; end if;

  v_move_id := public.cms_fn_upsert_inventory_move_header_v1(
    p_move_type := p_move_type,
    p_occurred_at := p_occurred_at,
    p_party_id := p_party_id,
    p_location_code := null,
    p_ref_doc_type := null,
    p_ref_doc_id := null,
    p_memo := p_memo,
    p_source := p_source,
    p_meta := p_meta,
    p_move_id := null,
    p_idempotency_key := p_idempotency_key,
    p_actor_person_id := p_actor_person_id,
    p_note := p_note,
    p_correlation_id := p_correlation_id
  );

  if p_move_type = 'ADJUST'::public.cms_e_inventory_move_type then
    v_dir := 'IN'::public.cms_e_inventory_direction;
  else
    v_dir := public.cms_fn_inventory_expected_direction_v1(p_move_type);
  end if;

  perform public.cms_fn_add_inventory_move_line_v1(
    p_move_id := v_move_id,
    p_direction := v_dir,
    p_qty := p_qty,
    p_item_name := p_item_name,
    p_unit := p_unit,
    p_item_ref_type := 'UNLINKED'::public.cms_e_inventory_item_ref_type,
    p_master_id := null,
    p_part_id := null,
    p_variant_hint := p_variant_hint,
    p_note := null,
    p_meta := '{}'::jsonb,
    p_ref_entity_type := null,
    p_ref_entity_id := null,
    p_actor_person_id := p_actor_person_id,
    p_note2 := p_note,
    p_correlation_id := p_correlation_id
  );

  perform public.cms_fn_post_inventory_move_v1(
    p_move_id := v_move_id,
    p_actor_person_id := p_actor_person_id,
    p_reason := 'quick_post',
    p_note := p_note,
    p_correlation_id := p_correlation_id
  );

  return v_move_id;
end $$;


-- ---------------------------------------------------------------------
-- 7) 자동 트래킹(선택): shipment confirmed -> ISSUE 원장 생성/POST (멱등)
-- ---------------------------------------------------------------------
create or replace function public.cms_fn_emit_inventory_issue_from_shipment_confirmed_v1(
  p_shipment_id uuid,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ship public.cms_shipment_header%rowtype;
  v_move_id uuid;
  v_key text;
  r public.cms_shipment_line%rowtype;
  v_line_no int;
  v_item_name text;
  v_variant text;
  v_master_id uuid;
begin
  if p_shipment_id is null then raise exception 'shipment_id required'; end if;

  select * into v_ship
  from public.cms_shipment_header
  where shipment_id = p_shipment_id
  for update;

  if not found then
    raise exception 'shipment not found: %', p_shipment_id;
  end if;

  if v_ship.status <> 'CONFIRMED'::public.cms_e_shipment_status then
    raise exception 'shipment not CONFIRMED: % (status=%)', p_shipment_id, v_ship.status;
  end if;

  v_key := 'SHIPMENT_CONFIRMED:' || p_shipment_id::text;

  v_move_id := public.cms_fn_upsert_inventory_move_header_v1(
    p_move_type := 'ISSUE'::public.cms_e_inventory_move_type,
    p_occurred_at := coalesce(v_ship.confirmed_at, now()),
    p_party_id := v_ship.customer_party_id,
    p_location_code := null,
    p_ref_doc_type := 'SHIPMENT',
    p_ref_doc_id := p_shipment_id,
    p_memo := coalesce(p_note, 'auto issue from shipment confirmed'),
    p_source := 'AUTO_SHIPMENT',
    p_meta := jsonb_build_object('shipment_id', p_shipment_id),
    p_move_id := null,
    p_idempotency_key := v_key,
    p_actor_person_id := p_actor_person_id,
    p_note := p_note,
    p_correlation_id := p_correlation_id
  );

  if exists (select 1 from public.cms_inventory_move_header where move_id=v_move_id and status='POSTED') then
    return v_move_id;
  end if;

  update public.cms_inventory_move_line
  set is_void = true, void_reason = 'rebuild_from_shipment'
  where move_id = v_move_id and is_void = false;

  v_line_no := 0;

  for r in
    select * from public.cms_shipment_line
    where shipment_id = p_shipment_id
    order by created_at asc
  loop
    v_line_no := v_line_no + 1;

    v_item_name := coalesce(nullif(trim(coalesce(r.model_name,'')),''), nullif(trim(coalesce(r.ad_hoc_name,'')),''), 'UNKNOWN_ITEM');
    v_variant := concat_ws(' / ',
      nullif(trim(coalesce(r.suffix,'')), ''),
      nullif(trim(coalesce(r.color,'')), ''),
      nullif(trim(coalesce(r.size,'')), '')
    );

    v_master_id := null;
    if r.model_name is not null and length(trim(r.model_name))>0 then
      select m.master_id into v_master_id
      from public.cms_master_item m
      where m.model_name = trim(r.model_name)
      limit 1;
    end if;

    perform public.cms_fn_upsert_inventory_move_line_v1(
      p_move_id := v_move_id,
      p_line_no := v_line_no,
      p_direction := 'OUT'::public.cms_e_inventory_direction,
      p_qty := r.qty,
      p_item_name := v_item_name,
      p_unit := 'EA',
      p_item_ref_type := case when v_master_id is not null then 'MASTER'::public.cms_e_inventory_item_ref_type else 'UNLINKED'::public.cms_e_inventory_item_ref_type end,
      p_master_id := v_master_id,
      p_part_id := null,
      p_variant_hint := nullif(v_variant,''),
      p_note := null,
      p_meta := jsonb_build_object('shipment_line_id', r.shipment_line_id),
      p_ref_entity_type := 'SHIPMENT_LINE',
      p_ref_entity_id := r.shipment_line_id,
      p_move_line_id := null,
      p_actor_person_id := p_actor_person_id,
      p_note2 := p_note,
      p_correlation_id := p_correlation_id
    );
  end loop;

  perform public.cms_fn_post_inventory_move_v1(v_move_id, p_actor_person_id, 'auto_post_from_shipment', p_note, p_correlation_id);

  return v_move_id;
end $$;


-- ---------------------------------------------------------------------
-- 8) 자동 트래킹(선택): return_line -> RECEIPT 원장 생성/POST (멱등)
-- ---------------------------------------------------------------------
create or replace function public.cms_fn_emit_inventory_receipt_from_return_line_v1(
  p_return_line_id uuid,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ret public.cms_return_line%rowtype;
  v_shipline public.cms_shipment_line%rowtype;
  v_move_id uuid;
  v_key text;
  v_item_name text;
  v_variant text;
  v_master_id uuid;
begin
  if p_return_line_id is null then raise exception 'return_line_id required'; end if;

  select * into v_ret
  from public.cms_return_line
  where return_line_id = p_return_line_id
  for update;

  if not found then
    raise exception 'return_line not found: %', p_return_line_id;
  end if;

  select * into v_shipline
  from public.cms_shipment_line
  where shipment_line_id = v_ret.shipment_line_id;

  v_key := 'RETURN:' || p_return_line_id::text;

  v_move_id := public.cms_fn_upsert_inventory_move_header_v1(
    p_move_type := 'RECEIPT'::public.cms_e_inventory_move_type,
    p_occurred_at := coalesce(v_ret.occurred_at, now()),
    p_party_id := v_ret.party_id,
    p_location_code := null,
    p_ref_doc_type := 'RETURN_LINE',
    p_ref_doc_id := p_return_line_id,
    p_memo := coalesce(p_note, 'auto receipt from return'),
    p_source := 'AUTO_RETURN',
    p_meta := jsonb_build_object('return_line_id', p_return_line_id, 'shipment_line_id', v_ret.shipment_line_id),
    p_move_id := null,
    p_idempotency_key := v_key,
    p_actor_person_id := p_actor_person_id,
    p_note := p_note,
    p_correlation_id := p_correlation_id
  );

  if exists (select 1 from public.cms_inventory_move_header where move_id=v_move_id and status='POSTED') then
    return v_move_id;
  end if;

  update public.cms_inventory_move_line
  set is_void = true, void_reason = 'rebuild_from_return'
  where move_id = v_move_id and is_void = false;

  v_item_name := coalesce(nullif(trim(coalesce(v_shipline.model_name,'')),''), nullif(trim(coalesce(v_shipline.ad_hoc_name,'')),''), 'UNKNOWN_ITEM');
  v_variant := concat_ws(' / ',
    nullif(trim(coalesce(v_shipline.suffix,'')), ''),
    nullif(trim(coalesce(v_shipline.color,'')), ''),
    nullif(trim(coalesce(v_shipline.size,'')), '')
  );

  v_master_id := null;
  if v_shipline.model_name is not null and length(trim(v_shipline.model_name))>0 then
    select m.master_id into v_master_id
    from public.cms_master_item m
    where m.model_name = trim(v_shipline.model_name)
    limit 1;
  end if;

  perform public.cms_fn_upsert_inventory_move_line_v1(
    p_move_id := v_move_id,
    p_line_no := 1,
    p_direction := 'IN'::public.cms_e_inventory_direction,
    p_qty := v_ret.return_qty,
    p_item_name := v_item_name,
    p_unit := 'EA',
    p_item_ref_type := case when v_master_id is not null then 'MASTER'::public.cms_e_inventory_item_ref_type else 'UNLINKED'::public.cms_e_inventory_item_ref_type end,
    p_master_id := v_master_id,
    p_part_id := null,
    p_variant_hint := nullif(v_variant,''),
    p_note := null,
    p_meta := jsonb_build_object('return_line_id', p_return_line_id, 'shipment_line_id', v_ret.shipment_line_id),
    p_ref_entity_type := 'RETURN_LINE',
    p_ref_entity_id := p_return_line_id,
    p_move_line_id := null,
    p_actor_person_id := p_actor_person_id,
    p_note2 := p_note,
    p_correlation_id := p_correlation_id
  );

  perform public.cms_fn_post_inventory_move_v1(v_move_id, p_actor_person_id, 'auto_post_from_return', p_note, p_correlation_id);

  return v_move_id;
end $$;


-- ---------------------------------------------------------------------
-- 9) 시드(재현 세트)
-- ---------------------------------------------------------------------
create or replace function public.cms_fn_seed_inventory_demo_v1(
  p_reset boolean default true,
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
  v_r1 uuid;
  v_i1 uuid;
  v_a1 uuid;
begin
  if p_reset then
    update public.cms_inventory_move_header
    set status='VOID', voided_at=now(), void_reason='seed_reset'
    where idempotency_key like 'SEED:%' and status <> 'VOID';
  end if;

  v_r1 := public.cms_fn_quick_inventory_move_v1(
    p_move_type := 'RECEIPT',
    p_item_name := '샘플반지A',
    p_qty := 10,
    p_occurred_at := now(),
    p_party_id := null,
    p_variant_hint := 'seed',
    p_unit := 'EA',
    p_source := 'TEST',
    p_memo := 'seed receipt',
    p_meta := jsonb_build_object('seed', true),
    p_idempotency_key := 'SEED:RECEIPT:1',
    p_actor_person_id := p_actor_person_id,
    p_note := p_note,
    p_correlation_id := p_correlation_id
  );

  v_i1 := public.cms_fn_quick_inventory_move_v1(
    p_move_type := 'ISSUE',
    p_item_name := '샘플반지A',
    p_qty := 3,
    p_occurred_at := now(),
    p_party_id := null,
    p_variant_hint := 'seed',
    p_unit := 'EA',
    p_source := 'TEST',
    p_memo := 'seed issue',
    p_meta := jsonb_build_object('seed', true),
    p_idempotency_key := 'SEED:ISSUE:1',
    p_actor_person_id := p_actor_person_id,
    p_note := p_note,
    p_correlation_id := p_correlation_id
  );

  v_a1 := public.cms_fn_quick_inventory_move_v1(
    p_move_type := 'ADJUST',
    p_item_name := '샘플목걸이B',
    p_qty := 5,
    p_occurred_at := now(),
    p_party_id := null,
    p_variant_hint := 'seed',
    p_unit := 'EA',
    p_source := 'TEST',
    p_memo := 'seed adjust',
    p_meta := jsonb_build_object('seed', true),
    p_idempotency_key := 'SEED:ADJUST:1',
    p_actor_person_id := p_actor_person_id,
    p_note := p_note,
    p_correlation_id := p_correlation_id
  );

  return jsonb_build_object(
    'ok', true,
    'receipt_move_id', v_r1,
    'issue_move_id', v_i1,
    'adjust_move_id', v_a1
  );
end $$;
