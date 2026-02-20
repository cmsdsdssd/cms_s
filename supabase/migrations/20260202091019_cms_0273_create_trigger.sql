-- 🔥 근본 해결: 출고 확정 시 자동으로 미수금 생성
-- 이 트리거가 있으면 앞으로는 자동으로 AR이 생성됩니다

-- 1. 기존 트리거 확인 (있으면 삭제 후 재생성)
DROP TRIGGER IF EXISTS after_shipment_confirm ON cms_shipment_header;
DROP FUNCTION IF EXISTS create_ar_from_shipment();
-- 2. 함수 생성
CREATE OR REPLACE FUNCTION create_ar_from_shipment()
RETURNS TRIGGER AS $$
BEGIN
  -- CONFIRMED로 변경될 때만 실행
  IF NEW.status = 'CONFIRMED' AND OLD.status != 'CONFIRMED' THEN
    -- 해당 출고의 모든 라인에 대해 AR 생성
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
      NEW.customer_party_id,
      NEW.confirmed_at,
      'SHIPMENT',
      sl.total_amount_sell_krw,
      NEW.shipment_id,
      sl.shipment_line_id,
      'Auto-generated from shipment confirm',
      NOW()
    FROM cms_shipment_line sl
    WHERE sl.shipment_id = NEW.shipment_id
    -- 이미 AR이 없는 경우에만 생성 (중복 방지)
    AND NOT EXISTS (
      SELECT 1 FROM cms_ar_ledger ar
      WHERE ar.shipment_line_id = sl.shipment_line_id
      AND ar.entry_type = 'SHIPMENT'
    );
    
    -- 주문 상태도 SHIPPED로 업데이트
    UPDATE cms_order_line
    SET 
      status = 'SHIPPED',
      updated_at = NOW()
    WHERE order_line_id IN (
      SELECT order_line_id 
      FROM cms_shipment_line 
      WHERE shipment_id = NEW.shipment_id
      AND order_line_id IS NOT NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- 3. 트리거 생성
CREATE TRIGGER after_shipment_confirm
AFTER UPDATE ON cms_shipment_header
FOR EACH ROW
EXECUTE FUNCTION create_ar_from_shipment();
-- 4. 생성 확인
SELECT 
  '트리거 생성 완료' as 결과,
  tgname as 트리거명,
  tgrelid::regclass as 테이블
FROM pg_trigger
WHERE tgname = 'after_shipment_confirm';
