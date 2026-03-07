set search_path = public, pg_temp;

alter table public.pricing_policy
  alter column auto_sync_min_change_rate set default 0.020000;

update public.pricing_policy
set auto_sync_min_change_rate = 0.020000
where auto_sync_min_change_rate = 0.010000;
