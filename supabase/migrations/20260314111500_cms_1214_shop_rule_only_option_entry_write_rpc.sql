set search_path = public, pg_temp;

create or replace function public.cms_fn_upsert_channel_product_option_entry_mappings_v1(
  p_rows jsonb,
  p_changed_by text default null,
  p_change_reason text default null
)
returns setof public.channel_product_option_entry_mapping_v1
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_existing public.channel_product_option_entry_mapping_v1%rowtype;
  v_saved public.channel_product_option_entry_mapping_v1%rowtype;
  v_action text;
begin
  if coalesce(jsonb_typeof(p_rows), 'array') <> 'array' then
    raise exception 'p_rows must be a json array';
  end if;

  if coalesce(jsonb_array_length(coalesce(p_rows, '[]'::jsonb)), 0) = 0 then
    raise exception 'p_rows is required';
  end if;

  create temp table tmp_option_entry_mapping_input (
    ordinality integer not null,
    channel_id uuid not null,
    external_product_no text not null,
    option_name text not null,
    option_value text not null,
    category_key text not null,
    material_registry_code text,
    weight_g numeric(12,3),
    combo_code text,
    color_bucket_id uuid,
    decor_master_id uuid,
    addon_master_id uuid,
    other_reason_code text,
    explicit_delta_krw integer,
    notice_code text,
    label_snapshot text,
    is_active boolean not null
  ) on commit drop;

  insert into tmp_option_entry_mapping_input (
    ordinality,
    channel_id,
    external_product_no,
    option_name,
    option_value,
    category_key,
    material_registry_code,
    weight_g,
    combo_code,
    color_bucket_id,
    decor_master_id,
    addon_master_id,
    other_reason_code,
    explicit_delta_krw,
    notice_code,
    label_snapshot,
    is_active
  )
  select
    e.ordinality::integer,
    nullif(btrim(e.value ->> 'channel_id'), '')::uuid as channel_id,
    nullif(btrim(e.value ->> 'external_product_no'), '') as external_product_no,
    nullif(btrim(e.value ->> 'option_name'), '') as option_name,
    nullif(btrim(e.value ->> 'option_value'), '') as option_value,
    upper(nullif(btrim(e.value ->> 'category_key'), '')) as category_key,
    nullif(btrim(e.value ->> 'material_registry_code'), ''),
    nullif(btrim(e.value ->> 'weight_g'), '')::numeric(12,3),
    nullif(btrim(e.value ->> 'combo_code'), ''),
    nullif(btrim(e.value ->> 'color_bucket_id'), '')::uuid,
    nullif(btrim(e.value ->> 'decor_master_id'), '')::uuid,
    nullif(btrim(e.value ->> 'addon_master_id'), '')::uuid,
    nullif(btrim(e.value ->> 'other_reason_code'), ''),
    nullif(btrim(e.value ->> 'explicit_delta_krw'), '')::integer,
    nullif(btrim(e.value ->> 'notice_code'), ''),
    nullif(btrim(e.value ->> 'label_snapshot'), ''),
    coalesce((e.value ->> 'is_active')::boolean, true)
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) with ordinality as e(value, ordinality);

  if exists (
    select 1
    from tmp_option_entry_mapping_input
    where channel_id is null
       or external_product_no is null
       or option_name is null
       or option_value is null
       or category_key is null
  ) then
    raise exception 'channel_id, external_product_no, option_name, option_value, and category_key are required';
  end if;

  for v_row in
    select distinct on (channel_id, external_product_no, option_name, option_value)
      *
    from tmp_option_entry_mapping_input
    order by channel_id, external_product_no, option_name, option_value, ordinality desc
  loop
    perform pg_advisory_xact_lock(hashtext('option-entry-mapping:' || v_row.channel_id::text || ':' || v_row.external_product_no || ':' || v_row.option_name || ':' || v_row.option_value));

    select *
      into v_existing
    from public.channel_product_option_entry_mapping_v1 t
    where t.channel_id = v_row.channel_id
      and t.external_product_no = v_row.external_product_no
      and t.option_name = v_row.option_name
      and t.option_value = v_row.option_value
    limit 1;

    insert into public.channel_product_option_entry_mapping_v1 (
      channel_id,
      external_product_no,
      option_name,
      option_value,
      category_key,
      material_registry_code,
      weight_g,
      combo_code,
      color_bucket_id,
      decor_master_id,
      addon_master_id,
      other_reason_code,
      explicit_delta_krw,
      notice_code,
      label_snapshot,
      is_active
    ) values (
      v_row.channel_id,
      v_row.external_product_no,
      v_row.option_name,
      v_row.option_value,
      v_row.category_key,
      v_row.material_registry_code,
      v_row.weight_g,
      v_row.combo_code,
      v_row.color_bucket_id,
      v_row.decor_master_id,
      v_row.addon_master_id,
      v_row.other_reason_code,
      v_row.explicit_delta_krw,
      v_row.notice_code,
      v_row.label_snapshot,
      v_row.is_active
    )
    on conflict (channel_id, external_product_no, option_name, option_value)
    do update set
      category_key = excluded.category_key,
      material_registry_code = excluded.material_registry_code,
      weight_g = excluded.weight_g,
      combo_code = excluded.combo_code,
      color_bucket_id = excluded.color_bucket_id,
      decor_master_id = excluded.decor_master_id,
      addon_master_id = excluded.addon_master_id,
      other_reason_code = excluded.other_reason_code,
      explicit_delta_krw = excluded.explicit_delta_krw,
      notice_code = excluded.notice_code,
      label_snapshot = excluded.label_snapshot,
      is_active = excluded.is_active,
      updated_at = now()
    returning * into v_saved;

    v_action := case
      when v_existing.option_entry_mapping_id is null then 'INSERT'
      when v_saved.is_active = false then 'SOFT_DELETE'
      else 'UPDATE'
    end;

    insert into public.channel_product_option_entry_mapping_audit_v1 (
      option_entry_mapping_id,
      channel_id,
      external_product_no,
      option_name,
      option_value,
      action,
      changed_by,
      change_reason,
      before_payload,
      after_payload,
      affected_products_count
    ) values (
      v_saved.option_entry_mapping_id,
      v_saved.channel_id,
      v_saved.external_product_no,
      v_saved.option_name,
      v_saved.option_value,
      v_action,
      nullif(btrim(coalesce(p_changed_by, '')), ''),
      nullif(btrim(coalesce(p_change_reason, '')), ''),
      case when v_existing.option_entry_mapping_id is null then null else to_jsonb(v_existing) end,
      to_jsonb(v_saved),
      1
    );

    insert into public.channel_product_option_recompute_queue_v1 (
      channel_id,
      external_product_no,
      enqueue_reason,
      source_kind,
      source_key
    ) values (
      v_saved.channel_id,
      v_saved.external_product_no,
      coalesce(nullif(btrim(coalesce(p_change_reason, '')), ''), 'OPTION_ENTRY_MAPPING_CHANGED'),
      'OPTION_ENTRY_MAPPING',
      v_saved.option_entry_mapping_id::text
    );
  end loop;

  return query
  select t.*
  from public.channel_product_option_entry_mapping_v1 t
  join (
    select distinct channel_id, external_product_no, option_name, option_value
    from tmp_option_entry_mapping_input
  ) s
    on s.channel_id = t.channel_id
   and s.external_product_no = t.external_product_no
   and s.option_name = t.option_name
   and s.option_value = t.option_value
  order by t.external_product_no, t.option_name, t.option_value;
end;
$$;
