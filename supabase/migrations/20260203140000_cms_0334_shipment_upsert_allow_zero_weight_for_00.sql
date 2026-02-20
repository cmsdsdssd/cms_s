set search_path = public, pg_temp;
create or replace function public.cms_fn_shipment_upsert_from_order_line(
  p_order_line_id uuid,
  p_weight_g numeric,
  p_total_labor numeric,
  p_actor_person_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.cms_order_line%rowtype;
  v_shipment_id uuid;
  v_line_id uuid;
  v_material public.cms_e_material_code;
  v_allow_zero boolean := false;
begin
  if p_order_line_id is null then raise exception 'order_line_id required'; end if;
  if p_total_labor is null or p_total_labor <= 0 then raise exception 'total_labor must be > 0'; end if;

  select * into v_order
  from public.cms_order_line
  where order_line_id = p_order_line_id;

  if not found then
    raise exception 'order_line not found: %', p_order_line_id;
  end if;

  select coalesce(v_order.material_code, m.material_code_default)
    into v_material
  from public.cms_master_item m
  where m.master_id = v_order.matched_master_id;

  v_allow_zero := v_material = '00'::public.cms_e_material_code;

  if v_allow_zero then
    if p_weight_g is null or p_weight_g < 0 then
      raise exception 'weight_g must be > 0';
    end if;
  else
    if p_weight_g is null or p_weight_g <= 0 then
      raise exception 'weight_g must be > 0';
    end if;
  end if;

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

  v_line_id := public.cms_fn_add_shipment_line_from_order_v1(
    v_shipment_id,
    v_order.order_line_id,
    v_order.qty,
    'RULE'::cms_e_pricing_mode,
    null,
    null,
    v_order.is_plated,
    v_order.plating_variant_id,
    null,
    null,
    null
  );

  update public.cms_shipment_line
  set measured_weight_g = p_weight_g,
      manual_labor_krw = p_total_labor,
      labor_total_sell_krw = p_total_labor,
      total_amount_sell_krw = COALESCE(material_amount_sell_krw, 0) + p_total_labor
  where shipment_line_id = v_line_id;

  return jsonb_build_object(
    'shipment_id', v_shipment_id,
    'shipment_line_id', v_line_id,
    'status', 'DRAFT'
  );
end $$;
