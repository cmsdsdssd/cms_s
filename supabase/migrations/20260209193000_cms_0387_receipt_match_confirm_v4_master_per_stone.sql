set search_path = public, pg_temp;
create or replace function public.cms_fn_receipt_line_match_confirm_v4(
  p_receipt_id uuid,
  p_receipt_line_uuid uuid,
  p_order_line_id uuid,
  p_selected_weight_g numeric default null,
  p_selected_material_code public.cms_e_material_code default null,
  p_selected_factory_labor_basic_cost_krw numeric default null,
  p_selected_factory_labor_other_cost_krw numeric default null,
  p_selected_factory_total_cost_krw numeric default null,
  p_actor_person_id uuid default null,
  p_note text default null,

  -- only meaningful for FACTORY scope (optional)
  p_factory_billing_shape public.cms_e_factory_billing_shape default null
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

  v_order record;
  v_master record;

  v_selected_weight numeric;
  v_selected_material public.cms_e_material_code;

  v_basic_cost numeric;
  v_other_cost_base numeric;
  v_total_amount numeric;

  v_qty int;

  -- supply sources (NULL => FACTORY)
  v_center_source public.cms_e_stone_supply_source;
  v_sub1_source   public.cms_e_stone_supply_source;
  v_sub2_source   public.cms_e_stone_supply_source;
  v_scope public.cms_e_pricing_rule_scope;
  v_mixed_supply_warn boolean := false;

  -- billing shape (for FACTORY)
  v_billing_shape public.cms_e_factory_billing_shape;
  v_shape_text text := null;

  -- parsed cost totals (optional)
  v_setting_fee_cost_total numeric := 0;
  v_self_stone_cost_total_snapshot numeric := 0;
  v_factory_stone_cost_total numeric := 0;
  v_factory_package_cost_total numeric := 0;

  -- stone qty / unit cost (receipt entered, line-total)
  v_center_qty_rcpt numeric := null;
  v_sub1_qty_rcpt numeric := null;
  v_sub2_qty_rcpt numeric := null;

  v_center_unit_cost numeric := 0;
  v_sub1_unit_cost numeric := 0;
  v_sub2_unit_cost numeric := 0;

  v_center_qty_total numeric := 0;
  v_sub1_qty_total numeric := 0;
  v_sub2_qty_total numeric := 0;

  -- computed totals
  v_self_stone_cost_total_calc numeric := 0;

  v_base_diff numeric := 0;
  v_base_sell numeric := 0;

  v_stone_margin_total numeric := 0;
  v_bead_margin_total numeric := 0;
  v_addon_margin_total numeric := 0;

  v_extra_cost_total numeric := 0;
  v_extra_margin_total numeric := 0;
  v_extra_sell numeric := 0;

  -- warnings (keep compatible keys)
  v_missing_setting_fee_warn boolean := false;
  v_missing_self_stone_cost_warn boolean := false;
  v_missing_factory_cost_warn boolean := false;
  v_missing_unit_cost_warn boolean := false;

  -- weight warn
  v_master_effective_weight numeric;
  v_weight_warn boolean := false;
  v_weight_deviation_pct numeric := null;

  -- shipment
  v_shipment_id uuid;
  v_shipment_line_id uuid;

  -- bookkeeping
  v_overridden jsonb := '{}'::jsonb;
  v_extra_items jsonb := '[]'::jsonb;
begin
  if p_receipt_id is null or p_receipt_line_uuid is null or p_order_line_id is null then
    raise exception 'receipt_id, receipt_line_uuid, order_line_id required';
  end if;

  -- already confirmed?
  select * into v_existing
  from public.cms_receipt_line_match
  where receipt_id = p_receipt_id
    and receipt_line_uuid = p_receipt_line_uuid
    and status = 'CONFIRMED'::public.cms_e_receipt_line_match_status
  limit 1;

  if found then
    if v_existing.order_line_id <> p_order_line_id then
      raise exception 'receipt line already confirmed to another order_line (existing=%, requested=%)',
        v_existing.order_line_id, p_order_line_id;
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

  -- receipt line load
  select vendor_party_id, material_code,
         factory_weight_g, factory_labor_basic_cost_krw, factory_labor_other_cost_krw, factory_total_amount_krw,
         line_item_json
    into v_vendor_party_id, v_receipt_material,
         v_factory_weight, v_factory_basic, v_factory_other, v_factory_total,
         v_line_item_json
  from public.cms_v_receipt_line_items_flat_v1
  where receipt_id = p_receipt_id
    and receipt_line_uuid = p_receipt_line_uuid;

  if not found then
    raise exception 'receipt line not found: receipt_id=%, line=%', p_receipt_id, p_receipt_line_uuid;
  end if;

  if v_vendor_party_id is null then
    raise exception 'receipt vendor_party_id required for confirm (receipt_id=%)', p_receipt_id;
  end if;

  -- order line load
  select ol.*, po.vendor_party_id as po_vendor_party_id
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
    'WAITING_INBOUND'::public.cms_e_order_status
  ) then
    raise exception 'order_line not matchable in current status: %', v_order.status;
  end if;

  -- master load (need per-stone margins)
  select
    m.item_id,
    m.weight_default_g, m.deduction_weight_default_g,
    m.labor_base_sell, m.labor_base_cost,
    m.labor_center_sell, m.labor_center_cost,
    m.labor_sub1_sell, m.labor_sub1_cost,
    m.labor_sub2_sell, m.labor_sub2_cost,
    m.labor_bead_sell, m.labor_bead_cost,
    m.setting_addon_margin_krw_per_piece,
    m.stone_addon_margin_krw_per_piece
  into v_master
  from public.cms_master_item m
  where m.item_id = v_order.item_id;

  if not found then
    raise exception 'master item not found: item_id=%', v_order.item_id;
  end if;

  v_qty := coalesce(v_order.qty, 1);

  -- selected (overrides)
  v_selected_weight := coalesce(p_selected_weight_g, v_factory_weight, 0);
  v_selected_material := coalesce(p_selected_material_code, v_receipt_material, v_order.material_code);

  v_basic_cost := coalesce(p_selected_factory_labor_basic_cost_krw, v_factory_basic, 0);
  v_other_cost_base := coalesce(p_selected_factory_labor_other_cost_krw, v_factory_other, 0);
  v_total_amount := coalesce(p_selected_factory_total_cost_krw, v_factory_total, 0);

  -- overridden fields tracking
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

  -- supply sources (NULL => FACTORY)
  v_center_source := coalesce(v_order.center_stone_source, 'FACTORY'::public.cms_e_stone_supply_source);
  v_sub1_source   := coalesce(v_order.sub1_stone_source,   'FACTORY'::public.cms_e_stone_supply_source);
  v_sub2_source   := coalesce(v_order.sub2_stone_source,   'FACTORY'::public.cms_e_stone_supply_source);

  -- scope precedence: SELF > PROVIDED > FACTORY
  if (v_center_source = 'SELF'::public.cms_e_stone_supply_source)
     or (v_sub1_source = 'SELF'::public.cms_e_stone_supply_source)
     or (v_sub2_source = 'SELF'::public.cms_e_stone_supply_source) then
    v_scope := 'SELF'::public.cms_e_pricing_rule_scope;
  elsif (v_center_source = 'PROVIDED'::public.cms_e_stone_supply_source)
     or (v_sub1_source = 'PROVIDED'::public.cms_e_stone_supply_source)
     or (v_sub2_source = 'PROVIDED'::public.cms_e_stone_supply_source) then
    v_scope := 'PROVIDED'::public.cms_e_pricing_rule_scope;
  else
    v_scope := 'FACTORY'::public.cms_e_pricing_rule_scope;
  end if;

  if (v_center_source is distinct from v_sub1_source) or (v_center_source is distinct from v_sub2_source) then
    v_mixed_supply_warn := true;
  end if;

  -- parse optional cost keys
  v_setting_fee_cost_total := case when (v_line_item_json->>'setting_fee_total_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'setting_fee_total_cost_krw')::numeric
    else null end;
  if v_setting_fee_cost_total is null then
    v_setting_fee_cost_total := coalesce(v_other_cost_base, 0);
    if coalesce(v_setting_fee_cost_total,0) = 0 then
      v_missing_setting_fee_warn := true;
    end if;
  end if;

  v_self_stone_cost_total_snapshot := case when (v_line_item_json->>'self_stone_total_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'self_stone_total_cost_krw')::numeric
    else 0 end;

  v_factory_package_cost_total := case when (v_line_item_json->>'factory_package_total_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'factory_package_total_cost_krw')::numeric
    else 0 end;

  v_factory_stone_cost_total := case when (v_line_item_json->>'factory_stone_total_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'factory_stone_total_cost_krw')::numeric
    else 0 end;

  -- billing shape resolution (FACTORY only)
  if v_scope = 'FACTORY'::public.cms_e_pricing_rule_scope then
    if p_factory_billing_shape is not null then
      v_billing_shape := p_factory_billing_shape;
    else
      v_shape_text := nullif(trim(upper(coalesce(v_line_item_json->>'factory_billing_shape',''))), '');
      if v_shape_text = 'SETTING_ONLY' then
        v_billing_shape := 'SETTING_ONLY'::public.cms_e_factory_billing_shape;
      elsif v_shape_text = 'SPLIT' then
        v_billing_shape := 'SPLIT'::public.cms_e_factory_billing_shape;
      elsif v_shape_text = 'BUNDLED_PACKAGE' then
        v_billing_shape := 'BUNDLED_PACKAGE'::public.cms_e_factory_billing_shape;
      else
        v_billing_shape := 'BUNDLED_PACKAGE'::public.cms_e_factory_billing_shape;
      end if;
    end if;

    if v_billing_shape = 'BUNDLED_PACKAGE'::public.cms_e_factory_billing_shape and coalesce(v_factory_package_cost_total,0) = 0 then
      v_factory_package_cost_total := coalesce(v_other_cost_base, 0);
      if coalesce(v_factory_package_cost_total,0) = 0 then
        v_missing_factory_cost_warn := true;
      end if;
    end if;

    if v_billing_shape = 'SPLIT'::public.cms_e_factory_billing_shape and coalesce(v_factory_stone_cost_total,0) = 0 then
      v_missing_factory_cost_warn := true;
    end if;
  else
    v_billing_shape := null;
  end if;

  -- parse stone qty/unit_cost (receipt)
  v_center_qty_rcpt := case when (v_line_item_json->>'stone_center_qty') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'stone_center_qty')::numeric else null end;
  v_sub1_qty_rcpt := case when (v_line_item_json->>'stone_sub1_qty') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'stone_sub1_qty')::numeric else null end;
  v_sub2_qty_rcpt := case when (v_line_item_json->>'stone_sub2_qty') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'stone_sub2_qty')::numeric else null end;

  v_center_unit_cost := case when (v_line_item_json->>'stone_center_unit_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'stone_center_unit_cost_krw')::numeric else 0 end;
  v_sub1_unit_cost := case when (v_line_item_json->>'stone_sub1_unit_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'stone_sub1_unit_cost_krw')::numeric else 0 end;
  v_sub2_unit_cost := case when (v_line_item_json->>'stone_sub2_unit_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'stone_sub2_unit_cost_krw')::numeric else 0 end;

  -- stone qty totals:
  --  - if receipt qty exists => treat as line-total (DO NOT multiply by v_qty)
  --  - else fallback to order default qty(per piece) * v_qty
  v_center_qty_total := greatest(
    coalesce(v_center_qty_rcpt, coalesce(v_order.center_stone_qty,0)::numeric * v_qty, 0),
    0
  );
  v_sub1_qty_total := greatest(
    coalesce(v_sub1_qty_rcpt, coalesce(v_order.sub1_stone_qty,0)::numeric * v_qty, 0),
    0
  );
  v_sub2_qty_total := greatest(
    coalesce(v_sub2_qty_rcpt, coalesce(v_order.sub2_stone_qty,0)::numeric * v_qty, 0),
    0
  );

  -- self stone cost total (only roles that are SELF)
  if coalesce(v_self_stone_cost_total_snapshot,0) > 0 then
    v_self_stone_cost_total_calc := v_self_stone_cost_total_snapshot;
  else
    if v_center_source = 'SELF'::public.cms_e_stone_supply_source then
      v_self_stone_cost_total_calc := v_self_stone_cost_total_calc + (v_center_qty_total * greatest(v_center_unit_cost,0));
      if v_center_qty_total > 0 and coalesce(v_center_unit_cost,0) = 0 then v_missing_unit_cost_warn := true; end if;
    end if;
    if v_sub1_source = 'SELF'::public.cms_e_stone_supply_source then
      v_self_stone_cost_total_calc := v_self_stone_cost_total_calc + (v_sub1_qty_total * greatest(v_sub1_unit_cost,0));
      if v_sub1_qty_total > 0 and coalesce(v_sub1_unit_cost,0) = 0 then v_missing_unit_cost_warn := true; end if;
    end if;
    if v_sub2_source = 'SELF'::public.cms_e_stone_supply_source then
      v_self_stone_cost_total_calc := v_self_stone_cost_total_calc + (v_sub2_qty_total * greatest(v_sub2_unit_cost,0));
      if v_sub2_qty_total > 0 and coalesce(v_sub2_unit_cost,0) = 0 then v_missing_unit_cost_warn := true; end if;
    end if;
  end if;

  if v_scope = 'SELF'::public.cms_e_pricing_rule_scope and coalesce(v_self_stone_cost_total_calc,0) = 0 then
    v_missing_self_stone_cost_warn := true;
  end if;

  -- base labor (factory basic + master base margin)
  v_base_diff := coalesce(v_master.labor_base_sell, 0) - coalesce(v_master.labor_base_cost, 0);
  v_base_sell := greatest(v_basic_cost + v_base_diff, 0);

  -- extra cost base
  if v_scope = 'FACTORY'::public.cms_e_pricing_rule_scope then
    if v_billing_shape = 'BUNDLED_PACKAGE'::public.cms_e_factory_billing_shape then
      v_extra_cost_total := coalesce(v_factory_package_cost_total, 0);
    elsif v_billing_shape = 'SPLIT'::public.cms_e_factory_billing_shape then
      v_extra_cost_total := coalesce(v_setting_fee_cost_total, 0) + coalesce(v_factory_stone_cost_total, 0);
    else
      v_extra_cost_total := coalesce(v_setting_fee_cost_total, 0);
    end if;
  else
    v_extra_cost_total := coalesce(v_setting_fee_cost_total, 0);
  end if;

  if v_scope = 'SELF'::public.cms_e_pricing_rule_scope then
    v_extra_cost_total := v_extra_cost_total + coalesce(v_self_stone_cost_total_calc, 0);
  end if;

  -- margins (per-stone from master: (sell-cost) * qty_total)
  v_stone_margin_total :=
    (v_center_qty_total * (coalesce(v_master.labor_center_sell,0) - coalesce(v_master.labor_center_cost,0))) +
    (v_sub1_qty_total   * (coalesce(v_master.labor_sub1_sell,0)   - coalesce(v_master.labor_sub1_cost,0))) +
    (v_sub2_qty_total   * (coalesce(v_master.labor_sub2_sell,0)   - coalesce(v_master.labor_sub2_cost,0)));

  v_bead_margin_total :=
    (coalesce(v_master.labor_bead_sell,0) - coalesce(v_master.labor_bead_cost,0)) * v_qty;

  v_addon_margin_total :=
    (coalesce(v_master.setting_addon_margin_krw_per_piece,0) + coalesce(v_master.stone_addon_margin_krw_per_piece,0)) * v_qty;

  v_extra_margin_total := coalesce(v_stone_margin_total,0) + coalesce(v_bead_margin_total,0) + coalesce(v_addon_margin_total,0);
  v_extra_sell := greatest(coalesce(v_extra_cost_total,0) + v_extra_margin_total, 0);

  -- weight warning
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

  -- evidence items: keep UX clean (STONE_LABOR 1개 + WARN 0원)
  v_extra_items := jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'type','STONE_LABOR',
      'label','알공임(세팅/원석 포함)',
      'amount', v_extra_sell,
      'meta', jsonb_build_object(
        'engine','pricing_v4_master_per_stone',
        'scope', v_scope::text,
        'billing_shape', coalesce(v_billing_shape::text, null),
        'qty', v_qty,
        'cost', jsonb_build_object(
          'factory_basic_cost_krw', v_basic_cost,
          'factory_other_cost_base_krw', v_other_cost_base,
          'setting_fee_cost_total_krw', v_setting_fee_cost_total,
          'self_stone_cost_total_krw', v_self_stone_cost_total_calc,
          'factory_stone_cost_total_krw', v_factory_stone_cost_total,
          'factory_package_cost_total_krw', v_factory_package_cost_total
        ),
        'stone', jsonb_build_object(
          'center_source', v_center_source::text,
          'sub1_source', v_sub1_source::text,
          'sub2_source', v_sub2_source::text,
          'center_qty_total', v_center_qty_total,
          'sub1_qty_total', v_sub1_qty_total,
          'sub2_qty_total', v_sub2_qty_total,
          'center_unit_cost_krw', v_center_unit_cost,
          'sub1_unit_cost_krw', v_sub1_unit_cost,
          'sub2_unit_cost_krw', v_sub2_unit_cost
        ),
        'margin', jsonb_build_object(
          'stone_margin_total_krw', v_stone_margin_total,
          'bead_margin_total_krw', v_bead_margin_total,
          'addon_margin_total_krw', v_addon_margin_total,
          'extra_margin_total_krw', v_extra_margin_total
        )
      )
    )
  );

  if v_mixed_supply_warn then
    v_extra_items := v_extra_items || jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type','WARN',
        'label','스톤 공급이 혼재(SELF/PROVIDED/FACTORY mix)',
        'amount', 0,
        'meta', jsonb_build_object(
          'center_source', v_center_source::text,
          'sub1_source', v_sub1_source::text,
          'sub2_source', v_sub2_source::text
        )
      )
    );
  end if;

  if v_missing_unit_cost_warn then
    v_extra_items := v_extra_items || jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type','WARN',
        'label','자입(SELF)인데 스톤 unit cost가 0원',
        'amount', 0
      )
    );
  end if;

  if v_weight_warn then
    v_extra_items := v_extra_items || jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type','WARN',
        'label','중량이 마스터 기본중량 대비 10% 이상 차이',
        'amount', 0,
        'meta', jsonb_build_object('weight_deviation_pct', v_weight_deviation_pct)
      )
    );
  end if;

  -- create shipment draft + line
  v_shipment_id := public.cms_fn_create_shipment_draft_v1(
    p_order_line_id,
    v_vendor_party_id,
    p_actor_person_id,
    p_note
  );

  v_shipment_line_id := public.cms_fn_add_shipment_line_from_order_v1(
    v_shipment_id,
    p_order_line_id,
    v_selected_material,
    v_selected_weight,
    'RULE'::public.cms_e_pricing_mode,
    p_actor_person_id
  );

  perform public.cms_fn_shipment_update_line_v1(
    v_shipment_line_id,
    v_selected_weight,
    0,
    v_base_sell,
    v_extra_sell,
    v_extra_items
  );

  -- receipt/order statuses
  update public.cms_receipt
  set status = 'MATCHED'::public.cms_e_receipt_status,
      updated_at = now()
  where receipt_id = p_receipt_id
    and status = 'UPLOADED'::public.cms_e_receipt_status;

  update public.cms_order_line
  set status = 'READY_TO_SHIP'::public.cms_e_order_status,
      inbound_at = coalesce(inbound_at, now()),
      updated_at = now()
  where order_line_id = p_order_line_id
    and status in ('SENT_TO_VENDOR'::public.cms_e_order_status, 'WAITING_INBOUND'::public.cms_e_order_status);

  -- write match record
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
    v_basic_cost, v_other_cost_base, v_total_amount,
    (v_overridden || jsonb_build_object(
      'pricing_v4', true,
      'pricing_engine', 'master_per_stone',
      'pricing_scope', v_scope::text,
      'factory_billing_shape', coalesce(v_billing_shape::text, null)
    )),
    p_note,
    now(), p_actor_person_id
  )
  on conflict (receipt_id, receipt_line_uuid, order_line_id) do update
    set status = excluded.status,
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
        confirmed_by = excluded.confirmed_by;

  return jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'receipt_line_uuid', p_receipt_line_uuid,
    'order_line_id', p_order_line_id,
    'shipment_id', v_shipment_id,
    'shipment_line_id', v_shipment_line_id,
    'selected_weight_g', v_selected_weight,
    'selected_material_code', v_selected_material,
    'base_sell_krw', v_base_sell,
    'extra_sell_krw', v_extra_sell,
    'extra_cost_total_krw', v_extra_cost_total,
    'extra_margin_total_krw', v_extra_margin_total,
    'weight_deviation_pct', v_weight_deviation_pct,
    'weight_deviation_warn', v_weight_warn,
    'missing_unit_cost_warn', v_missing_unit_cost_warn,
    'mixed_supply_warn', v_mixed_supply_warn,
    'missing_setting_fee_warn', v_missing_setting_fee_warn,
    'missing_self_stone_cost_warn', v_missing_self_stone_cost_warn,
    'missing_factory_cost_warn', v_missing_factory_cost_warn
  );
end $$;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute $g$grant execute on function public.cms_fn_receipt_line_match_confirm_v4(
      uuid, uuid, uuid, numeric, public.cms_e_material_code,
      numeric, numeric, numeric, uuid, text,
      public.cms_e_factory_billing_shape
    ) to authenticated$g$;
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute $g$grant execute on function public.cms_fn_receipt_line_match_confirm_v4(
      uuid, uuid, uuid, numeric, public.cms_e_material_code,
      numeric, numeric, numeric, uuid, text,
      public.cms_e_factory_billing_shape
    ) to service_role$g$;
  end if;
end $$;
