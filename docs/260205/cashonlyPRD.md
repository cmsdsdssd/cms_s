# [CODING AGENT PROMPT] 단가제(Unit Pricing) 미수 표시를 “총액 ONLY”로 (Shipment Print + AR) — UI만 변경

### 0) 절대 금지(중요)
* **DB/RPC/백엔드 로직 수정 금지:** 이미 DB push가 완료되었으며 테스트 데이터만 존재함.
* **기존 기능/흐름/계산/저장/상계/FIFO 로직 절대 변경 금지.**
* **변경 범위:** 오직 “보이는 UI 표시(렌더링)만” 변경함.
* **레이아웃 유지:** 기존 컬럼/헤더/레이아웃은 최대한 유지하되, 단가제 건만 값 표시를 숨김 처리(“-” 또는 빈칸)한다.

---

### 1) 목표(What)
단가제(**is_unit_pricing=true**)로 출고된 건은 미수에서 금/은 중량, 소재 환산, 공임 같은 분해값이 고객/현장에 보이면 혼란이 생길 수 있다. 따라서 아래 2개 화면에서 단가제 건은 **“총액(현금)만”** 보이게 한다.
* **출고 영수증 출력 화면:** `/web/src/app/(app)/shipments_print/page.tsx` + 출력 컴포넌트
* **AR(미수 관리):** `/web/src/app/(app)/ar/page.tsx`

---

### 2) 단가제 판별 기준 (Backend는 이미 이렇게 저장됨)

#### (A) AR 화면에서 단가제 “CASH-only” 판별
추가 DB 조회 없이, `ArInvoicePositionRow` row만으로 판별한다. 다음을 모두 만족하면 `unitPricingCashOnly = true`로 간주:
* `row.commodity_type == null`
* `Number(row.material_cash_due_krw ?? 0) === 0`
* `Number(row.material_cash_outstanding_krw ?? 0) === 0`
* `Number(row.commodity_due_g ?? 0) === 0`
* `Number(row.commodity_outstanding_g ?? 0) === 0`
* `Number(row.labor_cash_due_krw ?? 0) === Number(row.total_cash_due_krw ?? 0)`
* `Number(row.labor_cash_outstanding_krw ?? 0) === Number(row.total_cash_outstanding_krw ?? 0)`
> **구현:** `isUnitPricingCashOnlyAr(row: ArInvoicePositionRow): boolean` 헬퍼 함수 사용.

#### (B) Shipment Print(출고 영수증)에서 단가제 판별
영수증은 `shipment_line`에 `is_unit_pricing`이 직접 내려오지 않으므로, 읽기 전용으로 master를 조회해서 매핑한다.
1.  `cms_master_item`에서 `model_name`, `is_unit_pricing`을 조회.
2.  현재 화면에서 다루는 라인들에 포함된 `model_name` 목록을 뽑아 `.in("model_name", names)`로 조회.
3.  `Map<model_name_trimmed, boolean>` 생성 후 각 line에 `is_unit_pricing` 필드를 붙여서 렌더링/합계 계산에 사용.
*(이 조항은 UI 표시를 위한 read-only이며, 기능/로직 변경이 아님)*

---

### 3) 구현 변경 사항 — Shipment Print
**대상 파일:**
* `/web/src/app/(app)/shipments_print/page.tsx`
* `/web/src/components/receipt/receipt-print.tsx`

#### 3-1) shipments_print/page.tsx 변경
* **모델명 리스트 수집(useMemo):** `shipmentsQuery.data`, `totalsQuery.data`, `previousLinesQuery.data`에서 `model_name`들을 수집(중복 제거, trim).
* **totalsQuery 수정:** 현재 `model_name`을 select하지 않으므로 select 항목에 `model_name` 추가 (read-only 조회 확장).
* **master 조회(useQuery):** `schemaClient.from("cms_master_item").select("model_name, is_unit_pricing").in("model_name", modelNames)`
* **데이터 주입:** `todayLines`, `totalsQuery.data`, `previousLinesQuery.data` 쪽 라인에 `is_unit_pricing` 필드 주입.
* **합계 계산 로직(toLineAmounts) 수정:** `line.is_unit_pricing === true`면 gold/silver/labor는 0으로, total만 유지.
```typescript
const toLineAmounts = (line: ReceiptLine): Amounts => {
  const total = Number(line.total_amount_sell_krw ?? 0);
  if (line.is_unit_pricing) return { gold: 0, silver: 0, labor: 0, total };
  // 기존 로직 유지...
};
```

#### 3-2) receipt-print.tsx 변경 (렌더링만)
* `ReceiptLineItem` 타입에 `is_unit_pricing?: boolean | null;` 필드 추가.
* **테이블 표시:** 단가제인 경우 금중량, 은중량, 총공임 칸은 “-” 또는 빈칸 처리. 총금액만 정상 표시.
* **시각적 요소:** 모델명 옆에 작은 “단가제” 배지 추가 (옵션, 기능 영향 없음).

---

### 4) 구현 변경 사항 — AR(미수 관리)
**대상 파일:**
* `/web/src/app/(app)/ar/page.tsx`

#### 4-1) FIFO 테이블 “미수 잔액(FIFO)” 표시 수정
* `openInvoices.map` 렌더링 시 `const unitOnly = isUnitPricingCashOnlyAr(row);` 판별.
* `unitOnly`인 경우: 공임 잔액, 소재 환산, 금/은 잔량 컬럼은 “-” 표시. 총 잔액만 정상 표시.

#### 4-2) 상단 거래처 요약 카드 표시 개선
* **문제:** 단가제는 백엔드상 `labor_cash_outstanding_krw == total`로 쌓여 공임 잔액이 크게 보이는 현상 발생.
* **해결:** `invoicePositions`로부터 단가제(unitOnly)를 제외한 값만 합산하여 표시용으로 교체.
```typescript
displayLabor = sum(row.labor_cash_outstanding_krw) from rows where !unitOnly
displayMaterial = sum(row.material_cash_outstanding_krw) from rows where !unitOnly
displayGold = sum(row.commodity_outstanding_g) where commodity_type=="gold" and !unitOnly
displaySilver = sum(row.commodity_outstanding_g) where commodity_type=="silver" and !unitOnly
```
* 총 잔액(`total_cash_outstanding_krw`)은 기존대로 유지하여 데이터 무결성 보장.

---

### 5) 검증 시나리오(반드시 통과)
1.  **단가제 출고 1건 (commodity null, material 0, labor==total):**
    * Shipment Print: 금/은/공임 칸 비어있고 총금액만 출력.
    * AR FIFO: 공임/소재/금은 칼럼은 “-”, 총 잔액만 표시.
    * AR 상단 요약: 공임 잔액이 총액으로 튀지 않고 총 잔액만 증가.
2.  **일반 출고 (기존 방식):**
    * 기존처럼 금/은/공임/총액 모두 표시되며 수치 변동 없음.
3.  **단가제 + 일반 출고 혼합 거래처:**
    * 일반 출고분의 수치는 정상 표시.
    * 단가제분은 분해값 숨김 처리 후 총 잔액에만 합산 반영.

---

### 6) 변경 최소화 원칙
* UI 변경은 조건 분기(렌더링) 및 read-only master 조회로 국한.
* 기존 쿼리, 정렬, 필터, 버튼 동작(재계산, 수금, 반품 등) 수정 절대 금지.
* 타입 에러 없이 빌드 통과 필수.