begin;

create or replace view public.v_cms_shipment_labor_integrity_v1 as
with line_items as (
  select
    sl.shipment_line_id,
    sl.shipment_id,
    coalesce(sl.extra_labor_krw, 0) as extra_labor_krw,
    case when jsonb_typeof(sl.extra_labor_items) = 'array' then sl.extra_labor_items else '[]'::jsonb end as extra_labor_items,
    sh.status as shipment_status,
    sh.confirmed_at,
    sh.ar_principal_locked_at,
    sl.created_at,
    sl.updated_at
  from public.cms_shipment_line sl
  join public.cms_shipment_header sh on sh.shipment_id = sl.shipment_id
), expanded as (
  select
    l.*, item
  from line_items l
  left join lateral jsonb_array_elements(l.extra_labor_items) as item on true
), aggregated as (
  select
    shipment_line_id,
    shipment_id,
    shipment_status,
    confirmed_at,
    ar_principal_locked_at,
    created_at,
    updated_at,
    extra_labor_krw,
    coalesce(
      sum(
        case
          when coalesce(item->>'amount', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
               and not public.cms_fn_is_material_master_extra_item_v1(item)
            then (item->>'amount')::numeric
          else 0
        end
      ),
      0
    ) as sanitized_sum_krw,
    count(*) filter (where public.cms_fn_is_material_master_extra_item_v1(item)) as material_master_item_count
  from expanded
  group by
    shipment_line_id,
    shipment_id,
    shipment_status,
    confirmed_at,
    ar_principal_locked_at,
    created_at,
    updated_at,
    extra_labor_krw
)
select
  a.*, 
  (a.extra_labor_krw - a.sanitized_sum_krw) as delta_krw,
  (abs(a.extra_labor_krw - a.sanitized_sum_krw) > 0.0001) as has_mismatch,
  (a.material_master_item_count > 0) as has_material_master
from aggregated a;

create or replace function public.cms_fn_shipment_labor_integrity_summary_v1()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base as (
    select * from public.v_cms_shipment_labor_integrity_v1
  )
  select jsonb_build_object(
    'total_lines', count(*),
    'material_master_lines', count(*) filter (where has_material_master),
    'mismatch_lines', count(*) filter (where has_mismatch),
    'draft_material_master_lines', count(*) filter (where has_material_master and coalesce(shipment_status::text, '') <> 'CONFIRMED'),
    'draft_mismatch_lines', count(*) filter (where has_mismatch and coalesce(shipment_status::text, '') <> 'CONFIRMED'),
    'confirmed_material_master_lines', count(*) filter (where has_material_master and coalesce(shipment_status::text, '') = 'CONFIRMED'),
    'confirmed_mismatch_lines', count(*) filter (where has_mismatch and coalesce(shipment_status::text, '') = 'CONFIRMED')
  )
  from base;
$$;

grant select on public.v_cms_shipment_labor_integrity_v1 to authenticated, service_role;
grant execute on function public.cms_fn_shipment_labor_integrity_summary_v1() to authenticated, service_role;

commit;
