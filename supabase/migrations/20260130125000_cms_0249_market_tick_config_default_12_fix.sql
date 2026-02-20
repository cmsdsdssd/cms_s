set search_path = public, pg_temp;
-- ------------------------------------------------------------
-- cms_0249: set default correction factors to 1.2
--
-- Rationale:
-- - cs_correction_factor had legacy default 1.0, but business default is 1.2
-- - keep silver_kr_correction_factor default as 1.2 (added in cms_0247)
-- ------------------------------------------------------------

alter table public.cms_market_tick_config
  alter column cs_correction_factor set default 1.200000;
-- If DEFAULT row exists but still has legacy 1.0, bump to 1.2 (only when it matches legacy default)
update public.cms_market_tick_config
set cs_correction_factor = 1.200000,
    updated_at = now()
where config_key = 'DEFAULT'
  and cs_correction_factor = 1.000000;
