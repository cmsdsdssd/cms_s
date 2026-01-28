set search_path = public, pg_temp;

-- helper: normalize unit
create or replace function public.cms_fn_part_normalize_unit_v1(p_unit text)
returns text
language plpgsql
immutable
as $$
declare v text;
begin
  v := upper(trim(coalesce(p_unit,'')));
  if v = '' then return 'EA'; end if;
  if v not in ('EA','G','M') then
    raise exception 'invalid unit: %, allowed EA/G/M', v;
  end if;
  return v;
end $$;

-- helper: find part by name (exact) using master+alias
create or replace function public.cms_fn_find_part_id_by_name_v1(p_name text)
returns uuid
language sql
stable
as $$
  with n as (select trim(coalesce(p_name,'')) as name)
  select p.part_id
  from n
  join public.cms_part_item p on p.part_name = n.name
  union all
  select a.part_id
  from n
  join public.cms_part_alias a on a.alias_name = n.name
  limit 1;
$$;

-- 1) upsert part master (staff 가능)
-- ⚠️ FIX: non-default params must come first (p_part_name first)
create or replace function public.cms_fn_upsert_part_item_v1(
  p_part_name text,
  p_part_id uuid default null,
  p_part_kind public.cms_e_part_kind default 'PART',
  p_family_name text default null,
  p_spec_text text default null,
  p_unit_default text default 'EA',
  p_is_reusable boolean default false,
  p_reorder_min_qty numeric default null,
  p_reorder_max_qty numeric default null,
  p_qr_code text default null,
  p_note text default null,
  p_meta jsonb default '{}'::jsonb,
  p_actor_person_id uuid default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_name text;
  v_unit text;
  v_before jsonb;
  v_after jsonb;
begin
  v_name := trim(coalesce(p_part_name,''));
  if v_name = '' then raise exception 'part_name required'; end if;

  v_unit := public.cms_fn_part_normalize_unit_v1(p_unit_default);

  if p_part_id is not null then
    select part_id into v_id
    from public.cms_part_item
    where part_id = p_part_id
    for update;

    if not found then
      v_id := p_part_id;
      insert into public.cms_part_item(part_id, part_name, part_kind, family_name, spec_text, unit_default, is_reusable,
                                       reorder_min_qty, reorder_max_qty, qr_code, note, meta)
      values (v_id, v_name, p_part_kind, nullif(trim(coalesce(p_family_name,'')),''),
              nullif(trim(coalesce(p_spec_text,'')),''),
              v_unit, coalesce(p_is_reusable,false),
              p_reorder_min_qty, p_reorder_max_qty,
              nullif(trim(coalesce(p_qr_code,'')),''),
              nullif(trim(coalesce(p_note,'')),''),
              coalesce(p_meta,'{}'::jsonb));
    else
      select to_jsonb(t) into v_before from (
        select part_name, part_kind, family_name, spec_text, unit_default, is_reusable,
               reorder_min_qty, reorder_max_qty, qr_code, note, meta, is_active
        from public.cms_part_item where part_id = p_part_id
      ) t;

      update public.cms_part_item
      set part_name = v_name,
          part_kind = p_part_kind,
          family_name = nullif(trim(coalesce(p_family_name,'')),''),
          spec_text = nullif(trim(coalesce(p_spec_text,'')),''),
          unit_default = v_unit,
          is_reusable = coalesce(p_is_reusable,false),
          reorder_min_qty = p_reorder_min_qty,
          reorder_max_qty = p_reorder_max_qty,
          qr_code = nullif(trim(coalesce(p_qr_code,'')),''),
          note = nullif(trim(coalesce(p_note,'')),''),
          meta = coalesce(p_meta,'{}'::jsonb)
      where part_id = p_part_id;

      v_after := jsonb_build_object('part_id', p_part_id, 'part_name', v_name, 'unit_default', v_unit);
      insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, note)
      values ('PART_ITEM', p_part_id, 'UPSERT', coalesce(v_before,'{}'::jsonb), v_after, p_actor_person_id,
              'corr=' || p_correlation_id::text);
      v_id := p_part_id;
    end if;

    return v_id;
  end if;

  -- upsert by name
  select part_id into v_id
  from public.cms_part_item
  where part_name = v_name
  for update;

  if not found then
    v_id := gen_random_uuid();
    insert into public.cms_part_item(part_id, part_name, part_kind, family_name, spec_text, unit_default, is_reusable,
                                     reorder_min_qty, reorder_max_qty, qr_code, note, meta)
    values (v_id, v_name, p_part_kind, nullif(trim(coalesce(p_family_name,'')),''),
            nullif(trim(coalesce(p_spec_text,'')),''),
            v_unit, coalesce(p_is_reusable,false),
            p_reorder_min_qty, p_reorder_max_qty,
            nullif(trim(coalesce(p_qr_code,'')),''),
            nullif(trim(coalesce(p_note,'')),''),
            coalesce(p_meta,'{}'::jsonb));
  else
    update public.cms_part_item
    set part_kind = p_part_kind,
        family_name = nullif(trim(coalesce(p_family_name,'')),''),
        spec_text = nullif(trim(coalesce(p_spec_text,'')),''),
        unit_default = v_unit,
        is_reusable = coalesce(p_is_reusable,false),
        reorder_min_qty = p_reorder_min_qty,
        reorder_max_qty = p_reorder_max_qty,
        qr_code = nullif(trim(coalesce(p_qr_code,'')),''),
        note = nullif(trim(coalesce(p_note,'')),''),
        meta = coalesce(p_meta,'{}'::jsonb)
    where part_id = v_id;
  end if;

  v_after := jsonb_build_object('part_id', v_id, 'part_name', v_name, 'unit_default', v_unit);
  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, after, actor_person_id, note)
  values ('PART_ITEM', v_id, 'UPSERT_BY_NAME', v_after, p_actor_person_id, 'corr=' || p_correlation_id::text);

  return v_id;
end $$;

-- 2) add alias
create or replace function public.cms_fn_add_part_alias_v1(
  p_part_id uuid,
  p_alias_name text,
  p_actor_person_id uuid default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alias text;
  v_id uuid;
begin
  if p_part_id is null then raise exception 'part_id required'; end if;
  v_alias := trim(coalesce(p_alias_name,''));
  if v_alias='' then raise exception 'alias_name required'; end if;

  insert into public.cms_part_alias(part_id, alias_name)
  values (p_part_id, v_alias)
  returning alias_id into v_id;

  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, after, actor_person_id, note)
  values ('PART_ITEM', p_part_id, 'ADD_ALIAS',
          jsonb_build_object('alias_id', v_id, 'alias_name', v_alias),
          p_actor_person_id, 'corr=' || p_correlation_id::text);

  return v_id;
end $$;

-- 3) record receipt (IN) : move_type='RECEIPT'
create or replace function public.cms_fn_record_part_receipt_v1(
  p_lines jsonb,
  p_occurred_at timestamptz default now(),
  p_location_code text default null,
  p_vendor_party_id uuid default null,
  p_memo text default null,
  p_source text default 'MANUAL',
  p_idempotency_key text default null,
  p_actor_person_id uuid default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_move_id uuid;
  v_existing uuid;
  v_line jsonb;
  v_i int;
  v_part_id uuid;
  v_part_name text;
  v_qty numeric;
  v_unit text;
  v_cost numeric;
  v_amount numeric;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'p_lines must be jsonb array';
  end if;

  if p_idempotency_key is not null and length(trim(p_idempotency_key))>0 then
    select move_id into v_existing
    from public.cms_inventory_move_header
    where idempotency_key = trim(p_idempotency_key)
    limit 1;
    if v_existing is not null then return v_existing; end if;
  end if;

  v_move_id := gen_random_uuid();

  insert into public.cms_inventory_move_header(
    move_id, move_type, occurred_at, status, party_id, location_code,
    ref_doc_type, ref_doc_id, memo, source, meta, idempotency_key
  )
  values (
    v_move_id,
    'RECEIPT'::public.cms_e_inventory_move_type,
    coalesce(p_occurred_at, now()),
    'POSTED'::public.cms_e_inventory_move_status,
    p_vendor_party_id,
    nullif(trim(coalesce(p_location_code,'')),''),
    'PARTS_RECEIPT',
    v_move_id,
    nullif(trim(coalesce(p_memo,'')),''),
    nullif(trim(coalesce(p_source,'')),'MANUAL'),
    jsonb_build_object('module','PARTS','kind','RECEIPT'),
    nullif(trim(coalesce(p_idempotency_key,'')),'')
  );

  for v_i in 0..jsonb_array_length(p_lines)-1 loop
    v_line := p_lines->v_i;

    v_part_id := nullif(coalesce(v_line->>'part_id',''),'')::uuid;
    v_part_name := trim(coalesce(v_line->>'part_name',''));
    v_qty := (v_line->>'qty')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'qty must be >0'; end if;

    v_unit := public.cms_fn_part_normalize_unit_v1(coalesce(v_line->>'unit', null));
    v_cost := nullif(trim(coalesce(v_line->>'unit_cost_krw','')),'')::numeric;

    if v_part_id is null then
      if v_part_name = '' then
        raise exception 'part_id or part_name required';
      end if;

      v_part_id := public.cms_fn_find_part_id_by_name_v1(v_part_name);

      if v_part_id is null then
        v_part_id := public.cms_fn_upsert_part_item_v1(
          p_part_name := v_part_name,
          p_part_id := null,
          p_part_kind := 'PART'::public.cms_e_part_kind,
          p_family_name := null,
          p_spec_text := null,
          p_unit_default := v_unit,
          p_is_reusable := false,
          p_reorder_min_qty := null,
          p_reorder_max_qty := null,
          p_qr_code := null,
          p_note := 'auto-created from receipt',
          p_meta := jsonb_build_object('auto_created', true, 'source_move_id', v_move_id),
          p_actor_person_id := p_actor_person_id,
          p_correlation_id := p_correlation_id
        );
      end if;
    end if;

    if v_cost is null then
      select last_unit_cost_krw into v_cost
      from public.cms_part_item
      where part_id = v_part_id;
    end if;

    if v_cost is not null then v_amount := v_qty * v_cost; else v_amount := null; end if;

    insert into public.cms_inventory_move_line(
      move_id, line_no, direction, qty, unit,
      item_ref_type, master_id, part_id,
      item_name, variant_hint,
      ref_entity_type, ref_entity_id,
      meta, is_void,
      unit_cost_krw, amount_krw
    )
    values (
      v_move_id, v_i+1,
      'IN'::public.cms_e_inventory_direction,
      v_qty, v_unit,
      'PART'::public.cms_e_inventory_item_ref_type,
      null, v_part_id,
      (select part_name from public.cms_part_item where part_id=v_part_id),
      null,
      null, null,
      coalesce(v_line->'meta','{}'::jsonb),
      false,
      v_cost, v_amount
    );

    if v_cost is not null then
      update public.cms_part_item
      set last_unit_cost_krw = v_cost
      where part_id = v_part_id;
    end if;
  end loop;

  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, after, actor_person_id, note)
  values ('INVENTORY_MOVE', v_move_id, 'RECEIPT_PARTS',
          jsonb_build_object('move_id', v_move_id, 'lines', jsonb_array_length(p_lines)),
          p_actor_person_id, 'corr=' || p_correlation_id::text);

  return v_move_id;
end $$;

-- 4) record usage (OUT) : move_type='ISSUE'
create or replace function public.cms_fn_record_part_usage_v1(
  p_lines jsonb,
  p_occurred_at timestamptz default now(),
  p_location_code text default null,
  p_use_kind text default null,
  p_ref_doc_type text default null,
  p_ref_doc_id uuid default null,
  p_memo text default null,
  p_source text default 'MANUAL',
  p_idempotency_key text default null,
  p_actor_person_id uuid default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_move_id uuid;
  v_existing uuid;
  v_line jsonb;
  v_i int;
  v_part_id uuid;
  v_part_name text;
  v_qty numeric;
  v_unit text;
  v_cost numeric;
  v_amount numeric;
  v_item_name text;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'p_lines must be jsonb array';
  end if;

  if p_idempotency_key is not null and length(trim(p_idempotency_key))>0 then
    select move_id into v_existing
    from public.cms_inventory_move_header
    where idempotency_key = trim(p_idempotency_key)
    limit 1;
    if v_existing is not null then return v_existing; end if;
  end if;

  v_move_id := gen_random_uuid();

  insert into public.cms_inventory_move_header(
    move_id, move_type, occurred_at, status, party_id, location_code,
    ref_doc_type, ref_doc_id, memo, source, meta, idempotency_key
  )
  values (
    v_move_id,
    'ISSUE'::public.cms_e_inventory_move_type,
    coalesce(p_occurred_at, now()),
    'POSTED'::public.cms_e_inventory_move_status,
    null,
    nullif(trim(coalesce(p_location_code,'')),''),
    nullif(trim(coalesce(p_ref_doc_type,'')),''),
    p_ref_doc_id,
    nullif(trim(coalesce(p_memo,'')),''),
    nullif(trim(coalesce(p_source,'')),'MANUAL'),
    jsonb_build_object('module','PARTS','kind','USAGE','use_kind',nullif(trim(coalesce(p_use_kind,'')),'')),
    nullif(trim(coalesce(p_idempotency_key,'')),'')
  );

  for v_i in 0..jsonb_array_length(p_lines)-1 loop
    v_line := p_lines->v_i;

    v_part_id := nullif(coalesce(v_line->>'part_id',''),'')::uuid;
    v_part_name := trim(coalesce(v_line->>'part_name',''));
    v_qty := (v_line->>'qty')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'qty must be >0'; end if;

    v_unit := public.cms_fn_part_normalize_unit_v1(coalesce(v_line->>'unit', null));
    v_cost := nullif(trim(coalesce(v_line->>'unit_cost_krw','')),'')::numeric;

    if v_part_id is null and v_part_name <> '' then
      v_part_id := public.cms_fn_find_part_id_by_name_v1(v_part_name);
    end if;

    if v_part_id is not null then
      v_item_name := (select part_name from public.cms_part_item where part_id=v_part_id);

      if v_cost is null then
        select last_unit_cost_krw into v_cost
        from public.cms_part_item
        where part_id = v_part_id;
      end if;

      if v_cost is not null then v_amount := v_qty * v_cost; else v_amount := null; end if;

      insert into public.cms_inventory_move_line(
        move_id, line_no, direction, qty, unit,
        item_ref_type, master_id, part_id,
        item_name, variant_hint,
        ref_entity_type, ref_entity_id,
        meta, is_void,
        unit_cost_krw, amount_krw
      )
      values (
        v_move_id, v_i+1,
        'OUT'::public.cms_e_inventory_direction,
        v_qty, v_unit,
        'PART'::public.cms_e_inventory_item_ref_type,
        null, v_part_id,
        v_item_name,
        null,
        null, null,
        coalesce(v_line->'meta','{}'::jsonb),
        false,
        v_cost, v_amount
      );
    else
      if v_part_name = '' then
        raise exception 'part_id or part_name required';
      end if;

      insert into public.cms_inventory_move_line(
        move_id, line_no, direction, qty, unit,
        item_ref_type, master_id, part_id,
        item_name, variant_hint,
        ref_entity_type, ref_entity_id,
        meta, is_void,
        unit_cost_krw, amount_krw
      )
      values (
        v_move_id, v_i+1,
        'OUT'::public.cms_e_inventory_direction,
        v_qty, v_unit,
        'UNLINKED'::public.cms_e_inventory_item_ref_type,
        null, null,
        v_part_name,
        null,
        null, null,
        jsonb_build_object('unlinked', true, 'module', 'PARTS') || coalesce(v_line->'meta','{}'::jsonb),
        false,
        v_cost, case when v_cost is null then null else v_qty * v_cost end
      );
    end if;
  end loop;

  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, after, actor_person_id, note)
  values ('INVENTORY_MOVE', v_move_id, 'USAGE_PARTS',
          jsonb_build_object('move_id', v_move_id, 'lines', jsonb_array_length(p_lines)),
          p_actor_person_id, 'corr=' || p_correlation_id::text);

  return v_move_id;
end $$;

-- grants (authenticated)
grant execute on function public.cms_fn_find_part_id_by_name_v1(text) to authenticated;
grant execute on function public.cms_fn_part_normalize_unit_v1(text) to authenticated;
grant execute on function public.cms_fn_upsert_part_item_v1(
  text, uuid, public.cms_e_part_kind, text, text, text, boolean, numeric, numeric, text, text, jsonb, uuid, uuid
) to authenticated;
grant execute on function public.cms_fn_add_part_alias_v1(uuid, text, uuid, uuid) to authenticated;
grant execute on function public.cms_fn_record_part_receipt_v1(jsonb, timestamptz, text, uuid, text, text, text, uuid, uuid) to authenticated;
grant execute on function public.cms_fn_record_part_usage_v1(jsonb, timestamptz, text, text, text, uuid, text, text, text, uuid, uuid) to authenticated;
