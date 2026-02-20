create or replace view public.cms_v_ar_invoice_position_v1
with (security_invoker = true)
as
with alloc as (
  select
    cms_ar_payment_alloc.ar_id,
    coalesce(sum(cms_ar_payment_alloc.alloc_cash_krw), 0::numeric) as alloc_cash_krw,
    coalesce(sum(cms_ar_payment_alloc.alloc_gold_g), 0::numeric) as alloc_gold_g,
    coalesce(sum(cms_ar_payment_alloc.alloc_silver_g), 0::numeric) as alloc_silver_g,
    coalesce(sum(cms_ar_payment_alloc.alloc_value_krw), 0::numeric) as alloc_value_krw,
    coalesce(sum(cms_ar_payment_alloc.alloc_labor_krw), 0::numeric) as alloc_labor_krw,
    coalesce(sum(cms_ar_payment_alloc.alloc_material_krw), 0::numeric) as alloc_material_krw
  from cms_ar_payment_alloc
  group by cms_ar_payment_alloc.ar_id
), returns as (
  select
    cms_return_line.shipment_line_id,
    coalesce(sum(cms_return_line.final_return_amount_krw), 0::numeric) as return_amount_krw
  from cms_return_line
  group by cms_return_line.shipment_line_id
)
select
  i.ar_id,
  i.party_id,
  i.shipment_id,
  i.shipment_line_id,
  i.occurred_at,
  i.labor_cash_due_krw,
  i.commodity_type,
  i.commodity_due_g,
  i.commodity_price_snapshot_krw_per_g,
  i.material_cash_due_krw,
  i.total_cash_due_krw,
  i.created_at,
  sl.model_name,
  sl.suffix,
  sl.color,
  sl.size,
  sl.qty,
  coalesce(a.alloc_cash_krw, 0::numeric) as alloc_cash_krw,
  coalesce(a.alloc_gold_g, 0::numeric) as alloc_gold_g,
  coalesce(a.alloc_silver_g, 0::numeric) as alloc_silver_g,
  coalesce(a.alloc_value_krw, 0::numeric) as alloc_value_krw,
  coalesce(r.return_amount_krw, 0::numeric) as return_amount_krw,
  case
    when coalesce(i.total_cash_due_krw, 0::numeric) > 0::numeric then
      coalesce(r.return_amount_krw, 0::numeric) * (coalesce(i.labor_cash_due_krw, 0::numeric) / i.total_cash_due_krw)
    else 0::numeric
  end as labor_return_krw,
  case
    when coalesce(i.total_cash_due_krw, 0::numeric) > 0::numeric then
      coalesce(r.return_amount_krw, 0::numeric) * (coalesce(i.material_cash_due_krw, 0::numeric) / i.total_cash_due_krw)
    else 0::numeric
  end as material_return_krw,
  case
    when coalesce(i.commodity_price_snapshot_krw_per_g, 0::numeric) > 0::numeric then
      case
        when coalesce(i.total_cash_due_krw, 0::numeric) > 0::numeric then
          coalesce(r.return_amount_krw, 0::numeric) * (coalesce(i.material_cash_due_krw, 0::numeric) / i.total_cash_due_krw)
        else 0::numeric
      end / i.commodity_price_snapshot_krw_per_g
    else 0::numeric
  end as return_commodity_g,
  greatest(
    coalesce(i.labor_cash_due_krw, 0::numeric) - coalesce(a.alloc_labor_krw, 0::numeric)
    - case
        when coalesce(i.total_cash_due_krw, 0::numeric) > 0::numeric then
          coalesce(r.return_amount_krw, 0::numeric) * (coalesce(i.labor_cash_due_krw, 0::numeric) / i.total_cash_due_krw)
        else 0::numeric
      end,
    0::numeric
  ) as labor_cash_outstanding_krw,
  greatest(
    coalesce(i.material_cash_due_krw, 0::numeric) - coalesce(a.alloc_material_krw, 0::numeric)
    - case
        when coalesce(i.total_cash_due_krw, 0::numeric) > 0::numeric then
          coalesce(r.return_amount_krw, 0::numeric) * (coalesce(i.material_cash_due_krw, 0::numeric) / i.total_cash_due_krw)
        else 0::numeric
      end,
    0::numeric
  ) as material_cash_outstanding_krw,
  case
    when i.commodity_type = 'gold'::cms_e_commodity_type then
      greatest(
        coalesce(i.commodity_due_g, 0::numeric) - coalesce(a.alloc_gold_g, 0::numeric)
        - case
            when coalesce(i.commodity_price_snapshot_krw_per_g, 0::numeric) > 0::numeric then
              case
                when coalesce(i.total_cash_due_krw, 0::numeric) > 0::numeric then
                  coalesce(r.return_amount_krw, 0::numeric) * (coalesce(i.material_cash_due_krw, 0::numeric) / i.total_cash_due_krw)
                else 0::numeric
              end / i.commodity_price_snapshot_krw_per_g
            else 0::numeric
          end,
        0::numeric
      )
    when i.commodity_type = 'silver'::cms_e_commodity_type then
      greatest(
        coalesce(i.commodity_due_g, 0::numeric) - coalesce(a.alloc_silver_g, 0::numeric)
        - case
            when coalesce(i.commodity_price_snapshot_krw_per_g, 0::numeric) > 0::numeric then
              case
                when coalesce(i.total_cash_due_krw, 0::numeric) > 0::numeric then
                  coalesce(r.return_amount_krw, 0::numeric) * (coalesce(i.material_cash_due_krw, 0::numeric) / i.total_cash_due_krw)
                else 0::numeric
              end / i.commodity_price_snapshot_krw_per_g
            else 0::numeric
          end,
        0::numeric
      )
    else 0::numeric
  end as commodity_outstanding_g,
  greatest(
    coalesce(i.labor_cash_due_krw, 0::numeric) - coalesce(a.alloc_labor_krw, 0::numeric)
    - case
        when coalesce(i.total_cash_due_krw, 0::numeric) > 0::numeric then
          coalesce(r.return_amount_krw, 0::numeric) * (coalesce(i.labor_cash_due_krw, 0::numeric) / i.total_cash_due_krw)
        else 0::numeric
      end,
    0::numeric
  )
  + greatest(
    coalesce(i.material_cash_due_krw, 0::numeric) - coalesce(a.alloc_material_krw, 0::numeric)
    - case
        when coalesce(i.total_cash_due_krw, 0::numeric) > 0::numeric then
          coalesce(r.return_amount_krw, 0::numeric) * (coalesce(i.material_cash_due_krw, 0::numeric) / i.total_cash_due_krw)
        else 0::numeric
      end,
    0::numeric
  ) as total_cash_outstanding_krw,
  sl.material_code
from cms_ar_invoice i
left join alloc a on a.ar_id = i.ar_id
left join returns r on r.shipment_line_id = i.shipment_line_id
left join cms_shipment_line sl on sl.shipment_line_id = i.shipment_line_id;
grant select on public.cms_v_ar_invoice_position_v1 to authenticated;
grant select on public.cms_v_ar_invoice_position_v1 to anon;
