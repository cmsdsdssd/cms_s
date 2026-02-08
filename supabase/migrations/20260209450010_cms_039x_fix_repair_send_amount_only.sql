begin;

create or replace function public.cms_fn_send_repair_to_shipment_v2(
  p_repair_id uuid,
  p_target_shipment_id uuid default null,
  p_extra_fee_krw numeric default 0,
  p_extra_fee_reason text default null,
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
  r_repair public.cms_repair_line%rowtype;
  v_shipment_id uuid;
  v_line_id uuid;
  v_existing uuid;
  r_ship public.cms_shipment_header%rowtype;
begin
  if p_repair_id is null then
    raise exception using errcode='P0001', message='repair_id required';
  end if;

  select * into r_repair
  from public.cms_repair_line
  where repair_line_id = p_repair_id
  for update;

  if r_repair.repair_line_id is null then
    raise exception using errcode='P0001', message='repair not found';
  end if;

  if r_repair.status in ('CANCELLED','SHIPPED','CLOSED') then
    raise exception using errcode='P0001', message='repair not eligible for shipment';
  end if;

  if coalesce(p_extra_fee_krw,0) > 0 and coalesce(nullif(trim(p_extra_fee_reason),''),'') is null then
    raise exception using errcode='P0001', message='extra_fee_reason required when extra_fee_krw > 0';
  end if;

  select shipment_id into v_existing
  from public.cms_shipment_line
  where repair_line_id = p_repair_id
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  if p_target_shipment_id is not null then
    select * into r_ship
    from public.cms_shipment_header
    where shipment_id = p_target_shipment_id
    for update;

    if r_ship.shipment_id is null then
      raise exception using errcode='P0001', message='target shipment not found';
    end if;
    if r_ship.status <> 'DRAFT'::public.cms_e_shipment_status then
      raise exception using errcode='P0001', message='target shipment must be DRAFT';
    end if;
    if r_ship.customer_party_id <> r_repair.customer_party_id then
      raise exception using errcode='P0001', message='target shipment customer mismatch';
    end if;

    v_shipment_id := p_target_shipment_id;

    update public.cms_shipment_header
    set source_type = coalesce(source_type, 'REPAIR'),
        source_id = coalesce(source_id, p_repair_id)
    where shipment_id = v_shipment_id;
  else
    v_shipment_id := public.cms_fn_create_shipment_header_v1(
      r_repair.customer_party_id,
      current_date,
      coalesce(p_note, 'repair shipment')
    );

    update public.cms_shipment_header
    set source_type = 'REPAIR',
        source_id = p_repair_id
    where shipment_id = v_shipment_id;
  end if;

  -- ✅ 핵심: 수리 전송 라인은 기본 AMOUNT_ONLY로 생성 (중량 없어도 확정 가능)
  v_line_id := public.cms_fn_add_shipment_line_from_repair_v1(
    v_shipment_id,
    p_repair_id,
    r_repair.qty,
    'AMOUNT_ONLY'::public.cms_e_pricing_mode,
    null,
    r_repair.material_code,
    r_repair.is_plated,
    r_repair.plating_variant_id,
    null,
    null,
    coalesce(p_extra_fee_krw,0),
    p_note
  );

  update public.cms_shipment_line
  set repair_fee_reason = p_extra_fee_reason
  where shipment_line_id = v_line_id;

  update public.cms_repair_line
  set status = 'READY_TO_SHIP'::public.cms_e_repair_status,
      repair_fee_krw = coalesce(p_extra_fee_krw,0),
      repair_fee_reason = p_extra_fee_reason,
      updated_at = now()
  where repair_line_id = p_repair_id;

  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, note)
  values (
    'REPAIR_LINE',
    p_repair_id,
    'SEND_TO_SHIPMENT_V2',
    jsonb_build_object('status', r_repair.status),
    jsonb_build_object(
      'shipment_id', v_shipment_id,
      'shipment_line_id', v_line_id,
      'extra_fee_krw', p_extra_fee_krw,
      'extra_fee_reason', p_extra_fee_reason
    ),
    p_actor_person_id,
    p_note
  );

  return v_shipment_id;
end $$;

alter function public.cms_fn_send_repair_to_shipment_v2(uuid,uuid,numeric,text,uuid,text,uuid)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_send_repair_to_shipment_v2(uuid,uuid,numeric,text,uuid,text,uuid)
  to authenticated, service_role;

commit;
