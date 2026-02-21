-- cms_0709: safe immediate-lock finalize (add-only)
-- Overrides 0708 behavior to avoid confirm-chain collisions.

begin;

alter table public.cms_shipment_header
  add column if not exists ar_principal_locked_at timestamptz;

update public.cms_shipment_header
set ar_principal_locked_at = coalesce(ar_principal_locked_at, confirmed_at)
where confirmed_at is not null
  and ar_principal_locked_at is null;

create or replace function public.cms_fn_sync_ar_ledger_from_shipment_v1(
  p_shipment_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hdr public.cms_shipment_header%rowtype;
  v_total_sell numeric := 0;
  v_total_weight numeric := 0;
  v_total_labor numeric := 0;
  v_affected int := 0;
  v_existing_amount numeric := 0;
  v_existing_weight numeric := 0;
  v_existing_labor numeric := 0;
begin
  select * into v_hdr
  from public.cms_shipment_header
  where shipment_id = p_shipment_id;

  if not found then
    raise exception 'shipment not found: %', p_shipment_id;
  end if;

  select
    coalesce(sum(total_amount_sell_krw), 0),
    coalesce(sum(net_weight_g), 0),
    coalesce(sum(labor_total_sell_krw), 0)
  into v_total_sell, v_total_weight, v_total_labor
  from public.cms_shipment_line
  where shipment_id = p_shipment_id;

  if v_hdr.ar_principal_locked_at is not null then
    select
      coalesce(l.amount_krw, 0),
      coalesce(l.total_weight_g, 0),
      coalesce(l.total_labor_krw, 0)
    into v_existing_amount, v_existing_weight, v_existing_labor
    from public.cms_ar_ledger l
    where l.entry_type = 'SHIPMENT'
      and l.shipment_id = p_shipment_id
    limit 1;

    if found then
      if abs(v_existing_amount - v_total_sell) > 0.000001
        or abs(v_existing_weight - v_total_weight) > 0.000001
        or abs(v_existing_labor - v_total_labor) > 0.000001 then
        raise exception 'shipment ledger immutable after lock (shipment_id=%)', p_shipment_id;
      end if;

      return jsonb_build_object(
        'ok', true,
        'shipment_id', p_shipment_id,
        'ledger_total_krw', v_existing_amount,
        'locked_after_confirm', true
      );
    end if;

    insert into public.cms_ar_ledger(
      party_id,
      occurred_at,
      entry_type,
      amount_krw,
      shipment_id,
      memo,
      total_weight_g,
      total_labor_krw
    )
    values (
      v_hdr.customer_party_id,
      coalesce(v_hdr.confirmed_at, now()),
      'SHIPMENT',
      v_total_sell,
      p_shipment_id,
      p_note,
      v_total_weight,
      v_total_labor
    );

    return jsonb_build_object(
      'ok', true,
      'shipment_id', p_shipment_id,
      'ledger_total_krw', v_total_sell,
      'locked_after_confirm', true
    );
  end if;

  update public.cms_ar_ledger
  set
    amount_krw = v_total_sell,
    total_weight_g = v_total_weight,
    total_labor_krw = v_total_labor,
    memo = coalesce(p_note, memo)
  where entry_type = 'SHIPMENT'
    and shipment_id = p_shipment_id;

  get diagnostics v_affected = row_count;

  if v_affected = 0 then
    insert into public.cms_ar_ledger(
      party_id,
      occurred_at,
      entry_type,
      amount_krw,
      shipment_id,
      memo,
      total_weight_g,
      total_labor_krw
    )
    values (
      v_hdr.customer_party_id,
      coalesce(v_hdr.confirmed_at, now()),
      'SHIPMENT',
      v_total_sell,
      p_shipment_id,
      p_note,
      v_total_weight,
      v_total_labor
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'ledger_total_krw', v_total_sell,
    'locked_after_confirm', false
  );
end;
$$;

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
  v_has_allocated_payment boolean := false;
  v_locked boolean := false;
begin
  select exists (
    select 1
    from public.cms_ar_invoice ai
    join public.cms_ar_payment_alloc pa on pa.ar_id = ai.ar_id
    where ai.shipment_id = p_shipment_id
  ) into v_has_allocated_payment;

  if v_has_allocated_payment then
    raise exception 'cannot re-apply material factor snapshot after payment allocation (shipment_id=%)', p_shipment_id;
  end if;

  select (ar_principal_locked_at is not null) into v_locked
  from public.cms_shipment_header
  where shipment_id = p_shipment_id;

  if coalesce(v_locked, false) then
    raise exception 'cannot re-apply material factor snapshot after shipment lock (shipment_id=%)', p_shipment_id;
  end if;

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
  v_paid_alloc_count int := 0;
  v_locked boolean := false;
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

  v_locked := v_hdr.ar_principal_locked_at is not null;

  select count(*) into v_paid_alloc_count
  from public.cms_ar_invoice ai
  join public.cms_ar_payment_alloc pa on pa.ar_id = ai.ar_id
  where ai.shipment_id = p_shipment_id;

  if v_paid_alloc_count > 0 then
    raise exception 'cannot resync AR invoice after payment allocation (shipment_id=%)', p_shipment_id;
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
      coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) as net_w,
      coalesce(sl.price_basis_snapshot,
        case
          when sl.material_code in ('14','18','24') then 'GOLD'
          when sl.material_code in ('925','999') then 'SILVER'
          else 'NONE'
        end
      ) as price_basis,
      coalesce(
        sl.effective_factor_snapshot,
        coalesce(sl.purity_rate_snapshot, 0) * coalesce(sl.material_adjust_factor_snapshot, sl.gold_adjust_factor_snapshot, 1)
      ) as effective_factor
    from public.cms_shipment_line sl
    left join public.cms_master_item mi1 on mi1.master_id = sl.master_id
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
      case when c.is_unit_pricing then 0 else c.commodity_due_g * c.commodity_price_snapshot_krw_per_g end as material_cash_due_krw,
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
      and not v_locked
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

  if v_locked and v_updated > 0 then
    raise exception 'cannot resync AR invoice after shipment lock (shipment_id=%)', p_shipment_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'updated', v_updated,
    'inserted', v_inserted,
    'locked_after_confirm', v_locked
  );
end $$;

create or replace function public.cms_fn_shipment_update_line_v1(
  p_shipment_line_id uuid,
  p_measured_weight_g numeric default null,
  p_deduction_weight_g numeric default null,
  p_base_labor_krw numeric default null,
  p_extra_labor_krw numeric default null,
  p_extra_labor_items jsonb default null,
  p_pricing_mode cms_e_pricing_mode default null,
  p_manual_total_amount_krw numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line public.cms_shipment_line%rowtype;
  v_hdr public.cms_shipment_header%rowtype;
  v_measured numeric;
  v_deduct numeric;
  v_net numeric;
  v_base_labor numeric;
  v_extra_labor numeric;
  v_total_labor numeric;
  v_pricing_mode public.cms_e_pricing_mode;
  v_manual_total numeric;
begin
  if p_shipment_line_id is null then raise exception 'shipment_line_id required'; end if;
  if p_deduction_weight_g is not null and p_deduction_weight_g < 0 then raise exception 'deduction_weight_g must be >= 0'; end if;
  if p_base_labor_krw is not null and p_base_labor_krw < 0 then raise exception 'base_labor_krw must be >= 0'; end if;
  if p_extra_labor_krw is not null and p_extra_labor_krw < 0 then raise exception 'extra_labor_krw must be >= 0'; end if;
  if p_manual_total_amount_krw is not null and p_manual_total_amount_krw < 0 then raise exception 'manual_total_amount_krw must be >= 0'; end if;

  select * into v_line
  from public.cms_shipment_line
  where shipment_line_id = p_shipment_line_id
  for update;

  if not found then
    raise exception 'shipment_line not found: %', p_shipment_line_id;
  end if;

  select * into v_hdr
  from public.cms_shipment_header
  where shipment_id = v_line.shipment_id
  for update;

  if v_hdr.confirmed_at is not null
    or v_hdr.status = 'CONFIRMED'::public.cms_e_shipment_status
    or v_hdr.ar_principal_locked_at is not null then
    raise exception 'shipment is confirmed; line update locked (shipment_id=%)', v_line.shipment_id;
  end if;

  if p_measured_weight_g is not null and p_measured_weight_g <= 0
     and coalesce(v_line.material_code::text, '') <> '00' then
    raise exception 'measured_weight_g must be > 0';
  end if;

  v_measured := coalesce(p_measured_weight_g, v_line.measured_weight_g);
  v_deduct := coalesce(p_deduction_weight_g, v_line.deduction_weight_g, 0);
  if v_measured is not null and v_deduct > v_measured then
    raise exception 'deduction_weight_g cannot exceed measured_weight_g';
  end if;

  v_net := case when v_measured is null then null else greatest(v_measured - v_deduct, 0) end;
  v_base_labor := coalesce(p_base_labor_krw, v_line.base_labor_krw, 0);
  v_extra_labor := coalesce(p_extra_labor_krw, v_line.extra_labor_krw, 0);
  v_total_labor := v_base_labor + v_extra_labor;
  v_pricing_mode := coalesce(p_pricing_mode, v_line.pricing_mode, 'RULE'::public.cms_e_pricing_mode);

  if v_pricing_mode::text in ('AMOUNT_ONLY', 'MANUAL') then
    v_manual_total := coalesce(
      p_manual_total_amount_krw,
      v_line.manual_total_amount_krw,
      coalesce(v_line.material_amount_sell_krw, 0) + v_total_labor
    );
  else
    v_manual_total := null;
  end if;

  update public.cms_shipment_line
  set measured_weight_g = v_measured,
      deduction_weight_g = v_deduct,
      net_weight_g = v_net,
      manual_labor_krw = v_total_labor,
      base_labor_krw = v_base_labor,
      extra_labor_krw = v_extra_labor,
      extra_labor_items = coalesce(p_extra_labor_items, v_line.extra_labor_items, '[]'::jsonb),
      pricing_mode = v_pricing_mode,
      manual_total_amount_krw = v_manual_total,
      labor_total_sell_krw = v_total_labor,
      total_amount_sell_krw = case
        when v_pricing_mode::text in ('AMOUNT_ONLY', 'MANUAL')
          then coalesce(v_manual_total, coalesce(v_line.material_amount_sell_krw, 0) + v_total_labor)
        else coalesce(v_line.material_amount_sell_krw, 0) + v_total_labor
      end,
      updated_at = now()
  where shipment_line_id = p_shipment_line_id;

  return jsonb_build_object('ok', true, 'shipment_line_id', p_shipment_line_id);
end $$;

create or replace function public.cms_fn_update_shipment_line_v1(
  p_shipment_line_id uuid,
  p_measured_weight_g numeric default null,
  p_deduction_weight_g numeric default null,
  p_base_labor_krw numeric default null,
  p_extra_labor_krw numeric default null,
  p_extra_labor_items jsonb default null,
  p_pricing_mode cms_e_pricing_mode default null,
  p_manual_total_amount_krw numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.cms_fn_shipment_update_line_v1(
    p_shipment_line_id,
    p_measured_weight_g,
    p_deduction_weight_g,
    p_base_labor_krw,
    p_extra_labor_krw,
    p_extra_labor_items,
    p_pricing_mode,
    p_manual_total_amount_krw
  );
end $$;

create or replace function public.cms_fn_unconfirm_shipment_v1(
  p_shipment_id uuid,
  p_reason text,
  p_actor_person_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  raise exception 'unconfirm is disabled by policy: shipment principal is immutable after confirm (shipment_id=%)', p_shipment_id;
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
  v_emit uuid;
  v_already_confirmed_at timestamptz;
begin
  select confirmed_at
    into v_already_confirmed_at
  from public.cms_shipment_header
  where shipment_id = p_shipment_id;

  if v_already_confirmed_at is not null and not coalesce(p_force, false) then
    raise exception using
      errcode = 'P0001',
      message = format('shipment already confirmed: %s (forward-only guard; use p_force=true to override)', p_shipment_id);
  end if;

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

  begin
    perform public.cms_fn_apply_unit_pricing_floor_v1(p_shipment_id, p_actor_person_id, p_note);
  exception when undefined_function then
    null;
  end;

  perform public.cms_fn_apply_rule_rounding_by_master_unit_pricing_v1(p_shipment_id, p_actor_person_id, p_note);
  perform public.cms_fn_sync_repair_line_sell_totals_v1(p_shipment_id, p_note);
  perform public.cms_fn_sync_ar_ledger_from_shipment_v1(p_shipment_id, p_note);
  perform public.cms_fn_verify_shipment_ar_consistency_v1(p_shipment_id);
  perform public.cms_fn_ar_create_from_shipment_confirm_v1(p_shipment_id);

  update public.cms_shipment_header
  set ar_principal_locked_at = coalesce(ar_principal_locked_at, now())
  where shipment_id = p_shipment_id;

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
    return v_confirm || jsonb_build_object('purchase_cost', v_cost, 'correlation_id', v_corr, 'ar_principal_locked', true);
  end if;

  return v_confirm || jsonb_build_object('correlation_id', v_corr, 'ar_principal_locked', true);
end $$;

commit;
