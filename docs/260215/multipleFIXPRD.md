# ✅ Coding Agent Prompt (고도화 MD)
## “즉시완불”을 공장별 설정(거래처/Settings) 으로 승격 + 영수증/주문 안정성 패치 (Front-only, DB/RPC 무수정)

**목표**: 실수로 영수증에서 즉시완불을 켜는 사고를 원천 차단하고, 즉시완불은 공장(거래처) 단위로만 관리되게 변경한다. 동시에, 이미 구현된 “주문 수량 분해 / 라인 복사×N”을 운영 안전하게 만들기 위한 필수 버그/무결성 패치를 포함한다.

---

### 0) 현재 코드 베이스 (이미 반영된 상태)
* **주문 /orders**: qty > 1 입력 시 프론트에서 qty=1 라인 N개 분해 생성 + 복사 / 복사×N 구현됨.
* **공장 영수증 /new_receipt_line_workbench**: 라인 복사 / 복사×N 구현됨.
* **“즉시완불(미수 없음)”**이 영수증(=receipt) 단위 체크박스로 존재하며, 확정+완불 시 `apPayAndFifo` 자동 호출 구현됨.
* **문제**: 즉시완불이 영수증 화면에 있으면 잘못 눌러서 자동 결제 등록되는 리스크가 큼.

### 1) 변경 방향 (핵심 결정)
* ✅ **즉시완불은 “공장별 설정”으로만**: 몇몇 공장만 즉시완불 대상으로 지정. 영수증 화면에서 토글로 켜는 방식 금지(실수 리스크 큼).
* **결과적으로**:
    * 공장 영수증 라인 단가/중량/공임 등은 기존처럼 모두 기록(마진 분석/원가 분석 목적).
    * AP는 “원래처럼 쌓되”, 즉시완불 공장은 확정 시 자동 결제로 0 맞춤(AP에 invoice+payment 기록이 남음).

### 2) Non-goals (절대 하지 말 것)
* ❌ Supabase DB schema 변경 금지
* ❌ RPC 함수 수정/추가 금지
* ✅ 단, Next.js API route(`web/app/api`) 는 수정 가능(“DB 변경” 아님)

### 3) 구현 항목 요약 (P0/P1)
#### P0 (필수)
* **공장(거래처) 등록/수정 화면**: “즉시완불 공장” 설정 추가 (강조 + 확인 모달)
* **영수증 워크벤치**:
    * 즉시완불 토글 제거(Receipt 단위 X)
    * 선택된 공장이 즉시완불 공장이면 확정 버튼이 자동결제 포함으로 동작
    * 확정 시 자동결제 경고 모달(1회 확인) 추가
* **영수증 라인 qty 무결성**: UI는 1로 고정인데, 상태/저장에 1이 아닌 값이 섞일 수 있음 → state/hydrate/save/totals 전부 qty=1 강제
* **주문 qty 음수/0 입력 방지**: qty >= 1 강제(현재 -1이 통과 가능)

#### P1 (권장)
* `/api/vendors` 응답에 즉시완불 플래그 포함(또는 note 포함)하여 워크벤치에서 빠르게 판별
* Party 저장 성공 시 `queryClient.invalidateQueries(["vendor-parties"])` (가능한 범위에서)

---

### 4) 데이터 저장 방식 (DB 변경 없이 “공장별 설정” 영구 저장)
✅ **방법**: `cms_party.note`에 시스템 태그로 저장 (사용자에게는 숨김)
공장별 설정을 DB에 저장하려면 DB 컬럼이 필요하지만 “DB 변경 금지”이므로, 기존 note(memo) 컬럼에 시스템 태그를 넣는다. 단, 사용자 “메모” 입력칸에는 태그가 보이면 거슬리므로:
* 화면에 보여줄 때는 태그 제거(strip)
* 저장할 때는 태그를 다시 합성(compose)

#### Tag 스펙 (고정)
`VENDOR_IMMEDIATE_SETTLE_TAG = "[SYS:VENDOR_IMMEDIATE_SETTLE]"`

#### Helper 함수 제공(공용)
* `hasVendorImmediateSettleTag(note?: string | null): boolean`
* `stripVendorImmediateSettleTag(note?: string | null): string`
* `applyVendorImmediateSettleTag(note: string, enabled: boolean): string`
* 파일: `web/src/lib/vendor-immediate-settle.ts` (server/client 공용, pure 함수만)

---

### 5) 파일별 구체 작업 지시

#### A) 공장(거래처) 설정 UI 추가 (강조 + 실수 방지)
**A1. 타입 확장**
* 파일: `web/src/components/party/types.ts`
* `PartyForm`에 아래 필드 추가: `vendor_immediate_settle?: boolean; // vendor only`

**A2. 거래처 페이지 form.reset 시 note 파싱 + toggle 값 세팅**
* 파일: `web/src/app/(app)/party/page.tsx`
* 변경 포인트: `detailData` 기반 `form.reset({...})` 하는 곳에서:
    * vendor일 때:
        * `vendor_immediate_settle = hasVendorImmediateSettleTag(detailData.note)`
        * `note = stripVendorImmediateSettleTag(detailData.note)`
    * customer일 때: `vendor_immediate_settle = false`
    * “new 거래처” 기본값에도 `vendor_immediate_settle: false` 포함.

**A3. 저장(onSubmit) 시 memo 합성**
* 파일: `web/src/app/(app)/party/page.tsx`
* 현재: `p_memo: values.note || null`
* 변경:
```ts
const cleanNote = values.note ?? "";
const enabled = Boolean(values.vendor_immediate_settle);
const memo = applyVendorImmediateSettleTag(cleanNote, enabled);
p_memo: memo || null
```

**A4. UI: BasicInfoTab에 “즉시완불 공장” 설정 추가 (강조)**
* 파일: `web/src/components/party/tabs/BasicInfoTab.tsx`
* **UI 요구사항**:
    * `party_type === "vendor"`일 때만 표시
    * 빨간 테두리/경고 문구로 눈에 띄게 (실수 방지)
    * 체크박스(또는 라디오) + 설명:
        * 라벨: 즉시완불 공장 (확정 시 AP 결제가 자동 등록됨)
        * 서브텍스트(필수): ⚠️ 이 설정은 모든 영수증에 적용됩니다. 잘못 켜면 자동 결제가 기록됩니다.
    * ON으로 바꾸는 순간 **확인 모달**을 띄워서 의도 확인:
        * 제목: 즉시완불 공장 설정
        * 내용: “이 공장은 영수증 확정 시 AP 결제가 자동 등록됩니다.”
        * 버튼: 취소 / 확인
        * (권장) 확인 버튼 누르기 전 즉시완불 텍스트 입력을 요구하면 더 안전
    * **form 연동**: `form.setValue("vendor_immediate_settle", true/false)`로 저장

#### B) /api/vendors 응답 확장 (즉시완불 판별용)
**B1. API에서 note 포함 또는 플래그 포함**
* 파일: `web/src/app/api/vendors/route.ts`
* 현재 select: `.select("party_id,name,party_type")`
* 변경: `.select("party_id,name,party_type,note")`
* 그리고 응답 row에 아래 필드 추가(권장): `immediate_settle_vendor: boolean`
* 예:
```ts
const rows = (data ?? []).map(v => ({
  ...v,
  immediate_settle_vendor: hasVendorImmediateSettleTag(v.note),
}));
return NextResponse.json({ data: rows, prefixes: prefixes ?? [] });
```
* 여기서 `hasVendorImmediateSettleTag`를 route에서 import 가능하게 util을 pure TS로 만들 것.

#### C) 영수증 워크벤치: “즉시완불은 공장별 자동”으로 변경
**C1. 즉시완불 상태의 소스 변경**
* 파일: `web/src/app/(app)/new_receipt_line_workbench/receipt-line-workbench.tsx`
* **제거할 state**: `immediateSettleByReceipt`, `setImmediateSettleByReceipt`
* `immediateSettleEnabled = selectedReceiptId ? immediateSettleByReceipt[selectedReceiptId] : false`
* **새 구현**:
    * `vendorOptionsQuery`에서 `/api/vendors`의 `immediate_settle_vendor`를 함께 받도록 타입 확장: `type VendorOption = { label: string; value: string; immediate_settle_vendor?: boolean };`
    * `vendorOptionsQuery` mapping:
        * 즉시완불 공장인 경우 label에 마킹(선택): `${name} (즉시완불)`
        * option 객체에 `immediate_settle_vendor` 저장
    * **derive**:
```ts
const selectedVendorOption = vendorOptions.find(v => v.value === vendorPartyId);
const immediateSettleEnabled = Boolean(selectedVendorOption?.immediate_settle_vendor);
```

**C2. 영수증 화면에서 즉시완불 체크박스 제거**
* 파일: 동일 (`receipt-line-workbench.tsx`)
* 구간: “공장 영수증 하단 4행” 카드 헤더(현재 체크박스 존재)
* **변경**:
    * 체크박스 UI 삭제
    * 대신 읽기 전용 배지/설명만 표시:
        * `immediateSettleEnabled=true`이면: **Badge: 즉시완불 공장** (설명: 확정 시 AP 결제가 자동 등록됩니다.)
        * `false`이면: **Badge: 외상(미지급) 공장**

**C3. 확정 버튼 라벨/동작 변경 + 안전 모달**
* 파일: 동일
* **라벨**:
    * `immediateSettleEnabled=true`: **확정+자동결제** (backdated이면 재계산 포함 확정+자동결제)
    * `false`: 기존대로 **확정**
* **안전 모달(필수)**: `immediateSettleEnabled=true`에서 확정 버튼 누르면 즉시 실행하지 말고 모달:
    * 제목: 자동 결제 등록 확인
    * 내용(필수 포함): 공장명, 환산 금/은(g), 공임현금(KRW), “확정 시 AP 결제가 자동 등록됩니다”
    * 버튼: 취소, 확인(강조, danger)
    * 이 모달이 “실수로 누름” 비용을 줄이는 마지막 안전장치.

**C4. 기존 즉시완불 로직은 “조건만 vendor 기반”으로 유지**
* `confirmFactoryStatement()` 내부 로직에서 `immediateSettleEnabled`가 true면:
    * AP ready ensure
    * factory statement rows 자동 셋
    * statement 저장/확정
    * `runImmediateSettlePayment()` 호출
    * note/idempotency key 유지:
        * `p_note`: `AUTO: receipt ... 즉시완불`
        * `p_idempotency_key`: `receipt:${selectedReceiptId}:autoPay:v1`

#### D) 영수증 라인 qty=1 무결성 강제 (중요 버그 패치)
* **문제**: UI는 qty 입력이 `value="1"` 고정인데, state/hydrate/save/totals에서 `item.qty`를 쓰고 있어 레거시 qty > 1 데이터가 있으면 실제 저장/합계가 틀어질 수 있음.
* **해결**: “영수증 라인 qty는 전 구간에서 1로 강제”
* 파일: `receipt-line-workbench.tsx`
* **D1. hydrate 시 qty 강제**
    * 현재: `qty: toInputNumber(row.qty ?? 1),`
    * 변경: `qty: "1",`
* **D2. totals 계산에서 qty 사용 제거/고정**
    * `lineTotals`, `lineMetalTotals`에서: `const qty = parseNumber(item.qty) ?? 1;` → `const qty = 1;`
* **D3. saveLines payload에서 qty 고정**
    * 현재: `const qty = parseNumber(item.qty) ?? 1;` ... `qty,`
    * 변경: `const qty = 1;` ... `qty,`
* **D4. (선택) 레거시 감지 경고**: hydrate 시 `row.qty`가 1이 아니면 `toast.warning: 레거시 qty>1 라인이 감지되어 1로 보정했습니다.`

#### E) 주문 qty 입력 검증 보강 (운영 안전)
* **문제**: `/orders`에서 `parseRequestedQty()`가 -1 같은 음수를 반환할 수 있고 `validateRow()`가 `!requestedQty`로만 체크해서 음수가 통과 가능.
* **수정**: 파일: `web/src/app/(app)/orders/page.tsx`
* **E1. parseRequestedQty에서 1 미만은 null 처리**:
```ts
const parsed = toNumber(value);
...
const floored = Math.floor(parsed);
if (floored < 1) return null;
return floored;
```
* **E2. validateRow 메시지 명확화 (선택)**: `requestedQty === null` → “수량은 1 이상이어야 합니다”
* **E3. applyQtyInput에서도 <1 경고(선택)**: UX: 입력 중 0 또는 - 들어올 때 빨간 에러/토스트는 과할 수 있으니, 최소한 blur/save에서만 막아도 OK.

---

### 6) Acceptance Criteria (반드시 통과)
* **거래처(공장) 설정**
    * [ ] vendor 상세에서 “즉시완불 공장” 토글이 보이고, ON 시 확인 모달이 뜬다.
    * [ ] 저장 후 다시 열면 상태가 유지된다(=note tag 기반).
    * [ ] 메모 textarea에는 시스템 태그가 보이지 않는다(strip/compose 적용).
* **영수증 워크벤치**
    * [ ] “즉시완불(미수 없음)” 체크박스가 완전히 제거된다.
    * [ ] 선택한 공장이 즉시완불 공장이면:
        * [ ] 확정 버튼이 “확정+자동결제”로 보인다.
        * [ ] 클릭 시 자동결제 확인 모달이 먼저 뜬다.
        * [ ] 확인 시에만 결제 로직이 실행된다.
    * [ ] 즉시완불 공장이 아니면 기존처럼 확정만 된다(결제 호출 없음).
* **영수증 qty=1 무결성**
    * [ ] DB에 qty가 10으로 들어있는 레거시 라인이 있어도 UI/합계/저장이 모두 qty=1 기준으로 동작한다.
    * [ ] `lineTotals.qty`는 “라인 수”로만 집계된다(=항상 라인 개수).
* **주문 qty 검증**
    * [ ] qty에 -1/0 입력 시 저장이 막히고 에러가 표시된다.
    * [ ] qty=10 입력 시 기존처럼 분해 생성된다.

---

### 7) 주의/운영 노트
* “즉시완불 공장”은 설정이 켜진 순간부터 해당 공장 영수증 확정이 곧 자동 결제 등록이 된다.
    * → 설정 UI에서 반드시 경고/확인 모달을 넣을 것.
    * → 워크벤치 확정에서도 2차 경고 모달을 넣을 것(실수 비용 방지).
* AP 결제는 idempotency key를 쓰므로 더블클릭/재시도에 비교적 안전하지만, UI에서 이중클릭 방지(disabled) + pending 상태 유지는 계속 필요.

### 8) 변경 파일 목록(정리)
* ✅ 신규: `web/src/lib/vendor-immediate-settle.ts`
* 수정:
    * `web/src/components/party/types.ts`
    * `web/src/app/(app)/party/page.tsx`
    * `web/src/components/party/tabs/BasicInfoTab.tsx`
    * `web/src/app/api/vendors/route.ts`
    * `web/src/app/(app)/new_receipt_line_workbench/receipt-line-workbench.tsx`
    * `web/src/app/(app)/orders/page.tsx`