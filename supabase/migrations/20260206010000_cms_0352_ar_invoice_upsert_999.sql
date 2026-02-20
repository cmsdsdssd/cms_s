-- supabase/migrations/20260206010000_cms_0352_ar_invoice_upsert_999.sql
-- ADD-ONLY. timestamp MUST be > 20260206000000_...

begin;
create or replace function public.cms_fn_ar_create_from_shipment_confirm_v1(
  p_shipment_id uuid
)
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

  -- 1) UPDATE existing invoices (idempotent upsert)
  with calc as (
    select
      v_hdr.customer_party_id as party_id,
      p_shipment_id as shipment_id,
      sl.shipment_line_id,
      v_hdr.confirmed_at as occurred_at,

      greatest(coalesce(sl.total_amount_sell_krw, 0) - coalesce(sl.material_amount_sell_krw, 0), 0) as labor_cash_due_krw,

      case
        when sl.material_code in ('14','18','24') then 'gold'::cms_e_commodity_type
        when sl.material_code in ('925','999')    then 'silver'::cms_e_commodity_type
        else null
      end as commodity_type,

      case
        when sl.material_code = '14'  then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.6435
        when sl.material_code = '18'  then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.825
        when sl.material_code = '24'  then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0))
        when sl.material_code = '925' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.925
        when sl.material_code = '999' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0))
        else 0
      end as commodity_due_g,

      case
        when sl.material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
        when sl.material_code in ('925','999')    then coalesce(v_valuation.silver_krw_per_g_snapshot, 0) * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
        else 0
      end as commodity_price_snapshot_krw_per_g,

      (
        case
          when sl.material_code = '14'  then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.6435
          when sl.material_code = '18'  then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.825
          when sl.material_code = '24'  then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0))
          when sl.material_code = '925' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.925
          when sl.material_code = '999' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0))
          else 0
        end
        *
        case
          when sl.material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
          when sl.material_code in ('925','999')    then coalesce(v_valuation.silver_krw_per_g_snapshot, 0) * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
          else 0
        end
      ) as material_cash_due_krw,

      (
        greatest(coalesce(sl.total_amount_sell_krw, 0) - coalesce(sl.material_amount_sell_krw, 0), 0)
        +
        (
          case
            when sl.material_code = '14'  then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.6435
            when sl.material_code = '18'  then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.825
            when sl.material_code = '24'  then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0))
            when sl.material_code = '925' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.925
            when sl.material_code = '999' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0))
            else 0
          end
          *
          case
            when sl.material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
            when sl.material_code in ('925','999')    then coalesce(v_valuation.silver_krw_per_g_snapshot, 0) * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
            else 0
          end
        )
      ) as total_cash_due_krw
    from public.cms_shipment_line sl
    where sl.shipment_id = p_shipment_id
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
    from calc c
    where ai.shipment_line_id = c.shipment_line_id
    returning 1
  )
  select count(*) into v_updated from upd;

  -- 2) INSERT missing invoices only (same predicate style as original)
  insert into public.cms_ar_invoice(
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
  from (
    select
      v_hdr.customer_party_id as party_id,
      p_shipment_id as shipment_id,
      sl.shipment_line_id,
      v_hdr.confirmed_at as occurred_at,

      greatest(coalesce(sl.total_amount_sell_krw, 0) - coalesce(sl.material_amount_sell_krw, 0), 0) as labor_cash_due_krw,

      case
        when sl.material_code in ('14','18','24') then 'gold'::cms_e_commodity_type
        when sl.material_code in ('925','999')    then 'silver'::cms_e_commodity_type
        else null
      end as commodity_type,

      case
        when sl.material_code = '14'  then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.6435
        when sl.material_code = '18'  then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.825
        when sl.material_code = '24'  then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0))
        when sl.material_code = '925' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.925
        when sl.material_code = '999' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0))
        else 0
      end as commodity_due_g,

      case
        when sl.material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
        when sl.material_code in ('925','999')    then coalesce(v_valuation.silver_krw_per_g_snapshot, 0) * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
        else 0
      end as commodity_price_snapshot_krw_per_g,

      (
        case
          when sl.material_code = '14'  then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.6435
          when sl.material_code = '18'  then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.825
          when sl.material_code = '24'  then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0))
          when sl.material_code = '925' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.925
          when sl.material_code = '999' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0))
          else 0
        end
        *
        case
          when sl.material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
          when sl.material_code in ('925','999')    then coalesce(v_valuation.silver_krw_per_g_snapshot, 0) * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
          else 0
        end
      ) as material_cash_due_krw,

      (
        greatest(coalesce(sl.total_amount_sell_krw, 0) - coalesce(sl.material_amount_sell_krw, 0), 0)
        +
        (
          case
            when sl.material_code = '14'  then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.6435
            when sl.material_code = '18'  then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.825
            when sl.material_code = '24'  then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0))
            when sl.material_code = '925' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.925
            when sl.material_code = '999' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0))
            else 0
          end
          *
          case
            when sl.material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
            when sl.material_code in ('925','999')    then coalesce(v_valuation.silver_krw_per_g_snapshot, 0) * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
            else 0
          end
        )
      ) as total_cash_due_krw
    from public.cms_shipment_line sl
    where sl.shipment_id = p_shipment_id
  ) c
  where not exists (
    select 1 from public.cms_ar_invoice ai
    where ai.shipment_line_id = c.shipment_line_id
  );

  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'updated', v_updated,
    'inserted', v_inserted
  );
end $$;
alter function public.cms_fn_ar_create_from_shipment_confirm_v1(uuid)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_ar_create_from_shipment_confirm_v1(uuid) to authenticated;
grant execute on function public.cms_fn_ar_create_from_shipment_confirm_v1(uuid) to service_role;
commit;
