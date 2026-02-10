-- 20260210130000_cms_0500_shipments_print_ledger_statement_v1.sql
-- add-only: ledger-perfect KST daily statement for shipments_print
-- 핵심 원칙: "무엇이 당일 포함인가"는 cms_ar_ledger.occurred_at(KST day bounds)만 사용

set search_path = public, pg_temp;

-- (옵션) 성능 보강 인덱스 (이미 있으면 스킵)
create index if not exists idx_cms_ar_ledger_type_party_occurred
  on public.cms_ar_ledger(entry_type, party_id, occurred_at desc);

-- 메인 RPC: party_ids + kst_date 로 "원장 기준 완벽 정합" 일일 스테이트먼트 반환
create or replace function public.cms_fn_shipments_print_ledger_statement_v1(
  p_party_ids uuid[] default null,
  p_kst_date date default (timezone('Asia/Seoul', now())::date)
)
returns table (
  party_id uuid,
  kst_date date,
  kst_day_start timestamptz,
  kst_day_end timestamptz,

  prev_position jsonb,
  day_ledger_totals jsonb,
  end_position jsonb,

  details jsonb
)
language sql
security definer
set search_path to 'public', 'pg_temp'
as $$
with bounds as (
  select
    (p_kst_date::timestamp at time zone 'Asia/Seoul') as s,
    ((p_kst_date + 1)::timestamp at time zone 'Asia/Seoul') as e
),

-- 출력 대상 party set (명시 party_ids 우선 + 원장에 존재하는 party)
party_set as (
  select distinct l.party_id
  from public.cms_ar_ledger l, bounds b
  where l.occurred_at < b.e
    and (p_party_ids is null or l.party_id = any(p_party_ids))
  union
  select unnest(p_party_ids)
  where p_party_ids is not null
),

-- 전일 스냅샷(이미 존재하는 add-only RPC 재사용)
prev_pos as (
  select *
  from public.cms_fn_ar_position_asof_v1(p_party_ids, (select s from bounds))
),
end_pos as (
  select *
  from public.cms_fn_ar_position_asof_v1(p_party_ids, (select e from bounds))
),

-- 당일 원장 집계(완전한 truth)
day_ledger as (
  select
    l.party_id,
    coalesce(sum(l.amount_krw), 0) as delta_total_krw,
    coalesce(sum(case when l.entry_type = 'SHIPMENT' then l.amount_krw else 0 end), 0) as delta_shipment_krw,
    coalesce(sum(case when l.entry_type = 'RETURN'   then l.amount_krw else 0 end), 0) as delta_return_krw,
    coalesce(sum(case when l.entry_type = 'PAYMENT'  then l.amount_krw else 0 end), 0) as delta_payment_krw,
    coalesce(sum(case when l.entry_type = 'ADJUST'   then l.amount_krw else 0 end), 0) as delta_adjust_krw,
    coalesce(sum(case when l.entry_type = 'OFFSET'   then l.amount_krw else 0 end), 0) as delta_offset_krw
  from public.cms_ar_ledger l, bounds b
  where l.occurred_at >= b.s
    and l.occurred_at <  b.e
    and (p_party_ids is null or l.party_id = any(p_party_ids))
  group by l.party_id
),

/* =========================
   SHIPMENTS (SHIPMENT ledger 기반)
   - 포함 기준: ledger(entry_type='SHIPMENT', occurred_at in KST day)
   - 라인 금액: 원장금액을 라인 raw_amount 비율로 배분 + 마지막 라인 잔차 보정 (합=원장)
   ========================= */
ship_ledger as (
  select
    l.party_id,
    l.occurred_at,
    l.shipment_id,
    l.amount_krw as ledger_amount_krw,
    l.memo as ledger_memo
  from public.cms_ar_ledger l, bounds b
  where l.entry_type = 'SHIPMENT'
    and l.shipment_id is not null
    and l.occurred_at >= b.s
    and l.occurred_at <  b.e
    and (p_party_ids is null or l.party_id = any(p_party_ids))
),

ship_lines_base as (
  select
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
    coalesce(sl.total_amount_sell_krw, 0) as raw_amount_krw,
    led.ledger_amount_krw,
    coalesce(sum(coalesce(sl.total_amount_sell_krw, 0)) over (partition by sl.shipment_id), 0) as raw_sum_krw,
    row_number() over (partition by sl.shipment_id order by sl.shipment_line_id) as rn,
    count(*) over (partition by sl.shipment_id) as cnt
  from public.cms_shipment_line sl
  join ship_ledger led on led.shipment_id = sl.shipment_id
),

ship_lines_floor as (
  select
    *,
    case
      when raw_sum_krw > 0 then floor((ledger_amount_krw * raw_amount_krw) / raw_sum_krw)
      else 0
    end as alloc_floor_krw
  from ship_lines_base
),

ship_lines_final as (
  select
    *,
    (ledger_amount_krw - sum(alloc_floor_krw) over (partition by shipment_id)) as remainder_krw,
    case
      when rn = cnt then alloc_floor_krw + (ledger_amount_krw - sum(alloc_floor_krw) over (partition by shipment_id))
      else alloc_floor_krw
    end as line_amount_krw
  from ship_lines_floor
),

ship_lines_json as (
  select
    shipment_id,
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
        'raw_amount_krw', raw_amount_krw,
        'amount_krw', line_amount_krw
      )
      order by shipment_line_id
    ) as lines,
    coalesce(sum(raw_amount_krw), 0) as raw_sum_krw
  from ship_lines_final
  group by shipment_id
),

shipments_json as (
  select
    led.party_id,
    jsonb_agg(
      jsonb_build_object(
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
        'lines_raw_sum_krw', coalesce(lj.raw_sum_krw, 0),
        'lines', coalesce(lj.lines, '[]'::jsonb),
        'lines_vs_ledger_diff_krw', (coalesce(lj.raw_sum_krw, 0) - led.ledger_amount_krw)
      )
      order by led.occurred_at, led.shipment_id
    ) as shipments
  from ship_ledger led
  join public.cms_shipment_header sh on sh.shipment_id = led.shipment_id
  left join public.cms_party cp on cp.party_id = sh.customer_party_id
  left join ship_lines_json lj on lj.shipment_id = led.shipment_id
  group by led.party_id
),

/* =========================
   RETURNS (RETURN ledger 기반)
   - 포함 기준: ledger(entry_type='RETURN', occurred_at in KST day)
   ========================= */
ret_ledger as (
  select
    l.party_id,
    l.occurred_at,
    l.return_line_id,
    l.shipment_id,
    l.shipment_line_id,
    l.amount_krw as ledger_amount_krw,
    l.memo as ledger_memo
  from public.cms_ar_ledger l, bounds b
  where l.entry_type = 'RETURN'
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
        'return_line_id', rl.return_line_id,
        'ledger_occurred_at', rl.occurred_at,
        'ledger_amount_krw', rl.ledger_amount_krw,
        'ledger_memo', rl.ledger_memo,

        'return_qty', r.return_qty,
        'final_return_amount_krw', r.final_return_amount_krw,
        'return_vs_ledger_diff_krw', (coalesce(r.final_return_amount_krw,0) + rl.ledger_amount_krw),

        'shipment_id', rl.shipment_id,
        'shipment_line_id', rl.shipment_line_id,
        'model_name', sl.model_name,
        'color', sl.color,
        'size', sl.size,
        'material_code', sl.material_code,
        'net_weight_g', sl.net_weight_g
      )
      order by rl.occurred_at, rl.return_line_id
    ) as returns
  from ret_ledger rl
  join public.cms_return_line r on r.return_line_id = rl.return_line_id
  left join public.cms_shipment_line sl on sl.shipment_line_id = rl.shipment_line_id
  group by rl.party_id
),

/* =========================
   PAYMENTS (PAYMENT ledger 기반)
   - 포함 기준: ledger(entry_type='PAYMENT', occurred_at in KST day)
   - breakdown은 ar_payment + alloc(view)로 제공하되,
     "총액"은 반드시 ledger_amount 기준(완벽 정합)
   ========================= */
pay_ledger as (
  select
    l.party_id,
    l.occurred_at,
    l.payment_id,
    l.amount_krw as ledger_amount_krw,
    l.memo as ledger_memo
  from public.cms_ar_ledger l, bounds b
  where l.entry_type = 'PAYMENT'
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
        'alloc_material_krw', d.alloc_material_krw
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

        -- 원장 PAYMENT 정의: -(cash + alloc_value) 이므로 아래 diff가 0이어야 "완벽"
        'ledger_vs_payment_value_diff_krw',
          ( -pl.ledger_amount_krw - round(coalesce(ap.cash_krw,0) + coalesce(pa.alloc_value_krw,0), 0) ),

        'unallocated_cash_krw',
          greatest(round(coalesce(ap.cash_krw,0) - coalesce(pa.alloc_cash_krw,0), 0), 0)
      )
      order by pl.occurred_at, pl.payment_id
    ) as payments
  from pay_ledger pl
  left join public.cms_ar_payment ap on ap.payment_id = pl.payment_id
  left join pay_alloc_agg pa on pa.payment_id = pl.payment_id
  group by pl.party_id
),

/* =========================
   ADJUST / OFFSET (원장 그대로)
   ========================= */
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
  where l.entry_type = 'ADJUST'
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
  where l.entry_type = 'OFFSET'
    and l.occurred_at >= b.s
    and l.occurred_at <  b.e
    and (p_party_ids is null or l.party_id = any(p_party_ids))
  group by l.party_id
),

details_json as (
  select
    ps.party_id,
    jsonb_build_object(
      'shipments', coalesce(sj.shipments, '[]'::jsonb),
      'returns',   coalesce(rj.returns,   '[]'::jsonb),
      'payments',  coalesce(pj.payments,  '[]'::jsonb),
      'adjusts',   coalesce(aj.adjusts,   '[]'::jsonb),
      'offsets',   coalesce(oj.offsets,   '[]'::jsonb)
    ) as details
  from party_set ps
  left join shipments_json sj on sj.party_id = ps.party_id
  left join returns_json   rj on rj.party_id = ps.party_id
  left join payments_json  pj on pj.party_id = ps.party_id
  left join adjust_json    aj on aj.party_id = ps.party_id
  left join offset_json    oj on oj.party_id = ps.party_id
)

select
  ps.party_id,
  p_kst_date as kst_date,
  (select s from bounds) as kst_day_start,
  (select e from bounds) as kst_day_end,

  jsonb_build_object(
    'receivable_krw', coalesce(pp.receivable_krw, 0),
    'labor_cash_outstanding_krw', coalesce(pp.labor_cash_outstanding_krw, 0),
    'gold_outstanding_g', coalesce(pp.gold_outstanding_g, 0),
    'silver_outstanding_g', coalesce(pp.silver_outstanding_g, 0)
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
    'receivable_krw', coalesce(ep.receivable_krw, 0),
    'labor_cash_outstanding_krw', coalesce(ep.labor_cash_outstanding_krw, 0),
    'gold_outstanding_g', coalesce(ep.gold_outstanding_g, 0),
    'silver_outstanding_g', coalesce(ep.silver_outstanding_g, 0)
  ) as end_position,

  coalesce(dj.details, '{}'::jsonb) as details
from party_set ps
left join prev_pos pp on pp.party_id = ps.party_id
left join end_pos  ep on ep.party_id = ps.party_id
left join day_ledger dl on dl.party_id = ps.party_id
left join details_json dj on dj.party_id = ps.party_id
order by ps.party_id;
$$;

alter function public.cms_fn_shipments_print_ledger_statement_v1(uuid[], date)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_shipments_print_ledger_statement_v1(uuid[], date)
  to authenticated;
