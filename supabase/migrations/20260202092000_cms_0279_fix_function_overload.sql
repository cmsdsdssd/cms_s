-- 🔥 함수 중복(overloading) 오류 해결 - 강화 버전
-- 문제: 동일한 함수명으로 매개변수 타입만 다른 여러 함수가 존재
-- 해결: CASCADE로 완전 제거 후 단일 함수 재생성

-- 1. 모든 의존성을 포함한 완전한 제거
-- CASCADE를 사용하여 의존하는 모든 객체(트리거, 뷰 등)도 함께 제거
DROP FUNCTION IF EXISTS public.cms_fn_shipment_upsert_from_order_line(uuid, numeric, numeric, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.cms_fn_shipment_upsert_from_order_line(uuid, numeric, numeric, uuid, text) CASCADE;

-- 추가: 매개변수가 다를 수 있는 다른 변형들도 모두 제거
-- PostgreSQL은 함수 시그니처 전체를 비교하므로 가능한 모든 조합 제거
DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN 
    SELECT oid, proname, pg_get_function_arguments(oid) as args
    FROM pg_proc 
    WHERE proname = 'cms_fn_shipment_upsert_from_order_line'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE', 
                   func_record.proname, 
                   func_record.args);
    RAISE NOTICE 'Dropped function: %', func_record.proname || '(' || func_record.args || ')';
  END LOOP;
END $$;

-- 2. 확실하게 UUID 타입으로만 함수 생성 (text 버전 완전 제거)
CREATE OR REPLACE FUNCTION public.cms_fn_shipment_upsert_from_order_line(
  p_order_line_id uuid,
  p_weight_g numeric,
  p_total_labor numeric,
  p_actor_person_id uuid,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.cms_order_line%rowtype;
  v_shipment_id uuid;
  v_line_id uuid;
BEGIN
  IF p_order_line_id IS NULL THEN RAISE EXCEPTION 'order_line_id required'; END IF;
  IF p_weight_g IS NULL OR p_weight_g <= 0 THEN RAISE EXCEPTION 'weight_g must be > 0'; END IF;
  IF p_total_labor IS NULL OR p_total_labor < 0 THEN RAISE EXCEPTION 'total_labor must be >= 0'; END IF;

  SELECT * INTO v_order
  FROM public.cms_order_line
  WHERE order_line_id = p_order_line_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_line not found: %', p_order_line_id;
  END IF;

  SELECT shipment_id INTO v_shipment_id
  FROM public.cms_shipment_header
  WHERE customer_party_id = v_order.customer_party_id
    AND status = 'DRAFT'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_shipment_id IS NULL THEN
    v_shipment_id := public.cms_fn_create_shipment_header_v1(
      v_order.customer_party_id,
      CURRENT_DATE,
      NULL
    );
  END IF;

  v_line_id := public.cms_fn_add_shipment_line_from_order_v1(
    v_shipment_id,
    v_order.order_line_id,
    v_order.qty,
    'RULE'::cms_e_pricing_mode,
    NULL,
    NULL,
    v_order.is_plated,
    v_order.plating_variant_id,
    NULL,
    NULL,
    NULL
  );

  -- 핵심 수정: manual_labor_krw, labor_total_sell_krw, total_amount_sell_krw 모두 업데이트
  UPDATE public.cms_shipment_line
  SET measured_weight_g = p_weight_g,
      manual_labor_krw = p_total_labor,
      labor_total_sell_krw = p_total_labor,
      total_amount_sell_krw = COALESCE(material_amount_sell_krw, 0) + p_total_labor
  WHERE shipment_line_id = v_line_id;

  RETURN jsonb_build_object(
    'shipment_id', v_shipment_id,
    'shipment_line_id', v_line_id,
    'status', 'DRAFT'
  );
END $$;

-- 3. 권한 부여
GRANT EXECUTE ON FUNCTION public.cms_fn_shipment_upsert_from_order_line(uuid, numeric, numeric, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cms_fn_shipment_upsert_from_order_line(uuid, numeric, numeric, uuid, uuid) TO anon;

-- 4. 함수 생성 확인 (중복 체크 - 반드시 1개만 존재해야 함)
SELECT 
  '함수 정리 완료' as 상태,
  COUNT(*) as 함수개수,
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ 정상 (함수 1개만 존재)'
    WHEN COUNT(*) = 0 THEN '❌ 오류 (함수가 없음)'
    ELSE '❌ 오류 (함수가 ' || COUNT(*) || '개 존재 - 중복됨)'
  END as 검증결과,
  STRING_AGG(proname || '(' || pg_get_function_identity_arguments(oid) || ')', ' | ') as 함수목록
FROM pg_proc
WHERE proname = 'cms_fn_shipment_upsert_from_order_line';
