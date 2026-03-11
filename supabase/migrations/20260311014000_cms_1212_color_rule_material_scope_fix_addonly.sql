set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1212_color_rule_material_scope_fix_addonly
-- COLOR_PLATING rules are material-scoped in the app and recompute engine.
-- Align DB constraints/indexes with that contract.
-- -----------------------------------------------------------------------------

alter table public.channel_option_labor_rule_v1
  drop constraint if exists channel_option_labor_rule_v1_color_shape;

do $$
begin
  alter table public.channel_option_labor_rule_v1
    add constraint channel_option_labor_rule_v1_color_shape_v2
    check (
      category_key <> 'COLOR_PLATING'
      or (
        plating_enabled is not null
        and scope_material_code is not null
        and additional_weight_g is null
        and additional_weight_min_g is null
        and additional_weight_max_g is null
        and decoration_master_id is null
        and decoration_model_name is null
        and base_labor_cost_krw = 0
      )
    );
exception when duplicate_object then
  null;
end $$;

drop index if exists public.uq_channel_option_labor_rule_v1_color;

create unique index if not exists uq_channel_option_labor_rule_v1_color_v2
  on public.channel_option_labor_rule_v1(
    channel_id,
    master_item_id,
    external_product_no,
    category_key,
    scope_material_code,
    plating_enabled,
    coalesce(color_code, '')
  )
  where category_key = 'COLOR_PLATING';
