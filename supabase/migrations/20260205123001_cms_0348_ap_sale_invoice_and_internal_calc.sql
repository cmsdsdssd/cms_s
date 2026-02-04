-- 20260205123001_cms_0348_ap_sale_invoice_and_internal_calc.sql
set search_path = public, pg_temp;

begin;

-- ============================================================
-- 0) SALE invoice: receipt당 1개 강제 (중복 방지)
-- ============================================================
do $$
begin
  if to_regclass('public.cms_ap_invoice') is not null then
    begin
      create unique index if not exists cms_ap_invoice_one_sale_per_receipt
        on public.cms_ap_invoice (receipt_id)
        where movement_code = 'SALE'::public.cms_ap_movement_code;
    exception when others then
      -- enum/type mismatch 등 예외가 있으면 터지게 두면 운영이 막히므로 방어
      null;
    end;
  end if;
end $$;


-- ============================================================
-- 1) Internal calc snapshot 업서트 (receipt line_items 기반)
--    - gold: 14/18/24 -> 순금환산 g
--    - silver: 925/999 -> 순은환산 g
--    - cash: total_amount_krw 합(없으면 labor_basic+labor_other 대체)
-- ============================================================
create or replace function public.cms_fn_ap2_upsert_internal_calc_snapshot_from_receipt_lines_v1(
  p_receipt_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_has_view boolean;
  v_next_ver int;
  v_gold_g numeric(18,6) := 0;
  v_silver_g numeric(18,6) := 0;
  v_cash_krw numeric(18,2) := 0;

  v_cnt int := 0;
begin
  if p_receipt_id is null then
    raise exception using errcode='P0001', message='receipt_id required';
  end if;

  v_has_view := (to_regclass('public.cms_v_receipt_line_items_flat_v1') is not null);

  if not v_has_view then
    return jsonb_build_object('ok', true, 'receipt_id', p_receipt_id, 'skipped', true, 'reason', 'missing_view_receipt_line_items_flat');
  end if;

  -- 라인 집계
  select
    count(*)::int,
    coalesce(sum(
      case
        when material_code::text in ('14','18','24') then
          coalesce(factory_weight_g,0) * coalesce(qty,1)
          * case material_code::text
              when '14' then (14.0/24.0)
              when '18' then (18.0/24.0)
              when '24' then 1.0
              else 0
            end
        else 0
      end
    ),0)::numeric(18,6) as gold_g,
    coalesce(sum(
      case
        when material_code::text in ('925','999') then
          coalesce(factory_weight_g,0) * coalesce(qty,1)
          * case material_code::text
              when '925' then 0.925
              when '999' then 0.999
              else 0
            end
        else 0
      end
    ),0)::numeric(18,6) as silver_g,
    coalesce(sum(
      (
        coalesce(factory_total_amount_krw,
                 coalesce(factory_labor_basic_cost_krw,0) + coalesce(factory_labor_other_cost_krw,0)
        )
      ) * coalesce(qty,1)
    ),0)::numeric(18,2) as cash_krw
  into v_cnt, v_gold_g, v_silver_g, v_cash_krw
  from public.cms_v_receipt_line_items_flat_v1
  where receipt_id = p_receipt_id;

  if v_cnt <= 0 then
    return jsonb_build_object('ok', true, 'receipt_id', p_receipt_id, 'skipped', true, 'reason', 'no_line_items');
  end if;

  -- version bump
  update public.cms_ap_internal_calc_snapshot
     set is_current = false
   where receipt_id = p_receipt_id
     and is_current = true;

  select coalesce(max(calc_version),0) + 1
    into v_next_ver
  from public.cms_ap_internal_calc_snapshot
  where receipt_id = p_receipt_id;

  insert into public.cms_ap_internal_calc_snapshot(
    receipt_id, calc_version, is_current,
    calc_gold_g, calc_silver_g, calc_labor_cash_krw,
    detail_json, created_by
  )
  values (
    p_receipt_id, v_next_ver, true,
    v_gold_g, v_silver_g, v_cash_krw,
    jsonb_strip_nulls(jsonb_build_object(
      'source', 'cms_v_receipt_line_items_flat_v1',
      'line_cnt', v_cnt,
      'note', p_note
    )),
    auth.uid()
  );

  return jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'calc_version', v_next_ver,
    'gold_g', v_gold_g,
    'silver_g', v_silver_g,
    'cash_krw', v_cash_krw,
    'line_cnt', v_cnt
  );
end $$;

alter function public.cms_fn_ap2_upsert_internal_calc_snapshot_from_receipt_lines_v1(uuid,text)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_ap2_upsert_internal_calc_snapshot_from_receipt_lines_v1(uuid,text)
  to authenticated, service_role;


-- ============================================================
-- 2) Factory 4행(SALE legs) -> AP SALE invoice 업서트
--    - snapshot의 SALE row(자산별 qty)를 그대로 AP legs로 넣음
-- ============================================================
create or replace function public.cms_fn_ap2_upsert_sale_invoice_from_factory_snapshot_v1(
  p_receipt_id uuid,
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

  v_snap_ver int;
  v_calc_ver int;

  v_ap_id uuid;
  v_occurred_at timestamptz;

  v_has_sale_leg boolean;
begin
  if p_receipt_id is null then
    raise exception using errcode='P0001', message='receipt_id required';
  end if;

  if to_regclass('public.cms_ap_invoice') is null then
    return jsonb_build_object('ok', true, 'receipt_id', p_receipt_id, 'skipped', true, 'reason', 'missing_ap_tables');
  end if;

  select vendor_party_id, issued_at, bill_no
    into v_vendor, v_issued_at, v_bill_no
  from public.cms_receipt_inbox
  where receipt_id = p_receipt_id;

  if v_vendor is null or v_issued_at is null then
    return jsonb_build_object('ok', true, 'receipt_id', p_receipt_id, 'skipped', true, 'reason', 'missing_vendor_or_issued_at');
  end if;

  select snapshot_version
    into v_snap_ver
  from public.cms_factory_receipt_snapshot
  where receipt_id = p_receipt_id and is_current = true
  order by snapshot_version desc
  limit 1;

  if v_snap_ver is null then
    return jsonb_build_object('ok', true, 'receipt_id', p_receipt_id, 'skipped', true, 'reason', 'no_factory_snapshot');
  end if;

  select exists (
    select 1
    from public.cms_factory_receipt_statement_leg
    where receipt_id = p_receipt_id
      and snapshot_version = v_snap_ver
      and row_code = 'SALE'
  )
  into v_has_sale_leg;

  if not v_has_sale_leg then
    return jsonb_build_object('ok', true, 'receipt_id', p_receipt_id, 'skipped', true, 'reason', 'no_factory_sale_legs');
  end if;

  select calc_version
    into v_calc_ver
  from public.cms_ap_internal_calc_snapshot
  where receipt_id = p_receipt_id and is_current = true
  order by calc_version desc
  limit 1;

  v_occurred_at := (v_issued_at::timestamptz);

  -- upsert SALE invoice (receipt 당 1개)
  select ap_id into v_ap_id
  from public.cms_ap_invoice
  where receipt_id = p_receipt_id
    and movement_code = 'SALE'
  limit 1;

  if v_ap_id is null then
    insert into public.cms_ap_invoice(
      vendor_party_id, receipt_id, occurred_at, movement_code,
      source_receipt_snapshot_version, source_calc_version,
      memo, created_by
    )
    values (
      v_vendor, p_receipt_id, v_occurred_at, 'SALE',
      v_snap_ver, v_calc_ver,
      coalesce(p_note, v_bill_no),
      auth.uid()
    )
    returning ap_id into v_ap_id;
  else
    update public.cms_ap_invoice
       set vendor_party_id = v_vendor,
           occurred_at = v_occurred_at,
           source_receipt_snapshot_version = v_snap_ver,
           source_calc_version = v_calc_ver,
           memo = coalesce(p_note, memo)
     where ap_id = v_ap_id;
  end if;

  -- legs replace: enum_range로 모든 자산코드 rows를 만들어 0도 넣음(뷰에서 invoice가 사라지지 않게)
  delete from public.cms_ap_invoice_leg where ap_id = v_ap_id;

  insert into public.cms_ap_invoice_leg(ap_id, asset_code, due_qty)
  select
    v_ap_id,
    a.asset_code,
    coalesce(l.qty,0) as due_qty
  from (select unnest(enum_range(null::public.cms_asset_code)) as asset_code) a
  left join public.cms_factory_receipt_statement_leg l
    on l.receipt_id = p_receipt_id
   and l.snapshot_version = v_snap_ver
   and l.row_code = 'SALE'
   and l.asset_code = a.asset_code;

  return jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'ap_id', v_ap_id,
    'snapshot_version', v_snap_ver,
    'calc_version', v_calc_ver
  );
end $$;

alter function public.cms_fn_ap2_upsert_sale_invoice_from_factory_snapshot_v1(uuid,text)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_ap2_upsert_sale_invoice_from_factory_snapshot_v1(uuid,text)
  to authenticated, service_role;


-- ============================================================
-- 3) Wrapper: receipt 저장 시점에 "AP2 동기화" 한방에
--    - (1) internal calc upsert (가능할 때)
--    - (2) sale invoice upsert (factory snapshot 있을 때)
--    - (3) reconcile run (factory snapshot 있을 때)
-- ============================================================
create or replace function public.cms_fn_ap2_sync_from_receipt_v1(
  p_receipt_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_calc jsonb;
  v_sale jsonb;
  v_recon jsonb;
  v_has_factory boolean;
begin
  if p_receipt_id is null then
    raise exception using errcode='P0001', message='receipt_id required';
  end if;

  v_calc := public.cms_fn_ap2_upsert_internal_calc_snapshot_from_receipt_lines_v1(p_receipt_id, p_note);

  v_has_factory := exists (
    select 1 from public.cms_factory_receipt_snapshot
    where receipt_id = p_receipt_id and is_current = true
  );

  if v_has_factory then
    v_sale := public.cms_fn_ap2_upsert_sale_invoice_from_factory_snapshot_v1(p_receipt_id, p_note);
    v_recon := public.cms_fn_ap_run_reconcile_for_receipt_v1(p_receipt_id);
  else
    v_sale := jsonb_build_object('skipped', true, 'reason', 'no_factory_snapshot');
    v_recon := jsonb_build_object('skipped', true, 'reason', 'no_factory_snapshot');
  end if;

  return jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'calc', v_calc,
    'sale', v_sale,
    'reconcile', v_recon
  );
end $$;

alter function public.cms_fn_ap2_sync_from_receipt_v1(uuid,text)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_ap2_sync_from_receipt_v1(uuid,text)
  to authenticated, service_role;


-- ============================================================
-- 4) 기존 ensure_ap_from_receipt_v1 패치(호환 유지)
--    - 기존 cms_ap_ledger(BILL/KRW) 업서트는 그대로
--    - 추가로 AP2 sync도 시도(실패해도 본 기능은 ok)
-- ============================================================
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

  v_ap2 jsonb;
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

  -- (A) 기존 AP ledger(BILL/KRW) 유지: 운영 영향 최소화
  if v_vendor_party_id is not null and v_total_krw is not null and to_regclass('public.cms_ap_ledger') is not null then
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
  end if;

  -- (B) AP2 sync는 "시도만" (실패해도 저장 흐름 막지 않기)
  begin
    if to_regclass('public.cms_ap_invoice') is not null then
      v_ap2 := public.cms_fn_ap2_sync_from_receipt_v1(p_receipt_id, v_memo);
    else
      v_ap2 := jsonb_build_object('skipped', true, 'reason', 'ap2_not_installed');
    end if;
  exception when others then
    v_ap2 := jsonb_build_object('skipped', true, 'reason', 'ap2_sync_error');
  end;

  return jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'total_amount_krw', v_total_krw,
    'upserted', v_rows > 0,
    'ap2', v_ap2
  );
end $$;

alter function public.cms_fn_ensure_ap_from_receipt_v1(uuid,text)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_ensure_ap_from_receipt_v1(uuid,text)
  to authenticated, service_role;


-- ============================================================
-- 5) (중요) 347에서 만든 공장 4행 저장 함수도 패치:
--    - 4행 저장 직후 AP SALE 업서트 + reconcile까지 보장
-- ============================================================
-- 함수가 이미 존재할 때만 교체(없으면 스킵)
do $$
begin
  if to_regprocedure('public.cms_fn_upsert_factory_receipt_statement_v1(uuid,jsonb,text)') is not null then
    execute $SQL$
      create or replace function public.cms_fn_upsert_factory_receipt_statement_v1(
        p_receipt_id uuid,
        p_statement jsonb,
        p_note text default null
      )
      returns jsonb
      language plpgsql
      security definer
      set search_path = public, pg_temp
      as $BODY$
      declare
        v_vendor uuid;
        v_issued_at date;
        v_bill_no text;

        v_next_ver int;
        v_run jsonb;

        r_row record;
        r_leg record;

        v_sale jsonb;
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

        -- ✅ 여기서 AP SALE 업서트(공장 SALE legs -> AP invoice)
        begin
          v_sale := public.cms_fn_ap2_upsert_sale_invoice_from_factory_snapshot_v1(p_receipt_id, p_note);
        exception when others then
          v_sale := jsonb_build_object('skipped', true, 'reason', 'sale_upsert_error');
        end;

        -- reconcile
        v_run := public.cms_fn_ap_run_reconcile_for_receipt_v1(p_receipt_id);

        return jsonb_build_object(
          'ok', true,
          'receipt_id', p_receipt_id,
          'snapshot_version', v_next_ver,
          'sale', v_sale,
          'reconcile', v_run
        );
      end $BODY$;
    $SQL$;

    execute 'alter function public.cms_fn_upsert_factory_receipt_statement_v1(uuid,jsonb,text) security definer set search_path = public, pg_temp';
    execute 'grant execute on function public.cms_fn_upsert_factory_receipt_statement_v1(uuid,jsonb,text) to authenticated, service_role';
  end if;
end $$;

commit;
