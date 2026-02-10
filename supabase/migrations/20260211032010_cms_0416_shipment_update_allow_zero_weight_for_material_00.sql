set search_path = public, pg_temp;

create or replace function public.cms_fn_shipment_update_line_v1(
  p_shipment_line_id uuid,
  p_measured_weight_g numeric default null,
  p_deduction_weight_g numeric default null,
  p_base_labor_krw numeric default null,
  p_extra_labor_krw numeric default null,
  p_extra_labor_items jsonb default null,
  p_pricing_mode cms_e_pricing_mode default null,
  p_manual_total_amount_krw numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line public.cms_shipment_line%rowtype;
  v_measured numeric;
  v_deduct numeric;
  v_net numeric;
  v_base_labor numeric;
  v_extra_labor numeric;
  v_total_labor numeric;
  v_pricing_mode public.cms_e_pricing_mode;
  v_manual_total numeric;
begin
  if p_shipment_line_id is null then raise exception 'shipment_line_id required'; end if;
  if p_deduction_weight_g is not null and p_deduction_weight_g < 0 then
    raise exception 'deduction_weight_g must be >= 0';
  end if;
  if p_base_labor_krw is not null and p_base_labor_krw < 0 then
    raise exception 'base_labor_krw must be >= 0';
  end if;
  if p_extra_labor_krw is not null and p_extra_labor_krw < 0 then
    raise exception 'extra_labor_krw must be >= 0';
  end if;
  if p_manual_total_amount_krw is not null and p_manual_total_amount_krw < 0 then
    raise exception 'manual_total_amount_krw must be >= 0';
  end if;

  select * into v_line
  from public.cms_shipment_line
  where shipment_line_id = p_shipment_line_id
  for update;

  if not found then
    raise exception 'shipment_line not found: %', p_shipment_line_id;
  end if;

  if p_measured_weight_g is not null and p_measured_weight_g <= 0
     and coalesce(v_line.material_code::text, '') <> '00' then
    raise exception 'measured_weight_g must be > 0';
  end if;

  v_measured := coalesce(p_measured_weight_g, v_line.measured_weight_g);
  v_deduct := coalesce(p_deduction_weight_g, v_line.deduction_weight_g, 0);
  if v_measured is not null and v_deduct > v_measured then
    raise exception 'deduction_weight_g cannot exceed measured_weight_g';
  end if;

  v_net := case when v_measured is null then null else greatest(v_measured - v_deduct, 0) end;
  v_base_labor := coalesce(p_base_labor_krw, v_line.base_labor_krw, 0);
  v_extra_labor := coalesce(p_extra_labor_krw, v_line.extra_labor_krw, 0);
  v_total_labor := v_base_labor + v_extra_labor;
  v_pricing_mode := coalesce(p_pricing_mode, v_line.pricing_mode, 'RULE'::public.cms_e_pricing_mode);

  if v_pricing_mode::text in ('AMOUNT_ONLY', 'MANUAL') then
    v_manual_total := coalesce(
      p_manual_total_amount_krw,
      v_line.manual_total_amount_krw,
      coalesce(v_line.material_amount_sell_krw, 0) + v_total_labor
    );
  else
    v_manual_total := null;
  end if;

  update public.cms_shipment_line
  set measured_weight_g = v_measured,
      deduction_weight_g = v_deduct,
      net_weight_g = v_net,
      manual_labor_krw = v_total_labor,
      base_labor_krw = v_base_labor,
      extra_labor_krw = v_extra_labor,
      extra_labor_items = coalesce(p_extra_labor_items, v_line.extra_labor_items, '[]'::jsonb),
      pricing_mode = v_pricing_mode,
      manual_total_amount_krw = v_manual_total,
      labor_total_sell_krw = v_total_labor,
      total_amount_sell_krw = case
        when v_pricing_mode::text in ('AMOUNT_ONLY', 'MANUAL')
          then coalesce(v_manual_total, coalesce(v_line.material_amount_sell_krw, 0) + v_total_labor)
        else coalesce(v_line.material_amount_sell_krw, 0) + v_total_labor
      end,
      updated_at = now()
  where shipment_line_id = p_shipment_line_id;

  return jsonb_build_object('ok', true, 'shipment_line_id', p_shipment_line_id);
end $$;

grant execute on function public.cms_fn_shipment_update_line_v1(uuid, numeric, numeric, numeric, numeric, jsonb, cms_e_pricing_mode, numeric) to authenticated;

create or replace function public.cms_fn_update_shipment_line_v1(
  p_shipment_line_id uuid,
  p_measured_weight_g numeric default null,
  p_deduction_weight_g numeric default null,
  p_base_labor_krw numeric default null,
  p_extra_labor_krw numeric default null,
  p_extra_labor_items jsonb default null,
  p_pricing_mode cms_e_pricing_mode default null,
  p_manual_total_amount_krw numeric default null
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
    p_extra_labor_items,
    p_pricing_mode,
    p_manual_total_amount_krw
  );
end $$;

grant execute on function public.cms_fn_update_shipment_line_v1(uuid, numeric, numeric, numeric, numeric, jsonb, cms_e_pricing_mode, numeric) to authenticated;
