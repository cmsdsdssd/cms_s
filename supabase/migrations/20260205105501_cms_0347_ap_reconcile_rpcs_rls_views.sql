set search_path = public, pg_temp;

begin;

-- ============================================================
-- 1) RLS + SELECT POLICIES (최소: 읽기만 열기)
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'cms_factory_receipt_snapshot',
    'cms_factory_receipt_statement_row',
    'cms_factory_receipt_statement_leg',
    'cms_factory_receipt_item_line',
    'cms_ap_internal_calc_snapshot',
    'cms_ap_invoice',
    'cms_ap_invoice_leg',
    'cms_ap_payment',
    'cms_ap_payment_leg',
    'cms_ap_alloc',
    'cms_ap_alloc_leg',
    'cms_ap_reconcile_run',
    'cms_ap_reconcile_issue',
    'cms_ap_reconcile_issue_leg',
    'cms_ap_adjustment_link'
  ]
  loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security', t);

      -- drop 기존 select 정책들(있으면)
      execute format('drop policy if exists cms_select_authenticated on public.%I', t);
      execute format('drop policy if exists cms_select_anon on public.%I', t);

      -- select 허용
      execute format('create policy cms_select_authenticated on public.%I for select to authenticated using (true)', t);
      execute format('create policy cms_select_anon on public.%I for select to anon using (true)', t);

      -- 권한
      execute format('grant select on public.%I to authenticated', t);
      execute format('grant select on public.%I to anon', t);
    end if;
  end loop;
end $$;


-- ============================================================
-- 2) VIEW PATCH: security_invoker = true 로 재생성
--    (지난 파일에서 만든 view가 있으면 교체)
-- ============================================================
drop view if exists public.cms_v_ap_reconcile_open_by_vendor_v1 cascade;
create view public.cms_v_ap_reconcile_open_by_vendor_v1
with (security_invoker = true)
as
select
  vendor_party_id,
  count(*) filter (where status in ('OPEN','ACKED')) as open_count,
  count(*) filter (where status in ('OPEN','ACKED') and severity='ERROR') as error_count,
  count(*) filter (where status in ('OPEN','ACKED') and severity='WARN') as warn_count,
  max(created_at) filter (where status in ('OPEN','ACKED')) as last_open_at
from public.cms_ap_reconcile_issue
group by vendor_party_id;

grant select on public.cms_v_ap_reconcile_open_by_vendor_v1 to authenticated;
grant select on public.cms_v_ap_reconcile_open_by_vendor_v1 to anon;

drop view if exists public.cms_v_ap_reconcile_issue_list_v1 cascade;
create view public.cms_v_ap_reconcile_issue_list_v1
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
  r.calc_version
from public.cms_ap_reconcile_issue i
join public.cms_ap_reconcile_run r on r.run_id = i.run_id;

grant select on public.cms_v_ap_reconcile_issue_list_v1 to authenticated;
grant select on public.cms_v_ap_reconcile_issue_list_v1 to anon;


-- ============================================================
-- 3) AP POSITION VIEWS (FIFO/대시보드용)
-- ============================================================

-- invoice별 자산 outstanding (due - alloc)
create or replace view public.cms_v_ap_invoice_position_v1
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
  i.ap_id,
  i.vendor_party_id,
  i.receipt_id,
  i.occurred_at,
  i.movement_code,
  i.source_receipt_snapshot_version,
  i.source_calc_version,
  i.memo,
  i.created_at,

  l.asset_code,
  l.due_qty,
  coalesce(a.alloc_qty,0) as alloc_qty,
  (coalesce(l.due_qty,0) - coalesce(a.alloc_qty,0)) as balance_qty,
  greatest(coalesce(l.due_qty,0) - coalesce(a.alloc_qty,0), 0) as outstanding_qty,
  greatest(-(coalesce(l.due_qty,0) - coalesce(a.alloc_qty,0)), 0) as credit_qty
from public.cms_ap_invoice i
join public.cms_ap_invoice_leg l on l.ap_id = i.ap_id
left join alloc a on a.ap_id = i.ap_id and a.asset_code = l.asset_code;

grant select on public.cms_v_ap_invoice_position_v1 to authenticated;
grant select on public.cms_v_ap_invoice_position_v1 to anon;

-- vendor별 포지션 합계
create or replace view public.cms_v_ap_position_by_vendor_v1
with (security_invoker = true)
as
select
  vendor_party_id,
  asset_code,
  coalesce(sum(outstanding_qty),0) as outstanding_qty,
  coalesce(sum(credit_qty),0) as credit_qty
from public.cms_v_ap_invoice_position_v1
group by vendor_party_id, asset_code;

grant select on public.cms_v_ap_position_by_vendor_v1 to authenticated;
grant select on public.cms_v_ap_position_by_vendor_v1 to anon;


-- ============================================================
-- 4) RPC: 공장 4행 스냅샷 저장(버전업) + 정합 run/issue 생성
-- ============================================================
-- 입력 payload 예시:
-- {
--   "rows":[
--     {"row_code":"RECENT_PAYMENT","ref_date":"2026-02-03","legs":[{"asset_code":"XAU_G","qty":1.23,"input_unit":"g","input_qty":1.23}]},
--     {"row_code":"PRE_BALANCE","legs":[...]},
--     {"row_code":"SALE","legs":[...]},
--     {"row_code":"POST_BALANCE","legs":[...]}
--   ]
-- }
create or replace function public.cms_fn_upsert_factory_receipt_statement_v1(
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
  v_run jsonb;

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

  -- rows upsert
  if jsonb_typeof(coalesce(p_statement->'rows','[]'::jsonb)) <> 'array' then
    raise exception 'statement.rows must be array';
  end if;

  for r_row in
    select
      (e->>'row_code')::cms_statement_row_code as row_code,
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

    -- legs replace (row 단위로 갈아끼우기)
    delete from public.cms_factory_receipt_statement_leg
     where receipt_id = p_receipt_id
       and snapshot_version = v_next_ver
       and row_code = r_row.row_code;

    if jsonb_typeof(coalesce(r_row.row_json->'legs','[]'::jsonb)) <> 'array' then
      raise exception 'row.legs must be array';
    end if;

    for r_leg in
      select
        (l->>'asset_code')::cms_asset_code as asset_code,
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

  -- 정합 run/issue 생성
  v_run := public.cms_fn_ap_run_reconcile_for_receipt_v1(p_receipt_id);

  return jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'snapshot_version', v_next_ver,
    'reconcile', v_run
  );
end $$;

alter function public.cms_fn_upsert_factory_receipt_statement_v1(uuid,jsonb,text)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_upsert_factory_receipt_statement_v1(uuid,jsonb,text)
  to authenticated, service_role;


-- ============================================================
-- 5) RPC: reconcile 실행 (막지 않고 issue 생성)
-- ============================================================
create or replace function public.cms_fn_ap_run_reconcile_for_receipt_v1(
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

  v_run_id uuid;

  -- epsilon
  v_eps_g numeric := 0.000001;
  v_eps_krw numeric := 0.5;

  v_issue_id uuid;
  v_cnt_info int := 0;
  v_cnt_warn int := 0;
  v_cnt_error int := 0;

  v_has_diff boolean;
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

  -- 기존 OPEN/ACKED 이슈는 superseded 처리 (수정 저장 반복 시 중복 방지)
  update public.cms_ap_reconcile_issue
     set status = 'IGNORED',
         resolved_at = now(),
         resolved_by = auth.uid(),
         resolution_note = coalesce(resolution_note,'') || ' | superseded by new reconcile run'
   where receipt_id = p_receipt_id
     and status in ('OPEN','ACKED');

  insert into public.cms_ap_reconcile_run(receipt_id, vendor_party_id, snapshot_version, calc_version, created_by)
  values (p_receipt_id, v_vendor, v_cur_ver, v_calc_ver, auth.uid())
  returning run_id into v_run_id;

  -- prev receipt 찾기 (issued_at + bill_no 기준)
  select r.receipt_id into v_prev_receipt_id
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

  -- ===== helper CTE: 현재 PRE/SALE/POST, prev POST =====
  -- 1) PRE_NEQ_PREV_POST (asset별)
  if v_prev_receipt_id is not null and v_prev_ver is not null then
    with assets as (
      select unnest(enum_range(null::cms_asset_code)) as asset_code
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
      where
        case when asset_code::text like 'KRW%' then abs(diff_qty) > v_eps_krw else abs(diff_qty) > v_eps_g end
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
          select unnest(enum_range(null::cms_asset_code)) as asset_code
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
      where
        case when asset_code::text like 'KRW%' then abs(diff_qty) > v_eps_krw else abs(diff_qty) > v_eps_g end;

      v_cnt_error := v_cnt_error + 1;
    end if;
  end if;

  -- 2) PRE + SALE != POST
  with assets as (
    select unnest(enum_range(null::cms_asset_code)) as asset_code
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
        select unnest(enum_range(null::cms_asset_code)) as asset_code
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

  -- 3) FACTORY SALE != INTERNAL CALC (있을 때만)
  if v_calc_ver is not null then
    with assets as (
      select unnest(enum_range(null::cms_asset_code)) as asset_code
    ),
    factory_sale as (
      select asset_code, qty
      from public.cms_factory_receipt_statement_leg
      where receipt_id = p_receipt_id and snapshot_version = v_cur_ver and row_code = 'SALE'
    ),
    internal as (
      select
        'XAU_G'::cms_asset_code as asset_code, calc_gold_g::numeric as qty
      from public.cms_ap_internal_calc_snapshot
      where receipt_id = p_receipt_id and calc_version = v_calc_ver
      union all
      select 'XAG_G'::cms_asset_code, calc_silver_g::numeric
      from public.cms_ap_internal_calc_snapshot
      where receipt_id = p_receipt_id and calc_version = v_calc_ver
      union all
      select 'KRW_LABOR'::cms_asset_code, calc_labor_cash_krw::numeric
      from public.cms_ap_internal_calc_snapshot
      where receipt_id = p_receipt_id and calc_version = v_calc_ver
    ),
    diff as (
      select
        a.asset_code,
        coalesce(i.qty,0) as expected_qty,
        coalesce(f.qty,0) as actual_qty,
        (coalesce(f.qty,0) - coalesce(i.qty,0)) as diff_qty
      from assets a
      left join internal i on i.asset_code = a.asset_code
      left join factory_sale f on f.asset_code = a.asset_code
      where a.asset_code in ('XAU_G','XAG_G','KRW_LABOR')
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
        'FACTORY_SALE_NEQ_INTERNAL_CALC', 'WARN', 'OPEN',
        'FACTORY SALE != INTERNAL CALC (review calc rules / line inputs)',
        auth.uid()
      )
      returning issue_id into v_issue_id;

      insert into public.cms_ap_reconcile_issue_leg(issue_id, asset_code, expected_qty, actual_qty, diff_qty)
      select v_issue_id, asset_code, expected_qty, actual_qty, diff_qty
      from (
        with assets as (
          select unnest(enum_range(null::cms_asset_code)) as asset_code
        ),
        factory_sale as (
          select asset_code, qty
          from public.cms_factory_receipt_statement_leg
          where receipt_id = p_receipt_id and snapshot_version = v_cur_ver and row_code = 'SALE'
        ),
        internal as (
          select 'XAU_G'::cms_asset_code as asset_code, calc_gold_g::numeric as qty
          from public.cms_ap_internal_calc_snapshot
          where receipt_id = p_receipt_id and calc_version = v_calc_ver
          union all
          select 'XAG_G'::cms_asset_code, calc_silver_g::numeric
          from public.cms_ap_internal_calc_snapshot
          where receipt_id = p_receipt_id and calc_version = v_calc_ver
          union all
          select 'KRW_LABOR'::cms_asset_code, calc_labor_cash_krw::numeric
          from public.cms_ap_internal_calc_snapshot
          where receipt_id = p_receipt_id and calc_version = v_calc_ver
        )
        select
          a.asset_code,
          coalesce(i.qty,0) as expected_qty,
          coalesce(f.qty,0) as actual_qty,
          (coalesce(f.qty,0) - coalesce(i.qty,0)) as diff_qty
        from assets a
        left join internal i on i.asset_code = a.asset_code
        left join factory_sale f on f.asset_code = a.asset_code
        where a.asset_code in ('XAU_G','XAG_G','KRW_LABOR')
      ) d
      where case when asset_code::text like 'KRW%' then abs(diff_qty) > v_eps_krw else abs(diff_qty) > v_eps_g end;

      v_cnt_warn := v_cnt_warn + 1;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'run_id', v_run_id,
    'snapshot_version', v_cur_ver,
    'calc_version', v_calc_ver,
    'issue_counts', jsonb_build_object('error', v_cnt_error, 'warn', v_cnt_warn, 'info', v_cnt_info)
  );
end $$;

alter function public.cms_fn_ap_run_reconcile_for_receipt_v1(uuid)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_ap_run_reconcile_for_receipt_v1(uuid)
  to authenticated, service_role;


-- ============================================================
-- 6) RPC: 이슈 상태 변경 (ACK/IGNORE)
-- ============================================================
create or replace function public.cms_fn_ap_set_reconcile_issue_status_v1(
  p_issue_id uuid,
  p_status cms_reconcile_issue_status,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_issue_id is null then
    raise exception 'issue_id required';
  end if;

  if p_status = 'IGNORED' and (p_note is null or btrim(p_note)='') then
    raise exception 'ignore requires note';
  end if;

  update public.cms_ap_reconcile_issue
     set status = p_status,
         resolved_at = case when p_status in ('RESOLVED','IGNORED') then now() else resolved_at end,
         resolved_by = case when p_status in ('RESOLVED','IGNORED') then auth.uid() else resolved_by end,
         resolution_note = case when p_note is not null then p_note else resolution_note end
   where issue_id = p_issue_id;

  if not found then
    raise exception 'issue not found';
  end if;

  return jsonb_build_object('ok', true, 'issue_id', p_issue_id, 'status', p_status);
end $$;

alter function public.cms_fn_ap_set_reconcile_issue_status_v1(uuid,cms_reconcile_issue_status,text)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_ap_set_reconcile_issue_status_v1(uuid,cms_reconcile_issue_status,text)
  to authenticated, service_role;


-- ============================================================
-- 7) RPC: 추천 조정 생성 (PRE mismatch / PRE+SALE mismatch 전용)
--     - 팩트(공장 4행)는 수정하지 않고,
--     - 우리 AP 원장에 ADJUSTMENT invoice를 생성해서 "설명"한다.
-- ============================================================
create or replace function public.cms_fn_ap_create_adjustment_from_issue_v1(
  p_issue_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_issue record;
  v_receipt record;
  v_ap_id uuid;
  v_occurred_at timestamptz;
begin
  select * into v_issue
  from public.cms_ap_reconcile_issue
  where issue_id = p_issue_id;

  if not found then
    raise exception 'issue not found';
  end if;

  if v_issue.status not in ('OPEN','ACKED') then
    raise exception 'issue must be OPEN or ACKED';
  end if;

  if v_issue.issue_type not in ('PRE_NEQ_PREV_POST','PRE_PLUS_SALE_NEQ_POST') then
    raise exception 'adjustment is only supported for PRE mismatch and PRE+SALE mismatch';
  end if;

  select vendor_party_id, issued_at into v_receipt
  from public.cms_receipt_inbox
  where receipt_id = v_issue.receipt_id;

  -- ordering:
  -- PRE mismatch => "이전→현재 pre로 이동"이라, SALE보다 살짝 앞에 두는게 자연스러움
  if v_issue.issue_type = 'PRE_NEQ_PREV_POST' then
    v_occurred_at := (v_receipt.issued_at::timestamptz) - interval '1 microsecond';
  else
    v_occurred_at := (v_receipt.issued_at::timestamptz) + interval '1 microsecond';
  end if;

  insert into public.cms_ap_invoice(
    vendor_party_id,
    receipt_id,
    occurred_at,
    movement_code,
    source_receipt_snapshot_version,
    source_calc_version,
    memo,
    created_by
  )
  values (
    v_issue.vendor_party_id,
    v_issue.receipt_id,
    v_occurred_at,
    'ADJUSTMENT',
    (select snapshot_version from public.cms_ap_reconcile_run where run_id = v_issue.run_id),
    (select calc_version from public.cms_ap_reconcile_run where run_id = v_issue.run_id),
    coalesce(p_note, v_issue.summary),
    auth.uid()
  )
  returning ap_id into v_ap_id;

  insert into public.cms_ap_invoice_leg(ap_id, asset_code, due_qty)
  select v_ap_id, asset_code, diff_qty
  from public.cms_ap_reconcile_issue_leg
  where issue_id = p_issue_id
    and diff_qty <> 0;

  -- link + resolve
  insert into public.cms_ap_adjustment_link(issue_id, ap_id, created_by)
  values (p_issue_id, v_ap_id, auth.uid());

  update public.cms_ap_reconcile_issue
     set status = 'RESOLVED',
         resolved_at = now(),
         resolved_by = auth.uid(),
         resolution_note = coalesce(p_note, v_issue.summary)
   where issue_id = p_issue_id;

  return jsonb_build_object('ok', true, 'issue_id', p_issue_id, 'ap_id', v_ap_id);
end $$;

alter function public.cms_fn_ap_create_adjustment_from_issue_v1(uuid,text)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_ap_create_adjustment_from_issue_v1(uuid,text)
  to authenticated, service_role;

commit;
