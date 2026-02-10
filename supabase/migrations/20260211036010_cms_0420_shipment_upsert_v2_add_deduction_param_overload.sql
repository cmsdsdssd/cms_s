set search_path = public, pg_temp;

create or replace function public.cms_fn_shipment_upsert_from_order_line_v2(
  p_order_line_id uuid,
  p_weight_g numeric,
  p_deduction_weight_g numeric,
  p_total_labor numeric,
  p_actor_person_id uuid,
  p_idempotency_key uuid,
  p_base_labor_krw numeric default null,
  p_extra_labor_krw numeric default null,
  p_extra_labor_items jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_line_id uuid;
  v_deduction numeric;
  v_measured numeric;
begin
  if p_deduction_weight_g is not null and p_deduction_weight_g < 0 then
    raise exception 'deduction_weight_g must be >= 0';
  end if;

  v_result := public.cms_fn_shipment_upsert_from_order_line_v2(
    p_order_line_id,
    p_weight_g,
    p_total_labor,
    p_actor_person_id,
    p_idempotency_key,
    p_base_labor_krw,
    p_extra_labor_krw,
    p_extra_labor_items
  );

  v_line_id := nullif(v_result->>'shipment_line_id', '')::uuid;
  if v_line_id is null then
    return v_result;
  end if;

  if p_deduction_weight_g is not null then
    select measured_weight_g into v_measured
    from public.cms_shipment_line
    where shipment_line_id = v_line_id;

    v_deduction := p_deduction_weight_g;
    if v_measured is not null and v_deduction > v_measured then
      raise exception 'deduction_weight_g cannot exceed measured_weight_g';
    end if;

    update public.cms_shipment_line
    set deduction_weight_g = v_deduction,
        net_weight_g = case when measured_weight_g is null then null else greatest(measured_weight_g - v_deduction, 0) end,
        updated_at = now()
    where shipment_line_id = v_line_id;
  end if;

  return v_result;
end $$;

grant execute on function public.cms_fn_shipment_upsert_from_order_line_v2(uuid,numeric,numeric,numeric,uuid,uuid,numeric,numeric,jsonb)
  to authenticated;
