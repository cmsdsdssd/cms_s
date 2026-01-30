-- 20260130100000_cms_0207_cn_silver_tick_config.sql
-- CN Silver tick + configurable coefficients (fx_markup, cs_correction_factor)
-- ADD-ONLY. public.cms_* only.

set search_path = public;

-- -----------------------------
-- (A) Extend market symbol enum
-- -----------------------------
-- Stored unit: KRW per gram (same as existing GOLD/SILVER ticks).
-- Meta will keep the raw ingredients for auditability.

alter type public.cms_e_market_symbol
  add value if not exists 'SILVER_CN_KRW_PER_G';

comment on type public.cms_e_market_symbol is
  'Market tick symbol enum. Includes GOLD/SILVER KRW per g and derived symbols such as SILVER_CN_KRW_PER_G.';

-- ---------------------------------------------
-- (B) Config table for CS computation (website)
-- ---------------------------------------------
-- This is intentionally simple: a singleton row keyed by config_key=''DEFAULT''.
-- n8n reads it on each run; the website can update it.
--
-- Definitions:
-- - fx_markup: multiplier applied to the raw CNY->KRW FX rate before pricing
-- - cs_correction_factor: extra correction multiplier applied after converting CN silver to KRW/g

create table if not exists public.cms_market_tick_config (
  config_key text primary key,
  fx_markup numeric(12,6) not null default 1.030000,
  cs_correction_factor numeric(12,6) not null default 1.000000,
  updated_at timestamptz not null default now()
);

comment on table public.cms_market_tick_config is
  'Singleton config for market tick computations (e.g., fx_markup, cs_correction_factor).';

comment on column public.cms_market_tick_config.fx_markup is
  'Markup multiplier applied to raw FX rate (CNY->KRW).';

comment on column public.cms_market_tick_config.cs_correction_factor is
  'Correction multiplier applied after FX conversion for CN silver (CS).';

-- Keep updated_at fresh
create or replace function public.cms_fn_touch_market_tick_config_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cms_trg_market_tick_config_touch on public.cms_market_tick_config;
create trigger cms_trg_market_tick_config_touch
before update on public.cms_market_tick_config
for each row
execute function public.cms_fn_touch_market_tick_config_updated_at();

-- Seed default row
insert into public.cms_market_tick_config (config_key, fx_markup, cs_correction_factor)
values ('DEFAULT', 1.030000, 1.000000)
on conflict (config_key) do nothing;

-- Grants (consistent with existing anon/internal pattern)
grant select, insert, update on public.cms_market_tick_config to anon, authenticated;
