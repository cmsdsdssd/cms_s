-- 20260210xxxx_cms_shipments_print_ledger_statement_v2.sql
-- Add-only, conflict-safe (guarded create)
-- Goal: Shipments_print matches cms_ar_ledger perfectly (0 KRW drift), KST-day based

set search_path = public, pg_temp;

-- Optional perf index (safe)
create index if not exists idx_cms_ar_ledger_type_party_occurred_desc
  on public.cms_ar_ledger(entry_type, party_id, occurred_at desc);

do $do$
begin
  -- guard: do not overwrite if already exists (add-only)
  if to_regprocedure('public.cms_fn_shipments_print_ledger_statement_v2(uuid[],date)') is not null then
    raise notice 'cms_fn_shipments_print_ledger_statement_v2(uuid[],date) already exists. Skipping (add-only).';
    return;
  end if;

  execute $sql$
  create function public.cms_fn_shipments_print_ledger_statement_v2(
    p_party_ids uuid[] default null,
    p_kst_date date default (timezone('Asia/Seoul', now())::date)
  )
  returns table (
    party_id uuid,
    party_name text,
    kst_date date,
    kst_day_start timestamptz,
    kst_day_end timestamptz,

    prev_position jsonb,
    day_ledger_totals jsonb,
    end_position jsonb,

    details jsonb,
    checks jsonb
  )
  language sql
  security definer
  set search_path to 'public', 'pg_temp'
  as $fn$
  with bounds as (
    select
      (p_kst_date::timestamp at time zone 'Asia/Seoul') as s,
      ((p_kst_date + 1)::timestamp at time zone 'Asia/Seoul') as e
  ),

  party_set as (
    select distinct l.party_id
    from public.cms_ar_ledger l, bounds b
    where l.occurred_at < b.e
      and (p_party_ids is null or l.party_id = any(p_party_ids))
    union
    select distinct i.party_id
    from public.cms_ar_invoice i, bounds b
    where i.occurred_at < b.e
      and (p_party_ids is null or i.party_id = any(p_party_ids))
    union
    select unnest(p_party_ids)
    where p_party_ids is not null
  ),

  party_names as (
    select p.party_id, coalesce(cp.name, '-') as party_name
    from party_set p
    left join public.cms_party cp on cp.party_id = p.party_id
  ),

  -- =========================
  -- BALANCE (KRW) : ledger sum (NO CLAMP)
  -- =========================
  prev_balance as (
    select
      l.party_id,
      coalesce(sum(l.amount_krw), 0) as balance_krw
    from public.cms_ar_ledger l, bounds b
    where l.occurred_at < b.s
      and (p_party_ids is null or l.party_id = any(p_party_ids))
    group by l.party_id
  ),
  end_balance as (
    select
      l.party_id,
      coalesce(sum(l.amount_krw), 0) as balance_krw
    from public.cms_ar_ledger l, bounds b
    where l.occurred_at < b.e
      and (p_party_ids is null or l.party_id = any(p_party_ids))
    group by l.party_id
  ),

  -- =========================
  -- AS-OF OUTSTANDING (labor/gold/silver): reuse existing asof function
  -- NOTE: v1 clamps receivable_krw, but we ignore it for balance_krw.
  -- =========================
  prev_asof as (
    select *
    from public.cms_fn_ar_position_asof_v1(p_party_ids, (select s from bounds))
  ),
  end_asof as (
    select *
    from public.cms_fn_ar_position_asof_v1(p_party_ids, (select e from bounds))
  ),

  -- =========================
  -- DAY LEDGER TOTALS (KST day range) : pure ledger truth
  -- =========================
  day_ledger as (
    select
      l.party_id,
      coalesce(sum(l.amount_krw), 0) as delta_total_krw,
      coalesce(sum(case when l.entry_type='SHIPMENT' then l.amount_krw else 0 end), 0) as delta_shipment_krw,
      coalesce(sum(case when l.entry_type='RETURN'   then l.amount_krw else 0 end), 0) as delta_return_krw,
      coalesce(sum(case when l.entry_type='PAYMENT'  then l.amount_krw else 0 end), 0) as delta_payment_krw,
      coalesce(sum(case when l.entry_type='ADJUST'   then l.amount_krw else 0 end), 0) as delta_adjust_krw,
      coalesce(sum(case when l.entry_type='OFFSET'   then l.amount_krw else 0 end), 0) as delta_offset_krw
    from public.cms_ar_ledger l, bounds b
    where l.occurred_at >= b.s
      and l.occurred_at <  b.e
      and (p_party_ids is null or l.party_id = any(p_party_ids))
    group by l.party_id
  ),

  -- ============================================================
  -- DETAILS: SHIPMENTS (ledger SHIPMENT in day) + line allocation
  -- ============================================================
  ship_ledger as (
    select
      l.ar_ledger_id,
      l.party_id,
      l.occurred_at,
      l.shipment_id,
      l.amount_krw as ledger_amount_krw,
      l.memo as ledger_memo
    from public.cms_ar_ledger l, bounds b
    where l.entry_type='SHIPMENT'
      and l.shipment_id is not null
      and l.occurred_at >= b.s
      and l.occurred_at <  b.e
      and (p_party_ids is null or l.party_id = any(p_party_ids))
  ),

  ship_lines_base as (
    select
      led.ar_ledger_id,
      led.party_id,
      sl.shipment_id,
      sl.shipment_line_id,
      sl.repair_line_id,
      sl.model_name,
      sl.qty,
      sl.material_code,
      sl.net_weight_g,
      sl.color,
      sl.size,
      sl.labor_total_sell_krw,
      sl.material_amount_sell_krw,
      sl.repair_fee_krw,
      sl.total_amount_sell_krw as raw_amount_krw,
      sl.gold_tick_krw_per_g,
      sl.silver_tick_krw_per_g,
      sl.silver_adjust_factor,
      led.ledger_amount_krw,
      coalesce(sum(coalesce(sl.total_amount_sell_krw,0)) over (partition by led.ar_ledger_id), 0) as raw_sum_krw,
      row_number() over (partition by led.ar_ledger_id order by sl.shipment_line_id) as rn,
      count(*) over (partition by led.ar_ledger_id) as cnt
    from ship_ledger led
    join public.cms_shipment_line sl on sl.shipment_id = led.shipment_id
  ),

  ship_lines_floor as (
    select
      *,
      case
        when raw_sum_krw > 0 then floor((ledger_amount_krw * coalesce(raw_amount_krw,0)) / raw_sum_krw)
        else 0
      end as alloc_floor_krw
    from ship_lines_base
  ),

  ship_lines_final as (
    select
      *,
      (ledger_amount_krw - sum(alloc_floor_krw) over (partition by ar_ledger_id)) as remainder_krw,
      case
        when rn = cnt then alloc_floor_krw + (ledger_amount_krw - sum(alloc_floor_krw) over (partition by ar_ledger_id))
        else alloc_floor_krw
      end as amount_krw
    from ship_lines_floor
  ),

  ship_lines_json_real as (
    select
      ar_ledger_id,
      jsonb_agg(
        jsonb_build_object(
          'shipment_line_id', shipment_line_id,
          'repair_line_id', repair_line_id,
          'model_name', model_name,
          'qty', qty,
          'material_code', material_code,
          'net_weight_g', net_weight_g,
          'color', color,
          'size', size,
          'labor_total_sell_krw', labor_total_sell_krw,
          'material_amount_sell_krw', material_amount_sell_krw,
          'repair_fee_krw', repair_fee_krw,
          'gold_tick_krw_per_g', gold_tick_krw_per_g,
          'silver_tick_krw_per_g', silver_tick_krw_per_g,
          'silver_adjust_factor', silver_adjust_factor,
          'raw_amount_krw', coalesce(raw_amount_krw,0),
          'amount_krw', amount_krw,
          'synthetic', false
        )
        order by shipment_line_id
      ) as lines,
      coalesce(sum(coalesce(amount_krw,0)),0) as allocated_sum_krw,
      coalesce(sum(coalesce(raw_amount_krw,0)),0) as raw_sum_krw
    from ship_lines_final
    group by ar_ledger_id
  ),

  -- If shipment lines are missing (data inconsistency), create a single synthetic line
  ship_lines_json as (
    select
      led.ar_ledger_id,
      coalesce(real.lines,
        jsonb_build_array(
          jsonb_build_object(
            'shipment_line_id', null,
            'repair_line_id', null,
            'model_name', '(MISSING_LINES)',
            'qty', null,
            'material_code', null,
            'net_weight_g', null,
            'color', null,
            'size', null,
            'labor_total_sell_krw', null,
            'material_amount_sell_krw', null,
            'repair_fee_krw', null,
            'gold_tick_krw_per_g', null,
            'silver_tick_krw_per_g', null,
            'silver_adjust_factor', null,
            'raw_amount_krw', 0,
            'amount_krw', led.ledger_amount_krw,
            'synthetic', true
          )
        )
      ) as lines,
      coalesce(real.allocated_sum_krw, led.ledger_amount_krw) as allocated_sum_krw,
      coalesce(real.raw_sum_krw, 0) as raw_sum_krw
    from ship_ledger led
    left join ship_lines_json_real real on real.ar_ledger_id = led.ar_ledger_id
  ),

  shipments_json as (
    select
      led.party_id,
      jsonb_agg(
        jsonb_build_object(
          'ar_ledger_id', led.ar_ledger_id,
          'shipment_id', led.shipment_id,
          'ledger_occurred_at', led.occurred_at,
          'ledger_amount_krw', led.ledger_amount_krw,
          'ledger_memo', led.ledger_memo,

          'ship_date', sh.ship_date,
          'confirmed_at', sh.confirmed_at,
          'is_store_pickup', sh.is_store_pickup,
          'memo', sh.memo,
          'customer_party_id', sh.customer_party_id,
          'customer_name', cp.name,

          'lines_raw_sum_krw', lj.raw_sum_krw,
          'lines_allocated_sum_krw', lj.allocated_sum_krw,
          'lines', lj.lines,
          'lines_vs_ledger_diff_krw', (lj.allocated_sum_krw - led.ledger_amount_krw)
        )
        order by led.occurred_at, led.shipment_id
      ) as shipments
    from ship_ledger led
    left join public.cms_shipment_header sh on sh.shipment_id = led.shipment_id
    left join public.cms_party cp on cp.party_id = sh.customer_party_id
    left join ship_lines_json lj on lj.ar_ledger_id = led.ar_ledger_id
    group by led.party_id
  ),

  -- ============================================================
  -- DETAILS: RETURNS (ledger RETURN in day) : amount_krw = ledger
  -- ============================================================
  ret_ledger as (
    select
      l.ar_ledger_id,
      l.party_id,
      l.occurred_at,
      l.return_line_id,
      l.shipment_id,
      l.shipment_line_id,
      l.amount_krw as ledger_amount_krw,
      l.memo as ledger_memo
    from public.cms_ar_ledger l, bounds b
    where l.entry_type='RETURN'
      and l.return_line_id is not null
      and l.occurred_at >= b.s
      and l.occurred_at <  b.e
      and (p_party_ids is null or l.party_id = any(p_party_ids))
  ),

  returns_json as (
    select
      rl.party_id,
      jsonb_agg(
        jsonb_build_object(
          'ar_ledger_id', rl.ar_ledger_id,
          'return_line_id', rl.return_line_id,
          'ledger_occurred_at', rl.occurred_at,
          'amount_krw', rl.ledger_amount_krw,
          'ledger_memo', rl.ledger_memo,

          'return_qty', r.return_qty,
          'final_return_amount_krw', r.final_return_amount_krw,
          'shipment_id', rl.shipment_id,
          'shipment_line_id', rl.shipment_line_id,

          'model_name', sl.model_name,
          'qty', sl.qty,
          'material_code', sl.material_code,
          'net_weight_g', sl.net_weight_g,
          'color', sl.color,
          'size', sl.size,
          'labor_total_sell_krw', sl.labor_total_sell_krw,
          'material_amount_sell_krw', sl.material_amount_sell_krw,
          'total_amount_sell_krw', sl.total_amount_sell_krw,
          'gold_tick_krw_per_g', sl.gold_tick_krw_per_g,
          'silver_tick_krw_per_g', sl.silver_tick_krw_per_g,
          'silver_adjust_factor', sl.silver_adjust_factor,

          'return_vs_ledger_diff_krw', (coalesce(r.final_return_amount_krw,0) + rl.ledger_amount_krw)
        )
        order by rl.occurred_at, rl.return_line_id
      ) as returns
    from ret_ledger rl
    left join public.cms_return_line r on r.return_line_id = rl.return_line_id
    left join public.cms_shipment_line sl on sl.shipment_line_id = rl.shipment_line_id
    group by rl.party_id
  ),

  -- ============================================================
  -- DETAILS: PAYMENTS (ledger PAYMENT in day) + alloc breakdown
  -- ============================================================
  pay_ledger as (
    select
      l.ar_ledger_id,
      l.party_id,
      l.occurred_at,
      l.payment_id,
      l.amount_krw as ledger_amount_krw,
      l.memo as ledger_memo
    from public.cms_ar_ledger l, bounds b
    where l.entry_type='PAYMENT'
      and l.payment_id is not null
      and l.occurred_at >= b.s
      and l.occurred_at <  b.e
      and (p_party_ids is null or l.party_id = any(p_party_ids))
  ),

  pay_alloc_agg as (
    select
      d.payment_id,
      coalesce(sum(d.alloc_cash_krw), 0) as alloc_cash_krw,
      coalesce(sum(d.alloc_value_krw), 0) as alloc_value_krw,
      coalesce(sum(d.alloc_gold_g), 0) as alloc_gold_g,
      coalesce(sum(d.alloc_silver_g), 0) as alloc_silver_g,
      coalesce(sum(d.alloc_labor_krw), 0) as alloc_labor_krw,
      coalesce(sum(d.alloc_material_krw), 0) as alloc_material_krw,
      jsonb_agg(
        jsonb_build_object(
          'alloc_id', d.alloc_id,
          'ar_id', d.ar_id,
          'shipment_id', d.shipment_id,
          'shipment_line_id', d.shipment_line_id,
          'invoice_occurred_at', d.invoice_occurred_at,
          'model_name', d.model_name,
          'color', d.color,
          'size', d.size,
          'commodity_type', d.commodity_type,
          'commodity_price_snapshot_krw_per_g', d.commodity_price_snapshot_krw_per_g,
          'alloc_cash_krw', d.alloc_cash_krw,
          'alloc_value_krw', d.alloc_value_krw,
          'alloc_gold_g', d.alloc_gold_g,
          'alloc_silver_g', d.alloc_silver_g,
          'alloc_labor_krw', d.alloc_labor_krw,
          'alloc_material_krw', d.alloc_material_krw,
          'alloc_created_at', d.alloc_created_at
        )
        order by d.alloc_created_at, d.alloc_id
      ) filter (where d.alloc_id is not null) as alloc_lines
    from public.cms_v_ar_payment_alloc_detail_v1 d
    where exists (select 1 from pay_ledger pl where pl.payment_id = d.payment_id)
    group by d.payment_id
  ),

  payments_json as (
    select
      pl.party_id,
      jsonb_agg(
        jsonb_build_object(
          'ar_ledger_id', pl.ar_ledger_id,
          'payment_id', pl.payment_id,
          'ledger_occurred_at', pl.occurred_at,
          'ledger_amount_krw', pl.ledger_amount_krw,
          'ledger_memo', pl.ledger_memo,

          'paid_at', ap.paid_at,
          'cash_krw', ap.cash_krw,
          'gold_g', ap.gold_g,
          'silver_g', ap.silver_g,
          'note', ap.note,

          'alloc_cash_krw', coalesce(pa.alloc_cash_krw, 0),
          'alloc_value_krw', coalesce(pa.alloc_value_krw, 0),
          'alloc_gold_g', coalesce(pa.alloc_gold_g, 0),
          'alloc_silver_g', coalesce(pa.alloc_silver_g, 0),
          'alloc_labor_krw', coalesce(pa.alloc_labor_krw, 0),
          'alloc_material_krw', coalesce(pa.alloc_material_krw, 0),
          'alloc_lines', coalesce(pa.alloc_lines, '[]'::jsonb),

          -- expected: ledger PAYMENT = -(cash + alloc_value) [rounded]
          'expected_ledger_amount_krw', -round(coalesce(ap.cash_krw,0) + coalesce(pa.alloc_value_krw,0), 0),
          'ledger_vs_expected_diff_krw', (pl.ledger_amount_krw + round(coalesce(ap.cash_krw,0) + coalesce(pa.alloc_value_krw,0), 0)),

          'unallocated_cash_krw', greatest(round(coalesce(ap.cash_krw,0) - coalesce(pa.alloc_cash_krw,0), 0), 0)
        )
        order by pl.occurred_at, pl.payment_id
      ) as payments
    from pay_ledger pl
    left join public.cms_ar_payment ap on ap.payment_id = pl.payment_id
    left join pay_alloc_agg pa on pa.payment_id = pl.payment_id
    group by pl.party_id
  ),

  -- ============================================================
  -- DETAILS: ADJUST / OFFSET (pure ledger rows)
  -- ============================================================
  adjust_json as (
    select
      l.party_id,
      jsonb_agg(
        jsonb_build_object(
          'ar_ledger_id', l.ar_ledger_id,
          'occurred_at', l.occurred_at,
          'amount_krw', l.amount_krw,
          'memo', l.memo,
          'shipment_id', l.shipment_id,
          'shipment_line_id', l.shipment_line_id,
          'payment_id', l.payment_id,
          'return_line_id', l.return_line_id
        )
        order by l.occurred_at, l.ar_ledger_id
      ) as adjusts
    from public.cms_ar_ledger l, bounds b
    where l.entry_type='ADJUST'
      and l.occurred_at >= b.s
      and l.occurred_at <  b.e
      and (p_party_ids is null or l.party_id = any(p_party_ids))
    group by l.party_id
  ),

  offset_json as (
    select
      l.party_id,
      jsonb_agg(
        jsonb_build_object(
          'ar_ledger_id', l.ar_ledger_id,
          'occurred_at', l.occurred_at,
          'amount_krw', l.amount_krw,
          'memo', l.memo,
          'shipment_id', l.shipment_id,
          'shipment_line_id', l.shipment_line_id,
          'payment_id', l.payment_id,
          'return_line_id', l.return_line_id
        )
        order by l.occurred_at, l.ar_ledger_id
      ) as offsets
    from public.cms_ar_ledger l, bounds b
    where l.entry_type='OFFSET'
      and l.occurred_at >= b.s
      and l.occurred_at <  b.e
      and (p_party_ids is null or l.party_id = any(p_party_ids))
    group by l.party_id
  ),

  details_json as (
    select
      p.party_id,
      jsonb_build_object(
        'shipments', coalesce(sj.shipments, '[]'::jsonb),
        'returns',   coalesce(rj.returns,   '[]'::jsonb),
        'payments',  coalesce(pj.payments,  '[]'::jsonb),
        'adjusts',   coalesce(aj.adjusts,   '[]'::jsonb),
        'offsets',   coalesce(oj.offsets,   '[]'::jsonb)
      ) as details
    from party_set p
    left join shipments_json sj on sj.party_id = p.party_id
    left join returns_json   rj on rj.party_id = p.party_id
    left join payments_json  pj on pj.party_id = p.party_id
    left join adjust_json    aj on aj.party_id = p.party_id
    left join offset_json    oj on oj.party_id = p.party_id
  ),

  -- ============================================================
  -- CHECKS (for FE PASS/FAIL badge)
  -- ============================================================
  ship_alloc_party_sum as (
    select
      led.party_id,
      coalesce(sum(lj.allocated_sum_krw),0) as ship_lines_sum_krw
    from ship_ledger led
    left join ship_lines_json lj on lj.ar_ledger_id = led.ar_ledger_id
    group by led.party_id
  ),
  ret_party_sum as (
    select
      party_id,
      coalesce(sum(ledger_amount_krw),0) as return_sum_krw
    from ret_ledger
    group by party_id
  )

  select
    pn.party_id,
    pn.party_name,
    p_kst_date as kst_date,
    (select s from bounds) as kst_day_start,
    (select e from bounds) as kst_day_end,

    jsonb_build_object(
      'balance_krw', coalesce(pb.balance_krw, 0),
      'receivable_krw', greatest(coalesce(pb.balance_krw, 0), 0),
      'credit_krw', least(coalesce(pb.balance_krw, 0), 0),
      'labor_cash_outstanding_krw', coalesce(pa.labor_cash_outstanding_krw, 0),
      'gold_outstanding_g', coalesce(pa.gold_outstanding_g, 0),
      'silver_outstanding_g', coalesce(pa.silver_outstanding_g, 0)
    ) as prev_position,

    jsonb_build_object(
      'delta_total_krw',    coalesce(dl.delta_total_krw, 0),
      'delta_shipment_krw', coalesce(dl.delta_shipment_krw, 0),
      'delta_return_krw',   coalesce(dl.delta_return_krw, 0),
      'delta_payment_krw',  coalesce(dl.delta_payment_krw, 0),
      'delta_adjust_krw',   coalesce(dl.delta_adjust_krw, 0),
      'delta_offset_krw',   coalesce(dl.delta_offset_krw, 0)
    ) as day_ledger_totals,

    jsonb_build_object(
      'balance_krw', coalesce(eb.balance_krw, 0),
      'receivable_krw', greatest(coalesce(eb.balance_krw, 0), 0),
      'credit_krw', least(coalesce(eb.balance_krw, 0), 0),
      'labor_cash_outstanding_krw', coalesce(ea.labor_cash_outstanding_krw, 0),
      'gold_outstanding_g', coalesce(ea.gold_outstanding_g, 0),
      'silver_outstanding_g', coalesce(ea.silver_outstanding_g, 0)
    ) as end_position,

    coalesce(dj.details, '{}'::jsonb) as details,

    jsonb_build_object(
      'check_end_equals_prev_plus_delta_krw',
        (coalesce(eb.balance_krw,0) - (coalesce(pb.balance_krw,0) + coalesce(dl.delta_total_krw,0))),
      'check_ship_lines_equals_ledger_shipment_krw',
        (coalesce(sa.ship_lines_sum_krw,0) - coalesce(dl.delta_shipment_krw,0)),
      'check_return_sum_equals_ledger_return_krw',
        (coalesce(rs.return_sum_krw,0) - coalesce(dl.delta_return_krw,0))
    ) as checks

  from party_names pn
  left join prev_balance pb on pb.party_id = pn.party_id
  left join end_balance  eb on eb.party_id = pn.party_id
  left join day_ledger   dl on dl.party_id = pn.party_id
  left join prev_asof    pa on pa.party_id = pn.party_id
  left join end_asof     ea on ea.party_id = pn.party_id
  left join details_json dj on dj.party_id = pn.party_id
  left join ship_alloc_party_sum sa on sa.party_id = pn.party_id
  left join ret_party_sum rs on rs.party_id = pn.party_id
  order by pn.party_id;
  $fn$;
  $sql$;

end
$do$;

grant execute on function public.cms_fn_shipments_print_ledger_statement_v2(uuid[], date)
  to authenticated;
