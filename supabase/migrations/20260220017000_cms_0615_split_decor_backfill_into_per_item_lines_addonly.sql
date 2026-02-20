set search_path = public, pg_temp;

with target as (
  select
    m.receipt_id,
    m.receipt_line_uuid,
    m.order_line_id,
    m.shipment_line_id,
    greatest(coalesce(ol.qty, 1), 0) as order_qty,
    ol.matched_master_id as master_id,
    coalesce(
      (
        select sum(
          case
            when coalesce(elem->>'type', '') = 'DECOR:BACKFILL_0614'
             and coalesce(elem->>'amount', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
              then (elem->>'amount')::numeric
            else 0
          end
        )
        from jsonb_array_elements(
          case
            when jsonb_typeof(sl.extra_labor_items) = 'array' then sl.extra_labor_items
            else '[]'::jsonb
          end
        ) as elem
      ),
      0
    ) as backfill_amount
  from public.cms_receipt_line_match m
  join public.cms_order_line ol
    on ol.order_line_id = m.order_line_id
  join public.cms_shipment_line sl
    on sl.shipment_line_id = m.shipment_line_id
  where m.status = 'CONFIRMED'
    and m.shipment_line_id is not null
    and exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(sl.extra_labor_items) = 'array' then sl.extra_labor_items
          else '[]'::jsonb
        end
      ) as elem
      where coalesce(elem->>'type', '') = 'DECOR:BACKFILL_0614'
    )
), decor_rows as (
  select
    t.receipt_id,
    t.receipt_line_uuid,
    t.order_line_id,
    t.shipment_line_id,
    t.backfill_amount,
    a.absorb_item_id,
    coalesce(nullif(trim(a.reason), ''), '장식공임') as reason,
    greatest(
      coalesce(a.amount_krw, 0)
      * case when coalesce(a.is_per_piece, true) then t.order_qty else 1 end,
      0
    ) as amount_krw,
    case when coalesce(a.is_per_piece, true) then t.order_qty else 1 end as qty_base,
    greatest(
      coalesce(
        nullif(substring(coalesce(a.note, '') from 'QTY_PER_UNIT:([0-9]+([.][0-9]+)?)'), '')::numeric,
        1
      ),
      0
    ) as unit_qty_per_piece,
    coalesce(a.is_per_piece, true) as is_per_piece
  from target t
  join public.cms_master_absorb_labor_item_v1 a
    on a.master_id = t.master_id
   and a.is_active = true
   and a.vendor_party_id is null
   and upper(coalesce(a.bucket::text, '')) = 'ETC'
   and coalesce(a.note, '') like 'BOM_DECOR_LINE:%'
), decor_group as (
  select
    dr.receipt_id,
    dr.receipt_line_uuid,
    dr.order_line_id,
    dr.shipment_line_id,
    max(dr.backfill_amount) as backfill_amount,
    greatest(sum(dr.amount_krw), 0) as decor_total_krw,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'type', 'DECOR:' || coalesce(dr.absorb_item_id::text, md5(dr.reason || dr.amount_krw::text)),
          'label', '[장식] ' || dr.reason,
          'amount', dr.amount_krw,
          'meta', jsonb_build_object(
            'engine', 'policy_v2_absorb_bucket',
            'bucket', 'ETC',
            'class', 'DECOR',
            'absorb_item_id', dr.absorb_item_id,
            'cost_krw', 0,
            'margin_krw', dr.amount_krw,
            'is_per_piece', dr.is_per_piece,
            'qty_applied', dr.qty_base * dr.unit_qty_per_piece,
            'unit_qty_per_piece', dr.unit_qty_per_piece
          )
        )
        order by dr.reason asc, dr.absorb_item_id asc
      ),
      '[]'::jsonb
    ) as decor_items_json
  from decor_rows dr
  group by dr.receipt_id, dr.receipt_line_uuid, dr.order_line_id, dr.shipment_line_id
), shipment_patched as (
  update public.cms_shipment_line sl
  set
    extra_labor_items = (
      select coalesce(jsonb_agg(elem), '[]'::jsonb)
      from jsonb_array_elements(
        case
          when jsonb_typeof(sl.extra_labor_items) = 'array' then sl.extra_labor_items
          else '[]'::jsonb
        end
      ) as elem
      where coalesce(elem->>'type', '') <> 'DECOR:BACKFILL_0614'
    ) || dg.decor_items_json,
    extra_labor_krw = greatest(
      coalesce(sl.extra_labor_krw, 0)
      - coalesce(dg.backfill_amount, 0)
      + coalesce(dg.decor_total_krw, 0),
      0
    ),
    pricing_policy_meta = case
      when jsonb_typeof(sl.pricing_policy_meta) = 'object' then
        jsonb_set(
          jsonb_set(
            sl.pricing_policy_meta,
            '{absorb_decor_total_krw}',
            to_jsonb(greatest(
              coalesce(
                case
                  when coalesce(sl.pricing_policy_meta->>'absorb_decor_total_krw', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                    then (sl.pricing_policy_meta->>'absorb_decor_total_krw')::numeric
                  else 0
                end,
                0
              ) - coalesce(dg.backfill_amount, 0) + coalesce(dg.decor_total_krw, 0),
              0
            )),
            true
          ),
          '{absorb_etc_total_krw}',
          to_jsonb(greatest(
            coalesce(
              case
                when coalesce(sl.pricing_policy_meta->>'absorb_etc_total_krw', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                  then (sl.pricing_policy_meta->>'absorb_etc_total_krw')::numeric
                else 0
              end,
              0
            ) - coalesce(dg.backfill_amount, 0) + coalesce(dg.decor_total_krw, 0),
            0
          )),
          true
        )
      else sl.pricing_policy_meta
    end,
    updated_at = now()
  from decor_group dg
  where sl.shipment_line_id = dg.shipment_line_id
  returning sl.shipment_line_id, dg.receipt_id, dg.receipt_line_uuid, dg.order_line_id, dg.backfill_amount, dg.decor_total_krw
), match_patched as (
  update public.cms_receipt_line_match m
  set
    pricing_policy_meta = case
      when jsonb_typeof(m.pricing_policy_meta) = 'object' then
        jsonb_set(
          jsonb_set(
            m.pricing_policy_meta,
            '{absorb_decor_total_krw}',
            to_jsonb(greatest(
              coalesce(
                case
                  when coalesce(m.pricing_policy_meta->>'absorb_decor_total_krw', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                    then (m.pricing_policy_meta->>'absorb_decor_total_krw')::numeric
                  else 0
                end,
                0
              ) - coalesce(sp.backfill_amount, 0) + coalesce(sp.decor_total_krw, 0),
              0
            )),
            true
          ),
          '{absorb_etc_total_krw}',
          to_jsonb(greatest(
            coalesce(
              case
                when coalesce(m.pricing_policy_meta->>'absorb_etc_total_krw', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                  then (m.pricing_policy_meta->>'absorb_etc_total_krw')::numeric
                else 0
              end,
              0
            ) - coalesce(sp.backfill_amount, 0) + coalesce(sp.decor_total_krw, 0),
            0
          )),
          true
        )
      else m.pricing_policy_meta
    end,
    updated_at = now()
  from shipment_patched sp
  where m.receipt_id = sp.receipt_id
    and m.receipt_line_uuid = sp.receipt_line_uuid
    and m.order_line_id = sp.order_line_id
  returning m.order_line_id
)
select
  (select count(*) from shipment_patched) as shipment_patched_count,
  (select count(*) from match_patched) as match_patched_count;
