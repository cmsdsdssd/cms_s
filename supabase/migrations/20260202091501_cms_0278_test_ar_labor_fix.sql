-- ============================================================
-- ✅ AR 생성 시 공임 반영 테스트 및 검증 스크립트
-- 실행 순서: Supabase Dashboard SQL Editor에서 순차 실행
-- ============================================================

-- 1️⃣ 함수 수정 확인
-- 결과: 1 row가 반환되면 함수가 올바르게 수정됨
SELECT 
  '✅ 함수 수정 확인' as 테스트,
  proname as 함수명,
  prosrc::text LIKE '%labor_total_sell_krw%' as labor_컬럼_업데이트_포함,
  prosrc::text LIKE '%total_amount_sell_krw = COALESCE%' as total_계산_포함
FROM pg_proc
WHERE proname = 'cms_fn_shipment_upsert_from_order_line';


-- 2️⃣ 테스트용 데이터 준비 (기존 DRAFT 출고 헤더 사용 또는 새로 생성)
-- 실제 테스트 시 기존 customer_party_id와 order_line_id로 대체하세요
DO $$
DECLARE
  v_test_party_id uuid;
  v_test_order_line_id uuid;
  v_result jsonb;
  v_shipment_line_id uuid;
  v_material_cost numeric;
  v_labor_cost numeric;
  v_total_cost numeric;
BEGIN
  -- 테스트 데이터 설정 (실제 존재하는 ID로 변경 필요)
  v_test_party_id := '00000000-0000-0000-0000-000000000001';  -- ⚠️ 실제 ID로 변경
  v_test_order_line_id := '00000000-0000-0000-0000-000000000002';  -- ⚠️ 실제 ID로 변경
  v_labor_cost := 15000;  -- 테스트 공임: 15,000원
  
  -- 먼저 해당 order_line_id가 실제로 존재하는지 확인
  IF NOT EXISTS (SELECT 1 FROM cms_order_line WHERE order_line_id = v_test_order_line_id) THEN
    RAISE NOTICE '⚠️ 테스트할 order_line_id가 존재하지 않습니다. 실제 ID로 변경하세요.';
    RETURN;
  END IF;
  
  -- 테스트 실행
  RAISE NOTICE '🧪 테스트 시작: 출고 등록 함수 테스트 (공임: %)', v_labor_cost;
  
  -- 함수 실행
  SELECT cms_fn_shipment_upsert_from_order_line(
    v_test_order_line_id,
    10.5,  -- 중량 10.5g
    v_labor_cost,
    v_test_party_id,
    gen_random_uuid()
  ) INTO v_result;
  
  v_shipment_line_id := (v_result->>'shipment_line_id')::uuid;
  
  RAISE NOTICE '✅ 출고 라인 생성 완료: %', v_shipment_line_id;
  
  -- 3️⃣ 저장된 값 검증
  SELECT 
    material_amount_sell_krw,
    manual_labor_krw,
    labor_total_sell_krw,
    total_amount_sell_krw
  INTO v_material_cost, v_labor_cost, v_labor_cost, v_total_cost
  FROM cms_shipment_line
  WHERE shipment_line_id = v_shipment_line_id;
  
  RAISE NOTICE '💰 저장된 값:';
  RAISE NOTICE '   - 소재비(material_amount_sell_krw): %', v_material_cost;
  RAISE NOTICE '   - 수동공임(manual_labor_krw): %', v_labor_cost;
  RAISE NOTICE '   - 총공임(labor_total_sell_krw): %', v_labor_cost;
  RAISE NOTICE '   - 총금액(total_amount_sell_krw): %', v_total_cost;
  RAISE NOTICE '   - 예상 총금액(소재비+공임): %', v_material_cost + 15000;
  
  -- 검증
  IF v_total_cost = v_material_cost + 15000 THEN
    RAISE NOTICE '✅ SUCCESS: 총금액이 올바르게 계산됨 (소재비 + 공임)';
  ELSE
    RAISE NOTICE '❌ FAIL: 총금액이 잘못됨. 예상: %, 실제: %', v_material_cost + 15000, v_total_cost;
  END IF;
  
  IF v_labor_cost = 15000 THEN
    RAISE NOTICE '✅ SUCCESS: 공임이 올바르게 저장됨';
  ELSE
    RAISE NOTICE '❌ FAIL: 공임 저장 실패. 예상: 15000, 실제: %', v_labor_cost;
  END IF;
  
END $$;


-- 4️⃣ 최근 생성된 출고 데이터 확인 (수동 검증용)
-- 최근 5건의 출고 라인을 확인하여 공임이 올바르게 저장되었는지 체크
SELECT 
  '최근 출고 데이터' as 테스트,
  sl.shipment_line_id,
  sl.model_name,
  sl.material_amount_sell_krw as 소재비,
  sl.manual_labor_krw as 수동공임,
  sl.labor_total_sell_krw as 총공임,
  sl.total_amount_sell_krw as 총금액,
  (sl.material_amount_sell_krw + COALESCE(sl.labor_total_sell_krw, 0)) as 계산된총금액,
  CASE 
    WHEN sl.total_amount_sell_krw = (sl.material_amount_sell_krw + COALESCE(sl.labor_total_sell_krw, 0)) 
    THEN '✅ OK' 
    ELSE '❌ MISMATCH' 
  END as 검증결과,
  sl.created_at
FROM cms_shipment_line sl
ORDER BY sl.created_at DESC
LIMIT 5;


-- 5️⃣ AR 생성 테스트 (수동 트리거 테스트)
-- 주의: 이 쿼리는 실제 출고를 CONFIRMED로 변경하므로 주의해서 사용!
/*
-- 테스트할 shipment_id로 변경 후 실행
UPDATE cms_shipment_header
SET status = 'CONFIRMED',
    confirmed_at = NOW()
WHERE shipment_id = 'YOUR_SHIPMENT_ID_HERE'
  AND status = 'DRAFT';

-- AR이 생성되었는지 확인
SELECT 
  ar.ar_ledger_id,
  ar.amount_krw as AR금액,
  sl.total_amount_sell_krw as 출고총금액,
  CASE 
    WHEN ar.amount_krw = sl.total_amount_sell_krw 
    THEN '✅ AR 금액 일치' 
    ELSE '❌ AR 금액 불일치' 
  END as 검증
FROM cms_ar_ledger ar
JOIN cms_shipment_line sl ON ar.shipment_line_id = sl.shipment_line_id
WHERE ar.shipment_id = 'YOUR_SHIPMENT_ID_HERE'
ORDER BY ar.created_at DESC;
*/


-- 6️⃣ 공임 누락 데이터 확인 (모니터링용)
SELECT 
  '공임 누락 모니터링' as 테스트,
  COUNT(*) as 누락건수,
  MIN(created_at) as 최초누락일,
  MAX(created_at) as 최근누락일
FROM cms_shipment_line
WHERE (labor_total_sell_krw IS NULL OR labor_total_sell_krw = 0)
  AND manual_labor_krw > 0;  -- 수동공임은 있는데 총공임이 없는 경우


-- 7️⃣ 마이그레이션 적용 상태 확인
SELECT 
  '마이그레이션 상태' as 테스트,
  COUNT(*) as 총마이그레이션수,
  MAX(name) as 최근마이그레이션
FROM supabase_migrations.schema_migrations
WHERE name LIKE '%0277%' OR name LIKE '%shipment_upsert%';
