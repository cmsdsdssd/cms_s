-- 🔥 긴급: 누락된 공임 데이터 보정 스크립트
-- 기존 출고 데이터 중 labor_total_sell_krw가 null인 경우 보정

-- 1. 누락 현황 확인
SELECT 
  '공임 누락 건수' as 항목,
  COUNT(*) as 건수
FROM cms_shipment_line
WHERE labor_total_sell_krw IS NULL
   OR labor_total_sell_krw = 0;

-- 2. 마스터 정보 기반으로 공임 보정 (선택사항)
-- 주의: 이 쿼리는 마스터의 공임 정보를 기반으로 추정치를 채웁니다.
-- 실제 공임과 차이가 있을 수 있으므로 확인 후 실행하세요.

/*
UPDATE cms_shipment_line sl
SET 
  labor_total_sell_krw = (
    SELECT 
      (COALESCE(mi.labor_base_sell, 0) + 
       COALESCE(mi.labor_center_sell, 0) + 
       COALESCE(mi.labor_sub1_sell, 0) + 
       COALESCE(mi.labor_sub2_sell, 0)) * sl.qty
    FROM cms_master_item mi
    JOIN cms_order_line ol ON sl.order_line_id = ol.order_line_id
    WHERE mi.master_item_id = ol.matched_master_id
  ),
  total_amount_sell_krw = COALESCE(material_amount_sell_krw, 0) + 
    COALESCE((
      SELECT 
        (COALESCE(mi.labor_base_sell, 0) + 
         COALESCE(mi.labor_center_sell, 0) + 
         COALESCE(mi.labor_sub1_sell, 0) + 
         COALESCE(mi.labor_sub2_sell, 0)) * sl.qty
      FROM cms_master_item mi
      JOIN cms_order_line ol ON sl.order_line_id = ol.order_line_id
      WHERE mi.master_item_id = ol.matched_master_id
    ), 0)
WHERE sl.labor_total_sell_krw IS NULL 
   OR sl.labor_total_sell_krw = 0;
*/

-- 3. 보정 후 결과 확인
SELECT 
  '보정 후 누락 건수' as 항목,
  COUNT(*) as 건수
FROM cms_shipment_line
WHERE labor_total_sell_krw IS NULL
   OR labor_total_sell_krw = 0;
