set search_path = public, pg_temp;

alter table public.channel_option_labor_rule_v1
  drop constraint if exists channel_option_labor_rule_v1_size_shape;

alter table public.channel_option_labor_rule_v1
  add constraint channel_option_labor_rule_v1_size_shape_v2
  check (
    category_key <> 'SIZE'
    or (
      scope_material_code is not null
      and (
        additional_weight_g is not null
        or (
          additional_weight_g is null
          and additional_weight_min_g is not null
          and additional_weight_max_g is not null
          and additional_weight_min_g >= 0
          and additional_weight_max_g <= 100
          and additional_weight_min_g <= additional_weight_max_g
        )
      )
      and plating_enabled is null
      and color_code is null
      and decoration_master_id is null
      and decoration_model_name is null
      and base_labor_cost_krw = 0
    )
  );
