-- cms_0710: immediate-lock hardening (add-only)

begin;

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
  v_existing_count int := 0;
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

  select count(*) into v_existing_count
  from public.cms_ar_invoice ai
  where ai.shipment_id = p_shipment_id;

  select count(*) into v_paid_alloc_count
  from public.cms_ar_invoice ai
  join public.cms_ar_payment_alloc pa on pa.ar_id = ai.ar_id
  where ai.shipment_id = p_shipment_id;

  if v_paid_alloc_count > 0 then
    raise exception 'cannot resync AR invoice after payment allocation (shipment_id=%)', p_shipment_id;
  end if;

  if v_locked and v_existing_count > 0 then
    raise exception 'cannot resync AR invoice after shipment lock (shipment_id=%)', p_shipment_id;
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

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'updated', v_updated,
    'inserted', v_inserted,
    'locked_after_confirm', v_locked
  );
end $$;

create or replace function public.cms_fn_unconfirm_shipment_v2(
  p_shipment_id uuid,
  p_reason text,
  p_correlation_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  raise exception 'unconfirm v2 is disabled by policy: shipment principal is immutable after confirm (shipment_id=%)', p_shipment_id;
end $$;

commit;
