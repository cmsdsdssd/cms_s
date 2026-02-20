-- Ensure repair shipment lines contribute only repair_fee_krw to AR labor due.
-- Add-only migration: replaces AR create function and performs a safe idempotent backfill
-- only for invoices without payment allocations and without return lines.

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

  -- 1) UPDATE existing invoices (idempotent upsert)
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
      ) as net_w
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

      -- 수리 라인은 수리비만 공임 미수로 반영
      case
        when repair_line_id is not null then repair_fee_sell_krw
        when is_unit_pricing then total_sell_krw
        else greatest(total_sell_krw - material_amount_sell_krw, 0)
      end as labor_cash_due_krw,

      case
        when repair_line_id is not null then null
        when is_unit_pricing then null
        when material_code in ('14','18','24') then 'gold'::cms_e_commodity_type
        when material_code in ('925','999') then 'silver'::cms_e_commodity_type
        else null
      end as commodity_type,

      case
        when repair_line_id is not null then 0
        when is_unit_pricing then 0
        when material_code = '14' then net_w * 0.6435
        when material_code = '18' then net_w * 0.825
        when material_code = '24' then net_w
        when material_code = '925' then net_w * 0.925
        when material_code = '999' then net_w
        else 0
      end as commodity_due_g,

      case
        when repair_line_id is not null then 0
        when is_unit_pricing then 0
        when material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
        when material_code in ('925','999') then coalesce(v_valuation.silver_krw_per_g_snapshot, 0) * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
        else 0
      end as commodity_price_snapshot_krw_per_g,

      case
        when repair_line_id is not null then 0
        when is_unit_pricing then 0
        else
          (
            case
              when material_code = '14' then net_w * 0.6435
              when material_code = '18' then net_w * 0.825
              when material_code = '24' then net_w
              when material_code = '925' then net_w * 0.925
              when material_code = '999' then net_w
              else 0
            end
          )
          *
          (
            case
              when material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
              when material_code in ('925','999') then coalesce(v_valuation.silver_krw_per_g_snapshot, 0) * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
              else 0
            end
          )
      end as material_cash_due_krw,

      case
        when repair_line_id is not null then repair_fee_sell_krw
        when is_unit_pricing then total_sell_krw
        else
          (
            greatest(total_sell_krw - material_amount_sell_krw, 0)
            +
            (
              (
                case
                  when material_code = '14' then net_w * 0.6435
                  when material_code = '18' then net_w * 0.825
                  when material_code = '24' then net_w
                  when material_code = '925' then net_w * 0.925
                  when material_code = '999' then net_w
                  else 0
                end
              )
              *
              (
                case
                  when material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
                  when material_code in ('925','999') then coalesce(v_valuation.silver_krw_per_g_snapshot, 0) * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
                  else 0
                end
              )
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
  )
  select count(*) into v_updated from upd;

  -- 2) INSERT missing invoices
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
      ) as net_w
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
        when repair_line_id is not null then null
        when is_unit_pricing then null
        when material_code in ('14','18','24') then 'gold'::cms_e_commodity_type
        when material_code in ('925','999') then 'silver'::cms_e_commodity_type
        else null
      end as commodity_type,

      case
        when repair_line_id is not null then 0
        when is_unit_pricing then 0
        when material_code = '14' then net_w * 0.6435
        when material_code = '18' then net_w * 0.825
        when material_code = '24' then net_w
        when material_code = '925' then net_w * 0.925
        when material_code = '999' then net_w
        else 0
      end as commodity_due_g,

      case
        when repair_line_id is not null then 0
        when is_unit_pricing then 0
        when material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
        when material_code in ('925','999') then coalesce(v_valuation.silver_krw_per_g_snapshot, 0) * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
        else 0
      end as commodity_price_snapshot_krw_per_g,

      case
        when repair_line_id is not null then 0
        when is_unit_pricing then 0
        else
          (
            case
              when material_code = '14' then net_w * 0.6435
              when material_code = '18' then net_w * 0.825
              when material_code = '24' then net_w
              when material_code = '925' then net_w * 0.925
              when material_code = '999' then net_w
              else 0
            end
          )
          *
          (
            case
              when material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
              when material_code in ('925','999') then coalesce(v_valuation.silver_krw_per_g_snapshot, 0) * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
              else 0
            end
          )
      end as material_cash_due_krw,

      case
        when repair_line_id is not null then repair_fee_sell_krw
        when is_unit_pricing then total_sell_krw
        else
          (
            greatest(total_sell_krw - material_amount_sell_krw, 0)
            +
            (
              (
                case
                  when material_code = '14' then net_w * 0.6435
                  when material_code = '18' then net_w * 0.825
                  when material_code = '24' then net_w
                  when material_code = '925' then net_w * 0.925
                  when material_code = '999' then net_w
                  else 0
                end
              )
              *
              (
                case
                  when material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
                  when material_code in ('925','999') then coalesce(v_valuation.silver_krw_per_g_snapshot, 0) * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
                  else 0
                end
              )
            )
          )
      end as total_cash_due_krw
    from line_base
  )
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
  );

  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'updated', v_updated,
    'inserted', v_inserted
  );
end $$;
-- Safe one-time backfill for existing AR invoices:
-- apply only when invoice has no payment allocations and no return lines.
with target as (
  select
    ai.ar_id,
    ai.shipment_line_id,
    greatest(coalesce(sl.repair_fee_krw, 0), 0) as new_due
  from public.cms_ar_invoice ai
  join public.cms_shipment_line sl
    on sl.shipment_line_id = ai.shipment_line_id
  where sl.repair_line_id is not null
),
safe_target as (
  select t.*
  from target t
  where not exists (
    select 1
    from public.cms_ar_payment_alloc pa
    where pa.ar_id = t.ar_id
  )
    and not exists (
      select 1
      from public.cms_return_line rl
      where rl.shipment_line_id = t.shipment_line_id
    )
)
update public.cms_ar_invoice ai
set
  labor_cash_due_krw = s.new_due,
  commodity_type = null,
  commodity_due_g = 0,
  commodity_price_snapshot_krw_per_g = 0,
  material_cash_due_krw = 0,
  total_cash_due_krw = s.new_due
from safe_target s
where ai.ar_id = s.ar_id
  and (
    ai.labor_cash_due_krw is distinct from s.new_due
    or ai.commodity_type is not null
    or ai.commodity_due_g is distinct from 0
    or ai.commodity_price_snapshot_krw_per_g is distinct from 0
    or ai.material_cash_due_krw is distinct from 0
    or ai.total_cash_due_krw is distinct from s.new_due
  );
