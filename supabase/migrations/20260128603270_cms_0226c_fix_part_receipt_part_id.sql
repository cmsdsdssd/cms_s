set search_path = public, pg_temp;
-- (선택) 혹시 p_note 붙은 overload가 있으면 제거해서 모호성/오작동 원천 차단
drop function if exists public.cms_fn_record_part_receipt_v1(
  jsonb, timestamptz, text, uuid, text, text, text, uuid, uuid, text
);
-- ✅ FIXED: PART 라인은 part_id 없으면 절대 insert 못하게 강제
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
) returns uuid as $$
declare
  v_move_id uuid;
  v_line jsonb;
  v_line_no int := 0;

  v_part_id uuid;
  v_part_name text;

  v_qty numeric;
  v_unit text;
  v_unit_cost numeric;
  v_item_name text;

begin
  if p_idempotency_key is not null then
    select move_id into v_move_id
    from public.cms_inventory_move_header
    where idempotency_key = p_idempotency_key;
    if v_move_id is not null then
      return v_move_id;
    end if;
  end if;

  insert into public.cms_inventory_move_header (
    move_type, occurred_at, status, location_code, memo, source, vendor_party_id, idempotency_key, meta
  ) values (
    'RECEIPT',
    p_occurred_at,
    'POSTED',
    coalesce(p_location_code, 'MAIN'),
    p_memo,
    p_source,
    p_vendor_party_id,
    p_idempotency_key,
    jsonb_build_object('module', 'PARTS', 'correlation_id', p_correlation_id)
  )
  returning move_id into v_move_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_line_no := v_line_no + 1;

    -- ✅ 다양한 키를 받아도 part_id를 제대로 잡도록 (혹시 로컬 코드가 꼬여도 방어)
    v_part_id :=
      nullif(trim(coalesce(
        v_line->>'part_id',
        v_line->>'part_item_id',
        ''
      )), '')::uuid;

    v_part_name := trim(coalesce(
      v_line->>'part_name',
      v_line->>'item_name',
      ''
    ));

    if v_part_id is null then
      if v_part_name = '' then
        raise exception 'PART RECEIPT line %: part_id or part_name(item_name) required', v_line_no;
      end if;

      -- 이름으로 찾기
      select part_id into v_part_id
      from public.cms_part_item
      where part_name = v_part_name
      limit 1;

      -- 없으면 자동 생성(현 로직 의도 유지)
      if v_part_id is null then
        v_part_id := public.cms_fn_upsert_part_item_v1(
          p_part_id := null,
          p_part_name := v_part_name,
          p_part_kind := 'PART'::public.cms_e_part_kind,
          p_family_name := null,
          p_spec_text := null,
          p_unit_default := null,
          p_is_reusable := false,
          p_reorder_min_qty := null,
          p_reorder_max_qty := null,
          p_qr_code := null,
          p_note := 'auto-created by receipt',
          p_meta := '{}'::jsonb,
          p_actor_person_id := p_actor_person_id,
          p_correlation_id := p_correlation_id
        );
      end if;
    end if;

    -- ✅ 여기서부터는 part_id가 무조건 있어야 함
    if v_part_id is null then
      raise exception 'PART RECEIPT line %: part_id resolved to NULL unexpectedly', v_line_no;
    end if;

    v_qty := (v_line->>'qty')::numeric;
    v_unit := public.cms_fn_part_normalize_unit_v1(v_line->>'unit');

    v_unit_cost := nullif(coalesce(v_line->>'unit_cost_krw',''), '')::numeric;
    if v_unit_cost is null then
      raise exception 'PART RECEIPT line %: unit_cost_krw is required', v_line_no;
    end if;

    select part_name into v_item_name
    from public.cms_part_item
    where part_id = v_part_id;

    if v_item_name is null then
      raise exception 'PART RECEIPT line %: part_name not found for part_id=%', v_line_no, v_part_id;
    end if;

    insert into public.cms_inventory_move_line (
      move_id, line_no, direction, qty, unit,
      item_ref_type, master_id, part_id, item_name,
      variant_hint, ref_entity_type, ref_entity_id,
      meta, is_void,
      unit_cost_krw, amount_krw
    ) values (
      v_move_id, v_line_no, 'IN', v_qty, v_unit,
      'PART'::public.cms_e_inventory_item_ref_type, null, v_part_id, v_item_name,
      null, null, null,
      '{}'::jsonb, false,
      v_unit_cost, v_qty * v_unit_cost
    );

    update public.cms_part_item
    set last_unit_cost_krw = v_unit_cost
    where part_id = v_part_id;
  end loop;

  return v_move_id;
end;
$$ language plpgsql security definer;
