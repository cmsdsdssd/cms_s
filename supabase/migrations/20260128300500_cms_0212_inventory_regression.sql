-- 20260128300500_cms_0212_inventory_regression.sql
set search_path = public, pg_temp;

do $$
declare
  v_move_receipt uuid;
  v_move_issue uuid;
  v_onhand numeric;
begin
  -- 1) DRAFT 생성 + 라인 추가 → position에 영향 없음
  v_move_receipt := public.cms_fn_upsert_inventory_move_header_v1(
    p_move_type := 'RECEIPT',
    p_occurred_at := now(),
    p_party_id := null,
    p_location_code := null,
    p_ref_doc_type := null,
    p_ref_doc_id := null,
    p_memo := 'regression receipt draft',
    p_source := 'TEST',
    p_meta := '{}'::jsonb,
    p_move_id := null,
    p_idempotency_key := 'REG:HDR:RECEIPT:1',
    p_actor_person_id := null,
    p_note := 'reg1',
    p_correlation_id := gen_random_uuid()
  );

  perform public.cms_fn_add_inventory_move_line_v1(
    p_move_id := v_move_receipt,
    p_direction := 'IN',
    p_qty := 10,
    p_item_name := 'REG_ITEM_A',
    p_unit := 'EA',
    p_item_ref_type := 'UNLINKED',
    p_master_id := null,
    p_part_id := null,
    p_variant_hint := null,
    p_note := null,
    p_meta := '{}'::jsonb,
    p_ref_entity_type := null,
    p_ref_entity_id := null,
    p_actor_person_id := null,
    p_note2 := 'reg1',
    p_correlation_id := gen_random_uuid()
  );

  select coalesce(on_hand_qty,0) into v_onhand
  from public.cms_v_inventory_position_by_item_label_v1
  where item_ref_type='UNLINKED' and item_name='REG_ITEM_A'
  limit 1;

  if v_onhand <> 0 then
    raise exception 'REG-1 failed: draft should not affect position (got %)', v_onhand;
  end if;

  -- 2) POST 실행 → position 증가
  perform public.cms_fn_post_inventory_move_v1(v_move_receipt, null, 'reg-post', 'reg2', gen_random_uuid());

  select on_hand_qty into v_onhand
  from public.cms_v_inventory_position_by_item_label_v1
  where item_ref_type='UNLINKED' and item_name='REG_ITEM_A'
  limit 1;

  if v_onhand <> 10 then
    raise exception 'REG-2 failed: expected on_hand 10, got %', v_onhand;
  end if;

  -- 3) ISSUE 문서 quick POST → position 감소
  v_move_issue := public.cms_fn_quick_inventory_move_v1(
    p_move_type := 'ISSUE',
    p_item_name := 'REG_ITEM_A',
    p_qty := 4,
    p_occurred_at := now(),
    p_party_id := null,
    p_variant_hint := null,
    p_unit := 'EA',
    p_source := 'TEST',
    p_memo := 'regression issue',
    p_meta := '{}'::jsonb,
    p_idempotency_key := 'REG:ISSUE:1',
    p_actor_person_id := null,
    p_note := 'reg3',
    p_correlation_id := gen_random_uuid()
  );

  select on_hand_qty into v_onhand
  from public.cms_v_inventory_position_by_item_label_v1
  where item_ref_type='UNLINKED' and item_name='REG_ITEM_A'
  limit 1;

  if v_onhand <> 6 then
    raise exception 'REG-3 failed: expected on_hand 6, got %', v_onhand;
  end if;

  -- 4) POSTED 문서 VOID → position 원복
  perform public.cms_fn_void_inventory_move_v1(v_move_issue, 'reg-void', null, 'reg4', gen_random_uuid());

  select on_hand_qty into v_onhand
  from public.cms_v_inventory_position_by_item_label_v1
  where item_ref_type='UNLINKED' and item_name='REG_ITEM_A'
  limit 1;

  if v_onhand <> 10 then
    raise exception 'REG-4 failed: expected on_hand back to 10, got %', v_onhand;
  end if;

  -- 5) idempotency_key 재호출 → 동일 move_id
  if public.cms_fn_upsert_inventory_move_header_v1(
    'RECEIPT', now(), null, null, null, null,
    'regression receipt draft', 'TEST', '{}'::jsonb,
    null, 'REG:HDR:RECEIPT:1', null, 'reg5', gen_random_uuid()
  ) <> v_move_receipt then
    raise exception 'REG-5 failed: idempotency_key should return same move_id';
  end if;

end $$;
