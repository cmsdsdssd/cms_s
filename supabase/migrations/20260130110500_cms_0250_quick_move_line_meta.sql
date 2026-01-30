set search_path = public, pg_temp;

-- quick move: line.meta를 비우지 말고 header meta(예: session_id) + kind를 함께 기록
create or replace function public.cms_fn_quick_inventory_move_v2(
  p_move_type public.cms_e_inventory_move_type,
  p_item_name text,
  p_qty numeric,
  p_occurred_at timestamptz default now(),
  p_party_id uuid default null,
  p_location_code text default null,
  p_variant_hint text default null,
  p_unit text default 'EA',
  p_source text default 'MANUAL',
  p_memo text default null,
  p_meta jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid(),
  p_master_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_move_id uuid;
  v_dir public.cms_e_inventory_direction;
  v_ref_type public.cms_e_inventory_item_ref_type;
  v_loc text;
  v_line_meta jsonb;
begin
  if p_move_type is null then raise exception 'move_type required'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'qty must be > 0'; end if;
  if p_item_name is null or length(trim(p_item_name))=0 then raise exception 'item_name required'; end if;

  v_loc := nullif(trim(coalesce(p_location_code,'')), '');

  if p_master_id is not null then
    v_ref_type := 'MASTER'::public.cms_e_inventory_item_ref_type;
  else
    v_ref_type := 'UNLINKED'::public.cms_e_inventory_item_ref_type;
  end if;

  v_move_id := public.cms_fn_upsert_inventory_move_header_v1(
    p_move_type := p_move_type,
    p_occurred_at := p_occurred_at,
    p_party_id := p_party_id,
    p_location_code := v_loc,
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

  -- ✅ 분석을 위해 line.meta에도 최소 분류 정보를 남긴다.
  v_line_meta := coalesce(p_meta, '{}'::jsonb) || jsonb_build_object(
    'kind', 'QUICK_MOVE',
    'move_type', p_move_type,
    'source', coalesce(nullif(trim(coalesce(p_source,'')),''),'MANUAL')
  );

  perform public.cms_fn_add_inventory_move_line_v1(
    p_move_id := v_move_id,
    p_direction := v_dir,
    p_qty := p_qty,
    p_item_name := p_item_name,
    p_unit := p_unit,
    p_item_ref_type := v_ref_type,
    p_master_id := p_master_id,
    p_part_id := null,
    p_variant_hint := p_variant_hint,
    p_note := null,
    p_meta := v_line_meta,
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

grant execute on function public.cms_fn_quick_inventory_move_v2(
  public.cms_e_inventory_move_type, text, numeric, timestamptz, uuid, text, text, text, text, text, jsonb, text, uuid, text, uuid, uuid
) to authenticated;
