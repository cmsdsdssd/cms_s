set search_path = public, pg_temp;

create or replace function public.cms_fn_upsert_sales_channel_product_mappings_v1(
  p_rows jsonb
)
returns setof public.sales_channel_product
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_saved public.sales_channel_product%rowtype;
begin
  if coalesce(jsonb_typeof(p_rows), 'array') <> 'array' then
    raise exception 'p_rows must be a json array';
  end if;

  for v_row in
    select
      nullif(btrim(value ->> 'channel_id'), '')::uuid as channel_id,
      nullif(btrim(value ->> 'master_item_id'), '')::uuid as master_item_id,
      nullif(btrim(value ->> 'external_product_no'), '') as external_product_no,
      nullif(btrim(value ->> 'external_variant_code'), '') as external_variant_code,
      nullif(btrim(value ->> 'current_product_sync_profile'), '') as current_product_sync_profile,
      coalesce(nullif(btrim(value ->> 'mapping_source'), ''), 'MANUAL') as mapping_source,
      coalesce((value ->> 'is_active')::boolean, true) as is_active
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as x(value)
  loop
    if v_row.channel_id is null or v_row.master_item_id is null or v_row.external_product_no is null then
      raise exception 'channel_id, master_item_id, external_product_no are required';
    end if;

    insert into public.sales_channel_product (
      channel_id,
      master_item_id,
      external_product_no,
      external_variant_code,
      current_product_sync_profile,
      mapping_source,
      is_active
    ) values (
      v_row.channel_id,
      v_row.master_item_id,
      v_row.external_product_no,
      v_row.external_variant_code,
      case when upper(coalesce(v_row.current_product_sync_profile, 'GENERAL')) = 'MARKET_LINKED' then 'MARKET_LINKED' else 'GENERAL' end,
      case when upper(coalesce(v_row.mapping_source, 'MANUAL')) = 'CSV' then 'CSV' when upper(coalesce(v_row.mapping_source, 'MANUAL')) = 'AUTO' then 'AUTO' else 'MANUAL' end,
      v_row.is_active
    )
    on conflict (channel_id, external_product_no, external_variant_code)
    do update set
      master_item_id = excluded.master_item_id,
      current_product_sync_profile = excluded.current_product_sync_profile,
      mapping_source = excluded.mapping_source,
      is_active = excluded.is_active,
      updated_at = now()
    returning * into v_saved;

    return next v_saved;
  end loop;
  return;
end;
$$;

alter table public.sales_channel_product drop constraint if exists sales_channel_product_option_material_code_not_blank;
alter table public.sales_channel_product drop constraint if exists sales_channel_product_option_color_code_not_blank;
alter table public.sales_channel_product drop constraint if exists sales_channel_product_option_size_value_nonneg;
alter table public.sales_channel_product drop constraint if exists sales_channel_product_option_decoration_code_not_blank;
alter table public.sales_channel_product drop constraint if exists sales_channel_product_option_price_mode_check;
alter table public.sales_channel_product drop constraint if exists sales_channel_product_size_weight_delta_range;
alter table public.sales_channel_product drop constraint if exists sales_channel_product_option_price_delta_range;
alter table public.sales_channel_product drop constraint if exists sales_channel_product_material_multiplier_positive;
alter table public.sales_channel_product drop constraint if exists sales_channel_product_sync_requires_ruleset_chk;
alter table public.sales_channel_product drop constraint if exists sales_channel_product_size_price_override_krw_step;

alter table public.sales_channel_product drop column if exists sync_rule_set_id;
alter table public.sales_channel_product drop column if exists option_material_code;
alter table public.sales_channel_product drop column if exists option_color_code;
alter table public.sales_channel_product drop column if exists option_decoration_code;
alter table public.sales_channel_product drop column if exists option_size_value;
alter table public.sales_channel_product drop column if exists material_multiplier_override;
alter table public.sales_channel_product drop column if exists size_weight_delta_g;
alter table public.sales_channel_product drop column if exists size_price_override_enabled;
alter table public.sales_channel_product drop column if exists size_price_override_krw;
alter table public.sales_channel_product drop column if exists option_price_delta_krw;
alter table public.sales_channel_product drop column if exists option_price_mode;
alter table public.sales_channel_product drop column if exists option_manual_target_krw;
alter table public.sales_channel_product drop column if exists include_master_plating_labor;
alter table public.sales_channel_product drop column if exists sync_rule_material_enabled;
alter table public.sales_channel_product drop column if exists sync_rule_weight_enabled;
alter table public.sales_channel_product drop column if exists sync_rule_plating_enabled;
alter table public.sales_channel_product drop column if exists sync_rule_decoration_enabled;
alter table public.sales_channel_product drop column if exists sync_rule_margin_rounding_enabled;

drop view if exists public.v_price_composition_flat_v2 restrict;
drop table if exists public.channel_option_apply_log_v1 restrict;
drop table if exists public.channel_option_current_state_v1 restrict;
drop table if exists public.sync_rule_r4_decoration restrict;
drop table if exists public.sync_rule_r3_color_margin restrict;
drop table if exists public.sync_rule_r2_size_weight restrict;
drop table if exists public.sync_rule_r1_material_delta restrict;
