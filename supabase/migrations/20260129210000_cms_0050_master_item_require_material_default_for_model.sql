set search_path = public, pg_temp;

create or replace function public.cms_fn_upsert_master_item_v1(
  p_master_id uuid default null,
  p_model_name text default null,
  p_master_kind public.cms_e_master_kind default 'MODEL',
  p_category_code public.cms_e_category_code default null,
  p_material_code_default public.cms_e_material_code default null,
  p_weight_default_g numeric default null,
  p_deduction_weight_default_g numeric default 0,
  p_center_qty_default int default 0,
  p_sub1_qty_default int default 0,
  p_sub2_qty_default int default 0,
  p_vendor_party_id uuid default null,
  p_note text default null,
  p_image_path text default null,
  p_actor_person_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_existing uuid;
  v_id uuid;
begin
  if p_model_name is null or length(trim(p_model_name)) = 0 then
    raise exception using errcode='P0001', message='model_name is required';
  end if;

  if p_master_kind = 'MODEL'::public.cms_e_master_kind and p_category_code is null then
    raise exception using errcode='P0001',
      message=format('category_code is required for MODEL master_item (model_name=%s)', trim(p_model_name));
  end if;

  -- ✅ NEW
  if p_master_kind = 'MODEL'::public.cms_e_master_kind and p_material_code_default is null then
    raise exception using errcode='P0001',
      message=format('material_code_default is required for MODEL master_item (model_name=%s)', trim(p_model_name));
  end if;

  select master_id into v_existing
  from public.cms_master_item
  where model_name = trim(p_model_name)
  limit 1;

  if p_master_id is not null and v_existing is not null and v_existing <> p_master_id then
    raise exception using errcode='P0001',
      message=format('model_name already exists with different master_id (model_name=%s)', trim(p_model_name));
  end if;

  insert into public.cms_master_item(
    master_id, model_name, master_kind, vendor_party_id,
    category_code, material_code_default,
    weight_default_g, deduction_weight_default_g,
    center_qty_default, sub1_qty_default, sub2_qty_default,
    note, image_path, updated_at
  )
  values(
    coalesce(p_master_id, gen_random_uuid()),
    trim(p_model_name),
    coalesce(p_master_kind, 'MODEL'::public.cms_e_master_kind),
    p_vendor_party_id,
    p_category_code,
    p_material_code_default,
    p_weight_default_g,
    coalesce(p_deduction_weight_default_g, 0),
    coalesce(p_center_qty_default, 0),
    coalesce(p_sub1_qty_default, 0),
    coalesce(p_sub2_qty_default, 0),
    p_note,
    p_image_path,
    now()
  )
  on conflict (model_name) do update
  set
    master_kind = excluded.master_kind,
    vendor_party_id = excluded.vendor_party_id,
    category_code = excluded.category_code,
    material_code_default = excluded.material_code_default,
    weight_default_g = excluded.weight_default_g,
    deduction_weight_default_g = excluded.deduction_weight_default_g,
    center_qty_default = excluded.center_qty_default,
    sub1_qty_default = excluded.sub1_qty_default,
    sub2_qty_default = excluded.sub2_qty_default,
    note = excluded.note,
    image_path = excluded.image_path,
    updated_at = excluded.updated_at
  returning master_id into v_id;

  return v_id;
end $$;

grant execute on function public.cms_fn_upsert_master_item_v1(
  uuid,text,cms_e_master_kind,cms_e_category_code,cms_e_material_code,numeric,numeric,integer,integer,integer,uuid,text,text,uuid
) to authenticated;
