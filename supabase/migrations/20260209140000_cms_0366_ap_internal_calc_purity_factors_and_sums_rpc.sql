-- 20260209140000_cms_0366_ap_internal_calc_purity_factors_and_sums_rpc.sql
set search_path = public, pg_temp;

begin;

-- ============================================================
-- 1) Receipt line 기반 "공식 합계" 계산 RPC (gross + eq + cash)
--    - factory_weight_g는 "총중량(gross)" 전제
--    - XAU_G/XAG_G는 "환산(equivalent) g" 전제
-- ============================================================
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

  /*
    NOTE:
    - material_code는 text/enum 무엇이든 들어올 수 있어 ::text 비교
    - qty null이면 1로 취급
    - cash는 factory_total_amount_krw 우선, 없으면 labor_basic+labor_other
  */
  select
    count(*)::int,

    -- gold gross (14/18/24)
    coalesce(sum(
      case
        when material_code::text in ('14','18','24') then
          coalesce(factory_weight_g,0) * coalesce(qty,1)
        else 0
      end
    ),0)::numeric(18,6) as gold_gross,

    -- gold eq (14/18/24)
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

    -- silver gross (925/999)
    coalesce(sum(
      case
        when material_code::text in ('925','999') then
          coalesce(factory_weight_g,0) * coalesce(qty,1)
        else 0
      end
    ),0)::numeric(18,6) as silver_gross,

    -- silver eq (925/999)
    coalesce(sum(
      case
        when material_code::text in ('925','999') then
          coalesce(factory_weight_g,0) * coalesce(qty,1)
          * case material_code::text
              when '925' then 0.925
              when '999' then 1.0
              else 0
            end
        else 0
      end
    ),0)::numeric(18,6) as silver_eq,

    -- cash
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
      '925', 0.925,
      '999', 1.0,
      '00', 0
    ),
    'computed_at', now()
  );
end $$;

alter function public.cms_fn_receipt_compute_weight_sums_v1(uuid)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_receipt_compute_weight_sums_v1(uuid)
  to authenticated, service_role;


-- ============================================================
-- 2) Internal calc snapshot 업서트 함수 계수 수정 + 공식합계 RPC 사용
--    (기존 시그니처/리턴 유지: (uuid,text)->jsonb)
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
  v_has_table boolean;
  v_sum jsonb;

  v_next_ver int;
  v_gold_eq numeric(18,6) := 0;
  v_silver_eq numeric(18,6) := 0;
  v_cash_krw numeric(18,2) := 0;
  v_cnt int := 0;
begin
  if p_receipt_id is null then
    raise exception using errcode='P0001', message='receipt_id required';
  end if;

  v_has_table := (to_regclass('public.cms_ap_internal_calc_snapshot') is not null);
  if not v_has_table then
    return jsonb_build_object('ok', true, 'receipt_id', p_receipt_id, 'skipped', true, 'reason', 'missing_table_ap_internal_calc_snapshot');
  end if;

  -- 공식 합계 계산(단일 SoT)
  v_sum := public.cms_fn_receipt_compute_weight_sums_v1(p_receipt_id);

  if coalesce((v_sum->>'skipped')::boolean, false) then
    return v_sum || jsonb_build_object('note', p_note);
  end if;

  v_cnt := coalesce((v_sum->>'line_cnt')::int, 0);
  if v_cnt <= 0 then
    return jsonb_build_object('ok', true, 'receipt_id', p_receipt_id, 'skipped', true, 'reason', 'no_line_items');
  end if;

  v_gold_eq := coalesce((v_sum->>'gold_eq_g')::numeric, 0)::numeric(18,6);
  v_silver_eq := coalesce((v_sum->>'silver_eq_g')::numeric, 0)::numeric(18,6);
  v_cash_krw := coalesce((v_sum->>'labor_cash_krw')::numeric, 0)::numeric(18,2);

  -- 기존 current 해제
  update public.cms_ap_internal_calc_snapshot
     set is_current = false
   where receipt_id = p_receipt_id
     and is_current = true;

  -- version bump
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
    v_gold_eq, v_silver_eq, v_cash_krw,
    jsonb_strip_nulls(
      jsonb_build_object(
        'source', 'cms_fn_receipt_compute_weight_sums_v1',
        'line_cnt', v_cnt,
        'note', p_note,
        'factors', (v_sum->'factors'),
        'gold_gross_g', (v_sum->'gold_gross_g'),
        'silver_gross_g', (v_sum->'silver_gross_g')
      )
    ),
    auth.uid()
  );

  return jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'calc_version', v_next_ver,
    'gold_g', v_gold_eq,
    'silver_g', v_silver_eq,
    'cash_krw', v_cash_krw,
    'line_cnt', v_cnt
  );
end $$;

alter function public.cms_fn_ap2_upsert_internal_calc_snapshot_from_receipt_lines_v1(uuid,text)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_ap2_upsert_internal_calc_snapshot_from_receipt_lines_v1(uuid,text)
  to authenticated, service_role;

commit;
