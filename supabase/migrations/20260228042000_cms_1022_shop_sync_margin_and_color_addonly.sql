set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1022_shop_sync_margin_and_color_addonly
-- R2 margin-band fields + R4 color matching field.
-- -----------------------------------------------------------------------------

alter table if exists public.sync_rule_r2_size_weight
  add column if not exists margin_min_krw numeric(14,2),
  add column if not exists margin_max_krw numeric(14,2);

do $$
begin
  alter table public.sync_rule_r2_size_weight
    add constraint sync_rule_r2_margin_range_valid
    check (
      (margin_min_krw is null and margin_max_krw is null)
      or
      (margin_min_krw is not null and margin_max_krw is not null and margin_min_krw <= margin_max_krw)
    );
exception when duplicate_object then
  null;
end $$;

alter table if exists public.sync_rule_r4_decoration
  add column if not exists match_color_code text;

do $$
begin
  alter table public.sync_rule_r4_decoration
    add constraint sync_rule_r4_color_code_not_blank
    check (match_color_code is null or btrim(match_color_code) <> '');
exception when duplicate_object then
  null;
end $$;

create index if not exists idx_sync_rule_r2_margin_lookup
  on public.sync_rule_r2_size_weight(rule_set_id, margin_min_krw, margin_max_krw)
  where is_active = true;

create index if not exists idx_sync_rule_r4_color_lookup
  on public.sync_rule_r4_decoration(rule_set_id, match_color_code)
  where match_color_code is not null and is_active = true;
