set search_path = public, pg_temp;

alter table public.pricing_policy
  add column if not exists option_rounding_unit integer not null default 500,
  add column if not exists option_rounding_mode text not null default 'CEIL';

alter table public.pricing_policy
  drop constraint if exists pricing_policy_option_rounding_mode_check;

alter table public.pricing_policy
  add constraint pricing_policy_option_rounding_mode_check
  check (option_rounding_mode in ('CEIL', 'ROUND', 'FLOOR'));

update public.pricing_policy
set option_rounding_unit = 500
where option_rounding_unit is null;

update public.pricing_policy
set option_rounding_mode = 'CEIL'
where option_rounding_mode is null;
