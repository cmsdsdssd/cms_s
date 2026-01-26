-- cms_0012: fix repair weight column usage + plating_code derivation
-- 목적:
-- 1) cms_fn_upsert_repair_line_v1: measured_weight_g 파라미터를 실제 컬럼 weight_received_g에 저장
-- 2) repair view에서 pv.code 같은 없는 컬럼 참조 제거하고 plating_code 파생

begin;

-- ------------------------------------------------------------
-- 2-1) DROP + CREATE (default 문제 회피)
--   - 과거 시도/순서 변경으로 여러 시그니처가 남아있을 수 있어 방어적으로 DROP 여러개
-- ------------------------------------------------------------
drop function if exists public.cms_fn_upsert_repair_line_v1(
  uuid, uuid, text, text, text, cms_e_material_code, integer, numeric, boolean, uuid, numeric, date, text
);

drop function if exists public.cms_fn_upsert_repair_line_v1(
  uuid, text, text, text, cms_e_material_code, integer, numeric, boolean, uuid, numeric, date, text, uuid
);

-- (현재 프로젝트가 쓰는 표준 시그니처: customer_party_id로 시작)
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

  -- 이미 SHIPPED/CANCELLED면 수정 차단 (enum 안전: text 비교)
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
    weight_received_g,      -- ✅ 실제 컬럼
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
    p_measured_weight_g,    -- ✅ 파라미터명은 유지(호출부 호환), 저장은 weight_received_g
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

-- 권한(프로젝트 정책대로 authenticated만)
grant execute on function public.cms_fn_upsert_repair_line_v1(
  uuid, text, text, text, cms_e_material_code, integer, numeric, boolean, uuid, numeric, date, text, uuid
) to authenticated;

-- ------------------------------------------------------------
-- 2-2) Repair view (enriched) - pv.code 제거 / measured_weight_g alias 제공
--   - 기존에 깨진 뷰 이름을 확정 못했으니, 분석/UI용 표준 뷰를 하나 제공
--   - 너는 앞으로 Repair 목록은 이 뷰를 쓰면 됨
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
  r.weight_received_g as measured_weight_g, -- ✅ alias로 제공
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
 