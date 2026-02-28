set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1019_shop_sync_rule_mapping_fields_addonly
-- Add mapping fields for rule-driven sync matching.
-- -----------------------------------------------------------------------------

alter table if exists public.sales_channel_product
  add column if not exists option_material_code text,
  add column if not exists option_color_code text,
  add column if not exists option_size_value numeric(12,3);

do $$
begin
  alter table public.sales_channel_product
    add constraint sales_channel_product_option_material_code_not_blank
    check (option_material_code is null or btrim(option_material_code) <> '');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sales_channel_product
    add constraint sales_channel_product_option_color_code_not_blank
    check (option_color_code is null or btrim(option_color_code) <> '');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sales_channel_product
    add constraint sales_channel_product_option_size_value_nonneg
    check (option_size_value is null or option_size_value >= 0);
exception when duplicate_object then
  null;
end $$;

create index if not exists idx_sales_channel_product_rule_fields
  on public.sales_channel_product(channel_id, sync_rule_set_id, option_material_code, option_color_code, option_size_value)
  where is_active = true;
