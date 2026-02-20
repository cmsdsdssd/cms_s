-- ============================================================
-- cms_0350: AP(운영)용 공장 POST/결제 뷰 + Reconcile v2(결제반영/as-of 비교) + 결제 가드 RPC
-- ============================================================
set search_path = public, pg_temp;
begin;
-- ------------------------------------------------------------
-- 0) Preflight: 필수 테이블/타입 존재 확인 (없으면 여기서 멈추는 게 안전)
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.cms_receipt_inbox') is null then
    raise exception 'missing table public.cms_receipt_inbox (run receipt migrations first)';
  end if;

  if to_regclass('public.cms_factory_receipt_snapshot') is null
     or to_regclass('public.cms_factory_receipt_statement_leg') is null then
    raise exception 'missing factory snapshot tables (run cms_0346 first)';
  end if;

  if to_regclass('public.cms_ap_invoice') is null
     or to_regclass('public.cms_ap_invoice_leg') is null
     or to_regclass('public.cms_ap_payment') is null
     or to_regclass('public.cms_ap_payment_leg') is null
     or to_regclass('public.cms_ap_alloc') is null
     or to_regclass('public.cms_ap_alloc_leg') is null then
    raise exception 'missing AP2 ledger tables (run cms_0346/cms_0348/cms_0349 first)';
  end if;

  if not exists (select 1 from pg_type where typname = 'cms_reconcile_issue_type') then
    raise exception 'missing type cms_reconcile_issue_type (run cms_0346 first)';
  end if;
end $$;
-- ------------------------------------------------------------
-- 1) ENUM 확장: 공장 POST vs 시스템(as-of) 불일치 이슈 타입 추가
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'cms_reconcile_issue_type'
      and e.enumlabel = 'FACTORY_POST_NEQ_SYSTEM_ASOF'
  ) then
    alter type public.cms_reconcile_issue_type add value 'FACTORY_POST_NEQ_SYSTEM_ASOF';
  end if;
end $$;
-- ------------------------------------------------------------
-- 2) Index (있으면 스킵): 운영/대사 성능 안전장치
-- ------------------------------------------------------------
create index if not exists cms_ap_payment_vendor_paid_at_idx
  on public.cms_ap_payment (vendor_party_id, paid_at desc);
create index if not exists cms_ap_invoice_vendor_occurred_at_idx
  on public.cms_ap_invoice (vendor_party_id, occurred_at asc);
create index if not exists cms_factory_statement_leg_receipt_row_idx
  on public.cms_factory_receipt_statement_leg (receipt_id, snapshot_version, row_code);
-- ------------------------------------------------------------
-- 3) AP(운영) 화면용 "공장 최신 영수증 + POST/최근결제" 뷰
--    - AP는 '증가분(SALE)'이 아니라 '잔액(POST)'과 '결제' 중심이어야 함
-- ------------------------------------------------------------

-- vendor별 "가장 최신(current) 공장 스냅샷" 1개 (issued_at/bill_no 기준)
create or replace view public.cms_v_ap_factory_latest_receipt_by_vendor_v1
with (security_invoker = true)
as
select distinct on (s.vendor_party_id)
  s.vendor_party_id,
  s.receipt_id,
  s.snapshot_version,
  s.issued_at,
  coalesce(r.bill_no,'') as bill_no
from public.cms_factory_receipt_snapshot s
left join public.cms_receipt_inbox r on r.receipt_id = s.receipt_id
where s.is_current = true
order by
  s.vendor_party_id,
  s.issued_at desc,
  coalesce(r.bill_no,'') desc,
  s.receipt_id::text desc,
  s.snapshot_version desc;
grant select on public.cms_v_ap_factory_latest_receipt_by_vendor_v1 to authenticated;
grant select on public.cms_v_ap_factory_latest_receipt_by_vendor_v1 to anon;
-- vendor별 "공장 POST 잔액(거래 후 미수)" (자산코드 전체를 고정 출력)
create or replace view public.cms_v_ap_factory_post_balance_by_vendor_v1
with (security_invoker = true)
as
with last as (
  select * from public.cms_v_ap_factory_latest_receipt_by_vendor_v1
),
assets as (
  select unnest(enum_range(null::public.cms_asset_code)) as asset_code
)
select
  last.vendor_party_id,
  last.receipt_id,
  last.snapshot_version,
  last.issued_at,
  last.bill_no,
  a.asset_code,
  coalesce(l.qty,0) as qty
from last
cross join assets a
left join public.cms_factory_receipt_statement_leg l
  on l.receipt_id = last.receipt_id
 and l.snapshot_version = last.snapshot_version
 and l.row_code = 'POST_BALANCE'
 and l.asset_code = a.asset_code;
grant select on public.cms_v_ap_factory_post_balance_by_vendor_v1 to authenticated;
grant select on public.cms_v_ap_factory_post_balance_by_vendor_v1 to anon;
-- vendor별 "공장 RECENT_PAYMENT(최근결제)" (자산코드 전체 고정 출력)
create or replace view public.cms_v_ap_factory_recent_payment_by_vendor_v1
with (security_invoker = true)
as
with last as (
  select * from public.cms_v_ap_factory_latest_receipt_by_vendor_v1
),
assets as (
  select unnest(enum_range(null::public.cms_asset_code)) as asset_code
)
select
  last.vendor_party_id,
  last.receipt_id,
  last.snapshot_version,
  last.issued_at,
  last.bill_no,
  a.asset_code,
  coalesce(l.qty,0) as qty
from last
cross join assets a
left join public.cms_factory_receipt_statement_leg l
  on l.receipt_id = last.receipt_id
 and l.snapshot_version = last.snapshot_version
 and l.row_code = 'RECENT_PAYMENT'
 and l.asset_code = a.asset_code;
grant select on public.cms_v_ap_factory_recent_payment_by_vendor_v1 to authenticated;
grant select on public.cms_v_ap_factory_recent_payment_by_vendor_v1 to anon;
-- ------------------------------------------------------------
-- 4) AP(운영)용 결제 내역 뷰: payment + legs (AR처럼 날짜/자산별 조회 가능)
-- ------------------------------------------------------------
create or replace view public.cms_v_ap_payment_history_by_vendor_v1
with (security_invoker = true)
as
select
  p.vendor_party_id,
  p.payment_id,
  p.paid_at,
  p.note,
  pl.asset_code,
  pl.qty
from public.cms_ap_payment p
join public.cms_ap_payment_leg pl on pl.payment_id = p.payment_id;
grant select on public.cms_v_ap_payment_history_by_vendor_v1 to authenticated;
grant select on public.cms_v_ap_payment_history_by_vendor_v1 to anon;
-- ------------------------------------------------------------
-- 5) 시스템 잔액(net balance) 뷰: due - alloc (outstanding/credit이 아니라 "순잔액")
--    - 공장 POST(잔액)과 비교하려면 net balance가 필요
-- ------------------------------------------------------------
create or replace view public.cms_v_ap_balance_by_vendor_v1
with (security_invoker = true)
as
with alloc as (
  select
    a.ap_id,
    al.asset_code,
    coalesce(sum(al.qty),0) as alloc_qty
  from public.cms_ap_alloc a
  join public.cms_ap_alloc_leg al on al.alloc_id = a.alloc_id
  group by a.ap_id, al.asset_code
)
select
  i.vendor_party_id,
  l.asset_code,
  coalesce(sum(l.due_qty),0) - coalesce(sum(a.alloc_qty),0) as balance_qty
from public.cms_ap_invoice i
join public.cms_ap_invoice_leg l on l.ap_id = i.ap_id
left join alloc a on a.ap_id = i.ap_id and a.asset_code = l.asset_code
group by i.vendor_party_id, l.asset_code;
grant select on public.cms_v_ap_balance_by_vendor_v1 to authenticated;
grant select on public.cms_v_ap_balance_by_vendor_v1 to anon;
-- ------------------------------------------------------------
-- 6) RPC: 시스템 잔액(as-of 특정 일자) 계산 (Reconcile v2의 핵심)
--    - Asia/Seoul 기준 "해당 날짜의 23:59:59.999..."까지 반영
--    - invoice.occurred_at / payment.paid_at을 as-of로 컷
-- ------------------------------------------------------------
create or replace function public.cms_fn_ap_get_system_position_asof_v1(
  p_vendor_party_id uuid,
  p_as_of_date date
)
returns table (
  asset_code public.cms_asset_code,
  due_qty numeric(18,6),
  alloc_qty numeric(18,6),
  balance_qty numeric(18,6)
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nextday_start timestamptz;
begin
  if p_vendor_party_id is null then
    raise exception 'vendor_party_id required';
  end if;
  if p_as_of_date is null then
    raise exception 'as_of_date required';
  end if;

  -- 서울 기준 다음날 00:00:00 (미만 <)으로 컷
  v_nextday_start := ((p_as_of_date + 1)::timestamp at time zone 'Asia/Seoul');

  return query
  with assets as (
    select unnest(enum_range(null::public.cms_asset_code)) as asset_code
  ),
  due as (
    select
      l.asset_code,
      coalesce(sum(l.due_qty),0) as due_qty
    from public.cms_ap_invoice i
    join public.cms_ap_invoice_leg l on l.ap_id = i.ap_id
    where i.vendor_party_id = p_vendor_party_id
      and i.occurred_at < v_nextday_start
    group by l.asset_code
  ),
  alloc as (
    select
      al.asset_code,
      coalesce(sum(al.qty),0) as alloc_qty
    from public.cms_ap_alloc a
    join public.cms_ap_alloc_leg al on al.alloc_id = a.alloc_id
    join public.cms_ap_payment p on p.payment_id = a.payment_id
    where p.vendor_party_id = p_vendor_party_id
      and p.paid_at < v_nextday_start
    group by al.asset_code
  )
  select
    a.asset_code,
    coalesce(d.due_qty,0) as due_qty,
    coalesce(x.alloc_qty,0) as alloc_qty,
    (coalesce(d.due_qty,0) - coalesce(x.alloc_qty,0)) as balance_qty
  from assets a
  left join due d on d.asset_code = a.asset_code
  left join alloc x on x.asset_code = a.asset_code
  order by a.asset_code;
end $$;
alter function public.cms_fn_ap_get_system_position_asof_v1(uuid,date)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_ap_get_system_position_asof_v1(uuid,date)
  to authenticated, service_role;
-- ------------------------------------------------------------
-- 7) Reconcile v2:
--    기존(v1) 3개 + 추가 2개
--    (A) RECENT_PAYMENT(공장) vs 시스템결제(기간)  -> issue_type: RECENT_PAYMENT_INCONSISTENT
--    (B) POST_BALANCE(공장) vs 시스템잔액(as-of) -> issue_type: FACTORY_POST_NEQ_SYSTEM_ASOF
-- ------------------------------------------------------------
create or replace function public.cms_fn_ap_run_reconcile_for_receipt_v2(
  p_receipt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_vendor uuid;
  v_issued_at date;
  v_bill_no text;

  v_cur_ver int;
  v_calc_ver int;

  v_prev_receipt_id uuid;
  v_prev_ver int;
  v_prev_issued_at date;

  v_run_id uuid;

  -- epsilon
  v_eps_g numeric := 0.000001;
  v_eps_krw numeric := 0.5;

  v_issue_id uuid;
  v_cnt_info int := 0;
  v_cnt_warn int := 0;
  v_cnt_error int := 0;

  v_has_diff boolean;
  v_has_row boolean;

  -- internal-calc mismatch severity 결정
  v_has_krw_diff boolean := false;
begin
  if p_receipt_id is null then
    raise exception 'receipt_id required';
  end if;

  select vendor_party_id, issued_at, bill_no
    into v_vendor, v_issued_at, v_bill_no
  from public.cms_receipt_inbox
  where receipt_id = p_receipt_id;

  if v_vendor is null or v_issued_at is null then
    raise exception 'receipt header must have vendor_party_id and issued_at';
  end if;

  select snapshot_version into v_cur_ver
  from public.cms_factory_receipt_snapshot
  where receipt_id = p_receipt_id and is_current = true
  order by snapshot_version desc
  limit 1;

  if v_cur_ver is null then
    raise exception 'no factory snapshot for receipt';
  end if;

  select calc_version into v_calc_ver
  from public.cms_ap_internal_calc_snapshot
  where receipt_id = p_receipt_id and is_current = true
  order by calc_version desc
  limit 1;

  -- 기존 OPEN/ACKED 이슈 superseded 처리
  update public.cms_ap_reconcile_issue
     set status = 'IGNORED',
         resolved_at = now(),
         resolved_by = auth.uid(),
         resolution_note = coalesce(resolution_note,'') || ' | superseded by new reconcile v2 run'
   where receipt_id = p_receipt_id
     and status in ('OPEN','ACKED');

  insert into public.cms_ap_reconcile_run(receipt_id, vendor_party_id, snapshot_version, calc_version, created_by)
  values (p_receipt_id, v_vendor, v_cur_ver, v_calc_ver, auth.uid())
  returning run_id into v_run_id;

  -- prev receipt 찾기 (issued_at + bill_no 기준)
  select r.receipt_id, r.issued_at
    into v_prev_receipt_id, v_prev_issued_at
  from public.cms_receipt_inbox r
  where r.vendor_party_id = v_vendor
    and r.receipt_id <> p_receipt_id
    and (
      r.issued_at < v_issued_at
      or (r.issued_at = v_issued_at and coalesce(r.bill_no,'') < coalesce(v_bill_no,''))
    )
  order by r.issued_at desc nulls last, r.bill_no desc nulls last, r.receipt_id::text desc
  limit 1;

  if v_prev_receipt_id is not null then
    select snapshot_version into v_prev_ver
    from public.cms_factory_receipt_snapshot
    where receipt_id = v_prev_receipt_id and is_current = true
    order by snapshot_version desc
    limit 1;
  end if;

  -- ==========================================================
  -- (1) PRE_NEQ_PREV_POST (asset별)
  -- ==========================================================
  if v_prev_receipt_id is not null and v_prev_ver is not null then
    with assets as (
      select unnest(enum_range(null::public.cms_asset_code)) as asset_code
    ),
    cur_pre as (
      select asset_code, qty
      from public.cms_factory_receipt_statement_leg
      where receipt_id = p_receipt_id and snapshot_version = v_cur_ver and row_code = 'PRE_BALANCE'
    ),
    prev_post as (
      select asset_code, qty
      from public.cms_factory_receipt_statement_leg
      where receipt_id = v_prev_receipt_id and snapshot_version = v_prev_ver and row_code = 'POST_BALANCE'
    ),
    diff as (
      select
        a.asset_code,
        coalesce(pp.qty,0) as expected_qty,
        coalesce(cp.qty,0) as actual_qty,
        (coalesce(cp.qty,0) - coalesce(pp.qty,0)) as diff_qty
      from assets a
      left join prev_post pp on pp.asset_code = a.asset_code
      left join cur_pre cp on cp.asset_code = a.asset_code
    )
    select exists (
      select 1 from diff
      where case when asset_code::text like 'KRW%' then abs(diff_qty) > v_eps_krw else abs(diff_qty) > v_eps_g end
    )
    into v_has_diff;

    if v_has_diff then
      insert into public.cms_ap_reconcile_issue(
        run_id, receipt_id, vendor_party_id, issue_type, severity, status, summary, created_by
      )
      values (
        v_run_id, p_receipt_id, v_vendor,
        'PRE_NEQ_PREV_POST', 'ERROR', 'OPEN',
        'PRE_BALANCE != previous POST_BALANCE (asset-level mismatch)',
        auth.uid()
      )
      returning issue_id into v_issue_id;

      insert into public.cms_ap_reconcile_issue_leg(issue_id, asset_code, expected_qty, actual_qty, diff_qty)
      select
        v_issue_id, asset_code, expected_qty, actual_qty, diff_qty
      from (
        with assets as (
          select unnest(enum_range(null::public.cms_asset_code)) as asset_code
        ),
        cur_pre as (
          select asset_code, qty
          from public.cms_factory_receipt_statement_leg
          where receipt_id = p_receipt_id and snapshot_version = v_cur_ver and row_code = 'PRE_BALANCE'
        ),
        prev_post as (
          select asset_code, qty
          from public.cms_factory_receipt_statement_leg
          where receipt_id = v_prev_receipt_id and snapshot_version = v_prev_ver and row_code = 'POST_BALANCE'
        )
        select
          a.asset_code,
          coalesce(pp.qty,0) as expected_qty,
          coalesce(cp.qty,0) as actual_qty,
          (coalesce(cp.qty,0) - coalesce(pp.qty,0)) as diff_qty
        from assets a
        left join prev_post pp on pp.asset_code = a.asset_code
        left join cur_pre cp on cp.asset_code = a.asset_code
      ) d
      where case when asset_code::text like 'KRW%' then abs(diff_qty) > v_eps_krw else abs(diff_qty) > v_eps_g end;

      v_cnt_error := v_cnt_error + 1;
    end if;
  end if;

  -- ==========================================================
  -- (2) PRE + SALE != POST
  -- ==========================================================
  with assets as (
    select unnest(enum_range(null::public.cms_asset_code)) as asset_code
  ),
  pre as (
    select asset_code, qty
    from public.cms_factory_receipt_statement_leg
    where receipt_id = p_receipt_id and snapshot_version = v_cur_ver and row_code = 'PRE_BALANCE'
  ),
  sale as (
    select asset_code, qty
    from public.cms_factory_receipt_statement_leg
    where receipt_id = p_receipt_id and snapshot_version = v_cur_ver and row_code = 'SALE'
  ),
  post as (
    select asset_code, qty
    from public.cms_factory_receipt_statement_leg
    where receipt_id = p_receipt_id and snapshot_version = v_cur_ver and row_code = 'POST_BALANCE'
  ),
  diff as (
    select
      a.asset_code,
      (coalesce(p.qty,0) + coalesce(s.qty,0)) as expected_qty,
      coalesce(po.qty,0) as actual_qty,
      (coalesce(po.qty,0) - (coalesce(p.qty,0) + coalesce(s.qty,0))) as diff_qty
    from assets a
    left join pre p on p.asset_code = a.asset_code
    left join sale s on s.asset_code = a.asset_code
    left join post po on po.asset_code = a.asset_code
  )
  select exists (
    select 1 from diff
    where case when asset_code::text like 'KRW%' then abs(diff_qty) > v_eps_krw else abs(diff_qty) > v_eps_g end
  )
  into v_has_diff;

  if v_has_diff then
    insert into public.cms_ap_reconcile_issue(
      run_id, receipt_id, vendor_party_id, issue_type, severity, status, summary, created_by
    )
    values (
      v_run_id, p_receipt_id, v_vendor,
      'PRE_PLUS_SALE_NEQ_POST', 'ERROR', 'OPEN',
      'PRE_BALANCE + SALE != POST_BALANCE (requires adjustment or missing component)',
      auth.uid()
    )
    returning issue_id into v_issue_id;

    insert into public.cms_ap_reconcile_issue_leg(issue_id, asset_code, expected_qty, actual_qty, diff_qty)
    select v_issue_id, asset_code, expected_qty, actual_qty, diff_qty
    from (
      with assets as (
        select unnest(enum_range(null::public.cms_asset_code)) as asset_code
      ),
      pre as (
        select asset_code, qty
        from public.cms_factory_receipt_statement_leg
        where receipt_id = p_receipt_id and snapshot_version = v_cur_ver and row_code = 'PRE_BALANCE'
      ),
      sale as (
        select asset_code, qty
        from public.cms_factory_receipt_statement_leg
        where receipt_id = p_receipt_id and snapshot_version = v_cur_ver and row_code = 'SALE'
      ),
      post as (
        select asset_code, qty
        from public.cms_factory_receipt_statement_leg
        where receipt_id = p_receipt_id and snapshot_version = v_cur_ver and row_code = 'POST_BALANCE'
      )
      select
        a.asset_code,
        (coalesce(p.qty,0) + coalesce(s.qty,0)) as expected_qty,
        coalesce(po.qty,0) as actual_qty,
        (coalesce(po.qty,0) - (coalesce(p.qty,0) + coalesce(s.qty,0))) as diff_qty
      from assets a
      left join pre p on p.asset_code = a.asset_code
      left join sale s on s.asset_code = a.asset_code
      left join post po on po.asset_code = a.asset_code
    ) d
    where case when asset_code::text like 'KRW%' then abs(diff_qty) > v_eps_krw else abs(diff_qty) > v_eps_g end;

    v_cnt_error := v_cnt_error + 1;
  end if;

  -- ==========================================================
  -- (3) FACTORY SALE != INTERNAL CALC (있을 때만)
  --     - KRW mismatch면 ERROR, 금/은 mismatch만 있으면 WARN
  -- ==========================================================
  if v_calc_ver is not null then
    with factory_sale as (
      select asset_code, qty
      from public.cms_factory_receipt_statement_leg
      where receipt_id = p_receipt_id and snapshot_version = v_cur_ver and row_code = 'SALE'
        and asset_code in ('XAU_G','XAG_G','KRW_LABOR')
    ),
    internal as (
      select 'XAU_G'::public.cms_asset_code as asset_code, calc_gold_g::numeric as qty
      from public.cms_ap_internal_calc_snapshot
      where receipt_id = p_receipt_id and calc_version = v_calc_ver
      union all
      select 'XAG_G'::public.cms_asset_code, calc_silver_g::numeric
      from public.cms_ap_internal_calc_snapshot
      where receipt_id = p_receipt_id and calc_version = v_calc_ver
      union all
      select 'KRW_LABOR'::public.cms_asset_code, calc_labor_cash_krw::numeric
      from public.cms_ap_internal_calc_snapshot
      where receipt_id = p_receipt_id and calc_version = v_calc_ver
    ),
    diff as (
      select
        i.asset_code,
        coalesce(i.qty,0) as expected_qty,
        coalesce(f.qty,0) as actual_qty,
        (coalesce(f.qty,0) - coalesce(i.qty,0)) as diff_qty
      from internal i
      left join factory_sale f on f.asset_code = i.asset_code
    )
    select
      exists (
        select 1 from diff
        where case when asset_code::text like 'KRW%' then abs(diff_qty) > v_eps_krw else abs(diff_qty) > v_eps_g end
      ) as has_any_diff,
      exists (
        select 1 from diff
        where asset_code = 'KRW_LABOR' and abs(diff_qty) > v_eps_krw
      ) as has_krw_diff
    into v_has_diff, v_has_krw_diff;

    if v_has_diff then
      insert into public.cms_ap_reconcile_issue(
        run_id, receipt_id, vendor_party_id, issue_type, severity, status, summary, created_by
      )
      values (
        v_run_id, p_receipt_id, v_vendor,
        'FACTORY_SALE_NEQ_INTERNAL_CALC',
        case when v_has_krw_diff then 'ERROR' else 'WARN' end,
        'OPEN',
        'FACTORY SALE != INTERNAL CALC (review receipt line inputs / calc rules)',
        auth.uid()
      )
      returning issue_id into v_issue_id;

      insert into public.cms_ap_reconcile_issue_leg(issue_id, asset_code, expected_qty, actual_qty, diff_qty)
      select
        v_issue_id, asset_code, expected_qty, actual_qty, diff_qty
      from (
        with factory_sale as (
          select asset_code, qty
          from public.cms_factory_receipt_statement_leg
          where receipt_id = p_receipt_id and snapshot_version = v_cur_ver and row_code = 'SALE'
            and asset_code in ('XAU_G','XAG_G','KRW_LABOR')
        ),
        internal as (
          select 'XAU_G'::public.cms_asset_code as asset_code, calc_gold_g::numeric as qty
          from public.cms_ap_internal_calc_snapshot
          where receipt_id = p_receipt_id and calc_version = v_calc_ver
          union all
          select 'XAG_G'::public.cms_asset_code, calc_silver_g::numeric
          from public.cms_ap_internal_calc_snapshot
          where receipt_id = p_receipt_id and calc_version = v_calc_ver
          union all
          select 'KRW_LABOR'::public.cms_asset_code, calc_labor_cash_krw::numeric
          from public.cms_ap_internal_calc_snapshot
          where receipt_id = p_receipt_id and calc_version = v_calc_ver
        )
        select
          i.asset_code,
          coalesce(i.qty,0) as expected_qty,
          coalesce(f.qty,0) as actual_qty,
          (coalesce(f.qty,0) - coalesce(i.qty,0)) as diff_qty
        from internal i
        left join factory_sale f on f.asset_code = i.asset_code
      ) d
      where case when asset_code::text like 'KRW%' then abs(diff_qty) > v_eps_krw else abs(diff_qty) > v_eps_g end;

      if v_has_krw_diff then
        v_cnt_error := v_cnt_error + 1;
      else
        v_cnt_warn := v_cnt_warn + 1;
      end if;
    end if;
  end if;

  -- ==========================================================
  -- (4) RECENT_PAYMENT(공장) vs 시스템 결제(기간)
  --     - 기간: (prev issued_at, current issued_at]  (서울 로컬 date 기준)
  --     - 공장에 RECENT_PAYMENT row가 "존재할 때만" 검사
  -- ==========================================================
  if v_prev_receipt_id is not null and v_prev_issued_at is not null then
    select exists (
      select 1
      from public.cms_factory_receipt_statement_leg
      where receipt_id = p_receipt_id
        and snapshot_version = v_cur_ver
        and row_code = 'RECENT_PAYMENT'
    ) into v_has_row;

    if v_has_row then
      with assets as (
        select unnest(enum_range(null::public.cms_asset_code)) as asset_code
      ),
      factory_rp as (
        select asset_code, qty
        from public.cms_factory_receipt_statement_leg
        where receipt_id = p_receipt_id and snapshot_version = v_cur_ver and row_code = 'RECENT_PAYMENT'
      ),
      sys_pay as (
        select
          pl.asset_code,
          coalesce(sum(pl.qty),0) as qty
        from public.cms_ap_payment p
        join public.cms_ap_payment_leg pl on pl.payment_id = p.payment_id
        where p.vendor_party_id = v_vendor
          and ((p.paid_at at time zone 'Asia/Seoul')::date > v_prev_issued_at)
          and ((p.paid_at at time zone 'Asia/Seoul')::date <= v_issued_at)
        group by pl.asset_code
      ),
      diff as (
        select
          a.asset_code,
          coalesce(sp.qty,0) as expected_qty,
          coalesce(fr.qty,0) as actual_qty,
          (coalesce(fr.qty,0) - coalesce(sp.qty,0)) as diff_qty
        from assets a
        left join sys_pay sp on sp.asset_code = a.asset_code
        left join factory_rp fr on fr.asset_code = a.asset_code
      )
      select exists (
        select 1 from diff
        where case when asset_code::text like 'KRW%' then abs(diff_qty) > v_eps_krw else abs(diff_qty) > v_eps_g end
      )
      into v_has_diff;

      if v_has_diff then
        insert into public.cms_ap_reconcile_issue(
          run_id, receipt_id, vendor_party_id, issue_type, severity, status, summary, created_by
        )
        values (
          v_run_id, p_receipt_id, v_vendor,
          'RECENT_PAYMENT_INCONSISTENT', 'WARN', 'OPEN',
          'RECENT_PAYMENT != system payments in period (prev issued_at, current issued_at] (check window/ref_date)',
          auth.uid()
        )
        returning issue_id into v_issue_id;

        insert into public.cms_ap_reconcile_issue_leg(issue_id, asset_code, expected_qty, actual_qty, diff_qty)
        select v_issue_id, asset_code, expected_qty, actual_qty, diff_qty
        from (
          with assets as (
            select unnest(enum_range(null::public.cms_asset_code)) as asset_code
          ),
          factory_rp as (
            select asset_code, qty
            from public.cms_factory_receipt_statement_leg
            where receipt_id = p_receipt_id and snapshot_version = v_cur_ver and row_code = 'RECENT_PAYMENT'
          ),
          sys_pay as (
            select
              pl.asset_code,
              coalesce(sum(pl.qty),0) as qty
            from public.cms_ap_payment p
            join public.cms_ap_payment_leg pl on pl.payment_id = p.payment_id
            where p.vendor_party_id = v_vendor
              and ((p.paid_at at time zone 'Asia/Seoul')::date > v_prev_issued_at)
              and ((p.paid_at at time zone 'Asia/Seoul')::date <= v_issued_at)
            group by pl.asset_code
          )
          select
            a.asset_code,
            coalesce(sp.qty,0) as expected_qty,
            coalesce(fr.qty,0) as actual_qty,
            (coalesce(fr.qty,0) - coalesce(sp.qty,0)) as diff_qty
          from assets a
          left join sys_pay sp on sp.asset_code = a.asset_code
          left join factory_rp fr on fr.asset_code = a.asset_code
        ) d
        where case when asset_code::text like 'KRW%' then abs(diff_qty) > v_eps_krw else abs(diff_qty) > v_eps_g end;

        v_cnt_warn := v_cnt_warn + 1;
      end if;
    end if;
  end if;

  -- ==========================================================
  -- (5) POST_BALANCE(공장) vs 시스템 잔액(as-of issued_at)  -> ERROR
  -- ==========================================================
  with assets as (
    select unnest(enum_range(null::public.cms_asset_code)) as asset_code
  ),
  factory_post as (
    select asset_code, qty
    from public.cms_factory_receipt_statement_leg
    where receipt_id = p_receipt_id and snapshot_version = v_cur_ver and row_code = 'POST_BALANCE'
  ),
  sys_asof as (
    select asset_code, balance_qty as qty
    from public.cms_fn_ap_get_system_position_asof_v1(v_vendor, v_issued_at)
  ),
  diff as (
    select
      a.asset_code,
      coalesce(sa.qty,0) as expected_qty,
      coalesce(fp.qty,0) as actual_qty,
      (coalesce(fp.qty,0) - coalesce(sa.qty,0)) as diff_qty
    from assets a
    left join sys_asof sa on sa.asset_code = a.asset_code
    left join factory_post fp on fp.asset_code = a.asset_code
  )
  select exists (
    select 1 from diff
    where case when asset_code::text like 'KRW%' then abs(diff_qty) > v_eps_krw else abs(diff_qty) > v_eps_g end
  )
  into v_has_diff;

  if v_has_diff then
    insert into public.cms_ap_reconcile_issue(
      run_id, receipt_id, vendor_party_id, issue_type, severity, status, summary, created_by
    )
    values (
      v_run_id, p_receipt_id, v_vendor,
      'FACTORY_POST_NEQ_SYSTEM_ASOF', 'ERROR', 'OPEN',
      'POST_BALANCE(factory) != system balance(as-of issued_at). Check missing SALE invoice, wrong payment alloc, or adjustment needed.',
      auth.uid()
    )
    returning issue_id into v_issue_id;

    insert into public.cms_ap_reconcile_issue_leg(issue_id, asset_code, expected_qty, actual_qty, diff_qty)
    select v_issue_id, asset_code, expected_qty, actual_qty, diff_qty
    from (
      with assets as (
        select unnest(enum_range(null::public.cms_asset_code)) as asset_code
      ),
      factory_post as (
        select asset_code, qty
        from public.cms_factory_receipt_statement_leg
        where receipt_id = p_receipt_id and snapshot_version = v_cur_ver and row_code = 'POST_BALANCE'
      ),
      sys_asof as (
        select asset_code, balance_qty as qty
        from public.cms_fn_ap_get_system_position_asof_v1(v_vendor, v_issued_at)
      )
      select
        a.asset_code,
        coalesce(sa.qty,0) as expected_qty,
        coalesce(fp.qty,0) as actual_qty,
        (coalesce(fp.qty,0) - coalesce(sa.qty,0)) as diff_qty
      from assets a
      left join sys_asof sa on sa.asset_code = a.asset_code
      left join factory_post fp on fp.asset_code = a.asset_code
    ) d
    where case when asset_code::text like 'KRW%' then abs(diff_qty) > v_eps_krw else abs(diff_qty) > v_eps_g end;

    v_cnt_error := v_cnt_error + 1;
  end if;

  return jsonb_build_object(
    'ok', true,
    'run_id', v_run_id,
    'snapshot_version', v_cur_ver,
    'calc_version', v_calc_ver,
    'issue_counts', jsonb_build_object('error', v_cnt_error, 'warn', v_cnt_warn, 'info', v_cnt_info)
  );
end $$;
alter function public.cms_fn_ap_run_reconcile_for_receipt_v2(uuid)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_ap_run_reconcile_for_receipt_v2(uuid)
  to authenticated, service_role;
-- ------------------------------------------------------------
-- 8) 4행 저장 RPC v2:
--    - statement 저장 → (중요) AP2 sync(내부calc + SALE invoice upsert) → reconcile v2 실행
--    - 기존 v1은 유지 (충돌/중단 방지)
-- ------------------------------------------------------------
create or replace function public.cms_fn_upsert_factory_receipt_statement_v2(
  p_receipt_id uuid,
  p_statement jsonb,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_vendor uuid;
  v_issued_at date;
  v_bill_no text;

  v_next_ver int;
  v_sync jsonb;
  v_recon jsonb;

  r_row record;
  r_leg record;
begin
  if p_receipt_id is null then
    raise exception 'receipt_id required';
  end if;

  if jsonb_typeof(coalesce(p_statement,'{}'::jsonb)) <> 'object' then
    raise exception 'statement must be json object';
  end if;

  select vendor_party_id, issued_at, bill_no
    into v_vendor, v_issued_at, v_bill_no
  from public.cms_receipt_inbox
  where receipt_id = p_receipt_id;

  if v_vendor is null or v_issued_at is null then
    raise exception 'receipt header must have vendor_party_id and issued_at';
  end if;

  -- current=false 처리
  update public.cms_factory_receipt_snapshot
     set is_current = false,
         updated_at = now(),
         updated_by = auth.uid()
   where receipt_id = p_receipt_id
     and is_current = true;

  select coalesce(max(snapshot_version),0) + 1
    into v_next_ver
  from public.cms_factory_receipt_snapshot
  where receipt_id = p_receipt_id;

  insert into public.cms_factory_receipt_snapshot(
    receipt_id, snapshot_version, vendor_party_id, issued_at, is_current, created_by, updated_by
  )
  values (
    p_receipt_id, v_next_ver, v_vendor, v_issued_at, true, auth.uid(), auth.uid()
  );

  if jsonb_typeof(coalesce(p_statement->'rows','[]'::jsonb)) <> 'array' then
    raise exception 'statement.rows must be array';
  end if;

  for r_row in
    select
      (e->>'row_code')::public.cms_statement_row_code as row_code,
      nullif(e->>'ref_date','')::date as ref_date,
      nullif(e->>'note','') as note,
      ordinality as row_order,
      e as row_json
    from jsonb_array_elements(p_statement->'rows') with ordinality as t(e, ordinality)
  loop
    insert into public.cms_factory_receipt_statement_row(
      receipt_id, snapshot_version, row_code, row_order, ref_date, note, created_by
    )
    values (
      p_receipt_id, v_next_ver, r_row.row_code, r_row.row_order, r_row.ref_date, r_row.note, auth.uid()
    )
    on conflict (receipt_id, snapshot_version, row_code)
    do update set
      row_order = excluded.row_order,
      ref_date = excluded.ref_date,
      note = excluded.note;

    delete from public.cms_factory_receipt_statement_leg
     where receipt_id = p_receipt_id
       and snapshot_version = v_next_ver
       and row_code = r_row.row_code;

    if jsonb_typeof(coalesce(r_row.row_json->'legs','[]'::jsonb)) <> 'array' then
      raise exception 'row.legs must be array';
    end if;

    for r_leg in
      select
        (l->>'asset_code')::public.cms_asset_code as asset_code,
        coalesce(nullif(l->>'qty','')::numeric, 0) as qty,
        nullif(l->>'input_unit','') as input_unit,
        nullif(l->>'input_qty','')::numeric as input_qty
      from jsonb_array_elements(r_row.row_json->'legs') as t(l)
    loop
      insert into public.cms_factory_receipt_statement_leg(
        receipt_id, snapshot_version, row_code, asset_code, qty, input_unit, input_qty
      )
      values (
        p_receipt_id, v_next_ver, r_row.row_code, r_leg.asset_code, r_leg.qty, r_leg.input_unit, r_leg.input_qty
      );
    end loop;
  end loop;

  -- 핵심: AP2 sync (내부calc + SALE invoice) 먼저
  v_sync := public.cms_fn_ap2_sync_from_receipt_v1(p_receipt_id, p_note);

  -- reconcile v2
  v_recon := public.cms_fn_ap_run_reconcile_for_receipt_v2(p_receipt_id);

  return jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'snapshot_version', v_next_ver,
    'ap2_sync', v_sync,
    'reconcile', v_recon
  );
end $$;
alter function public.cms_fn_upsert_factory_receipt_statement_v2(uuid,jsonb,text)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_upsert_factory_receipt_statement_v2(uuid,jsonb,text)
  to authenticated, service_role;
-- ------------------------------------------------------------
-- 9) 결제 안전 가드 RPC:
--    - vendor에 OPEN/ACKED 상태 ERROR 이슈가 있으면 결제 막기
--    - 기존 cms_fn_ap2_pay_and_fifo_v1은 변경하지 않음 (충돌/운영 중단 방지)
-- ------------------------------------------------------------
create or replace function public.cms_fn_ap2_pay_and_fifo_guarded_v1(
  p_vendor_party_id uuid,
  p_paid_at timestamptz,
  p_legs jsonb,
  p_note text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_err int;
begin
  select coalesce(error_count,0) into v_err
  from public.cms_v_ap_reconcile_open_by_vendor_v1
  where vendor_party_id = p_vendor_party_id;

  if coalesce(v_err,0) > 0 then
    raise exception using
      errcode = 'P0001',
      message = format('PAYMENT_BLOCKED: vendor has %s open reconcile ERROR issue(s). Resolve/ACK/adjust in AP Reconcile first.', v_err);
  end if;

  return public.cms_fn_ap2_pay_and_fifo_v1(
    p_vendor_party_id,
    p_paid_at,
    p_legs,
    p_note,
    p_idempotency_key
  );
end $$;
alter function public.cms_fn_ap2_pay_and_fifo_guarded_v1(uuid,timestamptz,jsonb,text,text)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_ap2_pay_and_fifo_guarded_v1(uuid,timestamptz,jsonb,text,text)
  to authenticated, service_role;
commit;
