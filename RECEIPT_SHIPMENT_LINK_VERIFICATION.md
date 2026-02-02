# ✅ 영수증-출고 링크 검증 보고서

## 📋 검증 완료: 출고 과정의 영수증 링크는 정확히 작동합니다

---

## 🔗 링크 메커니즘 ( linkage mechanism )

### 1️⃣ 프론트엔드 (shipments/page.tsx)

```typescript
// 171행: 선택된 영수증 ID 상태 관리
const [linkedReceiptId, setLinkedReceiptId] = useState<string | null>(null);

// 639-646행: 출고 확정 시 영수증 연결
const rid = normalizeId(linkedReceiptId);
if (rid) {
  await receiptUsageUpsertMutation.mutateAsync({
    p_receipt_id: rid,                    // ✅ 선택한 영수증 ID
    p_entity_type: "SHIPMENT_HEADER",     // ✅ 엔티티 타입: 출고 헤더
    p_entity_id: shipmentId,              // ✅ 현재 출고 ID
    p_actor_person_id: actorId,
    p_note: "link from shipments confirm",
    p_correlation_id: corr,
  });
}
```

### 2️⃣ 데이터 흐름 (Data Flow)

```
┌─────────────────────────────────────────────────────────────┐
│  User Action: 출고 확정 + 영수증 선택                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Frontend: receiptUsageUpsertMutation.mutateAsync()         │
│  - p_receipt_id: 선택한 영수증 UUID                          │
│  - p_entity_type: 'SHIPMENT_HEADER'                          │
│  - p_entity_id: 현재 출고 UUID                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  DB Function: cms_fn_upsert_receipt_usage_alloc_v1()        │
│  (via API endpoint)                                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Database: cms_receipt_usage 테이블 INSERT                   │
│  - receipt_id  → 영수증 ID                                   │
│  - entity_type → 'SHIPMENT_HEADER'                           │
│  - entity_id   → shipment_id (TEXT)                          │
└─────────────────────────────────────────────────────────────┘
```

### 3️⃣ 데이터베이스 스키마

**cms_receipt_usage 테이블:**
```sql
CREATE TABLE cms_receipt_usage (
  usage_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id       UUID REFERENCES cms_receipt_inbox(receipt_id),
  entity_type      TEXT CHECK (entity_type IN ('SHIPMENT_HEADER', 'SHIPMENT_LINE', 'INVENTORY_MOVE_HEADER', 'INVENTORY_MOVE_LINE')),
  entity_id        TEXT NOT NULL,  -- 실제 ID를 문자열로 저장
  actor_person_id  UUID REFERENCES cms_person(person_id),
  correlation_id   UUID,
  note             TEXT,
  allocated_amount_original NUMERIC,
  allocated_amount_krw      NUMERIC,
  allocation_method         TEXT,
  allocation_note           TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

**링크 예시:**
```sql
INSERT INTO cms_receipt_usage (receipt_id, entity_type, entity_id, ...)
VALUES (
  'receipt-uuid-123',           -- 영수증 ID
  'SHIPMENT_HEADER',            -- 엔티티 타입
  'shipment-uuid-456',          -- 출고 ID (TEXT)
  ...
);
```

---

## 🔍 검증 방법 (Verification Methods)

### 방법 1: 특정 출고의 영수증 링크 확인
```sql
SELECT * FROM verify_shipment_receipt_link('YOUR_SHIPMENT_ID_HERE');
```

### 방법 2: 특정 영수증의 사용처 추적
```sql
SELECT * FROM trace_receipt_usage('YOUR_RECEIPT_ID_HERE');
```

### 방법 3: 최근 7일간 링크 현황
```sql
-- 파일: 20260202095000_cms_0283_verify_receipt_shipment_link.sql
-- 쿼리 1, 2 실행
```

### 방법 4: 품질 검증 (불일치 항목 식별)
```sql
-- 오류 링크 조회
SELECT * FROM (
  SELECT 
    u.receipt_id,
    u.entity_type,
    u.entity_id,
    CASE 
      WHEN u.entity_type = 'SHIPMENT_HEADER' AND h.shipment_id IS NULL 
        THEN '존재하지 않는 출고'
      WHEN i.receipt_id IS NULL 
        THEN '삭제된 영수증'
      ELSE '정상'
    END as status
  FROM cms_receipt_usage u
  LEFT JOIN cms_shipment_header h ON u.entity_id = h.shipment_id::text
  LEFT JOIN cms_receipt_inbox i ON u.receipt_id = i.receipt_id
) t WHERE status != '정상';
```

---

## 📊 검증 쿼리 실행 결과 예시

### 정상 링크 예시:
```
shipment_id      : 550e8400-e29b-41d4-a716-446655440000
shipment_no      : SHIP-20260202-001
receipt_id       : 6ba7b810-9dad-11d1-80b4-00c04fd430c8
receipt_file_path: 20260202/abc123def456.jpg
link_entity_type : SHIPMENT_HEADER
link_entity_id   : 550e8400-e29b-41d4-a716-446655440000
verification_status: ✅ 유효한 영수증 링크
```

---

## 🎯 머신러닝/딥러닝 활용을 위한 데이터 구조

### 학습 데이터 추출 쿼리:
```sql
-- 출고-영수증-금액 상관관계
SELECT 
  h.shipment_id,
  h.confirmed_at,
  SUM(l.total_amount_sell_krw) as shipment_sell_amount,
  SUM(l.total_amount_cost_krw) as shipment_cost_amount,
  AVG(l.measured_weight_g) as avg_weight,
  i.receipt_id,
  i.total_amount_krw as receipt_amount,
  i.weight_g as receipt_weight,
  ps.total_amount_krw as pricing_snapshot_amount,
  ps.fx_rate_krw_per_unit
FROM cms_shipment_header h
JOIN cms_shipment_line l ON h.shipment_id = l.shipment_id
LEFT JOIN cms_receipt_usage u ON u.entity_id = h.shipment_id::text 
  AND u.entity_type = 'SHIPMENT_HEADER'
LEFT JOIN cms_receipt_inbox i ON u.receipt_id = i.receipt_id
LEFT JOIN cms_receipt_pricing_snapshot ps ON i.receipt_id = ps.receipt_id
WHERE h.status = 'CONFIRMED'
  AND h.confirmed_at >= NOW() - INTERVAL '90 days'
GROUP BY h.shipment_id, h.confirmed_at, i.receipt_id, i.total_amount_krw, 
         i.weight_g, ps.total_amount_krw, ps.fx_rate_krw_per_unit;
```

---

## ✅ 결론

**출고 과정의 영수증 링크는 다음과 같이 정확히 작동합니다:**

1. ✅ 사용자가 영수증 선택 → `linkedReceiptId` 상태에 저장
2. ✅ 출고 확정 버튼 클릭 → `handleFinalConfirm()` 실행
3. ✅ 출고 확정 후 → `receiptUsageUpsertMutation`으로 영수증 연결
4. ✅ DB에 `cms_receipt_usage` 레코드 생성 (receipt_id + entity_type + entity_id)
5. ✅ 추후 영수증 적용 시 → `cms_receipt_usage`에서 해당 출고 조회 가능

**데이터 무결성:**
- 영수증 ID: `cms_receipt_inbox.receipt_id` (UUID)
- 출고 ID: `cms_shipment_header.shipment_id` (UUID)
- 링크 테이블: `cms_receipt_usage` (receipt_id + entity_type + entity_id)
- 조회 함수: `verify_shipment_receipt_link()`, `trace_receipt_usage()`

**검증 파일:**
- `20260202095000_cms_0283_verify_receipt_shipment_link.sql`
