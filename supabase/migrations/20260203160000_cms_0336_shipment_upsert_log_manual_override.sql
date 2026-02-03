set search_path = public, pg_temp;

create or replace function public.cms_fn_shipment_upsert_from_order_line(
  p_order_line_id uuid,
  p_weight_g numeric,
  p_total_labor numeric,
  p_actor_person_id uuid,
  p_idempotency_key uuid,
  p_base_labor_krw numeric default null,
  p_extra_labor_krw numeric default null,
  p_extra_labor_items jsonb default null
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
  v_total_labor numeric;
  v_base_labor numeric;
  v_extra_labor numeric;
  v_material public.cms_e_material_code;
  v_allow_zero boolean := false;
begin
  if p_order_line_id is null then raise exception 'order_line_id required'; end if;
  if p_total_labor is not null and p_total_labor < 0 then raise exception 'total_labor must be >= 0'; end if;
  if p_base_labor_krw is not null and p_base_labor_krw < 0 then raise exception 'base_labor must be >= 0'; end if;
  if p_extra_labor_krw is not null and p_extra_labor_krw < 0 then raise exception 'extra_labor must be >= 0'; end if;

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

  if p_weight_g is null or (v_allow_zero = false and p_weight_g <= 0) or (v_allow_zero = true and p_weight_g < 0) then
    raise exception 'weight_g must be > 0';
  end if;

  v_shipment_id := public.cms_fn_create_shipment_header_v1(
    v_order.customer_party_id,
    current_date,
    null
  );

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

  v_base_labor := coalesce(p_base_labor_krw, p_total_labor, 0);
  v_extra_labor := coalesce(p_extra_labor_krw, 0);
  v_total_labor := coalesce(p_total_labor, v_base_labor + v_extra_labor);

  update public.cms_shipment_line
  set measured_weight_g = p_weight_g,
      manual_labor_krw = v_total_labor,
      base_labor_krw = v_base_labor,
      extra_labor_krw = v_extra_labor,
      extra_labor_items = coalesce(p_extra_labor_items, '[]'::jsonb),
      labor_total_sell_krw = v_total_labor,
      total_amount_sell_krw = coalesce(material_amount_sell_krw, 0) + v_total_labor,
      price_calc_trace = coalesce(price_calc_trace, '{}'::jsonb)
        || jsonb_build_object(
          'manual_labor_override', true,
          'manual_labor_krw', v_total_labor,
          'base_labor_krw', v_base_labor,
          'extra_labor_krw', v_extra_labor,
          'source', 'shipments_page',
          'actor_person_id', p_actor_person_id,
          'recorded_at', now()
        )
  where shipment_line_id = v_line_id;

  return jsonb_build_object(
    'shipment_id', v_shipment_id,
    'shipment_line_id', v_line_id,
    'status', 'DRAFT'
  );
end $$;
