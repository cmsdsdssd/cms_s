set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1013_shop_option_rule_columns_addonly
-- Add lightweight per-variant rule columns on sales_channel_product.
-- -----------------------------------------------------------------------------

alter table if exists public.sales_channel_product
  add column if not exists size_weight_delta_g numeric(18,6),
  add column if not exists option_price_delta_krw numeric(18,0);

do $$
begin
  alter table public.sales_channel_product
    add constraint sales_channel_product_size_weight_delta_range
    check (size_weight_delta_g is null or (size_weight_delta_g >= -100 and size_weight_delta_g <= 100));
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sales_channel_product
    add constraint sales_channel_product_option_price_delta_range
    check (option_price_delta_krw is null or (option_price_delta_krw >= -100000000 and option_price_delta_krw <= 100000000));
exception when duplicate_object then
  null;
end $$;
