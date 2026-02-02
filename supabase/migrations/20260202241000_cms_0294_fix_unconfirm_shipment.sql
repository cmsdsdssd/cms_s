set search_path = public, pg_temp;

create or replace function public.cms_fn_unconfirm_shipment_v1(
  p_shipment_id uuid,
  p_reason text,
  p_actor_person_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_hdr public.cms_shipment_header%rowtype;
  v_reason text;
  v_move record;
  v_has_actual_labor boolean := false;
  v_has_actual_cost boolean := false;
begin
  select * into v_hdr
  from public.cms_shipment_header
  where shipment_id = p_shipment_id
  for update;

  if not found then
    raise exception 'shipment not found: %', p_shipment_id;
  end if;

  if v_hdr.status <> 'CONFIRMED'::public.cms_e_shipment_status then
    raise exception 'shipment not confirmed: %', p_shipment_id;
  end if;

  v_reason := nullif(btrim(p_reason), '');
  if v_reason is null then
    raise exception 'reason required';
  end if;

  -- void inventory ISSUE moves linked to shipment
  for v_move in
    select move_id
    from public.cms_inventory_move_header
    where ref_doc_type = 'SHIPMENT'
      and ref_doc_id = p_shipment_id
  loop
    perform public.cms_fn_void_inventory_move_v1(
      v_move.move_id,
      v_reason,
      p_actor_person_id,
      p_note,
      gen_random_uuid()
    );
  end loop;

  -- delete shipment AR ledger entry
  delete from public.cms_ar_ledger
  where entry_type = 'SHIPMENT'
    and shipment_id = p_shipment_id;

  -- clear pricing snapshot header
  delete from public.cms_shipment_valuation
  where shipment_id = p_shipment_id;

  -- reset shipment lines (weights, labor, pricing, ticks)
  update public.cms_shipment_line
  set
    measured_weight_g = null,
    deduction_weight_g = 0,
    net_weight_g = null,

    gold_tick_id = null,
    silver_tick_id = null,
    gold_tick_krw_per_g = null,
    silver_tick_krw_per_g = null,
    silver_adjust_factor = 1.2,

    material_amount_sell_krw = 0,
    material_amount_cost_krw = 0,

    labor_base_sell_krw = 0,
    labor_center_sell_krw = 0,
    labor_sub1_sell_krw = 0,
    labor_sub2_sell_krw = 0,
    labor_bead_sell_krw = 0,
    labor_total_sell_krw = 0,

    labor_base_cost_krw = 0,
    labor_center_cost_krw = 0,
    labor_sub1_cost_krw = 0,
    labor_sub2_cost_krw = 0,
    labor_bead_cost_krw = 0,
    labor_total_cost_krw = 0,

    repair_fee_krw = 0,

    total_amount_sell_krw = 0,
    total_amount_cost_krw = 0,

    manual_labor_krw = 0,
    manual_total_amount_krw = null,

    is_priced_final = false,
    priced_at = null,
    price_calc_trace = '{}'::jsonb,
    updated_at = now()
  where shipment_id = p_shipment_id;

  -- optional fields from cost system (if columns exist)
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cms_shipment_line'
      and column_name = 'actual_labor_cost_krw'
  ) into v_has_actual_labor;

  if v_has_actual_labor then
    execute 'update public.cms_shipment_line set actual_labor_cost_krw = null where shipment_id = $1'
    using p_shipment_id;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cms_shipment_line'
      and column_name = 'actual_cost_krw'
  ) into v_has_actual_cost;

  if v_has_actual_cost then
    execute 'update public.cms_shipment_line set actual_cost_krw = null where shipment_id = $1'
    using p_shipment_id;
  end if;

  -- reset header
  update public.cms_shipment_header
  set status = 'DRAFT'::public.cms_e_shipment_status,
      confirmed_at = null,
      ship_date = null,
      pricing_locked_at = null,
      pricing_source = null,
      is_store_pickup = false,
      memo = trim(both from coalesce(memo, '') || case when coalesce(memo, '') = '' then '' else E'\n' end || '[UNCONFIRM] ' || v_reason),
      updated_at = now()
  where shipment_id = p_shipment_id;

  -- recompute order_line status for lines in this shipment
  update public.cms_order_line o
  set status = 'READY_TO_SHIP'::public.cms_e_order_status
  where o.order_line_id in (
    select sl.order_line_id
    from public.cms_shipment_line sl
    where sl.shipment_id = p_shipment_id
      and sl.order_line_id is not null
  )
    and o.status <> 'CANCELLED'::public.cms_e_order_status
    and not exists (
      select 1
      from public.cms_shipment_line sl2
      join public.cms_shipment_header sh2 on sh2.shipment_id = sl2.shipment_id
      where sh2.status = 'CONFIRMED'::public.cms_e_shipment_status
        and sl2.order_line_id = o.order_line_id
    );

  -- recompute repair_line status for lines in this shipment
  update public.cms_repair_line r
  set status = 'READY_TO_SHIP'::public.cms_e_repair_status
  where r.repair_line_id in (
    select sl.repair_line_id
    from public.cms_shipment_line sl
    where sl.shipment_id = p_shipment_id
      and sl.repair_line_id is not null
  )
    and r.status <> 'CANCELLED'::public.cms_e_repair_status
    and not exists (
      select 1
      from public.cms_shipment_line sl2
      join public.cms_shipment_header sh2 on sh2.shipment_id = sl2.shipment_id
      where sh2.status = 'CONFIRMED'::public.cms_e_shipment_status
        and sl2.repair_line_id = r.repair_line_id
    );

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'status', 'DRAFT',
    'reason', v_reason
  );
end $$;

alter function public.cms_fn_unconfirm_shipment_v1(uuid, text, uuid, text) security definer;
grant execute on function public.cms_fn_unconfirm_shipment_v1(uuid, text, uuid, text) to authenticated;
