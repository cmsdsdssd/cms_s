-- 20260212999999_cms_0410_billno_pad2_and_vendor_xag_factors.sql
-- ADD-ONLY / DBPUSH-safe:
-- 1) bill_no 정렬/비교를 "마지막 숫자 suffix 2자리 패딩" 기준으로 통일(…_01)
-- 2) 최신 영수증 선택/백데이트 검증에서 bill_no 비교 안정화
-- 3) (옵션이지만 추천) SALE occurred_at을 KST 자정 + bill_no seq(ms)로 만들어 같은날 다건 순서 고정
-- 4) 925/999(은) 보정계수 공장별 설정(meta) 적용

set search_path = public, pg_temp;

begin;

-- =============================================================
-- 1) bill_no suffix(마지막 _숫자) 파싱 + 2자리 패딩 정렬키
-- =============================================================

create or replace function public.cms_fn_bill_no_suffix_int_v1(p_bill_no text)
returns integer
language sql
immutable
as $$
  select
    case
      when coalesce(p_bill_no,'') ~ '_([0-9]+)$'
        then (regexp_match(p_bill_no, '_([0-9]+)$'))[1]::int
      else null
    end;
$$;

grant execute on function public.cms_fn_bill_no_suffix_int_v1(text)
  to authenticated, anon, service_role;

-- 프론트가 저장하는 규칙과 동일: 1자리면 2자리로(…_1 -> …_01)
create or replace function public.cms_fn_bill_no_sort_key_pad2_v1(p_bill_no text)
returns text
language sql
immutable
as $$
  select
    case
      when p_bill_no is null then ''
      when p_bill_no ~ '_([0-9]+)$' then
        regexp_replace(
          p_bill_no,
          '_([0-9]+)$',
          '_' || lpad((regexp_match(p_bill_no, '_([0-9]+)$'))[1], 2, '0')
        )
      else p_bill_no
    end;
$$;

grant execute on function public.cms_fn_bill_no_sort_key_pad2_v1(text)
  to authenticated, anon, service_role;

-- 같은 날짜 다건 영수증의 "순서"를 DB에서 확정하기 위한 occurred_at 생성
create or replace function public.cms_fn_receipt_occurred_at_kst_billno_v1(
  p_issued_at date,
  p_bill_no text
)
returns timestamptz
language sql
immutable
as $$
  select
    ((p_issued_at)::timestamp at time zone 'Asia/Seoul')
    + (coalesce(public.cms_fn_bill_no_suffix_int_v1(p_bill_no), 0) * interval '1 millisecond');
$$;

grant execute on function public.cms_fn_receipt_occurred_at_kst_billno_v1(date,text)
  to authenticated, service_role;

-- =============================================================
-- 2) 최신(confirmed) 공장 영수증 선택 view: bill_no 비교 안정화
-- =============================================================

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
  and s.apply_status = 'CONFIRMED'
order by
  s.vendor_party_id,
  s.issued_at desc,
  public.cms_fn_bill_no_sort_key_pad2_v1(coalesce(r.bill_no,'')) desc,
  s.receipt_id::text desc,
  s.snapshot_version desc;

grant select on public.cms_v_ap_factory_latest_receipt_by_vendor_v1 to authenticated;
grant select on public.cms_v_ap_factory_latest_receipt_by_vendor_v1 to anon;

-- =============================================================
-- 3) confirm/backdated guard: bill_no 비교 안정화(…_01 기준)
-- =============================================================

create or replace function public.cms_fn_factory_receipt_set_apply_status_v1(
  p_receipt_id uuid,
  p_snapshot_version int default null,
  p_status_text text default 'CONFIRMED',
  p_force_recalc boolean default false,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.cms_factory_receipt_apply_status;
  v_snapshot_version int;
  v_vendor uuid;
  v_issued_at date;

  v_bill_no_raw text;
  v_bill_no_key text;

  v_backdated_receipt_id uuid;
  v_backdated_issued_at date;
  v_backdated_bill_no_raw text;

  v_affected_count int := 0;
  r_target record;
begin
  if p_receipt_id is null then
    raise exception 'receipt_id required';
  end if;

  v_status := case upper(coalesce(trim(p_status_text), 'CONFIRMED'))
    when 'DRAFT' then 'DRAFT'::public.cms_factory_receipt_apply_status
    when 'CONFIRMED' then 'CONFIRMED'::public.cms_factory_receipt_apply_status
    else null
  end;

  if v_status is null then
    raise exception 'invalid status_text: %', p_status_text;
  end if;

  if p_snapshot_version is null then
    select snapshot_version
      into v_snapshot_version
    from public.cms_factory_receipt_snapshot
    where receipt_id = p_receipt_id
      and is_current = true
    order by snapshot_version desc
    limit 1;
  else
    v_snapshot_version := p_snapshot_version;
  end if;

  if v_snapshot_version is null then
    raise exception 'snapshot not found for receipt_id=%', p_receipt_id;
  end if;

  select s.vendor_party_id, s.issued_at, coalesce(r.bill_no,'')
    into v_vendor, v_issued_at, v_bill_no_raw
  from public.cms_factory_receipt_snapshot s
  left join public.cms_receipt_inbox r on r.receipt_id = s.receipt_id
  where s.receipt_id = p_receipt_id
    and s.snapshot_version = v_snapshot_version;

  if v_vendor is null or v_issued_at is null then
    raise exception 'snapshot header invalid';
  end if;

  v_bill_no_key := public.cms_fn_bill_no_sort_key_pad2_v1(v_bill_no_raw);

  if v_status = 'DRAFT' then
    update public.cms_factory_receipt_snapshot
       set apply_status = 'DRAFT',
           confirmed_at = null,
           confirmed_by = null,
           confirm_note = p_note,
           backdated_from_receipt_id = null,
           backdated_detected_at = null,
           backdated_note = null,
           updated_at = now(),
           updated_by = auth.uid()
     where receipt_id = p_receipt_id
       and snapshot_version = v_snapshot_version;

    return jsonb_build_object(
      'ok', true,
      'receipt_id', p_receipt_id,
      'snapshot_version', v_snapshot_version,
      'apply_status', 'DRAFT'
    );
  end if;

  -- backdated detection: issued_at 동일 시 bill_no는 "정렬키(…_01)"로 비교
  select s2.receipt_id, s2.issued_at, coalesce(r2.bill_no,'')
    into v_backdated_receipt_id, v_backdated_issued_at, v_backdated_bill_no_raw
  from public.cms_factory_receipt_snapshot s2
  left join public.cms_receipt_inbox r2 on r2.receipt_id = s2.receipt_id
  where s2.vendor_party_id = v_vendor
    and s2.is_current = true
    and s2.apply_status = 'CONFIRMED'
    and s2.receipt_id <> p_receipt_id
    and (
      s2.issued_at > v_issued_at
      or (
        s2.issued_at = v_issued_at
        and public.cms_fn_bill_no_sort_key_pad2_v1(coalesce(r2.bill_no,'')) > v_bill_no_key
      )
    )
  order by
    s2.issued_at asc,
    public.cms_fn_bill_no_sort_key_pad2_v1(coalesce(r2.bill_no,'')) asc,
    s2.receipt_id::text asc
  limit 1;

  if v_backdated_receipt_id is not null and not coalesce(p_force_recalc, false) then
    raise exception using
      errcode = 'P0001',
      message = format(
        'BACKDATED_RECEIPT_RECALC_REQUIRED: newer confirmed receipt exists (receipt_id=%s, issued_at=%s, bill_no=%s)',
        v_backdated_receipt_id,
        v_backdated_issued_at,
        v_backdated_bill_no_raw
      );
  end if;

  update public.cms_factory_receipt_snapshot
     set apply_status = 'CONFIRMED',
         confirmed_at = now(),
         confirmed_by = auth.uid(),
         confirm_note = p_note,
         backdated_from_receipt_id = v_backdated_receipt_id,
         backdated_detected_at = case when v_backdated_receipt_id is null then null else now() end,
         backdated_note = case when v_backdated_receipt_id is null then null else 'confirmed with backdated detection' end,
         updated_at = now(),
         updated_by = auth.uid()
   where receipt_id = p_receipt_id
     and snapshot_version = v_snapshot_version;

  if coalesce(p_force_recalc, false) and v_backdated_receipt_id is not null then
    for r_target in
      with scoped as (
        select
          s.receipt_id,
          s.issued_at,
          coalesce(r.bill_no,'') as bill_no_raw,
          public.cms_fn_bill_no_sort_key_pad2_v1(coalesce(r.bill_no,'')) as bill_no_key
        from public.cms_factory_receipt_snapshot s
        left join public.cms_receipt_inbox r on r.receipt_id = s.receipt_id
        where s.vendor_party_id = v_vendor
          and s.is_current = true
          and s.apply_status = 'CONFIRMED'
      )
      select receipt_id
      from scoped
      where issued_at > v_issued_at
         or (issued_at = v_issued_at and bill_no_key >= v_bill_no_key)
      order by issued_at asc, bill_no_key asc, receipt_id::text asc
    loop
      perform public.cms_fn_ap2_sync_from_receipt_v1(r_target.receipt_id, coalesce(p_note, 'confirm/recalc'));
      perform public.cms_fn_ap_run_reconcile_for_receipt_v2(r_target.receipt_id);
      v_affected_count := v_affected_count + 1;
    end loop;
  else
    perform public.cms_fn_ap2_sync_from_receipt_v1(p_receipt_id, coalesce(p_note, 'confirm'));
    perform public.cms_fn_ap_run_reconcile_for_receipt_v2(p_receipt_id);
    v_affected_count := 1;
  end if;

  return jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'snapshot_version', v_snapshot_version,
    'apply_status', 'CONFIRMED',
    'backdated_receipt_id', v_backdated_receipt_id,
    'reconciled_receipt_count', v_affected_count
  );
end $$;

alter function public.cms_fn_factory_receipt_set_apply_status_v1(uuid,int,text,boolean,text)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_factory_receipt_set_apply_status_v1(uuid,int,text,boolean,text)
  to authenticated, service_role;

-- =============================================================
-- 4) SALE invoice occurred_at: 같은날 다건 순서 고정(KST 자정 + seq(ms))
-- =============================================================

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

  -- 핵심: 같은 issued_at 다건일 때도 순서 고정
  v_occurred_at := public.cms_fn_receipt_occurred_at_kst_billno_v1(v_issued_at, v_bill_no);

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

-- =============================================================
-- 5) 925/999 공장별 보정계수: cms_vendor_fax_config.meta에서 읽어 적용
--    meta 권장 키:
--      - ap_xag_weight_basis: 'GROSS' | 'PURE'  (PURE면 925/999=1.0 취급)
--      - ap_xag_factor_925: '0.925' 등
--      - ap_xag_factor_999: '1.0' or '0.999' 등
-- =============================================================

create or replace function public.cms_fn_receipt_compute_weight_sums_v1(
  p_receipt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_has_view boolean;
  v_line_cnt int := 0;

  v_vendor uuid;
  v_vendor_meta jsonb := '{}'::jsonb;

  v_xag_basis text := 'GROSS';
  v_xag_925 numeric(18,6) := 0.925;
  v_xag_999 numeric(18,6) := 1.0;
  v_txt text;

  v_gold_gross numeric(18,6) := 0;
  v_gold_eq    numeric(18,6) := 0;

  v_silver_gross numeric(18,6) := 0;
  v_silver_eq    numeric(18,6) := 0;

  v_cash_krw numeric(18,2) := 0;
begin
  if p_receipt_id is null then
    raise exception using errcode='P0001', message='receipt_id required';
  end if;

  v_has_view := (to_regclass('public.cms_v_receipt_line_items_flat_v1') is not null);

  if not v_has_view then
    return jsonb_build_object(
      'ok', true,
      'receipt_id', p_receipt_id,
      'skipped', true,
      'reason', 'missing_view_receipt_line_items_flat'
    );
  end if;

  -- vendor lookup
  select vendor_party_id into v_vendor
  from public.cms_receipt_inbox
  where receipt_id = p_receipt_id;

  -- vendor meta lookup
  if v_vendor is not null and to_regclass('public.cms_vendor_fax_config') is not null then
    select coalesce(meta,'{}'::jsonb)
      into v_vendor_meta
    from public.cms_vendor_fax_config
    where vendor_party_id = v_vendor
      and is_active = true
    limit 1;
  end if;

  v_xag_basis := upper(coalesce(nullif(trim(coalesce(v_vendor_meta->>'ap_xag_weight_basis','')), ''), 'GROSS'));

  if v_xag_basis in ('PURE','EQ','EQUIV','EQUIVALENT') then
    v_xag_925 := 1.0;
    v_xag_999 := 1.0;
  else
    v_txt := nullif(trim(coalesce(v_vendor_meta->>'ap_xag_factor_925','')), '');
    if v_txt is not null and v_txt ~ '^[0-9]+(\.[0-9]+)?$' then
      v_xag_925 := v_txt::numeric;
    end if;

    v_txt := nullif(trim(coalesce(v_vendor_meta->>'ap_xag_factor_999','')), '');
    if v_txt is not null and v_txt ~ '^[0-9]+(\.[0-9]+)?$' then
      v_xag_999 := v_txt::numeric;
    end if;
  end if;

  select
    count(*)::int,

    coalesce(sum(
      case
        when material_code::text in ('14','18','24') then
          coalesce(factory_weight_g,0) * coalesce(qty,1)
        else 0
      end
    ),0)::numeric(18,6) as gold_gross,

    coalesce(sum(
      case
        when material_code::text in ('14','18','24') then
          coalesce(factory_weight_g,0) * coalesce(qty,1)
          * case material_code::text
              when '14' then 0.6435
              when '18' then 0.825
              when '24' then 1.0
              else 0
            end
        else 0
      end
    ),0)::numeric(18,6) as gold_eq,

    coalesce(sum(
      case
        when material_code::text in ('925','999') then
          coalesce(factory_weight_g,0) * coalesce(qty,1)
        else 0
      end
    ),0)::numeric(18,6) as silver_gross,

    coalesce(sum(
      case
        when material_code::text in ('925','999') then
          coalesce(factory_weight_g,0) * coalesce(qty,1)
          * case material_code::text
              when '925' then v_xag_925
              when '999' then v_xag_999
              else 0
            end
        else 0
      end
    ),0)::numeric(18,6) as silver_eq,

    coalesce(sum(
      (
        coalesce(factory_total_amount_krw,
                 coalesce(factory_labor_basic_cost_krw,0) + coalesce(factory_labor_other_cost_krw,0)
        )
      ) * coalesce(qty,1)
    ),0)::numeric(18,2) as cash_krw

  into v_line_cnt, v_gold_gross, v_gold_eq, v_silver_gross, v_silver_eq, v_cash_krw
  from public.cms_v_receipt_line_items_flat_v1
  where receipt_id = p_receipt_id;

  if v_line_cnt <= 0 then
    return jsonb_build_object(
      'ok', true,
      'receipt_id', p_receipt_id,
      'skipped', true,
      'reason', 'no_line_items'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'line_cnt', v_line_cnt,
    'gold_gross_g', v_gold_gross,
    'gold_eq_g', v_gold_eq,
    'silver_gross_g', v_silver_gross,
    'silver_eq_g', v_silver_eq,
    'labor_cash_krw', v_cash_krw,
    'factors', jsonb_build_object(
      '14', 0.6435,
      '18', 0.825,
      '24', 1.0,
      '925', v_xag_925,
      '999', v_xag_999,
      '00', 0,
      'xag_weight_basis', v_xag_basis
    ),
    'computed_at', now()
  );
end $$;

alter function public.cms_fn_receipt_compute_weight_sums_v1(uuid)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_receipt_compute_weight_sums_v1(uuid)
  to authenticated, service_role;

commit;
