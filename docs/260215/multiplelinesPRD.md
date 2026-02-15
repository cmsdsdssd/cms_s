# PRD (Front-end Only)
주문/공장영수증 “1라인=1개” 원칙 유지 + 예외적 ‘수량 N’ 입력/복사×N 지원 + 즉시완불 공장 처리

**작성일:** 2026-02-15 (KST)  
**적용 범위(코드):** web/ (Next.js App Router)  
**백엔드(DB/RPC) 변경:** 없음(0)  
**구현 우선순위:** P0 (주문 수량/복사), P1 (공장 즉시완불)

---

## 0) 결론(냉정하게)
프론트만 고쳐도 “사용자가 기대하는 UX(수량 10 입력 → 실제로 10개 주문 생성)”는 충분히 달성 가능합니다.  
다만 데이터 무결성을 ‘강제’하려면(다른 화면/외부 프로세스가 qty>1을 넣는 걸 완전 차단) 최종적으로는 DB 제약(예: qty=1 체크) 또는 RPC에서 강제 분해 같은 백엔드 보강이 가장 안전합니다.  
이번 요구사항(“백엔드 안 건드리고”)을 기준으로는, **프론트에서 일관되게 “qty>1은 ‘분해 생성’으로만 처리”**하면 현실적으로 운영 가능하고, 변경 범위/리스크 대비 효과가 큽니다.

---

## 1) 문제 정의

### 1.1 현재 원칙
* **주문:** 라인당 주문 1개(=qty=1) 강제로 운영해 왔음.
* **공장 영수증(라인):** 이미 UI 상 **수량이 1로 고정(disabled)**되어 있음.

### 1.2 새로 필요한 예외/요구
1.  **주문 페이지에서**
    * A 거래처가 Z 모델을 10개 주문하는 경우, 사용자 입장에서는 “수량을 10으로 올리면 → 10개 주문이 생성”되길 원함.
2.  **공장 영수증 작성 시**
    * 일부 공장 거래처는 영수증을 안 주거나, 항상 즉시 완불(미수 없음) 처리됨.
    * 시스템 상으로는 영수증/라인 저장 + AP 생성 후 즉시 결제까지 자동으로 묶어 처리하는 UX가 필요.
    * 공장별 라인 저장(=영수증 라인 입력)도 1개=1라인 유지
    * 대신 “복사 버튼 → ×N 생성”으로 입력 효율을 올리고 싶음.
3.  **주문 페이지도 동일한 철학으로.**

---

## 2) 목표 / 비목표

### 2.1 목표(Goals)
* **(G1)** DB/RPC는 건드리지 않고, 사용자 관점에서 “수량 10 입력 → 결과적으로 10개 라인 생성”을 구현.
* **(G2)** 주문/영수증 모두 1라인=1개 데이터 구조를 유지하면서도, 대량 동일 라인 입력을 복사×N / 수량분해로 빠르게 처리.
* **(G3)** 공장 영수증에서 **즉시완불(결제까지 자동)**을 지원하여 “영수증 저장 → AP 동기화 → 결제 등록 → 미수 0”을 한 플로우로.

### 2.2 비목표(Non-goals)
* **(N1)** DB 스키마 변경, RPC 신규 생성/수정, 트랜잭션 서버 배치 RPC 추가 하지 않음.
* **(N2)** 기존에 이미 존재하는 qty>1 레거시 데이터의 완전한 마이그레이션/정리 자동화는 이번 스코프에서 필수 아님(옵션으로 “분해 도구”는 가능).
* **(N3)** 공장별 “항상 즉시완불” 같은 영구 설정을 DB에 저장하는 것은 하지 않음(대신 localStorage 기반은 가능).

---

## 3) 핵심 정책(중요)

* **정책 P-ORDER-UNIT**
    * 주문 라인은 DB에 항상 qty=1로 저장한다.
    * 사용자가 입력한 qty>1은 “실제 DB qty”가 아니라 **‘분해 생성 요청 수량’**으로 해석한다.
* **정책 P-RECEIPT-LINE-UNIT**
    * 공장 영수증 라인 또한 항상 1라인=1개(현재 UI처럼 qty=1 고정 유지)
    * 다량은 복사×N으로 라인 수를 늘린다.
* **정책 P-IDEMPOTENCY**
    * 분해/복사로 다건 생성 시, 중복 생성 방지/재시도 안정성을 위해 생성될 각 라인에 대해 미리 UUID를 생성하여 p_order_line_id(주문) 또는 line_uuid(영수증)를 고정한다.
    * 요청이 재시도되어도 “새로 insert”가 아니라 “같은 id 업데이트(upsert)”가 되도록 설계한다.

---

## 4) 적용 화면 / 파일

### 4.1 주문(수량분해, 복사×N)
* **화면:** `web/src/app/(app)/orders/page.tsx`
* **서버 라우트(변경 없이 사용):** `web/src/app/api/order-upsert/route.ts`
* **기존 RPC** `cms_fn_upsert_order_line_v6` 사용

### 4.2 공장 영수증(라인 복사×N, 즉시완불)
* **화면:** `web/src/app/(app)/new_receipt_line_workbench/receipt-line-workbench.tsx`
* **사용 RPC(기존):**
    * 라인 저장: `receiptPricingSnapshotUpsertV2`
    * AP 동기화: `ensureApFromReceipt`
    * 공장 statement 저장: `factoryReceiptStatementUpsert`
    * 공장 statement 확정: `factoryReceiptSetApplyStatus`
    * 결제 등록: `apPayAndFifo` (AP 화면에서 이미 사용 중)

---

## 5) 사용자 시나리오 (User Stories)

* **US-ORDER-1: 수량 10 입력 → 10개 라인 생성**
    * 사용자는 주문 등록에서 거래처/모델/소재/색상/사이즈를 입력하고 수량에 10 입력 후 포커스를 벗어나면 시스템은 “qty=1 라인 10개”를 자동 생성/저장하고, 사용자에게 “10개로 분해 저장 완료”가 명확히 안내된다.
* **US-ORDER-2: 복사×N으로 동일 주문 라인 대량 생성**
    * 사용자는 이미 입력된 1줄(또는 저장된 1줄)에서 “복사×N”을 눌러 총 10개로 만들면 동일 내용의 라인이 9개 추가 생성/저장된다.
* **US-RECEIPT-1: 공장 영수증 라인 복사×N**
    * 사용자는 영수증 라인 상세를 펼친 뒤 “복사×N”을 입력하면 동일 내용의 라인들이 vendor_seq_no를 자동 증가시키며 생성된다(저장은 기존처럼 ‘라인 저장’ 클릭).
* **US-RECEIPT-2: 즉시완불 공장 처리**
    * 사용자는 라인 저장(=AP 동기화 성공) 후 “확정+즉시완불” 버튼을 클릭하면 공장 statement 저장/확정 + AP 결제 등록까지 자동 실행되어 최종 미수가 0이 되도록 처리된다.

---

## 6) 기능 요구사항 (Functional Requirements)

### A. 주문 페이지(/orders) — 수량분해 + 복사×N

#### A1. 수량 입력의 의미 변경(중요)
* **FR-ORDER-101**
    * 주문 라인의 qty 입력값이 >1인 경우:
        * DB에 qty>1로 저장하지 않는다.
        * 대신 **“동일 조건의 주문 라인 qty=1을 N개 생성”**한다.
* **FR-ORDER-102 (동작 타이밍)**
    * 기존과 동일하게 Row 컨테이너 onBlur 자동저장(saveRow) 시점에 트리거한다.
    * 또한 “복사×N” 액션에서도 같은 생성 로직을 재사용한다.
* **FR-ORDER-103 (상한/가드)**
    * qty 입력 허용 범위: 최소 1, 기본 최대 50 (상수로 관리: `MAX_SPLIT_QTY = 50`)
    * 51 이상 입력 시: 입력 즉시 에러(빨간 테두리) + 저장 차단 + 토스트 안내 또는 저장 시 모달로 “최대 50개까지만 가능합니다” (둘 중 하나로 통일)

#### A2. 분해 생성 로직(핵심)
* **FR-ORDER-201 (새 라인, order_line_id 없음)**
    * 저장 시 qty = N이면:
        * N개의 UUID를 미리 생성한다.
        * 각 UUID별로 payload 생성: `p_order_line_id = uuid_i`, `p_qty = 1`, 나머지 필드 동일
        * `/api/order-upsert`를 N회 호출하여 저장한다.
    * UI state rows에는: 원래 row를 “첫 번째 라인”으로 사용하고 `order_line_id = uuid_1`, `qty="1"`로 강제 설정. 나머지 N-1개는 원래 row 바로 아래에 삽입 (동일값, `qty="1"`, `order_line_id=uuid_i`)
    * 토스트: 성공: 수량 N → 1개 라인 N건 생성 완료 / 실패: 아래 FR-ORDER-401 참고
* **FR-ORDER-202 (기존 라인, order_line_id 존재)**
    * 사용자가 기존 저장 라인에서 qty를 10으로 바꾸는 경우:
        * 의미: “총 10개 필요”로 해석하지 않고(혼란), **“추가로 9개 생성”**으로 해석한다.
        * 처리: `existingCount = 1` (현재 라인이 이미 1개 존재), `needToCreate = N - 1`. 원래 라인은 `qty="1"`로 되돌리고(필요 시 upsert 1회), 아래에 `needToCreate`개를 추가 생성.
        * UX 문구: “이 라인은 1개 단위로 저장됩니다. 추가 수량은 동일 라인으로 분해 생성됩니다.”
* **FR-ORDER-203 (저장/중복 방지)**
    * 각 라인 생성 시 order_line_id를 클라이언트에서 고정 생성한다.
    * 동일 row blur가 중복으로 발생해도 `saveInFlight` + `saveCache`로 중복 요청을 최대한 억제한다.
    * 분해 생성 도중 사용자가 다시 blur/클릭해도, 같은 생성 작업이 중첩 실행되지 않도록 row 단위 Lock을 둔다: `bulkSaveInFlight: Set<row.id>` 또는 `bulkGroupKey` 등.

#### A3. “복사 / 복사×N” UI
* **FR-ORDER-301 (버튼 위치)**
    * 주문 그리드의 마지막 컬럼(현재 Delete X 버튼 영역)에 액션 버튼을 추가: 복사 아이콘 버튼, 복사×N 아이콘 버튼(또는 복사 버튼 클릭 시 모달에서 수량 입력)
    * 권장 UI: X(삭제) 옆에 ⧉(복사) 아이콘
    * 툴팁: 복사: “이 라인 1개 추가 생성”, 복사×N: “이 라인을 여러 개로 생성”
* **FR-ORDER-302 (복사 동작)**
    * 복사(1개): 해당 row를 template으로 하여 새 row 1개를 즉시 생성/저장. 새 row는 원래 row 바로 아래 삽입. 저장 성공 시 새 row는 녹색(저장됨) 표시.
* **FR-ORDER-303 (복사×N 동작)**
    * 복사×N 클릭 시 Modal로 숫자 입력 (제목: “라인 복사”, 설명: “선택한 라인을 포함하여 총 몇 개로 만들까요?”, 입력: `totalCount` (min=1, max=50), 확인 버튼: “생성”)
    * 동작: `totalCount=10`이면 추가 9개 생성. 즉시 저장까지 수행 (주문은 저장이 곧 생성).
* **FR-ORDER-304 (복사 가능한 상태)**
    * 최소 필수 필드(거래처/모델/소재)가 매칭되어야 복사 실행 가능. 아니면 토스트: “거래처/모델/소재 매칭 후 복사 가능합니다”

#### A4. 실패/부분성공 처리(현실적이면서 안전하게)
* **FR-ORDER-401 (부분 성공 허용 + 안내)**
    * N개 생성 중 k번째에서 실패할 수 있음(네트워크/RPC).
    * 요구사항: 이미 생성 성공한 라인은 그대로 둔다. 실패한 라인 수와 원인을 사용자에게 명확히 보여준다. “재시도” 버튼을 제공한다(최소: 토스트에 안내).
    * 권장 구현: bulk 생성 시 각 라인의 생성 결과를 수집: 성공(row에 `order_line_id` 존재), 실패(row에 `save_error_message` 같은 임시 필드(프론트 전용) 또는 `rowErrors[row.id].qty`에 표시).
    * 토스트 예: 10건 중 7건 저장 완료, 3건 실패 (자세히 보기). “자세히 보기”는 optional. 최소 구현은 실패 row에 빨간 하이라이트 + 툴팁 메시지.
* **FR-ORDER-402 (재시도 안정성)**
    * 부분 성공 후 재시도 시: 이미 성공한 UUID들은 동일 UUID로 upsert되므로 중복 생성 위험이 낮음. 실패했던 UUID row들만 다시 요청하도록 구현 권장.

#### A5. 구현 가이드(코딩 에이전트용, 파일/함수 단위)
* **변경/추가 권장 함수** (orders/page.tsx 내부 또는 helper로 분리)
    * `cloneOrderRowTemplate(row: GridRow): GridRow`: id 새로 생성, `order_line_id=null`, `qty="1"`, 나머지 값 복사
    * `buildPayloadWithOverrides(row, overrides): OrderUpsertPayload`: `p_qty`는 항상 1, `p_order_line_id`는 overrides로 주입
    * `bulkCreateOrderLines(templateRow, totalCount, mode)`: mode: `"fromQty" | "fromCopy"`, returns: `{ createdRows: GridRow[], failed: { index, error }[] }`
* **저장 호출 방식:** 기존 `upsertOrderLine(payload)` 그대로 사용하되, bulk에서는 N회 호출
* **UX 텍스트(필수):** 수량분해 후: 수량 N → 1개 단위 라인 N개로 저장했습니다.

---

### B. 공장 영수증 라인(/new_receipt_line_workbench) — 라인 복사×N + 즉시완불

#### B1. 라인 복사 / 복사×N
* **FR-RECEIPT-101**
    * 영수증 라인 상세 펼침 영역(현재 “삭제” 버튼 있는 곳)에 버튼 추가: 복사, 복사×N
    * 위치: 삭제 버튼 좌측(또는 동일 행 오른쪽 정렬 버튼 그룹)
* **FR-RECEIPT-102 (복사 동작)**
    * 복사 1개: 선택 라인의 내용을 기반으로 새 라인 1개를 lineItems state에 추가
    * 필드 복사 규칙:
        * 유지: `customer_factory_code`, `model_name`, `material_code`, `color`, `size`, `weight_raw_g`, `weight_deduct_g`, `labor_basic_cost_krw`, `labor_other_cost_krw`, `stone_* qty/cost`, `total_amount_krw`, `remark`
        * 강제: `qty="1"` (이미 원칙)
        * 신규: `line_uuid=crypto.randomUUID()`
        * 신규: `receipt_line_uuid`는 비움(null/undefined)(새 라인)
        * `vendor_seq_no`는 `getNextVendorSeq(prev)`로 자동 증가값 부여
        * `setLineItemsDirty(true)` 반드시 호출
* **FR-RECEIPT-103 (복사×N 동작)**
    * Modal로 N 입력: “총 몇 개로 만들까요? (선택 라인 포함)” 또는 “추가로 몇 개 만들까요?” 혼란 방지를 위해 주문과 동일하게 “총 개수(원본 포함)” 권장.
    * 생성: N=10이면 9개 추가 생성. 각 라인마다 `line_uuid` 새로, `vendor_seq_no`는 순차 증가로 할당.
* **FR-RECEIPT-104 (잠금 라인 복사 허용)**
    * `isLocked`(매칭확정/출고확정) 라인이라도: “복사”는 허용(새 라인 생성이므로). 단, 복사된 라인은 당연히 lock 아님(새 라인).

#### B2. “즉시완불 공장” 처리 UX
* **FR-RECEIPT-201 (토글/체크박스)**
    * “공장 영수증 하단 4행(Factory Statement)” 카드 영역에 체크박스 추가:
        * 라벨: 즉시완불(미수 없음)
        * 설명(작게): 확정 시 AP 결제까지 자동 등록하여 미수를 0으로 맞춥니다.
    * 상태 저장: per-receipt 상태(기본). 옵션: “이 공장은 기본값으로 기억” → localStorage에 `vendor_party_id` 저장(선택 구현).
* **FR-RECEIPT-202 (확정 버튼 확장)**
    * 기존 버튼: 저장, 확정
    * 즉시완불 ON일 때: 확정 버튼 라벨 변경: 확정+완불. 클릭 시 아래 B3 플로우 실행.
* **FR-RECEIPT-203 (사전조건 체크)**
    * 확정+완불 실행 전 자동 체크:
        * `selectedReceiptId` 존재
        * `headerNeedsSave === false` (아니면 헤더 저장 유도)
        * 라인 저장 + AP 동기화 성공 필요
        * `lineItemsDirty === true`면 `saveLines()`를 먼저 자동 실행
        * `apSyncStatus !== "success"`면: `retryEnsureAp()` 자동 시도 1회(선택), 실패 시 중단 + 토스트 "AP 동기화가 필요합니다(재시도 후 진행)"
        * 결제할 금액이 모두 0이면 중단: `convertedGold==0 && convertedSilver==0 && totalAmount==0` → 결제할 금액이 없습니다.

#### B3. 즉시완불 실행 플로우(자동 시퀀스)
* **FR-RECEIPT-301 (자동 처리 시퀀스)**
    * 확정+완불 클릭 → 순서대로 실행:
    1.  **라인 저장(saveLines):** 필요 시(Dirty일 때)만 실행. 내부에서 `ensureApFromReceipt`까지 수행됨(현재 구현 그대로 활용).
    2.  **Factory Statement 자동 채움(선택이지만 강력 권장):** 즉시완불 ON일 때: `PRE_BALANCE`: 0, `SALE`: (라인 합계 기반 금(g): `lineMetalTotals.convertedGold`, 은(g): `lineMetalTotals.convertedSilver`, 공임현금: `lineTotals.totalAmount`), `RECENT_PAYMENT`: SALE와 동일, `POST_BALANCE`: 0. 사용자 입력을 덮어쓰는 것이므로 최초 1회만 자동 채움(또는 “자동 채움” 버튼을 별도로 두고 사용자가 누르게 함). 자동 채움 후 `saveFactoryStatement()` 실행.
    3.  **Factory Statement 확정(confirmFactoryStatement):** 기존 `backdatedConfirmRequired` 로직 유지. `factoryReceiptSetApplyStatus` 호출.
    4.  **AP 결제 등록(apPayAndFifo):**
        * legs 생성 규칙(0 제외): `{ asset_code: "XAU_G", qty: lineMetalTotals.convertedGold }`, `{ asset_code: "XAG_G", qty: lineMetalTotals.convertedSilver }`, `{ asset_code: "KRW_LABOR", qty: lineTotals.totalAmount }`
        * `p_vendor_party_id = vendorPartyId`
        * `p_paid_at`: 기본: 영수증 `issued_at`(=billDate) 기준 KST 시각으로 생성. 예: `${billDate}T09:00:00+09:00` → ISO 변환. billDate가 없으면: 현재 KST now 사용.
        * `p_note`: AUTO: receipt {billNo || receiptId.slice(0,8)} 즉시완불
        * `p_idempotency_key`: deterministic 권장: `receipt:${selectedReceiptId}:autoPay:v1`. 같은 receipt에서 중복 결제 방지.
    5.  **완료 처리:** 토스트: 즉시완불 처리 완료 (결제 등록됨). 관련 query invalidate(최소): `["new-receipt-workbench","reconcile",selectedReceiptId]`, `["new-receipt-workbench","factory-statement",selectedReceiptId]`, (선택) `["ap", ...]` 계열 쿼리 키가 있다면 invalidate.
* **FR-RECEIPT-302 (에러 처리)**
    * 단계별 실패 시: 어느 단계에서 실패했는지 토스트에 명시. 예: Factory Statement 저장 실패: {message}, AP 결제 등록 실패: {message}.
    * 결제만 실패한 경우: Statement는 이미 확정일 수 있음. 사용자에게 다음 행동 안내: AP 페이지에서 수동 결제 처리 후, 이 영수증 reconcile 확인.

---

## 7) UI/UX 상세(권장)

* **주문(/orders)**
    * 수량 입력칸에 >1 입력 후 blur 시: 즉시 spinner/“저장중…” 상태 표시(이미 상단에 “저장 중…” 있음). 완료 시 toast + rows가 늘어나는 것이 사용자에게 명확해야 함.
    * 복사×N 모달: 입력 focus 자동, Enter = 생성, ESC = 취소.
* **영수증(/new_receipt_line_workbench)**
    * 라인 상세 하단 버튼 바: [복사] [복사×N] … [삭제]
    * 즉시완불 토글: Factory Statement 카드 내 버튼들(저장/확정) 근처 배치. 토글 ON이면 “확정” 버튼이 “확정+완불”로 변경.

---

## 8) 수용 기준(Acceptance Criteria)

* **AC-ORDER**
    * 주문 row에서 qty=10 입력 후 blur → DB에 qty=1 라인 10개 생성(UI에서 order_line_id 10개 채워짐)
    * 생성된 10개 라인은 모두 저장 성공 토스트 1회(또는 요약 토스트) 발생
    * 복사×N(총 10) 실행 → 추가 9개 생성/저장
    * 50 초과 입력은 차단(에러 표시 + 저장 안 됨)
    * 생성 도중 네트워크 실패 시 부분 성공/실패가 구분되고 재시도 가능한 상태로 남음
* **AC-RECEIPT**
    * 라인 상세에서 복사×N(총 5) → lineItems 4개가 추가되고 각 라인은 line_uuid가 다르고 vendor_seq_no가 자동 증가
    * 즉시완불 ON + 확정+완불 → 라인 저장 및 AP 동기화가 선행되고 factory statement 저장/확정 후 apPayAndFifo가 호출되어 결제 등록됨(성공 토스트)
    * apSyncStatus가 error면 즉시완불 실행이 중단되고 “AP 동기화 필요”가 안내됨
    * idempotency_key로 더블클릭/재시도 시 중복 결제가 생기지 않음

---

## 9) 리스크 & 완화

* **R1) 다른 화면에서 qty>1 저장 가능**
    * 완화(프론트 범위): 주요 입력 화면(orders)에서만이라도 강제 분해 처리.
    * 추후 권장(백엔드): cms_order_line.qty = 1 체크 제약 또는 RPC 내부 강제 분해.
* **R2) 주문 bulk 생성 부분 실패**
    * 완화: UUID 선생성 + 실패 row 표시 + 실패분만 재시도 로직.
* **R3) 즉시완불 결제 금액 산정 불일치**
    * 완화: 결제 legs는 “라인 저장 시 사용한 합계(lineMetalTotals/lineTotals)” 기반. 실패 시 사용자에게 AP 수동 결제로 fallback 제공.

---

## 10) 구현 체크리스트(코딩 에이전트용)

### Orders
- [ ] saveRow에 qty>1 분기 추가(분해 생성)
- [ ] buildPayload 또는 wrapper로 p_qty=1 강제 가능하도록 변경
- [ ] Row 액션 버튼(복사/복사×N) 추가 + Modal 구현
- [ ] bulk 생성 중 UI lock + 진행/결과 토스트
- [ ] max 50 가드 + 에러 표시
- [ ] 부분 실패 재시도(최소: 실패 row 다시 저장 가능)

### Receipt Workbench
- [ ] 라인 상세 버튼에 복사/복사×N 추가
- [ ] 복사×N Modal 추가
- [ ] 즉시완불 토글 추가
- [ ] 확정+완불 플로우 구현(라인저장→statement저장→확정→apPayAndFifo)
- [ ] idempotency_key, note, paid_at 규칙 적용
- [ ] 실패 단계별 에러 메시지/토스트