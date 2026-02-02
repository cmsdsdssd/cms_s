-- Force shipment upsert to always create a new shipment header

CREATE OR REPLACE FUNCTION public.cms_fn_shipment_upsert_from_order_line(
  p_order_line_id uuid,
  p_weight_g numeric,
  p_total_labor numeric,
  p_actor_person_id uuid,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.cms_order_line%rowtype;
  v_shipment_id uuid;
  v_line_id uuid;
BEGIN
  IF p_order_line_id IS NULL THEN RAISE EXCEPTION 'order_line_id required'; END IF;
  IF p_weight_g IS NULL OR p_weight_g <= 0 THEN RAISE EXCEPTION 'weight_g must be > 0'; END IF;
  IF p_total_labor IS NULL OR p_total_labor < 0 THEN RAISE EXCEPTION 'total_labor must be >= 0'; END IF;

  SELECT * INTO v_order
  FROM public.cms_order_line
  WHERE order_line_id = p_order_line_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_line not found: %', p_order_line_id;
  END IF;

  v_shipment_id := public.cms_fn_create_shipment_header_v1(
    v_order.customer_party_id,
    CURRENT_DATE,
    NULL
  );

  v_line_id := public.cms_fn_add_shipment_line_from_order_v1(
    v_shipment_id,
    v_order.order_line_id,
    v_order.qty,
    'RULE'::cms_e_pricing_mode,
    NULL,
    NULL,
    v_order.is_plated,
    v_order.plating_variant_id,
    NULL,
    NULL,
    NULL
  );

  UPDATE public.cms_shipment_line
  SET measured_weight_g = p_weight_g,
      manual_labor_krw = p_total_labor,
      labor_total_sell_krw = p_total_labor,
      total_amount_sell_krw = COALESCE(material_amount_sell_krw, 0) + p_total_labor
  WHERE shipment_line_id = v_line_id;

  RETURN jsonb_build_object(
    'shipment_id', v_shipment_id,
    'shipment_line_id', v_line_id,
    'status', 'DRAFT'
  );
END $$;

GRANT EXECUTE ON FUNCTION public.cms_fn_shipment_upsert_from_order_line(uuid, numeric, numeric, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cms_fn_shipment_upsert_from_order_line(uuid, numeric, numeric, uuid, uuid) TO anon;
