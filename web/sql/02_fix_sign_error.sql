-- 🔥 긴급: 미수금 부호 오류 수정 (음수 → 양수)
-- 검증 결과에서 ar_amount가 음수로 잘못 들어간 경우

-- 1. 문제 건수 확인
SELECT 
  COUNT(*) as 오류건수,
  SUM(ABS(amount_krw)) as 총금액
FROM cms_ar_ledger
WHERE entry_type = 'SHIPMENT'
AND amount_krw < 0;

-- 2. 부호 수정 실행
UPDATE cms_ar_ledger
SET 
  amount_krw = ABS(amount_krw),  -- 음수 → 양수
  memo = COALESCE(memo || ' | ', '') || 'Auto-fix: sign corrected'
WHERE entry_type = 'SHIPMENT'
AND amount_krw < 0;

-- 3. 수정 결과 확인
SELECT 
  '수정된 건수' as 결과,
  COUNT(*) as 건수
FROM cms_ar_ledger
WHERE memo LIKE '%sign corrected%';
