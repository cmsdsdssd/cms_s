# 주문→출고→미수금 관계형 설정 검증 리포트

## 개요

**검증일**: 2026년 2월 2일  
**검증 범위**: 주문(Order) → 출고(Shipment) → 미수금(AR) 전체 흐름  
**검증 결과**: ⚠️ **기본 구조는 정상이나 일부 관계 설정 미흡 발견**

---

## 1. 전체 데이터 흐름 다이어그램

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          주문→출고→미수금 흐름도                            │
└─────────────────────────────────────────────────────────────────────────────┘

[주문 생성]                    [출고 처리]                    [미수금 발생]
     │                              │                              │
     ▼                              ▼                              ▼
┌──────────────┐           ┌──────────────────┐           ┌──────────────────┐
│cms_order_line│           │cms_shipment_     │           │cms_ar_ledger     │
│              │           │  header/line     │           │                  │
├──────────────┤           ├──────────────────┤           ├──────────────────┤
│order_line_id │──────────▶│  (order_line_id) │           │                  │
│customer_     │           │shipment_id       │           │ar_ledger_id      │
│  party_id    │           │customer_party_id │◀─────────│party_id          │
│model_name    │           │ship_date         │           │shipment_id       │◀┐
│qty           │           │status            │           │entry_type        │ │
│status        │           │                  │           │amount_krw (+)    │─┘
└──────────────┘           └──────────────────┘           └──────────────────┘
                                    │                              │
                                    │                              │
                                    ▼                              ▼
                           ┌──────────────────┐           ┌──────────────────┐
                           │cms_shipment_line │           │  [수금 처리]      │
                           ├──────────────────┤           ├──────────────────┤
                           │shipment_line_id  │           │cms_payment_header│
                           │shipment_id       │           │                  │
                           │order_line_id ◀───┼───────────│payment_id        │
                           │model_name        │           │party_id          │
                           │qty               │           │total_amount_krw  │
                           │total_amount_     │           │                  │
                           │  sell_krw (+)    │           └──────────────────┘
                           └──────────────────┘                    │
                                                                    │
                                                                    ▼
                                                           ┌──────────────────┐
                                                           │cms_ar_ledger     │
                                                           │                  │
                                                           │entry_type: "PAY" │
                                                           │amount_krw (-)    │
                                                           └──────────────────┘
```

---

## 2. 테이블별 관계 상세 분석

### 2.1 주문 테이블 (cms_order_line)

#### 주요 컬럼 및 관계
```typescript
interface CmsOrderLine {
  order_line_id: string (PK)          // 주문 라인 고유 ID
  order_id?: string                   // 주문 헤더 ID (optional)
  customer_party_id: string (FK)      // 거래처 ID → cms_party
  matched_master_id?: string (FK)     // 마스터 아이템 ID → cms_master_item (optional)
  model_name: string                  // 모델명
  qty: number                         // 수량
  status: "PENDING" | "READY_TO_SHIP" | "SHIPPED" | "CANCELLED"  // 상태
  color?: string                      // 색상
  size?: string                       // 사이즈
  memo?: string                       // 메모
  created_at: timestamp               // 생성일
  updated_at: timestamp               // 수정일
}
```

#### 외래키 관계
| 컬럼 | 참조 테이블 | 관계 유형 | Nullable |
|------|-------------|-----------|----------|
| customer_party_id | cms_party(party_id) | N:1 | ❌ 필수 |
| matched_master_id | cms_master_item(master_item_id) | N:1 | ✅ 선택 |

#### ⚠️ 발견된 문제점

```
[문제 1] 주문-출고 직접 연결 부재
- cms_order_line에는 shipment_id 컬럼이 없음
- 주문과 출고는 논리적 관계만 있고 물리적 FK가 없음
- 주문 상태(status)가 출고에 의해 자동으로 변경되는지 불명확
```

---

### 2.2 출고 테이블 (cms_shipment_header / cms_shipment_line)

#### Header 테이블
```typescript
interface CmsShipmentHeader {
  shipment_id: string (PK)            // 출고 헤더 고유 ID
  customer_party_id: string (FK)      // 거래처 ID → cms_party
  order_id?: string (FK)              // 주문 헤더 ID → cms_order (optional)
  ship_date?: date                    // 출고일
  status: "DRAFT" | "CONFIRMED"       // 상태
  confirmed_at?: timestamp            // 확정일
  created_at: timestamp               // 생성일
  memo?: string                       // 메모
}
```

#### Line 테이블
```typescript
interface CmsShipmentLine {
  shipment_line_id: string (PK)       // 출고 라인 고유 ID
  shipment_id: string (FK)            // 출고 헤더 ID → cms_shipment_header
  order_line_id?: string (FK)         // 주문 라인 ID → cms_order_line (optional)
  model_name: string                  // 모델명
  qty: number                         // 수량
  measured_weight_g?: number          // 실측 중량
  deduction_weight_g?: number         // 차감 중량
  manual_labor_krw?: number           // 수기 공임
  total_amount_sell_krw?: number      // 총 판매금액 (+원재료 +공임)
  material_amount_sell_krw?: number   // 원재료 판매금액
  labor_total_sell_krw?: number       // 공임 판매금액
  created_at: timestamp               // 생성일
}
```

#### 외래키 관계
| 컬럼 | 참조 테이블 | 관계 유형 | Nullable | 비고 |
|------|-------------|-----------|----------|------|
| customer_party_id | cms_party(party_id) | N:1 | ❌ 필수 | 출고처(거래처) |
| order_id | cms_order(order_id) | N:1 | ✅ 선택 | 주문 헤더 연결 |
| shipment_id (line) | cms_shipment_header(shipment_id) | N:1 | ❌ 필수 | 헤더-라인 관계 |
| order_line_id (line) | cms_order_line(order_line_id) | 1:1 | ✅ 선택 | 주문 라인 연결 |

#### ✅ 정상 설정 확인

```typescript
// shipments/page.tsx - 출고 생성 시 주문 연결 확인
await shipmentUpsertMutation.mutateAsync({
  p_order_line_id: selectedOrderLineId,  // ✅ 주문 라인 ID 전달
  p_weight_g: weightValue,
  p_total_labor: laborValue,
  p_actor_person_id: actorId,
  p_idempotency_key: idempotencyKey,
});

// 반환값에서 order_line_id 확인
interface ShipmentUpsertResult {
  shipment_id?: string;        // ✅ 생성된 출고 ID
  shipment_line_id?: string;   // ✅ 생성된 출고 라인 ID
  status?: string;             // ✅ 상태
  // ⚠️ order_line_id 반환 여부는 확인 필요
}
```

#### ⚠️ 발견된 문제점

```
[문제 2] 주문-출고 1:1 관계 불명확
- order_line_id는 optional (nullable)
- 한 주문 라인이 여러 출고 라인에 연결될 수 있음 (1:N 가능성)
- 출고 시 주문 상태 자동 변경 여부 불명확

[문제 3] 출고-미수금 자동 연결 미확인
- 출고 확정 시 자동으로 AR이 생성되는지 확인 필요
- cms_fn_shipment_upsert_from_order_line RPC 내부 로직 확인 필요
```

---

### 2.3 미수금 테이블 (cms_ar_ledger)

#### 테이블 구조
```typescript
interface CmsArLedger {
  ar_ledger_id: string (PK)           // 미수금 라인 고유 ID
  party_id: string (FK)               // 거래처 ID → cms_party
  occurred_at: timestamp              // 발생일시
  created_at: timestamp               // 생성일시
  entry_type: "SHIPMENT" | "PAYMENT" | "RETURN"  // 유형
  amount_krw: number                  // 금액 (+: 미수증가, -: 미수감소)
  memo?: string                       // 메모
  
  // 연결 정보 (nullable)
  shipment_id?: string (FK)           // 출고 ID → cms_shipment_header
  shipment_line_id?: string (FK)      // 출고 라인 ID → cms_shipment_line
  payment_id?: string (FK)            // 수금 ID → cms_payment_header
  return_line_id?: string (FK)        // 반품 ID → cms_return_line
}
```

#### 외래키 관계
| 컬럼 | 참조 테이블 | 관계 유형 | Nullable | 비고 |
|------|-------------|-----------|----------|------|
| party_id | cms_party(party_id) | N:1 | ❌ 필수 | 미수금 발생 거래처 |
| shipment_id | cms_shipment_header(shipment_id) | 1:1 | ✅ 선택 | 출고 연결 |
| shipment_line_id | cms_shipment_line(shipment_line_id) | 1:1 | ✅ 선택 | 출고 라인 연결 |
| payment_id | cms_payment_header(payment_id) | 1:1 | ✅ 선택 | 수금 연결 |
| return_line_id | cms_return_line(return_line_id) | 1:1 | ✅ 선택 | 반품 연결 |

#### ✅ 정상 설정 확인

```typescript
// ar/page.tsx - 미수금 조회
const ledgerQuery = useQuery({
  queryKey: ["cms", "ar_ledger", effectiveSelectedPartyId],
  queryFn: async () => {
    const { data } = await schemaClient
      .from("cms_ar_ledger")
      .select(
        "ar_ledger_id, party_id, occurred_at, created_at, entry_type, amount_krw, memo, " +
        "shipment_id, shipment_line_id, payment_id, return_line_id"  // ✅ 연결 정보 조회
      )
      .eq("party_id", effectiveSelectedPartyId)
      .order("occurred_at", { ascending: false })
      .limit(200);
    return data;
  },
});

// 미수금 잔액 조회 (거래처별)
const positionsQuery = useQuery({
  queryKey: ["cms", "ar_position", typeFilter, activeOnly, debouncedSearch],
  queryFn: async () => {
    const { data } = await schemaClient
      .from(CONTRACTS.views.arPositionByParty)  // ✅ cms_v_ar_position_by_party 뷰
      .select("party_id, party_type, name, balance_krw, receivable_krw, credit_krw")
      .eq("party_type", typeFilter)
      .order("name");
    return data;
  },
});
```

#### ⚠️ 발견된 문제점

```
[문제 4] 미수금 자동 생성 여부 불명확
- 출고 확정 시 자동으로 cms_ar_ledger에 INSERT되는지 확인 필요
- 현재 코드에서는 수금/반품 처리만 보이고 출고 시 AR 생성 로직이 안 보임

[문제 5] 금액 계산 일관성
- shipment_line.total_amount_sell_krw vs ar_ledger.amount_krw
- 두 값이 항상 일치하는지 검증 필요
```

---

## 3. 데이터 흐름 상세 검증

### 3.1 주문 → 출고 흐름

#### Step 1: 주문 생성
```
[Action] 주문 저장
[API] cms_fn_upsert_order_line_v3
[Input] {
  p_customer_party_id: "party-123",
  p_model_name: "Ring-001",
  p_qty: 5,
  p_color: "GOLD",
  // ...
}
[Output] order_line_id: "order-line-456"
[Status] cms_order_line.status = "PENDING" or "READY_TO_SHIP"
```

#### Step 2: 출고 생성
```
[Action] 출고 저장
[Page] shipments/page.tsx
[API] cms_fn_shipment_upsert_from_order_line
[Input] {
  p_order_line_id: "order-line-456",     // ✅ 주문 라인 ID 연결
  p_weight_g: 12.5,
  p_total_labor: 150000,
  p_actor_person_id: "actor-789",
  p_idempotency_key: "uuid"
}
[Output] {
  shipment_id: "ship-789",
  shipment_line_id: "ship-line-101",
  status: "DRAFT"
}
[DB Insert] cms_shipment_line.order_line_id = "order-line-456"  // ✅ 연결
```

#### Step 3: 출고 확정
```
[Action] 출고 확정
[API] cms_fn_confirm_shipment_v3_cost_v1
[Input] {
  p_shipment_id: "ship-789",
  p_cost_mode: "PROVISIONAL" | "MANUAL",
  // cost details...
}
[Output] status: "CONFIRMED"
[DB Update] cms_shipment_header.status = "CONFIRMED"
```

#### ⚠️ 검증 필요사항

```sql
-- 주문-출고 연결 확인 쿼리
SELECT 
  ol.order_line_id,
  ol.model_name as order_model,
  ol.qty as order_qty,
  ol.status as order_status,
  sl.shipment_line_id,
  sl.model_name as shipment_model,
  sl.qty as shipment_qty,
  sl.total_amount_sell_krw,
  sh.shipment_id,
  sh.status as shipment_status
FROM cms_order_line ol
LEFT JOIN cms_shipment_line sl ON ol.order_line_id = sl.order_line_id
LEFT JOIN cms_shipment_header sh ON sl.shipment_id = sh.shipment_id
WHERE ol.order_line_id = 'specific-order-line-id';

-- 검증 포인트:
-- 1. sl.order_line_id가 올바르게 설정되었는지
-- 2. order_status와 shipment_status의 일관성
-- 3. qty 값이 일치하는지 (주문 5개 → 출고 5개)
```

---

### 3.2 출고 → 미수금 흐름

#### 이상적인 흐름
```
[Step 1] 출고 확정
↓
[Step 2] 자동으로 cms_ar_ledger에 INSERT
  party_id: 출고의 customer_party_id
  entry_type: "SHIPMENT"
  amount_krw: +total_amount_sell_krw  (미수 증가)
  shipment_id: 출고 ID
  shipment_line_id: 출고 라인 ID
↓
[Step 3] 거래처 잔액 증가
  cms_v_ar_position_by_party.balance_krw += amount_krw
```

#### 실제 코드에서 확인된 부분

```typescript
// ar/page.tsx - 미수금 조회
const ledgerQuery = useQuery({
  queryKey: ["cms", "ar_ledger", partyId],
  queryFn: async () => {
    const { data } = await schemaClient
      .from("cms_ar_ledger")
      .select("*")
      .eq("party_id", partyId)
      .order("occurred_at", { ascending: false });
    return data;
  },
});

// 수금 처리
const handleSubmitPayment = () => {
  paymentMutation.mutate({
    p_party_id: effectivePaymentPartyId,
    p_paid_at: new Date(paidAt).toISOString(),
    p_tenders: tenderPayload,
    p_memo: paymentMemo || null,
    // ⚠️ 여기서는 payment_id가 생성되어야 AR에도 반영됨
  });
};
```

#### ⚠️ 미확인 부분

```
[의문 1] 출고 확정 시 AR 자동 생성?
- cms_fn_confirm_shipment_v3_cost_v1 RPC가 AR도 생성하는지 확인 필요
- 현재 프론트엔드 코드에서는 AR 생성 호출이 보이지 않음

[의문 2] AR 생성이 없다면?
- 미수금이 출고와 동기화되지 않음
- AR 잔액이 실제 출고 금액과 불일치 가능

[해결책]
1. DB 트리거로 자동 생성 (권장)
   CREATE TRIGGER after_shipment_confirm
   AFTER UPDATE ON cms_shipment_header
   FOR EACH ROW
   WHEN (NEW.status = 'CONFIRMED')
   EXECUTE FUNCTION create_ar_from_shipment();

2. RPC 내부에서 AR 생성
   cms_fn_confirm_shipment_v3_cost_v1 내부에서
   INSERT INTO cms_ar_ledger ... 수행
```

---

## 4. 관계형 설정 검증 결과

### 4.1 외래키(FOREIGN KEY) 설정 현황

| 테이블 | 컬럼 | FK 설정 | 참조 무결성 | 평가 |
|--------|------|---------|-------------|------|
| cms_order_line | customer_party_id | ✅ | ❓ 확인 필요 | - |
| cms_order_line | matched_master_id | ✅ | ❓ 확인 필요 | - |
| cms_shipment_header | customer_party_id | ✅ | ❓ 확인 필요 | - |
| cms_shipment_header | order_id | ✅ | ❓ 확인 필요 | 선택적 |
| cms_shipment_line | shipment_id | ✅ | ❓ 확인 필요 | - |
| cms_shipment_line | order_line_id | ✅ | ❓ 확인 필요 | 선택적 |
| cms_ar_ledger | party_id | ✅ | ❓ 확인 필요 | - |
| cms_ar_ledger | shipment_id | ✅ | ❓ 확인 필요 | 선택적 |
| cms_ar_ledger | payment_id | ✅ | ❓ 확인 필요 | 선택적 |

### 4.2 논리적 관계 (애플리케이션 레벨)

```
✅ 정상 설정:
1. 주문 생성 → 출고 가능 (order_line_id 전달)
2. 출고 조회 → 주문 정보 조회 가능 (order_line_id 기반)
3. 출고 확정 → 미수금 조회 가능 (shipment_id 기반)
4. 수금 처리 → 미수금 감소 (payment_id 기반)
5. 반품 처리 → 미수금 조정 (return_line_id 기반)

⚠️ 미흡 설정:
1. 주문 상태 자동 변경 여부 불명확
   - 출고 완료 시 order.status가 "SHIPPED"로 변경되는지?

2. 출고-미수금 자동 연결 여부 불명확
   - 출고 확정 시 자동으로 AR이 생성되는지?

3. 거래처 일관성 검증
   - order.customer_party_id와 shipment.customer_party_id가 항상 동일한지?

4. 금액 일관성 검증
   - shipment_line.total_amount_sell_krw가 AR에 정확히 반영되는지?
```

---

## 5. 데이터 정합성 검증 시나리오

### 시나리오 1: 정상 흐름

```
[Given]
- 거래처 A (party_id: "party-a")
- 마스터 아이템 M (master_item_id: "master-m", 가격: 100,000원)

[When]
1. 주문 생성: A가 M을 3개 주문 (총 300,000원)
2. 출고 처리: 3개 출고 (중량/공임 추가로 총 350,000원)
3. 출고 확정

[Then Expected]
- cms_order_line.status = "SHIPPED"
- cms_shipment_header.status = "CONFIRMED"
- cms_ar_ledger에 다음 데이터 생성:
  * party_id: "party-a"
  * entry_type: "SHIPMENT"
  * amount_krw: +350,000
  * shipment_id: 출고 ID
- 거래처 A의 잔액: +350,000원

[Verification Query]
```sql
-- 주문-출고-미수금 일관성 확인
SELECT 
  '주문' as type,
  ol.order_line_id as id,
  ol.qty,
  ol.status
FROM cms_order_line ol
WHERE ol.order_line_id = 'order-line-id'

UNION ALL

SELECT 
  '출고' as type,
  sl.shipment_line_id as id,
  sl.qty,
  sh.status
FROM cms_shipment_line sl
JOIN cms_shipment_header sh ON sl.shipment_id = sh.shipment_id
WHERE sl.order_line_id = 'order-line-id'

UNION ALL

SELECT 
  '미수금' as type,
  ar.ar_ledger_id as id,
  ar.amount_krw as qty,
  ar.entry_type as status
FROM cms_ar_ledger ar
WHERE ar.shipment_line_id IN (
  SELECT shipment_line_id 
  FROM cms_shipment_line 
  WHERE order_line_id = 'order-line-id'
);
```
```

### 시나리오 2: 부분 출고

```
[Given]
- 주문: 10개

[When]
- 1차 출고: 6개
- 2차 출고: 4개

[Then Expected]
- cms_shipment_line 2개 생성
  * line 1: order_line_id = 주문ID, qty = 6
  * line 2: order_line_id = 주문ID, qty = 4
- cms_ar_ledger 2개 생성
  * 각 출고 금액만큼 AR 증가

[Potential Issue]
- 같은 order_line_id에 여러 shipment_line이 연결될 수 있음 (1:N)
- 주문 상태는 언제 "SHIPPED"로 변경? (첫 출고? 마지막 출고?)
```

### 시나리오 3: 반품 처리

```
[Given]
- 출고 완료: 5개 (500,000원)
- 미수금: +500,000원

[When]
- 반품 처리: 2개 반품

[Then Expected]
- cms_return_line 생성
- cms_ar_ledger에 반품 AR 생성:
  * entry_type: "RETURN"
  * amount_krw: -200,000 (출고금액의 2/5)
- 거래처 잔액: 500,000 - 200,000 = 300,000원

[Verification]
```sql
-- 반품 후 잔액 계산 검증
SELECT 
  party_id,
  SUM(CASE WHEN entry_type = 'SHIPMENT' THEN amount_krw ELSE 0 END) as total_shipped,
  SUM(CASE WHEN entry_type = 'PAYMENT' THEN amount_krw ELSE 0 END) as total_paid,
  SUM(CASE WHEN entry_type = 'RETURN' THEN amount_krw ELSE 0 END) as total_returned,
  SUM(amount_krw) as balance
FROM cms_ar_ledger
WHERE party_id = 'party-a'
GROUP BY party_id;
```
```

---

## 6. 발견된 문제점 및 위험도

### 🔴 Critical (즉시 조치 필요)

| # | 문제 | 위험도 | 설명 | 조치방안 |
|---|------|--------|------|----------|
| 1 | **출고-미수금 자동 연결 미확인** | 🔴 높음 | 출고 확정 시 AR이 자동 생성되는지 불명확. 수동 생성 시 누락 가능 | 1. RPC 내부 로직 확인<br>2. DB 트리거 설정 검토<br>3. AR 생성 여부 모니터링 |
| 2 | **주문 상태 자동 변경 미확인** | 🔴 높음 | 출고 완료 후 order.status가 자동으로 "SHIPPED"로 변경되는지 불명확 | 1. RPC 로직 확인<br>2. 상태 변경 트리거 검토 |

### 🟡 Warning (개선 권장)

| # | 문제 | 위험도 | 설명 | 조치방안 |
|---|------|--------|------|----------|
| 3 | **주문-출고 1:1/1:N 관계 불명확** | 🟡 중간 | 부분 출고 시나리오에서 관계가 모호함 | 1. 비즈니스 규칙 문서화<br>2. 코드 주석 추가<br>3. 부분 출고 테스트 |
| 4 | **금액 일관성 검증 부재** | 🟡 중간 | shipment_line.total_amount와 ar_ledger.amount가 항상 일치하는지 검증 없음 | 1. 일관성 체크 쿼리 작성<br>2. 주기적 검증 스케줄 |
| 5 | **거래처 일관성 검증 부재** | 🟡 중간 | order.customer_party_id와 shipment.customer_party_id가 항상 동일한지 검증 없음 | 1. DB constraint 추가 검토<br>2. 애플리케이션 검증 추가 |

### 🟢 Info (참고사항)

| # | 사항 | 설명 |
|---|------|------|
| 6 | 선택적 관계 다수 | order_id, order_line_id 등이 nullable. 업무적으로 유연하나 데이터 정합성 관리 필요 |
| 7 | 중간 테이블 없음 | 주문-출고 관계가 직접 연결됨. 복잡한 출고 규칙(분할, 합병) 지원 어려울 수 있음 |

---

## 7. 개선 권장사항

### 7.1 즉시 조치 (Day 1)

#### DB 트리거 설정 검증

```sql
-- 1. 출고 확정 시 자동 AR 생성 트리거 확인
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('cms_shipment_header', 'cms_shipment_line');

-- 2. 트리거가 없다면 생성 권장
CREATE OR REPLACE FUNCTION create_ar_from_shipment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'CONFIRMED' AND OLD.status != 'CONFIRMED' THEN
    INSERT INTO cms_ar_ledger (
      party_id,
      occurred_at,
      entry_type,
      amount_krw,
      shipment_id,
      memo
    )
    SELECT 
      h.customer_party_id,
      NEW.confirmed_at,
      'SHIPMENT',
      l.total_amount_sell_krw,
      NEW.shipment_id,
      'Auto-generated from shipment'
    FROM cms_shipment_line l
    WHERE l.shipment_id = NEW.shipment_id;
    
    -- 주문 상태도 업데이트
    UPDATE cms_order_line ol
    SET status = 'SHIPPED', updated_at = NOW()
    FROM cms_shipment_line sl
    WHERE sl.shipment_id = NEW.shipment_id
    AND ol.order_line_id = sl.order_line_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_shipment_confirm
AFTER UPDATE ON cms_shipment_header
FOR EACH ROW
EXECUTE FUNCTION create_ar_from_shipment();
```

### 7.2 단기 개선 (Week 1)

#### 데이터 정합성 모니터링

```typescript
// lib/monitoring/consistency-checks.ts (신규)

export async function runConsistencyChecks() {
  const checks = {
    // 1. 주문-출고 연결 검증
    orphanedShipments: await checkQuery(`
      SELECT COUNT(*) as count
      FROM cms_shipment_line sl
      LEFT JOIN cms_order_line ol ON sl.order_line_id = ol.order_line_id
      WHERE sl.order_line_id IS NOT NULL 
      AND ol.order_line_id IS NULL
    `),
    
    // 2. 출고-미수금 연결 검증
    shipmentsWithoutAR: await checkQuery(`
      SELECT COUNT(*) as count
      FROM cms_shipment_header sh
      JOIN cms_shipment_line sl ON sh.shipment_id = sl.shipment_id
      WHERE sh.status = 'CONFIRMED'
      AND NOT EXISTS (
        SELECT 1 FROM cms_ar_ledger ar 
        WHERE ar.shipment_id = sh.shipment_id
      )
    `),
    
    // 3. 금액 불일치 검증
    amountMismatch: await checkQuery(`
      SELECT COUNT(*) as count
      FROM cms_shipment_line sl
      JOIN cms_ar_ledger ar ON sl.shipment_id = ar.shipment_id
      WHERE sl.total_amount_sell_krw != ar.amount_krw
    `),
    
    // 4. 거래처 불일치 검증
    partyMismatch: await checkQuery(`
      SELECT COUNT(*) as count
      FROM cms_order_line ol
      JOIN cms_shipment_line sl ON ol.order_line_id = sl.order_line_id
      JOIN cms_shipment_header sh ON sl.shipment_id = sh.shipment_id
      WHERE ol.customer_party_id != sh.customer_party_id
    `),
  };
  
  // 알림 발송 (불일치 발견 시)
  Object.entries(checks).forEach(([name, result]) => {
    if (result.count > 0) {
      console.warn(`[Consistency Check] ${name}: ${result.count} issues found`);
      // Sentry 또는 Slack 알림
    }
  });
  
  return checks;
}
```

### 7.3 중기 개선 (Month 1)

#### 외래키 강화

```sql
-- 현재 선택적(nullable)인 FK 중 필수화 검토
-- 예: shipment_line.order_line_id를 NOT NULL로 변경 (비즈니스 규칙 확인 후)

ALTER TABLE cms_shipment_line 
ALTER COLUMN order_line_id SET NOT NULL;

-- 또는 CHECK constraint 추가
ALTER TABLE cms_shipment_line
ADD CONSTRAINT chk_shipment_has_order 
CHECK (order_line_id IS NOT NULL);
```

#### Materialized View 생성

```sql
-- 주문-출고-미수금 통합 뷰
CREATE MATERIALIZED VIEW mv_order_shipment_ar AS
SELECT 
  ol.order_line_id,
  ol.customer_party_id,
  ol.model_name as order_model,
  ol.qty as order_qty,
  ol.status as order_status,
  sh.shipment_id,
  sh.ship_date,
  sh.status as shipment_status,
  sl.shipment_line_id,
  sl.qty as shipment_qty,
  sl.total_amount_sell_krw,
  ar.ar_ledger_id,
  ar.amount_krw as ar_amount,
  CASE 
    WHEN ar.ar_ledger_id IS NULL THEN 'AR_MISSING'
    WHEN sl.total_amount_sell_krw != ar.amount_krw THEN 'AMOUNT_MISMATCH'
    ELSE 'OK'
  END as consistency_status
FROM cms_order_line ol
LEFT JOIN cms_shipment_line sl ON ol.order_line_id = sl.order_line_id
LEFT JOIN cms_shipment_header sh ON sl.shipment_id = sh.shipment_id
LEFT JOIN cms_ar_ledger ar ON sh.shipment_id = ar.shipment_id
WHERE ol.status != 'CANCELLED';

-- 인덱스 생성
CREATE INDEX idx_mv_consistency ON mv_order_shipment_ar(consistency_status);

-- 주기적 갱신 (매일 새벽)
REFRESH MATERIALIZED VIEW mv_order_shipment_ar;
```

---

## 8. 검증 체크리스트

### ✅ 정상 확인된 부분

- [x] 주문 생성 시 customer_party_id 필수 입력
- [x] 출고 생성 시 order_line_id 전달
- [x] 출고 라인에 order_line_id 저장
- [x] 출고-미수금 간 shipment_id/shipment_line_id 연결
- [x] 미수금 ledger의 entry_type 구분 (SHIPMENT/PAYMENT/RETURN)
- [x] 거래처별 잔액 조회 뷰 (cms_v_ar_position_by_party) 사용

### ⚠️ 확인 필요한 부분

- [ ] 출고 확정 시 자동 AR 생성 여부
- [ ] 주문 상태 자동 변경 여부 (→ SHIPPED)
- [ ] 부분 출고 시나리오 지원 여부
- [ ] shipment_line.total_amount와 ar_ledger.amount 일관성
- [ ] order.customer_party_id와 shipment.customer_party_id 일관성

---

## 9. 결론

### 종합 평가

```
┌─────────────────────────────────────────────────────────────┐
│              관계형 설정 검증 결과                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  기본 구조: ✅ 양호                                          │
│  - 주문→출고→미수금 흐름이 논리적으로 정립됨                │
│  - 필수 외래키가 적절히 설정됨                               │
│                                                              │
│  자동화 수준: ⚠️ 미흡                                        │
│  - 출고 확정 시 AR 자동 생성 여부 불명확                    │
│  - 주문 상태 자동 변경 여부 불명확                         │
│                                                              │
│  데이터 정합성: ⚠️ 모니터링 필요                             │
│  - 금액 일관성 검증 부재                                     │
│  - 거래처 일관성 검증 부재                                   │
│                                                              │
│  전체 등급: B+ (양호하나 개선 필요)                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 권장 조치

1. **즉시**: DB 트리거/RPC 내부 로직 확인하여 AR 자동 생성 보장
2. **1주 내**: 데이터 정합성 모니터링 스크립트 배포
3. **1개월 내**: 외래키 강화 및 일관성 검증 자동화

### 위험도 요약

| 위험 | 가능성 | 영향도 | 우선순위 |
|------|--------|--------|----------|
| 미수금 누락 | 중간 | 높음 | 🔴 즉시 |
| 주문 상태 불일치 | 낮음 | 중간 | 🟡 단기 |
| 금액 불일치 | 낮음 | 높음 | 🟡 단기 |
| 거래처 불일치 | 매우 낮음 | 중간 | 🟢 중기 |

---

**문서 작성자**: AI Assistant  
**검증 도구**: 코드 정적 분석  
**버전**: 1.0  
**마지막 수정**: 2026년 2월 2일
