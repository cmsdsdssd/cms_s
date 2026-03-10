set search_path = public, pg_temp;

alter table public.channel_option_labor_rule_v1
  add column if not exists size_price_mode text,
  add column if not exists formula_multiplier numeric(12,6),
  add column if not exists formula_offset_krw integer,
  add column if not exists rounding_unit_krw integer,
  add column if not exists rounding_mode text,
  add column if not exists fixed_delta_krw integer;

do $$
begin
  alter table public.channel_option_labor_rule_v1
    add constraint channel_option_labor_rule_v1_size_price_mode_valid
    check (size_price_mode is null or size_price_mode in ('MARKET_LINKED', 'FIXED_DELTA'));
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_labor_rule_v1
    add constraint channel_option_labor_rule_v1_rounding_mode_valid
    check (rounding_mode is null or rounding_mode in ('UP', 'NEAREST', 'DOWN'));
exception when duplicate_object then
  null;
end $$;

update public.channel_option_labor_rule_v1
set
  size_price_mode = coalesce(size_price_mode, case when category_key = 'SIZE' then 'FIXED_DELTA' else null end),
  formula_multiplier = coalesce(formula_multiplier, case when category_key = 'SIZE' then 1 else null end),
  formula_offset_krw = coalesce(formula_offset_krw, case when category_key = 'SIZE' then 0 else null end),
  rounding_unit_krw = coalesce(rounding_unit_krw, case when category_key = 'SIZE' then 100 else null end),
  rounding_mode = coalesce(rounding_mode, case when category_key = 'SIZE' then 'UP' else null end),
  fixed_delta_krw = coalesce(fixed_delta_krw, case when category_key = 'SIZE' then additive_delta_krw else null end)
where category_key = 'SIZE';
