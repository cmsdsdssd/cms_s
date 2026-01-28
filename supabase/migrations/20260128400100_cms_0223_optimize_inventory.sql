set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 1. Add indexes for performance optimization
-- ---------------------------------------------------------------------
create index if not exists idx_cms_inventory_move_header_status_occurred 
on public.cms_inventory_move_header(status, occurred_at);

create index if not exists idx_cms_inventory_move_line_move_id 
on public.cms_inventory_move_line(move_id);

create index if not exists idx_cms_inventory_move_line_master_id 
on public.cms_inventory_move_line(master_id);

create index if not exists idx_cms_inventory_move_line_item_name 
on public.cms_inventory_move_line(item_name);

create index if not exists idx_cms_inventory_move_line_variant_hint 
on public.cms_inventory_move_line(variant_hint);

-- ---------------------------------------------------------------------
-- 2. Modify Quick Move function (Support Master ID)
-- ---------------------------------------------------------------------
create or replace function public.cms_fn_quick_inventory_move_v1(
  p_move_type public.cms_e_inventory_move_type,
  p_item_name text,
  p_qty numeric,
  p_occurred_at timestamptz default now(),
  p_party_id uuid default null,
  p_variant_hint text default null,
  p_unit text default 'EA',
  p_source text default 'MANUAL',
  p_memo text default null,
  p_meta jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid(),
  p_master_id uuid default null   -- Newly added parameter
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
begin
  if p_move_type is null then raise exception 'move_type required'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'qty must be > 0'; end if;
  if p_item_name is null or length(trim(p_item_name))=0 then raise exception 'item_name required'; end if;

  -- Determine ref_type based on Master ID presence
  if p_master_id is not null then
    v_ref_type := 'MASTER'::public.cms_e_inventory_item_ref_type;
  else
    v_ref_type := 'UNLINKED'::public.cms_e_inventory_item_ref_type;
  end if;

  v_move_id := public.cms_fn_upsert_inventory_move_header_v1(
    p_move_type := p_move_type,
    p_occurred_at := p_occurred_at,
    p_party_id := p_party_id,
    p_location_code := null,
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
    p_item_ref_type := v_ref_type,    -- Dynamic assignment
    p_master_id := p_master_id,       -- Parameter passing
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


-- ---------------------------------------------------------------------
-- 3. Permissions and Security Policies (Allow Anon Access)
-- ---------------------------------------------------------------------
-- Since views are security_invoker=true, policies on underlying tables are needed

-- 3-1) Table Grants
grant select on public.cms_inventory_move_header to anon;
grant select on public.cms_inventory_move_line to anon;
grant select on public.cms_master_item to anon;

-- 3-2) Add RLS Policies (Allow Anon Read)
drop policy if exists cms_select_anon on public.cms_inventory_move_header;
create policy cms_select_anon on public.cms_inventory_move_header
  for select to anon using (true);

drop policy if exists cms_select_anon on public.cms_inventory_move_line;
create policy cms_select_anon on public.cms_inventory_move_line
  for select to anon using (true);
  
-- Check and add existing master_item policy (if missing)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cms_master_item' and policyname='cms_select_anon') then
    create policy cms_select_anon on public.cms_master_item for select to anon using (true);
  end if;
end $$;

-- 3-3) Stocktake Tables 권한 및 정책 (Anon 접근 허용 - 세션/라인 조회)
grant select on public.cms_inventory_count_session to anon;
grant select on public.cms_inventory_count_line to anon;

drop policy if exists cms_select_anon on public.cms_inventory_count_session;
create policy cms_select_anon on public.cms_inventory_count_session
  for select to anon using (true);

drop policy if exists cms_select_anon on public.cms_inventory_count_line;
create policy cms_select_anon on public.cms_inventory_count_line
  for select to anon using (true);
