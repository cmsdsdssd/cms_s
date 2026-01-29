set search_path = public, pg_temp;

-- ------------------------------------------------------------
-- 1) Quick Move v2: location_code 지원 (기존 v1은 유지)
-- ------------------------------------------------------------
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

grant execute on function public.cms_fn_quick_inventory_move_v2(
  public.cms_e_inventory_move_type, text, numeric, timestamptz, uuid, text, text, text, text, text, jsonb, text, uuid, text, uuid, uuid
) to authenticated;


-- ------------------------------------------------------------
-- 2) 위치별 재고 View (MASTER 기준)
-- ------------------------------------------------------------
drop view if exists public.cms_v_inventory_position_by_master_item_location_v1;
create view public.cms_v_inventory_position_by_master_item_location_v1
with (security_invoker = true)
as
select
  h.location_code,
  l.master_id,
  m.model_name,
  sum(case when l.direction='IN' then l.qty else -l.qty end) as on_hand_qty,
  max(h.occurred_at) as last_move_at
from public.cms_inventory_move_line l
join public.cms_inventory_move_header h on h.move_id = l.move_id
join public.cms_master_item m on m.master_id = l.master_id
where h.status = 'POSTED'
  and l.is_void = false
  and l.master_id is not null
group by h.location_code, l.master_id, m.model_name;

grant select on public.cms_v_inventory_position_by_master_item_location_v1 to authenticated;


drop view if exists public.cms_v_inventory_location_summary_v1;
create view public.cms_v_inventory_location_summary_v1
with (security_invoker = true)
as
select
  location_code,
  sum(on_hand_qty) as total_on_hand_qty,
  count(*) as sku_count,
  max(last_move_at) as last_move_at
from public.cms_v_inventory_position_by_master_item_location_v1
group by location_code;

grant select on public.cms_v_inventory_location_summary_v1 to authenticated;


-- ------------------------------------------------------------
-- 3) 위치 이동(Transfer) 1회 체크로 OUT+IN 생성
-- ------------------------------------------------------------
create or replace function public.cms_fn_transfer_inventory_v1(
  p_master_id uuid,
  p_qty numeric,
  p_from_location_code text,
  p_to_location_code text,
  p_occurred_at timestamptz default now(),
  p_memo text default null,
  p_meta jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
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
  v_item_name text;
  v_key text;
  v_out uuid;
  v_in uuid;
  v_from text;
  v_to text;
begin
  if p_master_id is null then raise exception 'master_id required'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'qty must be > 0'; end if;

  v_from := nullif(trim(coalesce(p_from_location_code,'')), '');
  v_to   := nullif(trim(coalesce(p_to_location_code,'')), '');

  if v_from is null then raise exception 'from_location_code required'; end if;
  if v_to is null then raise exception 'to_location_code required'; end if;
  if v_from = v_to then raise exception 'from/to location must differ'; end if;

  select model_name into v_item_name
  from public.cms_master_item
  where master_id = p_master_id;

  if v_item_name is null then
    raise exception 'master not found: %', p_master_id;
  end if;

  v_key := coalesce(nullif(trim(coalesce(p_idempotency_key,'')), ''), 'TRANSFER:' || p_correlation_id::text);

  -- OUT (ISSUE)
  v_out := public.cms_fn_upsert_inventory_move_header_v1(
    p_move_type := 'ISSUE'::public.cms_e_inventory_move_type,
    p_occurred_at := p_occurred_at,
    p_party_id := null,
    p_location_code := v_from,
    p_ref_doc_type := 'TRANSFER',
    p_ref_doc_id := p_correlation_id,
    p_memo := coalesce(p_memo, 'transfer out'),
    p_source := 'MANUAL',
    p_meta := coalesce(p_meta,'{}'::jsonb) || jsonb_build_object('transfer_key', v_key, 'from', v_from, 'to', v_to),
    p_move_id := null,
    p_idempotency_key := v_key || ':OUT',
    p_actor_person_id := p_actor_person_id,
    p_note := p_note,
    p_correlation_id := p_correlation_id
  );

  if not exists (select 1 from public.cms_inventory_move_header where move_id=v_out and status='POSTED') then
    update public.cms_inventory_move_line
    set is_void=true, void_reason='transfer_rebuild'
    where move_id=v_out and is_void=false;

    perform public.cms_fn_add_inventory_move_line_v1(
      p_move_id := v_out,
      p_direction := 'OUT'::public.cms_e_inventory_direction,
      p_qty := p_qty,
      p_item_name := v_item_name,
      p_unit := 'EA',
      p_item_ref_type := 'MASTER'::public.cms_e_inventory_item_ref_type,
      p_master_id := p_master_id,
      p_part_id := null,
      p_variant_hint := null,
      p_note := null,
      p_meta := jsonb_build_object('transfer_key', v_key),
      p_ref_entity_type := 'TRANSFER',
      p_ref_entity_id := p_correlation_id,
      p_actor_person_id := p_actor_person_id,
      p_note2 := p_note,
      p_correlation_id := p_correlation_id
    );

    perform public.cms_fn_post_inventory_move_v1(
      p_move_id := v_out,
      p_actor_person_id := p_actor_person_id,
      p_reason := 'transfer_out',
      p_note := p_note,
      p_correlation_id := p_correlation_id
    );
  end if;

  -- IN (RECEIPT)
  v_in := public.cms_fn_upsert_inventory_move_header_v1(
    p_move_type := 'RECEIPT'::public.cms_e_inventory_move_type,
    p_occurred_at := p_occurred_at,
    p_party_id := null,
    p_location_code := v_to,
    p_ref_doc_type := 'TRANSFER',
    p_ref_doc_id := p_correlation_id,
    p_memo := coalesce(p_memo, 'transfer in'),
    p_source := 'MANUAL',
    p_meta := coalesce(p_meta,'{}'::jsonb) || jsonb_build_object('transfer_key', v_key, 'from', v_from, 'to', v_to),
    p_move_id := null,
    p_idempotency_key := v_key || ':IN',
    p_actor_person_id := p_actor_person_id,
    p_note := p_note,
    p_correlation_id := p_correlation_id
  );

  if not exists (select 1 from public.cms_inventory_move_header where move_id=v_in and status='POSTED') then
    update public.cms_inventory_move_line
    set is_void=true, void_reason='transfer_rebuild'
    where move_id=v_in and is_void=false;

    perform public.cms_fn_add_inventory_move_line_v1(
      p_move_id := v_in,
      p_direction := 'IN'::public.cms_e_inventory_direction,
      p_qty := p_qty,
      p_item_name := v_item_name,
      p_unit := 'EA',
      p_item_ref_type := 'MASTER'::public.cms_e_inventory_item_ref_type,
      p_master_id := p_master_id,
      p_part_id := null,
      p_variant_hint := null,
      p_note := null,
      p_meta := jsonb_build_object('transfer_key', v_key),
      p_ref_entity_type := 'TRANSFER',
      p_ref_entity_id := p_correlation_id,
      p_actor_person_id := p_actor_person_id,
      p_note2 := p_note,
      p_correlation_id := p_correlation_id
    );

    perform public.cms_fn_post_inventory_move_v1(
      p_move_id := v_in,
      p_actor_person_id := p_actor_person_id,
      p_reason := 'transfer_in',
      p_note := p_note,
      p_correlation_id := p_correlation_id
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'transfer_key', v_key,
    'out_move_id', v_out,
    'in_move_id', v_in
  );
end $$;

grant execute on function public.cms_fn_transfer_inventory_v1(
  uuid, numeric, text, text, timestamptz, text, jsonb, text, uuid, text, uuid
) to authenticated;
