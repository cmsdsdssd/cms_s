alter table pricing_policy
  add column if not exists base_labor_sell_mode text not null default 'RULE',
  add column if not exists base_labor_sell_multiplier numeric;

alter table pricing_policy
  drop constraint if exists pricing_policy_base_labor_sell_mode_check,
  add constraint pricing_policy_base_labor_sell_mode_check
    check (base_labor_sell_mode in ('RULE', 'MULTIPLIER')),
  drop constraint if exists pricing_policy_base_labor_sell_multiplier_check,
  add constraint pricing_policy_base_labor_sell_multiplier_check
    check (
      (base_labor_sell_mode <> 'MULTIPLIER' and (base_labor_sell_multiplier is null or base_labor_sell_multiplier > 0))
      or (base_labor_sell_mode = 'MULTIPLIER' and base_labor_sell_multiplier is not null and base_labor_sell_multiplier > 0)
    );
