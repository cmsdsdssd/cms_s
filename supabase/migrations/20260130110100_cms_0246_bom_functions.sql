set search_path = public, pg_temp;

-- 1) resolve recipe (variant -> exact 우선, 없으면 default)
create or replace function public.cms_fn_resolve_bom_recipe_v1(
  p_product_master_id uuid,
  p_variant_key text default null
)
returns table (
  bom_id uuid,
  match_kind text,
  matched_variant_key text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with norm as (
    select
      p_product_master_id as product_master_id,
      nullif(trim(coalesce(p_variant_key,'')), '') as variant_key
  ),
  exact_match as (
    select r.bom_id, 'EXACT'::text as match_kind, r.variant_key as matched_variant_key
    from public.cms_bom_recipe r
    join norm n on n.product_master_id = r.product_master_id
    where r.is_active = true
      and n.variant_key is not null
      and r.variant_key = n.variant_key
    limit 1
  ),
  default_match as (
    select r.bom_id, 'DEFAULT'::text as match_kind, r.variant_key as matched_variant_key
    from public.cms_bom_recipe r
    join norm n on n.product_master_id = r.product_master_id
    where r.is_active = true
      and r.variant_key is null
    limit 1
  )
  select * from exact_match
  union all
  select * from default_match
  limit 1;
$$;

alter function public.cms_fn_resolve_bom_recipe_v1(uuid,text)
  security definer
  set search_path = public, pg_temp;

-- 2) upsert recipe header
create or replace function public.cms_fn_upsert_bom_recipe_v1(
  p_product_master_id uuid,
  p_variant_key text default null,
  p_is_active boolean default true,
  p_note text default null,
  p_meta jsonb default '{}'::jsonb,
  p_bom_id uuid default null,
  p_actor_person_id uuid default null,
  p_note2 text default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_row public.cms_bom_recipe%rowtype;
  v_variant text := nullif(trim(coalesce(p_variant_key,'')), '');
begin
  if p_product_master_id is null then
    raise exception using errcode='P0001', message='product_master_id required';
  end if;

  if p_bom_id is not null then
    select * into v_row
    from public.cms_bom_recipe
    where bom_id = p_bom_id
    for update;

    if found then
      v_before := jsonb_build_object(
        'product_master_id', v_row.product_master_id,
        'variant_key', v_row.variant_key,
        'is_active', v_row.is_active,
        'note', v_row.note,
        'meta', v_row.meta
      );

      update public.cms_bom_recipe
      set
        product_master_id = p_product_master_id,
        variant_key = v_variant,
        is_active = coalesce(p_is_active, v_row.is_active),
        note = p_note,
        meta = coalesce(p_meta, '{}'::jsonb)
      where bom_id = p_bom_id;

      select * into v_row from public.cms_bom_recipe where bom_id = p_bom_id;

      v_after := jsonb_build_object(
        'product_master_id', v_row.product_master_id,
        'variant_key', v_row.variant_key,
        'is_active', v_row.is_active,
        'note', v_row.note,
        'meta', v_row.meta
      );

      insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, occurred_at, note)
      values ('BOM_RECIPE', p_bom_id, 'UPSERT_RECIPE', v_before, v_after, p_actor_person_id, now(), coalesce(p_note2,'') || ' corr=' || p_correlation_id::text);

      return p_bom_id;
    end if;
  end if;

  v_id := coalesce(p_bom_id, gen_random_uuid());

  insert into public.cms_bom_recipe(bom_id, product_master_id, variant_key, is_active, note, meta)
  values (v_id, p_product_master_id, v_variant, coalesce(p_is_active,true), p_note, coalesce(p_meta,'{}'::jsonb));

  v_after := jsonb_build_object(
    'product_master_id', p_product_master_id,
    'variant_key', v_variant,
    'is_active', coalesce(p_is_active,true),
    'note', p_note
  );

  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, occurred_at, note)
  values ('BOM_RECIPE', v_id, 'CREATE_RECIPE', '{}'::jsonb, v_after, p_actor_person_id, now(), coalesce(p_note2,'') || ' corr=' || p_correlation_id::text);

  return v_id;
end $$;

alter function public.cms_fn_upsert_bom_recipe_v1(uuid,text,boolean,text,jsonb,uuid,uuid,text,uuid)
  security definer
  set search_path = public, pg_temp;

-- 3) add recipe line (line_no 자동 할당)
-- ✅ 필수 파라미터(p_qty_per_unit)를 default 파라미터보다 앞으로 이동
create or replace function public.cms_fn_add_bom_recipe_line_v1(
  p_bom_id uuid,
  p_component_ref_type public.cms_e_inventory_item_ref_type,
  p_qty_per_unit numeric,
  p_component_master_id uuid default null,
  p_component_part_id uuid default null,
  p_unit text default 'EA',
  p_note text default null,
  p_meta jsonb default '{}'::jsonb,
  p_actor_person_id uuid default null,
  p_note2 text default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line_no int;
  v_id uuid := gen_random_uuid();
  v_before jsonb := '{}'::jsonb;
  v_after jsonb;
begin
  if p_bom_id is null then
    raise exception using errcode='P0001', message='bom_id required';
  end if;
  if p_component_ref_type is null then
    raise exception using errcode='P0001', message='component_ref_type required';
  end if;
  if p_qty_per_unit is null or p_qty_per_unit <= 0 then
    raise exception using errcode='P0001', message='qty_per_unit must be > 0';
  end if;

  -- line_no = max(alive)+1
  select coalesce(max(line_no),0)+1 into v_line_no
  from public.cms_bom_recipe_line
  where bom_id = p_bom_id and is_void = false;

  insert into public.cms_bom_recipe_line(
    bom_line_id, bom_id, line_no,
    component_ref_type, component_master_id, component_part_id,
    qty_per_unit, unit, note, meta
  )
  values (
    v_id, p_bom_id, v_line_no,
    p_component_ref_type, p_component_master_id, p_component_part_id,
    p_qty_per_unit, coalesce(nullif(trim(coalesce(p_unit,'')),''), 'EA'),
    p_note,
    coalesce(p_meta,'{}'::jsonb)
  );

  v_after := jsonb_build_object(
    'bom_id', p_bom_id,
    'line_no', v_line_no,
    'component_ref_type', p_component_ref_type,
    'component_master_id', p_component_master_id,
    'component_part_id', p_component_part_id,
    'qty_per_unit', p_qty_per_unit,
    'unit', coalesce(nullif(trim(coalesce(p_unit,'')),''), 'EA')
  );

  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, occurred_at, note)
  values ('BOM_RECIPE_LINE', v_id, 'ADD_LINE', v_before, v_after, p_actor_person_id, now(), coalesce(p_note2,'') || ' corr=' || p_correlation_id::text);

  return v_id;
end $$;

-- ✅ 시그니처 변경에 맞춰 alter function도 수정
alter function public.cms_fn_add_bom_recipe_line_v1(
  uuid,
  public.cms_e_inventory_item_ref_type,
  numeric,
  uuid,
  uuid,
  text,
  text,
  jsonb,
  uuid,
  text,
  uuid
)
  security definer
  set search_path = public, pg_temp;

-- 4) void recipe line (삭제 금지)
create or replace function public.cms_fn_void_bom_recipe_line_v1(
  p_bom_line_id uuid,
  p_void_reason text default null,
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
  v_row public.cms_bom_recipe_line%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  if p_bom_line_id is null then
    raise exception using errcode='P0001', message='bom_line_id required';
  end if;

  select * into v_row
  from public.cms_bom_recipe_line
  where bom_line_id = p_bom_line_id
  for update;

  if not found then
    raise exception using errcode='P0001', message=format('bom_line not found: %s', p_bom_line_id);
  end if;

  if v_row.is_void = true then
    return p_bom_line_id;
  end if;

  v_before := jsonb_build_object(
    'bom_id', v_row.bom_id,
    'line_no', v_row.line_no,
    'component_ref_type', v_row.component_ref_type,
    'component_master_id', v_row.component_master_id,
    'component_part_id', v_row.component_part_id,
    'qty_per_unit', v_row.qty_per_unit,
    'unit', v_row.unit,
    'is_void', v_row.is_void
  );

  update public.cms_bom_recipe_line
  set is_void = true,
      void_reason = coalesce(nullif(trim(coalesce(p_void_reason,'')),''), 'void_by_user')
  where bom_line_id = p_bom_line_id;

  select * into v_row from public.cms_bom_recipe_line where bom_line_id = p_bom_line_id;

  v_after := jsonb_build_object(
    'is_void', v_row.is_void,
    'void_reason', v_row.void_reason
  );

  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, occurred_at, note)
  values ('BOM_RECIPE_LINE', p_bom_line_id, 'VOID_LINE', v_before, v_after, p_actor_person_id, now(), coalesce(p_note,'') || ' corr=' || p_correlation_id::text);

  return p_bom_line_id;
end $$;

alter function public.cms_fn_void_bom_recipe_line_v1(uuid,text,uuid,text,uuid)
  security definer
  set search_path = public, pg_temp;
