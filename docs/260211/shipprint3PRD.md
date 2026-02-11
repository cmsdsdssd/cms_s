# PRD: Shipments_print v3(Strict SOT Breakdown) 프론트엔드 적용 — “카테고리별 금/은/공임까지 무조건 원장 SOT” (ADD-ONLY DB v3 전제)

## 문서 목적
백엔드에 add-only로 추가된 `cms_fn_shipments_print_ledger_statement_v3`를 Shipments_print가 사용하도록 프론트엔드를 업데이트한다.
목표는 KRW 뿐 아니라 gold/silver/labor까지 “당일 출고/반품/결제/조정/상계/기타” 분해가 항상 end-prev와 정확히 일치하도록 구현하여, 무조건 원장 SOT를 달성한다.
동시에 “최근 하루 결제” 및 “서비스 완불처리(≤₩1,000)”를 영수증에 혼동 없이 표기한다.

---

## 1) 배경 / 문제 정의
현행 v2 기반 Shipments_print는 KRW 정합(잔고, 라인합, checks) 측면에서 강력하지만,

* “당일 출고/반품/조정/상계”의 gold/silver/labor 칼럼은 일부 FE 계산/추정치가 섞일 가능성이 있어, 사용자에게 “카테고리별 변화량이 원장과 1:1로 맞는다”는 보장을 주기 어렵다.
* v3는 DB에서:
    1.  $end\_position - prev\_position$ (SOT 변화량)을 기준으로
    2.  각 카테고리별로 설명 가능한 변화량을 계산하고,
    3.  남는 잔차를 OTHER로 흡수하여
    4.  **카테고리 합 = SOT 변화량**을 항상 만족하도록 만든다.

---

## 2) 목표 (Must) / 비목표 (Won’t)

### Must
* 카테고리별 gold/silver/labor/krw breakdown 합이 항상 end-prev와 일치
* OTHER 포함 → 수학적으로 항상 성립
* 프린트(영수증)와 화면 모두에서 동일한 원장 SOT 수치를 표시
* “최근 하루 결제 합계”는 원장 PAYMENT 기준으로 표시, 리스트는 참고용(전건/Top N 정책 명시)
* “서비스 완불처리(≤₩1,000)”는 **ADJUST(SERVICE_WRITEOFF)**로 분리 표시 (결제에 섞지 않음)
* 기존 v2의 checks 기반 출력 차단 정책은 유지(또는 v3 추가 checks까지 포함)

### Won’t
* mode(store_pickup 등)로 부분출력을 하면서도 원장총합을 맞추기
* FE에서 gold/silver/labor breakdown을 다시 계산해서 맞추기 (DB v3만 신뢰)

---

## 3) 핵심 개념 / 데이터 SOT 규칙

### 3.1 SOT 우선순위
SOT(진실): `cms_fn_shipments_print_ledger_statement_v3` 결과
FE는 아래 값만 믿는다:
* `prev_position`, `end_position`, `day_ledger_totals`
* `day_breakdown` (v3 신규)
* `details.*` (표시/리스트 용)
* `checks` 및 `checks_extra`

### 3.2 “무조건 SOT” 조건
$$day\_breakdown.shipment + return + payment + adjust + offset + other$$
위 식의 gold/silver/labor 각각의 합이 $end\_position - prev\_position$과 항상 일치해야 한다.
v3가 OTHER 잔차로 강제하므로, FE는 합계 계산/보정 금지, 그대로 표시만 한다.

---

## 4) 데이터 계약 (FE 타입 정의)

### 4.1 v3 RPC 호출
* **RPC**: `cms_fn_shipments_print_ledger_statement_v3(p_party_ids uuid[], p_kst_date date)`

### 4.2 v3 응답에 추가되는 필드
* **day\_breakdown (jsonb)**
    * `shipment`: `{ krw, labor_krw, gold_g, silver_g }`
    * `return`:   `{ krw, labor_krw, gold_g, silver_g }`
    * `payment`:  `{ krw, labor_krw, gold_g, silver_g }`
    * `adjust`:   `{ krw, labor_krw, gold_g, silver_g }`
    * `offset`:   `{ krw, labor_krw, gold_g, silver_g }`
    * `other`:    `{ krw, labor_krw, gold_g, silver_g }`  ← 잔차(정정/기타) 반드시 표시 가능
* `delta_end_minus_prev`: `{ labor_krw, gold_g, silver_g }`
* `explained_sum_without_other`: `{ labor_krw, gold_g, silver_g }`
* `checks`에는 기존 v2의 3개 checks + v3 `checks_extra`가 병합되어 내려올 수 있음:
    * `check_breakdown_labor_equals_end_minus_prev`
    * `check_breakdown_gold_equals_end_minus_prev`
    * `check_breakdown_silver_equals_end_minus_prev`
    * 위 3개는 “구조상 0이어야 함”(감사/디버그용)

---

## 5) 화면/영수증 UX 요구사항

### 5.1 미수 요약(3줄 core) — 기존 유지
* **이전 미수** = `prev_position`
* **당일 미수** = `end_position - prev_position`
* **합계** = `end_position`
* 이 3줄은 영수증/화면에 동일하게 노출

### 5.2 “당일 breakdown(카테고리별)” 표 — v3 day\_breakdown으로만 표기
* **표 제목**: 당일 변동 내역(원장 SOT, 카테고리 분해)
* **표 행(고정 순서)**:
    1.  출고 (shipment)
    2.  반품 (return)
    3.  결제 (payment)
    4.  조정 (adjust)
    5.  상계 (offset)
    6.  기타/정정 (other)
* **각 행 컬럼**:
    * 금(g): `gold_g`
    * 은(g): `silver_g`
    * 공임(원): `labor_krw`
    * 금액(원): `krw`
* **표기 규칙(부호/가독성)**
    * 원장 부호를 그대로 보여주는 것이 원칙이지만, 사용자가 헷갈려하면 다음을 적용:
    * 헤더에 문구: (+는 미수 증가, -는 미수 감소)
    * **“기타/정정(other)”는 반드시 강조 표시**:
        * `other.krw != 0` 또는 `other.gold/silver/labor` 중 하나라도 0이 아니면 “기타/정정 발생” 배지 표시
        * 툴팁/각주: 카테고리로 분류되지 않은 변동(정정/경계효과 등)을 포함합니다. 합계는 항상 원장과 일치합니다.

### 5.3 최근 하루 결제(영수증 포함)
* **결제 합계(SOT)**
    * 당일 결제 합계 = `-day_ledger_totals.delta_payment_krw` (항상)
* **결제 건수**:
    * v3 `details.payments` 길이 (있으면)
    * 없으면 ledger PAYMENT count fallback
* **결제 리스트(정책 선택)**
    * **정책 A(권장)**: “전건 출력” (영수증 페이지 길어져도 정합/혼동 0)
    * **정책 B**: “Top N만 출력 + 합계는 전체” (공간 절약)
        * 이 경우 반드시 문구 포함: ※ 아래는 최근 N건만 표시(참고)이며, 합계는 원장 기준 전체 결제 합계입니다.
* **결제 row 표시 금액**:
    * 항상 `-ledger_amount_krw` (원장 반영 효과)
    * `cash_krw`, `alloc_value` 등은 참고(보조 컬럼)로만 표시 가능

### 5.4 서비스 완불처리(≤₩1,000) 표기(영수증 포함)
* **데이터 소스**: `details.adjusts` 중 memo에 `SERVICE_WRITEOFF` 포함
* **섹션 제목**: 서비스 완불처리 (실결제 아님)
* **표시 금액**: `writeoff_total = sum(-adjust.amount_krw)` (양수로 보여주면 이해 쉬움)
* **문구(필수)**: ※ 잔액 소액(≤₩1,000)을 서비스로 차감 처리한 것으로, 현금/실물 수금이 아닙니다.
* **결제 섹션과 절대 합산/혼동 금지**

---

## 6) 기능 요구사항 (Engineering Tasks)

* **Task 1: API route에서 v3로 전환**
    * 파일: `web/src/app/api/shipments-print-ledger-statement/route.ts`
    * 변경: rpc 호출명을 `cms_fn_shipments_print_ledger_statement_v3`로 교체
    * fallback: v3 실패 시 v2 fallback 허용 가능(권장). 단, v2 fallback이면 FE에서 `day_breakdown`은 “미노출” 또는 “v3 필요” 배지
* **Task 2: FE 타입/파싱 업데이트**
    * 파일: `web/src/app/(app)/shipments_print/page.tsx`
    * `LedgerStatementRow` 타입에 `day_breakdown` 추가
    * 런타임 안정성: `day_breakdown`이 없으면(v2 fallback) breakdown 표 숨김
* **Task 3: FE에서 당일 breakdown 표를 “day_breakdown만”으로 렌더링**
    * 기존 FE 계산(금/은/공임 bucket 계산) 로직은 완전히 제거/미사용 처리
    * 표는 party별로 렌더: 당일 변동 내역(출고/반품/결제/조정/상계/기타)
    * 합계 행(선택): 합계 행은 `delta_end_minus_prev`를 표시 또는 “당일 미수(end-prev)” 행과 동일 값임을 명시
* **Task 4: 프린트(ReceiptPrintHalf) props 확장 및 섹션 렌더**
    * 파일: `web/src/components/receipt/receipt-print.tsx`
    * props에 `dayBreakdown`, `printPayments`, `printWriteoffs` 추가
    * 렌더 정책: `dayBreakdown` 표는 첫 페이지에만(중복 방지) 또는 매 페이지 상단(정책 선택). 결제/완불 섹션도 첫 페이지에만(권장)
* **Task 5: 정합성 가드(출력 차단)**
    * 기존 v2 checks 3개는 그대로 유지
    * 추가(선택): v3 `checks_extra` 3개가 0인지도 확인하여 PASS 판단에 포함 (단, 구조상 0이어야 하므로 포함해도 무방)

---

## 7) Acceptance Criteria (테스트 기준)

### A. KRW 정합(기존 유지)
* `checks.check_end_equals_prev_plus_delta_krw === 0`
* `checks.check_ship_lines_equals_ledger_shipment_krw === 0`
* `checks.check_return_sum_equals_ledger_return_krw === 0`

### B. v3 breakdown SOT 정합(무조건)
* `checks.check_breakdown_labor_equals_end_minus_prev === 0`
* `checks.check_breakdown_gold_equals_end_minus_prev === 0`
* `checks.check_breakdown_silver_equals_end_minus_prev === 0`
* **화면에서**: shipment+return+payment+adjust+offset+other 합이 (end-prev)와 동일하게 표시됨

### C. UX 혼동 방지
* **결제 섹션**: 합계는 반드시 `-delta_payment_krw`. 리스트는 전건 또는 Top N 정책에 따라 문구 명시
* **완불 섹션**: 결제와 분리되어 “실결제 아님” 문구 포함. 금액 합산/건수에 결제와 섞이지 않음
* **other(기타/정정)**: 값이 0이 아니면 강조/설명 제공

---

## 8) 구현 시 주의사항(금지 규칙)

* **금/은/공임 카테고리별 분해를 FE에서 재계산 금지** → 무조건 `day_breakdown` 사용
* **결제 금액을 cash_krw 합으로 표시 금지** → 무조건 `ledger_amount_krw` / `delta_payment_krw`
* **완불을 결제에 합산 금지** → ADJUST(SERVICE_WRITEOFF) 별도 섹션