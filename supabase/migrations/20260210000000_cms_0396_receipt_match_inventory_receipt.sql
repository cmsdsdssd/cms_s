set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- Receipt match <-> inventory receipt bridge
-- - CONFIRMED transition  : emit inventory RECEIPT(+)
-- - CONFIRMED cancellation: emit inventory ISSUE(-) reversal
-- ---------------------------------------------------------------------

create table if not exists public.cms_receipt_match_inventory_link (
  receipt_id uuid not null,
  receipt_line_uuid uuid not null,
  order_line_id uuid not null,

  active boolean not null default true,

  qty numeric not null,
  item_name text not null,
  item_ref_type public.cms_e_inventory_item_ref_type not null,
  master_id uuid null,
  variant_hint text null,

  location_code text not null,
  bin_code text null,

  receipt_move_id uuid not null,
  reverse_move_id uuid null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (receipt_id, receipt_line_uuid, order_line_id),
  unique (receipt_move_id),
  unique (reverse_move_id)
);

do $$
begin
  create trigger trg_cms_receipt_match_inventory_link_updated_at
  before update on public.cms_receipt_match_inventory_link
  for each row execute function public.cms_fn_set_updated_at();
exception when duplicate_object then null;
end $$;

create index if not exists idx_cms_receipt_match_inventory_link_active
  on public.cms_receipt_match_inventory_link(active);

grant select on public.cms_receipt_match_inventory_link to authenticated, service_role;

create or replace function public.cms_fn_emit_inventory_receipt_from_match_v1(
  p_receipt_id uuid,
  p_receipt_line_uuid uuid,
  p_order_line_id uuid,
  p_shipment_line_id uuid default null,
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
  v_link public.cms_receipt_match_inventory_link%rowtype;
  v_shipment_line public.cms_shipment_line%rowtype;
  v_shipment_header public.cms_shipment_header%rowtype;
  v_order_line public.cms_order_line%rowtype;

  v_qty numeric;
  v_item_name text;
  v_variant_hint text;
  v_item_ref_type public.cms_e_inventory_item_ref_type;
  v_master_id uuid;
  v_location_code text;
  v_bin_code text;

  v_move_id uuid;
begin
  select * into v_link
  from public.cms_receipt_match_inventory_link
  where receipt_id = p_receipt_id
    and receipt_line_uuid = p_receipt_line_uuid
    and order_line_id = p_order_line_id
  for update;

  if found and v_link.active is true then
    return v_link.receipt_move_id;
  end if;

  select * into v_order_line
  from public.cms_order_line
  where order_line_id = p_order_line_id;

  if not found then
    raise exception 'order line not found: %', p_order_line_id;
  end if;

  if p_shipment_line_id is not null then
    select * into v_shipment_line
    from public.cms_shipment_line
    where shipment_line_id = p_shipment_line_id;
  end if;

  if not found then
    select * into v_shipment_line
    from public.cms_shipment_line
    where order_line_id = p_order_line_id
      and purchase_receipt_line_uuid = p_receipt_line_uuid
    order by created_at desc
    limit 1;
  end if;

  if found then
    select * into v_shipment_header
    from public.cms_shipment_header
    where shipment_id = v_shipment_line.shipment_id;
  end if;

  v_qty := greatest(coalesce(v_shipment_line.qty, v_order_line.qty, 0), 0);
  if v_qty <= 0 then
    raise exception 'invalid qty at match receipt emit (order_line=%)', p_order_line_id;
  end if;

  v_master_id := coalesce(v_shipment_line.master_id, v_order_line.matched_master_id);
  v_item_ref_type := case when v_master_id is null
    then 'UNLINKED'::public.cms_e_inventory_item_ref_type
    else 'MASTER'::public.cms_e_inventory_item_ref_type
  end;

  v_item_name := coalesce(
    nullif(trim(coalesce(v_shipment_line.model_name, '')), ''),
    nullif(trim(coalesce(v_order_line.model_name, '')), ''),
    nullif(trim(coalesce(v_order_line.model_name_raw, '')), ''),
    'UNKNOWN_ITEM'
  );

  v_variant_hint := concat_ws(' / ',
    nullif(trim(coalesce(v_shipment_line.suffix, '')), ''),
    nullif(trim(coalesce(v_shipment_line.color, '')), ''),
    nullif(trim(coalesce(v_shipment_line.size::text, '')), ''),
    nullif(trim(coalesce(v_order_line.suffix, '')), ''),
    nullif(trim(coalesce(v_order_line.color, '')), ''),
    nullif(trim(coalesce(v_order_line.size::text, '')), '')
  );

  v_location_code := coalesce(
    nullif(trim(coalesce(v_shipment_header.source_location_code, '')), ''),
    case when v_shipment_header.is_store_pickup is true then 'STORE' else null end,
    'OFFICE'
  );
  v_bin_code := nullif(trim(coalesce(v_shipment_header.source_bin_code, '')), '');

  -- if location/bin validator exists, use it preemptively
  begin
    perform public.cms_fn_assert_location_active_v1(v_location_code, v_bin_code);
  exception
    when undefined_function then null;
  end;

  v_move_id := public.cms_fn_upsert_inventory_move_header_v1(
    p_move_type := 'RECEIPT'::public.cms_e_inventory_move_type,
    p_occurred_at := now(),
    p_party_id := v_order_line.customer_party_id,
    p_location_code := v_location_code,
    p_ref_doc_type := 'RECEIPT_MATCH',
    p_ref_doc_id := p_receipt_id,
    p_memo := coalesce(p_note, 'auto receipt from receipt-line match confirm'),
    p_source := 'AUTO_MATCH',
    p_meta := jsonb_build_object(
      'receipt_id', p_receipt_id,
      'receipt_line_uuid', p_receipt_line_uuid,
      'order_line_id', p_order_line_id,
      'shipment_line_id', v_shipment_line.shipment_line_id,
      'location_code', v_location_code,
      'bin_code', v_bin_code
    ),
    p_move_id := null,
    p_idempotency_key := null,
    p_actor_person_id := p_actor_person_id,
    p_note := p_note,
    p_correlation_id := p_correlation_id
  );

  begin
    update public.cms_inventory_move_header
    set bin_code = v_bin_code
    where move_id = v_move_id;
  exception
    when undefined_column then null;
  end;

  perform public.cms_fn_add_inventory_move_line_v1(
    p_move_id := v_move_id,
    p_direction := 'IN'::public.cms_e_inventory_direction,
    p_qty := v_qty,
    p_item_name := v_item_name,
    p_unit := 'EA',
    p_item_ref_type := v_item_ref_type,
    p_master_id := v_master_id,
    p_part_id := null,
    p_variant_hint := nullif(v_variant_hint, ''),
    p_note := null,
    p_meta := jsonb_build_object(
      'receipt_id', p_receipt_id,
      'receipt_line_uuid', p_receipt_line_uuid,
      'order_line_id', p_order_line_id,
      'shipment_line_id', v_shipment_line.shipment_line_id,
      'kind', 'RECEIPT_MATCH_CONFIRM'
    ),
    p_ref_entity_type := 'ORDER_LINE',
    p_ref_entity_id := p_order_line_id,
    p_actor_person_id := p_actor_person_id,
    p_note2 := p_note,
    p_correlation_id := p_correlation_id
  );

  perform public.cms_fn_post_inventory_move_v1(
    p_move_id := v_move_id,
    p_actor_person_id := p_actor_person_id,
    p_reason := 'receipt_match_confirm',
    p_note := p_note,
    p_correlation_id := p_correlation_id
  );

  insert into public.cms_receipt_match_inventory_link(
    receipt_id, receipt_line_uuid, order_line_id,
    active,
    qty, item_name, item_ref_type, master_id, variant_hint,
    location_code, bin_code,
    receipt_move_id,
    reverse_move_id
  )
  values (
    p_receipt_id, p_receipt_line_uuid, p_order_line_id,
    true,
    v_qty, v_item_name, v_item_ref_type, v_master_id, nullif(v_variant_hint, ''),
    v_location_code, v_bin_code,
    v_move_id,
    null
  )
  on conflict (receipt_id, receipt_line_uuid, order_line_id)
  do update set
    active = true,
    qty = excluded.qty,
    item_name = excluded.item_name,
    item_ref_type = excluded.item_ref_type,
    master_id = excluded.master_id,
    variant_hint = excluded.variant_hint,
    location_code = excluded.location_code,
    bin_code = excluded.bin_code,
    receipt_move_id = excluded.receipt_move_id,
    reverse_move_id = null,
    updated_at = now();

  return v_move_id;
end $$;

grant execute on function public.cms_fn_emit_inventory_receipt_from_match_v1(uuid, uuid, uuid, uuid, uuid, text, uuid)
  to authenticated, service_role;

create or replace function public.cms_fn_reverse_inventory_receipt_from_match_v1(
  p_receipt_id uuid,
  p_receipt_line_uuid uuid,
  p_order_line_id uuid,
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
  v_link public.cms_receipt_match_inventory_link%rowtype;
  v_move_id uuid;
begin
  select * into v_link
  from public.cms_receipt_match_inventory_link
  where receipt_id = p_receipt_id
    and receipt_line_uuid = p_receipt_line_uuid
    and order_line_id = p_order_line_id
  for update;

  if not found then
    return null;
  end if;

  if v_link.active is false then
    return v_link.reverse_move_id;
  end if;

  v_move_id := public.cms_fn_upsert_inventory_move_header_v1(
    p_move_type := 'ISSUE'::public.cms_e_inventory_move_type,
    p_occurred_at := now(),
    p_party_id := null,
    p_location_code := v_link.location_code,
    p_ref_doc_type := 'RECEIPT_MATCH_REVERSE',
    p_ref_doc_id := p_receipt_id,
    p_memo := coalesce(p_note, 'auto reverse receipt from match cancel'),
    p_source := 'AUTO_MATCH_REVERSE',
    p_meta := jsonb_build_object(
      'receipt_id', p_receipt_id,
      'receipt_line_uuid', p_receipt_line_uuid,
      'order_line_id', p_order_line_id,
      'receipt_move_id', v_link.receipt_move_id,
      'location_code', v_link.location_code,
      'bin_code', v_link.bin_code
    ),
    p_move_id := null,
    p_idempotency_key := null,
    p_actor_person_id := p_actor_person_id,
    p_note := p_note,
    p_correlation_id := p_correlation_id
  );

  begin
    update public.cms_inventory_move_header
    set bin_code = v_link.bin_code
    where move_id = v_move_id;
  exception
    when undefined_column then null;
  end;

  perform public.cms_fn_add_inventory_move_line_v1(
    p_move_id := v_move_id,
    p_direction := 'OUT'::public.cms_e_inventory_direction,
    p_qty := v_link.qty,
    p_item_name := v_link.item_name,
    p_unit := 'EA',
    p_item_ref_type := v_link.item_ref_type,
    p_master_id := v_link.master_id,
    p_part_id := null,
    p_variant_hint := v_link.variant_hint,
    p_note := null,
    p_meta := jsonb_build_object(
      'receipt_id', p_receipt_id,
      'receipt_line_uuid', p_receipt_line_uuid,
      'order_line_id', p_order_line_id,
      'receipt_move_id', v_link.receipt_move_id,
      'kind', 'RECEIPT_MATCH_CANCEL'
    ),
    p_ref_entity_type := 'ORDER_LINE',
    p_ref_entity_id := p_order_line_id,
    p_actor_person_id := p_actor_person_id,
    p_note2 := p_note,
    p_correlation_id := p_correlation_id
  );

  perform public.cms_fn_post_inventory_move_v1(
    p_move_id := v_move_id,
    p_actor_person_id := p_actor_person_id,
    p_reason := 'receipt_match_cancel',
    p_note := p_note,
    p_correlation_id := p_correlation_id
  );

  update public.cms_receipt_match_inventory_link
  set
    active = false,
    reverse_move_id = v_move_id,
    updated_at = now()
  where receipt_id = p_receipt_id
    and receipt_line_uuid = p_receipt_line_uuid
    and order_line_id = p_order_line_id;

  return v_move_id;
end $$;

grant execute on function public.cms_fn_reverse_inventory_receipt_from_match_v1(uuid, uuid, uuid, uuid, text, uuid)
  to authenticated, service_role;

create or replace function public.cms_fn_receipt_match_inventory_sync_trg_v1()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'CONFIRMED'::public.cms_e_receipt_line_match_status then
      perform public.cms_fn_emit_inventory_receipt_from_match_v1(
        new.receipt_id,
        new.receipt_line_uuid,
        new.order_line_id,
        new.shipment_line_id,
        new.confirmed_by,
        new.note,
        gen_random_uuid()
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status is distinct from new.status then
      if new.status = 'CONFIRMED'::public.cms_e_receipt_line_match_status then
        perform public.cms_fn_emit_inventory_receipt_from_match_v1(
          new.receipt_id,
          new.receipt_line_uuid,
          new.order_line_id,
          new.shipment_line_id,
          new.confirmed_by,
          new.note,
          gen_random_uuid()
        );
      elsif old.status = 'CONFIRMED'::public.cms_e_receipt_line_match_status then
        perform public.cms_fn_reverse_inventory_receipt_from_match_v1(
          old.receipt_id,
          old.receipt_line_uuid,
          old.order_line_id,
          new.confirmed_by,
          new.note,
          gen_random_uuid()
        );
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status = 'CONFIRMED'::public.cms_e_receipt_line_match_status then
      perform public.cms_fn_reverse_inventory_receipt_from_match_v1(
        old.receipt_id,
        old.receipt_line_uuid,
        old.order_line_id,
        old.confirmed_by,
        old.note,
        gen_random_uuid()
      );
    end if;
    return old;
  end if;

  return null;
end $$;

drop trigger if exists trg_cms_receipt_match_inventory_sync on public.cms_receipt_line_match;

create trigger trg_cms_receipt_match_inventory_sync
after insert or update of status or delete
on public.cms_receipt_line_match
for each row execute function public.cms_fn_receipt_match_inventory_sync_trg_v1();
