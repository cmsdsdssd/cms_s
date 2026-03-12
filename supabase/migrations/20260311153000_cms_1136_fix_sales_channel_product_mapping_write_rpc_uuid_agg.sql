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
  v_pair record;
  v_source_base record;
  v_active_product_no_count integer;
  v_active_product_no text;
  v_missing_sync_rule_count integer;
  v_sync_rule_set_count integer;
  v_sync_rule_set_id uuid;
  v_base_profile text;
begin
  if coalesce(jsonb_typeof(p_rows), 'array') <> 'array' then
    raise exception 'p_rows must be a json array';
  end if;

  if coalesce(jsonb_array_length(coalesce(p_rows, '[]'::jsonb)), 0) = 0 then
    raise exception 'p_rows is required';
  end if;

  create temp table tmp_sales_channel_product_input (
    ordinality integer not null,
    channel_id uuid not null,
    master_item_id uuid not null,
    external_product_no text not null,
    external_variant_code text not null,
    sync_rule_set_id uuid,
    option_material_code text,
    option_color_code text,
    option_decoration_code text,
    option_size_value numeric(12,3),
    material_multiplier_override numeric(18,6),
    size_weight_delta_g numeric(18,6),
    size_price_override_enabled boolean not null,
    size_price_override_krw integer,
    option_price_delta_krw numeric(18,0),
    option_price_mode text not null,
    option_manual_target_krw numeric(14,2),
    include_master_plating_labor boolean not null,
    sync_rule_material_enabled boolean not null,
    sync_rule_weight_enabled boolean not null,
    sync_rule_plating_enabled boolean not null,
    sync_rule_decoration_enabled boolean not null,
    sync_rule_margin_rounding_enabled boolean not null,
    current_product_sync_profile text not null,
    mapping_source text not null,
    is_active boolean not null
  ) on commit drop;

  insert into tmp_sales_channel_product_input (
    ordinality,
    channel_id,
    master_item_id,
    external_product_no,
    external_variant_code,
    sync_rule_set_id,
    option_material_code,
    option_color_code,
    option_decoration_code,
    option_size_value,
    material_multiplier_override,
    size_weight_delta_g,
    size_price_override_enabled,
    size_price_override_krw,
    option_price_delta_krw,
    option_price_mode,
    option_manual_target_krw,
    include_master_plating_labor,
    sync_rule_material_enabled,
    sync_rule_weight_enabled,
    sync_rule_plating_enabled,
    sync_rule_decoration_enabled,
    sync_rule_margin_rounding_enabled,
    current_product_sync_profile,
    mapping_source,
    is_active
  )
  select distinct on (s.channel_id, s.external_product_no, s.external_variant_code)
    s.ordinality,
    s.channel_id,
    s.master_item_id,
    s.external_product_no,
    s.external_variant_code,
    s.sync_rule_set_id,
    s.option_material_code,
    s.option_color_code,
    s.option_decoration_code,
    s.option_size_value,
    s.material_multiplier_override,
    s.size_weight_delta_g,
    s.size_price_override_enabled,
    s.size_price_override_krw,
    s.option_price_delta_krw,
    s.option_price_mode,
    s.option_manual_target_krw,
    s.include_master_plating_labor,
    s.sync_rule_material_enabled,
    s.sync_rule_weight_enabled,
    s.sync_rule_plating_enabled,
    s.sync_rule_decoration_enabled,
    s.sync_rule_margin_rounding_enabled,
    s.current_product_sync_profile,
    s.mapping_source,
    s.is_active
  from (
    select
      e.ordinality::integer as ordinality,
      nullif(btrim(e.value ->> 'channel_id'), '')::uuid as channel_id,
      nullif(btrim(e.value ->> 'master_item_id'), '')::uuid as master_item_id,
      coalesce(nullif(btrim(e.value ->> 'external_product_no'), ''), '') as external_product_no,
      coalesce(nullif(btrim(e.value ->> 'external_variant_code'), ''), '') as external_variant_code,
      nullif(btrim(e.value ->> 'sync_rule_set_id'), '')::uuid as sync_rule_set_id,
      nullif(btrim(e.value ->> 'option_material_code'), '') as option_material_code,
      nullif(btrim(e.value ->> 'option_color_code'), '') as option_color_code,
      nullif(btrim(e.value ->> 'option_decoration_code'), '') as option_decoration_code,
      nullif(btrim(e.value ->> 'option_size_value'), '')::numeric(12,3) as option_size_value,
      nullif(btrim(e.value ->> 'material_multiplier_override'), '')::numeric(18,6) as material_multiplier_override,
      nullif(btrim(e.value ->> 'size_weight_delta_g'), '')::numeric(18,6) as size_weight_delta_g,
      coalesce((e.value ->> 'size_price_override_enabled')::boolean, false) as size_price_override_enabled,
      nullif(btrim(e.value ->> 'size_price_override_krw'), '')::integer as size_price_override_krw,
      nullif(btrim(e.value ->> 'option_price_delta_krw'), '')::numeric(18,0) as option_price_delta_krw,
      case when upper(coalesce(nullif(btrim(e.value ->> 'option_price_mode'), ''), 'SYNC')) = 'MANUAL' then 'MANUAL' else 'SYNC' end as option_price_mode,
      nullif(btrim(e.value ->> 'option_manual_target_krw'), '')::numeric(14,2) as option_manual_target_krw,
      coalesce((e.value ->> 'include_master_plating_labor')::boolean, true) as include_master_plating_labor,
      coalesce((e.value ->> 'sync_rule_material_enabled')::boolean, true) as sync_rule_material_enabled,
      coalesce((e.value ->> 'sync_rule_weight_enabled')::boolean, true) as sync_rule_weight_enabled,
      coalesce((e.value ->> 'sync_rule_plating_enabled')::boolean, true) as sync_rule_plating_enabled,
      coalesce((e.value ->> 'sync_rule_decoration_enabled')::boolean, true) as sync_rule_decoration_enabled,
      coalesce((e.value ->> 'sync_rule_margin_rounding_enabled')::boolean, true) as sync_rule_margin_rounding_enabled,
      case when upper(coalesce(nullif(btrim(e.value ->> 'current_product_sync_profile'), ''), 'GENERAL')) = 'MARKET_LINKED' then 'MARKET_LINKED' else 'GENERAL' end as current_product_sync_profile,
      case
        when upper(coalesce(nullif(btrim(e.value ->> 'mapping_source'), ''), 'AUTO')) = 'CSV' then 'CSV'
        when upper(coalesce(nullif(btrim(e.value ->> 'mapping_source'), ''), 'AUTO')) = 'MANUAL' then 'MANUAL'
        else 'AUTO'
      end as mapping_source,
      coalesce((e.value ->> 'is_active')::boolean, true) as is_active
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) with ordinality as e(value, ordinality)
  ) s
  order by s.channel_id, s.external_product_no, s.external_variant_code, s.ordinality desc;

  if exists (select 1 from tmp_sales_channel_product_input where external_product_no = '') then
    raise exception 'external_product_no is required';
  end if;

  if exists (select 1 from tmp_sales_channel_product_input where is_active = false) then
    raise exception 'active mappings only are allowed';
  end if;

  for v_pair in
    select t.channel_id, t.master_item_id
    from tmp_sales_channel_product_input t
    group by t.channel_id, t.master_item_id
    order by t.channel_id::text, t.master_item_id::text
  loop
    perform pg_advisory_xact_lock(hashtext('sales_channel_product:' || v_pair.channel_id::text || ':' || v_pair.master_item_id::text));

    select count(distinct src.external_product_no), max(src.external_product_no)
      into v_active_product_no_count, v_active_product_no
    from (
      select scp.external_product_no
      from public.sales_channel_product scp
      where scp.channel_id = v_pair.channel_id
        and scp.master_item_id = v_pair.master_item_id
        and scp.is_active = true
      union all
      select t.external_product_no
      from tmp_sales_channel_product_input t
      where t.channel_id = v_pair.channel_id
        and t.master_item_id = v_pair.master_item_id
        and t.is_active = true
    ) src
    where btrim(coalesce(src.external_product_no, '')) <> '';

    if v_active_product_no_count <> 1 then
      raise exception using
        message = 'same master_item_id must have exactly one active external_product_no',
        errcode = '23514';
    end if;

    select count(*)
      into v_missing_sync_rule_count
    from (
      select scp.option_price_mode, scp.sync_rule_set_id
      from public.sales_channel_product scp
      where scp.channel_id = v_pair.channel_id
        and scp.master_item_id = v_pair.master_item_id
        and scp.is_active = true
      union all
      select t.option_price_mode, t.sync_rule_set_id
      from tmp_sales_channel_product_input t
      where t.channel_id = v_pair.channel_id
        and t.master_item_id = v_pair.master_item_id
        and t.is_active = true
    ) src
    where upper(coalesce(src.option_price_mode, 'SYNC')) = 'SYNC'
      and src.sync_rule_set_id is null;

    if v_missing_sync_rule_count > 0 then
      raise exception using
        message = 'SYNC mappings require sync_rule_set_id',
        errcode = '23514';
    end if;

    select count(distinct src.sync_rule_set_id)
      into v_sync_rule_set_count
    from (
      select scp.sync_rule_set_id, scp.option_price_mode
      from public.sales_channel_product scp
      where scp.channel_id = v_pair.channel_id
        and scp.master_item_id = v_pair.master_item_id
        and scp.is_active = true
      union all
      select t.sync_rule_set_id, t.option_price_mode
      from tmp_sales_channel_product_input t
      where t.channel_id = v_pair.channel_id
        and t.master_item_id = v_pair.master_item_id
        and t.is_active = true
    ) src
    where upper(coalesce(src.option_price_mode, 'SYNC')) = 'SYNC'
      and src.sync_rule_set_id is not null;

    if v_sync_rule_set_count > 1 then
      raise exception using
        message = 'same master_item_id must use exactly one active sync_rule_set_id',
        errcode = '23514';
    end if;

    v_sync_rule_set_id := null;
    if v_sync_rule_set_count = 1 then
      select src.sync_rule_set_id
        into v_sync_rule_set_id
      from (
        select scp.sync_rule_set_id, scp.option_price_mode
        from public.sales_channel_product scp
        where scp.channel_id = v_pair.channel_id
          and scp.master_item_id = v_pair.master_item_id
          and scp.is_active = true
        union all
        select t.sync_rule_set_id, t.option_price_mode
        from tmp_sales_channel_product_input t
        where t.channel_id = v_pair.channel_id
          and t.master_item_id = v_pair.master_item_id
          and t.is_active = true
      ) src
      where upper(coalesce(src.option_price_mode, 'SYNC')) = 'SYNC'
        and src.sync_rule_set_id is not null
      limit 1;
    end if;

    select coalesce(
      (
        select t.current_product_sync_profile
        from tmp_sales_channel_product_input t
        where t.channel_id = v_pair.channel_id
          and t.master_item_id = v_pair.master_item_id
          and t.current_product_sync_profile in ('GENERAL', 'MARKET_LINKED')
        order by t.ordinality desc
        limit 1
      ),
      (
        select scp.current_product_sync_profile
        from public.sales_channel_product scp
        where scp.channel_id = v_pair.channel_id
          and scp.master_item_id = v_pair.master_item_id
          and scp.is_active = true
          and scp.current_product_sync_profile in ('GENERAL', 'MARKET_LINKED')
        order by scp.updated_at desc, scp.created_at desc, scp.channel_product_id desc
        limit 1
      ),
      'GENERAL'
    )
      into v_base_profile;

    select t.*
      into v_source_base
    from tmp_sales_channel_product_input t
    where t.channel_id = v_pair.channel_id
      and t.master_item_id = v_pair.master_item_id
      and t.external_variant_code = ''
    order by t.ordinality desc
    limit 1;

    if not exists (
      select 1
      from public.sales_channel_product scp
      where scp.channel_id = v_pair.channel_id
        and scp.master_item_id = v_pair.master_item_id
        and scp.is_active = true
        and scp.external_variant_code = ''
    ) then
      insert into public.sales_channel_product (
        channel_id,
        master_item_id,
        external_product_no,
        external_variant_code,
        sync_rule_set_id,
        option_material_code,
        option_color_code,
        option_decoration_code,
        option_size_value,
        material_multiplier_override,
        size_weight_delta_g,
        size_price_override_enabled,
        size_price_override_krw,
        option_price_delta_krw,
        option_price_mode,
        option_manual_target_krw,
        include_master_plating_labor,
        sync_rule_material_enabled,
        sync_rule_weight_enabled,
        sync_rule_plating_enabled,
        sync_rule_decoration_enabled,
        sync_rule_margin_rounding_enabled,
        current_product_sync_profile,
        mapping_source,
        is_active
      )
      values (
        v_pair.channel_id,
        v_pair.master_item_id,
        v_active_product_no,
        '',
        case when v_sync_rule_set_count = 1 then v_sync_rule_set_id else null end,
        null,
        null,
        null,
        null,
        null,
        null,
        false,
        null,
        null,
        case when v_sync_rule_set_count = 1 then 'SYNC' else 'MANUAL' end,
        null,
        true,
        true,
        true,
        true,
        true,
        true,
        v_base_profile,
        'AUTO',
        true
      )
      on conflict (channel_id, external_product_no, external_variant_code)
      do update set
        master_item_id = excluded.master_item_id,
        sync_rule_set_id = excluded.sync_rule_set_id,
        option_material_code = excluded.option_material_code,
        option_color_code = excluded.option_color_code,
        option_decoration_code = excluded.option_decoration_code,
        option_size_value = excluded.option_size_value,
        material_multiplier_override = excluded.material_multiplier_override,
        size_weight_delta_g = excluded.size_weight_delta_g,
        size_price_override_enabled = excluded.size_price_override_enabled,
        size_price_override_krw = excluded.size_price_override_krw,
        option_price_delta_krw = excluded.option_price_delta_krw,
        option_price_mode = excluded.option_price_mode,
        option_manual_target_krw = excluded.option_manual_target_krw,
        include_master_plating_labor = excluded.include_master_plating_labor,
        sync_rule_material_enabled = excluded.sync_rule_material_enabled,
        sync_rule_weight_enabled = excluded.sync_rule_weight_enabled,
        sync_rule_plating_enabled = excluded.sync_rule_plating_enabled,
        sync_rule_decoration_enabled = excluded.sync_rule_decoration_enabled,
        sync_rule_margin_rounding_enabled = excluded.sync_rule_margin_rounding_enabled,
        current_product_sync_profile = excluded.current_product_sync_profile,
        mapping_source = excluded.mapping_source,
        is_active = true,
        updated_at = now();
    elsif v_source_base is not null then
      insert into public.sales_channel_product (
        channel_id,
        master_item_id,
        external_product_no,
        external_variant_code,
        sync_rule_set_id,
        option_material_code,
        option_color_code,
        option_decoration_code,
        option_size_value,
        material_multiplier_override,
        size_weight_delta_g,
        size_price_override_enabled,
        size_price_override_krw,
        option_price_delta_krw,
        option_price_mode,
        option_manual_target_krw,
        include_master_plating_labor,
        sync_rule_material_enabled,
        sync_rule_weight_enabled,
        sync_rule_plating_enabled,
        sync_rule_decoration_enabled,
        sync_rule_margin_rounding_enabled,
        current_product_sync_profile,
        mapping_source,
        is_active
      )
      values (
        v_source_base.channel_id,
        v_source_base.master_item_id,
        v_active_product_no,
        '',
        case when v_source_base.option_price_mode = 'SYNC' then coalesce(v_source_base.sync_rule_set_id, v_sync_rule_set_id) else null end,
        v_source_base.option_material_code,
        v_source_base.option_color_code,
        v_source_base.option_decoration_code,
        v_source_base.option_size_value,
        v_source_base.material_multiplier_override,
        v_source_base.size_weight_delta_g,
        v_source_base.size_price_override_enabled,
        v_source_base.size_price_override_krw,
        v_source_base.option_price_delta_krw,
        v_source_base.option_price_mode,
        v_source_base.option_manual_target_krw,
        v_source_base.include_master_plating_labor,
        v_source_base.sync_rule_material_enabled,
        v_source_base.sync_rule_weight_enabled,
        v_source_base.sync_rule_plating_enabled,
        v_source_base.sync_rule_decoration_enabled,
        v_source_base.sync_rule_margin_rounding_enabled,
        coalesce(v_source_base.current_product_sync_profile, v_base_profile),
        v_source_base.mapping_source,
        true
      )
      on conflict (channel_id, external_product_no, external_variant_code)
      do update set
        master_item_id = excluded.master_item_id,
        sync_rule_set_id = excluded.sync_rule_set_id,
        option_material_code = excluded.option_material_code,
        option_color_code = excluded.option_color_code,
        option_decoration_code = excluded.option_decoration_code,
        option_size_value = excluded.option_size_value,
        material_multiplier_override = excluded.material_multiplier_override,
        size_weight_delta_g = excluded.size_weight_delta_g,
        size_price_override_enabled = excluded.size_price_override_enabled,
        size_price_override_krw = excluded.size_price_override_krw,
        option_price_delta_krw = excluded.option_price_delta_krw,
        option_price_mode = excluded.option_price_mode,
        option_manual_target_krw = excluded.option_manual_target_krw,
        include_master_plating_labor = excluded.include_master_plating_labor,
        sync_rule_material_enabled = excluded.sync_rule_material_enabled,
        sync_rule_weight_enabled = excluded.sync_rule_weight_enabled,
        sync_rule_plating_enabled = excluded.sync_rule_plating_enabled,
        sync_rule_decoration_enabled = excluded.sync_rule_decoration_enabled,
        sync_rule_margin_rounding_enabled = excluded.sync_rule_margin_rounding_enabled,
        current_product_sync_profile = excluded.current_product_sync_profile,
        mapping_source = excluded.mapping_source,
        is_active = true,
        updated_at = now();
    end if;
  end loop;

  insert into public.sales_channel_product (
    channel_id,
    master_item_id,
    external_product_no,
    external_variant_code,
    sync_rule_set_id,
    option_material_code,
    option_color_code,
    option_decoration_code,
    option_size_value,
    material_multiplier_override,
    size_weight_delta_g,
    size_price_override_enabled,
    size_price_override_krw,
    option_price_delta_krw,
    option_price_mode,
    option_manual_target_krw,
    include_master_plating_labor,
    sync_rule_material_enabled,
    sync_rule_weight_enabled,
    sync_rule_plating_enabled,
    sync_rule_decoration_enabled,
    sync_rule_margin_rounding_enabled,
    current_product_sync_profile,
    mapping_source,
    is_active
  )
  select
    t.channel_id,
    t.master_item_id,
    t.external_product_no,
    t.external_variant_code,
    t.sync_rule_set_id,
    t.option_material_code,
    t.option_color_code,
    t.option_decoration_code,
    t.option_size_value,
    t.material_multiplier_override,
    t.size_weight_delta_g,
    t.size_price_override_enabled,
    t.size_price_override_krw,
    t.option_price_delta_krw,
    t.option_price_mode,
    t.option_manual_target_krw,
    t.include_master_plating_labor,
    t.sync_rule_material_enabled,
    t.sync_rule_weight_enabled,
    t.sync_rule_plating_enabled,
    t.sync_rule_decoration_enabled,
    t.sync_rule_margin_rounding_enabled,
    t.current_product_sync_profile,
    t.mapping_source,
    true
  from tmp_sales_channel_product_input t
  order by t.ordinality
  on conflict (channel_id, external_product_no, external_variant_code)
  do update set
    master_item_id = excluded.master_item_id,
    sync_rule_set_id = excluded.sync_rule_set_id,
    option_material_code = excluded.option_material_code,
    option_color_code = excluded.option_color_code,
    option_decoration_code = excluded.option_decoration_code,
    option_size_value = excluded.option_size_value,
    material_multiplier_override = excluded.material_multiplier_override,
    size_weight_delta_g = excluded.size_weight_delta_g,
    size_price_override_enabled = excluded.size_price_override_enabled,
    size_price_override_krw = excluded.size_price_override_krw,
    option_price_delta_krw = excluded.option_price_delta_krw,
    option_price_mode = excluded.option_price_mode,
    option_manual_target_krw = excluded.option_manual_target_krw,
    include_master_plating_labor = excluded.include_master_plating_labor,
    sync_rule_material_enabled = excluded.sync_rule_material_enabled,
    sync_rule_weight_enabled = excluded.sync_rule_weight_enabled,
    sync_rule_plating_enabled = excluded.sync_rule_plating_enabled,
    sync_rule_decoration_enabled = excluded.sync_rule_decoration_enabled,
    sync_rule_margin_rounding_enabled = excluded.sync_rule_margin_rounding_enabled,
    current_product_sync_profile = excluded.current_product_sync_profile,
    mapping_source = excluded.mapping_source,
    is_active = true,
    updated_at = now();

  return query
  select scp.*
  from tmp_sales_channel_product_input t
  join public.sales_channel_product scp
    on scp.channel_id = t.channel_id
   and scp.external_product_no = t.external_product_no
   and scp.external_variant_code = t.external_variant_code
  order by t.ordinality;
end;
$$;

revoke all on function public.cms_fn_upsert_sales_channel_product_mappings_v1(jsonb) from public;
grant execute on function public.cms_fn_upsert_sales_channel_product_mappings_v1(jsonb) to service_role;
