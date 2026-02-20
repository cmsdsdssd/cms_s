set search_path = public, pg_temp;
alter table if exists public.cms_receipt_line_match
  add column if not exists pricing_policy_version smallint,
  add column if not exists pricing_policy_meta jsonb not null default '{}'::jsonb;
alter table if exists public.cms_shipment_line
  add column if not exists pricing_policy_version smallint,
  add column if not exists pricing_policy_meta jsonb not null default '{}'::jsonb;
create or replace function public.cms_fn_receipt_line_match_confirm_v6_policy_v2(
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
  p_factory_billing_shape public.cms_e_factory_billing_shape default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_v5 jsonb;
  v_ok boolean := false;
  v_already_confirmed boolean := false;
  v_shipment_id uuid;
  v_shipment_line_id uuid;

  v_match record;
  v_order record;
  v_master record;

  v_line_item_json jsonb;
  v_factory_basic numeric := 0;
  v_vendor_party_id uuid;

  v_receipt_basic numeric := 0;
  v_receipt_other_base numeric := 0;
  v_base_margin_raw numeric := 0;
  v_base_margin numeric := 0;
  v_base_sell numeric := 0;

  v_qty int := 1;

  v_center_qty numeric := 0;
  v_sub1_qty numeric := 0;
  v_sub2_qty numeric := 0;
  v_center_qty_source text := 'RECEIPT';
  v_sub1_qty_source text := 'RECEIPT';
  v_sub2_qty_source text := 'RECEIPT';

  v_center_sell_unit numeric := 0;
  v_sub1_sell_unit numeric := 0;
  v_sub2_sell_unit numeric := 0;
  v_center_sell numeric := 0;
  v_sub1_sell numeric := 0;
  v_sub2_sell numeric := 0;
  v_stone_sell_total numeric := 0;

  v_center_cost_unit numeric := 0;
  v_sub1_cost_unit numeric := 0;
  v_sub2_cost_unit numeric := 0;
  v_stone_cost_total numeric := 0;

  v_plating_cost numeric := 0;
  v_plating_margin numeric := 0;
  v_plating_sell numeric := 0;

  v_decor_sell_total numeric := 0;
  v_decor_row record;

  v_extra_sell numeric := 0;
  v_extra_items jsonb := '[]'::jsonb;
  v_policy_meta jsonb := '{}'::jsonb;

  v_selected_weight numeric := 0;
begin
  v_v5 := public.cms_fn_receipt_line_match_confirm_v5(
    p_receipt_id,
    p_receipt_line_uuid,
    p_order_line_id,
    p_selected_weight_g,
    p_selected_material_code,
    p_selected_factory_labor_basic_cost_krw,
    p_selected_factory_labor_other_cost_krw,
    p_selected_factory_total_cost_krw,
    p_actor_person_id,
    p_note,
    p_factory_billing_shape
  );

  v_ok := coalesce((v_v5 ->> 'ok')::boolean, false);
  v_already_confirmed := coalesce((v_v5 ->> 'already_confirmed')::boolean, false);

  if not v_ok then
    return v_v5;
  end if;

  if v_already_confirmed then
    return v_v5 || jsonb_build_object(
      'pricing_policy_version', 1,
      'pricing_policy_note', 'already_confirmed_passthrough'
    );
  end if;

  v_shipment_id := nullif(v_v5 ->> 'shipment_id', '')::uuid;
  v_shipment_line_id := nullif(v_v5 ->> 'shipment_line_id', '')::uuid;

  if v_shipment_line_id is null then
    return v_v5 || jsonb_build_object(
      'pricing_policy_version', 1,
      'pricing_policy_note', 'missing_shipment_line_after_v5'
    );
  end if;

  select m.*, o.*
    into v_match
  from public.cms_receipt_line_match m
  join public.cms_order_line o on o.order_line_id = m.order_line_id
  where m.receipt_id = p_receipt_id
    and m.receipt_line_uuid = p_receipt_line_uuid
    and m.order_line_id = p_order_line_id
  limit 1;

  if not found then
    return v_v5 || jsonb_build_object(
      'pricing_policy_version', 1,
      'pricing_policy_note', 'match_row_not_found_after_v5'
    );
  end if;

  select
    r.vendor_party_id,
    r.line_item_json,
    coalesce(r.factory_labor_basic_cost_krw, 0)
  into v_vendor_party_id, v_line_item_json, v_factory_basic
  from public.cms_v_receipt_line_items_flat_v1 r
  where r.receipt_id = p_receipt_id
    and r.receipt_line_uuid = p_receipt_line_uuid
  limit 1;

  select *
    into v_order
  from public.cms_order_line
  where order_line_id = p_order_line_id
  limit 1;

  select
    m.master_id,
    m.labor_base_sell,
    m.labor_base_cost,
    m.labor_center,
    m.labor_side1,
    m.labor_side2,
    m.center_qty_default,
    m.sub1_qty_default,
    m.sub2_qty_default,
    m.plating_price_cost_default,
    m.plating_price_sell_default
  into v_master
  from public.cms_master_item m
  where m.master_id = v_order.matched_master_id
  limit 1;

  v_qty := greatest(coalesce(v_order.qty, 1), 1);
  v_selected_weight := coalesce(p_selected_weight_g, (v_v5 ->> 'selected_weight_g')::numeric, 0);

  v_receipt_basic := coalesce(
    p_selected_factory_labor_basic_cost_krw,
    v_match.selected_factory_labor_basic_cost_krw,
    case when (v_line_item_json->>'labor_basic_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$' then (v_line_item_json->>'labor_basic_cost_krw')::numeric else null end,
    v_factory_basic,
    0
  );

  v_receipt_other_base := greatest(coalesce(
    p_selected_factory_labor_other_cost_krw,
    v_match.selected_factory_labor_other_cost_krw,
    case when (v_line_item_json->>'labor_other_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$' then (v_line_item_json->>'labor_other_cost_krw')::numeric else null end,
    0
  ), 0);

  v_base_margin_raw := coalesce(v_master.labor_base_sell, 0) - coalesce(v_master.labor_base_cost, 0);
  if v_base_margin_raw > 0 then
    v_base_margin := ceil(v_base_margin_raw / 100.0) * 100;
  else
    v_base_margin := round(v_base_margin_raw);
  end if;
  v_base_sell := greatest(v_receipt_basic + v_base_margin, 0);

  v_center_qty := case when (v_line_item_json->>'stone_center_qty') ~ '^-?[0-9]+(\.[0-9]+)?$' then (v_line_item_json->>'stone_center_qty')::numeric else null end;
  v_sub1_qty := case when (v_line_item_json->>'stone_sub1_qty') ~ '^-?[0-9]+(\.[0-9]+)?$' then (v_line_item_json->>'stone_sub1_qty')::numeric else null end;
  v_sub2_qty := case when (v_line_item_json->>'stone_sub2_qty') ~ '^-?[0-9]+(\.[0-9]+)?$' then (v_line_item_json->>'stone_sub2_qty')::numeric else null end;

  if v_center_qty is null then
    v_center_qty := greatest(coalesce(v_master.center_qty_default, 0), 0) * v_qty;
    v_center_qty_source := 'MASTER_DEFAULT';
  end if;
  if v_sub1_qty is null then
    v_sub1_qty := greatest(coalesce(v_master.sub1_qty_default, 0), 0) * v_qty;
    v_sub1_qty_source := 'MASTER_DEFAULT';
  end if;
  if v_sub2_qty is null then
    v_sub2_qty := greatest(coalesce(v_master.sub2_qty_default, 0), 0) * v_qty;
    v_sub2_qty_source := 'MASTER_DEFAULT';
  end if;

  v_center_qty := greatest(coalesce(v_center_qty, 0), 0);
  v_sub1_qty := greatest(coalesce(v_sub1_qty, 0), 0);
  v_sub2_qty := greatest(coalesce(v_sub2_qty, 0), 0);

  v_center_sell_unit := greatest(coalesce(v_master.labor_center, 0), 0);
  v_sub1_sell_unit := greatest(coalesce(v_master.labor_side1, 0), 0);
  v_sub2_sell_unit := greatest(coalesce(v_master.labor_side2, 0), 0);

  v_center_sell := v_center_qty * v_center_sell_unit;
  v_sub1_sell := v_sub1_qty * v_sub1_sell_unit;
  v_sub2_sell := v_sub2_qty * v_sub2_sell_unit;
  v_stone_sell_total := v_center_sell + v_sub1_sell + v_sub2_sell;

  v_center_cost_unit := greatest(coalesce(case when (v_line_item_json->>'stone_center_unit_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$' then (v_line_item_json->>'stone_center_unit_cost_krw')::numeric else 0 end, 0), 0);
  v_sub1_cost_unit := greatest(coalesce(case when (v_line_item_json->>'stone_sub1_unit_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$' then (v_line_item_json->>'stone_sub1_unit_cost_krw')::numeric else 0 end, 0), 0);
  v_sub2_cost_unit := greatest(coalesce(case when (v_line_item_json->>'stone_sub2_unit_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$' then (v_line_item_json->>'stone_sub2_unit_cost_krw')::numeric else 0 end, 0), 0);
  v_stone_cost_total := (v_center_qty * v_center_cost_unit) + (v_sub1_qty * v_sub1_cost_unit) + (v_sub2_qty * v_sub2_cost_unit);

  if v_stone_sell_total > 0 then
    v_extra_items := v_extra_items || jsonb_build_array(
      jsonb_build_object(
        'type', 'STONE_LABOR',
        'label', '알공임',
        'amount', v_stone_sell_total,
        'meta', jsonb_build_object(
          'engine', 'policy_v2_stone_sell',
          'center_qty', v_center_qty,
          'sub1_qty', v_sub1_qty,
          'sub2_qty', v_sub2_qty,
          'center_qty_source', v_center_qty_source,
          'sub1_qty_source', v_sub1_qty_source,
          'sub2_qty_source', v_sub2_qty_source,
          'center_sell_unit', v_center_sell_unit,
          'sub1_sell_unit', v_sub1_sell_unit,
          'sub2_sell_unit', v_sub2_sell_unit,
          'stone_cost_total_krw', v_stone_cost_total
        )
      )
    );
  end if;

  v_plating_cost := coalesce(
    case when (v_line_item_json->>'plating_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$' then (v_line_item_json->>'plating_cost_krw')::numeric else null end,
    case when (v_line_item_json->>'plating_total_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$' then (v_line_item_json->>'plating_total_cost_krw')::numeric else null end,
    case when (v_line_item_json->>'plating_amount_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$' then (v_line_item_json->>'plating_amount_cost_krw')::numeric else null end,
    case when (v_line_item_json->>'labor_plating_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$' then (v_line_item_json->>'labor_plating_cost_krw')::numeric else null end,
    v_master.plating_price_cost_default,
    0
  );
  v_plating_cost := greatest(coalesce(v_plating_cost, 0), 0);

  if coalesce(v_order.is_plated, false) or v_plating_cost > 0 then
    select coalesce(r.markup_value_krw, r.margin_fixed_krw, 0)
      into v_plating_margin
    from public.cms_plating_markup_rule_v1 r
    where (r.plating_variant_id is null or r.plating_variant_id = v_order.plating_variant_id)
      and (r.vendor_party_id is null or r.vendor_party_id = v_vendor_party_id)
      and v_plating_cost >= coalesce(r.min_cost_krw, 0)
      and (r.max_cost_krw is null or v_plating_cost <= r.max_cost_krw)
    order by
      case when r.vendor_party_id = v_vendor_party_id then 0 else 1 end,
      case when r.plating_variant_id = v_order.plating_variant_id then 0 else 1 end,
      coalesce(r.min_cost_krw, 0) desc
    limit 1;

    v_plating_margin := greatest(coalesce(v_plating_margin, 0), 0);
    v_plating_sell := greatest(v_plating_cost + v_plating_margin, 0);

    if v_plating_sell > 0 then
      v_extra_items := v_extra_items || jsonb_build_array(
        jsonb_build_object(
          'type', 'PLATING',
          'label', '도금',
          'amount', v_plating_sell,
          'meta', jsonb_build_object(
            'engine', 'policy_v2_plating',
            'cost_krw', v_plating_cost,
            'margin_krw', v_plating_margin,
            'is_plated', coalesce(v_order.is_plated, false),
            'plating_variant_id', v_order.plating_variant_id
          )
        )
      );
    end if;
  end if;

  for v_decor_row in
    select
      a.absorb_item_id,
      a.reason,
      a.amount_krw,
      coalesce(a.is_per_piece, true) as is_per_piece
    from public.cms_master_absorb_labor_item_v1 a
    where a.master_id = v_order.matched_master_id
      and a.is_active = true
      and a.bucket = 'ETC'
      and upper(coalesce(a.reason, '')) <> 'BOM_AUTO_TOTAL'
      and (a.vendor_party_id is null or a.vendor_party_id = v_vendor_party_id)
    order by a.priority asc, a.updated_at desc nulls last
  loop
    declare
      v_decor_amount numeric;
      v_decor_reason text;
      v_decor_id text;
    begin
      v_decor_amount := coalesce(v_decor_row.amount_krw, 0) * case when v_decor_row.is_per_piece then v_qty else 1 end;
      v_decor_amount := greatest(coalesce(v_decor_amount, 0), 0);
      if v_decor_amount <= 0 then
        continue;
      end if;

      v_decor_reason := coalesce(nullif(trim(v_decor_row.reason), ''), '장식공임');
      v_decor_id := coalesce(v_decor_row.absorb_item_id::text, md5(v_decor_reason || v_decor_amount::text));

      v_decor_sell_total := v_decor_sell_total + v_decor_amount;
      v_extra_items := v_extra_items || jsonb_build_array(
        jsonb_build_object(
          'type', 'DECOR:' || v_decor_id,
          'label', '[장식] ' || v_decor_reason,
          'amount', v_decor_amount,
          'meta', jsonb_build_object(
            'engine', 'policy_v2_decor',
            'absorb_item_id', v_decor_row.absorb_item_id,
            'cost_krw', 0,
            'margin_krw', v_decor_amount,
            'is_per_piece', v_decor_row.is_per_piece,
            'qty_applied', case when v_decor_row.is_per_piece then v_qty else 1 end
          )
        )
      );
    end;
  end loop;

  if v_stone_sell_total = 0 and v_plating_sell = 0 and v_decor_sell_total = 0 and v_receipt_other_base > 0 then
    v_extra_items := v_extra_items || jsonb_build_array(
      jsonb_build_object(
        'type', 'OTHER_LABOR_BASE',
        'label', '기타공임(영수증)',
        'amount', v_receipt_other_base,
        'meta', jsonb_build_object(
          'engine', 'policy_v2_receipt_other_fallback',
          'cost_krw', v_receipt_other_base,
          'margin_krw', 0
        )
      )
    );
  end if;

  v_extra_sell := greatest(
    coalesce(v_stone_sell_total, 0)
    + coalesce(v_plating_sell, 0)
    + coalesce(v_decor_sell_total, 0)
    + case when v_stone_sell_total = 0 and v_plating_sell = 0 and v_decor_sell_total = 0 then v_receipt_other_base else 0 end,
    0
  );

  perform public.cms_fn_shipment_update_line_v1(
    v_shipment_line_id,
    v_selected_weight,
    0,
    v_base_sell,
    v_extra_sell,
    v_extra_items
  );

  v_policy_meta := jsonb_build_object(
    'policy_version', 2,
    'engine', 'receipt_cost_plus_master_margin',
    'receipt_basic_cost_krw', v_receipt_basic,
    'receipt_other_cost_krw', v_receipt_other_base,
    'base_margin_krw', v_base_margin,
    'stone_sell_total_krw', v_stone_sell_total,
    'stone_cost_total_krw', v_stone_cost_total,
    'plating_sell_krw', v_plating_sell,
    'plating_cost_krw', v_plating_cost,
    'plating_margin_krw', v_plating_margin,
    'decor_sell_total_krw', v_decor_sell_total,
    'component_rollup_included', false
  );

  update public.cms_receipt_line_match
  set overridden_fields = coalesce(overridden_fields, '{}'::jsonb)
      || jsonb_build_object(
        'pricing_v6_policy_v2', true,
        'policy_engine', 'receipt_cost_plus_master_margin',
        'component_rollup_included', false
      ),
      pricing_policy_version = 2,
      pricing_policy_meta = v_policy_meta,
      updated_at = now()
  where receipt_id = p_receipt_id
    and receipt_line_uuid = p_receipt_line_uuid
    and order_line_id = p_order_line_id;

  update public.cms_shipment_line
  set pricing_policy_version = 2,
      pricing_policy_meta = v_policy_meta,
      updated_at = now()
  where shipment_line_id = v_shipment_line_id;

  return v_v5
    || jsonb_build_object(
      'pricing_policy_version', 2,
      'pricing_policy_engine', 'receipt_cost_plus_master_margin',
      'base_labor_sell_krw', v_base_sell,
      'base_labor_margin_total_krw', v_base_margin,
      'extra_labor_sell_krw', v_extra_sell,
      'stone_labor_sell_krw', v_stone_sell_total,
      'plating_sell_krw', v_plating_sell,
      'decor_sell_total_krw', v_decor_sell_total
    );
end;
$$;
do $$
declare
  r record;
begin
  for r in
    select
      n.nspname as schema_name,
      p.proname as func_name,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cms_fn_receipt_line_match_confirm_v6_policy_v2'
  loop
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('grant execute on function %I.%I(%s) to authenticated', r.schema_name, r.func_name, r.args);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %I.%I(%s) to service_role', r.schema_name, r.func_name, r.args);
    end if;
  end loop;
end $$;
