set search_path = public, pg_temp;

begin;

-- ============================================================
-- 0) Patch: cms_fn_add_shipment_line_from_repair_v1
--    (record field access was using r.measured_weight_g; repair_line uses weight_received_g)
-- ============================================================
create or replace function public.cms_fn_add_shipment_line_from_repair_v1(
  p_shipment_id uuid,
  p_repair_line_id uuid,
  p_qty int default null,
  p_pricing_mode cms_e_pricing_mode default 'RULE'::cms_e_pricing_mode,
  p_category_code cms_e_category_code default null,
  p_material_code cms_e_material_code default null,
  p_is_plated boolean default null,
  p_plating_variant_id uuid default null,
  p_unit_price_krw numeric default null,
  p_manual_total_amount_krw numeric default null,
  p_repair_fee_krw numeric default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_id uuid;
begin
  perform public.cms_fn__assert_shipment_draft(p_shipment_id);

  select * into r
  from public.cms_repair_line
  where repair_line_id = p_repair_line_id;

  if not found then
    raise exception 'repair_line not found: %', p_repair_line_id;
  end if;

  insert into public.cms_shipment_line(
    shipment_line_id, shipment_id,
    repair_line_id,
    pricing_mode,
    category_code,
    material_code,
    qty,
    model_name, suffix, color, size,
    is_plated, plating_variant_id,
    measured_weight_g,
    unit_price_krw,
    manual_total_amount_krw,
    repair_fee_krw
  )
  values(
    gen_random_uuid(), p_shipment_id,
    p_repair_line_id,
    coalesce(p_pricing_mode, 'RULE'::cms_e_pricing_mode),
    p_category_code,
    coalesce(p_material_code, r.material_code),
    coalesce(p_qty, r.qty, 1),
    r.model_name, r.suffix, r.color, null,
    coalesce(p_is_plated, r.is_plated, false),
    coalesce(p_plating_variant_id, r.plating_variant_id),

    -- ✅ 핵심 수정: repair_line은 weight_received_g
    r.weight_received_g,

    p_unit_price_krw,
    p_manual_total_amount_krw,
    coalesce(p_repair_fee_krw, r.repair_fee_krw, 0)
  )
  returning shipment_line_id into v_id;

  return v_id;
end $$;

alter function public.cms_fn_add_shipment_line_from_repair_v1(
  uuid, uuid, int, cms_e_pricing_mode, cms_e_category_code, cms_e_material_code,
  boolean, uuid, numeric, numeric, numeric, text
)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_add_shipment_line_from_repair_v1(
  uuid, uuid, int, cms_e_pricing_mode, cms_e_category_code, cms_e_material_code,
  boolean, uuid, numeric, numeric, numeric, text
) to authenticated, service_role;

-- ============================================================
-- 1) View: cms_v_repair_workbench_v1
-- ============================================================
create or replace view public.cms_v_repair_workbench_v1 as
select
  r.repair_line_id,
  r.customer_party_id,
  p.name as customer_name,

  r.received_at,
  r.requested_due_date,
  r.priority_code,
  case r.priority_code
    when 'VVIP'::public.cms_e_priority_code then 0
    when 'URGENT'::public.cms_e_priority_code then 1
    else 2
  end as priority_sort_order,

  r.status,
  case r.status
    when 'RECEIVED'::public.cms_e_repair_status then 10
    when 'IN_PROGRESS'::public.cms_e_repair_status then 20
    when 'READY_TO_SHIP'::public.cms_e_repair_status then 30
    when 'SHIPPED'::public.cms_e_repair_status then 40
    when 'CLOSED'::public.cms_e_repair_status then 50
    when 'CANCELLED'::public.cms_e_repair_status then 90
    else 99
  end as status_sort_order,

  r.model_name,
  r.model_name_raw,
  r.suffix,
  r.material_code,
  r.color,
  r.qty,

  r.weight_received_g,
  r.weight_received_g as measured_weight_g,

  r.is_plated,
  r.plating_variant_id,
  pv.display_name as plating_display_name,
  pv.color_code as plating_color_code,

  r.repair_fee_krw,
  r.repair_fee_reason,
  r.is_paid,

  r.issue_desc,
  r.memo,

  (r.requested_due_date is not null
    and r.requested_due_date < current_date
    and r.status not in (
      'SHIPPED'::public.cms_e_repair_status,
      'CANCELLED'::public.cms_e_repair_status,
      'CLOSED'::public.cms_e_repair_status
    )
  ) as is_overdue,

  (current_date - r.received_at) as age_days,
  (case when r.requested_due_date is null then null else (r.requested_due_date - current_date) end) as due_in_days,

  link.shipment_id as linked_shipment_id,
  link.shipment_status as linked_shipment_status,
  link.confirmed_at as linked_shipment_confirmed_at,

  r.created_at,
  r.updated_at
from public.cms_repair_line r
join public.cms_party p
  on p.party_id = r.customer_party_id
left join public.cms_plating_variant pv
  on pv.plating_variant_id = r.plating_variant_id
left join lateral (
  select
    sh.shipment_id,
    sh.status::text as shipment_status,
    sh.confirmed_at
  from public.cms_shipment_line sl
  join public.cms_shipment_header sh
    on sh.shipment_id = sl.shipment_id
  where sl.repair_line_id = r.repair_line_id
  order by sh.created_at desc
  limit 1
) link on true;

grant select on public.cms_v_repair_workbench_v1 to authenticated, service_role;

-- ============================================================
-- 2) RPC: cms_fn_create_repair_v2 (fields 확장)
-- ============================================================
drop function if exists public.cms_fn_create_repair_v2(uuid,text,jsonb,uuid,uuid);

create function public.cms_fn_create_repair_v2(
  p_party_id uuid,
  p_notes text default null,
  p_lines jsonb default '[]'::jsonb,
  p_actor_person_id uuid default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_first_id uuid;
  v_new_id uuid;
  e jsonb;

  v_model_name text;
  v_suffix text;
  v_color text;
  v_material_code public.cms_e_material_code;
  v_qty int;
  v_issue_desc text;
  v_memo text;
  v_received_at date;
  v_due_date date;
  v_priority public.cms_e_priority_code;
  v_weight_g numeric;
  v_is_plated boolean;
  v_plating_variant_id uuid;
  v_fee_krw numeric;
  v_fee_reason text;
begin
  if p_party_id is null then
    raise exception using errcode='P0001', message='party_id required';
  end if;

  if jsonb_typeof(coalesce(p_lines,'[]'::jsonb)) <> 'array' then
    raise exception using errcode='P0001', message='lines must be json array';
  end if;

  for e in select * from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb))
  loop
    v_model_name := nullif(trim(coalesce(e->>'model_name','')), '');
    v_issue_desc := nullif(trim(coalesce(e->>'issue_desc','')), '');
    v_qty := nullif(trim(coalesce(e->>'qty','')), '')::int;

    if v_model_name is null then
      raise exception using errcode='P0001', message='model_name required';
    end if;
    if v_issue_desc is null then
      raise exception using errcode='P0001', message='issue_desc required';
    end if;
    if coalesce(v_qty,0) <= 0 then
      raise exception using errcode='P0001', message='qty must be > 0';
    end if;

    v_suffix := nullif(trim(coalesce(e->>'suffix','')), '');
    v_color := nullif(trim(coalesce(e->>'color','')), '');

    v_material_code := nullif(trim(coalesce(e->>'material_code','')), '')::public.cms_e_material_code;
    v_memo := nullif(trim(coalesce(e->>'memo','')), '');

    v_received_at := nullif(trim(coalesce(e->>'received_at','')), '')::date;
    v_due_date := nullif(trim(coalesce(e->>'requested_due_date','')), '')::date;
    v_priority := nullif(trim(coalesce(e->>'priority_code','')), '')::public.cms_e_priority_code;

    v_weight_g := nullif(trim(coalesce(e->>'weight_received_g','')), '')::numeric;
    v_is_plated := coalesce((e->>'is_plated')::boolean, false);
    v_plating_variant_id := nullif(trim(coalesce(e->>'plating_variant_id','')), '')::uuid;

    v_fee_krw := nullif(trim(coalesce(e->>'repair_fee_krw','')), '')::numeric;
    v_fee_reason := nullif(trim(coalesce(e->>'repair_fee_reason','')), '');

    if coalesce(v_fee_krw,0) > 0 and v_fee_reason is null then
      raise exception using errcode='P0001', message='repair_fee_reason required when repair_fee_krw > 0';
    end if;

    if v_is_plated and v_plating_variant_id is null then
      raise exception using errcode='P0001', message='plating_variant_id required when is_plated = true';
    end if;

    insert into public.cms_repair_line(
      customer_party_id,
      received_at,
      requested_due_date,
      priority_code,
      model_name,
      model_name_raw,
      suffix,
      material_code,
      color,
      qty,
      weight_received_g,
      is_plated,
      plating_variant_id,
      repair_fee_krw,
      repair_fee_reason,
      memo,
      issue_desc,
      status,
      correlation_id
    ) values (
      p_party_id,
      coalesce(v_received_at, current_date),
      v_due_date,
      coalesce(v_priority, 'NORMAL'::public.cms_e_priority_code),
      v_model_name,
      v_model_name,
      v_suffix,
      v_material_code,
      v_color,
      v_qty,
      v_weight_g,
      v_is_plated,
      v_plating_variant_id,
      coalesce(v_fee_krw, 0),
      v_fee_reason,
      coalesce(v_memo, p_notes),
      v_issue_desc,
      'RECEIVED'::public.cms_e_repair_status,
      p_correlation_id
    )
    returning repair_line_id into v_new_id;

    if v_first_id is null then
      v_first_id := v_new_id;
    end if;
  end loop;

  if v_first_id is null then
    raise exception using errcode='P0001', message='at least one line required';
  end if;

  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, note)
  values (
    'REPAIR_LINE',
    v_first_id,
    'CREATE_REPAIR',
    null,
    jsonb_build_object('correlation_id', p_correlation_id),
    p_actor_person_id,
    p_notes
  );

  return v_first_id;
end $$;

alter function public.cms_fn_create_repair_v2(uuid,text,jsonb,uuid,uuid)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_create_repair_v2(uuid,text,jsonb,uuid,uuid)
  to authenticated, service_role;

-- ============================================================
-- 3) RPC: cms_fn_update_repair_line_v2
-- ============================================================
drop function if exists public.cms_fn_update_repair_line_v2(
  uuid, date, date, public.cms_e_priority_code,
  text, text, public.cms_e_material_code, text,
  int, numeric,
  boolean, uuid,
  numeric, text,
  text, text,
  boolean,
  uuid, text, uuid
);

create function public.cms_fn_update_repair_line_v2(
  p_repair_line_id uuid,
  p_received_at date default null,
  p_requested_due_date date default null,
  p_priority_code public.cms_e_priority_code default null,
  p_model_name text default null,
  p_suffix text default null,
  p_material_code public.cms_e_material_code default null,
  p_color text default null,
  p_qty int default null,
  p_weight_received_g numeric default null,
  p_is_plated boolean default null,
  p_plating_variant_id uuid default null,
  p_repair_fee_krw numeric default null,
  p_repair_fee_reason text default null,
  p_issue_desc text default null,
  p_memo text default null,
  p_is_paid boolean default null,
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
  r_before public.cms_repair_line%rowtype;
  v_final_is_plated boolean;
  v_final_plating_variant_id uuid;
  v_final_fee_krw numeric;
  v_final_fee_reason text;
  v_after jsonb;
begin
  if p_repair_line_id is null then
    raise exception using errcode='P0001', message='repair_line_id required';
  end if;

  select * into r_before
  from public.cms_repair_line
  where repair_line_id = p_repair_line_id
  for update;

  if r_before.repair_line_id is null then
    raise exception using errcode='P0001', message='repair not found';
  end if;

  if r_before.status in ('SHIPPED','CANCELLED','CLOSED') then
    raise exception using errcode='P0001', message='cannot modify repair in terminal status';
  end if;

  v_final_is_plated := coalesce(p_is_plated, r_before.is_plated);
  v_final_plating_variant_id := coalesce(p_plating_variant_id, r_before.plating_variant_id);

  v_final_fee_krw := coalesce(p_repair_fee_krw, r_before.repair_fee_krw, 0);
  v_final_fee_reason := coalesce(nullif(trim(coalesce(p_repair_fee_reason,'')),''), r_before.repair_fee_reason);

  if coalesce(v_final_fee_krw,0) > 0 and coalesce(nullif(trim(coalesce(v_final_fee_reason,'')),''),'') is null then
    raise exception using errcode='P0001', message='repair_fee_reason required when repair_fee_krw > 0';
  end if;

  if v_final_is_plated and v_final_plating_variant_id is null then
    raise exception using errcode='P0001', message='plating_variant_id required when is_plated = true';
  end if;

  update public.cms_repair_line
  set
    received_at = coalesce(p_received_at, received_at),
    requested_due_date = coalesce(p_requested_due_date, requested_due_date),
    priority_code = coalesce(p_priority_code, priority_code),

    model_name = coalesce(nullif(trim(coalesce(p_model_name,'')),''), model_name),
    model_name_raw = coalesce(nullif(trim(coalesce(p_model_name,'')),''), model_name_raw),
    suffix = coalesce(nullif(trim(coalesce(p_suffix,'')),''), suffix),
    material_code = coalesce(p_material_code, material_code),
    color = coalesce(nullif(trim(coalesce(p_color,'')),''), color),
    qty = coalesce(p_qty, qty),

    weight_received_g = coalesce(p_weight_received_g, weight_received_g),

    is_plated = v_final_is_plated,
    plating_variant_id = v_final_plating_variant_id,

    repair_fee_krw = v_final_fee_krw,
    repair_fee_reason = v_final_fee_reason,

    issue_desc = coalesce(nullif(trim(coalesce(p_issue_desc,'')),''), issue_desc),
    memo = coalesce(nullif(trim(coalesce(p_memo,'')),''), memo),

    is_paid = coalesce(p_is_paid, is_paid),
    updated_at = now()
  where repair_line_id = p_repair_line_id;

  v_after := (
    select to_jsonb(r2) from public.cms_repair_line r2 where r2.repair_line_id = p_repair_line_id
  );

  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, note)
  values (
    'REPAIR_LINE',
    p_repair_line_id,
    'UPDATE_REPAIR',
    to_jsonb(r_before),
    v_after,
    p_actor_person_id,
    p_note
  );

  return p_repair_line_id;
end $$;

alter function public.cms_fn_update_repair_line_v2(
  uuid, date, date, public.cms_e_priority_code,
  text, text, public.cms_e_material_code, text,
  int, numeric,
  boolean, uuid,
  numeric, text,
  text, text,
  boolean,
  uuid, text, uuid
)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_update_repair_line_v2(
  uuid, date, date, public.cms_e_priority_code,
  text, text, public.cms_e_material_code, text,
  int, numeric,
  boolean, uuid,
  numeric, text,
  text, text,
  boolean,
  uuid, text, uuid
) to authenticated, service_role;

-- ============================================================
-- 4) RPC: cms_fn_set_repair_status_v2 (memo 덮어쓰기 방지)
-- ============================================================
drop function if exists public.cms_fn_set_repair_status_v2(uuid,public.cms_e_repair_status,uuid,text,uuid);

create function public.cms_fn_set_repair_status_v2(
  p_repair_id uuid,
  p_status public.cms_e_repair_status,
  p_actor_person_id uuid default null,
  p_reason text default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r_before public.cms_repair_line%rowtype;
begin
  if p_repair_id is null then
    raise exception using errcode='P0001', message='repair_id required';
  end if;
  if p_status is null then
    raise exception using errcode='P0001', message='status required';
  end if;

  select * into r_before
  from public.cms_repair_line
  where repair_line_id = p_repair_id
  for update;

  if r_before.repair_line_id is null then
    raise exception using errcode='P0001', message='repair not found';
  end if;

  if r_before.status in ('SHIPPED','CANCELLED','CLOSED') then
    raise exception using errcode='P0001', message='cannot change status from terminal state';
  end if;

  update public.cms_repair_line
  set status = p_status,
      updated_at = now()
  where repair_line_id = p_repair_id;

  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, note)
  values (
    'REPAIR_LINE',
    p_repair_id,
    'SET_STATUS',
    jsonb_build_object('status', r_before.status),
    jsonb_build_object('status', p_status),
    p_actor_person_id,
    p_reason
  );
end $$;

alter function public.cms_fn_set_repair_status_v2(uuid,public.cms_e_repair_status,uuid,text,uuid)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_set_repair_status_v2(uuid,public.cms_e_repair_status,uuid,text,uuid)
  to authenticated, service_role;

-- ============================================================
-- 5) RPC: cms_fn_send_repair_to_shipment_v2 (기존 DRAFT 출고에 붙이기 가능)
-- ============================================================
drop function if exists public.cms_fn_send_repair_to_shipment_v2(uuid,uuid,numeric,text,uuid,text,uuid);

create function public.cms_fn_send_repair_to_shipment_v2(
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

  v_line_id := public.cms_fn_add_shipment_line_from_repair_v1(
    v_shipment_id,
    p_repair_id,
    r_repair.qty,
    'RULE'::public.cms_e_pricing_mode,
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
