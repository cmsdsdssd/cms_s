set search_path = public, pg_temp;

create or replace function public.cms_fn_apply_silver_factor_fix_v1(
  p_shipment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_silver_tick_id uuid;
  v_silver_symbol public.cms_e_market_symbol;
  v_silver_price numeric;
  v_factor_cfg numeric;
  v_factor_applied numeric;
  v_total_sell numeric := 0;
  v_total_cost numeric := 0;
  v_total_weight numeric := 0;
  v_total_labor numeric := 0;
begin
  if p_shipment_id is null then
    raise exception 'shipment_id required';
  end if;

  select silver_tick_id, silver_krw_per_g_snapshot
    into v_silver_tick_id, v_silver_price
  from public.cms_shipment_valuation
  where shipment_id = p_shipment_id;

  if v_silver_tick_id is not null then
    select symbol into v_silver_symbol
    from public.cms_market_tick
    where tick_id = v_silver_tick_id;
  end if;

  select coalesce(c.silver_kr_correction_factor, c.cs_correction_factor, 1.2)
    into v_factor_cfg
  from public.cms_market_tick_config c
  where c.config_key = 'DEFAULT'
  limit 1;

  if v_silver_symbol = 'SILVER_CN_KRW_PER_G'::public.cms_e_market_symbol then
    v_factor_applied := 1.0;
  else
    v_factor_applied := coalesce(v_factor_cfg, 1.2);
  end if;

  update public.cms_shipment_line sl
  set
    silver_adjust_factor = v_factor_applied,
    material_amount_sell_krw = round(
      coalesce(sl.silver_tick_krw_per_g, v_silver_price, 0)
      * (case when sl.material_code = '925'::public.cms_e_material_code then 0.925 else 1.0 end)
      * v_factor_applied
      * coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g,0) - coalesce(sl.deduction_weight_g,0),0))
    , 0),
    material_amount_cost_krw = round(
      coalesce(sl.silver_tick_krw_per_g, v_silver_price, 0)
      * (case when sl.material_code = '925'::public.cms_e_material_code then 0.925 else 1.0 end)
      * v_factor_applied
      * coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g,0) - coalesce(sl.deduction_weight_g,0),0))
    , 0),
    total_amount_sell_krw =
      coalesce(sl.labor_total_sell_krw,0)
      + coalesce(sl.plating_amount_sell_krw,0)
      + coalesce(sl.repair_fee_krw,0)
      + round(
          coalesce(sl.silver_tick_krw_per_g, v_silver_price, 0)
          * (case when sl.material_code = '925'::public.cms_e_material_code then 0.925 else 1.0 end)
          * v_factor_applied
          * coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g,0) - coalesce(sl.deduction_weight_g,0),0))
        , 0),
    total_amount_cost_krw =
      coalesce(sl.labor_total_cost_krw,0)
      + coalesce(sl.plating_amount_cost_krw,0)
      + round(
          coalesce(sl.silver_tick_krw_per_g, v_silver_price, 0)
          * (case when sl.material_code = '925'::public.cms_e_material_code then 0.925 else 1.0 end)
          * v_factor_applied
          * coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g,0) - coalesce(sl.deduction_weight_g,0),0))
        , 0)
  where sl.shipment_id = p_shipment_id
    and sl.material_code in ('925'::public.cms_e_material_code, '999'::public.cms_e_material_code);

  select
    coalesce(sum(total_amount_sell_krw),0),
    coalesce(sum(total_amount_cost_krw),0),
    coalesce(sum(net_weight_g),0),
    coalesce(sum(labor_total_sell_krw),0)
  into v_total_sell, v_total_cost, v_total_weight, v_total_labor
  from public.cms_shipment_line
  where shipment_id = p_shipment_id;

  update public.cms_shipment_valuation
  set
    silver_adjust_factor_snapshot = v_factor_applied,
    material_value_krw = (select coalesce(sum(material_amount_sell_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id),
    labor_value_krw = (select coalesce(sum(labor_total_sell_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id),
    total_value_krw = v_total_sell,
    breakdown = coalesce(breakdown, '{}'::jsonb) || jsonb_build_object(
      'silver_factor_applied_override', v_factor_applied,
      'silver_factor_source', case when v_silver_symbol = 'SILVER_CN_KRW_PER_G'::public.cms_e_market_symbol then 'CN_TICK' else 'CONFIG' end
    )
  where shipment_id = p_shipment_id;

  update public.cms_ar_ledger
  set
    amount_krw = v_total_sell,
    total_weight_g = v_total_weight,
    total_labor_krw = v_total_labor
  where entry_type = 'SHIPMENT'
    and shipment_id = p_shipment_id;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'silver_factor_applied', v_factor_applied,
    'total_sell_krw', v_total_sell,
    'total_cost_krw', v_total_cost
  );
end $$;

create or replace function public.cms_fn_confirm_shipment_v3_cost_v1(
  p_shipment_id uuid,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_emit_inventory boolean default true,
  p_correlation_id uuid default null,
  p_cost_mode text default 'PROVISIONAL',
  p_receipt_id uuid default null,
  p_cost_lines jsonb default '[]'::jsonb,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_corr uuid := coalesce(p_correlation_id, gen_random_uuid());
  v_confirm jsonb;
  v_cost jsonb;
  v_mode text := upper(coalesce(p_cost_mode,'PROVISIONAL'));
begin
  v_confirm := public.cms_fn_confirm_shipment_v2(
    p_shipment_id,
    p_actor_person_id,
    p_note,
    p_emit_inventory,
    v_corr
  );

  perform public.cms_fn_apply_repair_fee_to_shipment_v1(p_shipment_id, p_note);

  if v_mode <> 'SKIP' then
    v_cost := public.cms_fn_apply_purchase_cost_to_shipment_v1(
      p_shipment_id,
      v_mode,
      p_receipt_id,
      coalesce(p_cost_lines,'[]'::jsonb),
      p_actor_person_id,
      p_note,
      v_corr,
      p_force
    );
  end if;

  perform public.cms_fn_apply_silver_factor_fix_v1(p_shipment_id);

  if v_mode <> 'SKIP' then
    return v_confirm
      || jsonb_build_object('purchase_cost', v_cost, 'correlation_id', v_corr);
  end if;

  return v_confirm
    || jsonb_build_object('correlation_id', v_corr);
end $$;
