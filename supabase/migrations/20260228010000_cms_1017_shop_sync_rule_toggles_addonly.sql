set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1017_shop_sync_rule_toggles_addonly
-- Add per-option toggles for sync rules 1~4.
-- -----------------------------------------------------------------------------

alter table if exists public.sales_channel_product
  add column if not exists sync_rule_material_enabled boolean not null default true,
  add column if not exists sync_rule_weight_enabled boolean not null default true,
  add column if not exists sync_rule_plating_enabled boolean not null default true,
  add column if not exists sync_rule_margin_rounding_enabled boolean not null default true;
