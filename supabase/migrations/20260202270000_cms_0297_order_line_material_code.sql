set search_path = public, pg_temp;

alter table public.cms_order_line
  add column if not exists material_code cms_e_material_code;

create or replace function public.cms_fn_upsert_order_line_v3(
  p_customer_party_id uuid,
  p_master_id uuid,
  p_qty int default 1,
  p_size text default null,
  p_is_plated boolean default false,
  p_plating_variant_id uuid default null,
  p_plating_color_code text default null,
  p_requested_due_date date default null,
  p_priority_code cms_e_priority_code default 'NORMAL',
  p_source_channel text default null,
  p_memo text default null,
  p_order_line_id uuid default null,
  p_center_stone_name text default null,
  p_center_stone_qty int default null,
  p_sub1_stone_name text default null,
  p_sub1_stone_qty int default null,
  p_sub2_stone_name text default null,
  p_sub2_stone_qty int default null,
  p_actor_person_id uuid default null,
  p_suffix text default null,
  p_color text default null,
  p_material_code cms_e_material_code default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_master_model_name text;
  v_master_category text;
  v_master_color text;
  v_old_status cms_e_order_status;
  v_suffix text;
  v_color text;
begin
  if p_customer_party_id is null then raise exception 'customer_party_id required'; end if;
  if p_master_id is null then raise exception 'P0001: master_id required (strict mode)'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'qty must be > 0'; end if;

  if coalesce(p_is_plated,false) = true and (p_plating_variant_id is null) then
    raise exception 'plating_variant_id required when is_plated=true';
  end if;
  if coalesce(p_is_plated,false) = true and (nullif(trim(coalesce(p_plating_color_code,'')), '') is null) then
    raise exception 'color_code required when is_plated=true';
  end if;

  select model_name, category_code, color
    into v_master_model_name, v_master_category, v_master_color
  from public.cms_master_item
  where master_id = p_master_id;

  if not found then
    raise exception 'P0001: master_id not found in registry';
  end if;

  v_suffix := nullif(trim(coalesce(p_suffix,'')), '');
  if v_suffix is null then
    v_suffix := nullif(trim(coalesce(v_master_category,'')), '');
  end if;
  if v_suffix is null then
    v_suffix := 'UNSPECIFIED';
  end if;

  v_color := nullif(trim(coalesce(p_color,'')), '');
  if v_color is null then
    v_color := nullif(trim(coalesce(v_master_color,'')), '');
  end if;
  if v_color is null then
    v_color := 'NONE';
  end if;

  v_id := coalesce(p_order_line_id, gen_random_uuid());

  if p_order_line_id is not null then
    select status into v_old_status
    from public.cms_order_line
    where order_line_id = p_order_line_id;

    if found and v_old_status::text not in ('ORDER_PENDING', 'ORDER_ACCEPTED') then
      null;
    end if;
  end if;

  insert into public.cms_order_line(
    order_line_id,
    customer_party_id,
    model_name,
    model_name_raw,
    suffix,
    color,
    material_code,
    size,
    qty,
    is_plated,
    plating_variant_id,
    plating_color_code,
    requested_due_date,
    priority_code,
    source_channel,
    memo,
    center_stone_name,
    center_stone_qty,
    sub1_stone_name,
    sub1_stone_qty,
    sub2_stone_name,
    sub2_stone_qty,
    matched_master_id,
    match_state,
    updated_by,
    updated_at
  )
  values(
    v_id,
    p_customer_party_id,
    v_master_model_name,
    v_master_model_name,
    v_suffix,
    v_color,
    p_material_code,
    nullif(trim(coalesce(p_size,'')), ''),
    p_qty,
    coalesce(p_is_plated,false),
    p_plating_variant_id,
    nullif(trim(coalesce(p_plating_color_code,'')), ''),
    p_requested_due_date,
    coalesce(p_priority_code, 'NORMAL'),
    nullif(trim(coalesce(p_source_channel,'')), ''),
    p_memo,
    nullif(trim(coalesce(p_center_stone_name,'')), ''),
    p_center_stone_qty,
    nullif(trim(coalesce(p_sub1_stone_name,'')), ''),
    p_sub1_stone_qty,
    nullif(trim(coalesce(p_sub2_stone_name,'')), ''),
    p_sub2_stone_qty,
    p_master_id,
    'HUMAN_CONFIRMED',
    p_actor_person_id,
    now()
  )
  on conflict (order_line_id) do update set
    customer_party_id   = excluded.customer_party_id,
    model_name          = excluded.model_name,
    model_name_raw      = excluded.model_name_raw,
    suffix              = excluded.suffix,
    color               = excluded.color,
    material_code       = coalesce(excluded.material_code, public.cms_order_line.material_code),
    size                = excluded.size,
    qty                 = excluded.qty,
    is_plated           = excluded.is_plated,
    plating_variant_id  = excluded.plating_variant_id,
    plating_color_code  = excluded.plating_color_code,
    requested_due_date  = excluded.requested_due_date,
    priority_code       = excluded.priority_code,
    source_channel      = excluded.source_channel,
    memo                = excluded.memo,
    center_stone_name   = excluded.center_stone_name,
    center_stone_qty    = excluded.center_stone_qty,
    sub1_stone_name     = excluded.sub1_stone_name,
    sub1_stone_qty      = excluded.sub1_stone_qty,
    sub2_stone_name     = excluded.sub2_stone_name,
    sub2_stone_qty      = excluded.sub2_stone_qty,
    matched_master_id   = excluded.matched_master_id,
    match_state         = excluded.match_state,
    updated_by          = excluded.updated_by,
    updated_at          = excluded.updated_at;

  return v_id;
end $$;

create or replace function public.cms_fn_add_shipment_line_from_order_v1(
  p_shipment_id uuid,
  p_order_line_id uuid,
  p_qty int default null,
  p_pricing_mode cms_e_pricing_mode default 'RULE'::cms_e_pricing_mode,
  p_category_code cms_e_category_code default null,
  p_material_code cms_e_material_code default null,
  p_is_plated boolean default null,
  p_plating_variant_id uuid default null,
  p_unit_price_krw numeric default null,
  p_manual_total_amount_krw numeric default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o record;
  v_id uuid;
begin
  perform public.cms_fn__assert_shipment_draft(p_shipment_id);

  select * into o
  from public.cms_order_line
  where order_line_id = p_order_line_id;

  if not found then
    raise exception 'order_line not found: %', p_order_line_id;
  end if;

  insert into public.cms_shipment_line(
    shipment_line_id, shipment_id,
    order_line_id,
    pricing_mode,
    category_code,
    material_code,
    qty,
    model_name, suffix, color, size,
    is_plated, plating_variant_id,
    unit_price_krw,
    manual_total_amount_krw,
    repair_fee_krw
  )
  values(
    gen_random_uuid(), p_shipment_id,
    p_order_line_id,
    coalesce(p_pricing_mode, 'RULE'::cms_e_pricing_mode),
    p_category_code,
    coalesce(p_material_code, o.material_code),
    coalesce(p_qty, o.qty, 1),
    o.model_name, o.suffix, o.color, o.size,
    coalesce(p_is_plated, o.is_plated, false),
    coalesce(p_plating_variant_id, o.plating_variant_id),
    p_unit_price_krw,
    p_manual_total_amount_krw,
    0
  )
  returning shipment_line_id into v_id;

  return v_id;
end $$;
