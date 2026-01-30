set search_path = public, pg_temp;

-- Fix cms_fn_upsert_order_line_v3:
-- 1) Remove references to non-existent cms_order_line.created_by (42703)
-- 2) Add optional p_suffix/p_color parameters for UI payload compatibility
-- 3) Do NOT derive color from master (variant 다양성 대응). color = p_color (default 'NONE')
-- 4) Keep suffix fallback to master.category_code (default 'ETC')
-- 5) Ensure match_state = 'HUMAN_CONFIRMED' (enum: cms_e_master_match_state)

-- 0) Ensure updated_by column exists (used for auditing)
alter table if exists public.cms_order_line
  add column if not exists updated_by uuid references public.cms_person(person_id);

-- 1) Drop all overloads to prevent schema cache mismatch
do $$
declare
  r record;
begin
  for r in
    select p.oid, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cms_fn_upsert_order_line_v3'
  loop
    execute format('drop function if exists public.cms_fn_upsert_order_line_v3(%s);', r.args);
  end loop;
end $$;

-- 2) Recreate the function
create or replace function public.cms_fn_upsert_order_line_v3(
  p_customer_party_id uuid,
  p_master_id uuid,            -- STRICT: required
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
  -- stone specs
  p_center_stone_name text default null,
  p_center_stone_qty int default null,
  p_sub1_stone_name text default null,
  p_sub1_stone_qty int default null,
  p_sub2_stone_name text default null,
  p_sub2_stone_qty int default null,
  -- actor
  p_actor_person_id uuid default null,

  -- UI compatibility / overrides
  p_suffix text default null,
  p_color  text default null
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
  v_suffix text;
  v_color text;
begin
  if p_customer_party_id is null then
    raise exception 'customer_party_id required';
  end if;

  if p_master_id is null then
    raise exception 'P0001: master_id required (strict mode)';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'qty must be > 0';
  end if;

  if coalesce(p_is_plated, false) is true
     and (p_plating_color_code is null or length(trim(p_plating_color_code)) = 0) then
    raise exception 'plating_color_code required when is_plated=true';
  end if;

  select model_name, category_code
    into v_master_model_name, v_master_category
  from public.cms_master_item
  where master_id = p_master_id;

  if not found then
    raise exception 'P0001: master_id not found in registry';
  end if;

  -- suffix: prefer UI override, else master category, else ETC
  v_suffix := nullif(trim(coalesce(p_suffix, v_master_category, 'ETC')), '');

  -- color: DO NOT use master. prefer UI override, else NONE
  v_color := nullif(trim(coalesce(p_color, 'NONE')), '');
  if v_color is null then
    v_color := 'NONE';
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

grant execute on function public.cms_fn_upsert_order_line_v3 to anon, authenticated, service_role;
