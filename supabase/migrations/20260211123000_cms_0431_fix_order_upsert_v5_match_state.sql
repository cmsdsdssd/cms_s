set search_path = public, pg_temp;
-- ============================================================
-- Hotfix: cms_fn_upsert_order_line_v5 was casting to a non-existent enum
--   'MATCHED'::public.cms_e_order_match_state
-- which prevents v5/v6 upsert RPCs from being created.
--
-- Fix: write a valid cms_e_match_state value.
--      (Matches prior v3 fix: HUMAN_CONFIRMED)
-- ============================================================

create or replace function public.cms_fn_upsert_order_line_v5(
  p_customer_party_id uuid,
  p_master_id uuid,
  p_qty int default 1,
  p_size text default null,
  p_is_plated boolean default false,
  p_plating_variant_id uuid default null,
  p_plating_color_code text default null,
  p_requested_due_date date default null,
  p_priority_code public.cms_e_priority_code default 'NORMAL',
  p_source_channel text default null,
  p_memo text default null,
  p_order_line_id uuid default null,
  p_center_stone_name text default null,
  p_center_stone_qty int default null,
  p_center_stone_source public.cms_e_stone_supply_source default null,
  p_sub1_stone_name text default null,
  p_sub1_stone_qty int default null,
  p_sub1_stone_source public.cms_e_stone_supply_source default null,
  p_sub2_stone_name text default null,
  p_sub2_stone_qty int default null,
  p_sub2_stone_source public.cms_e_stone_supply_source default null,
  p_actor_person_id uuid default null,
  p_suffix text default null,
  p_color text default null,
  p_material_code public.cms_e_material_code default null
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
  v_old_status public.cms_e_order_status;
  v_suffix text;
  v_color text;

  v_center_supply public.cms_e_stone_supply_source;
  v_sub1_supply   public.cms_e_stone_supply_source;
  v_sub2_supply   public.cms_e_stone_supply_source;
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

  -- stone name/qty validation
  if (p_center_stone_name is null and coalesce(p_center_stone_qty, 0) > 0) then
    raise exception 'center_stone_name required when center_stone_qty > 0';
  end if;
  if (p_center_stone_name is not null and coalesce(p_center_stone_qty, 0) <= 0) then
    raise exception 'center_stone_qty must be > 0 when center_stone_name provided';
  end if;

  if (p_sub1_stone_name is null and coalesce(p_sub1_stone_qty, 0) > 0) then
    raise exception 'sub1_stone_name required when sub1_stone_qty > 0';
  end if;
  if (p_sub1_stone_name is not null and coalesce(p_sub1_stone_qty, 0) <= 0) then
    raise exception 'sub1_stone_qty must be > 0 when sub1_stone_name provided';
  end if;

  if (p_sub2_stone_name is null and coalesce(p_sub2_stone_qty, 0) > 0) then
    raise exception 'sub2_stone_name required when sub2_stone_qty > 0';
  end if;
  if (p_sub2_stone_name is not null and coalesce(p_sub2_stone_qty, 0) <= 0) then
    raise exception 'sub2_stone_qty must be > 0 when sub2_stone_name provided';
  end if;

  -- supply type defaulting
  v_center_supply := case
    when p_center_stone_name is null then null
    else coalesce(p_center_stone_source, 'SELF'::public.cms_e_stone_supply_source)
  end;
  v_sub1_supply := case
    when p_sub1_stone_name is null then null
    else coalesce(p_sub1_stone_source, 'SELF'::public.cms_e_stone_supply_source)
  end;
  v_sub2_supply := case
    when p_sub2_stone_name is null then null
    else coalesce(p_sub2_stone_source, 'SELF'::public.cms_e_stone_supply_source)
  end;

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
    center_stone_source,
    sub1_stone_name,
    sub1_stone_qty,
    sub1_stone_source,
    sub2_stone_name,
    sub2_stone_qty,
    sub2_stone_source,
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
    p_size,
    p_qty,
    coalesce(p_is_plated,false),
    p_plating_variant_id,
    p_plating_color_code,
    p_requested_due_date,
    p_priority_code,
    p_source_channel,
    p_memo,
    p_center_stone_name,
    p_center_stone_qty,
    v_center_supply,
    p_sub1_stone_name,
    p_sub1_stone_qty,
    v_sub1_supply,
    p_sub2_stone_name,
    p_sub2_stone_qty,
    v_sub2_supply,
    p_master_id,
    'HUMAN_CONFIRMED'::public.cms_e_match_state, -- ✅ FIX
    p_actor_person_id,
    now()
  )
  on conflict (order_line_id) do update
  set customer_party_id = excluded.customer_party_id,
      model_name = excluded.model_name,
      model_name_raw = excluded.model_name_raw,
      suffix = excluded.suffix,
      color = excluded.color,
      material_code = excluded.material_code,
      size = excluded.size,
      qty = excluded.qty,
      is_plated = excluded.is_plated,
      plating_variant_id = excluded.plating_variant_id,
      plating_color_code = excluded.plating_color_code,
      requested_due_date = excluded.requested_due_date,
      priority_code = excluded.priority_code,
      source_channel = excluded.source_channel,
      memo = excluded.memo,
      center_stone_name = excluded.center_stone_name,
      center_stone_qty = excluded.center_stone_qty,
      center_stone_source = excluded.center_stone_source,
      sub1_stone_name = excluded.sub1_stone_name,
      sub1_stone_qty = excluded.sub1_stone_qty,
      sub1_stone_source = excluded.sub1_stone_source,
      sub2_stone_name = excluded.sub2_stone_name,
      sub2_stone_qty = excluded.sub2_stone_qty,
      sub2_stone_source = excluded.sub2_stone_source,
      matched_master_id = excluded.matched_master_id,
      match_state = excluded.match_state,
      updated_by = excluded.updated_by,
      updated_at = now();

  return v_id;
end $$;
-- keep grants (explicit signature to avoid overload ambiguity)
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute $g$grant execute on function public.cms_fn_upsert_order_line_v5(
      uuid, uuid, integer, text, boolean, uuid, text, date, public.cms_e_priority_code,
      text, text, uuid,
      text, integer, public.cms_e_stone_supply_source,
      text, integer, public.cms_e_stone_supply_source,
      text, integer, public.cms_e_stone_supply_source,
      uuid, text, text, public.cms_e_material_code
    ) to anon$g$;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute $g$grant execute on function public.cms_fn_upsert_order_line_v5(
      uuid, uuid, integer, text, boolean, uuid, text, date, public.cms_e_priority_code,
      text, text, uuid,
      text, integer, public.cms_e_stone_supply_source,
      text, integer, public.cms_e_stone_supply_source,
      text, integer, public.cms_e_stone_supply_source,
      uuid, text, text, public.cms_e_material_code
    ) to authenticated$g$;
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute $g$grant execute on function public.cms_fn_upsert_order_line_v5(
      uuid, uuid, integer, text, boolean, uuid, text, date, public.cms_e_priority_code,
      text, text, uuid,
      text, integer, public.cms_e_stone_supply_source,
      text, integer, public.cms_e_stone_supply_source,
      text, integer, public.cms_e_stone_supply_source,
      uuid, text, text, public.cms_e_material_code
    ) to service_role$g$;
  end if;
end $$;
