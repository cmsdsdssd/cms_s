set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1102_shop_sync_ruleset_guard_not_valid_addonly
-- Guard new writes: SYNC mode rows must always have sync_rule_set_id.
-- Use NOT VALID to avoid blocking rollout on legacy rows; this still enforces
-- the rule for newly inserted/updated rows.
-- -----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_channel_product_sync_requires_ruleset_chk'
      and conrelid = 'public.sales_channel_product'::regclass
  ) then
    alter table public.sales_channel_product
      add constraint sales_channel_product_sync_requires_ruleset_chk
      check (option_price_mode <> 'SYNC' or sync_rule_set_id is not null)
      not valid;
  end if;
end
$$;
