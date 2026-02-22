-- cms_0717: verify AR SOT using invoice-first rule and add drift report RPC

begin;

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

create or replace function public.cms_fn_ar_sot_drift_report_v1(
  p_limit int default 200
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with targets as (
    select
      sh.shipment_id,
      sh.confirmed_at,
      sh.ar_principal_locked_at
    from public.cms_shipment_header sh
    where sh.confirmed_at is not null
    order by sh.confirmed_at desc
    limit greatest(coalesce(p_limit, 200), 1)
  ),
  ship_sum as (
    select sl.shipment_id, coalesce(sum(sl.total_amount_sell_krw), 0) as ship_total
    from public.cms_shipment_line sl
    join targets t on t.shipment_id = sl.shipment_id
    group by sl.shipment_id
  ),
  inv_sum as (
    select ai.shipment_id,
           coalesce(sum(ai.total_cash_due_krw), 0) as invoice_total,
           count(*) as invoice_count
    from public.cms_ar_invoice ai
    join targets t on t.shipment_id = ai.shipment_id
    group by ai.shipment_id
  ),
  led_sum as (
    select l.shipment_id,
           coalesce(sum(l.amount_krw), 0) as ledger_total,
           count(*) as ledger_row_count
    from public.cms_ar_ledger l
    join targets t on t.shipment_id = l.shipment_id
    where l.entry_type = 'SHIPMENT'
    group by l.shipment_id
  ),
  repair as (
    select sl.shipment_id,
           bool_or(sl.repair_line_id is not null) as has_repair_line
    from public.cms_shipment_line sl
    join targets t on t.shipment_id = sl.shipment_id
    group by sl.shipment_id
  ),
  rows as (
    select
      t.shipment_id,
      t.confirmed_at,
      t.ar_principal_locked_at,
      coalesce(ss.ship_total, 0) as ship_total,
      coalesce(iv.invoice_total, 0) as invoice_total,
      coalesce(ls.ledger_total, 0) as ledger_total,
      coalesce(iv.invoice_count, 0) as invoice_count,
      coalesce(ls.ledger_row_count, 0) as ledger_row_count,
      coalesce(rp.has_repair_line, false) as has_repair_line,
      coalesce(ss.ship_total, 0) - coalesce(iv.invoice_total, 0) as diff_ship_invoice,
      coalesce(iv.invoice_total, 0) - coalesce(ls.ledger_total, 0) as diff_invoice_ledger,
      coalesce(ss.ship_total, 0) - coalesce(ls.ledger_total, 0) as diff_ship_ledger
    from targets t
    left join ship_sum ss on ss.shipment_id = t.shipment_id
    left join inv_sum iv on iv.shipment_id = t.shipment_id
    left join led_sum ls on ls.shipment_id = t.shipment_id
    left join repair rp on rp.shipment_id = t.shipment_id
  )
  select jsonb_build_object(
    'ok', true,
    'count', count(*),
    'invoice_ledger_mismatch_count', count(*) filter (where abs(diff_invoice_ledger) > 0.5),
    'ship_invoice_mismatch_count', count(*) filter (where invoice_count > 0 and abs(diff_ship_invoice) > 0.5),
    'rows', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'shipment_id', shipment_id,
          'confirmed_at', confirmed_at,
          'ar_principal_locked_at', ar_principal_locked_at,
          'ship_total', ship_total,
          'invoice_total', invoice_total,
          'ledger_total', ledger_total,
          'invoice_count', invoice_count,
          'ledger_row_count', ledger_row_count,
          'has_repair_line', has_repair_line,
          'diff_ship_invoice', diff_ship_invoice,
          'diff_invoice_ledger', diff_invoice_ledger,
          'diff_ship_ledger', diff_ship_ledger
        )
        order by confirmed_at desc
      ),
      '[]'::jsonb
    )
  )
  from rows;
$$;

grant execute on function public.cms_fn_verify_shipment_ar_consistency_v1(uuid)
  to authenticated, service_role;

grant execute on function public.cms_fn_ar_sot_drift_report_v1(int)
  to authenticated, service_role;

commit;
