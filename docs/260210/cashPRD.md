# [CODING AGENT PROMPT] AR 결제(금/은) “정밀 잔액 표시 + 저울 2자리 추천 + 현금차액/완불처리(≤₩1,000)” UI 완성

## 0) 목표 (왜 하는지)
AR 화면에서 금/은 잔액은 3자리(또는 6자리)로 보이는데, 직원 입력은 저울이 2자리(0.01g) 까지라서
예: 정밀 잔액 0.059600g 인데 직원이 0.06g 입력 → exceed 에러가 나고,
결국 0.05g + 현금차액으로 받거나, 소액은 서비스로 완불 처리해야 함.

그래서 AR 결제 화면에 아래를 동시에 명확히 보여줘서 실수를 없앤다:
* **정산 기준(정밀)**: 금/은 잔액을 3~6자리까지 표시
* **저울 입력 추천(2자리)**: “2자리 금/은 g + (남는 금액에 해당하는) 현금차액” 자동 계산
* **실시간 계산**: 직원이 g를 입력하면 남는 g / 현금차액이 실시간 계산되어 보이게
* **서비스 완불처리(버튼)**: 현금차액이 ₩1,000 이하면 버튼으로 마감 가능하게

---

## 1) 사용해야 하는 백엔드 RPC (이미 DB에 있음)
프론트는 아래 두 RPC만 호출하면 됨.

### (1) 정산 추천/정밀 잔액
* **함수**: `cms_fn_ar_get_settlement_recommendation_v1(p_party_id uuid, p_scale_decimals int default 2) returns jsonb`
* **호출 파라미터**:
    * `p_party_id`
    * `p_scale_decimals = 2` (저울 입력 기준 2자리 추천)
* **반환 JSON 구조(핵심만)**:
```json
{
  "ok": true,
  "as_of": "string",
  "scale_decimals": number,
  "totals": {
    "labor_cash_outstanding_krw": number,
    "material_cash_outstanding_krw": number,
    "total_cash_outstanding_krw": number
  },
  "gold": {
    "outstanding_g": number,            // 6자리까지
    "outstanding_value_krw": number,    // outstanding_g * price 합
    "scale_g": number,                  // trunc(outstanding_g, 2)
    "scale_value_krw": number,          // scale_g를 FIFO로 태운 "가치"
    "tail_g": number,
    "tail_value_krw": number
  },
  "silver": { "...same..." }
}
```

### (2) 서비스 완불처리(잔액 ≤ ₩1,000)
* **함수**: `cms_fn_ar_apply_service_writeoff_under_limit_v1(...) returns jsonb`
* **프론트에서 쓸 파라미터**:
    * `p_party_id`
    * `p_idempotency_key` (uuid string)
    * `p_limit_krw = 1000`
    * `p_occurred_at` (optional: paidAt 같은 값)
    * `p_reason_detail` (optional)
* **동작**: 현재 남아있는 미수(현금 등가) 잔액이 1,000원 이하일 때만 내부 로그를 남기고 0으로 정리.

---

## 2) 수정 파일
* `web/src/app/(app)/ar/page.tsx` (주 수정)
* `web/src/lib/contracts.ts` (함수 이름 2개만 add-only로 추가)

---

## 3) contracts.ts에 함수명 추가 (ADD-ONLY)
`web/src/lib/contracts.ts`의 `functions:`에 아래 2개 키를 “추가”해. (기존 키 변경 금지)

```ts
arGetSettlementRecommendation:
  process.env.NEXT_PUBLIC_CMS_FN_AR_GET_SETTLEMENT_RECOMMENDATION ||
  "cms_fn_ar_get_settlement_recommendation_v1",
arApplyServiceWriteoffUnderLimit:
  process.env.NEXT_PUBLIC_CMS_FN_AR_APPLY_SERVICE_WRITEOFF_UNDER_LIMIT ||
  "cms_fn_ar_apply_service_writeoff_under_limit_v1",
```

---

## 4) ar/page.tsx — 데이터 fetch 추가

### 4-1) 타입 추가
`SettlementRecommendation` 타입을 `page.tsx` 상단 types 섹션에 추가.

### 4-2) useQuery로 추천 데이터 가져오기
`effectiveSelectedPartyId`가 있을 때 아래 쿼리를 추가:
* **queryKey**: `["cms", "ar_settlement_reco", effectiveSelectedPartyId]`
* **queryFn**: `callRpc<SettlementRecommendation>(CONTRACTS.functions.arGetSettlementRecommendation, { p_party_id: effectiveSelectedPartyId, p_scale_decimals: 2 })`
* **enabled**: `Boolean(effectiveSelectedPartyId) && isFnConfigured(CONTRACTS.functions.arGetSettlementRecommendation)`

그리고 아래 액션 성공 시 refetch 목록에 `settlementRecoQuery.refetch()` 추가:
* 수금(paymentMutation / paymentAdvancedMutation)
* 반품(returnMutation)
* OFFSET(offsetMutation)
* 조정(adjustDownMutation / adjustUpMutation)

---

## 5) 핵심 UI/UX 변경

### 5-1) “수금 등록” 탭(payment) 폼에 “정산 가이드” 박스 추가
`actionTab === "payment"` 폼 안에서, 금/은 입력칸 바로 아래(혹은 입력칸 옆) Card/Panel을 하나 더 만든다.

**표시 내용(반드시 2줄 구조 유지):**

**(A) 정산 기준(정밀)**
* 금/은 각각 `gold.outstanding_g`, `silver.outstanding_g`를 최대 6자리로 표시 (예: 1.456g, 0.0596g)
* **UI 텍스트 예**: `정산 기준(정밀): 금 1.456g / 은 0.000g`

**(B) 저울 입력 추천(2자리 + 현금차액)**
* 금/은 각각 `gold.scale_g` (2자리 trunc) 및 `gold.tail_value_krw` (현금차액) 표시
* **예**: `저울 입력 추천: 금 1.45g + 현금차액 ₩2,400`
* 그리고 “총 현금 추천(공임+잔여소재)”도 같이 보여줘:
  `cash_total_recommended = max(0, totals.total_cash_outstanding_krw - gold.scale_value_krw - silver.scale_value_krw)`
* **예**: `총 현금 추천(공임+잔여소재): ₩32,400`

**(C) 추천값 적용 버튼(작지만 확실하게)**
* **버튼 1: “추천 g 적용”**
  * `paymentGoldG = gold.scale_g` (toFixed(2) 형태로 문자열 세팅)
  * `paymentSilverG = silver.scale_g`
* **버튼 2: “추천 완납 적용”**
  * 위 g 적용 + `paymentCashKrw = cash_total_recommended` (콤마 포맷)
  * 그리고 `allowCashForMaterial` 자동 ON (중요: cash로 tail을 커버하려면 소재현금허용 필요)

**(D) 실시간 “남는 g / 현금차액”**
* 직원이 `paymentGoldG` / `paymentSilverG` 입력할 때마다 즉시 계산 표시:
  * **남는 g**: `max(0, outstanding_g - input_g)`
  * **현금차액**: “지금 입력한 g로 커버하지 못하는 소재 가치”
* 정확도 중요: 프론트에서 FIFO 계산으로 현금차액을 정확히 산출해.
* `invoicePositionsQuery.data`는 이미 FIFO 정렬을 따르므로, 아래 함수를 프론트에 구현하여 사용:

```ts
function fifoValueForCommodity(rows: ArInvoicePositionRow[], type: "gold"|"silver", gQty: number) {
  let remain = Math.max(0, round6(gQty));
  let value = 0;
  for (const r of rows) {
    if (r.commodity_type !== type) continue;
    const outG = Number(r.commodity_outstanding_g ?? 0);
    const price = Number(r.commodity_price_snapshot_krw_per_g ?? 0);
    if (outG <= 0 || price <= 0) continue;
    if (remain <= 0) break;
    const alloc = Math.min(remain, outG);
    value += alloc * price;
    remain = round6(remain - alloc);
  }
  return Math.round(value);
}
// round6(n): 소수 오차 방지용으로 Math.round(n * 1e6) / 1e6
```

**(E) 1,000원 이하이면 “서비스 완불처리 가능” 안내**
* `estimatedTailKrw`(금/은 합 또는 현재 입력 기준 잔여 현금차액)이 `<= 1000`이면:
  * `현금차액(서비스)로 완불처리 가능(≤₩1,000)` 텍스트를 초록/중립 톤으로 표시
  * “완불처리 탭으로 이동” 버튼 제공(클릭 시 `actionTab`을 `writeoff`로)
* **주의**: 실제 writeoff RPC는 “현재 남은 잔액” 기준이므로, 안내문에는 “수금 등록 후 잔액이 1,000원 이하로 남으면 완불처리 가능” 같이 오해 없게 문구를 넣어라.

---

## 6) Exceed 실수 방지(필수)
현재 페이지는 cash 초과만 프리체크하고, gold/silver 초과는 서버에서만 터져서 직원이 계속 낚임.

### 6-1) gold/silver 입력 상한 안내 + 제출 차단
`settlementRecoQuery` 기준:
* `goldMaxInput = gold.outstanding_g` (정밀 잔액 상한)
* `silverMaxInput = silver.outstanding_g`
* 만약 `paymentGoldG > goldMaxInput + epsilon` 이면:
    * 금 입력칸 아래에 빨간 문구: `입력값이 정밀 잔액을 초과합니다. 추천값(금 {gold.scale_g}g)을 사용하세요.`
    * `canSubmitPayment`를 `false`로 만들고 submit 시 toast로도 막아라.
    * silver도 동일.

---

## 7) “완불처리”는 수금등록과 분리된 탭으로 추가
요구사항: “수금등록 말고 완불처리 칸”

### 7-1) actionTab에 새 탭 추가
* `actionTab` union에 `"service_writeoff"` 추가
* 액션 버튼 그리드에 버튼 추가:
    * 라벨: `완불처리(≤₩1,000)`
    * 아이콘: `lucide CheckCircle` 같은 걸 추가해도 됨(없으면 Check 재사용 OK)

### 7-2) 완불처리 탭 UI
* **표시**: 현재 남은 잔액(현금 등가): ₩X
* **조건**: X <= 1000일 때만 버튼 활성화
* **입력**: 메모(optional): `reason_detail`
* **버튼**: `서비스 완불처리 실행`
* **실행 시**: `useRpcMutation`로 `CONTRACTS.functions.arApplyServiceWriteoffUnderLimit` 호출
    * **params**:
        * `p_party_id`: `effectiveSelectedPartyId`
        * `p_idempotency_key`: `writeoffIdempotencyKey`
        * `p_limit_krw`: 1000
        * `p_occurred_at`: `new Date().toISOString()` 또는 `paidAt` 기반
        * `p_reason_detail`: `writeoffReason || null`
* **성공 후**:
    * `positionsQuery` / `ledgerQuery` / `invoicePositionsQuery` / `paymentAllocQuery` / `settlementRecoQuery` 모두 refetch
    * `idempotency_key` reset(새 uuid), reason 초기화
* **UX 팁**: 잔액이 1000원 초과면 “완불처리는 잔액이 1,000원 이하일 때만 가능합니다.”를 명확히 표시.

---

## 8) 완료 기준(acceptance criteria)
1. 정밀 잔액(금/은)을 3~6자리로 명확히 표시한다.
2. “저울 입력 추천”이 2자리 g + 현금차액으로 자동 계산되어 보인다.
3. 직원이 g 입력하면 “남는 g / 현금차액”이 실시간으로 갱신된다(FIFO 기반 계산).
4. 0.0596g 같은 케이스에서 직원이 0.06g 입력하면 제출 전에 UI에서 초과 경고 + 제출 차단된다.
5. “완불처리(≤₩1,000)” 탭에서 잔액이 1,000원 이하일 때만 버튼이 활성화되고, 실행 시 로그/정리가 되며 화면이 즉시 0이 된다.
6. 기존 수금/반품/OFFSET/조정 기능은 절대 깨지지 않는다.

---

## 9) 구현 유의사항(중요)
* 숫자 파싱은 기존 방식 유지(콤마 제거 후 Number).
* g 계산은 반드시 `round6`로 오차 억제.
* **포맷**: g는 기존 `formatGram()`은 3자리까지라서, “정밀” 표시용으로 `formatGramPrecise(value, maxDigits=6)` 헬퍼를 추가해 사용.
* 추천 완납 적용 시에는 `allowCashForMaterial = true`로 자동 세팅(안 하면 직원이 또 막힘).