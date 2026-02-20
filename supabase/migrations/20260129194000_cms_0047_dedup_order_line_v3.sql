set search_path = public, pg_temp;
-- 1) cms_fn_upsert_order_line_v3 오버로드 전부 제거(동적 drop)
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
-- 2) 레포(0034) 기준 "정식 v3"로 재생성 (중복 제거 후엔 유일해짐)
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
  p_actor_person_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_id uuid;
  v_master public.cms_master_item%rowtype;
begin
  if p_customer_party_id is null then
    raise exception 'customer_party_id is required';
  end if;

  if p_master_id is null then
    raise exception 'master_id is required (STRICT)';
  end if;

  select * into v_master
  from public.cms_master_item
  where master_id = p_master_id;

  if not found then
    raise exception 'master item not found: %', p_master_id;
  end if;

  insert into public.cms_order_line(
    order_line_id,
    customer_party_id,
    matched_master_id,
    match_state,
    model_name,
    model_name_raw,
    qty,
    size,
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
    created_by,
    created_at,
    updated_by,
    updated_at
  ) values (
    coalesce(p_order_line_id, gen_random_uuid()),
    p_customer_party_id,
    p_master_id,
    'MANUAL_MATCHED',
    v_master.model_name,
    v_master.model_name,
    coalesce(p_qty, 1),
    p_size,
    coalesce(p_is_plated, false),
    p_plating_variant_id,
    p_plating_color_code,
    p_requested_due_date,
    coalesce(p_priority_code, 'NORMAL'::cms_e_priority_code),
    p_source_channel,
    p_memo,
    p_center_stone_name,
    p_center_stone_qty,
    p_sub1_stone_name,
    p_sub1_stone_qty,
    p_sub2_stone_name,
    p_sub2_stone_qty,
    p_actor_person_id,
    now(),
    p_actor_person_id,
    now()
  )
  on conflict (order_line_id) do update
  set
    customer_party_id    = excluded.customer_party_id,
    matched_master_id    = excluded.matched_master_id,
    match_state          = excluded.match_state,
    model_name           = excluded.model_name,
    model_name_raw       = excluded.model_name_raw,
    qty                  = excluded.qty,
    size                 = excluded.size,
    is_plated            = excluded.is_plated,
    plating_variant_id   = excluded.plating_variant_id,
    plating_color_code   = excluded.plating_color_code,
    requested_due_date   = excluded.requested_due_date,
    priority_code        = excluded.priority_code,
    source_channel       = excluded.source_channel,
    memo                 = excluded.memo,
    center_stone_name    = excluded.center_stone_name,
    center_stone_qty     = excluded.center_stone_qty,
    sub1_stone_name      = excluded.sub1_stone_name,
    sub1_stone_qty       = excluded.sub1_stone_qty,
    sub2_stone_name      = excluded.sub2_stone_name,
    sub2_stone_qty       = excluded.sub2_stone_qty,
    updated_by           = excluded.updated_by,
    updated_at           = excluded.updated_at
  returning order_line_id into v_id;

  return v_id;
end $$;
grant execute on function public.cms_fn_upsert_order_line_v3(
  uuid, uuid, int, text, boolean, uuid, text, date, cms_e_priority_code, text, text, uuid,
  text, int, text, int, text, int, uuid
) to authenticated;
