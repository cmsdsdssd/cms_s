set search_path = public, pg_temp;

alter table if exists public.sales_channel_product
  drop constraint if exists sales_channel_product_sync_requires_ruleset_chk;
