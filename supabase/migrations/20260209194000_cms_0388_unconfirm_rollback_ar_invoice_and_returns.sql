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

  v_corr uuid := gen_random_uuid();

  v_return_ids uuid[];
  v_ret_id uuid;

  v_void_return_moves int := 0;
  v_deleted_ledger int := 0;
  v_deleted_invoices int := 0;
  v_deleted_returns int := 0;
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

  --------------------------------------------------------------------
  -- (A) RETURN 정리(반품 + RETURN_LINE 재고이동 void)
  --------------------------------------------------------------------
  select array_agg(rl.return_line_id) into v_return_ids
  from public.cms_return_line rl
  join public.cms_shipment_line sl
    on sl.shipment_line_id = rl.shipment_line_id
  where sl.shipment_id = p_shipment_id;

  if v_return_ids is not null then
    foreach v_ret_id in array v_return_ids loop
      -- void inventory moves created by RETURN_LINE
      for v_move in
        select move_id
        from public.cms_inventory_move_header
        where ref_doc_type = 'RETURN_LINE'
          and ref_doc_id = v_ret_id
      loop
        perform public.cms_fn_void_inventory_move_v1(
          v_move.move_id,
          v_reason,
          p_actor_person_id,
          p_note,
          v_corr
        );
        v_void_return_moves := v_void_return_moves + 1;
      end loop;
    end loop;
  end if;

  --------------------------------------------------------------------
  -- (B) AR 정리: ledger(RETURN 포함) + invoice(+alloc cascade)
  --------------------------------------------------------------------
  -- ledger: shipment_id 연관된 건 전부 삭제 (RETURN도 포함)
  delete from public.cms_ar_ledger
  where shipment_id = p_shipment_id;
  get diagnostics v_deleted_ledger = row_count;

  -- invoice: 존재하면 삭제 (alloc은 FK on delete cascade로 정리됨)
  if to_regclass('public.cms_ar_invoice') is not null then
    with del as (
      delete from public.cms_ar_invoice
      where shipment_id = p_shipment_id
      returning 1
    )
    select count(*) into v_deleted_invoices from del;
  end if;

  -- return_line: ledger 삭제 후 제거 (FK 위반 방지)
  if v_return_ids is not null then
    delete from public.cms_return_line
    where return_line_id = any(v_return_ids);
    get diagnostics v_deleted_returns = row_count;
  end if;

  --------------------------------------------------------------------
  -- (C) 기존 unconfirm 로직(기능 유지) : SHIPMENT 재고이동 void + valuation 삭제 + 리셋
  --------------------------------------------------------------------
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
      v_corr
    );
  end loop;

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

  -- reset header (주의: ship_date는 정책상 "입고일"이므로 NULL로 지우지 않고 유지)
  update public.cms_shipment_header
  set status = 'DRAFT'::public.cms_e_shipment_status,
      confirmed_at = null,
      ship_date = v_hdr.ship_date,
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
    'reason', v_reason,
    'deleted_ledger_rows', v_deleted_ledger,
    'deleted_invoice_rows', v_deleted_invoices,
    'deleted_return_rows', v_deleted_returns,
    'voided_return_moves', v_void_return_moves,
    'correlation_id', v_corr
  );
end $$;

alter function public.cms_fn_unconfirm_shipment_v1(uuid, text, uuid, text) security definer;
grant execute on function public.cms_fn_unconfirm_shipment_v1(uuid, text, uuid, text) to authenticated;
