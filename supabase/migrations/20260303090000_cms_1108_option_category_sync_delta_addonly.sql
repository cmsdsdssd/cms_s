set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1108_option_category_sync_delta_addonly
-- Replace per-option apply mode UX with always-SYNC delta amount selection
-- -----------------------------------------------------------------------------

alter table public.channel_option_category_v2
  add column if not exists sync_delta_krw integer not null default 0;

do $$
begin
  alter table public.channel_option_category_v2
    add constraint channel_option_category_v2_sync_delta_range
    check (sync_delta_krw between -1000000 and 1000000);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_category_v2
    add constraint channel_option_category_v2_sync_delta_step
    check (mod(sync_delta_krw, 1000) = 0);
exception when duplicate_object then
  null;
end $$;
