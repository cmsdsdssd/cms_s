set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1010_shop_variant_mapping_multiplier_addonly
-- Variant-aware mapping key + material multiplier override for option products
-- -----------------------------------------------------------------------------

alter table if exists public.sales_channel_product
  add column if not exists material_multiplier_override numeric(18,6);

update public.sales_channel_product
set external_variant_code = ''
where external_variant_code is null;

alter table if exists public.sales_channel_product
  alter column external_variant_code set default '';

alter table if exists public.sales_channel_product
  alter column external_variant_code set not null;

drop index if exists public.uq_sales_channel_product_ext;

create unique index if not exists uq_sales_channel_product_ext_variant
  on public.sales_channel_product(
    channel_id,
    external_product_no,
    external_variant_code
  );

do $$
begin
  alter table public.sales_channel_product
    add constraint sales_channel_product_material_multiplier_positive
    check (material_multiplier_override is null or material_multiplier_override > 0);
exception when duplicate_object then
  null;
end $$;
