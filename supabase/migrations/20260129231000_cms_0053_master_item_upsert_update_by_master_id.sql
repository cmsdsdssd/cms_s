-- supabase/migrations/20260129231000_cms_0053_master_item_upsert_update_by_master_id.sql

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

  p_labor_base_sell numeric default 0,
  p_labor_center_sell numeric default 0,
  p_labor_sub1_sell numeric default 0,
  p_labor_sub2_sell numeric default 0,

  p_labor_base_cost numeric default 0,
  p_labor_center_cost numeric default 0,
  p_labor_sub1_cost numeric default 0,
  p_labor_sub2_cost numeric default 0,

  p_plating_price_sell_default numeric default 0,
  p_plating_price_cost_default numeric default 0,

  p_labor_profile_mode text default 'MANUAL',
  p_labor_band_code text default null,

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
  v_id uuid;
  v_other uuid;
  v_kind public.cms_e_master_kind := coalesce(p_master_kind, 'MODEL'::public.cms_e_master_kind);
  v_model text := trim(coalesce(p_model_name,''));
  v_category public.cms_e_category_code;
begin
  if v_model = '' then
    raise exception using errcode='P0001', message='model_name is required';
  end if;

  -- category 자동 채움 + MODEL 필수값 검증
  if v_kind = 'MODEL'::public.cms_e_master_kind then
    v_category := coalesce(p_category_code, public.cms_fn_category_code_from_model_name(v_model));
    if v_category is null then
      raise exception using errcode='P0001', message=format('category_code parse failed (model_name=%s)', v_model);
    end if;

    if p_material_code_default is null then
      raise exception using errcode='P0001',
        message=format('material_code_default is required for MODEL master_item (model_name=%s)', v_model);
    end if;
  else
    v_category := p_category_code;
  end if;

  -- ✅ 1) master_id가 이미 존재하면 UPDATE로 처리 (model_name 변경 포함)
  if p_master_id is not null then
    perform 1 from public.cms_master_item where master_id = p_master_id;
    if found then
      -- model_name이 다른 master_id에 이미 존재하면 충돌 방지
      select master_id into v_other
      from public.cms_master_item
      where model_name = v_model
      limit 1;

      if v_other is not null and v_other <> p_master_id then
        raise exception using
          errcode='P0001',
          message=format('model_name already exists with different master_id (model_name=%s)', v_model);
      end if;

      update public.cms_master_item
      set
        model_name = v_model,
        master_kind = v_kind,
        vendor_party_id = p_vendor_party_id,
        category_code = v_category,
        material_code_default = p_material_code_default,
        weight_default_g = p_weight_default_g,
        deduction_weight_default_g = coalesce(p_deduction_weight_default_g, 0),
        center_qty_default = coalesce(p_center_qty_default, 0),
        sub1_qty_default = coalesce(p_sub1_qty_default, 0),
        sub2_qty_default = coalesce(p_sub2_qty_default, 0),

        labor_base_sell = coalesce(p_labor_base_sell, 0),
        labor_center_sell = coalesce(p_labor_center_sell, 0),
        labor_sub1_sell = coalesce(p_labor_sub1_sell, 0),
        labor_sub2_sell = coalesce(p_labor_sub2_sell, 0),

        labor_base_cost = coalesce(p_labor_base_cost, 0),
        labor_center_cost = coalesce(p_labor_center_cost, 0),
        labor_sub1_cost = coalesce(p_labor_sub1_cost, 0),
        labor_sub2_cost = coalesce(p_labor_sub2_cost, 0),

        plating_price_sell_default = coalesce(p_plating_price_sell_default, 0),
        plating_price_cost_default = coalesce(p_plating_price_cost_default, 0),

        labor_profile_mode = coalesce(p_labor_profile_mode, 'MANUAL'),
        labor_band_code = p_labor_band_code,

        note = p_note,
        image_path = p_image_path,
        updated_at = now()
      where master_id = p_master_id
      returning master_id into v_id;

      return v_id;
    end if;
  end if;

  -- ✅ 2) 신규/미존재 master_id는 기존 로직(모델명 기준 upsert) 유지
  insert into public.cms_master_item(
    master_id, model_name, master_kind, vendor_party_id,
    category_code, material_code_default,
    weight_default_g, deduction_weight_default_g,
    center_qty_default, sub1_qty_default, sub2_qty_default,

    labor_base_sell, labor_center_sell, labor_sub1_sell, labor_sub2_sell,
    labor_base_cost, labor_center_cost, labor_sub1_cost, labor_sub2_cost,

    plating_price_sell_default, plating_price_cost_default,
    labor_profile_mode, labor_band_code,

    note, image_path, updated_at
  )
  values(
    coalesce(p_master_id, gen_random_uuid()),
    v_model,
    v_kind,
    p_vendor_party_id,

    v_category,
    p_material_code_default,

    p_weight_default_g,
    coalesce(p_deduction_weight_default_g, 0),

    coalesce(p_center_qty_default, 0),
    coalesce(p_sub1_qty_default, 0),
    coalesce(p_sub2_qty_default, 0),

    coalesce(p_labor_base_sell, 0),
    coalesce(p_labor_center_sell, 0),
    coalesce(p_labor_sub1_sell, 0),
    coalesce(p_labor_sub2_sell, 0),

    coalesce(p_labor_base_cost, 0),
    coalesce(p_labor_center_cost, 0),
    coalesce(p_labor_sub1_cost, 0),
    coalesce(p_labor_sub2_cost, 0),

    coalesce(p_plating_price_sell_default, 0),
    coalesce(p_plating_price_cost_default, 0),

    coalesce(p_labor_profile_mode, 'MANUAL'),
    p_labor_band_code,

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

    labor_base_sell = excluded.labor_base_sell,
    labor_center_sell = excluded.labor_center_sell,
    labor_sub1_sell = excluded.labor_sub1_sell,
    labor_sub2_sell = excluded.labor_sub2_sell,
    labor_base_cost = excluded.labor_base_cost,
    labor_center_cost = excluded.labor_center_cost,
    labor_sub1_cost = excluded.labor_sub1_cost,
    labor_sub2_cost = excluded.labor_sub2_cost,

    plating_price_sell_default = excluded.plating_price_sell_default,
    plating_price_cost_default = excluded.plating_price_cost_default,
    labor_profile_mode = excluded.labor_profile_mode,
    labor_band_code = excluded.labor_band_code,

    note = excluded.note,
    image_path = excluded.image_path,
    updated_at = excluded.updated_at
  returning master_id into v_id;

  return v_id;
end $$;
grant execute on function public.cms_fn_upsert_master_item_v1(
  uuid,text,public.cms_e_master_kind,public.cms_e_category_code,public.cms_e_material_code,
  numeric,numeric,integer,integer,integer,
  numeric,numeric,numeric,numeric,
  numeric,numeric,numeric,numeric,
  numeric,numeric,
  text,text,
  uuid,text,text,uuid
) to authenticated;
