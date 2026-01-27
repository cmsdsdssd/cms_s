set search_path = public, pg_temp;

-- 0015: order page RPC extensions

create or replace function public.cms_fn_upsert_order_line_v2(
  p_customer_party_id uuid,
  p_model_name text,
  p_suffix text,
  p_color text,
  p_qty int default 1,
  p_size text default null,
  p_is_plated boolean default false,
  p_plating_variant_id uuid default null,
  p_requested_due_date date default null,
  p_priority_code cms_e_priority_code default 'NORMAL',
  p_source_channel text default null,
  p_model_name_raw text default null,
  p_memo text default null,
  p_order_line_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_model_name text;
  v_suffix text;
  v_color text;
begin
  if p_customer_party_id is null then raise exception 'customer_party_id required'; end if;
  v_model_name := trim(coalesce(p_model_name, ''));
  v_suffix := trim(coalesce(p_suffix, ''));
  v_color := trim(coalesce(p_color, ''));
  if length(v_model_name) = 0 then raise exception 'model_name required'; end if;
  if length(v_suffix) = 0 then raise exception 'suffix required'; end if;
  if length(v_color) = 0 then raise exception 'color required'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'qty must be > 0'; end if;
  if coalesce(p_is_plated, false) is true and p_plating_variant_id is null then
    raise exception 'plating_variant_id required when is_plated=true';
  end if;

  v_id := coalesce(p_order_line_id, gen_random_uuid());

  insert into public.cms_order_line(
    order_line_id,
    customer_party_id,
    model_name,
    model_name_raw,
    suffix,
    color,
    size,
    qty,
    is_plated,
    plating_variant_id,
    requested_due_date,
    priority_code,
    source_channel,
    memo
  )
  values(
    v_id,
    p_customer_party_id,
    v_model_name,
    nullif(coalesce(p_model_name_raw, ''), ''),
    v_suffix,
    v_color,
    nullif(trim(coalesce(p_size,'')), ''),
    p_qty,
    coalesce(p_is_plated,false),
    p_plating_variant_id,
    p_requested_due_date,
    coalesce(p_priority_code, 'NORMAL'::cms_e_priority_code),
    nullif(trim(coalesce(p_source_channel,'')), ''),
    p_memo
  )
  on conflict (order_line_id) do update set
    customer_party_id  = excluded.customer_party_id,
    model_name         = excluded.model_name,
    model_name_raw     = excluded.model_name_raw,
    suffix             = excluded.suffix,
    color              = excluded.color,
    size               = excluded.size,
    qty                = excluded.qty,
    is_plated          = excluded.is_plated,
    plating_variant_id = excluded.plating_variant_id,
    requested_due_date = excluded.requested_due_date,
    priority_code      = excluded.priority_code,
    source_channel     = excluded.source_channel,
    memo               = excluded.memo;

  return v_id;
end $$;

create or replace function public.cms_fn_set_order_line_status_v1(
  p_order_line_id uuid,
  p_to_status cms_e_order_status,
  p_actor_person_id uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_from_status cms_e_order_status;
  v_event_id uuid;
begin
  if p_order_line_id is null then raise exception 'order_line_id required'; end if;
  if p_to_status is null then raise exception 'to_status required'; end if;

  select status into v_from_status
  from public.cms_order_line
  where order_line_id = p_order_line_id
  for update;

  if not found then
    raise exception 'order_line not found: %', p_order_line_id;
  end if;

  if v_from_status is distinct from p_to_status then
    update public.cms_order_line
    set status = p_to_status
    where order_line_id = p_order_line_id;

    select event_id
      into v_event_id
    from public.cms_status_event
    where entity_type = 'ORDER_LINE'
      and entity_id = p_order_line_id
      and to_status = p_to_status::text
    order by occurred_at desc
    limit 1;

    if v_event_id is not null then
      update public.cms_status_event
      set actor_person_id = p_actor_person_id,
          reason = p_reason
      where event_id = v_event_id;
    else
      insert into public.cms_status_event(
        entity_type,
        entity_id,
        from_status,
        to_status,
        occurred_at,
        actor_person_id,
        reason
      )
      values (
        'ORDER_LINE',
        p_order_line_id,
        v_from_status::text,
        p_to_status::text,
        now(),
        p_actor_person_id,
        p_reason
      );
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'order_line_id', p_order_line_id,
    'from_status', v_from_status,
    'to_status', p_to_status
  );
end $$;

create or replace function public.cms_fn_create_shipments_from_order_lines_v1(
  p_order_line_ids uuid[],
  p_ship_date date default null,
  p_memo text default null,
  p_actor_person_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r_group record;
  v_shipment_id uuid;
  v_created jsonb := '[]'::jsonb;
  v_total int := 0;
  v_found int := 0;
  v_order_id uuid;
begin
  if p_order_line_ids is null or array_length(p_order_line_ids, 1) is null then
    raise exception 'order_line_ids required';
  end if;

  select count(*) into v_found
  from public.cms_order_line
  where order_line_id = any(p_order_line_ids);

  v_total := array_length(p_order_line_ids, 1);
  if v_found <> v_total then
    raise exception 'some order_line_ids not found (found %, expected %)', v_found, v_total;
  end if;

  for r_group in
    select customer_party_id, array_agg(order_line_id) as order_ids
    from public.cms_order_line
    where order_line_id = any(p_order_line_ids)
    group by customer_party_id
  loop
    v_shipment_id := public.cms_fn_create_shipment_header_v1(
      r_group.customer_party_id,
      p_ship_date,
      p_memo
    );

    foreach v_order_id in array r_group.order_ids
    loop
      perform public.cms_fn_add_shipment_line_from_order_v1(
        v_shipment_id,
        v_order_id,
        null,
        'RULE'::cms_e_pricing_mode,
        null,
        null,
        null,
        null,
        null,
        null,
        p_memo
      );
    end loop;

    v_created := v_created || jsonb_build_array(
      jsonb_build_object(
        'shipment_id', v_shipment_id,
        'customer_party_id', r_group.customer_party_id,
        'order_line_count', array_length(r_group.order_ids, 1),
        'actor_person_id', p_actor_person_id
      )
    );
  end loop;

  return jsonb_build_object(
    'ok', true,
    'shipment_count', jsonb_array_length(v_created),
    'shipments', v_created
  );
end $$;

create or replace function public.cms_fn_enum_values_v1(
  p_enum text
)
returns table(value text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_enum = 'cms_e_order_status' then
    return query select unnest(enum_range(null::cms_e_order_status))::text;
  elsif p_enum = 'cms_e_priority_code' then
    return query select unnest(enum_range(null::cms_e_priority_code))::text;
  elsif p_enum = 'cms_e_match_state' then
    return query select unnest(enum_range(null::cms_e_match_state))::text;
  else
    raise exception 'unsupported enum: %', p_enum;
  end if;
end $$;

do $$
declare r record;
begin
  for r in
    select
      n.nspname as schema_name,
      p.proname as fn_name,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'cms\_fn\_%' escape '\'
  loop
    execute format('grant execute on function public.%I(%s) to authenticated;', r.fn_name, r.args);
  end loop;
end $$;
