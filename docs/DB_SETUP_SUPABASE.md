# CMS_S 백엔드 스키마/규칙 완전정리 (현재 대화 기준)

> 범위: 이번 대화에서 **실제로 등장/검증된 테이블·뷰·RPC·컬럼**을 기준으로 정리.  
> ⚠️ “대화에 한 번도 안 나온 컬럼”까지 100% 단정할 수는 없어서, 그런 부분은 **[추정]** 또는 **[미확인]**으로 표시했어.  
> 목표: **처음 보는 사람도** 전체 구조(흐름/관계/제약/특이사항)를 바로 이해하고, 운영·UI 구현·회귀테스트까지 이어갈 수 있게.

---

## 0) 전체 도메인 개요 (한 장 요약)

이 시스템은 크게 4개의 흐름으로 돈다.

1) **거래처(Party)**
- 고객(customer) / 공장(vendor)을 한 테이블로 통합 관리
- 출고/미수(AR) 기준의 “주체”는 Party

2) **주문(Order)**
- 고객 주문 단위는 `cms_order_line`(라인 단위)로 관리
- 주문 라인이 출고 라인으로 연결될 수 있음

3) **수리(Repair)**
- 수리 접수는 `cms_repair_line`
- 수리 라인이 출고 라인으로 연결될 수 있음
- “제품처럼 가격산출”이 아니라 **repair_fee_krw 중심**이며, 원가 정책은 별도(아래 특이사항 참조)

4) **출고(Shipment) + 확정(Confirm) + 정산(AR)**
- 출고 헤더: `cms_shipment_header`
- 출고 라인: `cms_shipment_line` (order_line / repair_line / ad-hoc 모두 커버)
- 확정 RPC: `cms_fn_confirm_shipment`
  - 확정 시 라인별 가격 계산 + `is_priced_final=true`
  - 확정 시 AR 원장(`cms_ar_ledger`)에 **SHIPMENT** 한 줄 적재
  - 확정 시 주문/수리 상태를 **SHIPPED**로 전파

추가로,
- **시장시세**: `cms_market_tick` (금/은 시세)
- **공임/도금 룰**: `cms_labor_band_rule`, `cms_plating_variant`, `cms_plating_price_rule`
- **결제/반품**: `cms_payment_header`, `cms_payment_tender_line`, `cms_return_line` → AR 원장에 PAYMENT/RETURN 적재
- **의사결정 로그**: `cms_decision_log`
- **상태 이벤트 로그**: `cms_status_event` (트리거 기반 로그)

---

## 1) ENUM / 코드 체계 (대화에서 확인된 것)

### 1.1 party_type
- `cms_e_party_type`: `customer` / `vendor`

### 1.2 order status
- `cms_e_order_status`  
  - 대화에서 실제로 쓰인 값: `ORDER_PENDING`, `READY_TO_SHIP`, `SHIPPED`, `CANCELLED`
  - ⚠️ `DRAFT`는 **존재하지 않는 enum 값**이라서 에러가 났음
    - 에러: `invalid input value for enum cms_e_order_status: "DRAFT"`

### 1.3 repair status
- `cms_e_repair_status`
  - 대화에서 실제로 쓰인 값: `RECEIVED`, `READY_TO_SHIP`, `SHIPPED`, `CANCELLED`

### 1.4 shipment status
- `cms_e_shipment_status`
  - 대화에서 실제로 쓰인 값: `DRAFT`, `CONFIRMED`

### 1.5 pricing_mode
- `cms_e_pricing_mode`
  - 대화에서 확인된 값: `RULE`, `UNIT`, `AMOUNT_ONLY`

### 1.6 category_code / material_code
- `cms_e_category_code`: 예) `RING` 등
- `cms_e_material_code`: 예) `14`, `18`, `24`, `925`, `00`(미상/공용)

---

## 2) 핵심 테이블 상세

---

# A. 거래처/사람

## A1) public.cms_party (거래처 마스터: 고객/공장 통합)

### 목적
- 고객/공장(거래처) 공통 테이블
- AR(미수) 주체, 출고의 고객 주체

### PK
- `party_id (uuid)`

### 주요 컬럼 (정보스키마로 확인됨)
- `party_id uuid`
- `party_type USER-DEFINED (cms_e_party_type)`
- `name text`
- `phone text`
- `region text`
- `address text`
- `note text`  ← 예전 함수에서 memo라 썼다가 실제 컬럼은 note여서 오류났고 수정됨
- `is_active boolean`
- `created_at timestamptz`
- `updated_at timestamptz`

### 특이사항/운영 규칙
- upsert RPC는 현재 시그니처가 아래 형태로 정리됨(현재 스키마 기준 동작 확인):
  - `cms_fn_upsert_party_v1(p_party_type, p_name, p_phone, p_region, p_address, p_memo, p_party_id)`
- “memo vs note” 컬럼명이 엇갈려서 실제 오류 발생 → `note`로 통일해서 수정 완료

---

## A2) public.cms_party_address (거래처 주소/배송지)  [미확인: 상세 컬럼]
### 목적
- `cms_party`의 1:N 주소 관리
### 상태
- 테이블 존재는 로그에서 확인(정책/seed 적용 대상)
- 구체 컬럼은 대화에 직접 출력되지 않아 **[미확인]**

---

## A3) public.cms_person / public.cms_party_person_link  [미확인: 상세 컬럼]
### 목적
- 사람(담당자) 및 거래처-담당자 연결
### 상태
- 테이블 존재는 로그에서 확인
- 구체 컬럼은 대화에 직접 출력되지 않아 **[미확인]**

---

# B. 주문

## B1) public.cms_order_line (주문 라인)

### 목적
- 고객 주문을 “라인 단위”로 관리
- 출고 라인의 입력 source 중 하나(order_line_id로 연결)

### PK
- `order_line_id uuid`

### 대화에서 출력된 컬럼(일부)
- `order_line_id uuid`
- `customer_party_id uuid` (FK → cms_party.party_id)
- `model_name text`
- `suffix text`
- `color text`
- `qty int`
- `status cms_e_order_status`
- `created_at timestamptz`
- [미확인 가능 컬럼] `size`, `is_plated`, `plating_variant_id`, `memo` 등 (RPC 인자에 존재)

### 핵심 RPC
- `cms_fn_upsert_order_line_v1(
    p_customer_party_id uuid,
    p_model_name text,
    p_suffix text,
    p_color text,
    p_qty integer,
    p_size text,
    p_is_plated boolean,
    p_plating_variant_id uuid,
    p_memo text,
    p_order_line_id uuid
  ) returns uuid`

### 특이사항
- 주문 상태 enum에 `DRAFT` 넣으면 오류(존재 X)
- 출고 확정 시 shipped_qty 누적에 따라
  - `>= qty` → `SHIPPED`
  - `< qty` → `READY_TO_SHIP`

---

# C. 수리

## C1) public.cms_repair_line (수리 접수 라인)

### 목적
- 수리 접수/진행/출고 연결
- 출고 라인의 입력 source 중 하나(repair_line_id로 연결)

### PK
- `repair_line_id uuid`

### 정보스키마로 확인된 주요 컬럼(정확)
- `repair_line_id uuid`
- `customer_party_id uuid` (FK → cms_party.party_id)
- `received_at date`
- `model_name text`
- `model_name_raw text`
- `suffix text`
- `material_code cms_e_material_code`
- `color text`
- `qty integer`
- `weight_received_g numeric`  ← 실제 저장 컬럼명
- `is_paid boolean`
- `repair_fee_krw numeric`
- `is_plated boolean`
- `plating_variant_id uuid` (FK → cms_plating_variant)
- `requested_due_date date`
- `priority_code USER-DEFINED`
- `memo text`
- `status cms_e_repair_status`
- `source_channel text`
- `correlation_id uuid`
- `created_at timestamptz`
- `updated_at timestamptz`

### “measured_weight_g” 관련 특이사항(중요)
- UI/출고 관점에서는 `measured_weight_g`라는 이름을 쓰고 싶었는데,
  - 실제 테이블 저장은 `weight_received_g`
- 그래서 View에서 `measured_weight_g`로 alias 해서 제공하는 방식으로 해결됨

### 관련 View
- `public.cms_v_repair_line_enriched_v1`
  - 최소 포함: `measured_weight_g`(=weight_received_g), plating_code/표시명 join

### 핵심 RPC (동작 확인 완료)
- `cms_fn_upsert_repair_line_v1(
    p_customer_party_id uuid,
    p_model_name text,
    p_suffix text,
    p_color text,
    p_material_code cms_e_material_code,
    p_qty integer,
    p_measured_weight_g numeric,  -- 입력은 measured_weight로 받되
    p_is_plated boolean,
    p_plating_variant_id uuid,
    p_repair_fee_krw numeric,
    p_received_at date,
    p_memo text,
    p_repair_line_id uuid
  ) returns uuid`
- 내부에서는 `weight_received_g = p_measured_weight_g`로 저장하도록 수정 완료

---

# D. 출고

## D1) public.cms_shipment_header (출고 헤더)

### 목적
- 출고 문서(헤더)
- 고객 기준으로 출고를 묶는 단위

### PK
- `shipment_id uuid`

### 대화에서 확인된 컬럼
- `shipment_id uuid`
- `customer_party_id uuid` (FK → cms_party.party_id)
- `status cms_e_shipment_status` (`DRAFT`/`CONFIRMED`)
- `ship_date date`
- `confirmed_at timestamptz`
- `memo text`

### 핵심 RPC
- `cms_fn_create_shipment_header_v1(p_customer_party_id uuid, p_ship_date date, p_memo text) returns uuid`
- `cms_fn__assert_shipment_draft(p_shipment_id uuid)`  
  - DRAFT에서만 라인 추가/수정 가능하게 가드

### FK 특이사항
- 존재하지 않는 customer_party_id로 헤더 만들면 FK 오류 발생(정상)
  - `violates foreign key constraint ... Key (customer_party_id)=... is not present in table cms_party`

---

## D2) public.cms_shipment_line (출고 라인)

### 목적
- 출고 내역의 실질 라인
- **order_line / repair_line / ad-hoc** 모두를 한 테이블로 커버
- 확정 시 이 테이블에 “가격 계산 결과”가 스냅샷으로 저장됨

### PK
- `shipment_line_id uuid`

### 관계
- `shipment_id` → cms_shipment_header
- `order_line_id` → cms_order_line (nullable)
- `repair_line_id` → cms_repair_line (nullable)
- `plating_variant_id` → cms_plating_variant (nullable)

### 대화에서 확인된 핵심 입력 컬럼(확정 전에도 존재)
- `pricing_mode (cms_e_pricing_mode)`
- `category_code (cms_e_category_code)`
- `material_code (cms_e_material_code)`
- `qty int`
- `model_name/suffix/color/size`
- `measured_weight_g numeric`
- `deduction_weight_g numeric`
- `is_plated boolean`
- `plating_variant_id uuid`
- `unit_price_krw numeric` (UNIT 모드)
- `manual_total_amount_krw numeric` (AMOUNT_ONLY 모드)
- `repair_fee_krw numeric`
- `note text`

### 확정 후 계산 스냅샷(대화에서 출력됨)
- `net_weight_g`
- `gold_tick_krw_per_g`, `silver_tick_krw_per_g`
- `material_amount_sell_krw`
- `labor_total_sell_krw`
- `plating_amount_sell_krw`
- `total_amount_sell_krw`, `total_amount_cost_krw`
- `is_priced_final boolean`
- `priced_at timestamptz`
- `price_calc_trace jsonb` (어떤 규칙/소스 썼는지 추적)

> 참고: 이 테이블은 “계산 결과 컬럼이 많다”.  
> 실제 운영/BI에서 “확정 당시 결과가 보존”되어야 하므로, 라인에 결과를 저장하는 구조가 맞음.

### 라인 추가 RPC (3종)
1) 주문에서 라인 생성  
- `cms_fn_add_shipment_line_from_order_v1(p_shipment_id, p_order_line_id, ...)`

2) 수리에서 라인 생성  
- `cms_fn_add_shipment_line_from_repair_v1(p_shipment_id, p_repair_line_id, ...)`
- 초기에는 `r.measured_weight_g`를 참조해서 실패했음
  - 해결: repair_line은 `weight_received_g`이므로 그걸 받아오거나, enriched view alias 사용

3) 임의(ad-hoc) 라인 생성  
- `cms_fn_add_shipment_line_ad_hoc_v1(p_shipment_id, p_model_name, p_suffix, p_color, p_category_code, ...)`

### 라인 수정/삭제 RPC
- `cms_fn_update_shipment_line_v1(...)`
- `cms_fn_delete_shipment_line_v1(p_shipment_line_id, p_note)`

### 확정 시 강제 검증(중요)
- `material_code`가 `00`이 아니고 `pricing_mode <> AMOUNT_ONLY`인데 `measured_weight_g`가 NULL이면 확정 실패
  - 실제로 “measured_weight_g required…” 에러 발생했고, update RPC로 weight 채운 뒤 confirm 성공

---

# E. 가격/룰/시세

## E1) public.cms_market_tick (시세)
### 목적
- 금/은 시세 기록
### 대화에서 확인된 값
- 심볼: `GOLD_KRW_PER_G`, `SILVER_KRW_PER_G`
- 조회 RPC: `cms_fn_latest_tick(p_symbol cms_e_market_symbol)`

---

## E2) public.cms_labor_band_rule (공임 구간 룰)

### 목적
- 카테고리 + 밴드코드(band_code) + 날짜(effective_from)로 공임을 pick
- sell/cost가 따로 존재

### 컬럼 (대화에서 정보스키마로 확인)
- `band_id uuid` (PK)
- `category_code (enum)`
- `band_code text`
- `band_rank integer` (우선순위)
- `effective_from date`
- `is_active boolean`
- `note text`
- sell: `labor_base_sell`, `labor_center_sell`, `labor_sub1_sell`, `labor_sub2_sell`, `labor_bead_sell`
- cost: `labor_base_cost`, `labor_center_cost`, `labor_sub1_cost`, `labor_sub2_cost`, `labor_bead_cost`
- `created_at timestamptz`

### pick 함수
- `cms_fn_pick_labor_band_rule(p_category_code, p_band_code, p_on_date)`
- (정책 확정은 아래 “cms_0013” 블록 참고: DEFAULT/fallback 전략을 여기서 결정)

---

## E3) public.cms_plating_variant (도금 종류/옵션 마스터)

### 목적
- 도금 종류(예: plating_type), 컬러/두께 코드, 표시명
- shipment_line, repair_line, order_line 등에서 `plating_variant_id`로 참조

### 컬럼 (정보스키마로 확인)
- `plating_variant_id uuid` (PK)
- `plating_type enum`
- `color_code text`
- `thickness_code text`
- `display_name text`
- `is_active boolean`
- `created_at timestamptz`

### “plating_code” 오류 특이사항
- 예전 SQL에서 `pv.code`를 기대했지만 실제 컬럼은 없음 → 오류 발생
- 해결: code를 따로 두지 않고,
  - `plating_type`/`color_code`/`thickness_code`/`display_name` 조합으로 표현하거나
  - view에서 `plating_code`를 생성(예: plating_type을 단일 코드처럼 보여주기)

---

## E4) public.cms_plating_price_rule (도금 가격 룰)

### 목적
- variant + category + material + effective_from + priority로 도금 금액 pick
- fixed/per_g 구조(판매/원가 각각)

### 컬럼 (정보스키마로 확인)
- `rule_id uuid` (PK)
- `plating_variant_id uuid` (FK)
- `category_code enum`
- `material_code enum`
- `effective_from date`
- `is_active boolean`
- `priority integer`
- sell: `sell_fixed_krw`, `sell_per_g_krw`
- cost: `cost_fixed_krw`, `cost_per_g_krw`
- `note text`
- `created_at timestamptz`

### pick 함수
- `cms_fn_pick_plating_rule(p_plating_variant_id, p_category_code, p_material_code, p_on_date)`
- material_code = `00`일 때 “material 무시” 전략을 쓸지 여부가 cms_0013 정책에 포함됨

---

# F. AR(미수)/결제/반품

## F1) public.cms_ar_ledger (AR 원장)

### 목적
- 거래처별 AR 변동을 “엔트리(원장)”로 누적
- balance(잔액)/credit(선수금) 계산은 원장 집계로 해결

### PK
- `ar_ledger_id uuid`  (대화에서 직접 확인)

### 대화에서 확인된 주요 컬럼
- `ar_ledger_id uuid`
- `party_id uuid`
- `entry_type` : `SHIPMENT` / `PAYMENT` / `RETURN`
- `amount_krw numeric` (SHIPMENT는 +, PAYMENT/RETURN은 -)
- `shipment_id uuid (nullable)`
- `payment_id uuid (nullable)`
- `return_line_id uuid (nullable)`
- `occurred_at timestamptz`
- `memo text`

### 특이사항(중요)
- 초기에 `ledger_id`로 조회하려다 오류 발생:
  - 실제 컬럼은 `ar_ledger_id`
- shipment confirm 성공 시
  - `entry_type='SHIPMENT'` 한 줄 생성(멱등: 이미 있으면 추가 생성 X)
- payment/return RPC 성공 시
  - 각각 `PAYMENT`, `RETURN` 엔트리가 생성됨

---

## F2) public.cms_payment_header / public.cms_payment_tender_line
### 목적
- 결제 기록(헤더/수단라인)
### 상태
- 테이블 존재는 로그에서 확인, RPC `cms_fn_record_payment` 동작 확인
- 상세 컬럼은 대화에서 직접 출력되지 않아 **[미확인]**

### 핵심 RPC
- `cms_fn_record_payment(p_party_id uuid, p_paid_at timestamptz, p_tenders jsonb, p_memo text) returns jsonb`
- 결과 예: `{"ok":true,"payment_id":"...","total_amount_krw":100000}`

---

## F3) public.cms_return_line (반품)
### 목적
- 출고 라인 기준 반품 기록
### 핵심 RPC
- `cms_fn_record_return(p_shipment_line_id uuid, p_return_qty int, p_occurred_at timestamptz, p_override_amount_krw numeric, p_reason text) returns jsonb`
- 결과 예: `auto_amount_krw`, `final_amount_krw`

---

## F4) AR Position View (잔액/크레딧 집계 뷰)
### 목적
- party별 balance / receivable / credit 등 집계 제공
### 상태
- `cms_0009_ar_position_view.sql`로 생성되어 사용됨
- 결과 예시(원하던 형태):
  - `party_id, party_type, name, balance_krw, receivable_krw, credit_krw, last_activity_at`
- “offset 회귀 테스트”에서 balance/credit이 의도대로 움직이는 것을 확인함

---

# G. 로그/감사/이벤트

## G1) public.cms_decision_log
### 목적
- 중요한 상태 변경/확정 등의 “의사결정”을 before/after로 남김
### 확정(confirm) 시 기록됨
- entity_type: `SHIPMENT_HEADER`
- decision_kind: `CONFIRM_SHIPMENT`
- before/after JSONB 기록

---

## G2) public.cms_status_event
### 목적
- order/repair/shipment 상태 변경 이벤트 로그
### 상태
- 테이블 존재 및 트리거/함수(`cms_fn_log_*_status_change`) 존재 확인
- 상세 컬럼은 **[미확인]**

---

## 3) 핵심 RPC 목록 (현재 스키마에서 실제 조회된 것)

- `cms_fn_upsert_party_v1(p_party_type, p_name, p_phone, p_region, p_address, p_memo, p_party_id) -> uuid`
- `cms_fn_upsert_order_line_v1(...) -> uuid`
- `cms_fn_upsert_repair_line_v1(...) -> uuid`
- `cms_fn_create_shipment_header_v1(p_customer_party_id, p_ship_date, p_memo) -> uuid`
- `cms_fn_add_shipment_line_from_order_v1(...) -> uuid`
- `cms_fn_add_shipment_line_from_repair_v1(...) -> uuid`
- `cms_fn_add_shipment_line_ad_hoc_v1(...) -> uuid`
- `cms_fn_update_shipment_line_v1(...) -> jsonb`
- `cms_fn_delete_shipment_line_v1(...) -> [미확인 반환형]`
- `cms_fn_confirm_shipment(p_shipment_id, p_actor_person_id default null, p_note default null) -> jsonb`
- `cms_fn_record_payment(...) -> jsonb`
- `cms_fn_record_return(...) -> jsonb`
- `cms_fn_latest_tick(p_symbol) -> (tick_id, price, observed_at)` 형태

---

## 4) “확정(Confirm)” 로직 구조(실제 검증된 동작만 요약)

### 4.1 Confirm의 입력과 출력
- 입력: shipment_id (+ optional actor/note)
- 출력(JSONB): `ok, shipment_id, confirmed_at, total_cost_krw, total_sell_krw`

### 4.2 Confirm이 하는 일 (확정 시점 스냅샷)
1) shipment_header lock + 상태 검사  
2) shipment_line들을 lock + 순회
3) 각 라인별로:
   - category/material resolve
   - measured_weight / deduction / net 계산
   - 시세 tick 적용
   - labor / plating / repair_fee 반영
   - pricing_mode별 최종 금액 산출
   - shipment_line에 계산 결과 업데이트
4) shipment_header를 CONFIRMED로 업데이트
5) AR 원장에 SHIPMENT 엔트리 업서트(멱등)
6) order_line / repair_line 상태 SHIPPED 전파(누적 shipped_qty 기반)
7) decision_log 기록

### 4.3 Confirm 실패 조건(현재까지 확정된 것)
- 출고 라인이 0개면 confirm 불가 (가드 추가함)
- material이 유효(00 아님)이고 RULE/UNIT이면 measured_weight 필수
- is_plated=true면 plating_variant_id 필수

---

## 5) 마이그레이션/작업 중 실제로 터졌던 오류와 “원인-해결” (이력 공유용)

### 5.1 Postgres 함수 인자 default 규칙
- 오류: `input parameters after one with a default value must also have defaults`
- 원인: default 있는 파라미터 뒤에 default 없는 파라미터가 옴
- 해결: **default 없는 파라미터는 앞쪽**, default 있는 파라미터는 뒤쪽으로 재정렬

### 5.2 SQL Editor에서 `:param` 문법
- 오류: `syntax error at or near ":"`
- 원인: Supabase SQL Editor는 `:customer_party_id` 같은 바인딩 문법을 지원하지 않음
- 해결: `<PASTE_UUID>` 같은 placeholder를 실제 UUID로 **직접 치환**해서 실행

### 5.3 컬럼명 불일치: memo vs note / weight_received_g vs measured_weight_g
- party: `memo` 컬럼이 없고 `note`가 있음 → upsert 함수 수정
- repair: 테이블은 `weight_received_g`, 뷰는 `measured_weight_g`로 alias → 함수/뷰 정리

### 5.4 plating variant의 code 컬럼 착각
- `pv.code` 없음 → `plating_type` 등 실제 컬럼로 join/표현하거나 view에서 가공

### 5.5 function replace 시 default 제거 불가
- 오류: `cannot remove parameter defaults from existing function`
- 원인: 기존 함수의 default 구조를 바꾸면서 “default 제거” 시도
- 해결: (원칙) default 구조 유지하거나, 필요하면 DROP FUNCTION 후 CREATE

---

## 6) 현재 상태 결론 (백엔드 완료 기준)

✅ 거래처 upsert OK  
✅ 주문 upsert OK + 상태 전파(READY_TO_SHIP/SHIPPED) OK  
✅ 수리 upsert OK (weight alias 포함) + 상태 전파 OK  
✅ 출고 헤더 생성/라인 추가/라인 수정/확정 OK  
✅ 확정 시 가격 계산 스냅샷 OK  
✅ AR 원장 SHIPMENT/PAYMENT/RETURN 엔트리 OK  
✅ AR position 집계 뷰 OK(잔액/크레딧 offset 회귀 시나리오 검증됨)

즉, **“핵심 운영 플로우 백엔드”는 완료** 상태.

---

## 7) (중요) cms_0013 블록의 의미 — “confirm_shipment”랑 별개다

네가 붙여준 긴 confirm 함수(길이 18k)는 **확정 로직 본체**고,  
내가 준 “cms_0013: pricing policy defaults …”는 **그 본체가 호출하는 ‘룰 선택/원가 보정’ 정책 레이어**야.

- confirm 자체를 짧게 만든 게 아니라,
- **confirm은 그대로 두고**, 아래 3개를 “정책으로 고도화”하는 목적:
  1) labor band rule pick의 DEFAULT/fallback
  2) plating rule pick의 material=00 처리 전략
  3) repair 원가(cost) 최소 보정 트리거(원가 0 방지)

즉 **둘은 충돌하는 게 아니라 역할이 다름**:
- confirm 함수: “계산/확정/적재의 메인 엔진”
- cms_0013 정책: “pick 함수/트리거를 더 안전하게 만드는 보조 레이어”

---

## 8) 운영 전 필수 3종 (요청대로 그대로 붙임)

남은 것(운영 전 필수 3종)

권한/GRANT/RLS 최종 점검

staff/authenticated가 RPC만 쓰는지

base table 직접 write 막혔는지

엣지케이스 회귀 테스트 5개만 고정

measured_weight 없는 14/18/24 라인 confirm 막힘

plating_variant 없는데 is_plated=true 막힘

shipment 라인 0개 confirm 막힘

payment/return offset 시 잔액/크레딧 정상

repair fee만 있는 라인 cost policy 정상

시드/데모 데이터 최소셋 정리

“소매A/소매B/공장AB” 같은 테스트가 reset마다 항상 재현되게
