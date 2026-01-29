set search_path = public, pg_temp;

create or replace function public.cms_fn_emit_inventory_issue_from_shipment_confirmed_v1(
  p_shipment_id uuid,
  p_actor_person_id uuid default null::uuid,
  p_note text default null::text,
  p_correlation_id uuid default gen_random_uuid()
) returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
  if p_shipment_id is null then
    raise exception using errcode='P0001', message='shipment_id required';
  end if;

  select * into v_ship
  from public.cms_shipment_header
  where shipment_id = p_shipment_id
  for update;

  if not found then
    raise exception using errcode='P0001', message=format('shipment not found: %s', p_shipment_id);
  end if;

  if v_ship.status <> 'CONFIRMED'::public.cms_e_shipment_status then
    raise exception using errcode='P0001', message=format('shipment not CONFIRMED: %s (status=%s)', p_shipment_id, v_ship.status);
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

  if exists (
    select 1 from public.cms_inventory_move_header
    where move_id=v_move_id and status='POSTED'
  ) then
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

    v_master_id := r.master_id;

    -- 정책: 주문/출고 라인은 master_id 필수. repair 라인은 UNLINKED 허용(원하면 여기서도 막을 수 있음)
    if r.order_line_id is not null and v_master_id is null then
      raise exception using
        errcode='P0001',
        message=format('master_id required to emit inventory (shipment_line_id=%s, order_line_id=%s)', r.shipment_line_id, r.order_line_id);
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

  perform public.cms_fn_post_inventory_move_v1(
    v_move_id,
    p_actor_person_id,
    'auto_post_from_shipment',
    p_note,
    p_correlation_id
  );

  return v_move_id;
end $function$;
