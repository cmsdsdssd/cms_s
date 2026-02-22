-- cms_0716: align SHIPMENT ledger principal with AR invoice principal (repair-safe)

begin;

create index if not exists cms_ar_invoice_shipment_id_idx
  on public.cms_ar_invoice (shipment_id);

create or replace function public.cms_fn_sync_ar_ledger_from_shipment_v1(
  p_shipment_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hdr public.cms_shipment_header%rowtype;
  v_total_sell numeric := 0;
  v_total_weight numeric := 0;
  v_total_labor numeric := 0;
  v_eps numeric := 0.5;
  v_affected int := 0;
  v_existing_amount numeric := 0;
  v_existing_weight numeric := 0;
  v_existing_labor numeric := 0;
  v_ar_total_sell numeric := 0;
  v_ar_total_labor numeric := 0;
  v_ar_count int := 0;
begin
  select * into v_hdr
  from public.cms_shipment_header
  where shipment_id = p_shipment_id;

  if not found then
    raise exception 'shipment not found: %', p_shipment_id;
  end if;

  -- Prefer AR invoice principal when available.
  -- This keeps ledger principal aligned with receivable principal for repair-line scenarios.
  select
    coalesce(sum(ai.total_cash_due_krw), 0),
    coalesce(sum(ai.labor_cash_due_krw), 0),
    count(*)
  into v_ar_total_sell, v_ar_total_labor, v_ar_count
  from public.cms_ar_invoice ai
  where ai.shipment_id = p_shipment_id;

  if v_ar_count > 0 then
    v_total_sell := v_ar_total_sell;
    v_total_labor := v_ar_total_labor;
  else
    select
      coalesce(sum(total_amount_sell_krw), 0),
      coalesce(sum(labor_total_sell_krw), 0)
    into v_total_sell, v_total_labor
    from public.cms_shipment_line
    where shipment_id = p_shipment_id;
  end if;

  select coalesce(sum(net_weight_g), 0)
  into v_total_weight
  from public.cms_shipment_line
  where shipment_id = p_shipment_id;

  if v_hdr.ar_principal_locked_at is not null then
    select
      coalesce(l.amount_krw, 0),
      coalesce(l.total_weight_g, 0),
      coalesce(l.total_labor_krw, 0)
    into v_existing_amount, v_existing_weight, v_existing_labor
    from public.cms_ar_ledger l
    where l.entry_type = 'SHIPMENT'
      and l.shipment_id = p_shipment_id
    limit 1;

    if found then
      if abs(v_existing_amount - v_total_sell) > v_eps
        or abs(v_existing_weight - v_total_weight) > v_eps
        or abs(v_existing_labor - v_total_labor) > v_eps then
        raise exception 'shipment ledger immutable after lock (shipment_id=%)', p_shipment_id;
      end if;

      return jsonb_build_object(
        'ok', true,
        'shipment_id', p_shipment_id,
        'ledger_total_krw', v_existing_amount,
        'locked_after_confirm', true
      );
    end if;

    insert into public.cms_ar_ledger(
      party_id,
      occurred_at,
      entry_type,
      amount_krw,
      shipment_id,
      memo,
      total_weight_g,
      total_labor_krw
    )
    values (
      v_hdr.customer_party_id,
      coalesce(v_hdr.confirmed_at, now()),
      'SHIPMENT',
      v_total_sell,
      p_shipment_id,
      p_note,
      v_total_weight,
      v_total_labor
    );

    return jsonb_build_object(
      'ok', true,
      'shipment_id', p_shipment_id,
      'ledger_total_krw', v_total_sell,
      'locked_after_confirm', true
    );
  end if;

  update public.cms_ar_ledger
  set
    amount_krw = v_total_sell,
    total_weight_g = v_total_weight,
    total_labor_krw = v_total_labor,
    memo = coalesce(p_note, memo)
  where entry_type = 'SHIPMENT'
    and shipment_id = p_shipment_id;

  get diagnostics v_affected = row_count;

  if v_affected = 0 then
    insert into public.cms_ar_ledger(
      party_id,
      occurred_at,
      entry_type,
      amount_krw,
      shipment_id,
      memo,
      total_weight_g,
      total_labor_krw
    )
    values (
      v_hdr.customer_party_id,
      coalesce(v_hdr.confirmed_at, now()),
      'SHIPMENT',
      v_total_sell,
      p_shipment_id,
      p_note,
      v_total_weight,
      v_total_labor
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'ledger_total_krw', v_total_sell,
    'locked_after_confirm', false
  );
end;
$$;

create or replace function public.cms_fn_verify_shipment_ar_consistency_v1(
  p_shipment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ship_total numeric := 0;
  v_invoice_total numeric := 0;
  v_ledger_total numeric := 0;
  v_invoice_count int := 0;
  v_ledger_row_count int := 0;
  v_has_repair_line boolean := false;
  v_diff_invoice_ledger numeric := 0;
  v_diff_ship_ledger numeric := 0;
  v_diff_ship_invoice numeric := 0;
  v_eps numeric := 0.5;
begin
  if p_shipment_id is null then
    raise exception 'shipment_id required';
  end if;

  select coalesce(sum(sl.total_amount_sell_krw), 0)
  into v_ship_total
  from public.cms_shipment_line sl
  where sl.shipment_id = p_shipment_id;

  select
    coalesce(sum(ai.total_cash_due_krw), 0),
    count(*)
  into v_invoice_total, v_invoice_count
  from public.cms_ar_invoice ai
  where ai.shipment_id = p_shipment_id;

  select
    coalesce(sum(l.amount_krw), 0),
    count(*)
  into v_ledger_total, v_ledger_row_count
  from public.cms_ar_ledger l
  where l.entry_type = 'SHIPMENT'
    and l.shipment_id = p_shipment_id;

  select exists (
    select 1
    from public.cms_shipment_line sl
    where sl.shipment_id = p_shipment_id
      and sl.repair_line_id is not null
  ) into v_has_repair_line;

  if v_invoice_count > 0 then
    v_diff_invoice_ledger := v_invoice_total - v_ledger_total;

    if abs(v_diff_invoice_ledger) > v_eps then
      perform public.cms_fn_sync_ar_ledger_from_shipment_v1(p_shipment_id, 'auto-sync from verify(invoice-first)');

      select
        coalesce(sum(l.amount_krw), 0),
        count(*)
      into v_ledger_total, v_ledger_row_count
      from public.cms_ar_ledger l
      where l.entry_type = 'SHIPMENT'
        and l.shipment_id = p_shipment_id;

      v_diff_invoice_ledger := v_invoice_total - v_ledger_total;
    end if;

    if abs(v_diff_invoice_ledger) > v_eps then
      raise exception 'shipment/ar invoice-ledger mismatch remains after sync (shipment_id=%, invoice_total=%, ledger_total=%, diff=%)',
        p_shipment_id, v_invoice_total, v_ledger_total, v_diff_invoice_ledger;
    end if;
  else
    v_diff_ship_ledger := v_ship_total - v_ledger_total;

    if abs(v_diff_ship_ledger) > v_eps then
      perform public.cms_fn_sync_ar_ledger_from_shipment_v1(p_shipment_id, 'auto-sync from verify(shipment-fallback)');

      select
        coalesce(sum(l.amount_krw), 0),
        count(*)
      into v_ledger_total, v_ledger_row_count
      from public.cms_ar_ledger l
      where l.entry_type = 'SHIPMENT'
        and l.shipment_id = p_shipment_id;

      v_diff_ship_ledger := v_ship_total - v_ledger_total;
    end if;

    if abs(v_diff_ship_ledger) > v_eps then
      raise exception 'shipment/ledger mismatch remains after sync (shipment_id=%, ship_total=%, ledger_total=%, diff=%)',
        p_shipment_id, v_ship_total, v_ledger_total, v_diff_ship_ledger;
    end if;
  end if;

  v_diff_ship_ledger := v_ship_total - v_ledger_total;
  v_diff_ship_invoice := v_ship_total - v_invoice_total;
  v_diff_invoice_ledger := v_invoice_total - v_ledger_total;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'source_of_truth', case when v_invoice_count > 0 then 'AR_INVOICE' else 'SHIPMENT_LINE_FALLBACK' end,
    'ship_total', v_ship_total,
    'invoice_total', v_invoice_total,
    'ledger_total', v_ledger_total,
    'invoice_count', v_invoice_count,
    'ledger_row_count', v_ledger_row_count,
    'has_repair_line', v_has_repair_line,
    'diff_ship_invoice', v_diff_ship_invoice,
    'diff_invoice_ledger', v_diff_invoice_ledger,
    'diff_ship_ledger', v_diff_ship_ledger,
    'ship_invoice_mismatch', (v_invoice_count > 0 and abs(v_diff_ship_invoice) > v_eps),
    'eps', v_eps
  );
end;
$$;

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
  v_already_confirmed_at timestamptz;
begin
  select confirmed_at
    into v_already_confirmed_at
  from public.cms_shipment_header
  where shipment_id = p_shipment_id;

  if v_already_confirmed_at is not null and not coalesce(p_force, false) then
    raise exception using
      errcode = 'P0001',
      message = format('shipment already confirmed: %s (forward-only guard; use p_force=true to override)', p_shipment_id);
  end if;

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

  begin
    perform public.cms_fn_apply_unit_pricing_floor_v1(p_shipment_id, p_actor_person_id, p_note);
  exception when undefined_function then
    null;
  end;

  perform public.cms_fn_apply_rule_rounding_by_master_unit_pricing_v1(p_shipment_id, p_actor_person_id, p_note);
  perform public.cms_fn_sync_repair_line_sell_totals_v1(p_shipment_id, p_note);

  -- Ensure AR invoice principal is created first, then sync/verify ledger against AR principal.
  perform public.cms_fn_ar_create_from_shipment_confirm_v1(p_shipment_id);
  perform public.cms_fn_sync_ar_ledger_from_shipment_v1(p_shipment_id, p_note);
  perform public.cms_fn_verify_shipment_ar_consistency_v1(p_shipment_id);

  update public.cms_shipment_header
  set ar_principal_locked_at = coalesce(ar_principal_locked_at, now())
  where shipment_id = p_shipment_id;

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
    return v_confirm || jsonb_build_object('purchase_cost', v_cost, 'correlation_id', v_corr, 'ar_principal_locked', true);
  end if;

  return v_confirm || jsonb_build_object('correlation_id', v_corr, 'ar_principal_locked', true);
end $$;

-- Backfill: for repair shipments, align SHIPMENT ledger principal to AR invoice principal.
with ar_sum as (
  select
    ai.shipment_id,
    coalesce(sum(ai.total_cash_due_krw), 0) as ar_total_krw,
    coalesce(sum(ai.labor_cash_due_krw), 0) as ar_labor_krw
  from public.cms_ar_invoice ai
  group by ai.shipment_id
),
repair_shipments as (
  select sl.shipment_id
  from public.cms_shipment_line sl
  where sl.repair_line_id is not null
  group by sl.shipment_id
)
update public.cms_ar_ledger l
set
  amount_krw = a.ar_total_krw,
  total_labor_krw = a.ar_labor_krw,
  memo = case
    when coalesce(l.memo, '') like '%[AR_LEDGER_SYNC_FROM_AR_INVOICE]%' then l.memo
    when coalesce(l.memo, '') = '' then '[AR_LEDGER_SYNC_FROM_AR_INVOICE]'
    else l.memo || ' [AR_LEDGER_SYNC_FROM_AR_INVOICE]'
  end
from ar_sum a
join repair_shipments rs on rs.shipment_id = a.shipment_id
where l.entry_type = 'SHIPMENT'
  and l.shipment_id = a.shipment_id
  and abs(coalesce(l.amount_krw, 0) - a.ar_total_krw) > 0.5;

commit;
