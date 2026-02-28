set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1024_shop_rule_100krw_step_addonly
-- Enforce 100-KRW step for sync-rule amounts and rounding units.
-- -----------------------------------------------------------------------------

do $$
begin
  alter table public.sync_rule_r1_material_delta
    add constraint sync_rule_r1_rounding_unit_100_step
    check (mod(rounding_unit, 100) = 0);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sync_rule_r2_size_weight
    add constraint sync_rule_r2_delta_100_step
    check (mod(delta_krw::numeric, 100) = 0);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sync_rule_r2_size_weight
    add constraint sync_rule_r2_rounding_unit_100_step
    check (mod(rounding_unit, 100) = 0);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sync_rule_r2_size_weight
    add constraint sync_rule_r2_margin_min_100_step
    check (margin_min_krw is null or mod(margin_min_krw::numeric, 100) = 0);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sync_rule_r2_size_weight
    add constraint sync_rule_r2_margin_max_100_step
    check (margin_max_krw is null or mod(margin_max_krw::numeric, 100) = 0);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sync_rule_r3_color_margin
    add constraint sync_rule_r3_delta_100_step
    check (mod(delta_krw::numeric, 100) = 0);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sync_rule_r3_color_margin
    add constraint sync_rule_r3_rounding_unit_100_step
    check (mod(rounding_unit, 100) = 0);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sync_rule_r3_color_margin
    add constraint sync_rule_r3_margin_min_100_step
    check (mod(margin_min_krw::numeric, 100) = 0);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sync_rule_r3_color_margin
    add constraint sync_rule_r3_margin_max_100_step
    check (mod(margin_max_krw::numeric, 100) = 0);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sync_rule_r4_decoration
    add constraint sync_rule_r4_delta_100_step
    check (mod(delta_krw::numeric, 100) = 0);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.sync_rule_r4_decoration
    add constraint sync_rule_r4_rounding_unit_100_step
    check (mod(rounding_unit, 100) = 0);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_base_price_adjustment_log
    add constraint channel_base_price_adjustment_log_delta_100_step
    check (mod(delta_krw::numeric, 100) = 0);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_labor_price_adjustment_log
    add constraint channel_labor_price_adjustment_log_delta_100_step
    check (mod(delta_krw::numeric, 100) = 0);
exception when duplicate_object then
  null;
end $$;
