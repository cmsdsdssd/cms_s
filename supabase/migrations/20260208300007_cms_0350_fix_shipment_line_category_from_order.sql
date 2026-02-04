create or replace function public.cms_fn_add_shipment_line_from_order_v1(
  p_shipment_id uuid,
  p_order_line_id uuid,
  p_qty int default null,
  p_pricing_mode cms_e_pricing_mode default 'RULE'::cms_e_pricing_mode,
  p_category_code cms_e_category_code default null,
  p_material_code cms_e_material_code default null,
  p_is_plated boolean default null,
  p_plating_variant_id uuid default null,
  p_unit_price_krw numeric default null,
  p_manual_total_amount_krw numeric default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o record;
  v_id uuid;
  v_master_category public.cms_e_category_code;
begin
  perform public.cms_fn__assert_shipment_draft(p_shipment_id);

  select * into o
  from public.cms_order_line
  where order_line_id = p_order_line_id;

  if not found then
    raise exception 'order_line not found: %', p_order_line_id;
  end if;

  select m.category_code
    into v_master_category
  from public.cms_master_item m
  where m.master_id = o.matched_master_id;

  insert into public.cms_shipment_line(
    shipment_line_id, shipment_id,
    order_line_id,
    pricing_mode,
    category_code,
    material_code,
    qty,
    model_name, suffix, color, size,
    is_plated, plating_variant_id,
    unit_price_krw,
    manual_total_amount_krw,
    repair_fee_krw
  )
  values(
    gen_random_uuid(), p_shipment_id,
    p_order_line_id,
    coalesce(p_pricing_mode, 'RULE'::cms_e_pricing_mode),
    coalesce(p_category_code, v_master_category),
    coalesce(p_material_code, o.material_code),
    coalesce(p_qty, o.qty, 1),
    o.model_name, o.suffix, o.color, o.size,
    coalesce(p_is_plated, o.is_plated, false),
    coalesce(p_plating_variant_id, o.plating_variant_id),
    p_unit_price_krw,
    p_manual_total_amount_krw,
    0
  )
  returning shipment_line_id into v_id;

  return v_id;
end $$;
