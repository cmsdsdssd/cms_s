set search_path = public, pg_temp;

alter table public.sales_channel_product
  add column if not exists current_product_sync_profile text not null default 'GENERAL';

update public.sales_channel_product
set current_product_sync_profile = case
  when upper(trim(coalesce(current_product_sync_profile, 'GENERAL'))) in ('GENERAL', 'MARKET_LINKED')
    then upper(trim(coalesce(current_product_sync_profile, 'GENERAL')))
  else 'GENERAL'
end
where current_product_sync_profile is null
   or upper(trim(current_product_sync_profile)) not in ('GENERAL', 'MARKET_LINKED');

alter table public.sales_channel_product
  alter column current_product_sync_profile set default 'GENERAL';

do $$
begin
  alter table public.sales_channel_product
    add constraint sales_channel_product_current_product_sync_profile_valid
    check (current_product_sync_profile in ('GENERAL', 'MARKET_LINKED'));
exception when duplicate_object then
  null;
end $$;
