-- 🔥 긴급: 누락된 미수금(AR) 생성
-- 이 SQL을 Supabase Dashboard → SQL Editor에서 실행하세요

-- 1. 먼저 누락된 건수 확인
SELECT 
  '누락된 출고' as 문제,
  COUNT(*) as 건수
FROM cms_shipment_header sh
JOIN cms_shipment_line sl ON sh.shipment_id = sl.shipment_id
WHERE sh.status = 'CONFIRMED'
AND NOT EXISTS (
  SELECT 1 FROM cms_ar_ledger ar 
  WHERE ar.shipment_id = sh.shipment_id
)

UNION ALL

SELECT 
  '부호 오류' as 문제,
  COUNT(*) as 건수
FROM cms_ar_ledger
WHERE entry_type = 'SHIPMENT'
AND amount_krw < 0;
-- 2. 누락된 미수금 생성 (실제 실행)
INSERT INTO cms_ar_ledger (
  ar_ledger_id,
  party_id,
  occurred_at,
  entry_type,
  amount_krw,
  shipment_id,
  shipment_line_id,
  memo,
  created_at
)
SELECT 
  gen_random_uuid(),
  sh.customer_party_id,
  sh.confirmed_at,
  'SHIPMENT',
  sl.total_amount_sell_krw,
  sh.shipment_id,
  sl.shipment_line_id,
  'Auto-fix: missing AR',
  NOW()
FROM cms_shipment_header sh
JOIN cms_shipment_line sl ON sh.shipment_id = sl.shipment_id
WHERE sh.status = 'CONFIRMED'
AND NOT EXISTS (
  SELECT 1 FROM cms_ar_ledger ar 
  WHERE ar.shipment_id = sh.shipment_id
);
-- 3. 결과 확인
SELECT '생성된 미수금' as 결과, COUNT(*) as 건수 
FROM cms_ar_ledger 
WHERE memo = 'Auto-fix: missing AR';
