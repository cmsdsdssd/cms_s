set search_path = public, pg_temp;

alter table public.pricing_policy
  add column if not exists auto_sync_threshold_profile text not null default 'GENERAL';

update public.pricing_policy
set auto_sync_threshold_profile = case
  when upper(trim(coalesce(auto_sync_threshold_profile, 'GENERAL'))) in ('GENERAL', 'MARKET_LINKED')
    then upper(trim(coalesce(auto_sync_threshold_profile, 'GENERAL')))
  else 'GENERAL'
end
where auto_sync_threshold_profile is null
   or upper(trim(auto_sync_threshold_profile)) not in ('GENERAL', 'MARKET_LINKED');

alter table public.pricing_policy
  alter column auto_sync_threshold_profile set default 'GENERAL';

do $$
begin
  alter table public.pricing_policy
    add constraint pricing_policy_auto_sync_threshold_profile_valid
    check (auto_sync_threshold_profile in ('GENERAL', 'MARKET_LINKED'));
exception when duplicate_object then
  null;
end $$;
