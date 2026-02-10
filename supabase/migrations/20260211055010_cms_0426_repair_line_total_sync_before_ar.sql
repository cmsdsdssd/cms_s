-- Ensure repair lines always carry material into total sell before AR creation.
-- Fixes cases where repair material/weight is updated but total_amount_sell_krw stays 0.

create or replace function public.cms_fn_sync_repair_line_sell_totals_v1(
  p_shipment_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_total_sell numeric := 0;
  v_total_weight numeric := 0;
  v_total_labor numeric := 0;
  v_changed int := 0;
begin
  if p_shipment_id is null then
    raise exception using errcode='P0001', message='shipment_id required';
  end if;

  with calc as (
    select
      sl.shipment_line_id,
      round(
        case
          when sl.material_code in ('14'::public.cms_e_material_code,'18'::public.cms_e_material_code,'24'::public.cms_e_material_code) then
            coalesce(sl.gold_tick_krw_per_g, 0)
            * (case sl.material_code
                when '14'::public.cms_e_material_code then 0.6435
                when '18'::public.cms_e_material_code then 0.825
                when '24'::public.cms_e_material_code then 1.0
                else 0
              end)
            * coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g,0) - coalesce(sl.deduction_weight_g,0), 0))
          when sl.material_code in ('925'::public.cms_e_material_code,'999'::public.cms_e_material_code) then
            coalesce(sl.silver_tick_krw_per_g, 0)
            * (case when sl.material_code = '925'::public.cms_e_material_code then 0.925 else 1.0 end)
            * (case when coalesce(sl.silver_adjust_factor, 1) > 0 then coalesce(sl.silver_adjust_factor, 1) else 1 end)
            * coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g,0) - coalesce(sl.deduction_weight_g,0), 0))
          else 0
        end
      , 0) as material_sell,
      greatest(coalesce(sl.labor_total_sell_krw, 0), 0) as labor_sell,
      greatest(coalesce(sl.plating_amount_sell_krw, 0), 0) as plating_sell
    from public.cms_shipment_line sl
    where sl.shipment_id = p_shipment_id
      and sl.repair_line_id is not null
  ),
  upd as (
    update public.cms_shipment_line sl
    set
      material_amount_sell_krw = c.material_sell,
      total_amount_sell_krw = c.material_sell + c.labor_sell + c.plating_sell,
      price_calc_trace = coalesce(sl.price_calc_trace, '{}'::jsonb)
        || jsonb_build_object('repair_total_synced_at', now())
    from calc c
    where sl.shipment_line_id = c.shipment_line_id
      and (
        coalesce(sl.material_amount_sell_krw,0) is distinct from c.material_sell
        or coalesce(sl.total_amount_sell_krw,0) is distinct from (c.material_sell + c.labor_sell + c.plating_sell)
      )
    returning 1
  )
  select count(*) into v_changed from upd;

  select
    coalesce(sum(sl.total_amount_sell_krw),0),
    coalesce(sum(sl.net_weight_g),0),
    coalesce(sum(sl.labor_total_sell_krw),0)
  into v_total_sell, v_total_weight, v_total_labor
  from public.cms_shipment_line sl
  where sl.shipment_id = p_shipment_id;

  update public.cms_shipment_valuation
  set
    material_value_krw = (
      select coalesce(sum(material_amount_sell_krw),0)
      from public.cms_shipment_line
      where shipment_id = p_shipment_id
    ),
    labor_value_krw = (
      select coalesce(sum(labor_total_sell_krw),0)
      from public.cms_shipment_line
      where shipment_id = p_shipment_id
    ),
    total_value_krw = v_total_sell
  where shipment_id = p_shipment_id;

  update public.cms_ar_ledger
  set
    amount_krw = v_total_sell,
    total_weight_g = v_total_weight,
    total_labor_krw = v_total_labor,
    memo = coalesce(memo, p_note)
  where entry_type = 'SHIPMENT'
    and shipment_id = p_shipment_id;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'changed_lines', v_changed,
    'total_sell_krw', v_total_sell
  );
end $$;

alter function public.cms_fn_sync_repair_line_sell_totals_v1(uuid,text)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_sync_repair_line_sell_totals_v1(uuid,text)
  to authenticated, service_role;


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
  v_emit uuid;
begin
  v_confirm := public.cms_fn_confirm_shipment(p_shipment_id, p_actor_person_id, p_note);

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

  begin
    perform public.cms_fn_apply_unit_pricing_floor_v1(p_shipment_id, p_actor_person_id, p_note);
  exception when undefined_function then
    null;
  end;

  perform public.cms_fn_apply_rule_rounding_by_master_unit_pricing_v1(p_shipment_id, p_actor_person_id, p_note);

  -- Critical sync for repair lines: keep line totals/material in sync before AR upsert.
  perform public.cms_fn_sync_repair_line_sell_totals_v1(p_shipment_id, p_note);

  perform public.cms_fn_ar_create_from_shipment_confirm_v1(p_shipment_id);

  if p_emit_inventory then
    v_emit := public.cms_fn_emit_inventory_issue_from_shipment_confirmed_v2(
      p_shipment_id,
      p_actor_person_id,
      p_note,
      v_corr
    );

    v_confirm := v_confirm
      || jsonb_build_object(
        'inventory_emit', v_emit,
        'inventory_correlation_id', v_corr
      );
  end if;

  if v_mode <> 'SKIP' then
    return v_confirm
      || jsonb_build_object('purchase_cost', v_cost, 'correlation_id', v_corr);
  end if;

  return v_confirm
    || jsonb_build_object('correlation_id', v_corr);
end $$;

alter function public.cms_fn_confirm_shipment_v3_cost_v1(uuid,uuid,text,boolean,uuid,text,uuid,jsonb,boolean)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_confirm_shipment_v3_cost_v1(uuid,uuid,text,boolean,uuid,text,uuid,jsonb,boolean)
  to authenticated, service_role;
