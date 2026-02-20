set search_path = public, pg_temp;

do $$
declare
  v_oid oid;
  v_def text;
  v_new text;
begin
  select p.oid
    into v_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'cms_fn_receipt_line_match_confirm_v6_policy_v2'
  order by p.oid desc
  limit 1;

  if v_oid is null then
    raise exception 'function public.cms_fn_receipt_line_match_confirm_v6_policy_v2 not found';
  end if;

  select pg_get_functiondef(v_oid) into v_def;
  v_new := replace(
    v_def,
    '      and upper(coalesce(a.reason, '''')) <> ''BOM_AUTO_TOTAL''',
    '      and upper(coalesce(a.reason, '''')) <> ''BOM_AUTO_TOTAL''' || E'\n' ||
    '      and upper(coalesce(a.reason, '''')) <> ''ACCESSORY_LABOR'''
  );

  if v_new = v_def then
    raise exception '0612 patch not applied: target filter not found in function body';
  end if;

  execute v_new;
end;
$$;

with accessory_by_line as (
  select
    m.shipment_line_id,
    greatest(
      sum(
        greatest(coalesce(a.amount_krw, 0), 0)
        * case when coalesce(a.is_per_piece, true) then greatest(coalesce(ol.qty, 1), 0) else 1 end
      ),
      0
    ) as accessory_amount
  from public.cms_receipt_line_match m
  join public.cms_order_line ol on ol.order_line_id = m.order_line_id
  join public.cms_master_absorb_labor_item_v1 a
    on a.master_id = ol.matched_master_id
   and a.is_active = true
   and upper(coalesce(a.bucket::text, '')) = 'BASE_LABOR'
   and upper(coalesce(a.reason, '')) = 'ACCESSORY_LABOR'
  where m.status = 'CONFIRMED'
    and m.shipment_line_id is not null
  group by m.shipment_line_id
), patched as (
  update public.cms_shipment_line sl
  set
    base_labor_krw = greatest(coalesce(sl.base_labor_krw, 0) - abl.accessory_amount, 0),
    manual_labor_krw = case
      when sl.manual_labor_krw is null then null
      else greatest(coalesce(sl.manual_labor_krw, 0) - abl.accessory_amount, 0)
    end,
    pricing_policy_meta = case
      when jsonb_typeof(sl.pricing_policy_meta) = 'object' then
        jsonb_set(
          sl.pricing_policy_meta,
          '{absorb_base_to_base_krw}',
          to_jsonb(greatest(
            coalesce(
              case
                when coalesce(sl.pricing_policy_meta->>'absorb_base_to_base_krw', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                  then (sl.pricing_policy_meta->>'absorb_base_to_base_krw')::numeric
                else 0
              end,
              0
            ) - abl.accessory_amount,
            0
          )),
          true
        )
      else sl.pricing_policy_meta
    end,
    updated_at = now()
  from accessory_by_line abl
  where sl.shipment_line_id = abl.shipment_line_id
    and abl.accessory_amount > 0
  returning sl.shipment_line_id
)
select count(*) from patched;
