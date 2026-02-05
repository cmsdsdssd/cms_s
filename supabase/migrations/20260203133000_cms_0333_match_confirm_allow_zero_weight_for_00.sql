set search_path = public, pg_temp;

create or replace function public.cms_fn_receipt_line_match_confirm_v1(
  p_receipt_id uuid,
  p_receipt_line_uuid uuid,
  p_order_line_id uuid,
  p_selected_weight_g numeric default null,
  p_selected_material_code public.cms_e_material_code default null,
  p_selected_factory_labor_basic_cost_krw numeric default null,
  p_selected_factory_labor_other_cost_krw numeric default null,
  p_selected_factory_total_cost_krw numeric default null,
  p_actor_person_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing record;

  v_vendor_party_id uuid;
  v_factory_weight numeric;
  v_factory_basic numeric;
  v_factory_other numeric;
  v_factory_total numeric;
  v_line_item_json jsonb;
  v_receipt_material public.cms_e_material_code;
  v_receipt_model text;
  v_receipt_seq int;
  v_receipt_customer_code text;

  v_order record;
  v_master record;

  v_selected_weight numeric;
  v_selected_material public.cms_e_material_code;
  v_basic_cost numeric;
  v_other_cost numeric;
  v_other_cost_base numeric;
  v_stone_cost numeric := 0;
  v_total_amount numeric;

  v_base_diff numeric;
  v_extra_diff numeric;
  v_base_sell numeric;
  v_extra_sell numeric;

  v_master_effective_weight numeric;
  v_weight_warn boolean := false;
  v_weight_deviation_pct numeric := null;

  v_shipment_id uuid;
  v_shipment_line_id uuid;

  v_overridden jsonb := '{}'::jsonb;
  v_extra_items jsonb := '[]'::jsonb;
begin
  if p_receipt_id is null or p_receipt_line_uuid is null or p_order_line_id is null then
    raise exception 'receipt_id, receipt_line_uuid, order_line_id required';
  end if;

  select * into v_existing
  from public.cms_receipt_line_match
  where receipt_id = p_receipt_id
    and receipt_line_uuid = p_receipt_line_uuid
    and status = 'CONFIRMED'::public.cms_e_receipt_line_match_status
  limit 1;

  if found then
    if v_existing.order_line_id <> p_order_line_id then
      raise exception 'receipt line already confirmed to another order_line (existing=%, requested=%)', v_existing.order_line_id, p_order_line_id;
    end if;

    return jsonb_build_object(
      'ok', true,
      'already_confirmed', true,
      'receipt_id', p_receipt_id,
      'receipt_line_uuid', p_receipt_line_uuid,
      'order_line_id', p_order_line_id,
      'shipment_id', v_existing.shipment_id,
      'shipment_line_id', v_existing.shipment_line_id,
      'selected_weight_g', v_existing.selected_weight_g,
      'selected_material_code', v_existing.selected_material_code
    );
  end if;

  select vendor_party_id, model_name, material_code, vendor_seq_no, customer_factory_code,
         factory_weight_g, factory_labor_basic_cost_krw, factory_labor_other_cost_krw, factory_total_amount_krw,
         line_item_json
    into v_vendor_party_id, v_receipt_model, v_receipt_material, v_receipt_seq, v_receipt_customer_code,
         v_factory_weight, v_factory_basic, v_factory_other, v_factory_total, v_line_item_json
  from public.cms_v_receipt_line_items_flat_v1
  where receipt_id = p_receipt_id
    and receipt_line_uuid = p_receipt_line_uuid;

  if not found then
    raise exception 'receipt line not found: receipt_id=%, line=%', p_receipt_id, p_receipt_line_uuid;
  end if;

  if v_vendor_party_id is null then
    raise exception 'receipt vendor_party_id required for confirm (receipt_id=%)', p_receipt_id;
  end if;

  select
    ol.*,
    po.vendor_party_id as po_vendor_party_id
  into v_order
  from public.cms_order_line ol
  left join public.cms_factory_po po on po.po_id = ol.factory_po_id
  where ol.order_line_id = p_order_line_id;

  if not found then
    raise exception 'order_line not found: %', p_order_line_id;
  end if;

  if v_order.po_vendor_party_id is distinct from v_vendor_party_id then
    raise exception 'vendor mismatch (receipt vendor %, order vendor %)', v_vendor_party_id, v_order.po_vendor_party_id;
  end if;

  if v_order.status not in (
    'SENT_TO_VENDOR'::public.cms_e_order_status,
    'WAITING_INBOUND'::public.cms_e_order_status,
    'READY_TO_SHIP'::public.cms_e_order_status
  ) then
    raise exception 'order_line status not matchable: %, status=%', p_order_line_id, v_order.status;
  end if;

  if v_order.matched_master_id is null then
    raise exception 'order_line.matched_master_id required (strict master mode): %', p_order_line_id;
  end if;

  select
    m.master_id,
    m.weight_default_g,
    m.deduction_weight_default_g,
    m.material_code_default,
    m.labor_base_sell, m.labor_base_cost,
    (m.labor_center_sell + m.labor_sub1_sell + m.labor_sub2_sell + m.labor_bead_sell) as extra_sell_sum,
    (m.labor_center_cost + m.labor_sub1_cost + m.labor_sub2_cost + m.labor_bead_cost) as extra_cost_sum
  into v_master
  from public.cms_master_item m
  where m.master_id = v_order.matched_master_id;

  if not found then
    raise exception 'master not found: %', v_order.matched_master_id;
  end if;

  v_selected_material := coalesce(
    p_selected_material_code,
    v_receipt_material,
    v_order.material_code,
    v_master.material_code_default
  );
  if v_selected_material is null then
    raise exception 'material_code required at match time (receipt_line=%)', p_receipt_line_uuid;
  end if;

  v_selected_weight := round(coalesce(p_selected_weight_g, v_factory_weight)::numeric, 2);
  if v_selected_material = '00'::public.cms_e_material_code then
    v_selected_weight := coalesce(v_selected_weight, 0);
  end if;
  if v_selected_weight is null or v_selected_weight <= 0 then
    raise exception 'selected_weight_g required and must be > 0';
  end if;

  v_basic_cost := coalesce(p_selected_factory_labor_basic_cost_krw, v_factory_basic, 0);
  v_other_cost_base := coalesce(p_selected_factory_labor_other_cost_krw, v_factory_other, 0);
  v_stone_cost :=
    (case when (v_line_item_json->>'stone_center_qty') ~ '^-?[0-9]+(\.[0-9]+)?$' then (v_line_item_json->>'stone_center_qty')::numeric else 0 end)
    * (case when (v_line_item_json->>'stone_center_unit_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$' then (v_line_item_json->>'stone_center_unit_cost_krw')::numeric else 0 end)
    + (case when (v_line_item_json->>'stone_sub1_qty') ~ '^-?[0-9]+(\.[0-9]+)?$' then (v_line_item_json->>'stone_sub1_qty')::numeric else 0 end)
    * (case when (v_line_item_json->>'stone_sub1_unit_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$' then (v_line_item_json->>'stone_sub1_unit_cost_krw')::numeric else 0 end)
    + (case when (v_line_item_json->>'stone_sub2_qty') ~ '^-?[0-9]+(\.[0-9]+)?$' then (v_line_item_json->>'stone_sub2_qty')::numeric else 0 end)
    * (case when (v_line_item_json->>'stone_sub2_unit_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$' then (v_line_item_json->>'stone_sub2_unit_cost_krw')::numeric else 0 end);
  v_other_cost := v_other_cost_base + v_stone_cost;
  v_total_amount := coalesce(p_selected_factory_total_cost_krw, v_factory_total);

  if p_selected_weight_g is not null and v_factory_weight is not null and round(p_selected_weight_g::numeric, 2) <> round(v_factory_weight::numeric, 2) then
    v_overridden := v_overridden || jsonb_build_object('weight_g', true);
  end if;
  if p_selected_material_code is not null and v_receipt_material is not null and p_selected_material_code <> v_receipt_material then
    v_overridden := v_overridden || jsonb_build_object('material_code', true);
  end if;
  if p_selected_factory_labor_basic_cost_krw is not null and v_factory_basic is not null and p_selected_factory_labor_basic_cost_krw <> v_factory_basic then
    v_overridden := v_overridden || jsonb_build_object('labor_basic_cost_krw', true);
  end if;
  if p_selected_factory_labor_other_cost_krw is not null and v_factory_other is not null and p_selected_factory_labor_other_cost_krw <> v_factory_other then
    v_overridden := v_overridden || jsonb_build_object('labor_other_cost_krw', true);
  end if;
  if p_selected_factory_total_cost_krw is not null and v_factory_total is not null and p_selected_factory_total_cost_krw <> v_factory_total then
    v_overridden := v_overridden || jsonb_build_object('total_cost_krw', true);
  end if;

  if v_master.weight_default_g is not null then
    v_master_effective_weight := greatest(coalesce(v_master.weight_default_g, 0) - coalesce(v_master.deduction_weight_default_g, 0), 0);
    v_master_effective_weight := round(v_master_effective_weight::numeric, 2);
    if v_master_effective_weight > 0 then
      v_weight_deviation_pct := abs(v_selected_weight - v_master_effective_weight) / v_master_effective_weight;
      if v_weight_deviation_pct > 0.10 then
        v_weight_warn := true;
      end if;
    end if;
  end if;

  v_base_diff := coalesce(v_master.labor_base_sell, 0) - coalesce(v_master.labor_base_cost, 0);
  v_extra_diff := coalesce(v_master.extra_sell_sum, 0) - coalesce(v_master.extra_cost_sum, 0);

  v_base_sell := greatest(v_basic_cost + v_base_diff, 0);
  v_extra_sell := greatest(v_other_cost + v_extra_diff, 0);

  v_extra_items := jsonb_build_array(
    jsonb_build_object('kind','RECEIPT','base_cost_krw', v_basic_cost, 'extra_cost_krw', v_other_cost_base),
    jsonb_build_object('kind','MASTER_DIFF','base_diff_krw', v_base_diff, 'extra_diff_krw', v_extra_diff)
  );
  if v_stone_cost > 0 then
    v_extra_items := v_extra_items || jsonb_build_array(
      jsonb_build_object('kind','STONE_LABOR','label','알공임','extra_cost_krw', v_stone_cost)
    );
  end if;

  v_shipment_id := public.cms_fn_create_shipment_header_v1(v_order.customer_party_id, current_date, null);

  v_shipment_line_id := public.cms_fn_add_shipment_line_from_order_v1(
    v_shipment_id,
    p_order_line_id,
    coalesce(v_order.qty, 1),
    'RULE'::public.cms_e_pricing_mode,
    null,
    v_selected_material,
    null,
    null,
    null,
    null,
    p_note
  );

  perform public.cms_fn_shipment_update_line_v1(
    v_shipment_line_id,
    v_selected_weight,
    0,
    v_base_sell,
    v_extra_sell,
    v_extra_items
  );

  update public.cms_shipment_line
  set purchase_receipt_id = p_receipt_id,
      purchase_receipt_line_uuid = p_receipt_line_uuid,
      material_code = v_selected_material,
      updated_at = now()
  where shipment_line_id = v_shipment_line_id;

  insert into public.cms_receipt_usage(receipt_id, entity_type, entity_id, note)
  values
    (p_receipt_id, 'SHIPMENT_HEADER', v_shipment_id, p_note),
    (p_receipt_id, 'SHIPMENT_LINE', v_shipment_line_id, p_note)
  on conflict do nothing;

  update public.cms_receipt_inbox
  set status = 'LINKED'::public.cms_e_receipt_status,
      updated_at = now()
  where receipt_id = p_receipt_id
    and status = 'UPLOADED'::public.cms_e_receipt_status;

  update public.cms_order_line
  set status = 'READY_TO_SHIP'::public.cms_e_order_status,
      inbound_at = coalesce(inbound_at, now()),
      updated_at = now()
  where order_line_id = p_order_line_id
    and status in ('SENT_TO_VENDOR'::public.cms_e_order_status, 'WAITING_INBOUND'::public.cms_e_order_status);

  insert into public.cms_receipt_line_match(
    receipt_id, receipt_line_uuid, order_line_id,
    status,
    shipment_id, shipment_line_id,
    selected_weight_g, selected_material_code,
    selected_factory_labor_basic_cost_krw, selected_factory_labor_other_cost_krw, selected_factory_total_cost_krw,
    overridden_fields,
    note,
    confirmed_at, confirmed_by
  )
  values(
    p_receipt_id, p_receipt_line_uuid, p_order_line_id,
    'CONFIRMED'::public.cms_e_receipt_line_match_status,
    v_shipment_id, v_shipment_line_id,
    v_selected_weight, v_selected_material,
    v_basic_cost, v_other_cost, v_total_amount,
    v_overridden,
    p_note,
    now(), p_actor_person_id
  )
  on conflict (receipt_id, receipt_line_uuid, order_line_id) do update
    set status = 'CONFIRMED'::public.cms_e_receipt_line_match_status,
        shipment_id = excluded.shipment_id,
        shipment_line_id = excluded.shipment_line_id,
        selected_weight_g = excluded.selected_weight_g,
        selected_material_code = excluded.selected_material_code,
        selected_factory_labor_basic_cost_krw = excluded.selected_factory_labor_basic_cost_krw,
        selected_factory_labor_other_cost_krw = excluded.selected_factory_labor_other_cost_krw,
        selected_factory_total_cost_krw = excluded.selected_factory_total_cost_krw,
        overridden_fields = excluded.overridden_fields,
        note = excluded.note,
        confirmed_at = excluded.confirmed_at,
        confirmed_by = excluded.confirmed_by,
        updated_at = now();

  update public.cms_receipt_line_match
  set status = 'REJECTED'::public.cms_e_receipt_line_match_status,
      updated_at = now()
  where receipt_id = p_receipt_id
    and receipt_line_uuid = p_receipt_line_uuid
    and status = 'SUGGESTED'::public.cms_e_receipt_line_match_status
    and order_line_id <> p_order_line_id;

  return jsonb_build_object(
    'ok', true,
    'already_confirmed', false,
    'receipt_id', p_receipt_id,
    'receipt_line_uuid', p_receipt_line_uuid,
    'order_line_id', p_order_line_id,
    'shipment_id', v_shipment_id,
    'shipment_line_id', v_shipment_line_id,
    'selected_weight_g', v_selected_weight,
    'selected_material_code', v_selected_material,
    'base_labor_sell_krw', v_base_sell,
    'extra_labor_sell_krw', v_extra_sell,
    'master_effective_weight_g', v_master_effective_weight,
    'weight_deviation_pct', v_weight_deviation_pct,
    'weight_deviation_warn', v_weight_warn
  );
end $$;
