set search_path = public, pg_temp;

alter table public.channel_option_labor_rule_v1
  add column if not exists additional_weight_min_g numeric(6,2),
  add column if not exists additional_weight_max_g numeric(6,2);

update public.channel_option_labor_rule_v1
set
  additional_weight_min_g = coalesce(additional_weight_min_g, additional_weight_g),
  additional_weight_max_g = coalesce(additional_weight_max_g, additional_weight_g)
where category_key = 'SIZE';

drop index if exists public.uq_channel_option_labor_rule_v1_size;
drop index if exists public.uq_channel_option_labor_rule_v1_other;

alter table public.channel_option_labor_rule_v1
  drop constraint if exists channel_option_labor_rule_v1_weight_range,
  drop constraint if exists channel_option_labor_rule_v1_size_shape,
  drop constraint if exists channel_option_labor_rule_v1_other_shape;

do $$
begin
  alter table public.channel_option_labor_rule_v1
    add constraint channel_option_labor_rule_v1_weight_range_v2
    check (
      (additional_weight_g is null or (additional_weight_g >= 0.01 and additional_weight_g <= 100.00 and additional_weight_g = round(additional_weight_g::numeric, 2)))
      and (additional_weight_min_g is null or (additional_weight_min_g >= 0.01 and additional_weight_min_g <= 100.00 and additional_weight_min_g = round(additional_weight_min_g::numeric, 2)))
      and (additional_weight_max_g is null or (additional_weight_max_g >= 0.01 and additional_weight_max_g <= 100.00 and additional_weight_max_g = round(additional_weight_max_g::numeric, 2)))
    );
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_labor_rule_v1
    add constraint channel_option_labor_rule_v1_size_shape_v2
    check (
      category_key <> 'SIZE'
      or (
        scope_material_code is not null
        and coalesce(additional_weight_min_g, additional_weight_g) is not null
        and coalesce(additional_weight_max_g, additional_weight_g) is not null
        and coalesce(additional_weight_min_g, additional_weight_g) <= coalesce(additional_weight_max_g, additional_weight_g)
        and plating_enabled is null
        and color_code is null
        and decoration_master_id is null
        and decoration_model_name is null
        and base_labor_cost_krw = 0
      )
    );
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_labor_rule_v1
    add constraint channel_option_labor_rule_v1_other_shape_v2
    check (
      category_key <> 'OTHER'
      or (
        scope_material_code is null
        and additional_weight_g is null
        and additional_weight_min_g is null
        and additional_weight_max_g is null
        and plating_enabled is null
        and color_code is null
        and decoration_master_id is null
        and decoration_model_name is null
        and base_labor_cost_krw = 0
        and note is not null
        and btrim(note) <> ''
      )
    );
exception when duplicate_object then
  null;
end $$;

create unique index if not exists uq_channel_option_labor_rule_v1_size_v2
  on public.channel_option_labor_rule_v1(
    channel_id,
    master_item_id,
    external_product_no,
    category_key,
    scope_material_code,
    coalesce(additional_weight_min_g, additional_weight_g),
    coalesce(additional_weight_max_g, additional_weight_g)
  )
  where category_key = 'SIZE';

create unique index if not exists uq_channel_option_labor_rule_v1_other_v2
  on public.channel_option_labor_rule_v1(
    channel_id,
    master_item_id,
    external_product_no,
    category_key,
    lower(coalesce(note, ''))
  )
  where category_key = 'OTHER';
