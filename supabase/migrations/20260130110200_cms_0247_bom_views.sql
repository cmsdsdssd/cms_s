set search_path = public, pg_temp;
-- ✅ 뷰는 "참조 대상 테이블이 없으면 생성 자체가 실패"합니다.
-- 현재 DB에는 public.cms_part_item이 없을 수 있으므로,
-- 존재 여부에 따라 서로 다른 SQL로 뷰를 생성합니다.

-- worklist view는 cms_part_item을 참조하지 않으므로 그대로 생성
drop view if exists public.cms_v_bom_recipe_worklist_v1;
create view public.cms_v_bom_recipe_worklist_v1
with (security_invoker = true)
as
select
  r.bom_id,
  r.product_master_id,
  m.model_name as product_model_name,
  r.variant_key,
  r.is_active,
  r.note,
  r.meta,
  r.created_at,
  r.updated_at,
  count(l.bom_line_id) filter (where l.is_void = false) as line_count
from public.cms_bom_recipe r
join public.cms_master_item m on m.master_id = r.product_master_id
left join public.cms_bom_recipe_line l on l.bom_id = r.bom_id
group by r.bom_id, r.product_master_id, m.model_name, r.variant_key, r.is_active, r.note, r.meta, r.created_at, r.updated_at;
-- lines enriched view는 cms_part_item 존재 여부에 따라 분기 생성
drop view if exists public.cms_v_bom_recipe_lines_enriched_v1;
do $$
begin
  if to_regclass('public.cms_part_item') is not null then
    -- ✅ parts 테이블이 존재하면 정상 조인 버전
    execute $SQL$
      create view public.cms_v_bom_recipe_lines_enriched_v1
      with (security_invoker = true)
      as
      select
        r.bom_id,
        r.product_master_id,
        m.model_name as product_model_name,
        r.variant_key,
        r.is_active as recipe_is_active,
        l.bom_line_id,
        l.line_no,
        l.component_ref_type,
        l.component_master_id,
        cm.model_name as component_master_model_name,
        l.component_part_id,
        cp.part_name as component_part_name,
        l.qty_per_unit,
        l.unit,
        l.note,
        l.meta,
        l.is_void,
        l.void_reason,
        l.created_at,
        l.updated_at
      from public.cms_bom_recipe r
      join public.cms_master_item m on m.master_id = r.product_master_id
      join public.cms_bom_recipe_line l on l.bom_id = r.bom_id
      left join public.cms_master_item cm on cm.master_id = l.component_master_id
      left join public.cms_part_item cp on cp.part_id = l.component_part_id
    $SQL$;

  else
    -- ✅ parts 테이블이 없으면 component_part_name을 NULL로 제공하는 버전
    -- (운영 목표: 정합성 강요 X, 기록/분석 토대 우선. 마이그레이션은 계속 진행되어야 함)
    execute $SQL$
      create view public.cms_v_bom_recipe_lines_enriched_v1
      with (security_invoker = true)
      as
      select
        r.bom_id,
        r.product_master_id,
        m.model_name as product_model_name,
        r.variant_key,
        r.is_active as recipe_is_active,
        l.bom_line_id,
        l.line_no,
        l.component_ref_type,
        l.component_master_id,
        cm.model_name as component_master_model_name,
        l.component_part_id,
        null::text as component_part_name,
        l.qty_per_unit,
        l.unit,
        l.note,
        l.meta,
        l.is_void,
        l.void_reason,
        l.created_at,
        l.updated_at
      from public.cms_bom_recipe r
      join public.cms_master_item m on m.master_id = r.product_master_id
      join public.cms_bom_recipe_line l on l.bom_id = r.bom_id
      left join public.cms_master_item cm on cm.master_id = l.component_master_id
    $SQL$;
  end if;
end $$;
