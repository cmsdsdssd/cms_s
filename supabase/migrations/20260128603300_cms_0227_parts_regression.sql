set search_path = public, pg_temp;

do $$
declare
  v_part_ball uuid;
  v_part_wire uuid;
  v_move_in uuid;
  v_move_use uuid;
  v_onhand numeric;
  v_cost numeric;
  v_unlinked_cnt int;
begin
  -- seed: part masters
  v_part_ball := public.cms_fn_upsert_part_item_v1(
    p_part_id := null,
    p_part_name := '은볼 3mm',
    p_part_kind := 'PART'::public.cms_e_part_kind,
    p_family_name := '볼',
    p_spec_text := '3mm',
    p_unit_default := 'EA',
    p_is_reusable := false,
    p_reorder_min_qty := 100,
    p_reorder_max_qty := 1000,
    p_qr_code := null,
    p_note := 'seed',
    p_meta := '{}'::jsonb,
    p_actor_person_id := null,
    p_correlation_id := gen_random_uuid()
  );

  v_part_wire := public.cms_fn_upsert_part_item_v1(
    p_part_id := null,
    p_part_name := '은선 0.8mm',
    p_part_kind := 'PART'::public.cms_e_part_kind,
    p_family_name := '와이어',
    p_spec_text := '0.8mm',
    p_unit_default := 'G',
    p_is_reusable := false,
    p_reorder_min_qty := null,
    p_reorder_max_qty := null,
    p_qr_code := null,
    p_note := 'seed',
    p_meta := '{}'::jsonb,
    p_actor_person_id := null,
    p_correlation_id := gen_random_uuid()
  );

  -- REG-1: receipt increases on_hand
  v_move_in := public.cms_fn_record_part_receipt_v1(
    p_lines := jsonb_build_array(
      jsonb_build_object('part_id', v_part_ball, 'qty', 10, 'unit', 'EA', 'unit_cost_krw', 1000),
      jsonb_build_object('part_id', v_part_wire, 'qty', 2.5, 'unit', 'G', 'unit_cost_krw', 80000)
    ),
    p_occurred_at := now(),
    p_location_code := 'MAIN',
    p_vendor_party_id := null,
    p_memo := 'seed receipt',
    p_source := 'TEST',
    p_idempotency_key := null,
    p_actor_person_id := null,
    p_correlation_id := gen_random_uuid()
  );

  select on_hand_qty into v_onhand
  from public.cms_v_part_master_with_position_v1
  where part_id = v_part_ball;

  if coalesce(v_onhand,0) <> 10 then
    raise exception 'REG-1 failed: expected on_hand=10 got=%', v_onhand;
  end if;

  -- REG-2: usage decreases on_hand + cost auto-filled when omitted
  v_move_use := public.cms_fn_record_part_usage_v1(
    p_lines := jsonb_build_array(
      jsonb_build_object('part_id', v_part_ball, 'qty', 3, 'unit', 'EA')  -- no unit_cost_krw
    ),
    p_occurred_at := now(),
    p_location_code := 'MAIN',
    p_use_kind := '제작',
    p_ref_doc_type := null,
    p_ref_doc_id := null,
    p_memo := 'seed usage',
    p_source := 'TEST',
    p_idempotency_key := null,
    p_actor_person_id := null,
    p_correlation_id := gen_random_uuid()
  );

  select on_hand_qty into v_onhand
  from public.cms_v_part_master_with_position_v1
  where part_id = v_part_ball;

  if coalesce(v_onhand,0) <> 7 then
    raise exception 'REG-2 failed: expected on_hand=7 got=%', v_onhand;
  end if;

  select unit_cost_krw into v_cost
  from public.cms_v_part_move_lines_v1
  where move_id = v_move_use and part_id = v_part_ball
  limit 1;

  if v_cost is distinct from 1000 then
    raise exception 'REG-2 failed: expected unit_cost_krw=1000 got=%', v_cost;
  end if;

  -- REG-3: unlinked usage is allowed and appears in worklist
  perform public.cms_fn_record_part_usage_v1(
    p_lines := jsonb_build_array(
      jsonb_build_object('part_name', '미등록부속_테스트', 'qty', 1, 'unit', 'EA')
    ),
    p_occurred_at := now(),
    p_location_code := 'MAIN',
    p_use_kind := '포장',
    p_ref_doc_type := null,
    p_ref_doc_id := null,
    p_memo := 'unlinked usage',
    p_source := 'TEST',
    p_idempotency_key := null,
    p_actor_person_id := null,
    p_correlation_id := gen_random_uuid()
  );

  select count(*) into v_unlinked_cnt
  from public.cms_v_part_unlinked_worklist_v1
  where entered_name = '미등록부속_테스트';

  if v_unlinked_cnt < 1 then
    raise exception 'REG-3 failed: expected unlinked worklist row';
  end if;

  -- REG-4: daily stats view works
  perform 1 from public.cms_v_part_usage_daily_v1 limit 1;

  -- REG-5: ledger view works
  perform 1 from public.cms_v_part_move_lines_v1 limit 1;

end $$;
