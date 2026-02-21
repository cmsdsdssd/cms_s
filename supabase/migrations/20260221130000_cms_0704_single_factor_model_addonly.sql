-- cms_0704: single-factor model (add-only)
-- Standardize effective_factor = purity_rate * material_adjust_factor

begin;

create or replace function public.cms_fn_apply_material_factor_snapshot_v1(
  p_shipment_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_valuation public.cms_shipment_valuation%rowtype;
  v_total_sell numeric := 0;
  v_changed int := 0;
begin
  select * into v_valuation
  from public.cms_shipment_valuation
  where shipment_id = p_shipment_id;

  with calc as (
    select
      sl.shipment_line_id,
      sl.material_code,
      coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g,0) - coalesce(sl.deduction_weight_g,0), 0)) as net_w,
      coalesce(mf.purity_rate, 0) as purity_rate,
      coalesce(mf.material_adjust_factor, 1) as material_adjust_factor,
      coalesce(mf.price_basis, 'NONE') as price_basis,
      1::numeric as market_adjust_factor,
      case
        when coalesce(mf.price_basis, 'NONE') = 'GOLD' then coalesce(sl.gold_tick_krw_per_g, v_valuation.gold_krw_per_g_snapshot, 0)
        when coalesce(mf.price_basis, 'NONE') = 'SILVER' then coalesce(sl.silver_tick_krw_per_g, v_valuation.silver_krw_per_g_snapshot, 0)
        else 0
      end as tick_price,
      coalesce(sl.labor_total_sell_krw, 0) as labor_sell,
      coalesce(sl.labor_total_cost_krw, 0) as labor_cost,
      coalesce(sl.plating_amount_sell_krw, 0) as plating_sell,
      coalesce(sl.plating_amount_cost_krw, 0) as plating_cost,
      coalesce(sl.repair_fee_krw, 0) as repair_fee
    from public.cms_shipment_line sl
    left join lateral public.cms_fn_get_material_factor_v2(sl.material_code) mf on true
    where sl.shipment_id = p_shipment_id
  ),
  upd as (
    update public.cms_shipment_line sl
    set
      purity_rate_snapshot = c.purity_rate,
      material_adjust_factor_snapshot = c.material_adjust_factor,
      market_adjust_factor_snapshot = c.market_adjust_factor,
      gold_adjust_factor_snapshot = c.material_adjust_factor,
      price_basis_snapshot = c.price_basis,
      effective_factor_snapshot = (c.purity_rate * c.material_adjust_factor),
      material_amount_sell_krw = round(c.net_w * c.tick_price * (c.purity_rate * c.material_adjust_factor), 0),
      material_amount_cost_krw = round(c.net_w * c.tick_price * (c.purity_rate * c.material_adjust_factor), 0),
      total_amount_sell_krw = round(c.net_w * c.tick_price * (c.purity_rate * c.material_adjust_factor), 0)
        + c.labor_sell + c.plating_sell + c.repair_fee,
      total_amount_cost_krw = round(c.net_w * c.tick_price * (c.purity_rate * c.material_adjust_factor), 0)
        + c.labor_cost + c.plating_cost,
      price_calc_trace = coalesce(sl.price_calc_trace, '{}'::jsonb) || jsonb_build_object(
        'material_factor_snapshot_applied_at', now(),
        'material_factor_snapshot_note', p_note,
        'material_factor_price_basis', c.price_basis,
        'single_factor_model', true
      )
    from calc c
    where sl.shipment_line_id = c.shipment_line_id
    returning sl.total_amount_sell_krw
  )
  select coalesce(sum(total_amount_sell_krw), 0), count(*)
  into v_total_sell, v_changed
  from upd;

  update public.cms_shipment_valuation
  set
    material_value_krw = (select coalesce(sum(material_amount_sell_krw), 0) from public.cms_shipment_line where shipment_id = p_shipment_id),
    labor_value_krw = (select coalesce(sum(labor_total_sell_krw), 0) from public.cms_shipment_line where shipment_id = p_shipment_id),
    total_value_krw = (select coalesce(sum(total_amount_sell_krw), 0) from public.cms_shipment_line where shipment_id = p_shipment_id),
    breakdown = coalesce(breakdown, '{}'::jsonb) || jsonb_build_object(
      'material_factor_snapshot_applied', true,
      'single_factor_model', true
    )
  where shipment_id = p_shipment_id;

  perform public.cms_fn_sync_ar_ledger_from_shipment_v1(p_shipment_id, p_note);

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'changed_lines', v_changed,
    'total_sell_krw', (select coalesce(sum(total_amount_sell_krw), 0) from public.cms_shipment_line where shipment_id = p_shipment_id)
  );
end;
$$;

create or replace function public.cms_fn_apply_silver_factor_fix_v1(
  p_shipment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_shipment_id is null then
    raise exception 'shipment_id required';
  end if;

  perform public.cms_fn_apply_material_factor_snapshot_v1(p_shipment_id, 'apply_silver_factor_fix_v1_noop_single_factor');

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'silver_factor_applied', 1,
    'mode', 'noop_single_factor'
  );
end;
$$;

create or replace function public.cms_fn_ar_create_from_shipment_confirm_v1(p_shipment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_hdr public.cms_shipment_header%rowtype;
  v_valuation public.cms_shipment_valuation%rowtype;
  v_inserted int := 0;
  v_updated int := 0;
begin
  select * into v_hdr
  from public.cms_shipment_header
  where shipment_id = p_shipment_id;

  if not found then
    raise exception 'shipment not found: %', p_shipment_id;
  end if;

  if v_hdr.confirmed_at is null then
    raise exception 'shipment not confirmed: %', p_shipment_id;
  end if;

  select * into v_valuation
  from public.cms_shipment_valuation
  where shipment_id = p_shipment_id;

  if not found then
    raise exception 'shipment valuation not found: %', p_shipment_id;
  end if;

  with line_base as (
    select
      v_hdr.customer_party_id as party_id,
      p_shipment_id as shipment_id,
      sl.shipment_line_id,
      sl.repair_line_id,
      v_hdr.confirmed_at as occurred_at,
      coalesce(mi1.is_unit_pricing, mi2.is_unit_pricing, false) as is_unit_pricing,
      greatest(coalesce(sl.total_amount_sell_krw, 0), 0) as total_sell_krw,
      greatest(coalesce(sl.material_amount_sell_krw, 0), 0) as material_amount_sell_krw,
      greatest(coalesce(sl.repair_fee_krw, 0), 0) as repair_fee_sell_krw,
      sl.material_code,
      coalesce(
        sl.net_weight_g,
        greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)
      ) as net_w,
      coalesce(sl.price_basis_snapshot,
        case
          when sl.material_code in ('14','18','24') then 'GOLD'
          when sl.material_code in ('925','999') then 'SILVER'
          else 'NONE'
        end
      ) as price_basis,
      coalesce(
        sl.effective_factor_snapshot,
        coalesce(sl.purity_rate_snapshot, 0)
          * coalesce(sl.material_adjust_factor_snapshot, sl.gold_adjust_factor_snapshot, 1)
      ) as effective_factor
    from public.cms_shipment_line sl
    left join public.cms_master_item mi1
      on mi1.master_id = sl.master_id
    left join public.cms_master_item mi2
      on sl.master_id is null
     and sl.model_name is not null
     and trim(sl.model_name) = mi2.model_name
    where sl.shipment_id = p_shipment_id
  ),
  calc as (
    select
      party_id,
      shipment_id,
      shipment_line_id,
      occurred_at,
      repair_line_id,
      is_unit_pricing,
      total_sell_krw,
      case
        when repair_line_id is not null then repair_fee_sell_krw
        when is_unit_pricing then total_sell_krw
        else greatest(total_sell_krw - material_amount_sell_krw, 0)
      end as labor_cash_due_krw,
      case
        when is_unit_pricing then null
        when price_basis = 'GOLD' then 'gold'::cms_e_commodity_type
        when price_basis = 'SILVER' then 'silver'::cms_e_commodity_type
        else null
      end as commodity_type,
      case
        when is_unit_pricing then 0
        else net_w * coalesce(effective_factor, 0)
      end as commodity_due_g,
      case
        when is_unit_pricing then 0
        when price_basis = 'GOLD' then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
        when price_basis = 'SILVER' then coalesce(v_valuation.silver_krw_per_g_snapshot, 0)
        else 0
      end as commodity_price_snapshot_krw_per_g
    from line_base
  ),
  calc2 as (
    select
      c.*, 
      case
        when c.is_unit_pricing then 0
        else c.commodity_due_g * c.commodity_price_snapshot_krw_per_g
      end as material_cash_due_krw,
      case
        when c.repair_line_id is not null then c.labor_cash_due_krw + (case when c.is_unit_pricing then 0 else c.commodity_due_g * c.commodity_price_snapshot_krw_per_g end)
        when c.is_unit_pricing then c.total_sell_krw
        else c.labor_cash_due_krw + (c.commodity_due_g * c.commodity_price_snapshot_krw_per_g)
      end as total_cash_due_krw
    from calc c
  ),
  upd as (
    update public.cms_ar_invoice ai
    set
      party_id = c.party_id,
      shipment_id = c.shipment_id,
      occurred_at = c.occurred_at,
      labor_cash_due_krw = c.labor_cash_due_krw,
      commodity_type = c.commodity_type,
      commodity_due_g = c.commodity_due_g,
      commodity_price_snapshot_krw_per_g = c.commodity_price_snapshot_krw_per_g,
      material_cash_due_krw = c.material_cash_due_krw,
      total_cash_due_krw = c.total_cash_due_krw
    from calc2 c
    where ai.shipment_line_id = c.shipment_line_id
    returning 1
  ),
  ins as (
    insert into public.cms_ar_invoice (
      party_id,
      shipment_id,
      shipment_line_id,
      occurred_at,
      labor_cash_due_krw,
      commodity_type,
      commodity_due_g,
      commodity_price_snapshot_krw_per_g,
      material_cash_due_krw,
      total_cash_due_krw
    )
    select
      c.party_id,
      c.shipment_id,
      c.shipment_line_id,
      c.occurred_at,
      c.labor_cash_due_krw,
      c.commodity_type,
      c.commodity_due_g,
      c.commodity_price_snapshot_krw_per_g,
      c.material_cash_due_krw,
      c.total_cash_due_krw
    from calc2 c
    where not exists (
      select 1 from public.cms_ar_invoice ai
      where ai.shipment_line_id = c.shipment_line_id
    )
    returning 1
  )
  select (select count(*) from upd), (select count(*) from ins)
  into v_updated, v_inserted;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'updated', v_updated,
    'inserted', v_inserted
  );
end $$;

commit;
