set search_path = public, pg_temp;

create or replace function public.cms_fn_upsert_channel_option_central_registries_v1(
  p_rows jsonb,
  p_changed_by text default null,
  p_change_reason text default null
)
returns table (
  registry_kind text,
  registry_key text,
  affected_products_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_material_existing public.channel_option_material_registry_v1%rowtype;
  v_material_saved public.channel_option_material_registry_v1%rowtype;
  v_bucket_existing public.channel_option_color_bucket_v1%rowtype;
  v_bucket_saved public.channel_option_color_bucket_v1%rowtype;
  v_addon_existing public.channel_option_addon_master_v1%rowtype;
  v_addon_saved public.channel_option_addon_master_v1%rowtype;
  v_notice_existing public.channel_option_notice_code_v1%rowtype;
  v_notice_saved public.channel_option_notice_code_v1%rowtype;
  v_reason_existing public.channel_option_other_reason_code_v1%rowtype;
  v_reason_saved public.channel_option_other_reason_code_v1%rowtype;
  v_action text;
  v_affected_count integer;
begin
  if coalesce(jsonb_typeof(p_rows), 'array') <> 'array' then
    raise exception 'p_rows must be a json array';
  end if;

  if coalesce(jsonb_array_length(coalesce(p_rows, '[]'::jsonb)), 0) = 0 then
    raise exception 'p_rows is required';
  end if;

  create temp table tmp_central_registry_input (
    ordinality integer not null,
    registry_kind text not null,
    channel_id uuid not null,
    material_code text,
    material_label text,
    material_type text,
    tick_source text,
    factor_ref text,
    bucket_code text,
    bucket_label text,
    base_cost_krw integer,
    sell_delta_krw integer,
    addon_code text,
    addon_name text,
    base_amount_krw integer,
    extra_delta_krw integer,
    notice_code text,
    notice_name text,
    reason_code text,
    reason_name text,
    display_text text,
    description text,
    sort_order integer not null,
    is_active boolean not null
  ) on commit drop;

  insert into tmp_central_registry_input (
    ordinality,
    registry_kind,
    channel_id,
    material_code,
    material_label,
    material_type,
    tick_source,
    factor_ref,
    bucket_code,
    bucket_label,
    base_cost_krw,
    sell_delta_krw,
    addon_code,
    addon_name,
    base_amount_krw,
    extra_delta_krw,
    notice_code,
    notice_name,
    reason_code,
    reason_name,
    display_text,
    description,
    sort_order,
    is_active
  )
  select
    e.ordinality::integer,
    upper(nullif(btrim(e.value ->> 'registry_kind'), '')),
    nullif(btrim(e.value ->> 'channel_id'), '')::uuid,
    nullif(btrim(e.value ->> 'material_code'), ''),
    nullif(btrim(e.value ->> 'material_label'), ''),
    nullif(btrim(e.value ->> 'material_type'), ''),
    nullif(btrim(e.value ->> 'tick_source'), ''),
    nullif(btrim(e.value ->> 'factor_ref'), ''),
    nullif(btrim(e.value ->> 'bucket_code'), ''),
    nullif(btrim(e.value ->> 'bucket_label'), ''),
    nullif(btrim(e.value ->> 'base_cost_krw'), '')::integer,
    nullif(btrim(e.value ->> 'sell_delta_krw'), '')::integer,
    nullif(btrim(e.value ->> 'addon_code'), ''),
    nullif(btrim(e.value ->> 'addon_name'), ''),
    nullif(btrim(e.value ->> 'base_amount_krw'), '')::integer,
    nullif(btrim(e.value ->> 'extra_delta_krw'), '')::integer,
    nullif(btrim(e.value ->> 'notice_code'), ''),
    nullif(btrim(e.value ->> 'notice_name'), ''),
    nullif(btrim(e.value ->> 'reason_code'), ''),
    nullif(btrim(e.value ->> 'reason_name'), ''),
    nullif(btrim(e.value ->> 'display_text'), ''),
    coalesce(nullif(btrim(e.value ->> 'description'), ''), ''),
    coalesce(nullif(btrim(e.value ->> 'sort_order'), '')::integer, 0),
    coalesce((e.value ->> 'is_active')::boolean, true)
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) with ordinality as e(value, ordinality);

  for v_row in
    select *
    from tmp_central_registry_input
    order by ordinality asc
  loop
    v_affected_count := 0;

    if v_row.registry_kind = 'MATERIAL' then
      select * into v_material_existing
      from public.channel_option_material_registry_v1
      where channel_id = v_row.channel_id
        and material_code = v_row.material_code
      limit 1;

      insert into public.channel_option_material_registry_v1 (
        channel_id, material_code, material_label, material_type, tick_source, factor_ref, sort_order, is_active
      ) values (
        v_row.channel_id, v_row.material_code, v_row.material_label, v_row.material_type, v_row.tick_source, v_row.factor_ref, v_row.sort_order, v_row.is_active
      )
      on conflict (channel_id, material_code)
      do update set
        material_label = excluded.material_label,
        material_type = excluded.material_type,
        tick_source = excluded.tick_source,
        factor_ref = excluded.factor_ref,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active,
        updated_at = now()
      returning * into v_material_saved;

      v_action := case when v_material_existing.material_registry_id is null then 'INSERT' when v_material_saved.is_active = false then 'SOFT_DELETE' else 'UPDATE' end;

      select count(distinct external_product_no)::integer into v_affected_count
      from public.channel_product_option_entry_mapping_v1
      where channel_id = v_row.channel_id
        and material_registry_code = v_material_saved.material_code
        and is_active = true;

      insert into public.channel_option_registry_change_audit_v1 (
        channel_id, registry_kind, registry_key, action, changed_by, change_reason, before_payload, after_payload, affected_products_count
      ) values (
        v_material_saved.channel_id, 'MATERIAL', v_material_saved.material_code, v_action,
        nullif(btrim(coalesce(p_changed_by, '')), ''),
        nullif(btrim(coalesce(p_change_reason, '')), ''),
        case when v_material_existing.material_registry_id is null then null else to_jsonb(v_material_existing) end,
        to_jsonb(v_material_saved),
        coalesce(v_affected_count, 0)
      );

      insert into public.channel_product_option_recompute_queue_v1 (channel_id, external_product_no, enqueue_reason, source_kind, source_key)
      select distinct channel_id, external_product_no,
        coalesce(nullif(btrim(coalesce(p_change_reason, '')), ''), 'CENTRAL_REGISTRY_CHANGED'),
        'MATERIAL',
        v_material_saved.material_code
      from public.channel_product_option_entry_mapping_v1
      where channel_id = v_row.channel_id
        and material_registry_code = v_material_saved.material_code
        and is_active = true;

      registry_kind := 'MATERIAL';
      registry_key := v_material_saved.material_code;
      affected_products_count := coalesce(v_affected_count, 0);
      return next;
    elsif v_row.registry_kind = 'COLOR_BUCKET' then
      select * into v_bucket_existing
      from public.channel_option_color_bucket_v1
      where channel_id = v_row.channel_id
        and bucket_code = v_row.bucket_code
      limit 1;

      insert into public.channel_option_color_bucket_v1 (
        channel_id, bucket_code, bucket_label, base_cost_krw, sell_delta_krw, sort_order, is_active
      ) values (
        v_row.channel_id, v_row.bucket_code, v_row.bucket_label, v_row.base_cost_krw, v_row.sell_delta_krw, v_row.sort_order, v_row.is_active
      )
      on conflict (channel_id, bucket_code)
      do update set
        bucket_label = excluded.bucket_label,
        base_cost_krw = excluded.base_cost_krw,
        sell_delta_krw = excluded.sell_delta_krw,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active,
        updated_at = now()
      returning * into v_bucket_saved;

      v_action := case when v_bucket_existing.color_bucket_id is null then 'INSERT' when v_bucket_saved.is_active = false then 'SOFT_DELETE' else 'UPDATE' end;

      select count(distinct external_product_no)::integer into v_affected_count
      from public.channel_product_option_entry_mapping_v1
      where channel_id = v_row.channel_id
        and color_bucket_id = v_bucket_saved.color_bucket_id
        and is_active = true;

      insert into public.channel_option_registry_change_audit_v1 (
        channel_id, registry_kind, registry_key, action, changed_by, change_reason, before_payload, after_payload, affected_products_count
      ) values (
        v_bucket_saved.channel_id, 'COLOR_BUCKET', v_bucket_saved.bucket_code, v_action,
        nullif(btrim(coalesce(p_changed_by, '')), ''),
        nullif(btrim(coalesce(p_change_reason, '')), ''),
        case when v_bucket_existing.color_bucket_id is null then null else to_jsonb(v_bucket_existing) end,
        to_jsonb(v_bucket_saved),
        coalesce(v_affected_count, 0)
      );

      insert into public.channel_product_option_recompute_queue_v1 (channel_id, external_product_no, enqueue_reason, source_kind, source_key)
      select distinct channel_id, external_product_no,
        coalesce(nullif(btrim(coalesce(p_change_reason, '')), ''), 'CENTRAL_REGISTRY_CHANGED'),
        'COLOR_BUCKET',
        v_bucket_saved.bucket_code
      from public.channel_product_option_entry_mapping_v1
      where channel_id = v_row.channel_id
        and color_bucket_id = v_bucket_saved.color_bucket_id
        and is_active = true;

      registry_kind := 'COLOR_BUCKET';
      registry_key := v_bucket_saved.bucket_code;
      affected_products_count := coalesce(v_affected_count, 0);
      return next;
    elsif v_row.registry_kind = 'ADDON' then
      select * into v_addon_existing
      from public.channel_option_addon_master_v1
      where channel_id = v_row.channel_id
        and addon_code = v_row.addon_code
      limit 1;

      insert into public.channel_option_addon_master_v1 (
        channel_id, addon_code, addon_name, base_amount_krw, extra_delta_krw, sort_order, is_active
      ) values (
        v_row.channel_id, v_row.addon_code, v_row.addon_name, v_row.base_amount_krw, v_row.extra_delta_krw, v_row.sort_order, v_row.is_active
      )
      on conflict (channel_id, addon_code)
      do update set
        addon_name = excluded.addon_name,
        base_amount_krw = excluded.base_amount_krw,
        extra_delta_krw = excluded.extra_delta_krw,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active,
        updated_at = now()
      returning * into v_addon_saved;

      v_action := case when v_addon_existing.addon_master_id is null then 'INSERT' when v_addon_saved.is_active = false then 'SOFT_DELETE' else 'UPDATE' end;

      select count(distinct external_product_no)::integer into v_affected_count
      from public.channel_product_option_entry_mapping_v1
      where channel_id = v_row.channel_id
        and addon_master_id = v_addon_saved.addon_master_id
        and is_active = true;

      insert into public.channel_option_registry_change_audit_v1 (
        channel_id, registry_kind, registry_key, action, changed_by, change_reason, before_payload, after_payload, affected_products_count
      ) values (
        v_addon_saved.channel_id, 'ADDON', v_addon_saved.addon_code, v_action,
        nullif(btrim(coalesce(p_changed_by, '')), ''),
        nullif(btrim(coalesce(p_change_reason, '')), ''),
        case when v_addon_existing.addon_master_id is null then null else to_jsonb(v_addon_existing) end,
        to_jsonb(v_addon_saved),
        coalesce(v_affected_count, 0)
      );

      insert into public.channel_product_option_recompute_queue_v1 (channel_id, external_product_no, enqueue_reason, source_kind, source_key)
      select distinct channel_id, external_product_no,
        coalesce(nullif(btrim(coalesce(p_change_reason, '')), ''), 'CENTRAL_REGISTRY_CHANGED'),
        'ADDON',
        v_addon_saved.addon_code
      from public.channel_product_option_entry_mapping_v1
      where channel_id = v_row.channel_id
        and addon_master_id = v_addon_saved.addon_master_id
        and is_active = true;

      registry_kind := 'ADDON';
      registry_key := v_addon_saved.addon_code;
      affected_products_count := coalesce(v_affected_count, 0);
      return next;
    elsif v_row.registry_kind = 'NOTICE' then
      select * into v_notice_existing
      from public.channel_option_notice_code_v1
      where channel_id = v_row.channel_id
        and notice_code = v_row.notice_code
      limit 1;

      insert into public.channel_option_notice_code_v1 (
        channel_id, notice_code, notice_name, display_text, description, sort_order, is_active
      ) values (
        v_row.channel_id, v_row.notice_code, v_row.notice_name, v_row.display_text, v_row.description, v_row.sort_order, v_row.is_active
      )
      on conflict (channel_id, notice_code)
      do update set
        notice_name = excluded.notice_name,
        display_text = excluded.display_text,
        description = excluded.description,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active,
        updated_at = now()
      returning * into v_notice_saved;

      v_action := case when v_notice_existing.notice_code_id is null then 'INSERT' when v_notice_saved.is_active = false then 'SOFT_DELETE' else 'UPDATE' end;

      select count(distinct external_product_no)::integer into v_affected_count
      from public.channel_product_option_entry_mapping_v1
      where channel_id = v_row.channel_id
        and notice_code = v_notice_saved.notice_code
        and is_active = true;

      insert into public.channel_option_registry_change_audit_v1 (
        channel_id, registry_kind, registry_key, action, changed_by, change_reason, before_payload, after_payload, affected_products_count
      ) values (
        v_notice_saved.channel_id, 'NOTICE', v_notice_saved.notice_code, v_action,
        nullif(btrim(coalesce(p_changed_by, '')), ''),
        nullif(btrim(coalesce(p_change_reason, '')), ''),
        case when v_notice_existing.notice_code_id is null then null else to_jsonb(v_notice_existing) end,
        to_jsonb(v_notice_saved),
        coalesce(v_affected_count, 0)
      );

      insert into public.channel_product_option_recompute_queue_v1 (channel_id, external_product_no, enqueue_reason, source_kind, source_key)
      select distinct channel_id, external_product_no,
        coalesce(nullif(btrim(coalesce(p_change_reason, '')), ''), 'CENTRAL_REGISTRY_CHANGED'),
        'NOTICE',
        v_notice_saved.notice_code
      from public.channel_product_option_entry_mapping_v1
      where channel_id = v_row.channel_id
        and notice_code = v_notice_saved.notice_code
        and is_active = true;

      registry_kind := 'NOTICE';
      registry_key := v_notice_saved.notice_code;
      affected_products_count := coalesce(v_affected_count, 0);
      return next;
    elsif v_row.registry_kind = 'OTHER_REASON' then
      select * into v_reason_existing
      from public.channel_option_other_reason_code_v1
      where channel_id = v_row.channel_id
        and reason_code = v_row.reason_code
      limit 1;

      insert into public.channel_option_other_reason_code_v1 (
        channel_id, reason_code, reason_name, display_text, description, sort_order, is_active
      ) values (
        v_row.channel_id, v_row.reason_code, v_row.reason_name, v_row.display_text, v_row.description, v_row.sort_order, v_row.is_active
      )
      on conflict (channel_id, reason_code)
      do update set
        reason_name = excluded.reason_name,
        display_text = excluded.display_text,
        description = excluded.description,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active,
        updated_at = now()
      returning * into v_reason_saved;

      v_action := case when v_reason_existing.other_reason_code_id is null then 'INSERT' when v_reason_saved.is_active = false then 'SOFT_DELETE' else 'UPDATE' end;

      select count(distinct external_product_no)::integer into v_affected_count
      from public.channel_product_option_entry_mapping_v1
      where channel_id = v_row.channel_id
        and other_reason_code = v_reason_saved.reason_code
        and is_active = true;

      insert into public.channel_option_registry_change_audit_v1 (
        channel_id, registry_kind, registry_key, action, changed_by, change_reason, before_payload, after_payload, affected_products_count
      ) values (
        v_reason_saved.channel_id, 'OTHER_REASON', v_reason_saved.reason_code, v_action,
        nullif(btrim(coalesce(p_changed_by, '')), ''),
        nullif(btrim(coalesce(p_change_reason, '')), ''),
        case when v_reason_existing.other_reason_code_id is null then null else to_jsonb(v_reason_existing) end,
        to_jsonb(v_reason_saved),
        coalesce(v_affected_count, 0)
      );

      insert into public.channel_product_option_recompute_queue_v1 (channel_id, external_product_no, enqueue_reason, source_kind, source_key)
      select distinct channel_id, external_product_no,
        coalesce(nullif(btrim(coalesce(p_change_reason, '')), ''), 'CENTRAL_REGISTRY_CHANGED'),
        'OTHER_REASON',
        v_reason_saved.reason_code
      from public.channel_product_option_entry_mapping_v1
      where channel_id = v_row.channel_id
        and other_reason_code = v_reason_saved.reason_code
        and is_active = true;

      registry_kind := 'OTHER_REASON';
      registry_key := v_reason_saved.reason_code;
      affected_products_count := coalesce(v_affected_count, 0);
      return next;
    else
      raise exception 'unsupported registry_kind: %', v_row.registry_kind;
    end if;
  end loop;
end;
$$;
