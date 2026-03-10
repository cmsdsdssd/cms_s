set search_path = public, pg_temp;

alter table public.pricing_policy
  add column if not exists option_sync_force_full boolean not null default false,
  add column if not exists option_sync_min_change_krw integer not null default 1000,
  add column if not exists option_sync_min_change_rate numeric(12,6) not null default 0.01;
