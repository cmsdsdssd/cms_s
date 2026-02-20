set search_path = public, pg_temp;

with decor_rollup as (
  select
    m.receipt_id,
    m.receipt_line_uuid,
    m.order_line_id,
    m.shipment_line_id,
    greatest(
      sum(
        greatest(coalesce(a.amount_krw, 0), 0)
        * case when coalesce(a.is_per_piece, true) then greatest(coalesce(ol.qty, 1), 0) else 1 end
      ),
      0
    ) as decor_total_krw
  from public.cms_receipt_line_match m
  join public.cms_order_line ol
    on ol.order_line_id = m.order_line_id
  join public.cms_master_absorb_labor_item_v1 a
    on a.master_id = ol.matched_master_id
   and a.is_active = true
   and a.vendor_party_id is null
   and upper(coalesce(a.bucket::text, '')) = 'ETC'
   and coalesce(a.note, '') like 'BOM_DECOR_LINE:%'
  where m.status = 'CONFIRMED'
    and m.shipment_line_id is not null
  group by m.receipt_id, m.receipt_line_uuid, m.order_line_id, m.shipment_line_id
), shipment_patched as (
  update public.cms_shipment_line sl
  set
    extra_labor_krw = coalesce(sl.extra_labor_krw, 0) + dr.decor_total_krw,
    extra_labor_items = (
      case
        when jsonb_typeof(sl.extra_labor_items) = 'array' then sl.extra_labor_items
        else '[]'::jsonb
      end
    ) || jsonb_build_array(
      jsonb_build_object(
        'type', 'DECOR:BACKFILL_0614',
        'label', '[장식] BOM_DECOR_BACKFILL',
        'amount', dr.decor_total_krw,
        'meta', jsonb_build_object(
          'engine', 'policy_v2_decor_backfill_0614',
          'bucket', 'ETC',
          'class', 'DECOR',
          'cost_krw', 0,
          'margin_krw', dr.decor_total_krw
        )
      )
    ),
    pricing_policy_meta = case
      when jsonb_typeof(sl.pricing_policy_meta) = 'object' then
        jsonb_set(
          jsonb_set(
            sl.pricing_policy_meta,
            '{absorb_decor_total_krw}',
            to_jsonb(
              greatest(
                coalesce(
                  case
                    when coalesce(sl.pricing_policy_meta->>'absorb_decor_total_krw', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                      then (sl.pricing_policy_meta->>'absorb_decor_total_krw')::numeric
                    else 0
                  end,
                  0
                ) + dr.decor_total_krw,
                0
              )
            ),
            true
          ),
          '{absorb_etc_total_krw}',
          to_jsonb(
            greatest(
              coalesce(
                case
                  when coalesce(sl.pricing_policy_meta->>'absorb_etc_total_krw', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                    then (sl.pricing_policy_meta->>'absorb_etc_total_krw')::numeric
                  else 0
                end,
                0
              ) + dr.decor_total_krw,
              0
            )
          ),
          true
        )
      else sl.pricing_policy_meta
    end,
    updated_at = now()
  from decor_rollup dr
  where sl.shipment_line_id = dr.shipment_line_id
    and dr.decor_total_krw > 0
    and not exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(sl.extra_labor_items) = 'array' then sl.extra_labor_items
          else '[]'::jsonb
        end
      ) as elem
      where upper(coalesce(elem->>'type', '')) like 'DECOR:%'
    )
  returning sl.shipment_line_id
), match_patched as (
  update public.cms_receipt_line_match m
  set
    pricing_policy_meta = case
      when jsonb_typeof(m.pricing_policy_meta) = 'object' then
        jsonb_set(
          jsonb_set(
            m.pricing_policy_meta,
            '{absorb_decor_total_krw}',
            to_jsonb(
              greatest(
                coalesce(
                  case
                    when coalesce(m.pricing_policy_meta->>'absorb_decor_total_krw', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                      then (m.pricing_policy_meta->>'absorb_decor_total_krw')::numeric
                    else 0
                  end,
                  0
                ) + dr.decor_total_krw,
                0
              )
            ),
            true
          ),
          '{absorb_etc_total_krw}',
          to_jsonb(
            greatest(
              coalesce(
                case
                  when coalesce(m.pricing_policy_meta->>'absorb_etc_total_krw', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                    then (m.pricing_policy_meta->>'absorb_etc_total_krw')::numeric
                  else 0
                end,
                0
              ) + dr.decor_total_krw,
              0
            )
          ),
          true
        )
      else m.pricing_policy_meta
    end,
    updated_at = now()
  from decor_rollup dr
  where m.receipt_id = dr.receipt_id
    and m.receipt_line_uuid = dr.receipt_line_uuid
    and m.order_line_id = dr.order_line_id
    and dr.decor_total_krw > 0
    and exists (
      select 1
      from shipment_patched sp
      where sp.shipment_line_id = dr.shipment_line_id
    )
  returning m.order_line_id
)
select
  (select count(*) from shipment_patched) as shipment_patched_count,
  (select count(*) from match_patched) as match_patched_count;
