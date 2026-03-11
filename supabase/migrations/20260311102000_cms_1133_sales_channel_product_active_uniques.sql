create unique index if not exists uq_sales_channel_product_active_base_one
  on public.sales_channel_product(channel_id, master_item_id)
  where is_active = true and coalesce(btrim(external_variant_code), '') = '';

create unique index if not exists uq_sales_channel_product_active_variant_one
  on public.sales_channel_product(channel_id, master_item_id, external_variant_code)
  where is_active = true and coalesce(btrim(external_variant_code), '') <> '';
