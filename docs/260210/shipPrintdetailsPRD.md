# PRD: Shipments_print “원장(cms_ar_ledger) 완벽정합(0원 오차)” 프론트엔드 전면 교체 (DB v2 Statement RPC 단일소스)

## 문서 목적
이미 DB에 push 완료된 `cms_fn_shipments_print_ledger_statement_v2`를 Shipments_print가 단일 진실(SSOT)로 사용하도록 프론트엔드를 전면 교체한다.
목표는 원장 기준 ‘완벽’: 합계/이전/당일 및 출고/반품 라인 합계가 항상 원장과 0원 오차.

---

## 1) 배경 / 현상
Shipments_print는 현재 프론트에서 shipment/return/payment/position을 여러 쿼리로 조합하며, 일부 total을 원장으로 덮어쓰기하여 겉보기 정합만 맞춘다. 이 구조는:
* 라인 합계 ↔ 요약 total 불일치
* 날짜 기준(ship_date vs confirmed_at vs occurred_at) 불일치
* PAYMENT 원장정의(cash+alloc_value) vs 화면 breakdown 불일치
를 구조적으로 만들 수 있다.

**해결 원칙**: Shipments_print는 이제부터 오직 DB RPC(v2) 결과만을 렌더링한다. (조합/역산/덮어쓰기 금지)

---

## 2) 목표 (Must) / 비목표 (Won’t)
### Must (완벽 기준)
* 파티별 합계/이전/당일 total(KRW) = 원장과 0원 오차
* 파티별 출고 라인 합계 = 원장 SHIPMENT 합계 0원 오차
* 파티별 반품 라인 합계 = 원장 RETURN 합계 0원 오차
* 프론트는 원장 외 테이블을 조합해서 금액을 만들지 않는다
* DB의 `amount_krw`를 그대로 출력/합산
* FE는 RPC가 제공하는 `checks`를 기반으로 PASS/FAIL 검증 UI를 제공하고, FAIL 시 출력 차단(선택)까지 한다.

### Won’t
* store_pickup/all/기타 모드로 “부분 출력”하면서도 원장 총합과 맞추기 → 부분 필터링은 완벽 정합과 양립 불가. (총합이 변함)
* 프론트에서 금/은/공임을 “카테고리별 당일”로 다시 계산해 맞추기 → drift 위험. (필요하면 DB에서 델타를 제공해야 함)

---

## 3) 핵심 정의 (완벽 정합의 기준)
KST 날짜 D에 대해 party_id별로 아래가 항상 성립해야 한다.

### 잔고 불변식
* `end_balance_krw = prev_balance_krw + day_delta_total_krw`
* `day_delta_total_krw = sum(cms_ar_ledger.amount_krw where occurred_at in KST D)`

### 출고/반품 라인 불변식
* `sum(details.shipments[].lines[].amount_krw) = day_delta_shipment_krw`
* `sum(details.returns[].amount_krw) = day_delta_return_krw`

위 3개 diff는 RPC 결과의 `checks`에 제공됨:
* `checks.check_end_equals_prev_plus_delta_krw`
* `checks.check_ship_lines_equals_ledger_shipment_krw`
* `checks.check_return_sum_equals_ledger_return_krw`
→ 모두 0이면 PASS

---

## 4) 시스템/데이터 계약
### 사용 DB RPC (이미 push 완료)
`public.cms_fn_shipments_print_ledger_statement_v2(p_party_ids uuid[], p_kst_date date)`

### FE가 신뢰해야 하는 필드 (SSOT)
* `prev_position.balance_krw` (원장 누적합, clamp 없음)
* `end_position.balance_krw`
* `day_ledger_totals.delta_total_krw / delta_shipment_krw / delta_return_krw / ...`
* `details.shipments[].lines[].amount_krw` (원장 SHIPMENT 금액 배분된 라인 금액)
* `details.returns[].amount_krw` (원장 RETURN 금액)
* `checks.*` (PASS/FAIL 기준)

### FE가 “참고로만” 쓰는 필드 (표시용)
* customer_name, ship_date, confirmed_at, model_name, material_code, net_weight_g 등

---

## 5) UX 요구사항
### 5.1 화면 상태
* 로딩 / 에러 / 결과 없음 상태를 명확히 표시

### 5.2 PASS/FAIL 배지 (Must)
* 페이지 상단에 “원장 정합” 배지:
    * **PASS(초록)**: checks 3개 모두 0
    * **FAIL(빨강)**: checks 중 하나라도 0이 아님

### 5.3 FAIL 처리 (Must)
* FAIL 시:
    * 상단에 diff 상세(3개 diff) 노출
    * (권장) Print 버튼 비활성화
    * Debug Panel(접기/펼치기)에서 party별:
        * diff 값
        * 관련 ledger_occurred_at / shipment_id / ar_ledger_id 목록(있으면)

---

## 6) 기능 요구사항 (FE 구현)
### 6.1 파일/컴포넌트 범위
* 대상: `web/src/app/(app)/shipments_print/page.tsx` (주요)
* 관련: receipt-print 컴포넌트(있다면)에는 “금액 계산 로직”이 남아있지 않도록 검토

### 6.2 기존 로직 제거(필수)
page.tsx에서 아래 데이터 소스/조합을 제거하거나 완전히 미사용 처리:
* `cms_shipment_header` 기반 `shipmentsQuery`
* `cms_return_line` 기반 `returnsQuery`
* `cms_v_ar_position_by_party_v2`, `cms_fn_ar_position_asof_v1` 직접 조회
* `cms_ar_ledger` 당일 집계 쿼리
* `cms_v_ar_payment_alloc_detail_v1` 직접 조회
* “ledger로 total 덮어쓰기” 로직
* store_pickup/all 모드가 출력에 영향을 주는 필터링(제거 또는 출력에는 미적용)

**원칙**: 금액 계산은 절대 FE에서 만들지 말고, RPC의 amount_krw/balance_krw만 사용.

---

## 7) FE 데이터 흐름 (새 구현 설계)
### 7.1 입력
* 선택 날짜: today (KST) = YYYY-MM-DD
* optional 필터: party_id (특정 거래처만)

### 7.2 Query 전략
* **A) party_id 필터가 있으면**
    * RPC를 `p_party_ids=[party_id]`로 바로 호출
* **B) party_id 필터가 없으면 (권장)**
    * 먼저 당일 KST 범위에서 ledger에 등장한 party_id 목록을 최소 조회
    * `select party_id from cms_ar_ledger where occurred_at >= start and < end`
    * 그 party_id 배열을 RPC에 전달
    * 목적: “전체 party” 호출로 인한 과부하 방지

### 7.3 RPC 호출
`rpc('cms_fn_shipments_print_ledger_statement_v2', { p_party_ids, p_kst_date: today })`

### 7.4 page rendering 모델
RPC row(=party statement)를 PartyGroup으로 변환:
* partyId, partyName
* statement (row 그대로)
* lines (출고+반품 라인 merge)

#### 출고 라인 생성 규칙 (Must)
* `details.shipments[].lines[]`를 1:1로 ReceiptLine으로 변환
* 라인 금액은 반드시 `line.amount_krw` → `total_amount_sell_krw`로 매핑
* 절대 `raw_amount_krw`를 합산/출력 total에 사용하지 않음

#### 반품 라인 생성 규칙 (Must)
* `details.returns[]`를 ReceiptLine으로 변환
* `total_amount_sell_krw = return.amount_krw` (원장 금액)
* 필요 시 labor/material 표시를 위해 기존 비율 분해를 사용할 수 있으나:
    * 총액 total은 원장 `amount_krw`를 절대 변경하지 않음

#### 요약(summary) 생성 규칙 (Must)
* 요약은 최소 3줄만 완전정합 보장:
    * 합계(total) = `end_position.balance_krw`
    * 이전(total) = `prev_position.balance_krw`
    * 당일(total) = `day_ledger_totals.delta_total_krw`
* 금/은/공임도 drift 없이 가려면:
    * 합계/이전은 각각 end/prev의 outstanding을 사용
    * 당일은 end - prev로 계산
        * `gold_today = end.gold - prev.gold`
        * `silver_today = end.silver - prev.silver`
        * `labor_today = end.labor - prev.labor`
* 카테고리별(출고/반품/결제/조정) gold/silver/labor는 FE 계산 금지(필요하면 DB 확장).

---

## 8) 검증 로직 (Must)
### 8.1 party별 PASS/FAIL
party row마다:
* `checks.check_end_equals_prev_plus_delta_krw === 0`
* `checks.check_ship_lines_equals_ledger_shipment_krw === 0`
* `checks.check_return_sum_equals_ledger_return_krw === 0`

### 8.2 페이지 전체 PASS/FAIL
* 모든 party가 PASS면 페이지 PASS
* 하나라도 FAIL이면 페이지 FAIL

### 8.3 FAIL 시 동작
* 상단 배지 FAIL
* diff 테이블 노출(3개 checks 값)
* (권장) 인쇄 버튼 disabled

---

## 9) API / 타입 정의 (코딩 에이전트 참고)
FE에서 사용할 타입(대략):

```typescript
type LedgerStatementRow = {
  party_id: string;
  party_name: string;
  kst_date: string;
  kst_day_start: string;
  kst_day_end: string;
  prev_position: {
    balance_krw: number;
    receivable_krw: number;
    credit_krw: number;
    labor_cash_outstanding_krw: number;
    gold_outstanding_g: number;
    silver_outstanding_g: number;
  };
  day_ledger_totals: {
    delta_total_krw: number;
    delta_shipment_krw: number;
    delta_return_krw: number;
    delta_payment_krw: number;
    delta_adjust_krw: number;
    delta_offset_krw: number;
  };
  end_position: {
    balance_krw: number;
    receivable_krw: number;
    credit_krw: number;
    labor_cash_outstanding_krw: number;
    gold_outstanding_g: number;
    silver_outstanding_g: number;
  };
  details: {
    shipments: Array<{
      ar_ledger_id: string;
      shipment_id: string;
      ledger_occurred_at: string;
      ledger_amount_krw: number;
      customer_name?: string | null;
      ship_date?: string | null;
      confirmed_at?: string | null;
      is_store_pickup?: boolean | null;
      lines: Array<{
        shipment_line_id?: string | null;
        model_name?: string | null;
        qty?: number | null;
        material_code?: string | null;
        net_weight_g?: number | null;
        color?: string | null;
        size?: string | null;
        raw_amount_krw?: number;
        amount_krw: number; // MUST
        synthetic?: boolean;
      }>;
    }>;
    returns: Array<{
      ar_ledger_id: string;
      return_line_id: string;
      ledger_occurred_at: string;
      amount_krw: number; // MUST (ledger)
      return_qty?: number | null;
      model_name?: string | null;
      material_code?: string | null;
      net_weight_g?: number | null;
      color?: string | null;
      size?: string | null;
      qty?: number | null;
      total_amount_sell_krw?: number | null; // display only
      labor_total_sell_krw?: number | null;
      material_amount_sell_krw?: number | null;
    }>;
    payments: any[];
    adjusts: any[];
    offsets: any[];
  };
  checks: {
    check_end_equals_prev_plus_delta_krw: number;
    check_ship_lines_equals_ledger_shipment_krw: number;
    check_return_sum_equals_ledger_return_krw: number;
  };
};
```

---

## 10) 구현 작업 목록 (Engineering Tasks)
* **Task A: page.tsx 데이터 소스 교체 (필수)**
    * 기존 useQuery 전부 제거/미사용 처리
    * party_id 없을 때 ledger 당일 party_id 목록 최소 조회 추가
    * RPC 호출 추가 및 결과 타입 선언
    * partyGroups 생성(파티별 statement + 라인 merge)
    * receiptPages 생성: 합계/이전/당일은 balance_krw/delta_total_krw 기반, 라인은 shipments/returns의 amount_krw 기반
* **Task B: PASS/FAIL UI + 출력 차단 (필수)**
    * 상단 “원장 정합 PASS/FAIL” 배지
    * FAIL 시 diff 테이블(3 checks) 표시
    * FAIL 시 Print 버튼 disable (권장)
* **Task C: 모드(store_pickup/all) 처리 정리 (필수)**
    * 출력에 영향을 주는 mode 로직 제거
    * 남기려면 “출력에는 미적용”으로 격리(관리 UI로만)
* **Task D: 디버그 도구 (권장)**
    * party별 diff 및 관련 shipment_id/ar_ledger_id 리스트 표시(접기/펼치기)

---

## 11) 테스트 / 검증 (Acceptance Tests)
* **기본**
    * 임의 party_id, 임의 날짜에서 checks 3개가 모두 0이면 PASS
    * totals/previous/today total이 원장 기준으로 일치
* **ship_date와 confirmed_at이 다른 출고 케이스에서:**
    * 기존 대비 화면 라인/요약이 drift 없이 원장과 일치
* **shipment_line 누락 케이스(합성 라인 synthetic=true):**
    * 라인 합계는 여전히 원장과 0원 오차
    * FAIL이 아닌 PASS가 유지(원장 기준이므로)
* **회귀**
    * 성능: 당일 party 200개 이상에서도 페이지 렌더링이 허용 범위

---

## 12) 릴리즈 / 운영
* Feature flag 권장: `shipments_print_use_ledger_statement_v2`
* **초기 1~3일:**
    * FAIL 발생 시 로그(파티/날짜/diff) 수집
    * payment diff(ledger_vs_expected) 등 진단 확인(표시만, 정합 기준은 total/ship/return 3개)

---

## 13) “완벽 구현”을 위한 주의사항 (핵심 금지 규칙)
* ✅ 금액(total/line amount)은 오직 RPC의 `balance_krw` / `amount_krw`만 사용
* ❌ FE에서 `ship_date`, `confirmed_at`, `paid_at`로 당일 범위를 재정의하지 말 것
* ❌ FE에서 원장 total을 “보정/덮어쓰기”하지 말 것 (이미 RPC가 정답)
* ❌ 부분 필터링으로 “출고만 따로” 출력하지 말 것 (완벽 정합 깨짐)