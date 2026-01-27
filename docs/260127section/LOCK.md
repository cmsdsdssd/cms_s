# CMS Phase1 SoT 고정 문서 (public.cms_*) — v1.1 (Lock)
> 이 문서는 **public 스키마의 cms_* 오브젝트만**을 단일 진실(SoT)로 고정한다.  
> Phase1 구현(Next.js/Retool/기타 UI)은 **반드시 이 문서만**을 기준으로 읽기/쓰기/계산을 수행한다.

---

## 0) 범위 고정 (Scope)
### 0.1 SoT(단일 진실)
- ✅ **SoT = `public.cms_*`**
- ❌ `ms_s.*`는 **이번 Phase1 범위에서 조회/조인/수정/삽입/삭제 전부 금지**
- ❌ `public.master_item`, `public.order_line` 등 **cms_ prefix 없는 동명 테이블은 전부 금지**
  - 지금 DB에 `public.master_item` 같은 잔존물이 있어도 **절대 사용하지 않는다**
  - UI/백엔드는 “cms_만 사용”을 하드코딩 수준으로 고정

### 0.2 읽기/쓰기 규범 (헌법)
- **WRITE(삽입/수정/삭제)**: 반드시 **RPC(= `public.cms_fn_*`)만**
- **READ(조회)**: 기본은 **뷰 `public.cms_v_*` 우선**, 필요할 때만 base table select
- **계산(시세/원가/판매가/정산/AR 반영)**: **DB에서 확정 계산 → 결과를 cms_shipment_line 등에 저장**
  - 프론트는 “표시/입력/검증/미리보기”만 담당
  - “확정(confirmed/priced_final)”은 항상 DB RPC가 최종

### 0.3 로그/추적(감사) 규칙
- 상태 변화는 `public.cms_status_event`에 남아야 한다 (log 함수 존재)
- 중요한 값 변화(정책 선택/오버라이드/확정)는 `public.cms_decision_log`로 남긴다 (현존)
- `correlation_id`는 **가능하면 모든 생성/상태변경 흐름에 넣는다**
  - 현재 일부 테이블에만 있음(예: order_line/repair_line)
  - RPC 시그니처에 없으면 UI에서 저장은 못하므로, 최소한 “UI 로깅/클라이언트 trace”로 보완하고 v2에서 확장

---

## 1) 오브젝트 목록 (확정)
### 1.1 Base Tables (public)
- `cms_party`
- `cms_person`
- `cms_party_person_link`
- `cms_party_address`
- `cms_vendor_prefix_map`

- `cms_master_item`

- `cms_order_line`
- `cms_repair_line`

- `cms_shipment_header`
- `cms_shipment_line`
- `cms_return_line`

- `cms_payment_header`
- `cms_payment_tender_line`

- `cms_ar_ledger`

- `cms_market_tick`
- `cms_labor_band_rule`
- `cms_plating_variant`
- `cms_plating_price_rule`

- `cms_status_event`
- `cms_decision_log`

### 1.2 Views (public)
- `cms_v_order_worklist`
- `cms_v_repair_line_enriched_v1`
- `cms_v_ar_balance_by_party`
- `cms_v_ar_position_by_party`

### 1.3 RPC (public.cms_fn_*) — Phase1에서 “쓰기/업무 처리”는 이것만
#### 주문/판매
- `cms_fn_upsert_order_line_v1(...)`

#### 거래처
- `cms_fn_upsert_party_v1(...)`

#### 수리
- `cms_fn_upsert_repair_line_v1(...)`

#### 출고(헤더/라인/확정)
- `cms_fn_create_shipment_header_v1(...)`
- `cms_fn_add_shipment_line_from_order_v1(...)`
- `cms_fn_add_shipment_line_from_repair_v1(...)`
- `cms_fn_add_shipment_line_ad_hoc_v1(...)`
- `cms_fn_update_shipment_line_v1(...)`
- `cms_fn_delete_shipment_line_v1(...)`
- `cms_fn_confirm_shipment(p_shipment_id, p_actor_person_id, p_note)`
- 내부 보호: `cms_fn__assert_shipment_draft(p_shipment_id)`

#### 결제/반품
- `cms_fn_record_payment(p_party_id, p_paid_at, p_tenders jsonb, p_memo)`
- `cms_fn_record_return(p_shipment_line_id, p_return_qty, p_occurred_at, p_override_amount_krw, p_reason)`

#### 시세/정책 선택 유틸
- `cms_fn_latest_tick(p_symbol)`
- `cms_fn_pick_labor_band_rule(p_category_code, p_band_code, p_on_date)`
- `cms_fn_pick_plating_rule(p_plating_variant_id, p_category_code, p_material_code, p_on_date)`

#### 공통/로그
- `cms_fn_set_updated_at()`
- `cms_fn_log_order_status_change()`
- `cms_fn_log_repair_status_change()`
- `cms_fn_log_shipment_status_change()`

---

## 2) 표준 컬럼/단위/용어 (전 테이블 공통 규칙)
### 2.1 단위
- 무게: `*_g` = grams(그램)
- 금액: `*_krw` = KRW(원)
- 시세: `*_krw_per_g` = 원/그램

### 2.2 시간
- `created_at`, `updated_at`: timestamptz
- “확정 시점”은 별도 컬럼 사용:
  - `cms_shipment_header.confirmed_at`
  - `cms_shipment_line.priced_at`

### 2.3 메모/노트
- `memo`: 업무 메모(운영자가 보는 텍스트)
- `note`: 정책/규칙/사유 텍스트
- `meta`: jsonb(기계가 쓰는 부가 데이터)

---

## 3) 관계(ER) — 핵심 연결만 고정
### 3.1 Party/Person
- `cms_party`(거래처/고객/공장 등) 1 ── N `cms_party_person_link` N ── 1 `cms_person`
- `cms_party` 1 ── N `cms_party_address`

### 3.2 판매/수리 → 출고
- 판매 라인: `cms_order_line`
- 수리 라인: `cms_repair_line`
- 출고 헤더: `cms_shipment_header`
- 출고 라인: `cms_shipment_line`
  - `cms_shipment_line.order_line_id` (판매에서 생성된 출고 라인)
  - `cms_shipment_line.repair_line_id` (수리에서 생성된 출고 라인)
  - ad-hoc 라인(`ad_hoc_*` 컬럼 사용)

### 3.3 결제/반품 → AR 원장
- 결제: `cms_payment_header` + `cms_payment_tender_line` → `cms_ar_ledger(payment_id 참조)`
- 반품: `cms_return_line` → `cms_ar_ledger(return_line_id 참조)`
- 출고 확정/정산: `cms_shipment_header/line` → `cms_ar_ledger(shipment_id/shipment_line_id 참조)`
- 최종 AR 포지션: `cms_v_ar_balance_by_party`, `cms_v_ar_position_by_party`

---

## 4) 테이블 데이터 딕셔너리 (정확 컬럼 기준)

> 아래는 네가 제공한 “컬럼/널/디폴트” 결과를 그대로 기반으로 작성했다.

---

### 4.1 `cms_party` (거래처/고객/공장)
**목적**: 모든 상대방(고객, 공장, 기타)을 단일 테이블로 관리

**PK**
- `party_id uuid` (default `gen_random_uuid()`)

**주요 컬럼**
- `party_type` (enum, NOT NULL) : 고객/공장 구분 등
- `name text` (NOT NULL)
- `phone text` (NULL)
- `region text` (NULL)
- `address text` (NULL)  ← 간이 주소(Phase1)
- `note text` (NULL)
- `is_active boolean` (NOT NULL, default true)
- `created_at timestamptz` (NOT NULL, default now())
- `updated_at timestamptz` (NOT NULL, default now())

**WRITE**
- `cms_fn_upsert_party_v1(p_party_type, p_name, p_phone, p_region, p_address, p_memo, p_party_id)`

---

### 4.2 `cms_person` (담당자)
**PK**
- `person_id uuid` (default `gen_random_uuid()`)

**주요 컬럼**
- `name text` (NULL)
- `phone text` (NULL)
- `note text` (NULL)
- `created_at`, `updated_at`

---

### 4.3 `cms_party_person_link` (거래처-담당자 연결)
**PK**
- (복합키 성격) `party_id` + `person_id` (둘 다 NOT NULL)

**주요 컬럼**
- `role text` (NULL)
- `is_primary boolean` (NOT NULL, default false)
- `created_at`

---

### 4.4 `cms_party_address` (거래처 주소 다중)
**PK**
- `address_id uuid` (default `gen_random_uuid()`)

**FK**
- `party_id uuid` (NOT NULL) → `cms_party.party_id`

**주요 컬럼**
- `label text` (NULL)
- `address_text text` (NOT NULL)
- `is_default boolean` (NOT NULL, default false)
- `created_at`, `updated_at`

---

### 4.5 `cms_vendor_prefix_map` (모델명 prefix → 공장 추정)
**PK(사실상)**
- `prefix text` (NOT NULL)  ※ 중복 금지 권장(제약 확인 필요)

**FK**
- `vendor_party_id uuid` (NOT NULL) → `cms_party.party_id`

**주요 컬럼**
- `note text` (NULL)
- `created_at`

---

### 4.6 `cms_master_item` (카달로그/마스터)
**목적**: 모델(제품) 기준의 기본 속성 + 공임/도금 기본값

**PK**
- `master_id uuid` (default `gen_random_uuid()`)

**FK**
- `vendor_party_id uuid` (NULL) → `cms_party.party_id` (공장)

**필수 컬럼(운영 핵심)**
- `model_name text` (NOT NULL) : 제품 키(운영 입력 표준)
- `category_code` (enum, NOT NULL)
- `deduction_weight_default_g numeric` (NOT NULL, default 0)
- `center_qty_default int` (NOT NULL, default 0)
- `sub1_qty_default int` (NOT NULL, default 0)
- `sub2_qty_default int` (NOT NULL, default 0)

**공임/도금 기본값(전부 NOT NULL, default 0)**
- sell: `labor_base_sell`, `labor_center_sell`, `labor_sub1_sell`, `labor_sub2_sell`, `labor_bead_sell`
- cost: `labor_base_cost`, `labor_center_cost`, `labor_sub1_cost`, `labor_sub2_cost`, `labor_bead_cost`
- plating default: `plating_price_sell_default`, `plating_price_cost_default`

**기타**
- `material_code_default` (enum, NULL)
- `weight_default_g numeric` (NULL)
- `labor_profile_mode text` (NOT NULL, default `'MANUAL'`)
- `labor_band_code text` (NULL) : `cms_labor_band_rule` 선택에 사용
- `note text` (NULL)
- `image_path text` (NULL)
- `created_at`, `updated_at` (둘 다 NOT NULL, default now())

**편집 권한(정책 고정)**
- admin + staff 모두 편집 허용(단, WRITE는 반드시 RPC로)

---

### 4.7 `cms_order_line` (판매/주문 라인)
**목적**: Phase1 주문은 “헤더 없이 라인 단위”로만 운영

**PK**
- `order_line_id uuid` (default `gen_random_uuid()`)

**FK**
- `customer_party_id uuid` (NOT NULL) → `cms_party.party_id`
- `plating_variant_id uuid` (NULL) → `cms_plating_variant.plating_variant_id`
- `matched_master_id uuid` (NULL) → `cms_master_item.master_id` (추정, 실제 FK 제약 여부는 확인 필요)
- `vendor_party_id_guess uuid` (NULL) → `cms_party.party_id` (추정 공장)

**주요 입력 컬럼**
- `model_name text` (NOT NULL)
- `model_name_raw text` (NULL) : 원문 보존 (현재 upsert RPC 인자에 없음 → v2 고려)
- `suffix text` (NOT NULL)
- `color text` (NOT NULL)
- `size text` (NULL)
- `qty int` (NOT NULL, default 1)
- `is_plated boolean` (NOT NULL, default false)
- `requested_due_date date` (NULL)  ※ 현재 upsert RPC 인자에 없음(입력까지 하려면 v2 필요)
- `priority_code` (enum, NOT NULL, default 'NORMAL')
- `memo text` (NULL)

**상태/매칭**
- `status` (enum, NOT NULL, default 'ORDER_PENDING')
- `match_state` (enum, NOT NULL, default 'UNMATCHED')

**추적**
- `source_channel text` (NULL)
- `correlation_id uuid` (NULL)
- `created_at`, `updated_at` (NOT NULL, default now())

**WRITE**
- `cms_fn_upsert_order_line_v1(...)`만 사용

**UI 입력 검증(고정)**
- `is_plated=true`이면 `plating_variant_id` 필수(프론트+DB 둘 다에서 막는 게 맞음)

---

### 4.8 `cms_repair_line` (수리 라인)
**PK**
- `repair_line_id uuid` (default `gen_random_uuid()`)

**FK**
- `customer_party_id uuid` (NOT NULL) → `cms_party.party_id`
- `plating_variant_id uuid` (NULL) → `cms_plating_variant`

**주요 컬럼**
- `received_at date` (NOT NULL)
- `model_name text` (NULL 가능)
- `model_name_raw text` (NULL)
- `suffix text` (NULL)
- `material_code` (enum, NULL)
- `color text` (NULL)
- `qty int` (NOT NULL, default 1)
- `weight_received_g numeric` (NULL)
- `is_plated boolean` (NOT NULL, default false)
- `repair_fee_krw numeric` (NOT NULL, default 0)
- `is_paid boolean` (NOT NULL, default false)
- `requested_due_date date` (NULL)
- `priority_code` (enum, NOT NULL, default 'NORMAL')
- `status` (enum, NOT NULL, default 'RECEIVED')
- `memo text` (NULL)
- `source_channel text` (NULL)
- `correlation_id uuid` (NULL)
- `created_at`, `updated_at`

**WRITE**
- `cms_fn_upsert_repair_line_v1(...)`

---

### 4.9 `cms_shipment_header` (출고 헤더)
**PK**
- `shipment_id uuid` (default `gen_random_uuid()`)

**FK**
- `customer_party_id uuid` (NOT NULL) → `cms_party.party_id`
- `ship_to_address_id uuid` (NULL) → `cms_party_address.address_id`

**주요 컬럼**
- `ship_date date` (NULL)
- `memo text` (NULL)
- `status` (enum, NOT NULL, default 'DRAFT')
- `confirmed_at timestamptz` (NULL)
- `created_at`, `updated_at` (NOT NULL, default now())

**WRITE**
- 생성: `cms_fn_create_shipment_header_v1(...)`
- 확정: `cms_fn_confirm_shipment(...)` (핵심)

---

### 4.10 `cms_shipment_line` (출고 라인 + 가격/원가 확정 저장소)
**목적**: Phase1에서 “금액 계산의 결과가 저장되는 최종 테이블”

**PK**
- `shipment_line_id uuid` (default `gen_random_uuid()`)

**FK**
- `shipment_id uuid` (NOT NULL) → `cms_shipment_header.shipment_id`
- `order_line_id uuid` (NULL) → `cms_order_line.order_line_id`
- `repair_line_id uuid` (NULL) → `cms_repair_line.repair_line_id`
- `plating_variant_id uuid` (NULL) → `cms_plating_variant`
- `gold_tick_id uuid` (NULL) → `cms_market_tick.tick_id`
- `silver_tick_id uuid` (NULL) → `cms_market_tick.tick_id`

**라인 식별/입력**
- `ad_hoc_mode text` (NOT NULL, default 'NONE')  
- `ad_hoc_category_code` (enum, NULL)
- `ad_hoc_name text` (NULL)
- `category_code` (enum, NULL)
- `model_name text` (NULL)
- `suffix text` (NULL)
- `color text` (NULL)
- `size text` (NULL)
- `qty int` (NOT NULL, default 1)

**무게**
- `measured_weight_g numeric` (NULL)
- `deduction_weight_g numeric` (NOT NULL, default 0)
- `net_weight_g numeric` (NULL)

**가격 모드**
- `pricing_mode` (enum, NOT NULL, default 'RULE')
- `unit_price_krw numeric` (NULL)
- `unit_price_includes_plating boolean` (NOT NULL, default true)
- `manual_total_amount_krw numeric` (NULL)

**시세/재질**
- `material_code` (enum, NULL)
- `gold_tick_krw_per_g numeric` (NULL)
- `silver_tick_krw_per_g numeric` (NULL)
- `silver_adjust_factor numeric` (NOT NULL, default 1.2)

**도금**
- `is_plated boolean` (NOT NULL, default false)
- `plating_amount_sell_krw numeric` (NOT NULL, default 0)
- `plating_amount_cost_krw numeric` (NOT NULL, default 0)

**재료비**
- `material_amount_sell_krw numeric` (NOT NULL, default 0)
- `material_amount_cost_krw numeric` (NOT NULL, default 0)

**공임(판매/원가)**
- sell: `labor_*_sell_krw` + `labor_total_sell_krw` (전부 NOT NULL, default 0)
- cost: `labor_*_cost_krw` + `labor_total_cost_krw` (전부 NOT NULL, default 0)

**수리비**
- `repair_fee_krw numeric` (NOT NULL, default 0)

**합계(최종)**
- `total_amount_sell_krw numeric` (NOT NULL, default 0)
- `total_amount_cost_krw numeric` (NOT NULL, default 0)

**확정 플래그**
- `is_priced_final boolean` (NOT NULL, default false)
- `priced_at timestamptz` (NULL)
- `price_calc_trace jsonb` (NOT NULL, default '{}'::jsonb)

**감사**
- `created_at`, `updated_at` (NOT NULL, default now())

**WRITE**
- 라인 추가/수정/삭제: `cms_fn_add_*`, `cms_fn_update_shipment_line_v1`, `cms_fn_delete_shipment_line_v1`
- 확정 계산: `cms_fn_confirm_shipment`가 수행하고 결과를 이 테이블에 기록

---

### 4.11 `cms_return_line` (반품 라인)
**PK**
- `return_line_id uuid` (default `gen_random_uuid()`)

**FK**
- `party_id uuid` (NOT NULL) → `cms_party`
- `shipment_line_id uuid` (NOT NULL) → `cms_shipment_line`

**주요 컬럼**
- `return_qty int` (NOT NULL, default 1)
- `auto_return_amount_krw numeric` (NOT NULL, default 0)
- `final_return_amount_krw numeric` (NOT NULL, default 0)
- `reason text` (NULL)
- `occurred_at timestamptz` (NOT NULL)
- `created_at timestamptz` (NOT NULL, default now())

**WRITE**
- `cms_fn_record_return(...)`

---

### 4.12 `cms_payment_header` / `cms_payment_tender_line` (결제)
**payment_header PK**
- `payment_id uuid` (default `gen_random_uuid()`)

**FK**
- `party_id uuid` (NOT NULL) → `cms_party`

**주요 컬럼**
- `paid_at timestamptz` (NOT NULL)
- `memo text` (NULL)
- `total_amount_krw numeric` (NOT NULL, default 0)
- `created_at`

**tender_line PK**
- `tender_line_id uuid` (default `gen_random_uuid()`)

**FK**
- `payment_id uuid` (NOT NULL) → `cms_payment_header.payment_id`

**주요 컬럼**
- `method` (enum, NOT NULL)
- `amount_krw numeric` (NOT NULL)
- `meta jsonb` (NOT NULL, default '{}'::jsonb)
- `created_at`

**WRITE**
- `cms_fn_record_payment(p_party_id, p_paid_at, p_tenders jsonb, p_memo)`
  - `p_tenders`는 method/amount/meta를 포함한 배열 JSON으로 들어온다(프론트에서 구조를 정확히 맞출 것)

---

### 4.13 `cms_ar_ledger` (AR 원장)
**PK**
- `ar_ledger_id uuid` (default `gen_random_uuid()`)

**FK**
- `party_id uuid` (NOT NULL) → `cms_party`
- 선택 참조:
  - `shipment_id uuid` (NULL) → `cms_shipment_header`
  - `shipment_line_id uuid` (NULL) → `cms_shipment_line`
  - `payment_id uuid` (NULL) → `cms_payment_header`
  - `return_line_id uuid` (NULL) → `cms_return_line`

**주요 컬럼**
- `occurred_at timestamptz` (NOT NULL)
- `entry_type` (enum, NOT NULL) : 매출/수금/반품 등
- `amount_krw numeric` (NOT NULL)
- `memo text` (NULL)
- `created_at` (NOT NULL, default now())

**READ**
- `cms_v_ar_balance_by_party`
- `cms_v_ar_position_by_party`

---

### 4.14 `cms_market_tick` (시세 틱)
**PK**
- `tick_id uuid` (default `gen_random_uuid()`)

**주요 컬럼**
- `symbol` (enum, NOT NULL)
- `price numeric` (NOT NULL)
- `observed_at timestamptz` (NOT NULL)
- `source text` (NULL)
- `meta jsonb` (NOT NULL, default '{}'::jsonb)
- `created_at` (NOT NULL, default now())

**READ**
- `cms_fn_latest_tick(p_symbol)` (최신 틱 조회)

---

### 4.15 `cms_labor_band_rule` (공임 밴드 룰)
**PK**
- `band_id uuid` (default `gen_random_uuid()`)

**주요 컬럼**
- `category_code` (enum, NOT NULL)
- `band_code text` (NOT NULL)  ※ `DEFAULT` 등
- `band_rank int` (NOT NULL)   ※ 낮을수록 우선
- `effective_from date` (NOT NULL)
- `is_active boolean` (NOT NULL, default true)
- `note text` (NULL)
- sell/cost 공임: 전부 numeric NOT NULL default 0
- `created_at` (NOT NULL, default now())

**선택 로직**
- `cms_fn_pick_labor_band_rule(category_code, band_code, on_date)`  
  - band_code null/빈값이면 **DEFAULT 처리**
  - DEFAULT 없으면 해당 카테고리에서 rank/effective 기준으로 fallback

---

### 4.16 `cms_plating_variant` / `cms_plating_price_rule` (도금)
**plating_variant PK**
- `plating_variant_id uuid` (default `gen_random_uuid()`)

**주요 컬럼**
- `plating_type` (enum, NOT NULL)
- `color_code text` (NULL)
- `thickness_code text` (NULL)
- `display_name text` (NULL)
- `is_active boolean` (NOT NULL, default true)
- `created_at` (NOT NULL, default now())

**plating_price_rule PK**
- `rule_id uuid` (default `gen_random_uuid()`)

**FK**
- `plating_variant_id uuid` (NOT NULL) → `cms_plating_variant`

**주요 컬럼**
- `category_code` (enum, NULL)
- `material_code` (enum, NULL)
- `effective_from date` (NOT NULL, default CURRENT_DATE)
- `is_active boolean` (NOT NULL, default true)
- `priority int` (NOT NULL, default 100)
- 금액: `sell_fixed_krw`, `cost_fixed_krw`, `sell_per_g_krw`, `cost_per_g_krw` (전부 NOT NULL, default 0)
- `note text` (NULL)
- `created_at`

**선택 로직**
- `cms_fn_pick_plating_rule(plating_variant_id, category_code, material_code, on_date)`
  - material_code='00'(공용/미상)면 material 무시하고 variant+category로 우선 룰 pick
  - 아니면 exact material 우선 → 없으면 material='00' fallback

---

### 4.17 `cms_status_event` (상태 이벤트 로그)
**PK**
- `event_id uuid` (default `gen_random_uuid()`)

**주요 컬럼**
- `entity_type` (enum, NOT NULL)
- `entity_id uuid` (NOT NULL)
- `from_status text` (NULL)
- `to_status text` (NOT NULL)
- `occurred_at timestamptz` (NOT NULL)
- `actor_person_id uuid` (NULL)
- `reason text` (NULL)
- `correlation_id uuid` (NULL)

---

### 4.18 `cms_decision_log` (결정/변경 로그)
**PK**
- `decision_id uuid` (default `gen_random_uuid()`)

**주요 컬럼**
- `entity_type text` (NOT NULL)
- `entity_id uuid` (NOT NULL)
- `decision_kind text` (NOT NULL)
- `before jsonb` (NOT NULL, default '{}')
- `after jsonb` (NOT NULL, default '{}')
- `actor_person_id uuid` (NULL)
- `occurred_at timestamptz` (NOT NULL, default now())
- `note text` (NULL)

---

## 5) 뷰(View) 계약 (UI 기본 Read 소스)

### 5.1 `cms_v_order_worklist`
**의도**: 판매 화면 Worklist 기본 데이터
- 포함 컬럼(확인된 것)
  - 주문 라인 대부분 + `customer_name`
  - 매칭 보강: `matched_master_id2`, `master_category_code`
- UI는 이 뷰를 기준으로:
  - 검색/필터/정렬/페이지네이션을 구성한다

### 5.2 `cms_v_repair_line_enriched_v1`
**의도**: 수리 화면에서 표시용(고객명/도금명 등 join 포함)
- `customer_name`, `plating_display_name` 등 표시 편의 컬럼 포함

### 5.3 AR 뷰
- `cms_v_ar_balance_by_party`: balance 중심
- `cms_v_ar_position_by_party`: receivable/credit 분리 포지션

---

## 6) 트리거/자동화(이미 확인된 것만 고정)
### 6.1 updated_at 자동 갱신
- `cms_shipment_line`에 `trg_cms_shipline_updated_at` 존재
  - `BEFORE UPDATE` → `cms_fn_set_updated_at()`

### 6.2 수리 원가(cost) 보정 정책 트리거
- `cms_shipment_line`에 `cms_trg_repair_cost_policy` 존재
  - 현재 확인된 정의: **`BEFORE UPDATE OF is_priced_final`**
  - 함수: `cms_fn__repair_cost_policy_trg()`
  - 정책 요지(Phase1 고정):
    - `is_priced_final`이 true로 바뀌는 타이밍에
    - repair 라인인데 `total_amount_cost_krw=0`이고 `repair_fee_krw>0`이면
    - `cost = max(5000, round(repair_fee_krw*0.15))`로 보정(정책은 네가 준 SQL 기준)

---

## 7) Enum(사용자정의 타입) 운영 규칙 (UI 필수)
현재 테이블/함수에서 아래 enum이 사용된다:
- `cms_e_party_type`
- `cms_e_category_code`
- `cms_e_material_code`
- `cms_e_priority_code`
- `cms_e_order_status`
- `cms_e_match_state`
- `cms_e_repair_status`
- `cms_e_shipment_status`
- `cms_e_pricing_mode`
- `cms_e_market_symbol`
- `cms_e_plating_type`(추정: plating_variant.plating_type)
- `cms_e_payment_method`(추정: payment_tender_line.method)
- `cms_e_ar_entry_type`(추정: ar_ledger.entry_type)

**고정 규칙**
- UI에서 enum 값을 하드코딩하지 말고, DB에서 **enum 값 목록을 조회**하여 select 옵션을 구성한다.
  - (예: `select unnest(enum_range(null::public.cms_e_order_status))`)

---

## 8) “절대 금지” 체크리스트 (코딩 에이전트 통제용)
- ❌ `ms_s.*` 접근/조인/참조
- ❌ `public.master_item`, `public.order_line` 등 cms_ 아닌 동명 테이블 접근
- ❌ base table direct write (insert/update/delete)
- ❌ 프론트에서 금액/원가 확정 계산 후 DB에 write (확정은 DB RPC가 최종)
- ❌ confirm/priced_final 같은 상태 플래그를 UI가 직접 업데이트

---

## 9) 운영 전 필수 3종 (고정)
### 9.1 권한/GRANT/RLS 최종 점검
- staff/authenticated:
  - base table write 불가
  - rpc execute 가능
  - view select 가능

### 9.2 staff/authenticated가 RPC만 쓰는지
- 프론트/리툴 코드에서 `from('cms_*').insert/update/delete` 검색해서 0건 확인

### 9.3 base table 직접 write 막혔는지
- 권한 테스트로 insert/update/delete 시도 → 실패 확인(테스트 계정)

---

## 10) 엣지케이스 회귀 테스트 5개 (고정)
1) **measured_weight 없는 14/18/24 라인 confirm 막힘**  
2) **plating_variant 없는데 is_plated=true 막힘**  
3) **shipment 라인 0개 confirm 막힘**  
4) **payment/return offset 시 잔액/크레딧 정상** (`cms_v_ar_position_by_party`)  
5) **repair fee만 있는 라인 cost policy 정상** (`cms_trg_repair_cost_policy` 발동 확인)

---

## 11) 시드/데모 데이터 최소셋(고정)
> reset마다 항상 재현되도록 “최소셋”을 고정한다. (이 섹션은 실제 seed SQL로 분리 가능)

- party:
  - 고객: `소매A`, `소매B`
  - 공장: `공장AB`
- plating_variant:
  - 예: `WHITE/RH`, `YELLOW/GP` 등 최소 2개
- labor_band_rule:
  - 카테고리별 DEFAULT 1개씩 (최소)
- market_tick:
  - GOLD, SILVER 최소 1개씩 최신 tick
- master_item:
  - 모델 3개 이상(각기 category 다르게 1개는 도금 기본값 포함)
- order_line:
  - 소매A 2줄(도금 1, 비도금 1)
  - 소매B 1줄
- repair_line:
  - 소매A 1줄(수리비만 있는 케이스 포함)
- shipment:
  - 소매A 출고 1건(DRAFT) + 라인 2개
  - confirm 시나리오를 통해 shipment_line에 가격/원가가 채워지는지 확인
- payment/return:
  - 소매A 결제 1건(복수 tender 가능)
  - 소매A 반품 1건(override 포함 케이스)

---
