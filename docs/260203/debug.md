# [CODEx 전달용] 공장 영수증(AP 생성 누락) + 수리비(AR Invoice 반영 누락) 디버깅 & 수정 지시서 (최신 ZIP 기준)

> ✅ 대상 리포: `cms_s-main (33).zip` (사용자가 최신본 재업로드함)  
> ✅ 목표: 아래 **2개 핵심 버그를 “명확한 근거(코드/SQL 위치)” 기반으로 재현 → 수정**하고, **ADD-ONLY migration + RPC + 프론트 diff + 수동테스트 체크리스트**까지 제출.

---

## 0) 필수 전제/프로젝트 룰 (절대 위반 금지)

- DB SoT는 **public.cms_*** 오브젝트만. **ms_s 사용 금지**
- **직접 INSERT/UPDATE 금지** → 쓰기는 반드시 **RPC(Function)** 로만
- 마이그레이션은 **ADD-ONLY** (기존 migration 수정/재작성 금지)
- 새 migration 파일명 타임스탬프는 **현재 repo에서 가장 큰 값보다 더 뒤(미래)** 로 잡기  
  - 현재 migrations 최댓값 확인됨: `supabase/migrations/20260203193000_...`  
  - 따라서 새 migration은 **`20260203193001` 이후**로 생성할 것
- RPC는 **SECURITY DEFINER / set search_path / grant execute** 패턴 유지
- RLS/권한/컨벤션은 코드베이스 기존 패턴 그대로 재사용
- 프론트는 기존 컴포넌트/훅(SearchSelect, Modal, ActionBar, useRpcMutation 등) 재사용 우선

---

## 1) 버그 #1 — “기존 영수증(업로드/선택된 receipt) 저장” 시 AP(공장미수) 생성/갱신이 안 됨

### 1-A. 근거(현재 코드가 AP를 만들지 않는 증거)

#### (1) `purchase_cost_worklist`에서 “isCreating=false(기존 영수증)” 저장 흐름
- 파일: `web/src/app/(app)/purchase_cost_worklist/page.tsx`
- 문제 구간: `onSave()` 내부에서
  - **신규 생성(isCreating=true)** 은 `cms_fn_create_vendor_bill_v1` 호출 → 이 RPC는 AP 생성 로직 포함
  - **기존 영수증(isCreating=false)** 은 헤더 업데이트 + 스냅샷 업서트만 수행하고 **AP 생성/갱신이 없음**
- 라인 근거:
  - `onSave` 시작: **626**
  - 신규 생성: **633~651** (`vendorBillCreate` = `cms_fn_create_vendor_bill_v1`)
  - 기존 저장: **656~673** (`cms_fn_update_vendor_bill_header_v1` + `cms_fn_upsert_receipt_pricing_snapshot_v1`)
  - **AP 관련 호출 없음**
  
```ts
// purchase_cost_worklist/page.tsx (라인 626~673 요약)
// isCreating=true → cms_fn_create_vendor_bill_v1 (AP 생성 포함)
// isCreating=false → cms_fn_update_vendor_bill_header_v1 + cms_fn_upsert_receipt_pricing_snapshot_v1
//                 → AP 생성/갱신 없음 (버그)
```

#### (2) `new_receipt_line_workbench`에서도 헤더/라인 저장 시 AP 생성/갱신이 없음
- 파일: `web/src/app/(app)/new_receipt_line_workbench/receipt-line-workbench.tsx`
- 문제 구간:
  - `saveHeader()` (라인 668~680) → `cms_fn_update_vendor_bill_header_v1`만 호출
  - `saveLines()` (라인 682~737) → `receiptPricingSnapshotUpsertV2`만 호출
  - **AP 생성/갱신 RPC 호출 없음**

### 1-B. 관련 DB/SQL 근거 (왜 신규만 되고 기존은 안 되는지)
- 신규 생성 RPC: `supabase/migrations/20260202390000_cms_0326_vendor_bill_repairs_flow.sql`
- `cms_fn_create_vendor_bill_v1` 내부에 AP 생성 로직 존재:
  - `cms_ap_ledger`에 `entry_type='BILL'`로 insert (없을 때만)
- 그러나 `cms_fn_update_vendor_bill_header_v1`는 `cms_receipt_inbox` 업데이트만 하고 AP는 손대지 않음
- 또한 AP 중복 방지는 이미 존재:
  - `cms_ap_ledger` unique index: `uq_cms_ap_ledger_bill_receipt`
  - → `receipt_id` + `entry_type='BILL'` 중복 방지

### 1-C. 요구 수정사항(정확한 기대 동작)
- ✅ **요구 1: “기존 영수증 저장” 시에도 AP가 반드시 upsert 되게**
  - 조건: receipt에 `vendor_party_id`가 있고, `total_amount_krw`(또는 pricing snapshot total)이 있으면
  - 기대: 
    - AP(BILL)가 없으면 생성
    - AP(BILL)가 이미 있으면 `amount_krw` / `vendor_party_id` / `bill_no` / `memo`를 최신 값으로 갱신
    - 멱등/중복 방지는 기존 unique index 활용
- ✅ **요구 2: 프론트에서 직접 테이블 쓰기 금지 → 반드시 새 RPC로 처리**
  - 구현 옵션(선호 순):
    1. 신규 RPC 추가: `cms_fn_ensure_ap_from_receipt_v1(p_receipt_id uuid, p_note text default null)`
       - `receipt_inbox` + `pricing_snapshot`을 읽어 BILL AP upsert
    2. 또는 `cms_fn_update_vendor_bill_header_v1`를 대체하는 상위 RPC(헤더+AP 보장) 추가
    - 단, 기존 호출부가 많다면 (1)이 더 안전/최소변경
- ✅ **요구 3: AP 보장은 최소 다음 저장 이벤트에서 수행**
  - `purchase_cost_worklist/page.tsx`:
    - `isCreating=false` 저장 플로우에서 헤더 업데이트 & snapshot upsert 후 `ensure_ap` 호출 추가
  - `new_receipt_line_workbench/receipt-line-workbench.tsx`:
    - 최소 `saveLines()` 성공 후(=총액이 확정되는 시점) `ensure_ap` 호출
    - (선택) `saveHeader()`에서도 vendor 변경 시 ensure를 호출해도 되나, 총액이 없을 수 있으니 예외처리 필요

---

## 2) 버그 #2 — 수리 추가비(repair_fee)가 “AR invoice(FIFO)”에 반영되지 않음 (confirm 순서 문제)

### 2-A. 근거(현재 confirm 체인에서 invoice가 먼저 생성됨)
#### (1) 현재 사용되는 confirm RPC는 기본값으로 v3
- 파일: `web/src/lib/contracts.ts`
- shipmentConfirm 기본값: `process.env.NEXT_PUBLIC_RPC_SHIPMENT_CONFIRM || "cms_fn_confirm_shipment_v3_cost_v1"`

#### (2) 최신 `cms_fn_confirm_shipment_v3_cost_v1` 정의가 “invoice 생성 이후” repair fee를 적용
- 최신 정의 파일(현재 migrations 최신 흐름 기준): `supabase/migrations/20260203170000_cms_0338_fix_silver_factor_for_kr_tick.sql`
- 문제 라인:
  - v3가 `cms_fn_confirm_shipment_v2`를 먼저 호출 (라인 146~152)
  - 그 다음에야 `cms_fn_apply_repair_fee_to_shipment_v1` 호출 (라인 154)
  - **즉, v2 내부에서 invoice가 이미 만들어진 뒤라서, repair fee가 invoice에 못 들어감.**

#### (3) `cms_fn_confirm_shipment_v2`는 invoice를 생성함
- 파일: `supabase/migrations/20260202310000_cms_0318_ar_fifo_split_payment.sql`
- 핵심 라인:
  - `confirm_shipment` 호출 (라인 469)
  - `cms_fn_ar_create_from_shipment_confirm_v1` 호출 (라인 471) ← **invoice 생성 지점**
  - inventory emit (라인 473~486)

### 2-B. 요구 수정사항(정확한 기대 동작)
- ✅ **요구 1: repair fee는 AR invoice 생성 전에 shipment_line에 반영되어야 함**
  - 목표: 출고 확정 시점에
    1. `cms_shipment_line.total_amount_sell_krw`에 `repair_fee`가 포함
    2. 그 상태로 `cms_fn_ar_create_from_shipment_confirm_v1`가 invoice를 생성
  - 중복 반영 방지는 기존 `price_calc_trace.repair_fee_included` 로직을 유지
- ✅ **요구 2: repair fee는 “labor 성격”이므로 labor_total에도 반영(권장)**
  - 현재 `cms_fn_apply_repair_fee_to_shipment_v1`는:
    - `total_amount_sell_krw += repair_fee_krw`만 하고
    - `labor_total_sell_krw`는 안 건드림
    - → 이후 여러 요약/리포트(valuation, ar_ledger labor 집계 등)에서 노동비 합산이 틀어질 수 있음
  - 권장 수정: 
    - 동일 update에서 `labor_total_sell_krw += repair_fee_krw`도 함께 수행 (labor 세부 항목 분해까지는 MVP에서 불필요)

### 2-C. 구현 지시(최소 변경 + 안전)
- 권장 구현(가장 안전/명확): **v3가 v2를 호출하지 말고 “단계별로” 수행**
- 새 `cms_fn_confirm_shipment_v3_cost_v1`의 권장 순서:
  1. `cms_fn_confirm_shipment(...)` // status CONFIRMED + confirmed_at 세팅
  2. `cms_fn_apply_repair_fee_to_shipment_v1(p_shipment_id, p_note)`
     - 이때 shipment_line의 total/labor가 갱신됨
  3. (cost 모드가 SKIP이 아니면) `cms_fn_apply_purchase_cost_to_shipment_v1(...)`
  4. `cms_fn_apply_silver_factor_fix_v1(p_shipment_id)`
     - invoice 생성 전에 valuation 스냅샷을 확정(가능한 한 정합)
  5. `cms_fn_ar_create_from_shipment_confirm_v1(p_shipment_id)` // **invoice 생성**
  6. p_emit_inventory=true면 `cms_fn_emit_inventory_issue_from_shipment_confirmed_v2(...)`
     - idempotency key가 shipment_id 기반이라 재호출 안전
  7. v_confirm json + purchase_cost + correlation_id(+inventory_emit)를 리턴

> 이렇게 하면 repair fee / silver factor 적용 결과가 invoice에 반영되고, 기존 멱등키 패턴도 유지됨.

---

## 3) 산출물(반드시)

### 3-1) Migration SQL (ADD-ONLY)
- 새 파일 1~2개 생성 가능
- 타임스탬프는 반드시 **20260203193001** 이후
- 포함 내용:
  - `cms_fn_ensure_ap_from_receipt_v1` (또는 동등한 AP 보장 RPC) 생성 + grant execute
  - `cms_fn_apply_repair_fee_to_shipment_v1` 수정(=create or replace)
    - `total_amount_sell_krw` + `labor_total_sell_krw` 반영
  - `cms_fn_confirm_shipment_v3_cost_v1` 수정(=create or replace)
    - invoice 생성 전에 repair fee 적용되도록 순서 재구성
  - security definer / set search_path / grants 기존 패턴 그대로

### 3-2) RPC SQL
- 위 migration에 포함되면 OK(추가 SQL 파일 불필요)

### 3-3) 프론트 diff
- `purchase_cost_worklist/page.tsx`
  - 기존 영수증 저장(isCreating=false) 시 ensure AP 호출 추가
- `new_receipt_line_workbench/receipt-line-workbench.tsx`
  - `saveLines()` 성공 후 ensure AP 호출 추가 (최소)
- (필요시) `contracts.ts`에 함수명 상수 추가해도 되고, 기존처럼 문자열로 호출해도 됨(프로젝트 패턴 우선)

### 3-4) 수동 테스트 체크리스트(필수)
아래 시나리오를 “실제 클릭 순서”로 체크리스트 형태로 포함:

**[버그1/AP]**
- [ ] (A) 기존 업로드 영수증 선택 → vendor/bill_no/총액 수정 → 저장
  - 기대: `cms_ap_ledger`에 `receipt_id` 기준 BILL row가 생성 또는 갱신
  - 재저장해도 중복 row 없음
- [ ] (B) `purchase_cost_worklist` / `new_receipt_line_workbench` 둘 다 동일 확인
- [ ] (C) vendor를 바꿔 저장했을 때 AP `vendor_party_id`도 최신화되는지

**[버그2/Repair fee → AR invoice]**
- [ ] (A) `repair_fee_krw` > 0인 `shipment_line`이 있는 shipment 준비
- [ ] (B) shipment confirm 실행
  - 기대: `cms_ar_invoice`의 `total_cash_due_krw`가 repair fee 포함
  - `labor_cash_due_krw`에도 포함되는지(= total - material 계산상 포함되어야 함)
- [ ] (C) confirm을 2번 호출해도 invoice 중복 생성/금액 중복 증가가 없는지

---

## 4) 제출 형식(요청)
1. 변경 사항 요약(왜 버그였는지 2~3줄씩)
2. 수정한 파일 목록 + 핵심 diff
3. migration 파일명(타임스탬프 포함)과 주요 create/replace 함수 목록
4. 수동 테스트 체크리스트

---

## 5) 참고(현재 코드 위치 빠른 링크용)

**AP 관련**
- purchase_cost_worklist 기존 저장 누락:
  - `web/src/app/(app)/purchase_cost_worklist/page.tsx` (onSave: 626~673)
- new_receipt_line_workbench 저장 누락:
  - `web/src/app/(app)/new_receipt_line_workbench/receipt-line-workbench.tsx`
  - saveHeader: 668~680 / saveLines: 682~737
- AP 테이블/생성 RPC:
  - `supabase/migrations/20260202390000_cms_0326_vendor_bill_repairs_flow.sql`
  - `cms_ap_ledger`, `cms_fn_create_vendor_bill_v1`, `cms_fn_update_vendor_bill_header_v1`

**Repair fee → invoice 순서 문제**
- confirm v3 최신 정의:
  - `supabase/migrations/20260203170000_cms_0338_fix_silver_factor_for_kr_tick.sql` (v3: 124~178)
- confirm v2(invoice 생성 포함):
  - `supabase/migrations/20260202310000_cms_0318_ar_fifo_split_payment.sql` (v2: 454~496)
- repair fee 적용 함수:
  - `supabase/migrations/20260202401000_cms_0327_repair_fee_ar_apply.sql`

✅ **결론: 위 2개는 “업무가 막히는 치명 버그”라서, 반드시 재현 → 순서/Upsert 로직 수정 → 멱등성 확인까지 완료해 주세요.**