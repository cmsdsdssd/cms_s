# CMS 업무 프로세스 가이드

## 개요

**시스템명**: 주문/출고/미수금 관리 시스템 (CMS)  
**대상 사용자**: 영업/출고/회계 담당자  
**프로세스 흐름**: 주문 → 출고 → 미수발생 → 수금/반품 → 정산완료

---

## 📊 전체 프로세스 다이어그램

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           업무 프로세스 흐름도                              │
└────────────────────────────────────────────────────────────────────────────┘

   [고객]         [주문입력]         [출고처리]        [미수관리]       [정산]
     │                │                 │                │             │
     │                ▼                 ▼                ▼             ▼
     │         ┌─────────────┐   ┌─────────────┐  ┌─────────────┐  ┌──────┐
     │         │  /orders    │   │  /shipments │  │    /ar      │  │ 완료 │
     │         │   (주문)     │   │   (출고)     │  │  (미수금)   │  │      │
     │         └──────┬──────┘   └──────┬──────┘  └──────┬──────┘  └──────┘
     │                │                 │                │
     ▼                ▼                 ▼                ▼
              cms_order_line    cms_shipment_      cms_ar_ledger
                                   header/line
```

---

## 1단계: 주문 입력 (Order)

### 🖥️ 사용 화면
- **URL**: `/orders` 또는 `/orders_main`
- **담당**: 영업팀

### 🎯 업무 목적
고객으로부터 받은 주문을 시스템에 등록하여 출고 대기 상태로 만듭니다.

### 📝 입력 데이터

| 항목 | 설명 | 예시 값 |
|------|------|---------|
| 고객 | 주문한 거래처 | "금호상사" |
| 모델 | 제품 모델명 | "GR-001-GOLD" |
| 수량 | 주문 수량 | 5개 |
| 색상 | 제품 색상 | "GOLD" |
| 사이즈 | 제품 사이즈 | "14호" |
| 도금 | 도금 여부/색상 | "도금함, 로즈골드" |
| 원석 | 메인석/보조석 정보 | "다이아몬드 1개, 루비 2개" |
| 메모 | 특이사항 | "긴급주문" |

### 🗄️ 저장되는 테이블

#### `cms_order_line` (주문 테이블)

| 컬럼명 | 데이터 타입 | 설명 | 예시 값 |
|--------|-------------|------|---------|
| **order_line_id** | UUID (PK) | 주문 고유번호 | `3585430c-53a5-4615-a345-290c9a0636e3` |
| customer_party_id | UUID (FK) | 고객 ID | `7406a346-0dec-4444-88af-2ec24fd1fca2` |
| model_name | VARCHAR | 모델명 | `GR-001-GOLD` |
| suffix | VARCHAR | 모델 접미사 | `R` |
| color | VARCHAR | 색상 | `GOLD` |
| size | VARCHAR | 사이즈 | `14` |
| qty | INTEGER | 수량 | `5` |
| is_plated | BOOLEAN | 도금 여부 | `true` |
| plating_color_code | VARCHAR | 도금 색상 | `ROSEGOLD` |
| center_stone_name | VARCHAR | 메인석 이름 | `DIAMOND` |
| center_stone_qty | INTEGER | 메인석 수량 | `1` |
| sub1_stone_name | VARCHAR | 보조석1 이름 | `RUBY` |
| sub1_stone_qty | INTEGER | 보조석1 수량 | `2` |
| status | VARCHAR | 주문 상태 | `READY_TO_SHIP` |
| memo | TEXT | 메모 | `긴급주문` |
| created_at | TIMESTAMP | 생성일시 | `2026-02-02 10:00:00` |
| updated_at | TIMESTAMP | 수정일시 | `2026-02-02 10:00:00` |

### 📌 상태값 설명

| 상태 | 설명 | 다음 단계 |
|------|------|-----------|
| `PENDING` | 접수 대기 | 영업 확인 후 `READY_TO_SHIP`로 변경 |
| `READY_TO_SHIP` | 출고 대기 ⭐ | 출고 가능 상태 (기본값) |
| `SHIPPED` | 출고 완료 | 출고 처리 후 자동 변경 |
| `CANCELLED` | 주문 취소 | 취소 처리 시 변경 |

### ✅ 완료 후 결과
- `cms_order_line` 테이블에 **1개 레코드** 생성
- 상태: `READY_TO_SHIP` (출고 대기)
- `/shipments` 화면에서 이 주문을 출고 처리할 수 있음

---

## 2단계: 출고 처리 (Shipment)

### 🖥️ 사용 화면
- **URL**: `/shipments`
- **담당**: 출고/물류팀

### 🎯 업무 목적
실제 물건을 출고하고, 중량과 공임을 측정하여 판매금액을 산정합니다.

### 📝 입력 데이터

| 항목 | 설명 | 예시 값 |
|------|------|---------|
| 주문 선택 | 출고할 주문 선택 | 주문리스트에서 선택 |
| 실측 중량 | 실제 제품 중량 | 12.5g |
| 차감 중량 | 원재료 차감 중량 | 0.5g |
| 공임 | 가공 비용 | 150,000원 |
| 영수증 | 구매 영수증 첨부 | 파일 업로드 |

### 🗄️ 저장되는 테이블

#### A. `cms_shipment_header` (출고 헤더 테이블)

| 컬럼명 | 데이터 타입 | 설명 | 예시 값 |
|--------|-------------|------|---------|
| **shipment_id** | UUID (PK) | 출고번호 | `3585430c-53a5-4615-a345-290c9a0636e3` |
| customer_party_id | UUID (FK) | 고객 ID | `7406a346-0dec-4444-88af-2ec24fd1fca2` |
| order_id | UUID (FK) | 주문 헤더 ID (Optional) | `abc-123-xxx` |
| ship_date | DATE | 출고일 | `2026-02-02` |
| status | VARCHAR | 출고 상태 | `CONFIRMED` |
| confirmed_at | TIMESTAMP | 확정일시 | `2026-02-02 14:30:00` |
| memo | TEXT | 메모 | `정상출고` |
| created_at | TIMESTAMP | 생성일시 | `2026-02-02 14:00:00` |

#### B. `cms_shipment_line` (출고 라인 테이블)

| 컬럼명 | 데이터 타입 | 설명 | 예시 값 |
|--------|-------------|------|---------|
| **shipment_line_id** | UUID (PK) | 출고 라인번호 | `0a1ad8f4-0ada-424f-8019-7075ff47722a` |
| **shipment_id** | UUID (FK) | 출고 헤더 ID | `3585430c-53a5-4615-a345-290c9a0636e3` |
| **⭐ order_line_id** | UUID (FK) | 주문 라인 ID | `def-456-yyy` |
| model_name | VARCHAR | 모델명 | `GR-001-GOLD` |
| color | VARCHAR | 색상 | `GOLD` |
| size | VARCHAR | 사이즈 | `14` |
| qty | INTEGER | 출고수량 | `5` |
| measured_weight_g | DECIMAL | 실측 중량 | `12.5` |
| deduction_weight_g | DECIMAL | 차감 중량 | `0.5` |
| manual_labor_krw | INTEGER | 수기 공임 | `150000` |
| material_amount_sell_krw | INTEGER | 원재료 판매금액 | `200000` |
| labor_total_sell_krw | INTEGER | 공임 판매금액 | `150000` |
| **⭐ total_amount_sell_krw** | INTEGER | 총 판매금액 | `350000` |
| created_at | TIMESTAMP | 생성일시 | `2026-02-02 14:00:00` |

### 🔗 테이블 간 관계

```
cms_order_line (1) ─────────────────────┐
     │                                    │
     │ order_line_id                      │ order_line_id
     ▼                                    │
cms_shipment_line (N) ──► cms_shipment_header (1)
     │                          │
     │ shipment_id              │ customer_party_id
     │                          ▼
     │                   cms_party (거래처)
     │
     │ shipment_line_id
     ▼
cms_ar_ledger (미수금)
```

### 📌 상태값 설명

| 상태 | 설명 | 다음 단계 |
|------|------|-----------|
| `DRAFT` | 작성 중 | 출고 확정 전 임시 상태 |
| `CONFIRMED` | 출고 확정 ⭐ | 자동으로 미수금 발생 |
| `CANCELLED` | 출고 취소 | 취소 시 미수금도 취소 |

### ✅ 완료 후 결과
1. `cms_shipment_header`에 헤더 정보 생성
2. `cms_shipment_line`에 상세 정보 생성 (⭐ **주문과 연결**)
3. `cms_order_line.status`가 `SHIPPED`로 자동 변경 (트리거로 처리)
4. `cms_ar_ledger`에 미수금 자동 생성 (트리거로 처리)

---

## 3단계: 미수금 발생 (AR - Account Receivable)

### 🖥️ 사용 화면
- **URL**: `/ar` (자동 생성됨, 별도 입력 없음)
- **담당**: 자동 처리 (시스템)

### 🎯 업무 목적
출고한 금액만큼 고객에게 받을 돈(미수금/채권)을 자동으로 기록합니다.

### 🗄️ 저장되는 테이블

#### `cms_ar_ledger` (미수금 원장 테이블)

| 컬럼명 | 데이터 타입 | 설명 | 예시 값 |
|--------|-------------|------|---------|
| **ar_ledger_id** | UUID (PK) | 미수금 번호 | `ar-789-www` |
| **party_id** | UUID (FK) | 고객 ID | `7406a346-0dec-4444-88af-2ec24fd1fca2` |
| **entry_type** | VARCHAR | 항목 유형 | `SHIPMENT` |
| **⭐ amount_krw** | INTEGER | 금액 | `+350000` (양수=미수증가) |
| occurred_at | TIMESTAMP | 발생일시 | `2026-02-02 14:30:00` |
| created_at | TIMESTAMP | 생성일시 | `2026-02-02 14:30:00` |
| memo | TEXT | 메모 | `Auto-generated from shipment` |

#### 연결 컬럼 (어떤 출고/수금과 연결되는지)

| 컬럼명 | 설명 | 값 (출고시) |
|--------|------|-------------|
| shipment_id | 출고 ID | `3585430c-53a5-4615-a345-290c9a0636e3` |
| shipment_line_id | 출고 라인 ID | `0a1ad8f4-0ada-424f-8019-7075ff47722a` |
| payment_id | 수금 ID | `NULL` (아직 수금 안 됨) |
| return_line_id | 반품 ID | `NULL` |

### 📌 entry_type 종류

| 유형 | 설명 | amount_krw 부호 |
|------|------|-----------------|
| `SHIPMENT` | 출고로 인한 미수 발생 | ➕ 양수 (미수 증가) |
| `PAYMENT` | 수금으로 인한 미수 감소 | ➖ 음수 (미수 감소) |
| `RETURN` | 반품으로 인한 미수 감소 | ➖ 음수 (미수 감소) |

### ✅ 완료 후 결과
- `cms_ar_ledger`에 **1개 레코드** 생성
- 금액은 **양수(+)**: 미수가 증가했음을 의미
- `/ar` 화면에서 고객별 미수 잔액으로 표시됨

---

## 4단계: 수금 처리 (Payment)

### 🖥️ 사용 화면
- **URL**: `/ar` → 수금 탭
- **담당**: 회계/영업팀

### 🎯 업무 목적
고객으로부터 미수금을 받아서 잔액을 정산합니다.

### 📝 입력 데이터

| 항목 | 설명 | 예시 값 |
|------|------|---------|
| 거래처 | 수금받을 고객 | "금호상사" |
| 수금일시 | 받은 날짜/시간 | `2026-02-03 10:00` |
| 결제수단 | 현금/계좌이체/카드 등 | `BANK` |
| 금액 | 받은 금액 | `350,000원` |
| 메모 | 특이사항 | `2월분 완납` |

### 🗄️ 저장되는 테이블

#### A. `cms_payment_header` (수금 헤더 테이블)

| 컬럼명 | 데이터 타입 | 설명 | 예시 값 |
|--------|-------------|------|---------|
| **payment_id** | UUID (PK) | 수금번호 | `pay-333-xxx` |
| party_id | UUID (FK) | 고객 ID | `7406a346-0dec-4444-88af-2ec24fd1fca2` |
| paid_at | TIMESTAMP | 수금일시 | `2026-02-03 10:00:00` |
| total_amount_krw | INTEGER | 총 수금액 | `350000` |
| memo | TEXT | 메모 | `2월분 완납` |
| created_at | TIMESTAMP | 생성일시 | `2026-02-03 10:00:00` |

#### B. `cms_payment_line` (수금 라인 테이블 - 결제수단별)

| 컬럼명 | 데이터 타입 | 설명 | 예시 값 |
|--------|-------------|------|---------|
| payment_line_id | UUID (PK) | 라인번호 | `pay-line-444` |
| payment_id | UUID (FK) | 수금 헤더 ID | `pay-333-xxx` |
| method | VARCHAR | 결제수단 | `BANK` (현금/계좌/카드 등) |
| amount_krw | INTEGER | 금액 | `350000` |
| meta | JSON | 추가정보 | `{"account": "123-45-67890"}` |

#### C. `cms_ar_ledger` (미수금 감소 기록)

| 컬럼명 | 데이터 타입 | 설명 | 예시 값 |
|--------|-------------|------|---------|
| ar_ledger_id | UUID (PK) | 미수금 번호 | `ar-555-zzz` |
| party_id | UUID (FK) | 고객 ID | `7406a346-0dec-4444-88af-2ec24fd1fca2` |
| entry_type | VARCHAR | 항목 유형 | `PAYMENT` |
| **⭐ amount_krw** | INTEGER | 금액 | `-350000` (음수=미수감소) |
| payment_id | UUID (FK) | 수금 ID | `pay-333-xxx` |
| occurred_at | TIMESTAMP | 발생일시 | `2026-02-03 10:00:00` |

### ✅ 완료 후 결과
1. `cms_payment_header/line`에 수금 정보 저장
2. `cms_ar_ledger`에 **음수(-) 레코드** 추가 → 미수금 감소
3. 거래처 잔액: `+350,000` + `-350,000` = **0원** (정산완료)

---

## 5단계: 반품 처리 (Return) - 선택적

### 🖥️ 사용 화면
- **URL**: `/ar` → 반품 탭
- **담당**: 영업/품질팀

### 🎯 업무 목적
출고한 물건의 일부 또는 전부를 반품받고 미수금을 조정합니다.

### 📝 입력 데이터

| 항목 | 설명 | 예시 값 |
|------|------|---------|
| 출고 라인 | 반품할 출고 선택 | `ship-line-111` |
| 반품 수량 | 반품할 개수 | `2`개 (5개 중 2개 반품) |
| 반품 사유 | 반품 이유 | `품질불량` |
| 반품 금액 | 반품에 해당하는 금액 | `140,000원` |

### 🗄️ 저장되는 테이블

#### A. `cms_return_line` (반품 테이블)

| 컬럼명 | 데이터 타입 | 설명 | 예시 값 |
|--------|-------------|------|---------|
| **return_line_id** | UUID (PK) | 반품번호 | `ret-555-xxx` |
| shipment_line_id | UUID (FK) | 출고 라인 ID | `0a1ad8f4-0ada-424f-8019-7075ff47722a` |
| return_qty | INTEGER | 반품수량 | `2` |
| return_amount_krw | INTEGER | 반품금액 | `140000` |
| reason | VARCHAR | 반품사유 | `품질불량` |
| occurred_at | TIMESTAMP | 발생일시 | `2026-02-04 15:00:00` |
| created_at | TIMESTAMP | 생성일시 | `2026-02-04 15:00:00` |

#### B. `cms_ar_ledger` (미수금 조정)

| 컬럼명 | 데이터 타입 | 설명 | 예시 값 |
|--------|-------------|------|---------|
| ar_ledger_id | UUID (PK) | 미수금 번호 | `ar-666-www` |
| party_id | UUID (FK) | 고객 ID | `7406a346-0dec-4444-88af-2ec24fd1fca2` |
| entry_type | VARCHAR | 항목 유형 | `RETURN` |
| **⭐ amount_krw** | INTEGER | 금액 | `-140000` (음수=미수감소) |
| return_line_id | UUID (FK) | 반품 ID | `ret-555-xxx` |
| occurred_at | TIMESTAMP | 발생일시 | `2026-02-04 15:00:00` |

### ✅ 완료 후 결과
- `cms_return_line`에 반품 정보 저장
- `cms_ar_ledger`에 **음수(-) 레코드** 추가
- 미수금 잔액 감소 (예: `350,000` - `140,000` = `210,000`원)

---

## 📊 잔액 계산 로직 (핵심)

### 거래처별 미수금 잔액 계산

```sql
-- 특정 거래처의 현재 미수잔액 조회
SELECT 
  party_id,
  SUM(amount_krw) as balance_krw
FROM cms_ar_ledger
WHERE party_id = '7406a346-0dec-4444-88af-2ec24fd1fca2'
GROUP BY party_id;
```

### 계산 예시

| 순서 | 유형 | 금액 | 누계 잔액 | 설명 |
|------|------|------|-----------|------|
| 1 | 출고 | `+350,000` | **350,000** | 초기 미수 발생 |
| 2 | 수금 | `-350,000` | **0** | 완납 → 정산완료 |
| 3 | 출고 | `+500,000` | **500,000** | 새로운 미수 |
| 4 | 반품 | `-200,000` | **300,000** | 일부 반품 |
| 5 | 수금 | `-150,000` | **150,000** | 일부 수금 |

**최종 잔액**: `150,000원` 미수 (미수금이 남아있음)

---

## 🗄️ 전체 테이블 관계도 (ERD)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           테이블 관계도                                  │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐
│   cms_party         │
│   (거래처)          │
├─────────────────────┤
│ party_id (PK)       │
│ name                │
│ party_type          │
└─────────┬───────────┘
          │ 1:N
          ▼
┌─────────────────────┐      ┌─────────────────────┐
│  cms_order_line     │      │  cms_shipment_header│
│  (주문)             │      │  (출고 헤더)        │
├─────────────────────┤      ├─────────────────────┤
│ order_line_id (PK)  │      │ shipment_id (PK)    │
│ customer_party_id   │◀─────│ customer_party_id   │
│ model_name          │      │ order_id (FK)       │
│ qty                 │      │ ship_date           │
│ status              │      │ status              │
└─────────┬───────────┘      └─────────┬───────────┘
          │ 1:1                        │ 1:N
          ▼                            ▼
┌─────────────────────────────────────────────────────┐
│              cms_shipment_line                      │
│              (출고 라인)                            │
├─────────────────────────────────────────────────────┤
│ shipment_line_id (PK)                               │
│ shipment_id (FK) ◀──────────────────────────────────┤
│ order_line_id (FK) ◀────────────────────────────────┤
│ model_name                                          │
│ qty                                                 │
│ total_amount_sell_krw                               │
└─────────┬───────────────────────────────────────────┘
          │ 1:1
          ▼
┌─────────────────────────────────────────────────────┐
│              cms_ar_ledger                          │
│              (미수금 원장)                          │
├─────────────────────────────────────────────────────┤
│ ar_ledger_id (PK)                                   │
│ party_id (FK) ◀─────────────────────────────────────┤
│ entry_type (SHIPMENT/PAYMENT/RETURN)                │
│ amount_krw (+/-)                                    │
│ shipment_id (FK, Optional)                          │
│ shipment_line_id (FK, Optional)                     │
│ payment_id (FK, Optional)                           │
│ return_line_id (FK, Optional)                       │
└─────────────────────────────────────────────────────┘
          ▲
          │ N:1
┌─────────┴───────────┐      ┌─────────────────────┐
│  cms_payment_header │      │  cms_return_line    │
│  (수금)             │      │  (반품)             │
├─────────────────────┤      ├─────────────────────┤
│ payment_id (PK)     │      │ return_line_id (PK) │
│ party_id            │──────│ shipment_line_id    │
│ paid_at             │      │ return_qty          │
│ total_amount_krw    │      │ return_amount_krw   │
└─────────────────────┘      └─────────────────────┘
```

---

## 🎯 핵심 연결고리 정리

### 데이터가 어떻게 연결되는지

```
[주문]              [출고]               [미수금]
order_line_id  ↔   order_line_id   →    (연결없음, party_id로만)
     │                                   
     │              shipment_line_id  →   shipment_line_id
     │                                   
     └────────────► shipment_id      →   shipment_id
```

| 단계 | From | To | 연결 컬럼 |
|------|------|----|-----------|
| 주문→출고 | `cms_order_line` | `cms_shipment_line` | `order_line_id` |
| 출고→미수 | `cms_shipment_line` | `cms_ar_ledger` | `shipment_line_id` |
| 출고→미수 | `cms_shipment_header` | `cms_ar_ledger` | `shipment_id` |
| 수금→미수 | `cms_payment_header` | `cms_ar_ledger` | `payment_id` |
| 반품→미수 | `cms_return_line` | `cms_ar_ledger` | `return_line_id` |
| 모든→거래처 | 각 테이블 | `cms_party` | `party_id` |

---

## 📋 사용 화면 정리

| 화면 | URL | 하는 일 | 입력 테이블 | 출력 테이블 |
|------|-----|---------|-------------|-------------|
| 주문입력 | `/orders` | 신규 주문 등록 | - | `cms_order_line` |
| 주문목록 | `/orders_main` | 주문 조회/관리 | - | `cms_order_line` (조회) |
| 출고처리 | `/shipments` | 출고 등록/확정 | `cms_order_line` (선택) | `cms_shipment_header/line` |
| 출고목록 | `/shipments_main` | 출고 내역 조회 | - | `cms_shipment_header/line` (조회) |
| 미수관리 | `/ar` | 미수금 조회/수금/반품 | `cms_shipment_line` (선택) | `cms_ar_ledger`, `cms_payment_header`, `cms_return_line` |
| 작업대 | `/workbench` | 통합 작업 환경 | 통합 | 통합 조회 |

---

## ✅ 프로세스 체크리스트

### 주문 단계
- [ ] 거래처 선택
- [ ] 모델/수량/색상 입력
- [ ] 원석 정보 입력
- [ ] 주문 저장 → `cms_order_line` 생성

### 출고 단계
- [ ] 주문 선택 (`order_line_id` 연결)
- [ ] 중량/공임 측정
- [ ] 출고 저장 → `cms_shipment_header/line` 생성
- [ ] 출고 확정 → `cms_ar_ledger` 자동 생성, 주문 상태 `SHIPPED` 변경

### 미수 단계
- [ ] 미수금 자동 발생 확인
- [ ] 수금 시 `amount_krw` 음수로 입력
- [ ] 반품 시 `amount_krw` 음수로 입력
- [ ] 잔액 0원 확인 (정산완료)

---

**문서 작성일**: 2026년 2월 2일  
**버전**: 1.0  
**대상**: 개발자/운영자용 업무 프로세스 가이드
