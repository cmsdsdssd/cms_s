set search_path = public, pg_temp;

alter table public.pricing_policy
  add column if not exists auto_sync_force_full boolean not null default false,
  add column if not exists auto_sync_min_change_krw integer not null default 5000,
  add column if not exists auto_sync_min_change_rate numeric(12,6) not null default 0.010000;

update public.pricing_policy
set auto_sync_force_full = coalesce(auto_sync_force_full, false),
    auto_sync_min_change_krw = coalesce(auto_sync_min_change_krw, 5000),
    auto_sync_min_change_rate = coalesce(auto_sync_min_change_rate, 0.010000)
where auto_sync_force_full is null
   or auto_sync_min_change_krw is null
   or auto_sync_min_change_rate is null;

alter table public.pricing_policy
  alter column auto_sync_force_full set default false,
  alter column auto_sync_min_change_krw set default 5000,
  alter column auto_sync_min_change_rate set default 0.010000;

do $$
begin
  alter table public.pricing_policy
    add constraint pricing_policy_auto_sync_min_change_krw_nonneg
    check (auto_sync_min_change_krw >= 0);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.pricing_policy
    add constraint pricing_policy_auto_sync_min_change_rate_range
    check (auto_sync_min_change_rate >= 0 and auto_sync_min_change_rate <= 1);
exception when duplicate_object then
  null;
end $$;
