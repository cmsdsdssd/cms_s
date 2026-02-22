-- cms_0732: enforce 100 KRW unit for labor persistence (DB-level)
-- Applies to active shipment write paths used by UI/RPC.

begin;

create or replace function public.cms_fn_shipment_upsert_from_order_line_v2(
  p_order_line_id uuid,
  p_weight_g numeric,
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
  v_order public.cms_order_line%rowtype;
  v_shipment_id uuid;
  v_line_id uuid;
  v_total_labor numeric;
  v_base_labor numeric;
  v_extra_labor numeric;
  v_material public.cms_e_material_code;
  v_allow_zero boolean := false;
  v_existing record;
begin
  if p_order_line_id is null then raise exception 'order_line_id required'; end if;
  if p_total_labor is not null and p_total_labor < 0 then raise exception 'total_labor must be >= 0'; end if;
  if p_base_labor_krw is not null and p_base_labor_krw < 0 then raise exception 'base_labor must be >= 0'; end if;
  if p_extra_labor_krw is not null and p_extra_labor_krw < 0 then raise exception 'extra_labor must be >= 0'; end if;

  select * into v_order
  from public.cms_order_line
  where order_line_id = p_order_line_id;

  if not found then
    raise exception 'order_line not found: %', p_order_line_id;
  end if;

  select sl.shipment_line_id, sl.shipment_id, sh.status, sl.material_code
    into v_existing
  from public.cms_shipment_line sl
  join public.cms_shipment_header sh on sh.shipment_id = sl.shipment_id
  where sl.order_line_id = p_order_line_id
  order by sl.created_at desc
  limit 1;

  v_material := v_order.material_code;
  if v_material is null and v_order.matched_master_id is not null then
    select m.material_code_default into v_material
    from public.cms_master_item m
    where m.master_id = v_order.matched_master_id;
  end if;

  v_allow_zero :=
    coalesce(v_material::text, '') = '00'
    or coalesce((v_existing.material_code)::text, '') = '00';

  if p_weight_g is null or (v_allow_zero = false and p_weight_g <= 0) or (v_allow_zero = true and p_weight_g < 0) then
    raise exception 'weight_g must be > 0';
  end if;

  v_base_labor := coalesce(p_base_labor_krw, p_total_labor, 0);
  v_extra_labor := coalesce(p_extra_labor_krw, 0);
  v_total_labor := coalesce(p_total_labor, v_base_labor + v_extra_labor);

  -- enforce 100 KRW unit at persistence boundary
  v_base_labor := case when v_base_labor > 0 then ceil(v_base_labor / 100.0) * 100 else 0 end;
  v_extra_labor := case when v_extra_labor > 0 then ceil(v_extra_labor / 100.0) * 100 else 0 end;
  v_total_labor := case
    when p_total_labor is not null then
      case when v_total_labor > 0 then ceil(v_total_labor / 100.0) * 100 else 0 end
    else v_base_labor + v_extra_labor
  end;

  if found then
    if v_existing.status = 'DRAFT' then
      update public.cms_shipment_line
      set measured_weight_g = p_weight_g,
          manual_labor_krw = v_total_labor,
          base_labor_krw = v_base_labor,
          extra_labor_krw = v_extra_labor,
          extra_labor_items = coalesce(p_extra_labor_items, extra_labor_items, '[]'::jsonb),
          labor_total_sell_krw = v_total_labor,
          total_amount_sell_krw = coalesce(material_amount_sell_krw, 0) + v_total_labor,
          price_calc_trace = coalesce(price_calc_trace, '{}'::jsonb)
            || jsonb_build_object(
              'manual_labor_override', true,
              'manual_labor_krw', v_total_labor,
              'base_labor_krw', v_base_labor,
              'extra_labor_krw', v_extra_labor,
              'source', 'shipments_page',
              'actor_person_id', p_actor_person_id,
              'recorded_at', now()
            ),
          updated_at = now()
      where shipment_line_id = v_existing.shipment_line_id;
    end if;

    return jsonb_build_object(
      'shipment_id', v_existing.shipment_id,
      'shipment_line_id', v_existing.shipment_line_id,
      'status', v_existing.status,
      'reused', true
    );
  end if;

  v_shipment_id := public.cms_fn_create_shipment_header_v1(
    v_order.customer_party_id,
    current_date,
    null
  );

  v_line_id := public.cms_fn_add_shipment_line_from_order_v1(
    v_shipment_id,
    v_order.order_line_id,
    v_order.qty,
    'RULE'::cms_e_pricing_mode,
    null,
    null,
    v_order.is_plated,
    v_order.plating_variant_id,
    null,
    null,
    null
  );

  update public.cms_shipment_line
  set measured_weight_g = p_weight_g,
      manual_labor_krw = v_total_labor,
      base_labor_krw = v_base_labor,
      extra_labor_krw = v_extra_labor,
      extra_labor_items = coalesce(p_extra_labor_items, '[]'::jsonb),
      labor_total_sell_krw = v_total_labor,
      total_amount_sell_krw = coalesce(material_amount_sell_krw, 0) + v_total_labor,
      price_calc_trace = coalesce(price_calc_trace, '{}'::jsonb)
        || jsonb_build_object(
          'manual_labor_override', true,
          'manual_labor_krw', v_total_labor,
          'base_labor_krw', v_base_labor,
          'extra_labor_krw', v_extra_labor,
          'source', 'shipments_page',
          'actor_person_id', p_actor_person_id,
          'recorded_at', now()
        )
  where shipment_line_id = v_line_id;

  return jsonb_build_object(
    'shipment_id', v_shipment_id,
    'shipment_line_id', v_line_id,
    'status', 'DRAFT',
    'reused', false
  );
end $$;

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
  v_hdr public.cms_shipment_header%rowtype;
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
  if p_deduction_weight_g is not null and p_deduction_weight_g < 0 then raise exception 'deduction_weight_g must be >= 0'; end if;
  if p_base_labor_krw is not null and p_base_labor_krw < 0 then raise exception 'base_labor_krw must be >= 0'; end if;
  if p_extra_labor_krw is not null and p_extra_labor_krw < 0 then raise exception 'extra_labor_krw must be >= 0'; end if;
  if p_manual_total_amount_krw is not null and p_manual_total_amount_krw < 0 then raise exception 'manual_total_amount_krw must be >= 0'; end if;

  select * into v_line
  from public.cms_shipment_line
  where shipment_line_id = p_shipment_line_id
  for update;

  if not found then
    raise exception 'shipment_line not found: %', p_shipment_line_id;
  end if;

  select * into v_hdr
  from public.cms_shipment_header
  where shipment_id = v_line.shipment_id
  for update;

  if v_hdr.confirmed_at is not null
    or v_hdr.status = 'CONFIRMED'::public.cms_e_shipment_status
    or v_hdr.ar_principal_locked_at is not null then
    raise exception 'shipment is confirmed; line update locked (shipment_id=%)', v_line.shipment_id;
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

  -- enforce 100 KRW unit at persistence boundary
  v_base_labor := case when v_base_labor > 0 then ceil(v_base_labor / 100.0) * 100 else 0 end;
  v_extra_labor := case when v_extra_labor > 0 then ceil(v_extra_labor / 100.0) * 100 else 0 end;
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

grant execute on function public.cms_fn_shipment_upsert_from_order_line_v2(uuid,numeric,numeric,uuid,uuid,numeric,numeric,jsonb)
  to authenticated;

grant execute on function public.cms_fn_shipment_update_line_v1(uuid, numeric, numeric, numeric, numeric, jsonb, cms_e_pricing_mode, numeric)
  to authenticated;

commit;
