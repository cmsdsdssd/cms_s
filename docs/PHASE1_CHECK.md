# Phase1 UI/UX “코딩 체크리스트” (컨테이너 ID · 그리드 · 컴포넌트 · Validation · Toast · Skeleton)

> **코딩 에이전트 필독**
> 구현 중 정책/세부 필드가 애매하면:
> `C:\Users\RICH\.gemini\antigravity\scratch\cms_s\docs` 안의 md 문서들을 참고하되, **헌법(LOCK) 위반은 절대 금지**.

---

## A) 전역 헌법(LOCK) — 이거 어기면 전부 반려

* [ ] **base table 직접 write 금지** (INSERT/UPDATE/DELETE 금지) 
* [ ] 모든 쓰기 = **`cms_fn_*` RPC만 호출** 
* [ ] **버튼 1개 = RPC 1회** (한 버튼에서 여러 write 연쇄 금지) 
* [ ] **confirm/가격/AR 계산 로직 UI 재구현 금지** 
* [ ] **UUID 직접 입력 UX 금지** (검색/리스트 선택만) 
* [ ] Confirm 가드(필수):

  * 라인 0개면 confirm 금지 
  * 14/18/24 RULE 라인 measured_weight 없으면 금지 
  * is_plated=true인데 plating_variant_id 없으면 금지 

---

## B) 전역 레이아웃/컴포넌트 규격(모든 페이지 공통)

### B1) 그리드 시스템(12-col)

* Desktop: `12-col grid`

  * Left(List): **4~5 cols (35~45%)**
  * Right(Detail): **7~8 cols (55~65%)**
* Tablet 이하: List/Detail **세로 스택** (Detail은 Drawer/Route 전환 가능)

### B2) 컨테이너 ID 네이밍

* 페이지 루트: `{page}.root`
* 상단바: `{page}.actionBar`
* 필터바: `{page}.filterBar`
* 바디: `{page}.body`
* 리스트: `{page}.listPanel`
* 상세: `{page}.detailPanel`
* 공통 상세 스택: `{page}.detail.basic`, `{page}.detail.table`, `{page}.detail.summary`, `{page}.detail.activity`, `{page}.detail.raw`

### B3) 공통 컴포넌트 타입

* `ActionBar` (페이지 제목 + 우측 CTA)
* `FilterBar` (search + dropdown + “More Filters”)
* `CardList` + `ListCard`
* `DetailStack` (Container 4~6개 스택)
* `DataTable` (인라인 편집 가능)
* `Modal` (검색/선택/확정/결제/반품 등)
* `Toast` (성공/실패/가드 안내)
* `Skeleton` (List/Table/Detail)

### B4) 전역 로딩/상태(필수)

* [ ] **Initial Load**: List Skeleton 6~10개 + Detail Skeleton(기본정보 2블록 + 테이블 5행)
* [ ] **Refetch**: 리스트 상단에 얇은 progress bar(또는 shimmer) + 기존 데이터 유지
* [ ] **Empty**: “데이터 없음” + CTA(새로 만들기)
* [ ] **Error**: “다시 시도” 버튼 + 오류 ID(로그용)
* [ ] **Saving**: 버튼 스피너 + 폼 disabled(최소)
* [ ] **Modal Loading**: 검색 결과 skeleton 5개

### B5) 전역 Toast 규격(문구 템플릿)

* 성공(저장): `저장 완료` / sub: `{entity} 업데이트됨`
* 성공(생성): `생성 완료` / sub: `{entity} 생성됨`
* 성공(삭제): `삭제 완료`
* 실패(유효성): `필수 항목을 확인해 주세요` / sub: `{fieldLabel}`
* 실패(RPC): `처리 실패` / sub: `잠시 후 다시 시도해 주세요`
* Confirm 실패(가드):

  * `출고 확정 불가: 라인이 없습니다`
  * `출고 확정 불가: 실측중량이 필요합니다`
  * `출고 확정 불가: 도금 Variant를 선택해 주세요`

### B6) 전역 Validation 규칙(폼 공통)

* Required: 빨간 `*` + blur 시 즉시 에러
* 숫자:

  * `qty`: 정수, `>=1`
  * `weight_g`: 숫자, `>=0` (null 금지)
  * 금액: 숫자, `>=0` (반품/차감은 별도 필드로 - 허용)
* 날짜: 기본값 today, 미래 허용 여부는 화면 요구에 맞춤
* select: “선택하세요” placeholder, 미선택 시 에러

---

# C) 페이지별 “그대로 구현” 체크리스트

---

## C1) Party (거래처)

### 레이아웃

* [ ] `party.root` (12-col)
* [ ] `party.actionBar` (full width)

  * [ ] 좌: Title “Party”
  * [ ] 우: `+ New Party` (Primary)
* [ ] `party.filterBar` (full width)

  * [ ] `party.filters.type` (Dropdown: customer/vendor)
  * [ ] `party.filters.region` (Dropdown)
  * [ ] `party.filters.active` (Dropdown: Active/Inactive)
  * [ ] `party.filters.search` (Input: name/phone)
* [ ] `party.body` (12-col)

  * [ ] `party.listPanel` (4~5 cols) — `CardList`
  * [ ] `party.detailPanel` (7~8 cols) — `DetailStack`

### 리스트 카드(`party.card`)

* [ ] Title: `{party_name}`
* [ ] Badge: `{type}`
* [ ] Meta: `{region} · {phone}`
* [ ] Right actions: `Edit` / `Deactivate(옵션)` (Phase1은 upsert 중심)

### 상세(우측 스택)

1. `party.detail.basic` (Form)

* Fields

  * [ ] `name*` (text)
  * [ ] `type*` (select customer/vendor)
  * [ ] `phone` (text)
  * [ ] `region` (text/select)
  * [ ] `address` (text)
  * [ ] `note` (textarea)
* Validation

  * [ ] name required
  * [ ] type required
* CTA

  * [ ] `party.btn.save` → RPC: `cms_fn_upsert_party_v1`
* Toast

  * [ ] success: `저장 완료`
  * [ ] fail: `처리 실패`

2. `party.detail.activity` (optional)

* [ ] Activity 타임라인(있으면)

3. `party.detail.skeleton`

* [ ] 기본정보 6줄 스켈레톤 + 저장버튼 disabled

---

## C2) Orders (주문 라인)

### 레이아웃

* [ ] `orders.actionBar`: Title “Orders” + `+ New Order Line`
* [ ] `orders.filterBar`

  * [ ] `orders.filters.customer` (SearchSelect)
  * [ ] `orders.filters.status` (Dropdown)
  * [ ] `orders.filters.dateRange` (DateRange)
  * [ ] `orders.filters.searchModel` (Search)
  * [ ] `orders.filters.more` (Button → popover: vendor_guess, plated, due_soon)
* [ ] `orders.body`

  * Left(4~5 cols): `orders.quickCreate` + `orders.listPanel`
  * Right(7~8 cols): `orders.detailPanel`

### `orders.quickCreate` (컨테이너)

* Fields (최단 입력) 

  * [ ] `customer*` (SearchSelect)
  * [ ] `model_name*`
  * [ ] `suffix*`
  * [ ] `color*`
  * [ ] `qty` (default 1)
  * [ ] `is_plated` (checkbox)
  * [ ] `plating_variant` (SearchSelect) — **is_plated=true일 때만 표시 + required**
* Validation

  * [ ] customer/model_name/suffix/color required
  * [ ] qty integer >=1
  * [ ] if is_plated then plating_variant required
* CTA

  * [ ] `orders.btn.create` → RPC: `cms_fn_upsert_order_line_v1`
* Toast

  * [ ] success: `생성 완료`
  * [ ] validation: `필수 항목을 확인해 주세요`
  * [ ] rpc fail: `처리 실패`

### 리스트 카드(`orders.card`)

* [ ] Title: `{model_name}{suffix}` + Badge `{status}`
* [ ] Tiles: `qty`, `plated`, `due(optional)`, `created_at`
* [ ] Select checkbox(다중 선택)
* [ ] Quick action: “Create Shipment from Selected” (버튼)

### 모달: `orders.modal.createShipmentFromSelected`

* Trigger: `orders.btn.createShipmentFromSelected`
* Content

  * [ ] 선택된 라인 요약 테이블(거래처별 그룹)
  * [ ] Confirm 버튼(Primary)
* Actions

  * [ ] (구현 방식) **Shipment 생성은 서버에 이미 있는 함수 흐름을 따라야 함**

    * 최소 요구: “선택 라인 → customer 단위로 shipment draft 생성 + 라인 추가”
* Toast

  * [ ] success: `출고 생성 완료`
  * [ ] fail: `출고 생성 실패`

### 상세 패널 `orders.detailPanel` (컨테이너 스택)

1. `orders.detail.basic` (Form)

* [ ] 필드: quickCreate와 동일 + 메모(옵션)
* [ ] Save → `cms_fn_upsert_order_line_v1`

2. `orders.detail.activity`

* [ ] status_event/로그 표시(타임라인)

3. `orders.detail.raw`

* [ ] Raw JSON(접힘)

### 스켈레톤

* [ ] List skeleton 8 cards
* [ ] Detail skeleton: 기본정보 6줄 + activity 3줄 + 버튼 2개

---

## C3) Repairs (수리)

### 레이아웃

* [ ] `repairs.actionBar`: Title “Repairs” + `+ New Repair`
* [ ] `repairs.filterBar`: customer/status/received_at/search(model)
* [ ] `repairs.body`: left list / right detail

### Quick Create(옵션) `repairs.quickCreate`

* Fields 

  * [ ] `customer*`
  * [ ] `received_at*` (date)
  * [ ] `model_name`
  * [ ] `suffix`
  * [ ] `color`
  * [ ] `material`
  * [ ] `qty` (default 1)
  * [ ] `measured_weight` (number, >=0)
  * [ ] `is_paid` (toggle: 유상/무상)
  * [ ] `repair_fee_krw` (유상일 때 required)
  * [ ] `is_plated` + `plating_variant` (is_plated=true일 때 required)
* Validation

  * [ ] customer, received_at required
  * [ ] qty integer >=1
  * [ ] if is_paid then repair_fee_krw required
  * [ ] if is_plated then plating_variant required
* CTA

  * [ ] Save/Create → `cms_fn_upsert_repair_line_v1`
* Toast

  * [ ] success: `접수 저장 완료`
  * [ ] fail: `처리 실패`

### 리스트 카드(`repairs.card`)

* [ ] Title: `{customer_name}` + Badge `{status}`
* [ ] Meta: `{received_at}`
* [ ] Tiles: `qty`, `paid/free`, `plated`

### 상세 스택

* [ ] `repairs.detail.basic` (동일 폼)
* [ ] `repairs.detail.activity`
* [ ] `repairs.detail.raw`

### 스켈레톤

* [ ] list 8 cards + detail 1 form + activity skeleton

---

## C4) Shipments (출고) — 핵심

### 레이아웃

* [ ] `shipments.actionBar`

  * [ ] Title “Shipments”
  * [ ] Buttons:

    * [ ] `+ New Shipment` (Secondary)
    * [ ] `Save` (Secondary) — Draft 편집 시
    * [ ] `Confirm Shipment` (Primary)
    * [ ] `Delete` (Danger)
* [ ] `shipments.filterBar`: customer/status/date/search
* [ ] `shipments.body`: left list / right detail

### 리스트 카드(`shipments.card`)

* [ ] Title: `{shipment_id_short}` + Badge `{status}`
* [ ] Tiles: `line_count`, `total_sell`, `total_cost`, `ship_date`
* [ ] Quick action: open / delete (권한 범위 내)

### 상세 패널 스택(우측) — 컨테이너 ID 고정

1. `shipments.detail.header` (Shipment Header)

* Fields

  * [ ] `customer*` (SearchSelect)
  * [ ] `ship_date` (date)
  * [ ] `ship_to_address` (text)
  * [ ] `memo` (textarea)
* CTA

  * [ ] `shipments.btn.createHeader` (신규 시) → `cms_fn_create_shipment_header_v1`
  * [ ] `shipments.btn.saveHeader` (편집 시) → (헤더 upsert가 별도면 해당 RPC 사용, 없으면 header는 생성 후 line 변경만)
* Validation

  * [ ] customer required (생성 시)
* Toast

  * [ ] success: `출고 문서 생성 완료` / `저장 완료`
  * [ ] fail: `처리 실패`

2. `shipments.detail.addLines` (3 버튼)

* [ ] `shipments.btn.addFromOrder` → Modal: `shipments.modal.pickOrders`
* [ ] `shipments.btn.addFromRepair` → Modal: `shipments.modal.pickRepairs`
* [ ] `shipments.btn.addAdHoc` → Modal: `shipments.modal.addAdHoc`

**모달 공통 규칙(LOCK)**

* [ ] UUID 입력 금지, 반드시 검색/선택 
* [ ] Confirm 클릭 시 “RPC 1회”만 호출 

2-1) `shipments.modal.pickOrders`

* Components: Search + Filters + Results Table + Multi-select
* Action

  * [ ] Confirm → `cms_fn_add_shipment_line_from_order_v1` (선택 라인 각각 또는 서버가 batch 지원 시 1회로)
* Validation

  * [ ] 선택 1개 이상
* Toast

  * [ ] success: `주문 라인 추가 완료`
  * [ ] fail: `추가 실패`

2-2) `shipments.modal.pickRepairs`

* Action

  * [ ] Confirm → `cms_fn_add_shipment_line_from_repair_v1`
* 동일 패턴

2-3) `shipments.modal.addAdHoc`

* Fields(최소)

  * [ ] `model_name*`, `suffix`, `qty*`, `material`, `color`, `is_plated`, `plating_variant`
  * [ ] `pricing_mode*` (RULE/UNIT/AMOUNT_ONLY)
  * [ ] `unit_price` (UNIT일 때 required)
  * [ ] `manual_total` (AMOUNT_ONLY일 때 required)
* Action

  * [ ] Confirm → `cms_fn_add_shipment_line_ad_hoc_v1`
* Validation

  * [ ] model_name required
  * [ ] qty integer >=1
  * [ ] pricing_mode required
  * [ ] UNIT → unit_price required
  * [ ] AMOUNT_ONLY → manual_total required

3. `shipments.detail.linesTable` (인라인 편집 DataTable)

* Columns(표시 + 편집)

  * [ ] `ref_type/ref_id` (read only)
  * [ ] `model_name` (editable; 변경 시 마스터 기본값 로드)
  * [ ] `qty` (editable)
  * [ ] `material` (editable)
  * [ ] `pricing_mode` (editable: RULE/UNIT/AMOUNT_ONLY)
  * [ ] `measured_weight` (editable; 핵심)
  * [ ] `deduction_override` (toggle + value)
  * [ ] `is_plated` (toggle)
  * [ ] `plating_variant` (select; is_plated=true일 때 required)
  * [ ] `unit_price` (UNIT일 때 show)
  * [ ] `manual_total` (AMOUNT_ONLY일 때 show)
  * [ ] Row actions: `Save row` / `Delete row`
* RPC

  * [ ] Row Save → `cms_fn_update_shipment_line_v1` (행 단위 1회)
  * [ ] Row Delete → `cms_fn_delete_shipment_line_v1`
* Row Validation(즉시)

  * [ ] qty integer >=1
  * [ ] measured_weight: 숫자 >=0 (단, confirm 가드 조건에 걸리면 “필수”로 강제)
  * [ ] if is_plated then plating_variant required
  * [ ] if pricing_mode=UNIT then unit_price required
  * [ ] if pricing_mode=AMOUNT_ONLY then manual_total required
* Row Toast

  * [ ] save success: `라인 저장 완료`
  * [ ] delete success: `라인 삭제 완료`
  * [ ] validation: `라인 필수값을 확인해 주세요`

4. `shipments.detail.summary`

* [ ] KPI tiles:

  * [ ] `line_count`
  * [ ] `estimated_total_sell` / `estimated_total_cost` (Draft에서는 “예상” 라벨)
  * [ ] Confirmed에서는 `total_sell_krw`, `total_cost_krw`, `confirmed_at` 강조

5. `shipments.detail.confirm`

* UI 사전검증(버튼 disable 조건)

  * [ ] 라인 0개면 Confirm disabled 
  * [ ] (조건 해당 시) measured_weight 누락 라인 존재하면 disabled 
  * [ ] is_plated=true & plating_variant 누락 존재하면 disabled 
* Action

  * [ ] Click Confirm → RPC `cms_fn_confirm_shipment` (1회) 
* Success handling

  * [ ] Toast: `출고 확정 완료`
  * [ ] Summary 즉시 갱신(총원가/총판매/confirmed_at)
  * [ ] 헤더/라인 편집 잠금(읽기 전환)
* Failure handling(가드 매핑)

  * [ ] 라인 0개: 토스트 + addLines 컨테이너로 스크롤
  * [ ] 중량 누락: 해당 행/필드 하이라이트 + “실측중량 필요”
  * [ ] plating 누락: 해당 행/필드 하이라이트 + “도금 Variant 선택”

6. `shipments.detail.activity`

* [ ] decision_log/status_event 타임라인(서버 제공 로그 기반)

7. `shipments.detail.raw`

* [ ] Raw JSON (접힘)

### Shipments 스켈레톤

* [ ] List skeleton 6 cards(썸네일/타일 포함)
* [ ] Detail skeleton:

  * header 4줄
  * addLines 버튼 3개 placeholder
  * table 6행 skeleton
  * summary 3 tiles skeleton
  * confirm 버튼 disabled skeleton

---

## C5) AR (미수/결제/반품)

### 레이아웃

* [ ] `ar.actionBar`: Title “AR” + `+ Record Payment` + `+ Record Return`
* [ ] `ar.filterBar`: search party / balance range / date range
* [ ] `ar.body`: left party list / right ledger detail

### 좌측 리스트 카드(`ar.partyCard`)

* [ ] Title: `{party_name}`
* [ ] KPI: `balance_krw` (큰 숫자)
* [ ] Badge: `CREDIT`(음수) / `DUE`(양수)

### 우측 상세 스택

1. `ar.detail.summary`

* [ ] KPI tiles: balance, last_payment_at, last_shipment_at (있으면)

2. `ar.detail.ledgerTable`

* [ ] DataTable columns: occurred_at, entry_type(SHIPMENT/PAYMENT/RETURN), ref, amount(+/-), memo
* [ ] Pagination / date filter

3. `ar.modal.payment` (Record Payment)

* Components

  * [ ] party select(required)
  * [ ] occurred_at(default today)
  * [ ] tenderLines table (행 추가/삭제)

    * columns: method(select), amount(number), note(text)
  * [ ] total sum panel(자동 합)
* Validation

  * [ ] party required
  * [ ] tenderLines 최소 1행
  * [ ] 각 행 amount >0
  * [ ] total >0
* Action

  * [ ] Confirm → `cms_fn_record_payment`
* Toast

  * [ ] success: `결제 등록 완료`
  * [ ] validation: `결제 금액을 확인해 주세요`
  * [ ] fail: `결제 등록 실패`

4. `ar.modal.return` (Record Return)

* Components

  * [ ] party select(required)
  * [ ] shipment/line search & select(required)
  * [ ] qty(required, >=1)
  * [ ] amount auto-calc + override(optional)
  * [ ] memo
* Validation

  * [ ] selection required
  * [ ] qty integer >=1
  * [ ] amount >=0 (override 허용)
* Action

  * [ ] Confirm → `cms_fn_record_return`
* Toast

  * [ ] success: `반품 등록 완료`
  * [ ] fail: `반품 등록 실패`

### AR 스켈레톤

* [ ] party list skeleton 8
* [ ] ledger table skeleton 10 rows
* [ ] modal skeleton: form 4줄 + table 3행

---

## C6) Master (마스터카드)

### 레이아웃

* [ ] `master.actionBar`: Title “Master”
* [ ] `master.filterBar`: search(model_name) / category / material / active
* [ ] `master.body`: left list / right detail

### 리스트 카드(`master.card`)

* [ ] Title: `{model_name}`
* [ ] Meta: category/material
* [ ] Tiles: default deduction / plating default / labor profile 요약

### 상세 스택

1. `master.detail.basic`

* Fields

  * [ ] model_name (read or editable 정책에 맞춤)
  * [ ] category
  * [ ] standard_material
  * [ ] default_deduction_g
  * [ ] plating defaults
  * [ ] labor profile (참조/설정)
* Validation

  * [ ] category required(정책상 필수면)
* Action

  * [ ] Save → (해당 upsert RPC)
* Toast

  * [ ] success: `마스터 저장 완료`

2. `master.detail.raw`

* [ ] Raw JSON(접힘)

### 스켈레톤

* [ ] list 8 cards + detail form 6줄

---

# D) “완료 정의” 체크(코딩 끝나면 마지막으로)

* [ ] 모든 쓰기 동작이 **RPC로만** 연결되어 있음 
* [ ] Confirm 가드 3종이 UI에서 **disable + 필드 하이라이트 + 토스트**로 재현됨 
* [ ] UUID 직접 입력 필드가 단 한 군데도 없음 
* [ ] 모든 페이지에 Skeleton/Empty/Error 상태가 존재
* [ ] 리스트/상세 패턴이 레퍼런스처럼 “컨테이너 스택”으로 일관됨

---