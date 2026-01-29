set search_path = public, pg_temp;

-- 오래된 18-파라미터 오버로드 제거(있으면 삭제, 없으면 무시)
drop function if exists public.cms_fn_upsert_order_line_v3(
  uuid,  -- p_customer_party_id
  uuid,  -- p_master_id
  integer, -- p_qty
  text,  -- p_size
  boolean, -- p_is_plated
  uuid,  -- p_plating_variant_id
  text,  -- p_plating_color_code
  date,  -- p_requested_due_date
  cms_e_priority_code, -- p_priority_code
  text,  -- p_source_channel
  text,  -- p_memo
  uuid,  -- p_order_line_id
  text,  -- p_center_stone_name
  integer, -- p_center_stone_qty
  text,  -- p_sub1_stone_name
  integer, -- p_sub1_stone_qty
  text,  -- p_sub2_stone_name
  integer  -- p_sub2_stone_qty
);
