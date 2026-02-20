-- 20260211000011_cms_0411_ap_reconcile_epsilon_fix_and_round.sql
-- ADD-ONLY / DBPUSH-safe:
-- Hotfix for reconcile false positives (diff = -0 but triggers warning)
-- Root cause: floating point arithmetic creates noise below epsilon (0.000001)
-- Solution:
--   1) ROUND diff_qty to 6 decimal places (same as storage precision)
--   2) Increase epsilon threshold to 0.001g (1mg) for gold/silver
--      (0.000001g = 0.001mg is too tight for累積 rounding errors)

set search_path = public, pg_temp;
begin;
-- =============================================================
-- Preflight: make sure we have the v2 reconcile function
-- =============================================================
do $$
begin
  if to_regproc('public.cms_fn_ap_run_reconcile_for_receipt_v2') is null then
    raise exception 'cms_fn_ap_run_reconcile_for_receipt_v2 not found (run cms_0350 first)';
  end if;
end $$;
-- =============================================================
-- Reconcile v2 with ROUND(diff_qty, 6) and adjusted epsilon
-- =============================================================
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

  -- epsilon: 0.001g (1mg) for gold/silver, 0.5 KRW for cash
  -- (0.000001g = 0.001mg was too tight, causing false positives from accumulated rounding errors)
  v_eps_g numeric := 0.001;
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
  --     ** ROUND(diff_qty, 6) to eliminate floating point noise **
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
          round((coalesce(cp.qty,0) - coalesce(pp.qty,0)), 6) as diff_qty
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
      round((coalesce(po.qty,0) - (coalesce(p.qty,0) + coalesce(s.qty,0))), 6) as diff_qty
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
        round((coalesce(po.qty,0) - (coalesce(p.qty,0) + coalesce(s.qty,0))), 6) as diff_qty
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
        round((coalesce(f.qty,0) - coalesce(i.qty,0)), 6) as diff_qty
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
          round((coalesce(f.qty,0) - coalesce(i.qty,0)), 6) as diff_qty
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
          round((coalesce(fr.qty,0) - coalesce(sp.qty,0)), 6) as diff_qty
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
            round((coalesce(fr.qty,0) - coalesce(sp.qty,0)), 6) as diff_qty
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
      round((coalesce(fp.qty,0) - coalesce(sa.qty,0)), 6) as diff_qty
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
        round((coalesce(fp.qty,0) - coalesce(sa.qty,0)), 6) as diff_qty
      from assets a
      left join sys_asof sa on sa.asset_code = a.asset_code
      left join factory_post fp on fp.asset_code = a.asset_code
    ) d
    where case when asset_code::text like 'KRW%' then abs(diff_qty) > v_eps_krw else abs(diff_qty) > v_eps_g end;

    v_cnt_error := v_cnt_error + 1;
  end if;

  -- ==========================================================
  -- return summary
  -- ==========================================================
  return jsonb_build_object(
    'ok', true,
    'run_id', v_run_id,
    'receipt_id', p_receipt_id,
    'vendor_party_id', v_vendor,
    'snapshot_version', v_cur_ver,
    'calc_version', v_calc_ver,
    'prev_receipt_id', v_prev_receipt_id,
    'prev_snapshot_version', v_prev_ver,
    'issues', jsonb_build_object(
      'info', v_cnt_info,
      'warn', v_cnt_warn,
      'error', v_cnt_error
    ),
    'epsilon', jsonb_build_object(
      'g', v_eps_g,
      'krw', v_eps_krw
    )
  );
end $$;
alter function public.cms_fn_ap_run_reconcile_for_receipt_v2(uuid)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_ap_run_reconcile_for_receipt_v2(uuid)
  to authenticated, service_role;
commit;
