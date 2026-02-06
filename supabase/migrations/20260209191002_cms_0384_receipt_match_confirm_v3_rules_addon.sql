set search_path = public, pg_temp;

-- ============================================================
-- 0382: receipt match confirm v3 (rules: SETTING/STONE/PACKAGE + master addon margins)
-- - ADD ONLY: does not touch v2
-- - Creates: cms_fn_receipt_line_match_confirm_v3
-- ============================================================

create or replace function public.cms_fn_receipt_line_match_confirm_v3(
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

  -- NEW (only used when FACTORY scope)
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
  v_receipt_model text;
  v_receipt_seq int;
  v_receipt_customer_code text;

  v_order record;
  v_master record;

  v_selected_weight numeric;
  v_selected_material public.cms_e_material_code;

  v_basic_cost numeric;
  v_other_cost_base numeric;
  v_total_amount numeric;

  v_qty int;

  -- supply (per role) + derived scope
  v_center_source public.cms_e_stone_supply_source;
  v_sub1_source   public.cms_e_stone_supply_source;
  v_sub2_source   public.cms_e_stone_supply_source;
  v_scope public.cms_e_pricing_rule_scope;
  v_mixed_supply_warn boolean := false;

  -- billing shape (for FACTORY)
  v_billing_shape public.cms_e_factory_billing_shape;
  v_shape_text text := null;

  -- cost totals (line-level)
  v_setting_fee_cost_total numeric := 0;   -- 물림비(세팅비) 원가(라인 총액)
  v_self_stone_cost_total  numeric := 0;   -- 자입 원석원가 스냅샷(라인 총액)
  v_factory_stone_cost_total numeric := 0; -- 공입 분리 시 원석원가(라인 총액)
  v_factory_package_cost_total numeric := 0; -- 공입 패키지 원가(라인 총액)

  -- per-piece cost basis for rule lookup
  v_setting_fee_cost_per_piece numeric := 0;
  v_stone_cost_per_piece numeric := 0;
  v_package_cost_per_piece numeric := 0;

  -- rule markups (per piece) + rule ids
  v_setting_markup_unit numeric := 0;
  v_stone_markup_unit numeric := 0;
  v_package_markup_unit numeric := 0;
  v_setting_rule_id uuid := null;
  v_stone_rule_id uuid := null;
  v_package_rule_id uuid := null;

  -- totals
  v_extra_cost_total numeric := 0;
  v_rules_margin_total numeric := 0;
  v_addon_margin_total numeric := 0;
  v_extra_margin_total numeric := 0;

  v_base_diff numeric := 0;
  v_base_sell numeric := 0;
  v_extra_sell numeric := 0;

  -- master addon margins (per piece)
  v_master_setting_addon_per_piece numeric := 0;
  v_master_stone_addon_per_piece numeric := 0;

  -- warnings
  v_missing_setting_fee_warn boolean := false;
  v_missing_self_stone_cost_warn boolean := false;
  v_missing_factory_cost_warn boolean := false;

  -- weight warn (kept compatible with v2 style)
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

  -- receipt line load
  select vendor_party_id, model_name, material_code, vendor_seq_no, customer_factory_code,
         factory_weight_g, factory_labor_basic_cost_krw, factory_labor_other_cost_krw, factory_total_amount_krw,
         line_item_json
    into v_vendor_party_id, v_receipt_model, v_receipt_material, v_receipt_seq, v_receipt_customer_code,
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

  -- master load (keep v2-compatible fields)
  select
    m.master_id,
    m.weight_default_g,
    m.deduction_weight_default_g,
    m.material_code_default,
    m.labor_base_sell,  m.labor_base_cost,
    -- NEW addon margins
    coalesce(m.setting_addon_margin_krw_per_piece, 0) as setting_addon_margin_krw_per_piece,
    coalesce(m.stone_addon_margin_krw_per_piece, 0)   as stone_addon_margin_krw_per_piece
  into v_master
  from public.cms_master_item m
  where m.master_id = v_order.matched_master_id;

  if not found then
    raise exception 'master not found: %', v_order.matched_master_id;
  end if;

  v_qty := greatest(coalesce(v_order.qty, 1), 1);

  -- material + weight selection (v2-style)
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

  -- receipt costs (v2-style base fields)
  v_basic_cost := coalesce(p_selected_factory_labor_basic_cost_krw, v_factory_basic, 0);
  v_other_cost_base := coalesce(p_selected_factory_labor_other_cost_krw, v_factory_other, 0);
  v_total_amount := coalesce(p_selected_factory_total_cost_krw, v_factory_total);

  -- overridden fields tracking (same pattern)
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

  -- supply sources (NULL => FACTORY for legacy friendliness)
  v_center_source := coalesce(v_order.center_stone_source, 'FACTORY'::public.cms_e_stone_supply_source);
  v_sub1_source   := coalesce(v_order.sub1_stone_source,   'FACTORY'::public.cms_e_stone_supply_source);
  v_sub2_source   := coalesce(v_order.sub2_stone_source,   'FACTORY'::public.cms_e_stone_supply_source);

  -- derive scope (simple precedence: SELF > PROVIDED > FACTORY)
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

  -- mixed supply warn (not blocking)
  if (v_center_source is distinct from v_sub1_source) or (v_center_source is distinct from v_sub2_source) then
    v_mixed_supply_warn := true;
  end if;

  -- ------------------------------------------------------------
  -- Parse enhanced cost keys from receipt line json (optional)
  -- All are line-total KRW.
  -- If missing => safe fallback.
  -- ------------------------------------------------------------

  -- setting fee cost (물림비 원가)
  v_setting_fee_cost_total := case when (v_line_item_json->>'setting_fee_total_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'setting_fee_total_cost_krw')::numeric
    else null end;

  if v_setting_fee_cost_total is null then
    -- legacy fallback: treat factory other cost as setting fee total
    v_setting_fee_cost_total := coalesce(v_other_cost_base, 0);
    -- if even that is 0, warn (not blocking)
    if coalesce(v_other_cost_base, 0) = 0 then
      v_missing_setting_fee_warn := true;
    end if;
  end if;

  -- self stone cost (자입 원석원가 스냅샷)
  v_self_stone_cost_total := case when (v_line_item_json->>'self_stone_total_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'self_stone_total_cost_krw')::numeric
    else 0 end;

  if v_scope = 'SELF'::public.cms_e_pricing_rule_scope and coalesce(v_self_stone_cost_total,0) = 0 then
    v_missing_self_stone_cost_warn := true;
  end if;

  -- factory costs (공입)
  v_factory_package_cost_total := case when (v_line_item_json->>'factory_package_total_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'factory_package_total_cost_krw')::numeric
    else 0 end;

  v_factory_stone_cost_total := case when (v_line_item_json->>'factory_stone_total_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (v_line_item_json->>'factory_stone_total_cost_krw')::numeric
    else 0 end;

  -- billing shape (only meaningful when scope=FACTORY)
  if v_scope = 'FACTORY'::public.cms_e_pricing_rule_scope then
    -- allow override from param > json > default
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

    -- If factory package cost missing, fallback to legacy other-cost
    if v_billing_shape = 'BUNDLED_PACKAGE'::public.cms_e_factory_billing_shape and coalesce(v_factory_package_cost_total,0) = 0 then
      v_factory_package_cost_total := coalesce(v_other_cost_base, 0);
      if coalesce(v_factory_package_cost_total,0) = 0 then
        v_missing_factory_cost_warn := true;
      end if;
    end if;

    -- If split but no factory stone cost, warn (not blocking)
    if v_billing_shape = 'SPLIT'::public.cms_e_factory_billing_shape and coalesce(v_factory_stone_cost_total,0) = 0 then
      v_missing_factory_cost_warn := true;
    end if;
  else
    v_billing_shape := null;
  end if;

  -- ------------------------------------------------------------
  -- Base labor sell (keep v2 semantics)
  -- ------------------------------------------------------------
  v_base_diff := coalesce(v_master.labor_base_sell, 0) - coalesce(v_master.labor_base_cost, 0);
  v_base_sell := greatest(v_basic_cost + v_base_diff, 0);

  -- ------------------------------------------------------------
  -- Extra labor (cost + margins)
  --   - FACTORY + BUNDLED_PACKAGE => PACKAGE only (anti double-count)
  --   - PROVIDED => SETTING only
  --   - SELF => SETTING + STONE
  --   - FACTORY + SPLIT => SETTING + STONE (STONE basis uses factory stone cost)
  -- ------------------------------------------------------------

  v_master_setting_addon_per_piece := coalesce(v_master.setting_addon_margin_krw_per_piece, 0);
  v_master_stone_addon_per_piece   := coalesce(v_master.stone_addon_margin_krw_per_piece, 0);

  if v_scope = 'FACTORY'::public.cms_e_pricing_rule_scope
     and v_billing_shape = 'BUNDLED_PACKAGE'::public.cms_e_factory_billing_shape then

    v_extra_cost_total := coalesce(v_factory_package_cost_total, 0);
    v_package_cost_per_piece := v_extra_cost_total / v_qty;

    select markup_krw, picked_rule_id
      into v_package_markup_unit, v_package_rule_id
    from public.cms_fn_pick_pricing_rule_markup_v1(
      'PACKAGE'::public.cms_e_pricing_rule_component,
      'FACTORY'::public.cms_e_pricing_rule_scope,
      v_vendor_party_id,
      v_package_cost_per_piece
    );

    v_rules_margin_total := coalesce(v_package_markup_unit,0) * v_qty;

    -- addon margins (per piece * qty)
    v_addon_margin_total :=
      (coalesce(v_master_setting_addon_per_piece,0) + coalesce(v_master_stone_addon_per_piece,0)) * v_qty;

  elsif v_scope = 'PROVIDED'::public.cms_e_pricing_rule_scope then

    v_extra_cost_total := coalesce(v_setting_fee_cost_total, 0);
    v_setting_fee_cost_per_piece := v_extra_cost_total / v_qty;

    select markup_krw, picked_rule_id
      into v_setting_markup_unit, v_setting_rule_id
    from public.cms_fn_pick_pricing_rule_markup_v1(
      'SETTING'::public.cms_e_pricing_rule_component,
      'PROVIDED'::public.cms_e_pricing_rule_scope,
      v_vendor_party_id,
      v_setting_fee_cost_per_piece
    );

    v_rules_margin_total := coalesce(v_setting_markup_unit,0) * v_qty;

    v_addon_margin_total :=
      coalesce(v_master_setting_addon_per_piece,0) * v_qty
      + coalesce(v_master_stone_addon_per_piece,0) * v_qty;

  elsif v_scope = 'SELF'::public.cms_e_pricing_rule_scope then

    v_extra_cost_total := coalesce(v_setting_fee_cost_total, 0) + coalesce(v_self_stone_cost_total, 0);

    v_setting_fee_cost_per_piece := coalesce(v_setting_fee_cost_total,0) / v_qty;
    v_stone_cost_per_piece := coalesce(v_self_stone_cost_total,0) / v_qty;

    select markup_krw, picked_rule_id
      into v_setting_markup_unit, v_setting_rule_id
    from public.cms_fn_pick_pricing_rule_markup_v1(
      'SETTING'::public.cms_e_pricing_rule_component,
      'SELF'::public.cms_e_pricing_rule_scope,
      v_vendor_party_id,
      v_setting_fee_cost_per_piece
    );

    select markup_krw, picked_rule_id
      into v_stone_markup_unit, v_stone_rule_id
    from public.cms_fn_pick_pricing_rule_markup_v1(
      'STONE'::public.cms_e_pricing_rule_component,
      'SELF'::public.cms_e_pricing_rule_scope,
      v_vendor_party_id,
      v_stone_cost_per_piece
    );

    v_rules_margin_total :=
      coalesce(v_setting_markup_unit,0) * v_qty
      + coalesce(v_stone_markup_unit,0) * v_qty;

    v_addon_margin_total :=
      (coalesce(v_master_setting_addon_per_piece,0) + coalesce(v_master_stone_addon_per_piece,0)) * v_qty;

  else
    -- FACTORY but not bundled: SPLIT or SETTING_ONLY
    if v_billing_shape is null then
      v_billing_shape := 'BUNDLED_PACKAGE'::public.cms_e_factory_billing_shape;
    end if;

    if v_billing_shape = 'SETTING_ONLY'::public.cms_e_factory_billing_shape then
      v_extra_cost_total := coalesce(v_setting_fee_cost_total, 0);
      v_setting_fee_cost_per_piece := v_extra_cost_total / v_qty;

      select markup_krw, picked_rule_id
        into v_setting_markup_unit, v_setting_rule_id
      from public.cms_fn_pick_pricing_rule_markup_v1(
        'SETTING'::public.cms_e_pricing_rule_component,
        'FACTORY'::public.cms_e_pricing_rule_scope,
        v_vendor_party_id,
        v_setting_fee_cost_per_piece
      );

      v_rules_margin_total := coalesce(v_setting_markup_unit,0) * v_qty;

    else
      -- SPLIT: setting + factory stone (if any)
      v_extra_cost_total := coalesce(v_setting_fee_cost_total, 0) + coalesce(v_factory_stone_cost_total, 0);

      v_setting_fee_cost_per_piece := coalesce(v_setting_fee_cost_total,0) / v_qty;
      v_stone_cost_per_piece := coalesce(v_factory_stone_cost_total,0) / v_qty;

      select markup_krw, picked_rule_id
        into v_setting_markup_unit, v_setting_rule_id
      from public.cms_fn_pick_pricing_rule_markup_v1(
        'SETTING'::public.cms_e_pricing_rule_component,
        'FACTORY'::public.cms_e_pricing_rule_scope,
        v_vendor_party_id,
        v_setting_fee_cost_per_piece
      );

      select markup_krw, picked_rule_id
        into v_stone_markup_unit, v_stone_rule_id
      from public.cms_fn_pick_pricing_rule_markup_v1(
        'STONE'::public.cms_e_pricing_rule_component,
        'FACTORY'::public.cms_e_pricing_rule_scope,
        v_vendor_party_id,
        v_stone_cost_per_piece
      );

      v_rules_margin_total :=
        coalesce(v_setting_markup_unit,0) * v_qty
        + coalesce(v_stone_markup_unit,0) * v_qty;
    end if;

    v_addon_margin_total :=
      (coalesce(v_master_setting_addon_per_piece,0) + coalesce(v_master_stone_addon_per_piece,0)) * v_qty;
  end if;

  v_extra_margin_total := coalesce(v_rules_margin_total,0) + coalesce(v_addon_margin_total,0);
  v_extra_sell := greatest(coalesce(v_extra_cost_total,0) + v_extra_margin_total, 0);

  -- weight warning (same idea as v2)
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

  -- evidence items (UI/debug source of truth)
  v_extra_items := jsonb_build_array(
    jsonb_build_object(
      'type','COST_BASIS',
      'label','원가 구성',
      'amount', v_extra_cost_total,
      'meta', jsonb_build_object(
        'scope', v_scope::text,
        'billing_shape', coalesce(v_billing_shape::text, null),
        'qty', v_qty,
        'setting_fee_cost_total_krw', v_setting_fee_cost_total,
        'self_stone_cost_total_krw', v_self_stone_cost_total,
        'factory_stone_cost_total_krw', v_factory_stone_cost_total,
        'factory_package_cost_total_krw', v_factory_package_cost_total,
        'legacy_other_cost_base_krw', v_other_cost_base
      )
    ),
    jsonb_build_object(
      'type','RULE_MARKUP',
      'label','룰 마진',
      'amount', v_rules_margin_total,
      'meta', jsonb_build_object(
        'setting', jsonb_build_object('rule_id', v_setting_rule_id, 'unit_markup_krw', v_setting_markup_unit, 'basis_per_piece_krw', v_setting_fee_cost_per_piece),
        'stone',   jsonb_build_object('rule_id', v_stone_rule_id,   'unit_markup_krw', v_stone_markup_unit,   'basis_per_piece_krw', v_stone_cost_per_piece),
        'package', jsonb_build_object('rule_id', v_package_rule_id, 'unit_markup_krw', v_package_markup_unit, 'basis_per_piece_krw', v_package_cost_per_piece)
      )
    ),
    jsonb_build_object(
      'type','MASTER_ADDON_MARGIN',
      'label','마스터 부가마진',
      'amount', v_addon_margin_total,
      'meta', jsonb_build_object(
        'setting_addon_per_piece_krw', v_master_setting_addon_per_piece,
        'stone_addon_per_piece_krw', v_master_stone_addon_per_piece,
        'qty', v_qty
      )
    )
  );

  if v_mixed_supply_warn or v_missing_setting_fee_warn or v_missing_self_stone_cost_warn or v_missing_factory_cost_warn then
    v_extra_items := v_extra_items || jsonb_build_array(
      jsonb_build_object(
        'type','WARN',
        'label','경고',
        'amount', 0,
        'meta', jsonb_build_object(
          'mixed_supply_warn', v_mixed_supply_warn,
          'missing_setting_fee_warn', v_missing_setting_fee_warn,
          'missing_self_stone_cost_warn', v_missing_self_stone_cost_warn,
          'missing_factory_cost_warn', v_missing_factory_cost_warn
        )
      )
    );
  end if;

  -- create shipment draft + line (same workflow as v2)
  v_shipment_id := public.cms_fn_create_shipment_header_v1(v_order.customer_party_id, current_date, null);

  v_shipment_line_id := public.cms_fn_add_shipment_line_from_order_v1(
    v_shipment_id,
    p_order_line_id,
    v_qty,
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

  -- write match record (keep table columns same as v2; store legacy selected other cost)
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
      'pricing_v3', true,
      'pricing_scope', v_scope::text,
      'factory_billing_shape', coalesce(v_billing_shape::text, null),
      'rule_ids', jsonb_build_object(
        'setting', v_setting_rule_id,
        'stone', v_stone_rule_id,
        'package', v_package_rule_id
      )
    )),
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

  -- reject other suggestions for same receipt line
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

    'extra_cost_total_krw', v_extra_cost_total,
    'rules_margin_total_krw', v_rules_margin_total,
    'addon_margin_total_krw', v_addon_margin_total,

    'pricing_scope', v_scope::text,
    'factory_billing_shape', coalesce(v_billing_shape::text, null),

    'weight_deviation_pct', v_weight_deviation_pct,
    'weight_deviation_warn', v_weight_warn,

    'mixed_supply_warn', v_mixed_supply_warn,
    'missing_setting_fee_warn', v_missing_setting_fee_warn,
    'missing_self_stone_cost_warn', v_missing_self_stone_cost_warn,
    'missing_factory_cost_warn', v_missing_factory_cost_warn
  );
end $$;

-- ------------------------------------------------------------
-- Safe grants (only if roles exist)
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute $g$grant execute on function public.cms_fn_receipt_line_match_confirm_v3(
      uuid, uuid, uuid, numeric, public.cms_e_material_code,
      numeric, numeric, numeric, uuid, text,
      public.cms_e_factory_billing_shape
    ) to authenticated$g$;
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute $g$grant execute on function public.cms_fn_receipt_line_match_confirm_v3(
      uuid, uuid, uuid, numeric, public.cms_e_material_code,
      numeric, numeric, numeric, uuid, text,
      public.cms_e_factory_billing_shape
    ) to service_role$g$;
  end if;
end $$;
