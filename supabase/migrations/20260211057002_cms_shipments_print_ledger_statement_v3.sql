-- 20260211xxxx_cms_shipments_print_ledger_statement_v3.sql
-- ADD-ONLY / conflict-safe (guarded create)
-- Purpose: Provide STRICT-SOT day breakdown for labor/gold/silver by category,
--          with OTHER residual so that sum(category deltas) == (end_position - prev_position) ALWAYS.

set search_path = public, pg_temp;
-- Optional perf indexes (safe)
create index if not exists idx_cms_ar_invoice_party_occurred_at
  on public.cms_ar_invoice(party_id, occurred_at);
create index if not exists idx_cms_return_line_occurred_at_shipment_line_id
  on public.cms_return_line(occurred_at, shipment_line_id);
create index if not exists idx_cms_ar_payment_party_paid_at
  on public.cms_ar_payment(party_id, paid_at);
create index if not exists idx_cms_ar_payment_alloc_payment_id
  on public.cms_ar_payment_alloc(payment_id);
do $do$
begin
  -- guard: do not overwrite if already exists (add-only)
  if to_regprocedure('public.cms_fn_shipments_print_ledger_statement_v3(uuid[],date)') is not null then
    raise notice 'cms_fn_shipments_print_ledger_statement_v3(uuid[],date) already exists. Skipping (add-only).';
    return;
  end if;

  -- v3 depends on v2 (add-only safety)
  if to_regprocedure('public.cms_fn_shipments_print_ledger_statement_v2(uuid[],date)') is null then
    raise exception 'cms_fn_shipments_print_ledger_statement_v2(uuid[],date) is required before creating v3.';
  end if;

  execute $sql$
  create function public.cms_fn_shipments_print_ledger_statement_v3(
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

    -- NEW: strict SOT day breakdown (labor/gold/silver) + ledger KRW by category + OTHER residual
    day_breakdown jsonb,

    details jsonb,
    checks jsonb
  )
  language sql
  security definer
  set search_path to 'public', 'pg_temp'
  as $fn$
  with base as (
    select *
    from public.cms_fn_shipments_print_ledger_statement_v2(p_party_ids, p_kst_date)
  )
  select
    b.party_id,
    b.party_name,
    b.kst_date,
    b.kst_day_start,
    b.kst_day_end,
    b.prev_position,
    b.day_ledger_totals,
    b.end_position,

    x.day_breakdown,

    b.details,
    (b.checks || x.checks_extra) as checks

  from base b
  left join lateral (
    with pos as (
      select
        coalesce((b.prev_position->>'labor_cash_outstanding_krw')::numeric, 0) as prev_labor_krw,
        coalesce((b.prev_position->>'gold_outstanding_g')::numeric, 0) as prev_gold_g,
        coalesce((b.prev_position->>'silver_outstanding_g')::numeric, 0) as prev_silver_g,

        coalesce((b.end_position->>'labor_cash_outstanding_krw')::numeric, 0) as end_labor_krw,
        coalesce((b.end_position->>'gold_outstanding_g')::numeric, 0) as end_gold_g,
        coalesce((b.end_position->>'silver_outstanding_g')::numeric, 0) as end_silver_g,

        coalesce((b.day_ledger_totals->>'delta_total_krw')::numeric, 0) as d_total_krw,
        coalesce((b.day_ledger_totals->>'delta_shipment_krw')::numeric, 0) as d_ship_krw,
        coalesce((b.day_ledger_totals->>'delta_return_krw')::numeric, 0) as d_ret_krw,
        coalesce((b.day_ledger_totals->>'delta_payment_krw')::numeric, 0) as d_pay_krw,
        coalesce((b.day_ledger_totals->>'delta_adjust_krw')::numeric, 0) as d_adj_krw,
        coalesce((b.day_ledger_totals->>'delta_offset_krw')::numeric, 0) as d_off_krw
    ),

    -- 1) SHIPMENT effect (as-of semantics): invoices occurred within [day_start, day_end)
    ship_due as (
      select
        coalesce(sum(i.labor_cash_due_krw), 0) as labor_krw,
        coalesce(sum(case when i.commodity_type='gold'::public.cms_e_commodity_type then i.commodity_due_g else 0 end), 0) as gold_g,
        coalesce(sum(case when i.commodity_type='silver'::public.cms_e_commodity_type then i.commodity_due_g else 0 end), 0) as silver_g
      from public.cms_ar_invoice i
      where i.party_id = b.party_id
        and i.occurred_at >= b.kst_day_start
        and i.occurred_at <  b.kst_day_end
    ),

    -- 2) RETURN effect (as-of semantics): return_line occurred within [day_start, day_end)
    --    Apply same proportional logic used by asof function/view.
    ret_in_day as (
      select
        r.shipment_line_id,
        coalesce(sum(r.final_return_amount_krw), 0) as return_amount_krw
      from public.cms_return_line r
      join public.cms_ar_invoice i on i.shipment_line_id = r.shipment_line_id
      where i.party_id = b.party_id
        and r.occurred_at >= b.kst_day_start
        and r.occurred_at <  b.kst_day_end
      group by r.shipment_line_id
    ),
    ret_effect as (
      select
        -- negative: returns reduce outstanding
        -coalesce(sum(
          case when coalesce(i.total_cash_due_krw, 0) > 0
            then ri.return_amount_krw * (coalesce(i.labor_cash_due_krw, 0) / i.total_cash_due_krw)
            else 0
          end
        ), 0) as labor_krw,

        -coalesce(sum(
          case
            when i.commodity_type='gold'::public.cms_e_commodity_type
             and coalesce(i.commodity_price_snapshot_krw_per_g, 0) > 0
             and coalesce(i.total_cash_due_krw, 0) > 0
            then (ri.return_amount_krw * (coalesce(i.material_cash_due_krw, 0) / i.total_cash_due_krw))
                 / i.commodity_price_snapshot_krw_per_g
            else 0
          end
        ), 0) as gold_g,

        -coalesce(sum(
          case
            when i.commodity_type='silver'::public.cms_e_commodity_type
             and coalesce(i.commodity_price_snapshot_krw_per_g, 0) > 0
             and coalesce(i.total_cash_due_krw, 0) > 0
            then (ri.return_amount_krw * (coalesce(i.material_cash_due_krw, 0) / i.total_cash_due_krw))
                 / i.commodity_price_snapshot_krw_per_g
            else 0
          end
        ), 0) as silver_g
      from ret_in_day ri
      join public.cms_ar_invoice i on i.shipment_line_id = ri.shipment_line_id
      where i.party_id = b.party_id
    ),

    -- 3) Identify "adjust-like" payments inside the day:
    --    If a ledger ADJUST row references payment_id during the day, treat its allocations as ADJUST bucket,
    --    so "완불/정정" does not get mixed into "결제" bucket.
    adjust_payment_ids as (
      select distinct l.payment_id
      from public.cms_ar_ledger l
      where l.party_id = b.party_id
        and l.entry_type = 'ADJUST'
        and l.payment_id is not null
        and l.occurred_at >= b.kst_day_start
        and l.occurred_at <  b.kst_day_end
    ),

    -- 4) OFFSET allocations tied to OFFSET actions (only if payment.paid_at is in day; aligns with asof boundary-crossing)
    offset_alloc as (
      select
        aa.alloc_id,
        aa.payment_id,
        aa.ar_id,
        coalesce(aa.alloc_labor_krw, 0) as alloc_labor_krw
      from public.cms_ar_manual_action ma
      join public.cms_ar_manual_action_alloc aa on aa.action_id = ma.action_id
      join public.cms_ar_payment p on p.payment_id = aa.payment_id
      where ma.party_id = b.party_id
        and ma.action_kind = 'OFFSET'
        and ma.occurred_at >= b.kst_day_start
        and ma.occurred_at <  b.kst_day_end
        and p.paid_at >= b.kst_day_start
        and p.paid_at <  b.kst_day_end
    ),

    -- 5) PAYMENT allocations within the day (paid_at boundary-crossing)
    --    Exclude:
    --      - adjust-like payments (linked to ledger ADJUST within the day) -> will go to ADJUST bucket
    --      - offset_alloc alloc_id (to avoid double count) -> will go to OFFSET bucket
    pay_alloc_normal as (
      select
        -coalesce(sum(a.alloc_labor_krw), 0) as labor_krw,
        -coalesce(sum(a.alloc_gold_g), 0) as gold_g,
        -coalesce(sum(a.alloc_silver_g), 0) as silver_g
      from public.cms_ar_payment_alloc a
      join public.cms_ar_payment p on p.payment_id = a.payment_id
      where p.party_id = b.party_id
        and p.paid_at >= b.kst_day_start
        and p.paid_at <  b.kst_day_end
        and p.payment_id not in (select payment_id from adjust_payment_ids)
        and a.alloc_id not in (select alloc_id from offset_alloc)
    ),

    -- 6) ADJUST allocations (e.g., SERVICE_WRITEOFF, ADJUST_DOWN/UP, etc.) within the day
    pay_alloc_adjust as (
      select
        -coalesce(sum(a.alloc_labor_krw), 0) as labor_krw,
        -coalesce(sum(a.alloc_gold_g), 0) as gold_g,
        -coalesce(sum(a.alloc_silver_g), 0) as silver_g
      from public.cms_ar_payment_alloc a
      join public.cms_ar_payment p on p.payment_id = a.payment_id
      where p.party_id = b.party_id
        and p.paid_at >= b.kst_day_start
        and p.paid_at <  b.kst_day_end
        and p.payment_id in (select payment_id from adjust_payment_ids)
        and a.alloc_id not in (select alloc_id from offset_alloc)
    ),

    -- 7) OFFSET bucket effect on labor (offset actions allocate cash->labor/material; gold/silver alloc not used here)
    off_effect as (
      select
        -coalesce(sum(o.alloc_labor_krw), 0) as labor_krw
      from offset_alloc o
    ),

    -- 8) Compute STRICT-SOT deltas and residual OTHER (guarantees Σ == end-prev)
    calc as (
      select
        (pos.end_labor_krw - pos.prev_labor_krw) as delta_labor_krw,
        (pos.end_gold_g   - pos.prev_gold_g)   as delta_gold_g,
        (pos.end_silver_g - pos.prev_silver_g) as delta_silver_g,

        coalesce(sd.labor_krw, 0) as ship_labor_krw,
        coalesce(sd.gold_g, 0)    as ship_gold_g,
        coalesce(sd.silver_g, 0)  as ship_silver_g,

        coalesce(re.labor_krw, 0) as ret_labor_krw,
        coalesce(re.gold_g, 0)    as ret_gold_g,
        coalesce(re.silver_g, 0)  as ret_silver_g,

        coalesce(pn.labor_krw, 0) as pay_labor_krw,
        coalesce(pn.gold_g, 0)    as pay_gold_g,
        coalesce(pn.silver_g, 0)  as pay_silver_g,

        coalesce(pa.labor_krw, 0) as adj_labor_krw,
        coalesce(pa.gold_g, 0)    as adj_gold_g,
        coalesce(pa.silver_g, 0)  as adj_silver_g,

        coalesce(ofx.labor_krw, 0) as off_labor_krw,

        -- ledger-other for KRW (unknown entry_type etc.)
        (pos.d_total_krw - (pos.d_ship_krw + pos.d_ret_krw + pos.d_pay_krw + pos.d_adj_krw + pos.d_off_krw)) as other_krw
      from pos
      left join ship_due sd on true
      left join ret_effect re on true
      left join pay_alloc_normal pn on true
      left join pay_alloc_adjust pa on true
      left join off_effect ofx on true
    ),

    residual as (
      select
        c.*,

        -- explained sums (without OTHER)
        (c.ship_labor_krw + c.ret_labor_krw + c.pay_labor_krw + c.adj_labor_krw + c.off_labor_krw) as explained_labor_krw,
        (c.ship_gold_g   + c.ret_gold_g   + c.pay_gold_g   + c.adj_gold_g)                        as explained_gold_g,
        (c.ship_silver_g + c.ret_silver_g + c.pay_silver_g + c.adj_silver_g)                      as explained_silver_g,

        -- STRICT residual OTHER so that Σ == end-prev ALWAYS (SOT guarantee)
        (c.delta_labor_krw - (c.ship_labor_krw + c.ret_labor_krw + c.pay_labor_krw + c.adj_labor_krw + c.off_labor_krw)) as other_labor_krw,
        (c.delta_gold_g    - (c.ship_gold_g   + c.ret_gold_g   + c.pay_gold_g   + c.adj_gold_g))                         as other_gold_g,
        (c.delta_silver_g  - (c.ship_silver_g + c.ret_silver_g + c.pay_silver_g + c.adj_silver_g))                       as other_silver_g
      from calc c
    )

    select
      jsonb_build_object(
        'shipment', jsonb_build_object(
          'krw',      (select d_ship_krw from pos),
          'labor_krw', (select ship_labor_krw from residual),
          'gold_g',    (select ship_gold_g from residual),
          'silver_g',  (select ship_silver_g from residual)
        ),
        'return', jsonb_build_object(
          'krw',      (select d_ret_krw from pos),
          'labor_krw', (select ret_labor_krw from residual),
          'gold_g',    (select ret_gold_g from residual),
          'silver_g',  (select ret_silver_g from residual)
        ),
        'payment', jsonb_build_object(
          'krw',      (select d_pay_krw from pos),
          'labor_krw', (select pay_labor_krw from residual),
          'gold_g',    (select pay_gold_g from residual),
          'silver_g',  (select pay_silver_g from residual)
        ),
        'adjust', jsonb_build_object(
          'krw',      (select d_adj_krw from pos),
          'labor_krw', (select adj_labor_krw from residual),
          'gold_g',    (select adj_gold_g from residual),
          'silver_g',  (select adj_silver_g from residual)
        ),
        'offset', jsonb_build_object(
          'krw',      (select d_off_krw from pos),
          'labor_krw', (select off_labor_krw from residual),
          'gold_g',    0,
          'silver_g',  0
        ),
        'other', jsonb_build_object(
          'krw',      (select other_krw from residual),
          'labor_krw', (select other_labor_krw from residual),
          'gold_g',    (select other_gold_g from residual),
          'silver_g',  (select other_silver_g from residual)
        ),
        'delta_end_minus_prev', jsonb_build_object(
          'labor_krw', (select delta_labor_krw from residual),
          'gold_g',    (select delta_gold_g from residual),
          'silver_g',  (select delta_silver_g from residual)
        ),
        'explained_sum_without_other', jsonb_build_object(
          'labor_krw', (select explained_labor_krw from residual),
          'gold_g',    (select explained_gold_g from residual),
          'silver_g',  (select explained_silver_g from residual)
        )
      ) as day_breakdown,

      -- checks_extra: we don't block printing on OTHER != 0; we expose it transparently.
      jsonb_build_object(
        'delta_labor_end_minus_prev_krw', (select delta_labor_krw from residual),
        'delta_gold_end_minus_prev_g',    (select delta_gold_g from residual),
        'delta_silver_end_minus_prev_g',  (select delta_silver_g from residual),

        'explained_labor_sum_krw',        (select explained_labor_krw from residual),
        'explained_gold_sum_g',           (select explained_gold_g from residual),
        'explained_silver_sum_g',         (select explained_silver_g from residual),

        'other_labor_krw',                (select other_labor_krw from residual),
        'other_gold_g',                   (select other_gold_g from residual),
        'other_silver_g',                 (select other_silver_g from residual),

        -- SOT identity check: should always be 0 by construction (kept for auditing)
        'check_breakdown_labor_equals_end_minus_prev',
          (select (delta_labor_krw - (explained_labor_krw + other_labor_krw)) from residual),
        'check_breakdown_gold_equals_end_minus_prev',
          (select (delta_gold_g - (explained_gold_g + other_gold_g)) from residual),
        'check_breakdown_silver_equals_end_minus_prev',
          (select (delta_silver_g - (explained_silver_g + other_silver_g)) from residual)
      ) as checks_extra
  ) x on true;

  $fn$;
  $sql$;

end
$do$;
grant execute on function public.cms_fn_shipments_print_ledger_statement_v3(uuid[], date)
  to authenticated;
