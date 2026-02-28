set search_path = public, pg_temp;

alter table public.sales_channel_product
  add column if not exists option_price_mode text not null default 'SYNC',
  add column if not exists option_manual_target_krw numeric(14,2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_channel_product_option_price_mode_check'
  ) then
    alter table public.sales_channel_product
      add constraint sales_channel_product_option_price_mode_check
      check (option_price_mode in ('SYNC','MANUAL'));
  end if;
end
$$;
