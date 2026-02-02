set search_path = public, pg_temp;

create or replace function public.cms_fn_update_shipment_line_v1(
  p_shipment_line_id uuid,
  p_measured_weight_g numeric default null,
  p_deduction_weight_g numeric default null,
  p_base_labor_krw numeric default null,
  p_extra_labor_krw numeric default null,
  p_extra_labor_items jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.cms_fn_shipment_update_line_v1(
    p_shipment_line_id,
    p_measured_weight_g,
    p_deduction_weight_g,
    p_base_labor_krw,
    p_extra_labor_krw,
    p_extra_labor_items
  );
end $$;

grant execute on function public.cms_fn_update_shipment_line_v1(uuid, numeric, numeric, numeric, numeric, jsonb) to authenticated;
