set search_path = public, pg_temp;

-- Normalize historical fractional KRW values in shipment extra labor JSON.
-- Keep unit_* fields untouched; only total KRW fields are rounded.

with shipment_items as (
  select
    sl.shipment_line_id,
    coalesce(
      jsonb_agg(
        case
          when jsonb_typeof(item.elem) = 'object' then
            (
              with e_amount as (
                select
                  case
                    when coalesce(item.elem->>'amount', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                      then jsonb_set(item.elem, '{amount}', to_jsonb(round((item.elem->>'amount')::numeric, 0)), true)
                    else item.elem
                  end as e
              )
              select
                case
                  when jsonb_typeof(e->'meta') = 'object' then
                    jsonb_set(
                      jsonb_set(
                        jsonb_set(
                          e,
                          '{meta,cost_krw}',
                          case
                            when coalesce(e->'meta'->>'cost_krw', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                              then to_jsonb(round((e->'meta'->>'cost_krw')::numeric, 0))
                            else e->'meta'->'cost_krw'
                          end,
                          true
                        ),
                        '{meta,sell_krw}',
                        case
                          when coalesce(e->'meta'->>'sell_krw', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                            then to_jsonb(round((e->'meta'->>'sell_krw')::numeric, 0))
                          else e->'meta'->'sell_krw'
                        end,
                        true
                      ),
                      '{meta,margin_krw}',
                      case
                        when coalesce(e->'meta'->>'margin_krw', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                          then to_jsonb(round((e->'meta'->>'margin_krw')::numeric, 0))
                        else e->'meta'->'margin_krw'
                      end,
                      true
                    )
                  else e
                end
              from e_amount
            )
          else item.elem
        end
        order by item.ord
      ),
      '[]'::jsonb
    ) as next_extra_labor_items
  from public.cms_shipment_line sl
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(sl.extra_labor_items) = 'array' then sl.extra_labor_items
      else '[]'::jsonb
    end
  ) with ordinality as item(elem, ord)
  group by sl.shipment_line_id
), shipment_meta as (
  select
    sl.shipment_line_id,
    case
      when jsonb_typeof(sl.pricing_policy_meta) = 'object' then
        (
          with p1 as (
            select
              case
                when coalesce(sl.pricing_policy_meta->>'absorb_decor_total_krw', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                  then jsonb_set(
                    sl.pricing_policy_meta,
                    '{absorb_decor_total_krw}',
                    to_jsonb(round((sl.pricing_policy_meta->>'absorb_decor_total_krw')::numeric, 0)),
                    true
                  )
                else sl.pricing_policy_meta
              end as m
          ),
          p2 as (
            select
              case
                when coalesce(p1.m->>'absorb_etc_total_krw', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                  then jsonb_set(
                    p1.m,
                    '{absorb_etc_total_krw}',
                    to_jsonb(round((p1.m->>'absorb_etc_total_krw')::numeric, 0)),
                    true
                  )
                else p1.m
              end as m
            from p1
          )
          select
            case
              when coalesce(p2.m->>'absorb_plating_krw', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                then jsonb_set(
                  p2.m,
                  '{absorb_plating_krw}',
                  to_jsonb(round((p2.m->>'absorb_plating_krw')::numeric, 0)),
                  true
                )
              else p2.m
            end
          from p2
        )
      else coalesce(sl.pricing_policy_meta, '{}'::jsonb)
    end as next_pricing_policy_meta
  from public.cms_shipment_line sl
)
update public.cms_shipment_line sl
set
  extra_labor_items = si.next_extra_labor_items,
  pricing_policy_meta = sm.next_pricing_policy_meta,
  updated_at = now()
from shipment_items si
join shipment_meta sm
  on sm.shipment_line_id = si.shipment_line_id
where sl.shipment_line_id = si.shipment_line_id
  and (
    sl.extra_labor_items is distinct from si.next_extra_labor_items
    or sl.pricing_policy_meta is distinct from sm.next_pricing_policy_meta
  );

with match_meta as (
  select
    m.receipt_id,
    m.receipt_line_uuid,
    m.order_line_id,
    case
      when jsonb_typeof(m.pricing_policy_meta) = 'object' then
        (
          with p1 as (
            select
              case
                when coalesce(m.pricing_policy_meta->>'absorb_decor_total_krw', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                  then jsonb_set(
                    m.pricing_policy_meta,
                    '{absorb_decor_total_krw}',
                    to_jsonb(round((m.pricing_policy_meta->>'absorb_decor_total_krw')::numeric, 0)),
                    true
                  )
                else m.pricing_policy_meta
              end as x
          ),
          p2 as (
            select
              case
                when coalesce(p1.x->>'absorb_etc_total_krw', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                  then jsonb_set(
                    p1.x,
                    '{absorb_etc_total_krw}',
                    to_jsonb(round((p1.x->>'absorb_etc_total_krw')::numeric, 0)),
                    true
                  )
                else p1.x
              end as x
            from p1
          )
          select
            case
              when coalesce(p2.x->>'absorb_plating_krw', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                then jsonb_set(
                  p2.x,
                  '{absorb_plating_krw}',
                  to_jsonb(round((p2.x->>'absorb_plating_krw')::numeric, 0)),
                  true
                )
              else p2.x
            end
          from p2
        )
      else coalesce(m.pricing_policy_meta, '{}'::jsonb)
    end as next_pricing_policy_meta
  from public.cms_receipt_line_match m
)
update public.cms_receipt_line_match m
set
  pricing_policy_meta = mm.next_pricing_policy_meta,
  updated_at = now()
from match_meta mm
where m.receipt_id = mm.receipt_id
  and m.receipt_line_uuid = mm.receipt_line_uuid
  and m.order_line_id = mm.order_line_id
  and m.pricing_policy_meta is distinct from mm.next_pricing_policy_meta;
