set search_path = public, pg_temp;

alter table public.sales_channel_product
  add column if not exists size_price_override_enabled boolean not null default false,
  add column if not exists size_price_override_krw integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_channel_product_size_price_override_krw_step'
  ) then
    alter table public.sales_channel_product
      add constraint sales_channel_product_size_price_override_krw_step
      check (
        size_price_override_krw is null
        or mod(size_price_override_krw, 100) = 0
      );
  end if;
end
$$;

update public.sales_channel_product
set
  size_price_override_enabled = false,
  size_price_override_krw = null
where size_price_override_enabled is null;

update public.channel_option_labor_rule_v1
set
  size_price_mode = 'MARKET_LINKED',
  additive_delta_krw = 0,
  fixed_delta_krw = null,
  formula_multiplier = coalesce(formula_multiplier, 1),
  formula_offset_krw = coalesce(formula_offset_krw, 0),
  rounding_unit_krw = coalesce(rounding_unit_krw, 100),
  rounding_mode = coalesce(rounding_mode, 'UP')
where category_key = 'SIZE';
