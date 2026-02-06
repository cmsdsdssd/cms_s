# [CODING AGENT PRD / PROMPT] Workbench “거래처 360” 가독성·정리 개선 (주문/출고/반품/수금 한눈에)

### 0) 절대 규칙(필수)
* DB SoT는 public.cms_* 만 (ms_s 금지)
* 직접 INSERT/UPDATE 금지 → 쓰기는 반드시 RPC(Function) 로만 (이번 작업은 기본 “읽기+UI” 중심)
* 기존 기능/플로우(출고확정, shipments_print, AR 수금등록, 기존 페이지 링크) 동작 변경 금지
* 성능: 거래처별 데이터 많아질 수 있으니 기간 필터/limit/load more 필수
* 구현 위치(현존):
    * web/src/app/(app)/workbench/[partyId]/page.tsx
    * web/src/app/(app)/workbench/page.tsx
    * (필요 시) web/src/components/timeline/timeline-view.tsx, web/src/components/party/global-party-selector.tsx

### 1) Background (왜 바꾸는가)
현재 Workbench의 “전체 타임라인”은 주문/출고/수금만 단순 합쳐 정렬되어 있어, 업무자가 실제로 궁금한 **“이게 주문인지/반품인지/수금인지/정산 상태가 뭔지”**가 즉시 구분되지 않습니다. 고도화 ERP에서 흔히 쓰는 해법은:

* **Customer 360:** 고객/거래처 페이지에서 재무상태+거래이력+활동을 한 화면에 모음 (NetSuite Customer 360).
* **Smart Buttons:** 문서(주문/배송/인보이스 등)별 카운트와 바로가기 버튼을 상단에 제공 (Odoo Contacts).
* **Timeline Control:** 활동을 한곳에서 보되, 타입/필터로 분류 가능 (Dynamics 365 Timeline).
* **Relationship Map(문서 흐름):** 주문→출고→인보이스→수금/반품의 “문서 연결”을 시각화 (SAP B1 Relationship Map).

→ 우리 Workbench도 이 패턴을 **“주얼리 도매 운영(출고/미수/현물결제/반품/수리)”**에 맞게 적용합니다.

### 2) 목표(Goals)
* 거래처 화면에서 **현재 상태(미수/현물 미수/오픈 문서)**가 5초 안에 파악
* “전체” 화면에서 **타입(주문/출고/반품/수금/수리)**이 시각적으로 즉시 구분
* 오픈 업무(출고대기/당일출고 확정/미수 회수/반품/수리)를 “큐”로 제공 → 클릭 1~2번으로 해당 페이지/액션 수행
* 데이터가 많아도 느려지지 않게 기간/limit/load-more로 안정화

### 3) Non-Goals (이번 범위 제외)
* DB 스키마 대수술 / 기존 로직 변경
* 정산 계산식 변경(미수 계산, FIFO 등) — 이미 있는 계산 결과를 “잘 보이게”만 함
* 인쇄 양식/출고 확정 로직 변경

### 4) UX/IA 설계 (핵심 구조)
#### 4.1 탭 구조를 “업무 중심”으로 재편
기존 탭: 전체 타임라인/주문/출고/당일출고/수금
→ 아래로 변경(기존 탭은 유지하되 위치/기본값 변경 가능)
* **Overview (기본 탭):** 요약 + 업무큐 + 최근활동
* **Activity(=전체):** 필터 가능한 통합 피드(주문/출고/반품/수금/수리)
* **Orders / Shipments / Returns / Payments / Repairs / Store Pickup**
* 기본 진입(view 파라미터 없을 때)은 overview로.

#### 4.2 Overview 화면(가독성 핵심)
상단부터 3단 구성:

**A) “스마트 버튼(요약)” 행 (Odoo 스타일)**
거래처 핵심 지표를 버튼 카드로 제공(각각 클릭 시 해당 탭/페이지로 이동)
* 미수/선수(현금): receivable/credit 표시
* 현물 미수: gold_outstanding_g / silver_outstanding_g
* 오픈 미수건수: open invoices count
* 출고대기 주문: READY_TO_SHIP(+IN_PRODUCTION) 카운트
* 당일출고 확정 대기: store pickup 미확정 카운트
* 반품(최근 30일): return count + 금액 합
* 수리 진행중/출고대기: repairs 카운트

**B) “업무 큐(Work Queue)” 2열 그리드**
* **출고대기 주문 Top N (N=8 기본, 더보기)**
    * 기존 InlineShipmentCreator 그대로 사용 (기능 바꾸지 말고 “배치”만 개선)
* **미수 회수 필요 Top N**
    * AR 오픈 인보이스(또는 포지션)에서 outstanding 큰 순/오래된 순
    * 버튼: 수금등록(기존 /ar?party_id=...) / 상세(AR 탭으로)
* **당일출고 확정 대기 Top N**
    * 기존 로직 유지(체크박스/일괄확정/확정 후 인쇄)
* **반품 최근 Top N**
    * 반품 라인(occurred_at, reason, 금액) 목록 + 출고 라인(모델명) 표시
* **(선택) 수리 Top N**
    * cms_v_repair_line_enriched_v1에서 party 기준 필터 후 진행중 우선

**C) “최근 활동(Recent Activity)” 미니 피드**
* 최근 30일 기본
* 타입 칩(주문/출고/반품/수금/수리)로 빠른 필터

### 5) 데이터 소스(읽기 전용으로 구성)
#### 5.1 거래처 요약/미수(현금+현물)
* 기존 PartyInfoCard는 cms_v_ar_balance_by_party에서 balance_krw만 사용 중
* → **CONTRACTS.views.arPositionByParty (= cms_v_ar_position_by_party_v2)**로 교체:
    * receivable_krw, credit_krw, labor_cash_outstanding_krw, material_cash_outstanding_krw
    * gold_outstanding_g, silver_outstanding_g
    * last_activity_at

#### 5.2 주문
* cms_order_line (기존 그대로)
* 상태 그룹핑: ORDER_PENDING/ORDER_CONFIRMED/IN_PRODUCTION/READY_TO_SHIP/SHIPPED/CANCELLED

#### 5.3 출고
* cms_shipment_header + cms_shipment_line
* “전체 피드”에서 날짜 기준:
    * confirmed면 confirmed_at, 아니면 created_at(header select에 추가) 또는 ship_date
    * 현재 코드의 new Date() fallback 금지 (섞여 보이는 주요 원인)

#### 5.4 수금
* cms_payment_header (기존)
* (가능하면) “어떤 미수에 상계됐는지”는 심화로: cms_v_ar_payment_alloc_detail_v1 사용(추후). 이번에는 총액/메모/일시 중심으로도 OK.

#### 5.5 반품
* cms_return_line + cms_shipment_line(모델명 등)
* select 예: return_line_id, occurred_at, final_return_amount_krw, reason, shipment_line_id, cms_shipment_line(model_name, qty)
* “반품”은 Activity/Overview에 반드시 포함

#### 5.6 수리
* CONTRACTS.views.repairLineEnriched (= cms_v_repair_line_enriched_v1)
* party_id 기준 필터 가능한 컬럼 확인 후 적용(없으면 최소 join/필터로 구현)

### 6) Activity(통합 피드) 설계 (가독성 최우선)
#### 6.1 “타입별 카드 UI” 규칙
각 아이템은 왼쪽에 타입 아이콘 + 타입 라벨 배지를 고정:
* 주문: 🧾 “ORDER”
* 출고: 📦 “SHIPMENT”
* 반품: ↩️ “RETURN”
* 수금: 💳 “PAYMENT”
* 수리: 🛠️ “REPAIR”

각 타입별로 필수 표시 필드를 통일:
* **주문:** 모델명 / 옵션(색/사이즈/도금) / 수량 / 상태
* **출고:** 모델명 / 수량 / 금액 / (확정여부)
* **반품:** 모델명 / 반품수량 / 반품금액 / 사유
* **수금:** 금액 / 메모 / (현금·현물 결제면 breakdown 표시 가능하면 표시)
* **수리:** 모델명 / 진행상태 / 비용(있으면)

#### 6.2 필터 UX (Dynamics 타임라인 패턴)
* 상단 필터바:
    * 기간: 7일 / 30일 / 90일 / 전체
    * 타입 칩 토글(복수 선택)
    * 검색: 모델명/메모/사유 텍스트 검색(클라이언트 필터 가능)
* 기본 정렬: occurred_at/created_at 기준 최신순

#### 6.3 성능 요구
* 각 쿼리는 기본 limit(200) + 기간 조건(30/90일 등) 적용
* “더 보기” 클릭 시 pagination(또는 limit 상향)로 추가 로드

### 7) “문서 흐름(관계도)” 옵션(가능하면 포함, 최소 버전)
SAP B1의 Relationship Map처럼, 선택한 항목을 클릭하면 우측(또는 모달)에서 연결 문서를 보여줌.
* **MVP 버전:**
    * 주문 클릭 → 연결된 출고 라인(있으면) 리스트
    * 출고 클릭 → 연결된 AR 인보이스/미수(outstanding) 요약(가능하면 cms_v_ar_invoice_position_v1에서 shipment_line_id로 조회)
    * 반품 클릭 → 어떤 출고라인에서 발생했는지 + 반품금액
    * 수금 클릭 → (최소) 거래처 AR 페이지 링크
* 이 섹션은 “완벽 구현” 기준에선 강력 추천. 단, 시간이 빡세면 1차는 “출고→미수 요약”까지만.

### 8) 구현 지시(파일/리팩터링 가이드)
#### 8.1 workbench/[partyId]/page.tsx 구조 정리
현재 파일이 너무 크므로 컴포넌트 분리 권장(동작은 동일):
* PartyInfoCard 개선(현금+현물)
* WorkbenchOverview (새로)
* WorkbenchActivityFeed (새로)
* WorkbenchReturnsTab (새로)
* WorkbenchRepairsTab (새로)
* 기존 Orders/Shipments/Payments/StorePickup 탭은 UI만 정렬 개선

폴더 제안: `web/src/app/(app)/workbench/[partyId]/_components/*`
예: `_components/workbench-overview.tsx`, `_components/workbench-activity.tsx` …

#### 8.2 ViewType 확장
```typescript
type ViewType = "overview" | "activity" | "orders" | "shipments" | "returns" | "payments" | "repairs" | "store_pickup";
```
* 기존 timeline은 activity로 rename하거나 label만 바꾸되, URL 파라미터 호환을 위해 timeline도 alias 처리 가능.

#### 8.3 PartyInfoCard 개선(핵심)
* arBalanceByParty → arPositionByParty 사용
* UI 표기:
    * 현금: “미수(₩)” / “선수(₩)” 분리 표기
    * 현물: “미수 금(g) / 은(g)” 별도 라인
    * 마지막 활동일(last_activity_at)

#### 8.4 GlobalPartySelector(선택 개선)
* 사용자 체감상 “검색 결과가 정리 안 됨”을 줄이려면: 드롭다운 결과에 balance(₩) 와 last_tx_at 정도는 노출 권장
* 구현은 검색 결과 party_id 10개에 대해 .in('party_id', ids)로 cms_v_ar_balance_by_party 또는 cms_v_ar_position_by_party_v2를 한 번 더 가져와 merge(추가 API/RPC 없이도 가능)

### 9) 수용 기준(Acceptance Criteria)
1. Workbench 진입 시 기본 탭이 Overview이고, 상단 Smart Buttons가 보인다.
2. Activity(전체)에서 주문/출고/반품/수금/수리가 모두 보이며, 아이콘/라벨로 즉시 구분된다.
3. Activity에서 기간/타입 필터가 동작하고, 데이터가 많아도 기본 로딩이 과도하게 느려지지 않는다(limit+load more).
4. PartyInfoCard에 **현금 미수/선수 + 금/은 미수(g)**가 표시된다.
5. 기존 핵심 기능 유지:
    * 주문→출고(InlineShipmentCreator)
    * 당일출고 확정/일괄확정 + 인쇄
    * AR 수금등록 링크

### 10) QA 체크리스트(테스트 시나리오)
* **거래처 A:** 주문만 있는 경우 → Overview 출고대기/활동이 정상 표시
* **거래처 B:** 출고 확정 전/후 섞인 경우 → 날짜가 뒤섞이지 않고, “확정됨/미확정” 구분됨
* **거래처 C:** 반품 존재 → Activity/Returns 탭/Overview 반품 위젯에 반품이 표시
* **거래처 D:** 현물 결제(금/은)로 미수 남아있는 경우 → gold_outstanding_g / silver_outstanding_g 표시
* **거래처 E:** 데이터 500건 이상(가정) → 기본 30일/200건 로딩, 더보기로 확장