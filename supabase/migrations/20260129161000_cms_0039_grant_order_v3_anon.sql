set search_path = public, pg_temp;

-- ⚠️ 동일 이름 함수가 오버로드(19 params / 21 params)로 공존하는 구간이 있어
-- 시그니처 없이 GRANT 하면 42725(함수명이 유일하지 않음) 에러가 납니다.
-- 그래서 두 시그니처 모두 명시해서 권한을 부여합니다.

-- v3 (19 params) : 0034 / 0047 기준
grant execute on function public.cms_fn_upsert_order_line_v3(
  uuid, -- p_customer_party_id
  uuid, -- p_master_id
  int,  -- p_qty
  text, -- p_size
  boolean, -- p_is_plated
  uuid, -- p_plating_variant_id
  text, -- p_plating_color_code
  date, -- p_requested_due_date
  cms_e_priority_code, -- p_priority_code
  text, -- p_source_channel
  text, -- p_memo
  uuid, -- p_order_line_id
  text, -- p_center_stone_name
  int,  -- p_center_stone_qty
  text, -- p_sub1_stone_name
  int,  -- p_sub1_stone_qty
  text, -- p_sub2_stone_name
  int,  -- p_sub2_stone_qty
  uuid  -- p_actor_person_id
) to anon, authenticated, service_role;

-- v3 (21 params) : 0034d / 0039_fix 기준 (suffix/color override 포함)
grant execute on function public.cms_fn_upsert_order_line_v3(
  uuid, -- p_customer_party_id
  uuid, -- p_master_id
  int,  -- p_qty
  text, -- p_size
  boolean, -- p_is_plated
  uuid, -- p_plating_variant_id
  text, -- p_plating_color_code
  date, -- p_requested_due_date
  cms_e_priority_code, -- p_priority_code
  text, -- p_source_channel
  text, -- p_memo
  uuid, -- p_order_line_id
  text, -- p_center_stone_name
  int,  -- p_center_stone_qty
  text, -- p_sub1_stone_name
  int,  -- p_sub1_stone_qty
  text, -- p_sub2_stone_name
  int,  -- p_sub2_stone_qty
  uuid, -- p_actor_person_id
  text, -- p_suffix
  text  -- p_color
) to anon, authenticated, service_role;
