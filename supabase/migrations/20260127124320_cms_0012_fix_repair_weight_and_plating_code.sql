-- cms_0012: fix repair weight column usage + plating_code derivation
-- 紐⑹쟻:
-- 1) cms_fn_upsert_repair_line_v1: measured_weight_g ?뚮씪誘명꽣瑜??ㅼ젣 而щ읆 weight_received_g?????
-- 2) repair view?먯꽌 pv.code 媛숈? ?녿뒗 而щ읆 李몄“ ?쒓굅?섍퀬 plating_code ?뚯깮

begin;
-- ------------------------------------------------------------
-- 2-1) DROP + CREATE (default 臾몄젣 ?뚰뵾)
--   - 怨쇨굅 ?쒕룄/?쒖꽌 蹂寃쎌쑝濡??щ윭 ?쒓렇?덉쿂媛 ?⑥븘?덉쓣 ???덉뼱 諛⑹뼱?곸쑝濡?DROP ?щ윭媛?
-- ------------------------------------------------------------
drop function if exists public.cms_fn_upsert_repair_line_v1(
  uuid, uuid, text, text, text, cms_e_material_code, integer, numeric, boolean, uuid, numeric, date, text
);
drop function if exists public.cms_fn_upsert_repair_line_v1(
  uuid, text, text, text, cms_e_material_code, integer, numeric, boolean, uuid, numeric, date, text, uuid
);
-- (?꾩옱 ?꾨줈?앺듃媛 ?곕뒗 ?쒖? ?쒓렇?덉쿂: customer_party_id濡??쒖옉)
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

  -- ?대? SHIPPED/CANCELLED硫??섏젙 李⑤떒 (enum ?덉쟾: text 鍮꾧탳)
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
    weight_received_g,      -- ???ㅼ젣 而щ읆
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
    p_measured_weight_g,    -- ???뚮씪誘명꽣紐낆? ?좎?(?몄텧遺 ?명솚), ??μ? weight_received_g
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
-- 沅뚰븳(?꾨줈?앺듃 ?뺤콉?濡?authenticated留?
grant execute on function public.cms_fn_upsert_repair_line_v1(
  uuid, text, text, text, cms_e_material_code, integer, numeric, boolean, uuid, numeric, date, text, uuid
) to authenticated;
-- ------------------------------------------------------------
-- 2-2) Repair view (enriched) - pv.code ?쒓굅 / measured_weight_g alias ?쒓났
--   - 湲곗〈??源⑥쭊 酉??대쫫???뺤젙 紐삵뻽?쇰땲, 遺꾩꽍/UI???쒖? 酉곕? ?섎굹 ?쒓났
--   - ?덈뒗 ?욎쑝濡?Repair 紐⑸줉? ??酉곕? ?곕㈃ ??
-- ------------------------------------------------------------
create or replace view public.cms_v_repair_line_enriched_v1 as
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
  r.weight_received_g as measured_weight_g, -- ??alias濡??쒓났
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
