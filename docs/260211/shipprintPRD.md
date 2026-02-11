# Shipments_print 완벽정합 Acceptance Spec (원장 SSOT, 0원 오차)

## 0) “완벽”의 의미 (Shipments_print에서)
Shipments_print 출력물(특히 미수요약 표 + 라인 합계)이 `cms_ar_ledger` 기준으로 다음을 만족하면 “완벽”이다.

### Core 불변식 (파티별, KST 날짜 D)
* **잔고 정합**: `end_balance_krw = prev_balance_krw + day_delta_total_krw` (RPC v2의 `checks`로 검증)
* **출고 라인 정합**: `sum(출고라인.amount_krw) = day_delta_shipment_krw`
* **반품 라인 정합**: `sum(반품라인.amount_krw) = day_delta_return_krw`

### 미수요약 표(인쇄되는 표)가 위 불변식을 “그대로 표현”해야 함
* 요약표는 **이전/당일/합계** 3줄이 core로 존재하고, 숫자는 아래 정의를 따른다.
    * **이전 미수** = `prev_position` (원장 as-of start)
    * **합계** = `end_position` (원장 as-of end)
    * **당일 미수** = (합계 − 이전) (모든 컬럼: gold/silver/labor/total 동일)
    * 총금액(total KRW) 기준으로는 당연히 `당일 미수.total = day_delta_total_krw`와도 일치해야 함(불변식으로 보장)

---

## 1) 현재 구현 상태 판정 (ZIP 근거)

### A) 라인 금액(출고/반품)과 잔고(total)는 “원장SSOT”로 잘 붙어있음 ✅
* 출고 라인 total을 원장배분 `amount_krw`로 사용: `shipments_print/page.tsx` 499줄
* 반품 라인 total을 원장 `amount_krw`로 사용: `shipments_print/page.tsx` 523줄
* 합계/이전 total이 `end.balance_krw`, `prev.balance_krw`: `shipments_print/page.tsx` 645~656줄
* `checks` 기반 PASS/FAIL + FAIL시 출력차단: `shipments_print/page.tsx` 221~224줄, 1041~1087줄
* API가 v2 RPC 호출: `api/shipments-print-ledger-statement/route.ts` 176~179줄
* ➡️ **“라인 합계/잔고 KRW 정합” 핵심은 거의 합격.**

### B) 그런데 “미수요약 표”는 완벽 기준에서 불합격 가능성이 큼 ❌ (치명)
* 인쇄 요약표가 현재 4줄: 당일결제 / 이전 미수 / 판매 / 합계 (`shipments_print/page.tsx` 214~219줄)
* 반면 인쇄 컴포넌트는 core row로 **‘당일 미수’**를 기대(굵은 선/강조 처리): `receipt-print.tsx` 254~256줄
* ➡️ 지금처럼 “판매/당일결제”가 요약에 들어가면 RETURN/ADJUST/OFFSET 존재 시 `이전 + 판매 - 당일결제 ≠ 합계`가 발생할 수 있고, 요약표가 원장을 “그대로” 표현하지 못한다.

### C) 결제 내역 표시가 ‘원장 효과’와 엇갈릴 수 있음 ❌
* 결제 리스트 금액을 `cash_krw`가 있으면 cash로 표시, 없으면 `-ledger`: `shipments_print/page.tsx` 998~1004줄, 1014~1019줄
* 하지만 원장 PAYMENT는 일반적으로 `-(cash + alloc_value)` 형태일 수 있어, “요약(원장)”은 맞아도 “내역(현금)”은 합계가 안 맞는 상황이 발생 가능.

### D) mode 파라미터는 링크엔 남아있는데 Shipments_print는 무시 ⚠️
* `shipments_main`에서 `mode=all` 링크 생성: `shipments_main/page.tsx` 566줄
* `workbench`에서 `mode=store_pickup` 링크 생성: `workbench/[partyId]/page.tsx` 377~380줄
* Shipments_print API/페이지는 `mode`를 읽지 않음: `api route.ts`는 date/party_id만 사용(163~179줄), `shipments_print/page.tsx`도 mode 없음(366~369줄)
* ➡️ 기능/UX 혼선 위험(정합성과 별개로 “버튼 의미가 달라짐”).

---

## 2) “완벽 구현”을 위한 필수 수정 요구사항 (FE only)

### R1. 인쇄 미수요약 표는 core 3줄로 고정 (완벽의 핵심)
* **현재**: 당일결제/이전/판매/합계 (`page.tsx` 214~219)
* **변경**: 아래 3줄을 반드시 포함하고, 이 3줄만을 core summary로 출력
    1.  **이전 미수** = `page.previous`
    2.  **당일 미수** = (`page.totals` − `page.previous`) (각 컬럼별 차)
    3.  **합계** = `page.totals`
* 라벨은 반드시 **"당일 미수"** 사용 (`receipt-print`가 core row로 인식: `receipt-print.tsx` 254~256)
* 추가 row(판매/당일결제/반품/조정 등)를 넣고 싶다면:
    * 요약표 “미수 내역(요약)”에는 넣지 말고(권장),
    * 넣더라도 core 3줄과 시각적으로 구분(“참고 breakdown”) + KRW만 원장 delta로 표시(gold/silver/labor는 0 또는 숨김)해야 함.

### R2. 결제 내역(리스트) 금액 표시 규칙을 “원장 효과”로 통일
* 각 결제 row의 표시 금액 = `-ledger_amount_krw` (항상)
* `cash_krw`는 “참고 정보(현금)”로 별도 표시 가능
* 결제 리스트 상단 “합계”도 동일 규칙으로 합산해야 함
* **✅ Acceptance**: `sum(결제리스트 표시금액) == -day_ledger_totals.delta_payment_krw` (파티별)

### R3. 요약표에서 gold/silver/labor drift 금지
* “당일 미수”의 gold/silver/labor는 `end-prev` 차이로 계산
* “판매/당일결제”의 gold/silver/labor를 요약표에 넣으면 drift 재발 가능 → 요약표에서는 금지(또는 0 처리)

### R4. mode 파라미터 정리(혼선 제거)
* 둘 중 하나를 선택(완벽정합 기준이면 1이 권장):
    1.  **mode 완전 제거**: `shipments_main`/`workbench` 링크에서 `mode=...` 삭제
    2.  **mode 유지**: Shipments_print가 mode를 읽고 실제 필터링한다면, 그 순간부터 “원장 합계 0원 오차” 목표는 포기하거나, “부분 출력은 원장 총합과 다름”을 UI에 강제 고지해야 함.

---

## 3) Acceptance Test 체크리스트 (코딩에이전트용)

### A. 데이터/수학적 정합 (파티별)
* [ ] [A1] `checks.check_end_equals_prev_plus_delta_krw === 0`
* [ ] [A2] `checks.check_ship_lines_equals_ledger_shipment_krw === 0`
* [ ] [A3] `checks.check_return_sum_equals_ledger_return_krw === 0`
* [ ] [A4] 인쇄 버튼 활성 조건: 모든 파티 A1~A3 PASS (현재 구현 유지 OK)

### B. 인쇄 “미수 내역(요약)” 표 (핵심)
* [ ] [B1] 요약 표에 아래 3줄이 존재하고 라벨이 정확히 일치: **이전 미수**, **당일 미수**, **합계**
* [ ] [B2] 각 줄 값 정의가 정확:
    * 합계.total = `end.balance_krw`
    * 이전.total = `prev.balance_krw`
    * 당일.total = 합계.total - 이전.total
    * 당일.total == `day.delta_total_krw` (검증)
    * gold/silver/labor도 동일하게 `end - prev`
* [ ] [B3] `receipt-print` 강조 규칙 충족: 당일 미수가 core row로 인식되어(굵은 보더) 출력됨 (`receipt-print.tsx` 254~257 기준)

### C. 라인 합계 (출고/반품)
* [ ] [C1] 인쇄되는 출고 라인의 `total_amount_sell_krw`는 항상 `amount_krw`(원장 배분값) (현재 구현: `page.tsx` 499줄 유지)
* [ ] [C2] 반품 라인의 `total_amount_sell_krw`는 항상 원장 `amount_krw` (현재 구현: `page.tsx` 523줄 유지)
* [ ] [C3] 파티별 합:
    * `sum(출고라인 total_amount_sell_krw) == day.delta_shipment_krw`
    * `sum(반품라인 total_amount_sell_krw) == day.delta_return_krw`

### D. 결제 내역(리스트)
* [ ] [D1] 결제 row 표시 금액 = `-ledger_amount_krw` (항상)
* [ ] [D2] 결제 리스트 합계 = `-day.delta_payment_krw` (파티별)
* [ ] [D3] cash가 따로 있으면 “참고”로만(표시/툴팁 등), 합계 계산엔 사용 금지

### E. 회귀/혼선 방지
* [ ] [E1] `shipments_main` “오늘 전체출고 영수증” 버튼이 mode를 붙이지 않거나(권장), 붙인다면 Shipments_print에서 의미 있게 처리(단, 그 경우 완벽정합 목표와 충돌함)
* [ ] [E2] `workbench` “store_pickup 출력”도 동일

---

## 4) 구현 지시(수정 포인트를 파일/라인으로 콕 찝기)

* **수정 1) buildSummaryRows 교체 (필수)**
    * 대상: `web/src/app/(app)/shipments_print/page.tsx` 214~219줄
    * 현재 4줄 요약 → 3줄(core)로 교체
    * 당일 미수는 `page.totals - page.previous`로 계산해서 넣기
* **수정 2) 결제 리스트 금액 계산 교체 (필수)**
    * 대상: `shipments_print/page.tsx` 998~1005, 1014~1019
    * `cash_krw` 우선 로직 제거 → 표시 금액은 항상 `-ledger_amount_krw`
* **수정 3) mode 링크 정리 (권장)**
    * 대상:
        * `shipments_main/page.tsx` 566줄
        * `workbench/[partyId]/page.tsx` 377~380줄
    * `mode` 제거(권장) 또는 명확한 UX 문구/기능 구현(비권장)
```