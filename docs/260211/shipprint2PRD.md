# 1) 지금 수정본(60.zip) 정합성 설계/구현 평가 — 냉철 판정

* **✅ 요약(미수 내역)이 “원장 스냅샷 SSOT”로 완벽하게 잡힘**
    * 이전 미수 / 당일 미수 / 합계가 **(end - prev)**로 계산되고, 프론트가 라인 합산으로 미수(total)를 만들지 않음
    * **근거**: `web/src/app/(app)/shipments_print/page.tsx`
    * `buildSummaryRows`가 정확히 3줄 구성 + 당일 = totals - previous (215~227줄)
    * ➡️ 이건 “완벽 정합”의 핵심 축이라서 매우 좋음. (RETURN/ADJUST/OFFSET가 있어도 요약이 흔들리지 않음)

* **✅ 결제 “원장 SOT” 유지 방향이 맞게 바뀜**
    * 화면(no-print) 결제내역은 `ledger_amount_krw` 기반으로 금액 표시(= 원장 반영분)
    * **근거**: `shipments_print/page.tsx` 결제 리스트에서 `amount = -ledger_amount_krw` (182~196줄 구간)
    * ➡️ **“최근 하루 내가 얼마나 결제했나”**를 원장 기준으로 정확히 표시할 토대는 이미 있음.

* **✅ 금/은/기타 중량 변환 로직은 DB에서 정확히 강제됨 (프론트 계산 아님)**
    * 14/18/24 -> 0.6435/0.825/1
    * 925/999 -> 0.925 * silver_adjust_factor / 1 * silver_adjust_factor
    * 기타(00 포함) -> 0
    * **근거**: `supabase/migrations/20260209241000_cms_0391_ar_silver_due_g_weight_factor_and_valuation_ensure.sql`
    * `due_g` 계산 (33~39줄)
    * `material_cash_due_krw`도 동일 `due_g * tick` (49~71줄)
    * `silver_adjust_factor`를 “중량”에 곱하고, “시세(tick)”에는 절대 곱하지 않음이 주석+로직으로 고정(30~47줄)
    * ➡️ 네가 요구한 “원장에 올라가는 방식” 그대로 구현돼 있음.

* **⚠️ 아직 “영수증(PRINT)”에 결제/완불이 빠져있음 (완벽 UX 미충족)**
    * 현재 프린트는 `ReceiptPrintHalf`에 `lines` + `summaryRows`만 넘김
    * **근거**: `shipments_print/page.tsx` 프린트 렌더 (221~235줄 구간)
    * 즉, 사용자가 종이 영수증으로 “오늘 결제 얼마 했지?”를 바로 못 봄
    * ➡️ 정합성은 이미 충분히 좋은데, 사용자 니즈(결제/완불 표시)가 프린트에 반영되지 않은 상태임.

---

# 2) (검증 요청) 소재코드별 원장 반영 로직 확인 결론

**결론: 네가 말한 규칙대로 “원장(invoice/position)”에 들어가도록 DB가 강제하고 있음**

* **금**:
    * 14 → $net\_w \times 0.6435$
    * 18 → $net\_w \times 0.825$
    * 24 → $net\_w \times 1$
* **은**:
    * 925 → $net\_w \times 0.925 \times silver\_adjust\_factor$
    * 999 → $net\_w \times 1.000 \times silver\_adjust\_factor$
* **기타(00 포함)**:
    * 0

✅ 이 로직은 **프론트가 아니라 DB(invoice 생성/valuation 스냅샷)**에서 만들어지므로 “원장 SOT” 측면에서 가장 안전한 형태임.

---

# 3) “최근 하루 결제 + 완불처리(≤₩1,000)”를 원장 SOT 유지하면서 영수증에 완벽 표기하는 실행 계획

### 핵심 원칙(절대 규칙)
1.  **‘결제’ 합계/표시는 entry_type=PAYMENT(원장)만**
    * 합계: `-day_ledger_totals.delta_payment_krw`
    * 리스트 row 금액: `-payment.ledger_amount_krw`
2.  **‘서비스 완불처리’는 결제가 아니라 ADJUST(원장)로 별도 표기**
    * 완불처리는 이미 DB에서 ADJUST ledger로 기록됨(메모에 `SERVICE_WRITEOFF` 포함)
    * 그러므로 영수증에서 “결제” 섹션에 섞으면 사용자 100% 헷갈림 → 무조건 분리
3.  **프린트에 찍히는 숫자는 프론트 추정치 금지**
    * `cash_krw`는 참고용으로만(원장 합계에 포함 금지)
    * “오늘 결제 얼마”는 무조건 ledger sum으로

### 3-A) 구현 스펙(코딩 에이전트용) — 프린트에 2개 섹션 추가

#### 섹션 1) 당일 결제 요약/내역 (원장 기준)
* **표기 목적**: “오늘 내가 결제한 금액(원장 반영)”을 종이에서 즉시 확인
* **제목**: 당일 결제 내역 (원장 반영)
* **상단 1줄 요약(필수)**: 당일 결제 합계: ₩{paymentTotalKrw} · {paymentCount}건
    * `paymentTotalKrw` 정의: `-statement.day_ledger_totals.delta_payment_krw`
* **리스트(권장, 공간 절약)**:
    * 최신순 Top 3만 출력 + 외 N건(전체는 화면에서 확인)
    * 각 row:
        * 시간: `paid_at` || `ledger_occurred_at`
        * 금액(원장반영): `-ledger_amount_krw`
        * (선택) 메모(note/ledger_memo): 너무 길면 생략
* **절대 금지**: `cash_krw` 합을 “결제 합계”로 쓰지 말 것

#### 섹션 2) 서비스 완불처리(≤₩1,000) (실결제 아님)
* **표기 목적**: “잔액 소액은 서비스로 마감했다”를 오해 없이 명확히
* **제목**: 서비스 완불처리 (실결제 아님)
* **대상 레코드(원장)**: `details.adjusts[]` 중에서 `(memo || "").toUpperCase().includes("SERVICE_WRITEOFF")`
* **표기**:
    * 완불처리 금액: ₩{writeoffTotalKrw} (보통 1건)
* **row 표시(최대 2개)**:
    * 시간: `occurred_at`
    * 금액: `-amount_krw` (ADJUST는 보통 음수로 들어가므로 “차감액”을 양수로 보여주면 더 이해 쉬움)
    * 사유: memo에서 `[SERVICE_WRITEOFF]` ... 그대로(짧게)
* **하단 문구(필수)**: ※ 서비스 완불처리는 현금/실물 수금이 아닌, 잔액 소액(≤₩1,000)을 서비스로 차감 처리한 것입니다.
* **절대 금지**: 이걸 “결제” 섹션에 합산하거나 결제 건수에 포함

### 3-B) 실제 코드 변경 지시 (파일/포인트 콕 집어서)

#### (1) Statement 타입 확장 (adjusts/offsets 읽기)
* **파일**: `web/src/app/(app)/shipments_print/page.tsx`
* 현재 `LedgerStatementRow.details`에 `payments?`만 있음 → 아래 필드 추가:

```typescript
adjusts?: Array<{
  ar_ledger_id: string;
  occurred_at: string;
  amount_krw: number;
  memo?: string | null;
  payment_id?: string | null;
}>;
offsets?: Array<{
  ar_ledger_id: string;
  occurred_at: string;
  amount_krw: number;
  memo?: string | null;
}>;
```
(DB v2는 이미 adjusts/offsets를 내려줌)

#### (2) 프린트 페이지 모델에 “결제/완불 프린트 데이터” 추가
`PartyReceiptPage` 타입에 아래 추가:

```typescript
type PrintPaymentRow = { atLabel: string; amountKrw: number; paymentId?: string | null };
type PrintWriteoffRow = { atLabel: string; amountKrw: number; memo?: string | null };

type PartyReceiptPage = {
  ...
  printPayments?: {
    totalKrw: number; // = -delta_payment_krw
    count: number;
    rows: PrintPaymentRow[]; // top3
    extraCount: number;
  };
  printWriteoffs?: {
    totalKrw: number; // = sum(-adjust.amount_krw for SERVICE_WRITEOFF)
    count: number;
    rows: PrintWriteoffRow[]; // top2
    extraCount: number;
  };
  isFirstPageOfParty: boolean; // 중요(중복출력 방지)
};
```

#### (3) pages 생성 시, “첫 페이지에만” 결제/완불 데이터 주입
* `visiblePages` 만들 때(현재 `chunkLines`로 페이지를 나누는 구조 유지):
    * `partyPayments` = `getPartyPayments(group)` 최신순 정렬
    * `paymentTotalKrw` = `-Number(group.statement.day_ledger_totals.delta_payment_krw ?? 0)`
    * `serviceWriteoffs` = `group.statement.details.adjusts?.filter(memo includes SERVICE_WRITEOFF)`
    * `writeoffTotalKrw` = `serviceWriteoffs.reduce((s, a) => s + (-Number(a.amount_krw ?? 0)), 0)`
    * 그리고 `index==0`인 페이지에만 `printPayments`/`printWriteoffs` 넣고 나머지는 `undefined`로.

#### (4) ReceiptPrintHalf props 확장 + 섹션 렌더
* **파일**: `web/src/components/receipt/receipt-print.tsx`
* `ReceiptPrintHalfProps`에 추가:

```typescript
printPayments?: {
  totalKrw: number;
  count: number;
  rows: { atLabel: string; amountKrw: number; paymentId?: string | null }[];
  extraCount: number;
} | null;
printWriteoffs?: {
  totalKrw: number;
  count: number;
  rows: { atLabel: string; amountKrw: number; memo?: string | null }[];
  extraCount: number;
} | null;
```

* **렌더 위치 추천**:
    * “미수 내역(요약)” 바로 아래에 작은 글씨/짧은 테이블로 2개 섹션 추가
    * `printPayments`/`printWriteoffs`가 있을 때만 출력 (첫 페이지 전용)
    * **표기 예시(공간 절약형)**:
        * **결제**:
            * 당일 결제 합계: ₩12,000 · 2건
            * 02/11 14:23 · ₩10,000
            * 02/11 11:02 · ₩2,000
            * ... 외 3건
        * **완불**:
            * 서비스 완불처리: ₩800 (실결제 아님)
            * 02/11 18:01 · ₩800 · [SERVICE_WRITEOFF] ...

#### (5) UI 혼동 방지(강제 문구/라벨)
* `shipments_print/page.tsx`의 카드 라벨:
    * 라인 합계(`amount_krw`) → **출고/반품 라인 합계(amount_krw)**로 변경 추천 (원장 `delta_total`과 혼동 방지)

### 3-C) 완벽 Acceptance Test (자동/수동 체크리스트)

1.  **정합성(이미 구현됨)**
    * `checks` 3개 모두 0 아니면 출력 금지(현재 구조 유지)
2.  **“오늘 결제 얼마” 프린트 정합성(필수)**
    * 프린트에 찍히는 당일 결제 합계는 반드시 `-day_ledger_totals.delta_payment_krw` 와 동일
    * 결제 리스트 row 합은 “Top N만”이므로 total과 다를 수 있음 → 대신 항상 total이 SOT이고, row는 참고용임을 문구로 명시
3.  **완불처리 표기(필수)**
    * `details.adjusts` 중 `SERVICE_WRITEOFF`가 1개라도 있으면 프린트에 서비스 완불처리(실결제 아님) 섹션이 반드시 노출
    * 완불 합계 = `sum(-adjust.amount_krw)` (양수 표시)
    * 결제 합계/건수에 완불을 절대 포함하지 말 것

---

# 4) 완불처리(≤₩1,000)가 원장 SOT를 깨지 않는 이유 + 표시 전략

1.  **DB에서 이미 “완불처리”가 원장에 안전하게 기록됨(현재 ZIP에 존재)**
    * 서비스 완불은 ADJUST ledger로 기록되고 memo에 `[SERVICE_WRITEOFF]`가 박힘 (즉 “수금(PAYMENT)”이 아니라 “조정(ADJUST)”이라는 사실이 원장에 남음)
    * 그래서 `Shipments_print`는 원장만 보고도 완불 여부를 안정적으로 식별 가능
2.  **영수증에서의 혼동 방지 장치(필수)**
    * **결제 섹션**: “원장 반영 결제(PAYMENT)”만
    * **완불 섹션**: “서비스 완불처리(ADJUST)”만
    * 완불 섹션에는 반드시 **실결제 아님** 문구 포함