set search_path = public, pg_temp;
-- v2: shipment confirmed -> inventory ISSUE + BOM components(optional, best-effort)
create or replace function public.cms_fn_emit_inventory_issue_from_shipment_confirmed_v2(
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
  v_line_no int := 0;
  v_item_name text;
  v_variant text;
  v_master_id uuid;

  v_bom_id uuid;
  v_match_kind text;
  v_matched_variant_key text;
  c record;

  v_bom_applied_lines int := 0;
  v_bom_warnings jsonb := '[]'::jsonb;
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

  -- 이미 POSTED면 재생성하지 않음(정합성 강요 X, 대신 기록 보존)
  if exists (
    select 1 from public.cms_inventory_move_header
    where move_id = v_move_id and status = 'POSTED'::public.cms_e_inventory_move_status
  ) then
    return v_move_id;
  end if;

  -- rebuild
  update public.cms_inventory_move_line
  set is_void = true, void_reason = 'rebuild_from_shipment'
  where move_id = v_move_id and is_void = false;

  for r in
    select * from public.cms_shipment_line
    where shipment_id = p_shipment_id
    order by created_at asc
  loop
    -- 1) shipped item line
    v_line_no := v_line_no + 1;

    v_item_name := coalesce(
      nullif(trim(coalesce(r.model_name,'')), ''),
      nullif(trim(coalesce(r.ad_hoc_name,'')), ''),
      'UNKNOWN_ITEM'
    );

    v_variant := concat_ws(' / ',
      nullif(trim(coalesce(r.suffix,'')), ''),
      nullif(trim(coalesce(r.color,'')), ''),
      nullif(trim(coalesce(r.size,'')), '')
    );

    v_master_id := null;
    if r.model_name is not null and length(trim(r.model_name)) > 0 then
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
      p_unit := 'EA'::text,
      p_item_ref_type := case
        when v_master_id is not null then 'MASTER'::public.cms_e_inventory_item_ref_type
        else 'UNLINKED'::public.cms_e_inventory_item_ref_type
      end,
      p_master_id := v_master_id,
      p_part_id := null,
      p_variant_hint := nullif(v_variant,''),
      p_note := null,
      p_meta := jsonb_build_object(
        'shipment_line_id', r.shipment_line_id,
        'kind', 'SHIPMENT_ITEM'
      ),
      p_ref_entity_type := 'SHIPMENT_LINE',
      p_ref_entity_id := r.shipment_line_id,
      p_move_line_id := null,
      p_actor_person_id := p_actor_person_id,
      p_note2 := p_note,
      p_correlation_id := p_correlation_id
    );

    -- 2) BOM component lines (best-effort, BOM 없으면 스킵)
    if v_master_id is not null then
      select rr.bom_id, rr.match_kind, rr.matched_variant_key
      into v_bom_id, v_match_kind, v_matched_variant_key
      from public.cms_fn_resolve_bom_recipe_v1(v_master_id, nullif(v_variant,''))
      rr;

      if v_bom_id is not null then
        for c in
          select
            l.bom_line_id,
            l.component_ref_type,
            l.component_master_id,
            cm.model_name as component_master_model_name,
            l.component_part_id,
            cp.part_name as component_part_name,
            l.qty_per_unit,
            l.unit
          from public.cms_bom_recipe_line l
          left join public.cms_master_item cm on cm.master_id = l.component_master_id
          left join public.cms_part_item cp on cp.part_id = l.component_part_id
          where l.bom_id = v_bom_id and l.is_void = false
          order by l.line_no asc
        loop
          begin
            v_line_no := v_line_no + 1;

            perform public.cms_fn_upsert_inventory_move_line_v1(
              p_move_id := v_move_id,
              p_line_no := v_line_no,
              p_direction := 'OUT'::public.cms_e_inventory_direction,
              p_qty := (c.qty_per_unit * r.qty),
              p_item_name := case
                when c.component_ref_type = 'PART'::public.cms_e_inventory_item_ref_type then coalesce(c.component_part_name, 'UNKNOWN_PART')
                else coalesce(c.component_master_model_name, 'UNKNOWN_MASTER')
              end,
              p_unit := coalesce(nullif(trim(coalesce(c.unit,'')),''), 'EA'),
              p_item_ref_type := c.component_ref_type,
              p_master_id := c.component_master_id,
              p_part_id := c.component_part_id,
              p_variant_hint := null,
              p_note := null,
              p_meta := jsonb_build_object(
                'shipment_line_id', r.shipment_line_id,
                'kind', 'BOM_COMPONENT',
                'bom_id', v_bom_id,
                'bom_line_id', c.bom_line_id,
                'bom_match_kind', v_match_kind,
                'bom_matched_variant_key', v_matched_variant_key,
                'shipped_master_id', v_master_id,
                'shipped_qty', r.qty
              ),
              p_ref_entity_type := 'SHIPMENT_LINE',
              p_ref_entity_id := r.shipment_line_id,
              p_move_line_id := null,
              p_actor_person_id := p_actor_person_id,
              p_note2 := p_note,
              p_correlation_id := p_correlation_id
            );

            v_bom_applied_lines := v_bom_applied_lines + 1;
          exception when others then
            v_bom_warnings := v_bom_warnings || jsonb_build_array(jsonb_build_object(
              'shipment_line_id', r.shipment_line_id,
              'bom_id', v_bom_id,
              'bom_line_id', c.bom_line_id,
              'error', sqlerrm
            ));
          end;
        end loop;
      end if;
    end if;
  end loop;

  -- meta에 BOM 적용 결과 남김(분석/디버깅용) - 실패해도 출고 확정 흐름 막지 않음
  update public.cms_inventory_move_header
  set meta = coalesce(meta,'{}'::jsonb) || jsonb_build_object(
    'bom_applied_lines', v_bom_applied_lines,
    'bom_warnings', v_bom_warnings
  )
  where move_id = v_move_id;

  perform public.cms_fn_post_inventory_move_v1(
    v_move_id,
    p_actor_person_id,
    'auto_post_from_shipment',
    p_note,
    p_correlation_id
  );

  return v_move_id;
end $$;
alter function public.cms_fn_emit_inventory_issue_from_shipment_confirmed_v2(uuid,uuid,text,uuid)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_emit_inventory_issue_from_shipment_confirmed_v2(uuid,uuid,text,uuid)
  to authenticated, service_role;
-- confirm_shipment_v2: emit function을 v2로 교체
create or replace function public.cms_fn_confirm_shipment_v2(
  p_shipment_id uuid,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_emit_inventory boolean default true,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  v_result jsonb;
  v_emit uuid;
  v_corr uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  v_result := public.cms_fn_confirm_shipment(p_shipment_id, p_actor_person_id, p_note);

  if p_emit_inventory then
    v_emit := public.cms_fn_emit_inventory_issue_from_shipment_confirmed_v2(
      p_shipment_id,
      p_actor_person_id,
      p_note,
      v_corr
    );

    v_result := v_result
      || jsonb_build_object(
        'inventory_emit', v_emit,
        'inventory_correlation_id', v_corr
      );
  end if;

  return v_result;
end $$;
alter function public.cms_fn_confirm_shipment_v2(uuid,uuid,text,boolean,uuid)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_confirm_shipment_v2(uuid,uuid,text,boolean,uuid)
  to authenticated;
