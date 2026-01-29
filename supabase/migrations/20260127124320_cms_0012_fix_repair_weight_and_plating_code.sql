-- cms_0012: fix repair weight column usage + plating_code derivation
-- 筌뤴뫗??
-- 1) cms_fn_upsert_repair_line_v1: measured_weight_g ???뵬沃섎챸苑ｇ몴???쇱젫 ?뚎됱쓥 weight_received_g?????
-- 2) repair view?癒?퐣 pv.code 揶쏆늿? ??용뮉 ?뚎됱쓥 筌〓챷????볤탢??랁?plating_code ???문

begin;

-- ------------------------------------------------------------
-- 2-1) DROP + CREATE (default ?얜챷????곕돗)
--   - ?⑥눊援???뺣즲/??뽮퐣 癰귛칰?뚯몵嚥???????볥젃??됱퓗揶???λ툡??됱뱽 ????됰선 獄쎻뫗堉?怨몄몵嚥?DROP ????첎?
-- ------------------------------------------------------------
drop function if exists public.cms_fn_upsert_repair_line_v1(
  uuid, uuid, text, text, text, cms_e_material_code, integer, numeric, boolean, uuid, numeric, date, text
);

drop function if exists public.cms_fn_upsert_repair_line_v1(
  uuid, text, text, text, cms_e_material_code, integer, numeric, boolean, uuid, numeric, date, text, uuid
);

-- (?袁⑹삺 ?袁⑥쨮??븍뱜揶??怨뺣뮉 ??? ??볥젃??됱퓗: customer_party_id嚥???뽰삂)
drop function if exists public.cms_fn_upsert_repair_line_v1(
  uuid, text, text, text, cms_e_material_code, integer, numeric, boolean, uuid, numeric, date, text, uuid
);

create function public.cms_fn_upsert_repair_line_v1(
  p_customer_party_id uuid,
  p_model_name text,
  p_suffix text,
  p_color text,
  p_material_code cms_e_material_code,
  p_qty integer,
  p_measured_weight_g numeric,
  p_is_plated boolean,
  p_plating_variant_id uuid,
  p_repair_fee_krw numeric,
  p_received_at date,
  p_memo text,
  p_repair_line_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_status_text text;
begin
  if p_customer_party_id is null then raise exception 'customer_party_id required'; end if;
  if p_model_name is null or length(trim(p_model_name))=0 then raise exception 'model_name required'; end if;
  if p_suffix is null or length(trim(p_suffix))=0 then raise exception 'suffix required'; end if;
  if p_color  is null or length(trim(p_color))=0  then raise exception 'color required'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'qty must be > 0'; end if;

  v_id := coalesce(p_repair_line_id, gen_random_uuid());

  -- ??? SHIPPED/CANCELLED筌???륁젟 筌△뫀??(enum ??됱읈: text ??쑨??
  select r.status::text
    into v_status_text
  from public.cms_repair_line r
  where r.repair_line_id = v_id;

  if v_status_text in ('SHIPPED','CANCELLED') then
    raise exception 'cannot modify repair_line in status=% (repair_line_id=%)', v_status_text, v_id;
  end if;

  insert into public.cms_repair_line(
    repair_line_id,
    customer_party_id,
    received_at,
    model_name,
    model_name_raw,
    suffix,
    material_code,
    color,
    qty,
    weight_received_g,      -- ????쇱젫 ?뚎됱쓥
    is_plated,
    plating_variant_id,
    repair_fee_krw,
    memo
  )
  values (
    v_id,
    p_customer_party_id,
    p_received_at,
    trim(p_model_name),
    trim(p_model_name),
    trim(p_suffix),
    p_material_code,
    trim(p_color),
    p_qty,
    p_measured_weight_g,    -- ?????뵬沃섎챸苑ｏ쭗?? ?醫?(?紐꾪뀱???紐낆넎), ??關? weight_received_g
    coalesce(p_is_plated,false),
    p_plating_variant_id,
    coalesce(p_repair_fee_krw,0),
    p_memo
  )
  on conflict (repair_line_id) do update set
    customer_party_id  = excluded.customer_party_id,
    received_at        = excluded.received_at,
    model_name         = excluded.model_name,
    model_name_raw     = excluded.model_name_raw,
    suffix             = excluded.suffix,
    material_code      = excluded.material_code,
    color              = excluded.color,
    qty                = excluded.qty,
    weight_received_g  = excluded.weight_received_g,
    is_plated          = excluded.is_plated,
    plating_variant_id = excluded.plating_variant_id,
    repair_fee_krw     = excluded.repair_fee_krw,
    memo               = excluded.memo,
    updated_at         = now();

  return v_id;
end $$;

-- 亦낅슦釉??袁⑥쨮??븍뱜 ?類ㅼ퐠?嚥?authenticated筌?
grant execute on function public.cms_fn_upsert_repair_line_v1(
  uuid, text, text, text, cms_e_material_code, integer, numeric, boolean, uuid, numeric, date, text, uuid
) to authenticated;

-- ------------------------------------------------------------
-- 2-2) Repair view (enriched) - pv.code ??볤탢 / measured_weight_g alias ??볥궗
--   - 疫꿸퀣???繹먥뫁彛?????已???類ㅼ젟 筌륁궢六??곕빍, ?브쑴苑?UI????? ?됯퀡? ??롪돌 ??볥궗
--   - ??덈뮉 ??롮몵嚥?Repair 筌뤴뫖以? ???됯퀡? ?怨뺛늺 ??
-- ------------------------------------------------------------
drop view if exists public.cms_v_repair_line_enriched_v1;
create view public.cms_v_repair_line_enriched_v1 as
select
  r.repair_line_id,
  r.customer_party_id,
  p.name as customer_name,
  r.received_at,
  r.model_name,
  r.model_name_raw,
  r.suffix,
  r.material_code,
  r.color,
  r.qty,
  r.weight_received_g as measured_weight_g, -- ??alias嚥???볥궗
  r.is_plated,
  r.plating_variant_id,
  concat_ws('-', rtrim(pv.plating_type::text), nullif(pv.color_code,''), nullif(pv.thickness_code,'')) as plating_code,
  pv.display_name as plating_display_name,
  r.repair_fee_krw,
  r.status,
  r.memo,
  r.source_channel,
  r.correlation_id,
  r.created_at,
  r.updated_at
from public.cms_repair_line r
left join public.cms_party p on p.party_id = r.customer_party_id
left join public.cms_plating_variant pv on pv.plating_variant_id = r.plating_variant_id;

grant select on public.cms_v_repair_line_enriched_v1 to authenticated;

commit;
 