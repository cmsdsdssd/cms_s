set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1207_option_category_sync_delta_100krw_step
-- Align channel_option_category_v2 sync delta storage with 100 KRW rule-driven
-- option deltas used by auto-price detail edit.
-- -----------------------------------------------------------------------------

alter table public.channel_option_category_v2
  drop constraint if exists channel_option_category_v2_sync_delta_step;

alter table public.channel_option_category_v2
  add constraint channel_option_category_v2_sync_delta_step
  check (mod(sync_delta_krw, 100) = 0);
