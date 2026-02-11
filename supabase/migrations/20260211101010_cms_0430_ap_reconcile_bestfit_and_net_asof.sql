-- 20260211101010_cms_0430_ap_reconcile_bestfit_and_net_asof.sql
-- ADD-ONLY / DBPUSH-safe
-- Goals:
-- 1) Multi-receipt/day correctness: use occurred_at (KST midnight + bill_no suffix) instead of date-only.
-- 2) Factory statement equation should be PRE + SALE - RECENT_PAYMENT = POST (when RECENT exists).
-- 3) POST(factory) reconciliation must compare to SYSTEM NET balance (due - paid), not allocated balance.
-- 4) RECENT_PAYMENT reconciliation uses best-fit window (last payment day / up-to-occurred / prev->curr).
-- 5) Never lose 4-line snapshot on sync/reconcile failures (RPC exception isolation).
-- 6) Payment guard blocks only on truly blocking ERROR issue-types.

set search_path = public, pg_temp;

begin;

-- ============================================================
-- 0) Optional debug payload column (non-breaking)
-- ============================================================
alter table public.cms_ap_reconcile_issue
  add column if not exists details jsonb;

-- refresh list view to expose details (adding a column is non-breaking)
create or replace view public.cms_v_ap_reconcile_issue_list_v1
with (security_invoker = true)
as
select
  i.issue_id,
  i.run_id,
  i.vendor_party_id,
  i.receipt_id,
  i.issue_type,
  i.severity,
  i.status,
  i.summary,
  i.created_at,
  r.snapshot_version,
  r.calc_version,
  i.details
from public.cms_ap_reconcile_issue i
join public.cms_ap_reconcile_run r on r.run_id = i.run_id;

grant select on public.cms_v_ap_reconcile_issue_list_v1 to authenticated;
grant select on public.cms_v_ap_reconcile_issue_list_v1 to anon;

-- refresh named list view to expose details (adding a column is non-breaking)
create or replace view public.cms_v_ap_reconcile_issue_list_named_v1
with (security_invoker = true)
as
select
  i.issue_id,
  i.run_id,
  i.vendor_party_id,
  p.name      as vendor_name,
  p.region    as vendor_region,
  p.is_active as vendor_is_active,

  i.receipt_id,
  i.issue_type,
  i.severity,
  i.status,
  i.summary,
  i.created_at,
  i.snapshot_version,
  i.calc_version,
  i.details
from public.cms_v_ap_reconcile_issue_list_v1 i
left join public.cms_party p
  on p.party_id = i.vendor_party_id;

grant select on public.cms_v_ap_reconcile_issue_list_named_v1 to authenticated;
grant select on public.cms_v_ap_reconcile_issue_list_named_v1 to anon;

-- ============================================================
-- 1) System position (NET) as-of timestamp (multi-receipt safe)
--    - due: invoices up to occurred_at
--    - paid: payments up to occurred_at
--    - alloc: allocations for payments up to occurred_at (debug only)
-- ============================================================
create or replace function public.cms_fn_ap_get_system_position_asof_v2(
  p_vendor_party_id uuid,
  p_as_of_ts timestamptz
)
returns table (
  asset_code public.cms_asset_code,
  due_qty numeric(18,6),
  paid_qty numeric(18,6),
  alloc_qty numeric(18,6),
  net_balance_qty numeric(18,6),
  allocated_balance_qty numeric(18,6),
  unallocated_credit_qty numeric(18,6)
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_vendor_party_id is null then
    raise exception using errcode='P0001', message='vendor_party_id required';
  end if;
  if p_as_of_ts is null then
    raise exception using errcode='P0001', message='as_of_ts required';
  end if;

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
      and i.occurred_at <= p_as_of_ts
    group by l.asset_code
  ),
  paid as (
    select
      pl.asset_code,
      coalesce(sum(pl.qty),0) as paid_qty
    from public.cms_ap_payment p
    join public.cms_ap_payment_leg pl on pl.payment_id = p.payment_id
    where p.vendor_party_id = p_vendor_party_id
      and p.paid_at <= p_as_of_ts
    group by pl.asset_code
  ),
  alloc as (
    select
      al.asset_code,
      coalesce(sum(al.qty),0) as alloc_qty
    from public.cms_ap_alloc a
    join public.cms_ap_alloc_leg al on al.alloc_id = a.alloc_id
    join public.cms_ap_payment p on p.payment_id = a.payment_id
    where p.vendor_party_id = p_vendor_party_id
      and p.paid_at <= p_as_of_ts
    group by al.asset_code
  )
  select
    a.asset_code,
    coalesce(d.due_qty,0)::numeric(18,6) as due_qty,
    coalesce(p.paid_qty,0)::numeric(18,6) as paid_qty,
    coalesce(x.alloc_qty,0)::numeric(18,6) as alloc_qty,
    (coalesce(d.due_qty,0) - coalesce(p.paid_qty,0))::numeric(18,6) as net_balance_qty,
    (coalesce(d.due_qty,0) - coalesce(x.alloc_qty,0))::numeric(18,6) as allocated_balance_qty,
    (coalesce(p.paid_qty,0) - coalesce(x.alloc_qty,0))::numeric(18,6) as unallocated_credit_qty
  from assets a
  left join due d on d.asset_code = a.asset_code
  left join paid p on p.asset_code = a.asset_code
  left join alloc x on x.asset_code = a.asset_code
  order by a.asset_code;
end $$;

alter function public.cms_fn_ap_get_system_position_asof_v2(uuid,timestamptz)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_ap_get_system_position_asof_v2(uuid,timestamptz)
  to authenticated, service_role;


-- ============================================================
-- 2) Reconcile v2 patch (signature 유지) : best-fit + NET as-of
--    NOTE: enum/issue_type는 추가하지 않음(프론트 충돌 방지)
-- ============================================================
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

  v_cur_occurred_at timestamptz;

  v_prev_receipt_id uuid;
  v_prev_ver int;
  v_prev_issued_at date;
  v_prev_bill_no text;
  v_prev_occurred_at timestamptz;

  v_run_id uuid;

  -- epsilon (기본: g는 0.###, KRW는 1원 미만 무시)
  v_eps_gold numeric := 0.0005;
  v_eps_silver numeric := 0.010;  -- 은은 초기에는 관대(공장별 상이 가능)
  v_eps_krw numeric := 0.5;

  -- vendor meta
  v_vendor_meta jsonb := '{}'::jsonb;
  v_xag_mode text := 'SOFT';
  v_xag_strict boolean := false;
  v_txt text;

  v_issue_id uuid;
  v_cnt_info int := 0;
  v_cnt_warn int := 0;
  v_cnt_error int := 0;

  v_has_diff boolean;
  v_has_diff_strict boolean;
  v_has_row boolean;
  v_has_krw_diff boolean := false;

  -- recent payment best-fit
  v_last_pay_date date;
  v_best_cand text;
  v_best_score numeric;
  v_rp_ref_date date;

begin
  if p_receipt_id is null then
    raise exception using errcode='P0001', message='receipt_id required';
  end if;

  select vendor_party_id, issued_at, bill_no
    into v_vendor, v_issued_at, v_bill_no
  from public.cms_receipt_inbox
  where receipt_id = p_receipt_id;

  if v_vendor is null or v_issued_at is null then
    raise exception using errcode='P0001', message='receipt header must have vendor_party_id and issued_at';
  end if;

  -- occurred_at: KST 자정 + bill_no suffix(ms)
  if to_regproc('public.cms_fn_receipt_occurred_at_kst_billno_v1(date,text)') is not null then
    v_cur_occurred_at := public.cms_fn_receipt_occurred_at_kst_billno_v1(v_issued_at, v_bill_no);
  else
    -- fallback: day-start
    v_cur_occurred_at := (v_issued_at::timestamp at time zone 'Asia/Seoul');
  end if;

  select snapshot_version into v_cur_ver
  from public.cms_factory_receipt_snapshot
  where receipt_id = p_receipt_id and is_current = true
  order by snapshot_version desc
  limit 1;

  if v_cur_ver is null then
    raise exception using errcode='P0001', message='factory snapshot not found';
  end if;

  select calc_version into v_calc_ver
  from public.cms_ap_internal_calc_snapshot
  where receipt_id = p_receipt_id and is_current = true
  order by calc_version desc
  limit 1;

  -- vendor meta (은 strict 여부/eps override 등)
  if to_regclass('public.cms_vendor_fax_config') is not null then
    select coalesce(meta,'{}'::jsonb)
      into v_vendor_meta
    from public.cms_vendor_fax_config
    where vendor_party_id = v_vendor
      and is_active = true
    order by updated_at desc nulls last
    limit 1;
  end if;

  v_xag_mode := upper(coalesce(nullif(trim(coalesce(v_vendor_meta->>'ap_reconcile_xag_mode','')), ''), 'SOFT'));
  v_xag_strict := (v_xag_mode in ('HARD','STRICT','ON','TRUE','1'));

  -- optional eps override (string numeric)
  v_txt := nullif(trim(coalesce(v_vendor_meta->>'ap_reconcile_eps_gold_g','')), '');
  if v_txt is not null and v_txt ~ '^[0-9]+(\.[0-9]+)?$' then
    v_eps_gold := v_txt::numeric;
  end if;

  v_txt := nullif(trim(coalesce(v_vendor_meta->>'ap_reconcile_eps_silver_g','')), '');
  if v_txt is not null and v_txt ~ '^[0-9]+(\.[0-9]+)?$' then
    v_eps_silver := v_txt::numeric;
  end if;

  v_txt := nullif(trim(coalesce(v_vendor_meta->>'ap_reconcile_eps_krw','')), '');
  if v_txt is not null and v_txt ~ '^[0-9]+(\.[0-9]+)?$' then
    v_eps_krw := v_txt::numeric;
  end if;

  if not v_xag_strict then
    -- 비엄격 모드에서는 은 mismatch를 기본적으로 WARN로만 만들도록 eps를 넉넉히
    v_eps_silver := greatest(v_eps_silver, 0.010);
  end if;

  -- 이전 receipt: occurred_at 기준 바로 직전(같은 날 다건 포함)
  with candidates as (
    select
      r2.receipt_id,
      r2.issued_at,
      coalesce(r2.bill_no,'') as bill_no,
      case
        when to_regproc('public.cms_fn_receipt_occurred_at_kst_billno_v1(date,text)') is not null
          then public.cms_fn_receipt_occurred_at_kst_billno_v1(r2.issued_at, r2.bill_no)
        else (r2.issued_at::timestamp at time zone 'Asia/Seoul')
      end as occurred_at
    from public.cms_receipt_inbox r2
    where r2.vendor_party_id = v_vendor
      and r2.receipt_id <> p_receipt_id
  )
  select receipt_id, issued_at, bill_no, occurred_at
    into v_prev_receipt_id, v_prev_issued_at, v_prev_bill_no, v_prev_occurred_at
  from candidates
  where occurred_at < v_cur_occurred_at
  order by occurred_at desc, receipt_id::text desc
  limit 1;

  if v_prev_receipt_id is not null then
    select snapshot_version into v_prev_ver
    from public.cms_factory_receipt_snapshot
    where receipt_id = v_prev_receipt_id and is_current = true
    order by snapshot_version desc
    limit 1;
  end if;

  -- 이전 reconcile issue 정리(OPEN/ACKED -> IGNORED)
  update public.cms_ap_reconcile_issue
     set status = 'IGNORED',
         resolved_at = now(),
         resolved_by = auth.uid(),
         resolution_note = coalesce(resolution_note,'') || ' | superseded by new reconcile run'
   where receipt_id = p_receipt_id
     and vendor_party_id = v_vendor
     and status in ('OPEN','ACKED');

  insert into public.cms_ap_reconcile_run(receipt_id, vendor_party_id, snapshot_version, calc_version, created_by)
  values (p_receipt_id, v_vendor, v_cur_ver, v_calc_ver, auth.uid())
  returning run_id into v_run_id;

  -- ==========================================================
  -- helper: per-asset epsilon
  -- ==========================================================
  -- inline CASE in each diff check


  -- ==========================================================
  -- (1) PRE_BALANCE vs PREV POST_BALANCE
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
        round((coalesce(cp.qty,0) - coalesce(pp.qty,0)), 6) as diff_qty
      from assets a
      left join prev_post pp on pp.asset_code = a.asset_code
      left join cur_pre cp on cp.asset_code = a.asset_code
    ),
    flags as (
      select
        exists (
          select 1 from diff
          where abs(diff_qty) > (case
            when asset_code::text like 'KRW%' then v_eps_krw
            when asset_code = 'XAG_G' then v_eps_silver
            else v_eps_gold
          end)
        ) as has_any,
        exists (
          select 1 from diff
          where abs(diff_qty) > (case
            when asset_code::text like 'KRW%' then v_eps_krw
            when asset_code = 'XAG_G' then v_eps_silver
            else v_eps_gold
          end)
          and (
            asset_code::text like 'KRW%'
            or asset_code = 'XAU_G'
            or (asset_code = 'XAG_G' and v_xag_strict)
          )
        ) as has_strict
    )
    select has_any, has_strict into v_has_diff, v_has_diff_strict
    from flags;

    if v_has_diff then
      insert into public.cms_ap_reconcile_issue(
        run_id, receipt_id, vendor_party_id, issue_type, severity, status, summary, details, created_by
      )
      values (
        v_run_id, p_receipt_id, v_vendor,
        'PRE_NEQ_PREV_POST',
        case when v_has_diff_strict then 'ERROR' else 'WARN' end,
        'OPEN',
        'PRE_BALANCE(current) != POST_BALANCE(previous) (check missing/backdated receipt order)',
        jsonb_build_object(
          'prev_receipt_id', v_prev_receipt_id,
          'prev_issued_at', v_prev_issued_at,
          'prev_bill_no', v_prev_bill_no,
          'prev_snapshot_version', v_prev_ver,
          'prev_occurred_at', v_prev_occurred_at,
          'cur_occurred_at', v_cur_occurred_at,
          'eps', jsonb_build_object('gold_g', v_eps_gold, 'silver_g', v_eps_silver, 'krw', v_eps_krw),
          'xag_mode', v_xag_mode
        ),
        auth.uid()
      )
      returning issue_id into v_issue_id;

      insert into public.cms_ap_reconcile_issue_leg(issue_id, asset_code, expected_qty, actual_qty, diff_qty)
      select v_issue_id, asset_code, expected_qty, actual_qty, diff_qty
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
          round((coalesce(cp.qty,0) - coalesce(pp.qty,0)), 6) as diff_qty
        from assets a
        left join prev_post pp on pp.asset_code = a.asset_code
        left join cur_pre cp on cp.asset_code = a.asset_code
      ) d
      where abs(diff_qty) > (case
        when asset_code::text like 'KRW%' then v_eps_krw
        when asset_code = 'XAG_G' then v_eps_silver
        else v_eps_gold
      end);

      if v_has_diff_strict then
        v_cnt_error := v_cnt_error + 1;
      else
        v_cnt_warn := v_cnt_warn + 1;
      end if;
    end if;
  end if;

  -- ==========================================================
  -- (2) PRE + SALE - RECENT_PAYMENT = POST (RECENT 있으면)
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
  recent as (
    select asset_code, qty
    from public.cms_factory_receipt_statement_leg
    where receipt_id = p_receipt_id and snapshot_version = v_cur_ver and row_code = 'RECENT_PAYMENT'
  ),
  post as (
    select asset_code, qty
    from public.cms_factory_receipt_statement_leg
    where receipt_id = p_receipt_id and snapshot_version = v_cur_ver and row_code = 'POST_BALANCE'
  ),
  diff as (
    select
      a.asset_code,
      (coalesce(p.qty,0) + coalesce(s.qty,0) - coalesce(r.qty,0)) as expected_qty,
      coalesce(po.qty,0) as actual_qty,
      round((coalesce(po.qty,0) - (coalesce(p.qty,0) + coalesce(s.qty,0) - coalesce(r.qty,0))), 6) as diff_qty
    from assets a
    left join pre p on p.asset_code = a.asset_code
    left join sale s on s.asset_code = a.asset_code
    left join recent r on r.asset_code = a.asset_code
    left join post po on po.asset_code = a.asset_code
  ),
  flags as (
    select
      exists (
        select 1 from diff
        where abs(diff_qty) > (case
          when asset_code::text like 'KRW%' then v_eps_krw
          when asset_code = 'XAG_G' then v_eps_silver
          else v_eps_gold
        end)
      ) as has_any,
      exists (
        select 1 from diff
        where abs(diff_qty) > (case
          when asset_code::text like 'KRW%' then v_eps_krw
          when asset_code = 'XAG_G' then v_eps_silver
          else v_eps_gold
        end)
        and (
          asset_code::text like 'KRW%'
          or asset_code = 'XAU_G'
          or (asset_code = 'XAG_G' and v_xag_strict)
        )
      ) as has_strict
  )
  select has_any, has_strict into v_has_diff, v_has_diff_strict
  from flags;

  if v_has_diff then
    insert into public.cms_ap_reconcile_issue(
      run_id, receipt_id, vendor_party_id, issue_type, severity, status, summary, details, created_by
    )
    values (
      v_run_id, p_receipt_id, v_vendor,
      'PRE_PLUS_SALE_NEQ_POST',
      case when v_has_diff_strict then 'ERROR' else 'WARN' end,
      'OPEN',
      'PRE + SALE - RECENT_PAYMENT != POST_BALANCE (factory statement inconsistent or missing component)',
      jsonb_build_object(
        'uses_recent_payment', true,
        'eps', jsonb_build_object('gold_g', v_eps_gold, 'silver_g', v_eps_silver, 'krw', v_eps_krw),
        'xag_mode', v_xag_mode
      ),
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
      recent as (
        select asset_code, qty
        from public.cms_factory_receipt_statement_leg
        where receipt_id = p_receipt_id and snapshot_version = v_cur_ver and row_code = 'RECENT_PAYMENT'
      ),
      post as (
        select asset_code, qty
        from public.cms_factory_receipt_statement_leg
        where receipt_id = p_receipt_id and snapshot_version = v_cur_ver and row_code = 'POST_BALANCE'
      )
      select
        a.asset_code,
        (coalesce(p.qty,0) + coalesce(s.qty,0) - coalesce(r.qty,0)) as expected_qty,
        coalesce(po.qty,0) as actual_qty,
        round((coalesce(po.qty,0) - (coalesce(p.qty,0) + coalesce(s.qty,0) - coalesce(r.qty,0))), 6) as diff_qty
      from assets a
      left join pre p on p.asset_code = a.asset_code
      left join sale s on s.asset_code = a.asset_code
      left join recent r on r.asset_code = a.asset_code
      left join post po on po.asset_code = a.asset_code
    ) d
    where abs(diff_qty) > (case
      when asset_code::text like 'KRW%' then v_eps_krw
      when asset_code = 'XAG_G' then v_eps_silver
      else v_eps_gold
    end);

    if v_has_diff_strict then
      v_cnt_error := v_cnt_error + 1;
    else
      v_cnt_warn := v_cnt_warn + 1;
    end if;
  end if;

  -- ==========================================================
  -- (3) FACTORY SALE != INTERNAL CALC (있을 때만)
  --     - KRW mismatch면 ERROR
  --     - 은(XAG)는 SOFT면 비교에서 제외(노이즈 감소)
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
        round((coalesce(f.qty,0) - coalesce(i.qty,0)), 6) as diff_qty
      from internal i
      left join factory_sale f on f.asset_code = i.asset_code
      where (v_xag_strict or i.asset_code <> 'XAG_G')
    )
    select
      exists (
        select 1 from diff
        where abs(diff_qty) > (case
          when asset_code::text like 'KRW%' then v_eps_krw
          when asset_code = 'XAG_G' then v_eps_silver
          else v_eps_gold
        end)
      ) as has_any_diff,
      exists (
        select 1 from diff
        where asset_code = 'KRW_LABOR' and abs(diff_qty) > v_eps_krw
      ) as has_krw_diff
    into v_has_diff, v_has_krw_diff;

    if v_has_diff then
      insert into public.cms_ap_reconcile_issue(
        run_id, receipt_id, vendor_party_id, issue_type, severity, status, summary, details, created_by
      )
      values (
        v_run_id, p_receipt_id, v_vendor,
        'FACTORY_SALE_NEQ_INTERNAL_CALC',
        case when v_has_krw_diff then 'ERROR' else 'WARN' end,
        'OPEN',
        'FACTORY SALE != INTERNAL CALC (review receipt line inputs / calc rules)',
        jsonb_build_object(
          'calc_version', v_calc_ver,
          'eps', jsonb_build_object('gold_g', v_eps_gold, 'silver_g', v_eps_silver, 'krw', v_eps_krw),
          'xag_mode', v_xag_mode
        ),
        auth.uid()
      )
      returning issue_id into v_issue_id;

      insert into public.cms_ap_reconcile_issue_leg(issue_id, asset_code, expected_qty, actual_qty, diff_qty)
      select v_issue_id, asset_code, expected_qty, actual_qty, diff_qty
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
          round((coalesce(f.qty,0) - coalesce(i.qty,0)), 6) as diff_qty
        from internal i
        left join factory_sale f on f.asset_code = i.asset_code
        where (v_xag_strict or i.asset_code <> 'XAG_G')
      ) d
      where abs(diff_qty) > (case
        when asset_code::text like 'KRW%' then v_eps_krw
        when asset_code = 'XAG_G' then v_eps_silver
        else v_eps_gold
      end);

      if v_has_krw_diff then
        v_cnt_error := v_cnt_error + 1;
      else
        v_cnt_warn := v_cnt_warn + 1;
      end if;
    end if;
  end if;

  -- ==========================================================
  -- (4) RECENT_PAYMENT(factory) vs SYSTEM payments (best-fit)
  --     - RECENT_PAYMENT row가 있을 때만 검사
  -- ==========================================================
  select exists (
    select 1
    from public.cms_factory_receipt_statement_leg
    where receipt_id = p_receipt_id
      and snapshot_version = v_cur_ver
      and row_code = 'RECENT_PAYMENT'
  ) into v_has_row;

  if v_has_row then
    -- factory row-level ref_date (있으면 우선)
    select max(ref_date) into v_rp_ref_date
    from public.cms_factory_receipt_statement_row
    where receipt_id = p_receipt_id
      and snapshot_version = v_cur_ver
      and row_code = 'RECENT_PAYMENT';

    -- 결제일 중 제일 최근일(= last payment date <= receipt occurred_at)
    select max(((p.paid_at at time zone 'Asia/Seoul')::date))
      into v_last_pay_date
    from public.cms_ap_payment p
    where p.vendor_party_id = v_vendor
      and p.paid_at <= v_cur_occurred_at;

    -- best-fit candidate selection
    with assets as (
      select unnest(enum_range(null::public.cms_asset_code)) as asset_code
    ),
    factory_rp as (
      select asset_code, qty
      from public.cms_factory_receipt_statement_leg
      where receipt_id = p_receipt_id and snapshot_version = v_cur_ver and row_code = 'RECENT_PAYMENT'
    ),
    -- candidates are expressed as (cand, asset_code, qty)
    cand as (
      -- A) explicit ref_date (from factory row) : total
      select 'REF_DATE_TOTAL'::text as cand, pl.asset_code, coalesce(sum(pl.qty),0) as qty
      from public.cms_ap_payment p
      join public.cms_ap_payment_leg pl on pl.payment_id = p.payment_id
      where p.vendor_party_id = v_vendor
        and v_rp_ref_date is not null
        and ((p.paid_at at time zone 'Asia/Seoul')::date = v_rp_ref_date)
      group by pl.asset_code

      union all
      -- B) last payment date <= occurred_at : total
      select 'LAST_PAY_DATE_TOTAL', pl.asset_code, coalesce(sum(pl.qty),0)
      from public.cms_ap_payment p
      join public.cms_ap_payment_leg pl on pl.payment_id = p.payment_id
      where p.vendor_party_id = v_vendor
        and v_last_pay_date is not null
        and ((p.paid_at at time zone 'Asia/Seoul')::date = v_last_pay_date)
      group by pl.asset_code

      union all
      -- C) last payment date <= occurred_at : up-to occurred_at
      select 'LAST_PAY_DATE_UPTO', pl.asset_code, coalesce(sum(pl.qty),0)
      from public.cms_ap_payment p
      join public.cms_ap_payment_leg pl on pl.payment_id = p.payment_id
      where p.vendor_party_id = v_vendor
        and v_last_pay_date is not null
        and ((p.paid_at at time zone 'Asia/Seoul')::date = v_last_pay_date)
        and p.paid_at <= v_cur_occurred_at
      group by pl.asset_code

      union all
      -- D) period (prev_receipt_occurred, cur_receipt_occurred]
      select 'PERIOD_PREV_TO_CURR', pl.asset_code, coalesce(sum(pl.qty),0)
      from public.cms_ap_payment p
      join public.cms_ap_payment_leg pl on pl.payment_id = p.payment_id
      where p.vendor_party_id = v_vendor
        and v_prev_occurred_at is not null
        and p.paid_at > v_prev_occurred_at
        and p.paid_at <= v_cur_occurred_at
      group by pl.asset_code

      union all
      -- E) issued_at day total
      select 'ISSUED_DAY_TOTAL', pl.asset_code, coalesce(sum(pl.qty),0)
      from public.cms_ap_payment p
      join public.cms_ap_payment_leg pl on pl.payment_id = p.payment_id
      where p.vendor_party_id = v_vendor
        and ((p.paid_at at time zone 'Asia/Seoul')::date = v_issued_at)
      group by pl.asset_code

      union all
      -- F) issued_at day up-to occurred
      select 'ISSUED_DAY_UPTO', pl.asset_code, coalesce(sum(pl.qty),0)
      from public.cms_ap_payment p
      join public.cms_ap_payment_leg pl on pl.payment_id = p.payment_id
      where p.vendor_party_id = v_vendor
        and ((p.paid_at at time zone 'Asia/Seoul')::date = v_issued_at)
        and p.paid_at <= v_cur_occurred_at
      group by pl.asset_code
    ),
    cands as (
      select distinct cand from cand
    ),
    scored as (
      select
        c.cand,
        sum(
          case
            when a.asset_code::text like 'KRW%' then abs(coalesce(fr.qty,0) - coalesce(cd.qty,0)) / greatest(v_eps_krw, 0.000001)
            when a.asset_code = 'XAG_G' then abs(coalesce(fr.qty,0) - coalesce(cd.qty,0)) / greatest(v_eps_silver, 0.000001)
            else abs(coalesce(fr.qty,0) - coalesce(cd.qty,0)) / greatest(v_eps_gold, 0.000001)
          end
        ) as score
      from cands c
      cross join assets a
      left join factory_rp fr on fr.asset_code = a.asset_code
      left join cand cd on cd.cand = c.cand and cd.asset_code = a.asset_code
      -- 은은 SOFT면 스코어에서 제외(선택에 영향 X)
      where (v_xag_strict or a.asset_code <> 'XAG_G')
      group by c.cand
    )
    select cand, score into v_best_cand, v_best_score
    from scored
    order by score asc, cand asc
    limit 1;

    -- best candidate와 factory_rp 비교
    with assets as (
      select unnest(enum_range(null::public.cms_asset_code)) as asset_code
    ),
    factory_rp as (
      select asset_code, qty
      from public.cms_factory_receipt_statement_leg
      where receipt_id = p_receipt_id and snapshot_version = v_cur_ver and row_code = 'RECENT_PAYMENT'
    ),
    sys_best as (
      select
        a.asset_code,
        coalesce(sum(pl.qty),0) as qty
      from assets a
      left join public.cms_ap_payment p on p.vendor_party_id = v_vendor
      left join public.cms_ap_payment_leg pl on pl.payment_id = p.payment_id and pl.asset_code = a.asset_code
      where (
        (v_best_cand = 'REF_DATE_TOTAL' and v_rp_ref_date is not null and ((p.paid_at at time zone 'Asia/Seoul')::date = v_rp_ref_date))
        or (v_best_cand = 'LAST_PAY_DATE_TOTAL' and v_last_pay_date is not null and ((p.paid_at at time zone 'Asia/Seoul')::date = v_last_pay_date))
        or (v_best_cand = 'LAST_PAY_DATE_UPTO' and v_last_pay_date is not null and ((p.paid_at at time zone 'Asia/Seoul')::date = v_last_pay_date) and p.paid_at <= v_cur_occurred_at)
        or (v_best_cand = 'PERIOD_PREV_TO_CURR' and v_prev_occurred_at is not null and p.paid_at > v_prev_occurred_at and p.paid_at <= v_cur_occurred_at)
        or (v_best_cand = 'ISSUED_DAY_TOTAL' and ((p.paid_at at time zone 'Asia/Seoul')::date = v_issued_at))
        or (v_best_cand = 'ISSUED_DAY_UPTO' and ((p.paid_at at time zone 'Asia/Seoul')::date = v_issued_at) and p.paid_at <= v_cur_occurred_at)
      )
      group by a.asset_code
    ),
    diff as (
      select
        a.asset_code,
        coalesce(sb.qty,0) as expected_qty,
        coalesce(fr.qty,0) as actual_qty,
        round((coalesce(fr.qty,0) - coalesce(sb.qty,0)), 6) as diff_qty
      from assets a
      left join sys_best sb on sb.asset_code = a.asset_code
      left join factory_rp fr on fr.asset_code = a.asset_code
    )
    select exists (
      select 1 from diff
      where abs(diff_qty) > (case
        when asset_code::text like 'KRW%' then v_eps_krw
        when asset_code = 'XAG_G' then v_eps_silver
        else v_eps_gold
      end)
    ) into v_has_diff;

    if v_has_diff then
      insert into public.cms_ap_reconcile_issue(
        run_id, receipt_id, vendor_party_id, issue_type, severity, status, summary, details, created_by
      )
      values (
        v_run_id, p_receipt_id, v_vendor,
        'RECENT_PAYMENT_INCONSISTENT',
        'WARN',
        'OPEN',
        'RECENT_PAYMENT(factory) != system payments (best-fit window). Check ref_date/window or missing payment entry.',
        jsonb_build_object(
          'best_candidate', v_best_cand,
          'best_score', v_best_score,
          'factory_ref_date', v_rp_ref_date,
          'last_pay_date', v_last_pay_date,
          'prev_occurred_at', v_prev_occurred_at,
          'cur_occurred_at', v_cur_occurred_at,
          'eps', jsonb_build_object('gold_g', v_eps_gold, 'silver_g', v_eps_silver, 'krw', v_eps_krw),
          'xag_mode', v_xag_mode
        ),
        auth.uid()
      )
      returning issue_id into v_issue_id;

      insert into public.cms_ap_reconcile_issue_leg(issue_id, asset_code, expected_qty, actual_qty, diff_qty)
      with assets as (
        select unnest(enum_range(null::public.cms_asset_code)) as asset_code
      ),
      factory_rp as (
        select asset_code, qty
        from public.cms_factory_receipt_statement_leg
        where receipt_id = p_receipt_id and snapshot_version = v_cur_ver and row_code = 'RECENT_PAYMENT'
      ),
      sys_best as (
        select
          a.asset_code,
          coalesce(sum(pl.qty),0) as qty
        from assets a
        left join public.cms_ap_payment p on p.vendor_party_id = v_vendor
        left join public.cms_ap_payment_leg pl on pl.payment_id = p.payment_id and pl.asset_code = a.asset_code
        where (
          (v_best_cand = 'REF_DATE_TOTAL' and v_rp_ref_date is not null and ((p.paid_at at time zone 'Asia/Seoul')::date = v_rp_ref_date))
          or (v_best_cand = 'LAST_PAY_DATE_TOTAL' and v_last_pay_date is not null and ((p.paid_at at time zone 'Asia/Seoul')::date = v_last_pay_date))
          or (v_best_cand = 'LAST_PAY_DATE_UPTO' and v_last_pay_date is not null and ((p.paid_at at time zone 'Asia/Seoul')::date = v_last_pay_date) and p.paid_at <= v_cur_occurred_at)
          or (v_best_cand = 'PERIOD_PREV_TO_CURR' and v_prev_occurred_at is not null and p.paid_at > v_prev_occurred_at and p.paid_at <= v_cur_occurred_at)
          or (v_best_cand = 'ISSUED_DAY_TOTAL' and ((p.paid_at at time zone 'Asia/Seoul')::date = v_issued_at))
          or (v_best_cand = 'ISSUED_DAY_UPTO' and ((p.paid_at at time zone 'Asia/Seoul')::date = v_issued_at) and p.paid_at <= v_cur_occurred_at)
        )
        group by a.asset_code
      )
      select
        v_issue_id,
        a.asset_code,
        coalesce(sb.qty,0) as expected_qty,
        coalesce(fr.qty,0) as actual_qty,
        round((coalesce(fr.qty,0) - coalesce(sb.qty,0)), 6) as diff_qty
      from assets a
      left join sys_best sb on sb.asset_code = a.asset_code
      left join factory_rp fr on fr.asset_code = a.asset_code
      where abs(round((coalesce(fr.qty,0) - coalesce(sb.qty,0)), 6)) > (case
        when a.asset_code::text like 'KRW%' then v_eps_krw
        when a.asset_code = 'XAG_G' then v_eps_silver
        else v_eps_gold
      end);

      v_cnt_warn := v_cnt_warn + 1;
    end if;
  end if;

  -- ==========================================================
  -- (5) POST_BALANCE(factory) vs SYSTEM NET balance(as-of occurred_at)
  --     - ERROR only if strict assets mismatch
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
    select asset_code, net_balance_qty as qty
    from public.cms_fn_ap_get_system_position_asof_v2(v_vendor, v_cur_occurred_at)
  ),
  diff as (
    select
      a.asset_code,
      coalesce(sa.qty,0) as expected_qty,
      coalesce(fp.qty,0) as actual_qty,
      round((coalesce(fp.qty,0) - coalesce(sa.qty,0)), 6) as diff_qty
    from assets a
    left join sys_asof sa on sa.asset_code = a.asset_code
    left join factory_post fp on fp.asset_code = a.asset_code
  ),
  flags as (
    select
      exists (
        select 1 from diff
        where abs(diff_qty) > (case
          when asset_code::text like 'KRW%' then v_eps_krw
          when asset_code = 'XAG_G' then v_eps_silver
          else v_eps_gold
        end)
      ) as has_any,
      exists (
        select 1 from diff
        where abs(diff_qty) > (case
          when asset_code::text like 'KRW%' then v_eps_krw
          when asset_code = 'XAG_G' then v_eps_silver
          else v_eps_gold
        end)
        and (
          asset_code::text like 'KRW%'
          or asset_code = 'XAU_G'
          or (asset_code = 'XAG_G' and v_xag_strict)
        )
      ) as has_strict
  )
  select has_any, has_strict into v_has_diff, v_has_diff_strict
  from flags;

  if v_has_diff then
    insert into public.cms_ap_reconcile_issue(
      run_id, receipt_id, vendor_party_id, issue_type, severity, status, summary, details, created_by
    )
    values (
      v_run_id, p_receipt_id, v_vendor,
      'FACTORY_POST_NEQ_SYSTEM_ASOF',
      case when v_has_diff_strict then 'ERROR' else 'WARN' end,
      'OPEN',
      'POST_BALANCE(factory) != system NET balance(as-of occurred_at). Check missing SALE sync, wrong payment entry, or adjustment needed.',
      jsonb_build_object(
        'as_of_occurred_at', v_cur_occurred_at,
        'eps', jsonb_build_object('gold_g', v_eps_gold, 'silver_g', v_eps_silver, 'krw', v_eps_krw),
        'xag_mode', v_xag_mode,
        'system_position', (
          select jsonb_agg(jsonb_build_object(
            'asset_code', asset_code,
            'due', due_qty,
            'paid', paid_qty,
            'alloc', alloc_qty,
            'net_balance', net_balance_qty,
            'allocated_balance', allocated_balance_qty,
            'unallocated_credit', unallocated_credit_qty
          ) order by asset_code)
          from public.cms_fn_ap_get_system_position_asof_v2(v_vendor, v_cur_occurred_at)
        )
      ),
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
        select asset_code, net_balance_qty as qty
        from public.cms_fn_ap_get_system_position_asof_v2(v_vendor, v_cur_occurred_at)
      )
      select
        a.asset_code,
        coalesce(sa.qty,0) as expected_qty,
        coalesce(fp.qty,0) as actual_qty,
        round((coalesce(fp.qty,0) - coalesce(sa.qty,0)), 6) as diff_qty
      from assets a
      left join sys_asof sa on sa.asset_code = a.asset_code
      left join factory_post fp on fp.asset_code = a.asset_code
    ) d
    where abs(diff_qty) > (case
      when asset_code::text like 'KRW%' then v_eps_krw
      when asset_code = 'XAG_G' then v_eps_silver
      else v_eps_gold
    end);

    if v_has_diff_strict then
      v_cnt_error := v_cnt_error + 1;
    else
      v_cnt_warn := v_cnt_warn + 1;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'run_id', v_run_id,
    'receipt_id', p_receipt_id,
    'vendor_party_id', v_vendor,
    'snapshot_version', v_cur_ver,
    'calc_version', v_calc_ver,
    'prev_receipt_id', v_prev_receipt_id,
    'prev_snapshot_version', v_prev_ver,
    'occurred_at', v_cur_occurred_at,
    'xag_mode', v_xag_mode,
    'issues', jsonb_build_object(
      'info', v_cnt_info,
      'warn', v_cnt_warn,
      'error', v_cnt_error
    ),
    'epsilon', jsonb_build_object(
      'gold_g', v_eps_gold,
      'silver_g', v_eps_silver,
      'krw', v_eps_krw
    )
  );
end $$;

alter function public.cms_fn_ap_run_reconcile_for_receipt_v2(uuid)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_ap_run_reconcile_for_receipt_v2(uuid)
  to authenticated, service_role;


-- ============================================================
-- 3) 4행 저장 RPC v2: sync/reconcile 실패해도 snapshot은 남긴다
-- ============================================================
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

  v_sync_err text;
  v_sync_state text;
  v_recon_err text;
  v_recon_state text;
begin
  if p_receipt_id is null then
    raise exception using errcode='P0001', message='receipt_id required';
  end if;

  if jsonb_typeof(coalesce(p_statement,'{}'::jsonb)) <> 'object' then
    raise exception using errcode='P0001', message='statement must be json object';
  end if;

  select vendor_party_id, issued_at, bill_no
    into v_vendor, v_issued_at, v_bill_no
  from public.cms_receipt_inbox
  where receipt_id = p_receipt_id;

  if v_vendor is null or v_issued_at is null then
    raise exception using errcode='P0001', message='receipt header must have vendor_party_id and issued_at';
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
    raise exception using errcode='P0001', message='statement.rows must be array';
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
      raise exception using errcode='P0001', message='row.legs must be array';
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

  -- 중요: sync/reconcile은 예외 격리(실패해도 4행 스냅샷은 남김)
  begin
    v_sync := public.cms_fn_ap2_sync_from_receipt_v1(p_receipt_id, p_note);
  exception when others then
    v_sync_state := sqlstate;
    v_sync_err := sqlerrm;
    v_sync := jsonb_build_object('ok', false, 'error', v_sync_err, 'sqlstate', v_sync_state);
  end;

  begin
    v_recon := public.cms_fn_ap_run_reconcile_for_receipt_v2(p_receipt_id);
  exception when others then
    v_recon_state := sqlstate;
    v_recon_err := sqlerrm;
    v_recon := jsonb_build_object('ok', false, 'error', v_recon_err, 'sqlstate', v_recon_state);
  end;

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


-- ============================================================
-- 4) Payment guard: block only on truly blocking ERRORs
--    (allocation mismatch / internal-calc mismatch는 결제까지 막지 않음)
-- ============================================================
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
  select count(*) into v_err
  from public.cms_ap_reconcile_issue i
  where i.vendor_party_id = p_vendor_party_id
    and i.status in ('OPEN','ACKED')
    and i.severity = 'ERROR'
    and i.issue_type in (
      'PRE_NEQ_PREV_POST',
      'PRE_PLUS_SALE_NEQ_POST',
      'FACTORY_POST_NEQ_SYSTEM_ASOF'
    );

  if coalesce(v_err,0) > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'PAYMENT_BLOCKED: vendor has %s blocking reconcile ERROR issue(s) (PRE/POS mismatch or POST!=SYSTEM NET). Resolve/ACK/adjust in AP Reconcile first.',
        v_err
      );
  end if;

  -- FIFO는 v2(=vendor 단위 advisory lock)로 실행
  return public.cms_fn_ap2_pay_and_fifo_v2(
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
