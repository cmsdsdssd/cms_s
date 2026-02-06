-- 20260206190000_cms_0380_fix_repair_create_v2_decision_log_before.sql
set search_path = public, pg_temp;

begin;

create or replace function public.cms_fn_create_repair_v2(
  p_party_id uuid,
  p_notes text default null,
  p_lines jsonb default '[]'::jsonb,
  p_actor_person_id uuid default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_first_id uuid;
  v_new_id uuid;
  v_created_ids uuid[] := '{}'::uuid[];
  r_line record;
begin
  if p_party_id is null then
    raise exception using errcode='P0001', message='party_id required';
  end if;

  if jsonb_typeof(coalesce(p_lines,'[]'::jsonb)) <> 'array' then
    raise exception using errcode='P0001', message='lines must be json array';
  end if;

  for r_line in
    select
      nullif((e->>'model_name')::text,'') as model_name,
      nullif((e->>'model_name_raw')::text,'') as model_name_raw,
      nullif((e->>'suffix')::text,'') as suffix,
      nullif((e->>'material_code')::text,'') as material_code,
      nullif((e->>'color')::text,'') as color,
      nullif((e->>'qty')::text,'')::int as qty,
      nullif((e->>'issue_desc')::text,'') as issue_desc,
      nullif((e->>'memo')::text,'') as memo,
      nullif((e->>'requested_due_date')::text,'')::date as requested_due_date,
      nullif((e->>'priority_code')::text,'') as priority_code,
      nullif((e->>'weight_received_g')::text,'')::numeric as weight_received_g,
      coalesce(nullif((e->>'is_plated')::text,''), 'false')::boolean as is_plated,
      nullif((e->>'plating_variant_id')::text,'')::uuid as plating_variant_id,
      nullif((e->>'repair_fee_krw')::text,'')::numeric as repair_fee_krw,
      nullif((e->>'repair_fee_reason')::text,'') as repair_fee_reason,
      coalesce(nullif((e->>'is_paid')::text,''), 'false')::boolean as is_paid
    from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb)) e
  loop
    -- 최소 요구사항 (수리비는 여기서 강제하지 않음)
    if coalesce(r_line.model_name, r_line.model_name_raw) is null then
      raise exception using errcode='P0001', message='model_name or model_name_raw required';
    end if;
    if r_line.issue_desc is null then
      raise exception using errcode='P0001', message='issue_desc required';
    end if;
    if coalesce(r_line.qty,0) <= 0 then
      raise exception using errcode='P0001', message='qty must be > 0';
    end if;

    -- 수리비가 들어오는 경우에만 사유 요구(접수 단계에서는 보통 0/NULL)
    if coalesce(r_line.repair_fee_krw,0) > 0
       and coalesce(nullif(trim(r_line.repair_fee_reason),''),'') is null then
      raise exception using errcode='P0001', message='repair_fee_reason required when repair_fee_krw > 0';
    end if;

    insert into public.cms_repair_line(
      customer_party_id,
      received_at,
      model_name,
      model_name_raw,
      suffix,
      material_code,
      color,
      qty,
      weight_received_g,
      is_paid,
      repair_fee_krw,
      repair_fee_reason,
      is_plated,
      plating_variant_id,
      requested_due_date,
      priority_code,
      memo,
      issue_desc,
      status,
      correlation_id
    ) values (
      p_party_id,
      current_date,
      r_line.model_name,
      r_line.model_name_raw,
      r_line.suffix,
      r_line.material_code::public.cms_e_material_code,
      r_line.color,
      r_line.qty,
      r_line.weight_received_g,
      coalesce(r_line.is_paid,false),
      coalesce(r_line.repair_fee_krw,0),
      r_line.repair_fee_reason,
      coalesce(r_line.is_plated,false),
      r_line.plating_variant_id,
      r_line.requested_due_date,
      coalesce(r_line.priority_code,'NORMAL')::public.cms_e_priority_code,
      coalesce(r_line.memo, p_notes),
      r_line.issue_desc,
      'RECEIVED'::public.cms_e_repair_status,
      p_correlation_id
    )
    returning repair_line_id into v_new_id;

    v_created_ids := array_append(v_created_ids, v_new_id);

    if v_first_id is null then
      v_first_id := v_new_id;
    end if;
  end loop;

  if v_first_id is null then
    raise exception using errcode='P0001', message='at least one line required';
  end if;

  -- ✅ 여기서 before 컬럼을 아예 안 넣음 → default '{}' 적용 → NOT NULL 위반 없음
  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, after, actor_person_id, note)
  values (
    'REPAIR_LINE',
    v_first_id,
    'CREATE_REPAIR',
    jsonb_build_object(
      'correlation_id', p_correlation_id,
      'created_ids', to_jsonb(v_created_ids),
      'line_count', coalesce(array_length(v_created_ids,1),0)
    ),
    p_actor_person_id,
    p_notes
  );

  return v_first_id;
end $$;

alter function public.cms_fn_create_repair_v2(uuid,text,jsonb,uuid,uuid)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_create_repair_v2(uuid,text,jsonb,uuid,uuid)
  to authenticated, service_role;

commit;
