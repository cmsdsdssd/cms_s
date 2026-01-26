# PHASE1 백엔드/DB 완전 정리 + UI/UX 코딩에이전트 지시서 (LOCK)

> 목적  
> 1) 처음 보는 사람도 DB 구조/규칙을 “운영 가능한 수준”으로 이해  
> 2) 코딩 에이전트가 **절대 이상한 짓 못 하게**(직접 write/우회/로직 재구현) 통제  
> 3) 운영 전 필수 3종 + 회귀테스트 5개 + seed/데모 최소셋 고정

---

## 0) 한 줄 요약

- **가격/AR 확정은 출고 CONFIRM 시점에만** 발생한다.
- UI에서 base table 직접 write 금지, **RPC(fn_*)만** 사용한다.
- 출고 라인(`cms_shipment_line`)은 확정 순간에 **가격 스냅샷 + trace(jsonb)** 를 잠근다.

---

## 1) 운영 헌법(LOCK) — 절대 위반 금지

### 1.1 쓰기(WRITE) 헌법
- UI/에이전트는 **base table에 INSERT/UPDATE/DELETE 절대 금지**
- 모든 쓰기 = `public.cms_fn_*` RPC 호출만 허용
- 조회는 가급적 `cms_v_*` (또는 최소 SELECT)만 사용

### 1.2 돈(AR) 헌법
- AR 증가는 오직 **출고 확정**에서만 생성  
  - `cms_ar_ledger.entry_type='SHIPMENT'` / `amount_krw = +총판매금액`
- 결제/반품/상계는 **항상 음수(-)** 로 원장에 기록  
- 잔액 = `sum(amount_krw)` (원장 기반 SoT)

### 1.3 가격 확정 헌법
- 주문/수리 입력 단계에서는 가격 없음
- 출고 확정(`cms_fn_confirm_shipment`) 시점에만:
  - tick 스냅샷 저장
  - 소재+공임+도금(+수리비) 계산
  - `is_priced_final=true` 잠금
  - `price_calc_trace` 기록

### 1.4 서버 가드(필수)
- shipment 라인 0개면 confirm 금지
- 금(14/18/24) RULE 라인에서 `measured_weight_g` 없으면 confirm 금지
- `is_plated=true`인데 `plating_variant_id` 없으면 confirm 금지

### 1.5 enum/상태 하드코딩 금지
- UI/SQL에서 `'DRAFT'` 같은 임의 문자열을 enum에 넣지 말 것
- **DB enum 실제 값 그대로** 드롭다운/필터를 구성할 것

---

## 2) ERD(텍스트)

- `cms_party (customer/vendor)` 1 ── N `cms_order_line`
- `cms_party (customer/vendor)` 1 ── N `cms_repair_line`
- `cms_party (customer)` 1 ── N `cms_shipment_header`
- `cms_shipment_header` 1 ── N `cms_shipment_line`
- `cms_shipment_line` N ── 0/1 `cms_order_line` (부분출고 가능)
- `cms_shipment_line` N ── 0/1 `cms_repair_line`
- `cms_party` 1 ── N `cms_ar_ledger`
- `cms_payment_header` 1 ── N `cms_payment_tender_line`
- `cms_return_line` N ── 1 `cms_shipment_line`
- (추적) `cms_status_event`, `cms_decision_log`가 주요 변경을 기록

---

## 3) Enum(핵심) — “실제 DB 값” 기준 사용

### 3.1 카테고리 `cms_e_category_code` (PRD 기준)
- `RING`, `EARRING`, `NECKLACE`, `BRACELET`, `PIERCING`, `PENDANT`, `WATCH`, `KEYRING`, `SYMBOL`, `ETC`

### 3.2 소재 `cms_e_material_code` (운영 기준)
- `14`, `18`, `24`, `925`, `00`(공임/도금만)

### 3.3 가격모드 `cms_e_pricing_mode`
- `RULE` (기본)
- `UNIT` (단가×수량)
- `AMOUNT_ONLY` (금액 수기)

### 3.4 출고상태 `cms_e_shipment_status`
- `DRAFT`, `CONFIRMED`, `CANCELLED`

### 3.5 주문상태 `cms_e_order_status`
- 예: `ORDER_PENDING`, `READY_TO_SHIP`, `SHIPPED`, `CANCELLED` 등  
  - **주의:** `'DRAFT'`는 주문 enum에 없어서 에러가 발생했음 → 절대 사용 금지

### 3.6 수리상태 `cms_e_repair_status`
- 예: `RECEIVED`, `READY_TO_SHIP`, `SHIPPED`, `CANCELLED` 등

### 3.7 도금 variant
- `cms_plating_variant.plating_type` (enum)
- 표시는 `display_name` 중심(※ `pv.code` 컬럼 없음)

---

## 4) 테이블/컬럼 사전(완전)

> 표기 규칙  
> - PK / FK / UNIQUE를 먼저 표시  
> - 운영상 “필수 입력”, “뷰/함수 함정”, “스냅샷/잠금”을 특이사항으로 별도 표기

---

### 4.1 `public.cms_party` — 거래처/공장 통합

- PK: `party_id uuid`
- 주요 컬럼
  - `party_type` (customer/vendor)
  - `name text`
  - `phone text`
  - `region text`
  - `address text`
  - `note text`  *(함수에서 memo로 넣다 깨졌던 부분 → note로 통일됨)*
  - `is_active boolean`
  - `created_at timestamptz`
  - `updated_at timestamptz`
- 특이사항
  - `cms_fn_upsert_party_v1`는 컬럼명이 `address`, `note`와 정확히 일치해야 함(과거 `memo` 때문에 에러)

---

### 4.2 `public.cms_party_address` — 복수 주소(확장)

- (권장) Party의 1개 주소는 `cms_party.address`로도 운영 가능
- 확장 시 `cms_party_address` 사용:
  - `address_id uuid`
  - `party_id uuid (FK)`
  - `address_text text`
  - `label text`
  - `is_default boolean`
  - `created_at timestamptz`

---

### 4.3 `public.cms_person`, `public.cms_party_person_link` — 담당자(확장)

- 담당자/연락망 확장을 위한 테이블(Phase1 필수는 아님)

---

### 4.4 `public.cms_master_item` — 마스터카드(기성)

- PK: `master_id uuid`
- UNIQUE: `model_name text`
- (권장) 주요 컬럼
  - `vendor_party_id uuid`
  - `category_code cms_e_category_code`
  - `material_code_default cms_e_material_code`
  - `deduction_weight_default_g numeric`
  - 공임 sell/cost 분해 필드(베이스/센터/서브/비드)
  - `labor_profile_mode`(MANUAL/BAND), `labor_band_code`
  - 도금 기본값 sell/cost
- 특이사항
  - Phase1 핵심은 “확정 스냅샷”이므로 마스터는 기본값/참조 역할

---

### 4.5 `public.cms_order_line` — 주문(라인)

- PK: `order_line_id uuid`
- FK: `customer_party_id -> cms_party.party_id`
- 주요 컬럼
  - `model_name text`
  - `model_name_raw text`
  - `suffix text`
  - `color text`
  - `size text`
  - `qty int`
  - `is_plated boolean`
  - `plating_variant_id uuid`
  - `memo text`
  - `status cms_e_order_status`
  - `created_at`, `updated_at`
- 특이사항
  - 거래처 매핑이 최우선: UI에서 `customer_party_id`는 항상 필수

---

### 4.6 `public.cms_repair_line` — 수리(라인)

- PK: `repair_line_id uuid`
- FK: `customer_party_id -> cms_party.party_id`
- **실제 테이블 컬럼(너가 확인한 기준)**
  - `customer_party_id uuid`
  - `received_at date`
  - `model_name text`
  - `model_name_raw text`
  - `suffix text`
  - `material_code cms_e_material_code`
  - `color text`
  - `qty int`
  - `weight_received_g numeric`  ✅ (테이블 실컬럼)
  - `repair_fee_krw numeric`
  - `is_plated boolean`
  - `plating_variant_id uuid`
  - `requested_due_date date`
  - `priority_code` (enum)
  - `memo text`
  - `status` (enum)
  - `source_channel text`
  - `correlation_id uuid`
  - `created_at`, `updated_at`
- 특이사항(함정)
  - 뷰에서 `measured_weight_g`로 보일 수 있으나, 원본은 `weight_received_g`
  - 수리 → 출고라인 생성 함수는 `r.weight_received_g`를 써야 함

---

### 4.7 `public.cms_plating_variant` — 도금 옵션

- PK: `plating_variant_id uuid`
- 실제 컬럼(너가 확인)
  - `plating_type` (enum)
  - `color_code text`
  - `thickness_code text`
  - `display_name text`
  - `is_active boolean`
  - `created_at timestamptz`
- 특이사항
  - `pv.code` 컬럼 없음 → 표시/선택은 `display_name` 기반

---

### 4.8 `public.cms_plating_price_rule` — 도금 가격 룰

- PK: `rule_id uuid`
- FK: `plating_variant_id -> cms_plating_variant.plating_variant_id`
- 주요 컬럼(너가 확인)
  - `category_code cms_e_category_code`
  - `material_code cms_e_material_code`
  - `effective_from date`
  - `is_active boolean`
  - `priority int`
  - `sell_fixed_krw numeric`
  - `cost_fixed_krw numeric`
  - `sell_per_g_krw numeric`
  - `cost_per_g_krw numeric`
  - `note text`
  - `created_at timestamptz`
- 특이사항
  - `material_code='00'` 공용 룰은 정책적으로 “material 무시 fallback”이 필요(아래 8장에서 다룸)

---

### 4.9 `public.cms_labor_band_rule` — 공임 구간 룰

- PK: `band_id uuid`
- 주요 컬럼(너가 확인)
  - `category_code cms_e_category_code`
  - `band_code text`
  - `band_rank int`
  - `effective_from date`
  - `is_active boolean`
  - `note text`
  - sell: `labor_base_sell`, `labor_center_sell`, `labor_sub1_sell`, `labor_sub2_sell`, `labor_bead_sell`
  - cost: `labor_base_cost`, `labor_center_cost`, `labor_sub1_cost`, `labor_sub2_cost`, `labor_bead_cost`
  - `created_at timestamptz`
- 특이사항
  - `band_code`가 비어도 운영이 멈추지 않게 “DEFAULT fallback” 전략 권장

---

### 4.10 `public.cms_market_tick` — 시세

- 핵심 컬럼(운영)
  - `tick_id uuid`
  - `symbol` (예: `GOLD_KRW_PER_G`, `SILVER_KRW_PER_G`)
  - `price numeric`
  - `observed_at timestamptz`
- 특이사항
  - confirm 시점 latest tick을 라인에 스냅샷 저장

---

### 4.11 `public.cms_shipment_header` — 출고 헤더

- PK: `shipment_id uuid`
- FK: `customer_party_id -> cms_party.party_id`
- 주요 컬럼
  - `status cms_e_shipment_status` (DRAFT/CONFIRMED/CANCELLED)
  - `ship_date date`
  - `confirmed_at timestamptz`
  - `memo text`

---

### 4.12 `public.cms_shipment_line` — 출고 라인(스냅샷 핵심)

- PK: `shipment_line_id uuid`
- FK
  - `shipment_id -> cms_shipment_header.shipment_id`
  - `order_line_id -> cms_order_line.order_line_id` (nullable)
  - `repair_line_id -> cms_repair_line.repair_line_id` (nullable)
  - `plating_variant_id -> cms_plating_variant.plating_variant_id` (nullable)
- 주요 컬럼(스냅샷/가격)
  - 품목: `category_code`, `material_code`, `model_name`, `suffix`, `color`, `size`, `qty`
  - 중량: `measured_weight_g`, `deduction_weight_g`, `net_weight_g`
  - 모드: `pricing_mode`, `unit_price_krw`, `manual_total_amount_krw`
  - 도금: `is_plated`, `plating_variant_id`
  - 금액: `material_amount_*`, `labor_*`, `plating_amount_*`, `repair_fee_krw`, `total_amount_*`
  - 확정: `is_priced_final boolean`, `priced_at timestamptz`
  - 추적: `price_calc_trace jsonb`
- 특이사항(운영 핵심)
  - **confirm 이후 라인은 사실상 “회계 스냅샷”** 이므로 UI에서 수정 제한 권장

---

### 4.13 `public.cms_payment_header`, `public.cms_payment_tender_line`

- `cms_payment_header`
  - PK: `payment_id uuid`
  - FK: `party_id -> cms_party`
  - `paid_at timestamptz`
  - `memo text`
- `cms_payment_tender_line`
  - PK: `tender_line_id uuid`
  - FK: `payment_id -> cms_payment_header`
  - `amount_krw numeric`
  - `method text` 또는 enum
  - `meta jsonb`
- 특이사항
  - 결제는 출고에 1:1 매칭 강제 X (원장 합으로 잔액)

---

### 4.14 `public.cms_return_line`

- PK: `return_line_id uuid`
- FK: `shipment_line_id -> cms_shipment_line`
- 주요 컬럼
  - `return_qty int`
  - `occurred_at timestamptz`
  - `override_amount_krw numeric` (옵션)
  - `reason text`

---

### 4.15 `public.cms_ar_ledger` — 미수 원장(SoT)

- PK: `ar_ledger_id uuid`
- FK: `party_id -> cms_party`
- 주요 컬럼
  - `entry_type` (SHIPMENT/PAYMENT/RETURN/OFFSET/ADJUST 등)
  - `amount_krw numeric` (+/-)
  - `shipment_id` 등 참조 컬럼
  - `occurred_at timestamptz`
  - `memo text`
- 특이사항
  - 잔액/크레딧은 “원장 합계”로만 계산한다(SoT)

---

### 4.16 `public.cms_status_event`, `public.cms_decision_log`

- 상태 변경/확정/오버라이드 기록
- 분석/감사/추적을 위한 필수 로그 테이블

---

## 5) View(읽기 최적화)

- `public.cms_v_repair_line_enriched_v1`
  - customer_name, plating_display_name 등 join된 읽기용 뷰
  - 주의: 원본 `weight_received_g`를 `measured_weight_g`로 alias 할 수 있음(함수/테이블은 원본 기준)

- `AR position view` 계열(거래처별 잔액/포지션)
  - 원장 집계로 제공

---

## 6) RPC 함수(쓰기는 이것만)

### 6.1 Party / Order / Repair
- `cms_fn_upsert_party_v1(p_party_type, p_name, p_phone, p_region, p_address, p_memo, p_party_id) -> uuid`
- `cms_fn_upsert_order_line_v1(...) -> uuid`
- `cms_fn_upsert_repair_line_v1(...) -> uuid`

### 6.2 Shipment
- `cms_fn_create_shipment_header_v1(p_customer_party_id, p_ship_date, p_memo) -> uuid`
- `cms_fn_add_shipment_line_from_order_v1(...) -> uuid`
- `cms_fn_add_shipment_line_from_repair_v1(...) -> uuid`
- `cms_fn_add_shipment_line_ad_hoc_v1(...) -> uuid`
- `cms_fn_update_shipment_line_v1(...) -> jsonb`
- `cms_fn_delete_shipment_line_v1(...)`
- `cms_fn_confirm_shipment(p_shipment_id, p_actor_person_id default null, p_note default null) -> jsonb`

### 6.3 Payment / Return / Tick
- `cms_fn_record_payment(...)`
- `cms_fn_record_return(...)`
- `cms_fn_latest_tick(symbol)`

---

## 7) 실제로 밟은 함정(재발 방지)

### 7.1 `:param` 문법 에러
- Supabase SQL Editor/psql에서 `:customer_party_id`는 문법 오류
- 해결: UI 레이어에서 바인딩하거나, 테스트 SQL에는 실제 UUID를 직접 넣기

### 7.2 enum 불일치
- 주문 status에 `'DRAFT'` 같은 값 넣으면 즉시 에러
- 해결: UI는 enum 목록을 DB에서 가져오거나, 최소 “실제 enum 값”만 사용

### 7.3 도금 variant `pv.code` 없음
- 표시/조인은 `display_name`, `plating_type` 사용

### 7.4 수리 중량 컬럼명
- 테이블: `weight_received_g`
- (뷰/표시): `measured_weight_g`로 alias 가능
- 함수/테이블 write는 항상 실컬럼 기준

### 7.5 함수 default 파라미터 변경 제한
- Postgres는 기존 함수에서 default 제거/변경을 제한할 수 있음
- 안전 패턴
  - 시그니처 유지: `create or replace`
  - 시그니처 변경 필요 시: `drop function (정확한 시그니처)` 후 `create`

---

## 8) “13번(혼선 정리)” — confirm_shipment vs 정책 패치

### 8.1 confirm_shipment(긴 버전)은 “본체”
- `cms_fn_confirm_shipment`는 def_len이 큰(약 18k) 긴 버전이 정상
- 짧은 13은 본체를 대체하는 것이 아니라 “가드 1개 추가” 같은 패치 성격일 수 있음
- 결론: **긴 confirm_shipment는 유지**

### 8.2 별개 13안(폴백/트리거)은 “보조 정책”
아래 3개를 추가하는 용도:
1) `cms_fn_pick_labor_band_rule` DEFAULT fallback 강화
2) `cms_fn_pick_plating_rule` material_code='00' 공용 fallback 강화
3) repair fee만 있는 라인의 cost=0 방지 트리거(정책)

> 적용할 경우 confirm_shipment를 바꾸는 게 아니라  
> picker 함수 + trigger를 추가/교체하는 “정책 마이그레이션”으로 분리해서 넣어야 한다.

---

# 9) 운영 전 필수 3종

## 9.1 권한/GRANT/RLS 최종 점검
- [ ] staff/authenticated가 base table에 INSERT/UPDATE/DELETE 권한 없음
- [ ] staff/authenticated는 `EXECUTE`로 `cms_fn_*`만 호출 가능
- [ ] SELECT은 `cms_v_*`/최소 테이블만 허용
- [ ] RLS가 직접 write를 추가로 방어(권한+RLS 이중화)

## 9.2 staff/authenticated가 RPC만 쓰는지
- [ ] UI 코드에서 테이블에 직접 write하는 쿼리 0개
- [ ] 모든 저장/삭제/확정 버튼은 RPC 1회 호출

## 9.3 base table 직접 write 막혔는지(실증)
- [ ] staff role로 `insert into cms_shipment_line ...` 시도 → 실패
- [ ] staff role로 `update cms_party set ...` 시도 → 실패
- [ ] staff role로 `select * from cms_v_*` → 성공
- [ ] staff role로 `select cms_fn_*` → 성공

---

# 10) 엣지케이스 회귀 테스트 (고정 5개)

1) **measured_weight 없는 14/18/24 라인 confirm 막힘**
- 조건: `material_code in ('14','18','24')` AND `measured_weight_g is null`
- 기대: `cms_fn_confirm_shipment` 예외

2) **plating_variant 없는데 is_plated=true 막힘**
- 조건: `is_plated=true` AND `plating_variant_id is null`
- 기대: confirm(최소)에서 예외

3) **shipment 라인 0개 confirm 막힘**
- 조건: `cms_shipment_line` 0건
- 기대: `cannot confirm shipment with no lines`

4) **payment/return offset 시 잔액/크레딧 정상**
- 시나리오:
  - 출고 +171,135
  - 결제 -200,000(크레딧)
  - 추가 출고 +50,000
- 기대: 잔액(sum) = +21,135 (크레딧 반영 정상)

5) **repair fee만 있는 라인 cost policy 정상**
- 수리 라인: sell=repair_fee만 존재
- 기대: cost가 정책대로 보정(정책 적용 시)

---

# 11) 시드/데모 데이터 최소셋(Reset마다 재현)

## 11.1 고정 거래처 3종(필수)
- 소매A(customer) = `11111111-1111-1111-1111-111111111111`
- 소매B(customer) = `11111111-1111-1111-1111-222222222222`
- 공장AB(vendor)  = `22222222-2222-2222-2222-222222222222`

## 11.2 seed.sql 최소 예시(고정 ID)
```sql
insert into public.cms_party(party_id, party_type, name, phone, region, address, note, is_active)
values
  ('11111111-1111-1111-1111-111111111111','customer','소매A','010-1111-1111','서울', null, 'seed', true),
  ('11111111-1111-1111-1111-222222222222','customer','소매B','010-2222-2222','부산', null, 'seed', true),
  ('22222222-2222-2222-2222-222222222222','vendor','공장AB','010-9999-0000','중국', null, 'seed', true)
on conflict (party_id) do update set
  party_type=excluded.party_type,
  name=excluded.name,
  phone=excluded.phone,
  region=excluded.region,
  address=excluded.address,
  note=excluded.note,
  is_active=excluded.is_active;

-- 도금 variant 최소 1개(예: Phase1용)
insert into public.cms_plating_variant(plating_variant_id, plating_type, display_name, is_active)
values ('9f0c15f2-82df-4909-87d6-b13aa628571e','P','G (Phase1)', true)
on conflict (plating_variant_id) do update set
  plating_type=excluded.plating_type,
  display_name=excluded.display_name,
  is_active=excluded.is_active;

# 12) UI/UX 코딩 에이전트 지시서(페이지별)
## 12.0 전역 구현 규칙(다시 강조, LOCK)
base table write 금지

RPC 1회 호출로 상태 전환/저장

confirm 로직 재구현 금지(서버 함수만)

enum 하드코딩 금지(실제 enum 값만)

UUID 직접 입력 UX 금지(리스트 선택 기반)

## 12.1 Party 페이지
좌측 리스트: customer/vendor, region, is_active 필터

우측 폼: name 필수, phone/region/address/note

저장: cms_fn_upsert_party_v1

## 12.2 Order(주문 라인) 페이지
상단 입력폼(최단 입력):

customer(필수), model_name(필수), suffix(필수), color(필수), qty(기본 1)

is_plated 체크 시 plating_variant 필수

하단 리스트:

customer/status/date filter

저장/수정: cms_fn_upsert_order_line_v1

## 12.3 Repair(수리) 페이지
접수폼:

customer(필수), received_at(필수)

model_name/suffix/color/material/qty

weight 입력(라벨: measured_weight, 실제 저장은 서버가 처리)

repair_fee_krw(유상일 때)

is_plated + plating_variant

저장/수정: cms_fn_upsert_repair_line_v1

조회는 cms_v_repair_line_enriched_v1 우선 사용

## 12.4 Shipment(출고) 페이지 — 핵심
헤더 생성:

customer 선택 → cms_fn_create_shipment_header_v1

라인 추가 3종:

주문에서 추가: cms_fn_add_shipment_line_from_order_v1

수리에서 추가: cms_fn_add_shipment_line_from_repair_v1

Ad-hoc 추가: cms_fn_add_shipment_line_ad_hoc_v1

라인 편집:

cms_fn_update_shipment_line_v1

라인 삭제:

cms_fn_delete_shipment_line_v1

확정:

cms_fn_confirm_shipment

성공 시 total_sell/cost 표시 + 헤더/라인 잠금 전환

## 12.5 AR(미수) 페이지
거래처 잔액 리스트(원장 집계)

거래처 상세 ledger 타임라인

결제 등록: cms_fn_record_payment

반품 등록: cms_fn_record_return

크레딧(음수 잔액) 정상 표시

## 12.6 Master(마스터) 페이지
model_name 검색/상세

category/material default, deduction default, labor profile, band_code, plating defaults 등 관리

Phase1에서는 “없어도 출고가 막히지 않게” (라인 입력으로 보완 가능)

