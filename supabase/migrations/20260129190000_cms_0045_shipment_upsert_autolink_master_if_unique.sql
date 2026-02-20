set search_path = public, pg_temp;
-- (안전) helper가 없을 수도 있으니 create or replace로 보장
create or replace function public.cms_fn_norm_model_name(p text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(lower(trim(coalesce(p,''))), '\s+', ' ', 'g'), '');
$$;
create or replace function public.cms_fn_shipment_upsert_from_order_line(
  p_order_line_id uuid,
  p_weight_g numeric,
  p_total_labor numeric,
  p_actor_person_id uuid,
  p_idempotency_key text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_order public.cms_order_line%rowtype;
  v_master public.cms_master_item%rowtype;
  v_shipment_id uuid;
  v_line_id uuid;
  v_category_code cms_e_category_code;
  v_material_code cms_e_material_code;

  v_norm text;
  v_master_cnt int := 0;
  v_auto_master_id uuid;
begin
  if p_order_line_id is null then raise exception 'order_line_id required'; end if;
  if p_weight_g is null or p_weight_g <= 0 then raise exception 'weight_g must be > 0'; end if;
  if p_total_labor is null or p_total_labor <= 0 then raise exception 'total_labor must be > 0'; end if;

  select * into v_order
  from public.cms_order_line
  where order_line_id = p_order_line_id;

  if not found then
    raise exception 'order_line not found: %', p_order_line_id;
  end if;

  ----------------------------------------------------------------------
  -- NEW: matched_master_id가 없으면 model_name(공백/대소문자 정규화)로
  --      "유니크 1개"일 때만 자동 매칭 후 진행
  ----------------------------------------------------------------------
  if v_order.matched_master_id is null then
    v_norm := public.cms_fn_norm_model_name(v_order.model_name);

    select count(*), max(master_id)
      into v_master_cnt, v_auto_master_id
    from public.cms_master_item
    where public.cms_fn_norm_model_name(model_name) = v_norm;

    if v_master_cnt = 1 and v_auto_master_id is not null then
      update public.cms_order_line
      set matched_master_id = v_auto_master_id,
          match_state = 'AUTO_MATCHED',
          updated_at = now()
      where order_line_id = v_order.order_line_id
        and matched_master_id is null;

      v_order.matched_master_id := v_auto_master_id;
    else
      raise exception using
        errcode = 'P0001',
        message = format(
          'Order must be matched to a master item before shipping (order_line_id=%s, model_name=%s, candidates=%s)',
          v_order.order_line_id,
          coalesce(v_order.model_name,''),
          v_master_cnt
        );
    end if;
  end if;

  -- Lookup master item strictly by ID
  select * into v_master
  from public.cms_master_item
  where master_id = v_order.matched_master_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = format('Matched master item not found (master_id=%s)', v_order.matched_master_id);
  end if;

  v_category_code := v_master.category_code;
  v_material_code := v_master.material_code_default;

  if v_category_code is null then
    raise exception using
      errcode = 'P0001',
      message = format('category_code is null in master_item (master_id=%s)', v_master.master_id);
  end if;

  -- Ensure shipment header (draft)
  select shipment_id into v_shipment_id
  from public.cms_shipment_header
  where customer_party_id = v_order.customer_party_id
    and status = 'DRAFT'
  order by created_at desc
  limit 1;

  if v_shipment_id is null then
    v_shipment_id := public.cms_fn_create_shipment_header_v1(
      v_order.customer_party_id,
      current_date,
      null
    );
  end if;

  -- Add shipment line
  v_line_id := public.cms_fn_add_shipment_line_from_order_v1(
    v_shipment_id,
    v_order.order_line_id,
    v_order.qty,
    'RULE'::cms_e_pricing_mode,
    v_category_code,
    v_material_code,
    v_order.is_plated,
    v_order.plating_variant_id,
    null,
    null,
    null
  );

  update public.cms_shipment_line
  set measured_weight_g = p_weight_g,
      manual_labor_krw = p_total_labor
  where shipment_line_id = v_line_id;

  return jsonb_build_object(
    'shipment_id', v_shipment_id,
    'shipment_line_id', v_line_id,
    'status', 'DRAFT'
  );
end
$function$;
grant execute on function public.cms_fn_shipment_upsert_from_order_line(uuid,numeric,numeric,uuid,text) to authenticated;
