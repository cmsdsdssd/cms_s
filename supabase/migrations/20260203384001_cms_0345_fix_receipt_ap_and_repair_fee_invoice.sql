create or replace function public.cms_fn_ensure_ap_from_receipt_v1(
  p_receipt_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_vendor_party_id uuid;
  v_bill_no text;
  v_memo text;
  v_total_krw numeric;
  v_snap_total numeric;
  v_inbox_total numeric;
  v_rows int := 0;
begin
  if p_receipt_id is null then
    raise exception using errcode='P0001', message='receipt_id required';
  end if;

  select
    r.vendor_party_id,
    r.bill_no,
    r.memo,
    r.total_amount_krw,
    s.total_amount_krw
  into
    v_vendor_party_id,
    v_bill_no,
    v_memo,
    v_inbox_total,
    v_snap_total
  from public.cms_receipt_inbox r
  left join public.cms_receipt_pricing_snapshot s on s.receipt_id = r.receipt_id
  where r.receipt_id = p_receipt_id;

  if not found then
    raise exception using errcode='P0001', message='receipt not found';
  end if;

  v_total_krw := coalesce(v_snap_total, v_inbox_total);
  v_memo := coalesce(p_note, v_memo);

  if v_vendor_party_id is null or v_total_krw is null then
    return jsonb_build_object(
      'ok', true,
      'receipt_id', p_receipt_id,
      'skipped', true,
      'reason', 'missing_vendor_or_total'
    );
  end if;

  insert into public.cms_ap_ledger(
    vendor_party_id, occurred_at, entry_type, amount_krw, receipt_id, bill_no, memo
  ) values (
    v_vendor_party_id,
    now(),
    'BILL'::public.cms_e_ap_entry_type,
    v_total_krw,
    p_receipt_id,
    v_bill_no,
    v_memo
  )
  on conflict (receipt_id) where entry_type = 'BILL'::public.cms_e_ap_entry_type
  do update
  set
    vendor_party_id = excluded.vendor_party_id,
    amount_krw = excluded.amount_krw,
    bill_no = excluded.bill_no,
    memo = excluded.memo;

  get diagnostics v_rows = row_count;

  return jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'total_amount_krw', v_total_krw,
    'upserted', v_rows > 0
  );
end $$;
alter function public.cms_fn_ensure_ap_from_receipt_v1(uuid,text)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_ensure_ap_from_receipt_v1(uuid,text)
  to authenticated, service_role;
create or replace function public.cms_fn_apply_repair_fee_to_shipment_v1(
  p_shipment_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_applied_fee numeric := 0;
  v_total_sell numeric := 0;
  v_total_weight numeric := 0;
  v_total_labor numeric := 0;
begin
  if p_shipment_id is null then
    raise exception using errcode='P0001', message='shipment_id required';
  end if;

  with to_apply as (
    select shipment_line_id, repair_fee_krw
    from public.cms_shipment_line
    where shipment_id = p_shipment_id
      and coalesce(repair_fee_krw,0) > 0
      and coalesce((price_calc_trace->>'repair_fee_included')::boolean,false) = false
  ),
  upd as (
    update public.cms_shipment_line sl
    set
      total_amount_sell_krw = coalesce(sl.total_amount_sell_krw,0) + coalesce(sl.repair_fee_krw,0),
      labor_total_sell_krw = coalesce(sl.labor_total_sell_krw,0) + coalesce(sl.repair_fee_krw,0),
      price_calc_trace = coalesce(sl.price_calc_trace,'{}'::jsonb)
        || jsonb_build_object('repair_fee_included', true, 'repair_fee_applied_at', now())
    from to_apply t
    where sl.shipment_line_id = t.shipment_line_id
    returning sl.repair_fee_krw
  )
  select coalesce(sum(repair_fee_krw),0)
  into v_applied_fee
  from upd;

  select
    coalesce(sum(total_amount_sell_krw),0),
    coalesce(sum(net_weight_g),0),
    coalesce(sum(labor_total_sell_krw),0)
  into v_total_sell, v_total_weight, v_total_labor
  from public.cms_shipment_line
  where shipment_id = p_shipment_id;

  update public.cms_ar_ledger
  set
    amount_krw = v_total_sell,
    total_weight_g = v_total_weight,
    total_labor_krw = v_total_labor,
    memo = coalesce(memo, p_note)
  where entry_type = 'SHIPMENT'
    and shipment_id = p_shipment_id;

  if not found then
    insert into public.cms_ar_ledger(
      party_id, occurred_at, entry_type, amount_krw,
      shipment_id, memo, total_weight_g, total_labor_krw
    )
    select
      sh.customer_party_id,
      coalesce(sh.confirmed_at, now()),
      'SHIPMENT',
      v_total_sell,
      sh.shipment_id,
      p_note,
      v_total_weight,
      v_total_labor
    from public.cms_shipment_header sh
    where sh.shipment_id = p_shipment_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'applied_fee_krw', v_applied_fee,
    'total_sell_krw', v_total_sell
  );
end $$;
alter function public.cms_fn_apply_repair_fee_to_shipment_v1(uuid,text)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_apply_repair_fee_to_shipment_v1(uuid,text)
  to authenticated, service_role;
create or replace function public.cms_fn_confirm_shipment_v3_cost_v1(
  p_shipment_id uuid,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_emit_inventory boolean default true,
  p_correlation_id uuid default null,
  p_cost_mode text default 'PROVISIONAL',
  p_receipt_id uuid default null,
  p_cost_lines jsonb default '[]'::jsonb,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_corr uuid := coalesce(p_correlation_id, gen_random_uuid());
  v_confirm jsonb;
  v_cost jsonb;
  v_mode text := upper(coalesce(p_cost_mode,'PROVISIONAL'));
  v_emit uuid;
begin
  v_confirm := public.cms_fn_confirm_shipment(p_shipment_id, p_actor_person_id, p_note);

  perform public.cms_fn_apply_repair_fee_to_shipment_v1(p_shipment_id, p_note);

  if v_mode <> 'SKIP' then
    v_cost := public.cms_fn_apply_purchase_cost_to_shipment_v1(
      p_shipment_id,
      v_mode,
      p_receipt_id,
      coalesce(p_cost_lines,'[]'::jsonb),
      p_actor_person_id,
      p_note,
      v_corr,
      p_force
    );
  end if;

  perform public.cms_fn_apply_silver_factor_fix_v1(p_shipment_id);

  perform public.cms_fn_ar_create_from_shipment_confirm_v1(p_shipment_id);

  if p_emit_inventory then
    v_emit := public.cms_fn_emit_inventory_issue_from_shipment_confirmed_v2(
      p_shipment_id,
      p_actor_person_id,
      p_note,
      v_corr
    );

    v_confirm := v_confirm
      || jsonb_build_object(
        'inventory_emit', v_emit,
        'inventory_correlation_id', v_corr
      );
  end if;

  if v_mode <> 'SKIP' then
    return v_confirm
      || jsonb_build_object('purchase_cost', v_cost, 'correlation_id', v_corr);
  end if;

  return v_confirm
    || jsonb_build_object('correlation_id', v_corr);
end $$;
alter function public.cms_fn_confirm_shipment_v3_cost_v1(uuid,uuid,text,boolean,uuid,text,uuid,jsonb,boolean)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_confirm_shipment_v3_cost_v1(uuid,uuid,text,boolean,uuid,text,uuid,jsonb,boolean)
  to authenticated, service_role;
