set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 1) Location / Bin master
-- ---------------------------------------------------------------------
create table if not exists public.cms_location (
  location_code text primary key,
  location_name text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  note text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cms_location_bin (
  bin_code text primary key,
  location_code text not null references public.cms_location(location_code),
  bin_name text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  note text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  create trigger trg_cms_location_updated_at
  before update on public.cms_location
  for each row execute function public.cms_fn_set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_cms_location_bin_updated_at
  before update on public.cms_location_bin
  for each row execute function public.cms_fn_set_updated_at();
exception when duplicate_object then null; end $$;

insert into public.cms_location(location_code, location_name, is_active, sort_order, note)
values
  ('OFFICE', '사무실', true, 10, '3F + B1 top-level'),
  ('STORE', '매장', true, 20, 'store top-level'),
  ('OFFSITE', '외부보관', true, 30, 'homes / offsite top-level')
on conflict (location_code) do update
set
  location_name = excluded.location_name,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  note = excluded.note,
  updated_at = now();

insert into public.cms_location_bin(bin_code, location_code, bin_name, is_active, sort_order)
values
  ('F3', 'OFFICE', 'Office 3F', true, 10),
  ('B1', 'OFFICE', 'Office B1', true, 20),
  ('FRONT', 'STORE', 'Store Front', true, 10),
  ('BACK', 'STORE', 'Store Back', true, 20),
  ('HOME_ME', 'OFFSITE', 'Home Me', true, 10),
  ('HOME_MOM', 'OFFSITE', 'Home Mom', true, 20),
  ('HOME_SEJIN_MOM', 'OFFSITE', 'Home Sejin Mom', true, 30)
on conflict (bin_code) do update
set
  location_code = excluded.location_code,
  bin_name = excluded.bin_name,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

grant select on public.cms_location to anon, authenticated;
grant select on public.cms_location_bin to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) Schema expansion + normalization/backfill
-- ---------------------------------------------------------------------
alter table public.cms_inventory_move_header
  add column if not exists bin_code text;

alter table public.cms_inventory_count_session
  add column if not exists bin_code text;

alter table public.cms_shipment_header
  add column if not exists source_location_code text;

alter table public.cms_shipment_header
  add column if not exists source_bin_code text;

update public.cms_inventory_move_header
set location_code = case
  when location_code in ('MAIN', 'WAREHOUSE') then 'OFFICE'
  when location_code = 'SHOP' then 'STORE'
  when location_code = 'FACTORY' then 'OFFSITE'
  else location_code
end
where location_code in ('MAIN', 'WAREHOUSE', 'SHOP', 'FACTORY');

update public.cms_inventory_count_session
set location_code = case
  when location_code in ('MAIN', 'WAREHOUSE') then 'OFFICE'
  when location_code = 'SHOP' then 'STORE'
  when location_code = 'FACTORY' then 'OFFSITE'
  else location_code
end
where location_code in ('MAIN', 'WAREHOUSE', 'SHOP', 'FACTORY');

update public.cms_shipment_header
set source_location_code = case
  when is_store_pickup is true then 'STORE'
  else 'OFFICE'
end
where source_location_code is null;

update public.cms_shipment_header
set source_location_code = case
  when source_location_code in ('MAIN', 'WAREHOUSE') then 'OFFICE'
  when source_location_code = 'SHOP' then 'STORE'
  when source_location_code = 'FACTORY' then 'OFFSITE'
  else source_location_code
end
where source_location_code in ('MAIN', 'WAREHOUSE', 'SHOP', 'FACTORY');

update public.cms_inventory_move_header h
set
  location_code = coalesce(
    sh.source_location_code,
    case when sh.is_store_pickup is true then 'STORE' else 'OFFICE' end,
    'OFFICE'
  ),
  meta = coalesce(h.meta, '{}'::jsonb) || jsonb_build_object('backfilled', true, 'backfilled_at', now())
from public.cms_shipment_header sh
where h.status = 'POSTED'
  and h.location_code is null
  and h.ref_doc_type = 'SHIPMENT'
  and h.ref_doc_id = sh.shipment_id;

update public.cms_inventory_move_header h
set
  location_code = 'OFFICE',
  meta = coalesce(h.meta, '{}'::jsonb) || jsonb_build_object('backfilled', true, 'backfilled_at', now())
where h.status = 'POSTED'
  and h.location_code is null;

alter table public.cms_shipment_header
  alter column source_location_code set default 'OFFICE';

update public.cms_shipment_header
set source_location_code = 'OFFICE'
where source_location_code is null;

alter table public.cms_shipment_header
  alter column source_location_code set not null;

create index if not exists idx_cms_inventory_move_header_location_bin
  on public.cms_inventory_move_header(location_code, bin_code);

create index if not exists idx_cms_shipment_header_source_location
  on public.cms_shipment_header(source_location_code, source_bin_code);

create index if not exists idx_cms_count_session_location_bin
  on public.cms_inventory_count_session(location_code, bin_code);

-- ---------------------------------------------------------------------
-- 3) Common location/bin guard
-- ---------------------------------------------------------------------
create or replace function public.cms_fn_assert_location_active_v1(
  p_location_code text,
  p_bin_code text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_loc text := nullif(trim(coalesce(p_location_code,'')), '');
  v_bin text := nullif(trim(coalesce(p_bin_code,'')), '');
begin
  if v_loc is null then
    raise exception 'location_code required';
  end if;

  if not exists (
    select 1 from public.cms_location
    where location_code = v_loc
      and is_active = true
  ) then
    raise exception 'inactive/unknown location_code: %', v_loc;
  end if;

  if v_bin is null then
    return;
  end if;

  if not exists (
    select 1 from public.cms_location_bin
    where bin_code = v_bin
      and location_code = v_loc
      and is_active = true
  ) then
    raise exception 'inactive/unknown bin_code (%), location_code (%)', v_bin, v_loc;
  end if;
end $$;

grant execute on function public.cms_fn_assert_location_active_v1(text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3-1) Quick move v2 with bin support
-- ---------------------------------------------------------------------
create or replace function public.cms_fn_quick_inventory_move_v2(
  p_move_type public.cms_e_inventory_move_type,
  p_item_name text,
  p_qty numeric,
  p_occurred_at timestamptz default now(),
  p_party_id uuid default null,
  p_location_code text default null,
  p_bin_code text default null,
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
  v_bin text;
begin
  if p_move_type is null then raise exception 'move_type required'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'qty must be > 0'; end if;
  if p_item_name is null or length(trim(p_item_name))=0 then raise exception 'item_name required'; end if;

  v_loc := nullif(trim(coalesce(p_location_code,'')), '');
  v_bin := nullif(trim(coalesce(p_bin_code,'')), '');
  perform public.cms_fn_assert_location_active_v1(v_loc, v_bin);

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

  update public.cms_inventory_move_header
  set bin_code = v_bin
  where move_id = v_move_id;

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
  public.cms_e_inventory_move_type, text, numeric, timestamptz, uuid, text, text, text, text, text, text, jsonb, text, uuid, text, uuid, uuid
) to authenticated;

-- ---------------------------------------------------------------------
-- 3-2) Stocktake session create with bin support
-- ---------------------------------------------------------------------
create or replace function public.cms_fn_create_inventory_count_session_v1(
  p_snapshot_at timestamptz,
  p_location_code text default null,
  p_bin_code text default null,
  p_session_code text default null,
  p_memo text default null,
  p_meta jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
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
  v_existing uuid;
  v_id uuid;
  v_after jsonb;
  v_loc text := nullif(trim(coalesce(p_location_code,'')), '');
  v_bin text := nullif(trim(coalesce(p_bin_code,'')), '');
begin
  if p_snapshot_at is null then
    raise exception 'snapshot_at required';
  end if;

  perform public.cms_fn_assert_location_active_v1(v_loc, v_bin);

  if p_idempotency_key is not null and length(trim(p_idempotency_key))>0 then
    select session_id into v_existing
    from public.cms_inventory_count_session
    where idempotency_key = trim(p_idempotency_key)
    limit 1;

    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  v_id := gen_random_uuid();

  insert into public.cms_inventory_count_session(
    session_id, session_code, snapshot_at, location_code, bin_code,
    status, memo, meta, idempotency_key
  )
  values (
    v_id,
    nullif(trim(coalesce(p_session_code,'')), ''),
    p_snapshot_at,
    v_loc,
    v_bin,
    'DRAFT'::public.cms_e_inventory_count_status,
    p_memo,
    coalesce(p_meta, '{}'::jsonb),
    nullif(trim(coalesce(p_idempotency_key,'')), '')
  );

  v_after := jsonb_build_object(
    'session_id', v_id,
    'session_code', nullif(trim(coalesce(p_session_code,'')), ''),
    'snapshot_at', p_snapshot_at,
    'location_code', v_loc,
    'bin_code', v_bin,
    'status', 'DRAFT',
    'memo', p_memo,
    'meta', coalesce(p_meta, '{}'::jsonb),
    'idempotency_key', nullif(trim(coalesce(p_idempotency_key,'')), '')
  );

  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, occurred_at, note)
  values ('STOCKTAKE_SESSION', v_id, 'CREATE', '{}'::jsonb, v_after, p_actor_person_id, now(), coalesce(p_note,'') || ' corr=' || p_correlation_id::text);

  insert into public.cms_status_event(entity_type, entity_id, from_status, to_status, occurred_at, actor_person_id, reason, correlation_id)
  values ('STOCKTAKE_SESSION', v_id, null, 'DRAFT', now(), p_actor_person_id, 'create', p_correlation_id);

  return v_id;
end $$;

grant execute on function public.cms_fn_create_inventory_count_session_v1(
  timestamptz, text, text, text, text, jsonb, text, uuid, text, uuid
) to authenticated;

-- ---------------------------------------------------------------------
-- 4) POST guard: posted move requires valid location/bin
-- ---------------------------------------------------------------------
create or replace function public.cms_fn_post_inventory_move_v1(
  p_move_id uuid,
  p_actor_person_id uuid default null,
  p_reason text default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hdr public.cms_inventory_move_header%rowtype;
  v_line_cnt int;
  v_before jsonb;
  v_after jsonb;
begin
  if p_move_id is null then
    raise exception 'move_id required';
  end if;

  select * into v_hdr
  from public.cms_inventory_move_header
  where move_id = p_move_id
  for update;

  if not found then
    raise exception 'inventory move not found: %', p_move_id;
  end if;

  if v_hdr.status = 'POSTED'::public.cms_e_inventory_move_status then
    return;
  end if;

  if v_hdr.status = 'VOID'::public.cms_e_inventory_move_status then
    raise exception 'cannot post VOID move: %', p_move_id;
  end if;

  perform public.cms_fn_assert_location_active_v1(v_hdr.location_code, v_hdr.bin_code);

  select count(*) into v_line_cnt
  from public.cms_inventory_move_line
  where move_id = p_move_id
    and is_void = false;

  if v_line_cnt <= 0 then
    raise exception 'cannot post: no active lines (move_id=%)', p_move_id;
  end if;

  if v_hdr.move_type = 'RECEIPT'::public.cms_e_inventory_move_type then
    if exists (
      select 1 from public.cms_inventory_move_line
      where move_id = p_move_id and is_void=false and direction <> 'IN'::public.cms_e_inventory_direction
    ) then
      raise exception 'RECEIPT must have only IN lines (move_id=%)', p_move_id;
    end if;
  elsif v_hdr.move_type = 'ISSUE'::public.cms_e_inventory_move_type then
    if exists (
      select 1 from public.cms_inventory_move_line
      where move_id = p_move_id and is_void=false and direction <> 'OUT'::public.cms_e_inventory_direction
    ) then
      raise exception 'ISSUE must have only OUT lines (move_id=%)', p_move_id;
    end if;
  end if;

  v_before := jsonb_build_object(
    'status', v_hdr.status,
    'posted_at', v_hdr.posted_at,
    'line_count', v_line_cnt,
    'location_code', v_hdr.location_code,
    'bin_code', v_hdr.bin_code
  );

  update public.cms_inventory_move_header
  set
    status = 'POSTED'::public.cms_e_inventory_move_status,
    posted_at = now()
  where move_id = p_move_id;

  v_after := jsonb_build_object(
    'status', 'POSTED',
    'posted_at', now(),
    'line_count', v_line_cnt,
    'location_code', v_hdr.location_code,
    'bin_code', v_hdr.bin_code
  );

  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, occurred_at, note)
  values ('INVENTORY_MOVE', p_move_id, 'POST', v_before, v_after, p_actor_person_id, now(), coalesce(p_note,'') || ' corr=' || p_correlation_id::text);

  insert into public.cms_status_event(entity_type, entity_id, from_status, to_status, occurred_at, actor_person_id, reason, correlation_id)
  values ('INVENTORY_MOVE', p_move_id, v_hdr.status::text, 'POSTED', now(), p_actor_person_id, p_reason, p_correlation_id);
end $$;

-- ---------------------------------------------------------------------
-- 5) Shipment source location setter
-- ---------------------------------------------------------------------
create or replace function public.cms_fn_set_shipment_source_location_v1(
  p_shipment_id uuid,
  p_source_location_code text,
  p_source_bin_code text default null,
  p_actor_person_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hdr public.cms_shipment_header%rowtype;
  v_loc text := nullif(trim(coalesce(p_source_location_code,'')), '');
  v_bin text := nullif(trim(coalesce(p_source_bin_code,'')), '');
begin
  select * into v_hdr
  from public.cms_shipment_header
  where shipment_id = p_shipment_id
  for update;

  if not found then
    raise exception 'shipment not found: %', p_shipment_id;
  end if;

  if v_loc is null then
    raise exception 'source_location_code required';
  end if;

  if v_hdr.is_store_pickup is true then
    v_loc := 'STORE';
  end if;

  perform public.cms_fn_assert_location_active_v1(v_loc, v_bin);

  update public.cms_shipment_header
  set
    source_location_code = v_loc,
    source_bin_code = v_bin,
    updated_at = now()
  where shipment_id = p_shipment_id;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'source_location_code', v_loc,
    'source_bin_code', v_bin,
    'note', p_note
  );
end $$;

grant execute on function public.cms_fn_set_shipment_source_location_v1(uuid, text, text, uuid, text)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6) Store pickup setter/confirm should force STORE source
-- ---------------------------------------------------------------------
create or replace function public.cms_fn_set_shipment_store_pickup_v1(
  p_shipment_id uuid,
  p_is_store_pickup boolean,
  p_actor_person_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_hdr public.cms_shipment_header%rowtype;
begin
  select * into v_hdr
  from public.cms_shipment_header
  where shipment_id = p_shipment_id
  for update;

  if not found then
    raise exception 'shipment not found: %', p_shipment_id;
  end if;

  update public.cms_shipment_header
  set
    is_store_pickup = p_is_store_pickup,
    source_location_code = case when p_is_store_pickup then 'STORE' else coalesce(source_location_code, 'OFFICE') end,
    source_bin_code = case when p_is_store_pickup then source_bin_code else source_bin_code end,
    updated_at = now()
  where shipment_id = p_shipment_id;

  if p_is_store_pickup then
    perform public.cms_fn_assert_location_active_v1('STORE', v_hdr.source_bin_code);
  end if;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'is_store_pickup', p_is_store_pickup,
    'source_location_code', case when p_is_store_pickup then 'STORE' else coalesce(v_hdr.source_location_code, 'OFFICE') end,
    'note', p_note
  );
end $$;

alter function public.cms_fn_set_shipment_store_pickup_v1(uuid, boolean, uuid, text) security definer;
grant execute on function public.cms_fn_set_shipment_store_pickup_v1(uuid, boolean, uuid, text)
  to anon, authenticated, service_role;

create or replace function public.cms_fn_confirm_store_pickup_v1(
  p_shipment_id uuid,
  p_actor_person_id uuid default null::uuid,
  p_note text default null::text,
  p_emit_inventory boolean default true,
  p_correlation_id uuid default null,
  p_cost_mode text default 'PROVISIONAL',
  p_receipt_id uuid default null,
  p_cost_lines jsonb default '[]'::jsonb,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_result jsonb;
begin
  update public.cms_shipment_header
  set
    is_store_pickup = true,
    ship_date = current_date,
    source_location_code = 'STORE'
  where shipment_id = p_shipment_id;

  v_result := public.cms_fn_confirm_shipment_v3_cost_v1(
    p_shipment_id,
    p_actor_person_id,
    p_note,
    p_emit_inventory,
    p_correlation_id,
    p_cost_mode,
    p_receipt_id,
    p_cost_lines,
    p_force
  );

  return v_result;
end $$;

alter function public.cms_fn_confirm_store_pickup_v1(uuid, uuid, text, boolean, uuid, text, uuid, jsonb, boolean)
  security definer;
grant execute on function public.cms_fn_confirm_store_pickup_v1(uuid, uuid, text, boolean, uuid, text, uuid, jsonb, boolean)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 7) Shipment confirm -> inventory issue must use shipment source location/bin
-- ---------------------------------------------------------------------
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
  v_source_location text;
  v_source_bin text;

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

  v_source_location := coalesce(nullif(trim(coalesce(v_ship.source_location_code,'')), ''), case when v_ship.is_store_pickup then 'STORE' else 'OFFICE' end);
  v_source_bin := nullif(trim(coalesce(v_ship.source_bin_code,'')), '');

  perform public.cms_fn_assert_location_active_v1(v_source_location, v_source_bin);

  v_key := 'SHIPMENT_CONFIRMED:' || p_shipment_id::text;

  v_move_id := public.cms_fn_upsert_inventory_move_header_v1(
    p_move_type := 'ISSUE'::public.cms_e_inventory_move_type,
    p_occurred_at := coalesce(v_ship.confirmed_at, now()),
    p_party_id := v_ship.customer_party_id,
    p_location_code := v_source_location,
    p_ref_doc_type := 'SHIPMENT',
    p_ref_doc_id := p_shipment_id,
    p_memo := coalesce(p_note, 'auto issue from shipment confirmed'),
    p_source := 'AUTO_SHIPMENT',
    p_meta := jsonb_build_object('shipment_id', p_shipment_id, 'source_location_code', v_source_location, 'source_bin_code', v_source_bin),
    p_move_id := null,
    p_idempotency_key := v_key,
    p_actor_person_id := p_actor_person_id,
    p_note := p_note,
    p_correlation_id := p_correlation_id
  );

  -- already posted: idempotent return
  if exists (
    select 1 from public.cms_inventory_move_header
    where move_id = v_move_id and status = 'POSTED'::public.cms_e_inventory_move_status
  ) then
    return v_move_id;
  end if;

  update public.cms_inventory_move_header
  set
    location_code = v_source_location,
    bin_code = v_source_bin,
    meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('source_location_code', v_source_location, 'source_bin_code', v_source_bin)
  where move_id = v_move_id;

  update public.cms_inventory_move_line
  set is_void = true, void_reason = 'rebuild_from_shipment'
  where move_id = v_move_id and is_void = false;

  for r in
    select * from public.cms_shipment_line
    where shipment_id = p_shipment_id
    order by created_at asc
  loop
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

    if v_master_id is not null then
      select rr.bom_id, rr.match_kind, rr.matched_variant_key
      into v_bom_id, v_match_kind, v_matched_variant_key
      from public.cms_fn_resolve_bom_recipe_v1(v_master_id, nullif(v_variant,'')) rr;

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

  update public.cms_inventory_move_header
  set meta = coalesce(meta,'{}'::jsonb) || jsonb_build_object(
    'bom_applied_lines', v_bom_applied_lines,
    'bom_warnings', v_bom_warnings,
    'source_location_code', v_source_location,
    'source_bin_code', v_source_bin
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

-- ---------------------------------------------------------------------
-- 8) Count session views / move views include bin_code
-- ---------------------------------------------------------------------
drop view if exists public.cms_v_inventory_move_worklist_v1;
create view public.cms_v_inventory_move_worklist_v1
with (security_invoker = true)
as
select
  h.move_id,
  h.move_no,
  h.move_type,
  h.status,
  h.occurred_at,
  h.party_id,
  p.name as party_name,
  h.location_code,
  h.bin_code,
  h.ref_doc_type,
  h.ref_doc_id,
  h.memo,
  h.source,
  h.meta,
  h.idempotency_key,
  h.posted_at,
  h.voided_at,
  h.void_reason,
  h.created_at,
  h.updated_at,
  count(l.move_line_id) filter (where l.is_void = false) as line_count,
  coalesce(sum(case when l.is_void=false and l.direction='IN'  then l.qty else 0 end),0) as total_in_qty,
  coalesce(sum(case when l.is_void=false and l.direction='OUT' then l.qty else 0 end),0) as total_out_qty
from public.cms_inventory_move_header h
left join public.cms_party p on p.party_id = h.party_id
left join public.cms_inventory_move_line l on l.move_id = h.move_id
group by
  h.move_id, h.move_no, h.move_type, h.status, h.occurred_at,
  h.party_id, p.name, h.location_code, h.bin_code, h.ref_doc_type, h.ref_doc_id,
  h.memo, h.source, h.meta, h.idempotency_key, h.posted_at,
  h.voided_at, h.void_reason, h.created_at, h.updated_at;

drop view if exists public.cms_v_inventory_move_lines_enriched_v1;
create view public.cms_v_inventory_move_lines_enriched_v1
with (security_invoker = true)
as
select
  h.move_id,
  h.move_no,
  h.move_type,
  h.status as move_status,
  h.occurred_at,
  h.party_id,
  p.name as party_name,
  h.location_code,
  h.bin_code,
  h.ref_doc_type,
  h.ref_doc_id,
  h.memo as move_memo,
  h.source as move_source,
  l.move_line_id,
  l.line_no,
  l.direction,
  l.qty,
  l.unit,
  l.item_ref_type,
  l.master_id,
  m.model_name as master_model_name,
  l.item_name,
  l.variant_hint,
  l.note as line_note,
  l.meta as line_meta,
  l.is_void,
  l.void_reason,
  l.ref_entity_type,
  l.ref_entity_id,
  case when l.direction='IN' then l.qty else -l.qty end as signed_qty,
  l.created_at as line_created_at,
  l.updated_at as line_updated_at
from public.cms_inventory_move_header h
join public.cms_inventory_move_line l on l.move_id = h.move_id
left join public.cms_party p on p.party_id = h.party_id
left join public.cms_master_item m on m.master_id = l.master_id;

drop view if exists public.cms_v_inventory_count_sessions_v1;
create view public.cms_v_inventory_count_sessions_v1
with (security_invoker = true)
as
select
  s.session_id,
  s.session_no,
  s.session_code,
  s.snapshot_at,
  s.location_code,
  s.bin_code,
  s.status,
  s.memo,
  s.meta,
  s.generated_move_id,
  mh.move_no as generated_move_no,
  mh.status as generated_move_status,
  s.finalized_at,
  s.voided_at,
  s.void_reason,
  s.created_at,
  s.updated_at,
  count(l.count_line_id) filter (where l.is_void=false) as line_count,
  count(l.count_line_id) filter (where l.is_void=false and coalesce(l.delta_qty,0) <> 0) as delta_line_count,
  coalesce(sum(abs(coalesce(l.delta_qty,0))) filter (where l.is_void=false), 0) as sum_abs_delta
from public.cms_inventory_count_session s
left join public.cms_inventory_count_line l on l.session_id = s.session_id
left join public.cms_inventory_move_header mh on mh.move_id = s.generated_move_id
group by
  s.session_id, s.session_no, s.session_code, s.snapshot_at, s.location_code, s.bin_code, s.status,
  s.memo, s.meta, s.generated_move_id, mh.move_no, mh.status,
  s.finalized_at, s.voided_at, s.void_reason, s.created_at, s.updated_at;

drop view if exists public.cms_v_inventory_count_lines_enriched_v1 cascade;
create view public.cms_v_inventory_count_lines_enriched_v1
with (security_invoker = true)
as
select
  s.session_id,
  s.session_no,
  s.session_code,
  s.snapshot_at,
  s.location_code,
  s.bin_code,
  s.status as session_status,
  s.generated_move_id,
  l.count_line_id,
  l.line_no,
  l.item_ref_type,
  l.master_id,
  m.model_name as master_model_name,
  l.part_id,
  l.item_name,
  l.variant_hint,
  l.counted_qty,
  l.system_qty_asof,
  l.delta_qty,
  abs(coalesce(l.delta_qty,0)) as abs_delta_qty,
  l.note,
  l.meta,
  l.is_void,
  l.void_reason,
  l.created_at,
  l.updated_at
from public.cms_inventory_count_session s
join public.cms_inventory_count_line l on l.session_id = s.session_id
left join public.cms_master_item m on m.master_id = l.master_id;

drop view if exists public.cms_v_inventory_stocktake_variance_v1;
create view public.cms_v_inventory_stocktake_variance_v1
with (security_invoker = true)
as
select
  session_id,
  session_no,
  session_code,
  snapshot_at,
  location_code,
  bin_code,
  session_status,
  generated_move_id,
  count_line_id,
  line_no,
  item_ref_type,
  master_id,
  master_model_name,
  item_name,
  variant_hint,
  counted_qty,
  system_qty_asof,
  delta_qty,
  abs_delta_qty,
  is_void,
  void_reason,
  created_at
from public.cms_v_inventory_count_lines_enriched_v1
where is_void = false
order by abs_delta_qty desc, line_no asc;

-- ---------------------------------------------------------------------
-- 9) Inventory Health views
-- ---------------------------------------------------------------------
drop view if exists public.cms_v_inventory_health_summary_v1;
create view public.cms_v_inventory_health_summary_v1
with (security_invoker = true)
as
with
posted_30 as (
  select count(*)::int as cnt
  from public.cms_inventory_move_header
  where status='POSTED'
    and occurred_at >= now() - interval '30 days'
),
posted_90 as (
  select count(*)::int as cnt
  from public.cms_inventory_move_header
  where status='POSTED'
    and occurred_at >= now() - interval '90 days'
),
posted_null_30 as (
  select count(*)::int as cnt
  from public.cms_inventory_move_header
  where status='POSTED'
    and location_code is null
    and occurred_at >= now() - interval '30 days'
),
posted_null_90 as (
  select count(*)::int as cnt
  from public.cms_inventory_move_header
  where status='POSTED'
    and location_code is null
    and occurred_at >= now() - interval '90 days'
),
neg as (
  select count(*)::int as cnt
  from public.cms_v_inventory_position_by_item_label_v1
  where on_hand_qty < 0
),
unlinked as (
  select count(*)::int as cnt
  from public.cms_inventory_move_header h
  join public.cms_inventory_move_line l on l.move_id=h.move_id
  where h.status='POSTED'
    and l.is_void=false
    and l.item_ref_type='UNLINKED'
),
stale as (
  select count(*)::int as cnt
  from public.cms_inventory_move_header
  where status='DRAFT'
    and updated_at < now() - interval '24 hours'
),
loc as (
  select
    sum(case when location_code='OFFICE' then on_hand_qty else 0 end) as office_onhand,
    sum(case when location_code='STORE' then on_hand_qty else 0 end) as store_onhand,
    sum(case when location_code='OFFSITE' then on_hand_qty else 0 end) as offsite_onhand,
    count(*) filter (where on_hand_qty <> 0) as locations_with_stock
  from (
    select location_code, sum(on_hand_qty) as on_hand_qty
    from public.cms_v_inventory_position_by_master_item_location_v1
    group by location_code
  ) x
)
select
  now() as measured_at,
  (select cnt from posted_30) as posted_moves_30d,
  (select cnt from posted_90) as posted_moves_90d,
  (select cnt from posted_null_30) as posted_null_location_30d,
  (select cnt from posted_null_90) as posted_null_location_90d,
  (select cnt from neg) as negative_stock_sku_count,
  (select cnt from unlinked) as unlinked_posted_line_count,
  (select cnt from stale) as stale_draft_move_count,
  coalesce((select office_onhand from loc), 0) as office_onhand_qty,
  coalesce((select store_onhand from loc), 0) as store_onhand_qty,
  coalesce((select offsite_onhand from loc), 0) as offsite_onhand_qty,
  coalesce((select locations_with_stock from loc), 0) as locations_with_stock_count;

drop view if exists public.cms_v_inventory_health_issues_v1;
create view public.cms_v_inventory_health_issues_v1
with (security_invoker = true)
as
select
  e.exception_type as issue_type,
  e.severity,
  e.entity_id,
  e.occurred_at,
  e.details,
  null::text as location_code,
  null::text as bin_code
from public.cms_v_inventory_exceptions_v1 e

union all
select
  'POSTED_NULL_LOCATION'::text as issue_type,
  1::int as severity,
  h.move_id as entity_id,
  h.occurred_at,
  jsonb_build_object(
    'move_no', h.move_no,
    'move_type', h.move_type,
    'status', h.status,
    'memo', h.memo
  ) as details,
  h.location_code,
  h.bin_code
from public.cms_inventory_move_header h
where h.status='POSTED'
  and h.location_code is null;

grant select on public.cms_v_inventory_health_summary_v1 to anon, authenticated;
grant select on public.cms_v_inventory_health_issues_v1 to anon, authenticated;

-- keep older exceptions view available and readable
grant select on public.cms_v_inventory_exceptions_v1 to anon, authenticated;
