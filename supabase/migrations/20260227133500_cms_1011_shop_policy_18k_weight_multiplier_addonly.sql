set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1011_shop_policy_18k_weight_multiplier_addonly
-- Channel policy-level 18K option weight multiplier
-- -----------------------------------------------------------------------------

alter table if exists public.pricing_policy
  add column if not exists option_18k_weight_multiplier numeric(12,6);

update public.pricing_policy
set option_18k_weight_multiplier = coalesce(option_18k_weight_multiplier, 1.200000)
where option_18k_weight_multiplier is null;

alter table if exists public.pricing_policy
  alter column option_18k_weight_multiplier set default 1.200000;

alter table if exists public.pricing_policy
  alter column option_18k_weight_multiplier set not null;

do $$
begin
  alter table public.pricing_policy
    add constraint pricing_policy_option_18k_weight_multiplier_positive
    check (option_18k_weight_multiplier > 0);
exception when duplicate_object then
  null;
end $$;
