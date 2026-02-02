-- ✅ 공임 ₩0 보정 SQL (컬럼 수정版)
-- memo 컬럼이 없어서 제거함

-- 1. 공임 누락 데이터 확인
SELECT 
  shipment_line_id,
  model_name,
  material_amount_sell_krw,
  labor_total_sell_krw,
  total_amount_sell_krw,
  created_at
FROM cms_shipment_line
WHERE (labor_total_sell_krw IS NULL OR labor_total_sell_krw = 0)
  AND created_at >= '2026-02-02'
ORDER BY created_at DESC
LIMIT 10;

-- 2. 공임 보정 실행
UPDATE cms_shipment_line
SET 
  labor_total_sell_krw = GREATEST(
    ROUND(COALESCE(material_amount_sell_krw, 0) * 0.2), 
    5000
  ),
  total_amount_sell_krw = COALESCE(material_amount_sell_krw, 0) + 
    GREATEST(ROUND(COALESCE(material_amount_sell_krw, 0) * 0.2), 5000)
WHERE (labor_total_sell_krw IS NULL OR labor_total_sell_krw = 0)
  AND created_at >= '2026-02-02';

-- 3. 결과 확인
SELECT 
  '보정된 건수' as 항목,
  COUNT(*) as 건수,
  SUM(labor_total_sell_krw) as 총공임금액
FROM cms_shipment_line
WHERE labor_total_sell_krw > 0
  AND created_at >= '2026-02-02';
