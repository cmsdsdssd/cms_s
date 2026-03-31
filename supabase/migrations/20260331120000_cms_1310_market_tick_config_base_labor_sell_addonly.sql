alter table public.cms_market_tick_config
  add column if not exists base_labor_sell_mode text,
  add column if not exists base_labor_sell_multiplier numeric;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cms_market_tick_config_base_labor_sell_mode_check') then
    alter table public.cms_market_tick_config
      add constraint cms_market_tick_config_base_labor_sell_mode_check
      check (base_labor_sell_mode is null or base_labor_sell_mode in ('RULE', 'MULTIPLIER'));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cms_market_tick_config_base_labor_sell_multiplier_check') then
    alter table public.cms_market_tick_config
      add constraint cms_market_tick_config_base_labor_sell_multiplier_check
      check (
        (coalesce(base_labor_sell_mode, 'RULE') <> 'MULTIPLIER' and (base_labor_sell_multiplier is null or base_labor_sell_multiplier > 0))
        or (coalesce(base_labor_sell_mode, 'RULE') = 'MULTIPLIER' and base_labor_sell_multiplier is not null and base_labor_sell_multiplier > 0)
      );
  end if;
end $$;

update public.cms_market_tick_config
set base_labor_sell_mode = coalesce(base_labor_sell_mode, 'RULE')
where config_key = 'DEFAULT';

comment on column public.cms_market_tick_config.base_labor_sell_mode is
  'Settings-owned base labor auto-sell mode for catalog base labor calculation. Defaults fail-closed to RULE.';

comment on column public.cms_market_tick_config.base_labor_sell_multiplier is
  'Positive multiplier used only when base_labor_sell_mode=MULTIPLIER.';
