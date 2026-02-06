# [CODING AGENT PROMPT] AP / AP-Reconcile UI 고도화 (DB 충돌 0, 프론트 리팩터링만)

### 0) 절대 규칙(위반 금지)
* DB SoT는 public.cms_* 만 사용 (ms_s 금지)
* DB 직접 INSERT/UPDATE 금지 → 쓰기는 반드시 RPC(Function) 로만
* 이번 작업은 프론트엔드만 변경. (마이그레이션/DB 수정 작업 금지)
* 기존 동작/플로우가 깨지면 안 됨 (특히 AP 결제 저장/FIFO 상계, reconcile 상태변경/조정생성)

### 1) 백엔드 전제(이미 배포됨)
AP UI는 아래 “named” 뷰를 사용해야 한다(공장명 포함, 기존 v1 변경 없음):
* cms_v_ap_position_by_vendor_named_v1
* cms_v_ap_reconcile_open_by_vendor_named_v1
* cms_v_ap_reconcile_issue_list_named_v1

기존 뷰는 유지하되, AP 페이지와 AP/reconcile 페이지는 named 뷰로 교체한다.

### 2) 작업 목표(왜 고도화하는가)
현재 AP/AP-reconcile 페이지가 “대충 만든 느낌”인 핵심 원인:
* 공장 리스트가 중복 row(자산별 row) 로 섞여 보여서 UI가 불안정함
* key-value 전체 덤프 렌더링(alloc/unallocated)이 가독성을 망침
* reconcile 상태 값이 UI에서 IGNORE를 쓰는 등 enum 불일치 가능성이 있음
* 페이지 구조가 모놀리식 → 유지보수/확장 어려움

### 3) 변경 범위(파일 단위로 명확히)

#### A) web/src/lib/contracts.ts
기존 키는 그대로 두되, named 뷰 키를 추가해라 (기존 사용처 충돌 방지).

```typescript
// ✅ AP Named Views (NEW)
apPositionByVendorNamed: "cms_v_ap_position_by_vendor_named_v1",
apReconcileOpenByVendorNamed: "cms_v_ap_reconcile_open_by_vendor_named_v1",
apReconcileIssueListNamed: "cms_v_ap_reconcile_issue_list_named_v1",
```

reconcile 상태 변경 RPC는 v2 alias가 있으면 v2로 교체(프론트 호환/별칭 처리 목적)
현재 cms_fn_ap_set_reconcile_issue_status_v1 는 enum 타입이라 프론트 실수에 취약함
cms_fn_ap_set_reconcile_issue_status_v2(issue_id, status_text, note) 는 IGNORE/ACK 같은 별칭도 정규화함

→ CONTRACTS.functions.apReconcileSetIssueStatus 를 v2로 교체 권장.

```typescript
apReconcileSetIssueStatus: "cms_fn_ap_set_reconcile_issue_status_v2",
```

#### B) web/src/app/(app)/ap/page.tsx
구조 리팩터링 + UI 고도화 + named view 적용이 목적.

**필수 변경 사항**
* positions 조회 뷰를 CONTRACTS.views.apPositionByVendorNamed 로 변경
* “공장 리스트”는 positions rows를 그대로 쓰지 말고, vendor_party_id 기준으로 유니크하게 만들어라.
  * Map<vendor_party_id, {vendor_party_id, vendor_name}> 로 dedupe
* 레이아웃을 “좌: 공장 선택 / 우: 상세”로 고정 (reconcile처럼)
  * 좌측: 공장 검색 + 리스트(선택 highlight)
  * 우측: (상단) 포지션 요약 / (중단) FIFO 인보이스 / (하단) 결제/배정/미배정
* “결제 배정 결과”, “미배정 크레딧”은 Object.entries 덤프 금지
  * 뷰 컬럼 기반으로 표준 렌더링
  * cms_v_ap_payment_alloc_detail_v1 컬럼(예: payment_id, paid_at, payment_note, alloc_id, occurred_at, movement_code, invoice_memo, asset_code, alloc_qty)을 사람이 읽게 보여라
  * cms_v_ap_payment_unallocated_v1 컬럼(예: paid_qty/allocated_qty/unallocated_qty) 기반으로 표시
* 기존 결제 저장 로직은 그대로 유지
  * RPC: cms_fn_ap2_pay_and_fifo_v1
  * idempotency_key 생성 유지
  * 성공 시 refetch + 입력값 reset 유지

**권장(하지만 과한 스코프는 금지)**
* 중복된 포맷 함수(formatKrw/formatGram/formatDateTimeKst)는 파일 내부 helper로 유지하되, 컴포넌트 단위로 쪼개서 가독성 개선
* 새로운 외부 라이브러리 추가 금지

**컴포넌트 분리(권장 구조)**
* web/src/app/(app)/ap/_components/ApVendorList.tsx
* .../ApPositionSummary.tsx
* .../ApInvoiceFifoList.tsx
* .../ApPaymentForm.tsx
* .../ApPaymentAllocHistory.tsx
* .../ApUnallocatedCreditList.tsx
(분리 없이 한 파일로 끝내지 말고, 최소 vendor list + payment alloc 렌더는 분리해라.)

#### C) web/src/app/(app)/ap/reconcile/page.tsx
named 뷰 적용 + 상태값 정합 + UI 구조 고도화

**필수 변경 사항**
* vendorsQuery: CONTRACTS.views.apReconcileOpenByVendorNamed 사용
* issuesQuery: CONTRACTS.views.apReconcileIssueListNamed 사용
* 상태 필터/액션은 DB enum 기준으로 정리:
  * status: OPEN / ACKED / RESOLVED / IGNORED
* UI에서 IGNORE 라벨을 쓰더라도, RPC에는 IGNORED 로 보내거나
* 더 안전하게 cms_fn_ap_set_reconcile_issue_status_v2 사용해서 IGNORE 입력도 정규화되게 하라
* 버튼 동작:
  * ACK 버튼 → status_text = "ACK" 또는 "ACKED"
  * IGNORE 버튼 → status_text = "IGNORE" 또는 "IGNORED" (단, note 필수)
  * (권장) RESOLVE 버튼 추가 → "RESOLVED" (note optional)
* 이슈 리스트 카드에 최소한 아래는 보여라:
  * severity / issue_type / summary
  * created_at
  * status
  * (가능하면) vendor_name
* 이슈 상세/legs는 key-value 덤프를 줄이고, 핵심 필드를 먼저 보여라(나머지는 접기/스크롤)

### 4) UX/품질 기준(완료 정의)
* 공장 리스트가 절대 중복되지 않는다(자산 row 때문에 중복 표시 금지)
* AP 결제 입력 → 저장 → FIFO 상계 결과/미배정이 즉시 갱신된다
* reconcile에서 IGNORE 처리 시 note 없으면 막힌다(프론트에서도, RPC에서도)
* reconcile에서 ACK/IGNORE/RESOLVE 수행 후 리스트/카운트가 갱신된다
* 기존 라우트/컴포넌트/권한 흐름을 깨지 않는다 (읽기=views, 쓰기=RPC)

### 5) 최소 테스트 시나리오(개발자 체크리스트)
* AP 페이지 진입 → 좌측 공장 검색/선택 → 포지션/인보이스/결제내역 정상 로딩
* 결제 입력(금/은/공임 중 하나 이상) → 저장 → payment_alloc/unallocated 즉시 반영
* reconcile 진입 → vendor 선택 → 이슈 필터(OPEN/ACKED/…) 동작
* IGNORE(메모 없이) 시도 → 프론트에서 에러 토스트
* IGNORE(메모 입력) → 상태 변경되고 리스트 갱신
* 추천 조정 생성 → 성공 토스트 + 리스트 갱신

---

#### 추가로 내가 짚어주는 “AP 페이지 현재 구조의 핵심 버그(고도화 포인트)”
너 AP 페이지 지금 코드 보면, 공장 셀렉터가 positions 테이블 전체를 vendor 리스트로 써서 중복이 발생할 가능성이 매우 높아. (view가 vendor+asset별 row를 내리니까)

이거 하나만 고쳐도 “대충 만든 느낌”이 70% 사라져.