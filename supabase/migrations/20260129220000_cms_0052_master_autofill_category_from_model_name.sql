set search_path = public, pg_temp;

-- 1) 모델명 -> category_code 파서 (서버 SoT)
create or replace function public.cms_fn_category_code_from_model_name(p_model_name text)
returns public.cms_e_category_code
language plpgsql
immutable
as $$
declare
  v text := trim(coalesce(p_model_name,''));
  v_last text;
  v_letter text;
begin
  if v = '' then
    return 'ETC'::public.cms_e_category_code;
  end if;

  -- 우선순위 1) 마지막 '-' 세그먼트
  if position('-' in v) > 0 then
    v_last := trim(split_part(v, '-', array_length(string_to_array(v, '-'), 1)));

    if v_last = '발찌' then
      return 'BRACELET'::public.cms_e_category_code; -- enum에 발찌가 별도로 없어서 BRACELET로
    end if;

    if v_last ~* '^[a-z]$' then
      v_letter := upper(v_last);
    else
      return 'ETC'::public.cms_e_category_code;
    end if;
  else
    -- 우선순위 2) 레거시 끝문자 방식
    select upper((regexp_match(v, '([A-Za-z])\s*$'))[1]) into v_letter;
    if v_letter is null then
      if right(v, 2) = '발찌' then
        return 'BRACELET'::public.cms_e_category_code;
      end if;
      return 'ETC'::public.cms_e_category_code;
    end if;
  end if;

  case v_letter
    when 'R' then return 'RING'::public.cms_e_category_code;
    when 'B' then return 'BRACELET'::public.cms_e_category_code;
    when 'E' then return 'EARRING'::public.cms_e_category_code;
    when 'N' then return 'NECKLACE'::public.cms_e_category_code;
    when 'M' then return 'PENDANT'::public.cms_e_category_code;
    when 'U' then return 'ETC'::public.cms_e_category_code; -- 부속 전용 enum 없음
    when 'W' then return 'WATCH'::public.cms_e_category_code;
    when 'K' then return 'KEYRING'::public.cms_e_category_code;
    when 'S' then return 'SYMBOL'::public.cms_e_category_code;
    when 'Z' then return 'ETC'::public.cms_e_category_code;
    else return 'ETC'::public.cms_e_category_code;
  end case;
end $$;

-- 2) 기존 master upsert RPC를 "category 자동 채움" 포함해서 재정의
drop function if exists public.cms_fn_upsert_master_item_v1(uuid,text,public.cms_e_master_kind,public.cms_e_category_code,public.cms_e_material_code,numeric,numeric,integer,integer,integer,uuid,text,text,uuid);

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
  v_kind public.cms_e_master_kind := coalesce(p_master_kind, 'MODEL'::public.cms_e_master_kind);
  v_model text := trim(coalesce(p_model_name,''));
  v_category public.cms_e_category_code;
begin
  if v_model = '' then
    raise exception using errcode='P0001', message='model_name is required';
  end if;

  -- ✅ category 자동 채움: MODEL이면 model_name에서 파싱 우선 적용(입력값이 있으면 존중)
  if v_kind = 'MODEL'::public.cms_e_master_kind then
    v_category := coalesce(p_category_code, public.cms_fn_category_code_from_model_name(v_model));
    if v_category is null then
      raise exception using errcode='P0001', message=format('category_code parse failed (model_name=%s)', v_model);
    end if;

    -- ✅ 출고에서 필요하니 MODEL은 material 기본값도 강제(이미 겪은 문제 방지)
    if p_material_code_default is null then
      raise exception using errcode='P0001',
        message=format('material_code_default is required for MODEL master_item (model_name=%s)', v_model);
    end if;
  else
    -- PART/STONE은 category/material null 허용
    v_category := p_category_code;
  end if;

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
