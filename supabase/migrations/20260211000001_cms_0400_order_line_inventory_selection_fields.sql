set search_path = public, pg_temp;
-- add-only: persist selected inventory snapshot fields on order line
alter table public.cms_order_line
  add column if not exists selected_base_weight_g numeric,
  add column if not exists selected_deduction_weight_g numeric,
  add column if not exists selected_net_weight_g numeric,
  add column if not exists selected_labor_base_sell_krw numeric,
  add column if not exists selected_labor_other_sell_krw numeric,
  add column if not exists selected_inventory_move_line_id uuid,
  add column if not exists selected_inventory_location_code text,
  add column if not exists selected_inventory_bin_code text;
