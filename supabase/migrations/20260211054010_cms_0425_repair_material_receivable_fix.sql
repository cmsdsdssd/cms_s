-- Fix: repair lines with additional material must create commodity/material receivable
-- and include purity (gold/silver) + silver adjust factor in commodity due grams.

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
      case
        when coalesce(v_valuation.silver_adjust_factor_snapshot, 1) > 0
          then coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
        else 1
      end as silver_adj
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
      case
        when repair_line_id is not null then repair_fee_sell_krw
        when is_unit_pricing then total_sell_krw
        else greatest(total_sell_krw - material_amount_sell_krw, 0)
      end as labor_cash_due_krw,
      case
        when is_unit_pricing then null
        when material_code in ('14','18','24') then 'gold'::cms_e_commodity_type
        when material_code in ('925','999') then 'silver'::cms_e_commodity_type
        else null
      end as commodity_type,
      case
        when is_unit_pricing then 0
        when material_code = '14' then net_w * 0.6435
        when material_code = '18' then net_w * 0.825
        when material_code = '24' then net_w
        when material_code = '925' then net_w * 0.925 * silver_adj
        when material_code = '999' then net_w * silver_adj
        else 0
      end as commodity_due_g,
      case
        when is_unit_pricing then 0
        when material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
        when material_code in ('925','999') then coalesce(v_valuation.silver_krw_per_g_snapshot, 0)
        else 0
      end as commodity_price_snapshot_krw_per_g,
      case
        when is_unit_pricing then 0
        else
          (
            case
              when material_code = '14' then net_w * 0.6435
              when material_code = '18' then net_w * 0.825
              when material_code = '24' then net_w
              when material_code = '925' then net_w * 0.925 * silver_adj
              when material_code = '999' then net_w * silver_adj
              else 0
            end
          )
          *
          (
            case
              when material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
              when material_code in ('925','999') then coalesce(v_valuation.silver_krw_per_g_snapshot, 0)
              else 0
            end
          )
      end as material_cash_due_krw,
      case
        when repair_line_id is not null then
          repair_fee_sell_krw +
          (
            (
              case
                when material_code = '14' then net_w * 0.6435
                when material_code = '18' then net_w * 0.825
                when material_code = '24' then net_w
                when material_code = '925' then net_w * 0.925 * silver_adj
                when material_code = '999' then net_w * silver_adj
                else 0
              end
            )
            *
            (
              case
                when material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
                when material_code in ('925','999') then coalesce(v_valuation.silver_krw_per_g_snapshot, 0)
                else 0
              end
            )
          )
        when is_unit_pricing then total_sell_krw
        else
          greatest(total_sell_krw - material_amount_sell_krw, 0)
          +
          (
            (
              case
                when material_code = '14' then net_w * 0.6435
                when material_code = '18' then net_w * 0.825
                when material_code = '24' then net_w
                when material_code = '925' then net_w * 0.925 * silver_adj
                when material_code = '999' then net_w * silver_adj
                else 0
              end
            )
            *
            (
              case
                when material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
                when material_code in ('925','999') then coalesce(v_valuation.silver_krw_per_g_snapshot, 0)
                else 0
              end
            )
          )
      end as total_cash_due_krw
    from line_base
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
    from calc c
    where not exists (
      select 1 from public.cms_ar_invoice ai
      where ai.shipment_line_id = c.shipment_line_id
    )
    returning 1
  )
  select
    (select count(*) from upd),
    (select count(*) from ins)
  into v_updated, v_inserted;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'updated', v_updated,
    'inserted', v_inserted
  );
end $$;

-- Safe backfill for existing repair invoices (no alloc, no returns)
-- so previously zeroed material/commodity due can be corrected.
with calc as (
  select
    ai.ar_id,
    greatest(coalesce(sl.repair_fee_krw, 0), 0) as labor_cash_due_krw,
    case
      when x.material_code in ('14','18','24') then 'gold'::cms_e_commodity_type
      when x.material_code in ('925','999') then 'silver'::cms_e_commodity_type
      else null
    end as commodity_type,
    case
      when x.material_code = '14' then x.net_w * 0.6435
      when x.material_code = '18' then x.net_w * 0.825
      when x.material_code = '24' then x.net_w
      when x.material_code = '925' then x.net_w * 0.925 * x.silver_adj
      when x.material_code = '999' then x.net_w * x.silver_adj
      else 0
    end as commodity_due_g,
    case
      when x.material_code in ('14','18','24') then coalesce(v.gold_krw_per_g_snapshot, 0)
      when x.material_code in ('925','999') then coalesce(v.silver_krw_per_g_snapshot, 0)
      else 0
    end as commodity_price_snapshot_krw_per_g,
    (
      (
        case
          when x.material_code = '14' then x.net_w * 0.6435
          when x.material_code = '18' then x.net_w * 0.825
          when x.material_code = '24' then x.net_w
          when x.material_code = '925' then x.net_w * 0.925 * x.silver_adj
          when x.material_code = '999' then x.net_w * x.silver_adj
          else 0
        end
      )
      *
      (
        case
          when x.material_code in ('14','18','24') then coalesce(v.gold_krw_per_g_snapshot, 0)
          when x.material_code in ('925','999') then coalesce(v.silver_krw_per_g_snapshot, 0)
          else 0
        end
      )
    ) as material_cash_due_krw
  from public.cms_ar_invoice ai
  join public.cms_shipment_line sl on sl.shipment_line_id = ai.shipment_line_id
  join public.cms_shipment_header sh on sh.shipment_id = sl.shipment_id
  join public.cms_shipment_valuation v on v.shipment_id = sh.shipment_id
  cross join lateral (
    select
      coalesce(
        sl.net_weight_g,
        greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)
      ) as net_w,
      case
        when coalesce(v.silver_adjust_factor_snapshot, 1) > 0 then coalesce(v.silver_adjust_factor_snapshot, 1)
        else 1
      end as silver_adj,
      sl.material_code
  ) x
  where sl.repair_line_id is not null
    and not exists (
      select 1 from public.cms_ar_payment_alloc pa where pa.ar_id = ai.ar_id
    )
    and not exists (
      select 1 from public.cms_return_line rl where rl.shipment_line_id = sl.shipment_line_id
    )
)
update public.cms_ar_invoice ai
set
  labor_cash_due_krw = c.labor_cash_due_krw,
  commodity_type = c.commodity_type,
  commodity_due_g = c.commodity_due_g,
  commodity_price_snapshot_krw_per_g = c.commodity_price_snapshot_krw_per_g,
  material_cash_due_krw = c.material_cash_due_krw,
  total_cash_due_krw = c.labor_cash_due_krw + c.material_cash_due_krw
from calc c
where ai.ar_id = c.ar_id
  and (
    ai.labor_cash_due_krw is distinct from c.labor_cash_due_krw
    or ai.commodity_type is distinct from c.commodity_type
    or ai.commodity_due_g is distinct from c.commodity_due_g
    or ai.commodity_price_snapshot_krw_per_g is distinct from c.commodity_price_snapshot_krw_per_g
    or ai.material_cash_due_krw is distinct from c.material_cash_due_krw
    or ai.total_cash_due_krw is distinct from (c.labor_cash_due_krw + c.material_cash_due_krw)
  );
