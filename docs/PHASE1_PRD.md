# Phase1 DB·UI 설계(PRD v1) — “운영 + 데이터분석/ML + 자동화” 최우선

## 0) 목적(Why)
- **운영이 돌아가는 시스템**을 만들되, 핵심 목표는 **데이터를 많이·정확히 쌓아서**  
  1) 데이터 기반 의사결정(리드타임/마진/거래처 행동/공장 성과/도금 영향/단가제 vs 룰제 등)  
  2) 자동화(n8n) + 지도학습/머신러닝(매칭/가격추천/리드타임 예측/반품 가능성 예측 등)  
  으로 확장 가능한 **학습 가능한 운영 DB**를 만드는 것.

---

## 1) 범위(Scope)
### Phase1 포함
- 명부: **소매상(고객)/공장(벤더)** + 주소 + “한 사람이 여러 거래처 운영”
- 주문(라인 중심) + 상태 단계(리드타임 분석용)
- 출고(거래처 기준 헤더+라인) + **출고 확정 시 가격 스냅샷 잠금**
- 미수(AR) 원장(ledger) + 결제(복수 수단) + 반품(부분반품/수동 override)
- 수리(무상/유상) + 수리도 출고에 포함 + 도금 가능
- 마스터카드(기성 정보)
- 시세 테이블(n8n 스크랩 적재)

### Phase2 제외(나중)
- 구매/재고(단, 분석을 위한 “이벤트/기록” 구조는 Phase1에 미리 깔아둠)

---

## 2) 핵심 규칙(LOCK)
### 돈(미수) 규칙
- **미수(AR)는 출고 확정 시점에만 증가(+).**
- 결제/상계/반품은 AR 원장에 **감소(-)** 로 기록.
- 결제는 “특정 출고 매칭 강제 X” (총액 입금) → 원장 합으로 잔액 관리.

### 가격 확정 규칙
- 주문 입력 시 **가격 입력 없음**.
- 출고 확정 시점에만 가격 확정 + 스냅샷 잠금.
- 출고라인 가격모드:
  - **RULE(기본)**: 소재가격 + 총공임 + 도금비
  - **UNIT(단가제)**: `단가 × 수량` (**단가에 도금 포함**, RULE 산식 금액은 가격에 섞지 않음)
  - **AMOUNT_ONLY(ad-hoc B)**: 금액 수기(모델명 없이도 가능)

### 소재가격(Phase1 산식)
- `net_weight_g = measured_weight_g - deduction_weight_g`
- 14K: `gold_tick * 0.6435 * net_weight_g`
- 18K: `gold_tick * 0.825 * net_weight_g`
- 24K: `gold_tick * 1.0 * net_weight_g`
- 925: `silver_tick * 0.925 * 1.2 * net_weight_g`
- 00: **중량 없이 공임/도금만**(소재가격=0)

### 도금(Phase1)
- 도금 가능: 주문/수리/출고 모두(출고 확정 때 금액 잠금)
- Phase1 도금 타입: **P/W/G**
- 도금 가격: **카테고리/재질별 정액(B) + 중량비례(C) 모두 지원**
- 도금 variant(색상/두께/종류 확장) 구조는 **테이블로 넓게** 설계

### 반품
- 부분반품 가능
- 기본: `출고라인 금액 / 출고라인 수량 × 반품수량` 자동 계산
- 필요 시 **수동 override** 가능(최종 차감액 저장)

### 주문 상태(리드타임 분석용)
- 최소 단계 포함(버튼 + 일부 자동):
  - ORDER_PENDING → SENT_TO_VENDOR → WAITING_INBOUND → READY_TO_SHIP → SHIPPED → CLOSED (+CANCELLED)
- 출고 확정 시, 연결된 주문/수리는 자동 SHIPPED로 변경(B).

### 마스터 매칭
- `model_name`만 같으면 매칭(사람이 최종 판단)
- 데이터 축적 후 자동화/학습 확장

---

## 3) 카테고리 코드(LOCK)
> DB에는 **영문 code + 한글 label** 권장(분석/확장/다국어 대응).
- BRACELET(팔찌)
- NECKLACE(목걸이)
- EARRING(귀걸이)
- RING(반지)
- PIERCING(피어싱)
- PENDANT(펜던트)
- WATCH(시계)
- KEYRING(키링)
- SYMBOL(상징)
- ETC(기타)

---

## 4) “데이터 분석/ML”을 위한 설계 원칙
### 4.1 스냅샷 + 로그 + 원문 보관(3종 세트)
1) **스냅샷**: 출고 확정 시 사용한 시세/룰/공임/도금/중량/최종금액을 `shipment_line`에 잠금 저장 → 재현 가능.
2) **이벤트 로그**: 상태 전환(`status_event`)과 결정/수정(`decision_log`)을 자동으로 누적 → 리드타임/라벨 데이터.
3) **원문 보관**: 모델명/메모 등 원문(`*_raw`) 저장 → 정규화/오타/alias 학습 가능.

### 4.2 비용(cost) 스냅샷을 같이 저장(강추)
- 판매(sell)만 저장하면 “운영”은 되지만 “의사결정”이 약해짐.
- Phase1부터 `total_amount_cost_krw`까지 같이 잠가두면:
  - 카테고리/공장/도금/단가제별 **마진** 분석이 바로 가능.

### 4.3 “자동으로 생기는 것” 최대 활용
- status_event로 **구간별 대기시간** 자동 생성
- shipment_line에서 **마스터 대비 편차(중량/공임/도금)** 자동 피처 생성
- 결제/반품 타이밍으로 **회수기간(DSO)** 자동 추정

---

## 5) 스키마 설계(v1) — 테이블/컬럼 계획

### 5.1 공통 컬럼(모든 주요 테이블에 권장)
- `created_at` timestamptz
- `updated_at` timestamptz
- `created_by_person_id` uuid nullable (FK → person)
- `updated_by_person_id` uuid nullable (FK → person)
- `source_channel` text nullable (전화/카톡/현장/기타/자동화 등)
- `correlation_id` uuid nullable (배치/자동화 추적)

> 실제 DB 적용 시 “전부 강제”가 아니라, 최소 `created_at/updated_at`는 필수, 나머지는 점진 도입 가능.

---

## 5.2 명부

### (1) person
| 컬럼 | 타입 | 제약 |
|---|---|---|
| person_id | uuid | PK |
| name | text |  |
| phone | text |  |
| note | text |  |
| created_at | timestamptz |  |

### (2) party (거래처/공장 통합)
| 컬럼 | 타입 | 제약 |
|---|---|---|
| party_id | uuid | PK |
| party_type | enum(customer,vendor) | NOT NULL |
| name | text | NOT NULL |
| phone | text |  |
| region | text |  |
| note | text |  |
| is_active | bool | default true |
| created_at | timestamptz |  |

인덱스 권장: `(party_type, name)`, `(name)`

### (3) party_person_link (N:M)
| 컬럼 | 타입 | 제약 |
|---|---|---|
| party_id | uuid | FK → party |
| person_id | uuid | FK → person |
| role | text |  |
| is_primary | bool | default false |
| created_at | timestamptz |  |

유니크 권장: `(party_id, person_id, role)`

### (4) party_address
| 컬럼 | 타입 | 제약 |
|---|---|---|
| address_id | uuid | PK |
| party_id | uuid | FK → party, NOT NULL |
| label | text |  |
| address_text | text | NOT NULL |
| is_default | bool | default false |
| created_at | timestamptz |  |

---

## 5.3 마스터카드(기성)

### (5) master_item
| 컬럼 | 타입 | 제약/설명 |
|---|---|---|
| master_id | uuid | PK |
| model_name | text | UNIQUE, NOT NULL (`AB-10293`) |
| vendor_party_id | uuid | FK → party(vendor), nullable |
| category_code | enum | NOT NULL(권장) |
| material_code_default | enum(14,18,24,925,00) |  |
| weight_default_g | numeric |  |
| deduction_weight_default_g | numeric | default 0 |

스톤(개수):
- `center_qty_default`, `sub1_qty_default`, `sub2_qty_default` (int)

공임(판매 sell) — 요청 반영(각각 분리):
- `labor_base_sell`
- `labor_center_sell`
- `labor_sub1_sell`
- `labor_sub2_sell`
- `labor_bead_sell`
- `labor_total_sell` *(저장 또는 뷰 계산)*

공임(원가 cost):
- `labor_base_cost`
- `labor_center_cost`
- `labor_sub1_cost`
- `labor_sub2_cost`
- `labor_bead_cost`
- `labor_total_cost`

도금 기본값(판매/원가):
- `plating_price_sell_default`
- `plating_price_cost_default`

분석/자동화용:
- `labor_profile_mode` enum(MANUAL,BAND) default MANUAL
- `labor_band_code` text nullable (BAND일 때)
- `note`, timestamps

인덱스: `(model_name)`, `(vendor_party_id)`, `(category_code)`

---

## 5.4 공임 구간 정책(Phase1에 “테이블은 깔기” — 선택 B 반영)

### (6) labor_band_rule
> “카테고리별 6단계”를 안정적으로 운영/분석하기 위한 정책 테이블.
- 정책은 “미래 출고”에만 적용(출고 확정 스냅샷은 고정).

| 컬럼 | 타입 | 설명 |
|---|---|---|
| band_id | uuid | PK |
| category_code | enum | NOT NULL |
| band_code | text | 예: B1~B6 |
| band_rank | int | 1~6 |
| effective_from | date | 적용 시작일 |
| is_active | bool |  |
| note | text |  |

공임(판매 sell):
- `labor_base_sell`, `labor_center_sell`, `labor_sub1_sell`, `labor_sub2_sell`, `labor_bead_sell`

공임(원가 cost):
- `labor_base_cost`, `labor_center_cost`, `labor_sub1_cost`, `labor_sub2_cost`, `labor_bead_cost`

유니크 권장: `(category_code, band_code, effective_from)`

> 운영 방식 추천:
- master_item에 `labor_profile_mode=BAND` + `labor_band_code`를 부여
- 출고 확정 시 “그 날짜에 활성화된 band_rule”을 조회하여 `shipment_line`에 스냅샷 저장
- 공임 인상은 `labor_band_rule`만 업데이트하면 “미래 출고”에 자동 반영

---

## 5.5 시세(n8n 적재)

### (7) market_tick
| 컬럼 | 타입 | 제약 |
|---|---|---|
| tick_id | uuid | PK |
| symbol | enum(GOLD_KRW_PER_G, SILVER_KRW_PER_G) | NOT NULL |
| price | numeric | NOT NULL |
| observed_at | timestamptz | NOT NULL |
| source | text |  |
| meta | jsonb |  |

인덱스: `(symbol, observed_at desc)`

---

## 5.6 도금 Variant(Phase1에 테이블로 넓게) — 선택 B 반영

### (8) plating_variant
| 컬럼 | 타입 | 설명 |
|---|---|---|
| plating_variant_id | uuid | PK |
| plating_type | enum(P,W,G) | NOT NULL(Phase1) |
| color_code | text | 예: WHITE/YELLOW/ROSE 등(확장) |
| thickness_code | text | 예: T1/T2…(확장) |
| display_name | text | UI 표시용 |
| is_active | bool | default true |

> Phase1 최소 운영:
- plating_type만 써도 됨
- color/thickness는 나중에 채우고, 지금은 nullable 허용

### (9) plating_price_rule
| 컬럼 | 타입 | 설명 |
|---|---|---|
| rule_id | uuid | PK |
| plating_variant_id | uuid | FK → plating_variant, NOT NULL |
| category_code | enum | nullable(전체 공통) |
| material_code | enum(14,18,24,925,00) | nullable(전체 공통) |
| charge_mode | enum(FIXED, PER_G) | NOT NULL |
| sell_fixed_krw | numeric |  |
| cost_fixed_krw | numeric |  |
| sell_per_g_krw | numeric |  |
| cost_per_g_krw | numeric |  |
| priority | int | default 100 |
| is_active | bool | default true |
| note | text |  |

룰 선택 로직(권장):
- 가장 구체한 룰 우선: (variant + category + material) > (variant + category) > (variant) …
- tie-break: priority 낮은 값 우선

---

## 5.7 주문(라인 중심)

### (10) order_line
| 컬럼 | 타입 | 제약/설명 |
|---|---|---|
| order_line_id | uuid | PK |
| customer_party_id | uuid | FK → party(customer), NOT NULL |
| model_name | text | NOT NULL |
| model_name_raw | text | 원문 보관(학습용) |
| suffix | text | NOT NULL |
| color | text | NOT NULL |
| size | text |  |
| qty | int | NOT NULL default 1 |
| is_plated | bool | default false |
| plating_variant_id | uuid | FK → plating_variant, nullable |
| memo | text |  |
| status | enum | NOT NULL |
| vendor_party_id_guess | uuid | nullable(모델 prefix로 추정) |
| matched_master_id | uuid | FK → master_item, nullable |
| match_decision_state | enum(AUTO_MATCHED,HUMAN_CONFIRMED,HUMAN_OVERRIDDEN,UNMATCHED) | 분석/학습 |
| created_at/updated_at | timestamptz |  |

인덱스: `(customer_party_id, status)`, `(model_name)`, `(created_at desc)`

---

## 5.8 수리(라인)

### (11) repair_line
- order_line과 유사 + 수리 고유 필드 포함

주요 필드:
- `repair_line_id` PK
- `customer_party_id` FK, NOT NULL
- `received_at` date NOT NULL
- `model_name` nullable + `model_name_raw` 권장
- `material_code` enum nullable
- `color`, `qty`, `weight_received_g`
- `is_paid` bool, `repair_fee_krw` numeric(유상 수동)
- `is_plated`, `plating_variant_id`
- `status` enum(RECEIVED/IN_PROGRESS/READY_TO_SHIP/SHIPPED/CLOSED/CANCELLED)
- timestamps + created_by/source_channel/correlation_id

인덱스: `(customer_party_id, status)`, `(received_at desc)`

---

## 5.9 출고(거래처 헤더+라인) + 가격 스냅샷 잠금

### (12) shipment_header
| 컬럼 | 타입 | 설명 |
|---|---|---|
| shipment_id | uuid | PK |
| customer_party_id | uuid | FK → party, NOT NULL |
| ship_date | date |  |
| ship_to_address_id | uuid | FK → party_address, nullable |
| status | enum(DRAFT,CONFIRMED,CANCELLED) |  |
| memo | text |  |
| confirmed_at | timestamptz |  |
| created_at | timestamptz |  |

인덱스: `(customer_party_id, status)`, `(ship_date desc)`

### (13) shipment_line
**참조(부분출고/분석용)**
- `order_line_id` FK nullable
- `repair_line_id` FK nullable
- `ad_hoc_mode` enum(NONE, MODEL_ONLY, AMOUNT_ONLY) default NONE  
- `ad_hoc_category_code` enum nullable(AMOUNT_ONLY면 사실상 필수)
- `ad_hoc_name` text nullable

**스냅샷 품목**
- `category_code` enum
- `model_name`, `suffix`, `color`, `size`, `qty`

**중량**
- `measured_weight_g` numeric nullable
- `deduction_weight_g` numeric default 0 (마스터 기본값 불러오되 override 가능)
- `net_weight_g` numeric nullable

**가격모드**
- `pricing_mode` enum(RULE, UNIT, AMOUNT_ONLY) default RULE
- `unit_price_krw` numeric nullable (UNIT)
- `unit_price_includes_plating` bool default true (LOCK)
- `manual_total_amount_krw` numeric nullable (AMOUNT_ONLY)

**시세 스냅샷**
- `gold_tick_id` uuid nullable (FK → market_tick)
- `silver_tick_id` uuid nullable (FK → market_tick)
- `gold_tick_krw_per_g` numeric nullable
- `silver_tick_krw_per_g` numeric nullable
- `silver_adjust_factor` numeric default 1.2

**도금 스냅샷(판매/원가)**
- `is_plated` bool
- `plating_variant_id` uuid nullable
- `plating_amount_sell_krw` numeric default 0
- `plating_amount_cost_krw` numeric default 0

**소재/공임 스냅샷(판매/원가)**
- `material_code` enum(14,18,24,925,00)
- `material_amount_sell_krw` numeric default 0
- `material_amount_cost_krw` numeric default 0
- 공임 sell: `labor_base_sell_krw`, `labor_center_sell_krw`, `labor_sub1_sell_krw`, `labor_sub2_sell_krw`, `labor_bead_sell_krw`, `labor_total_sell_krw`
- 공임 cost: `labor_base_cost_krw`, `labor_center_cost_krw`, `labor_sub1_cost_krw`, `labor_sub2_cost_krw`, `labor_bead_cost_krw`, `labor_total_cost_krw`

**수리**
- `repair_fee_krw` numeric default 0

**최종**
- `total_amount_sell_krw` numeric NOT NULL default 0  (AR 기준)
- `total_amount_cost_krw` numeric NOT NULL default 0  (마진 분석)
- `is_priced_final` bool default false
- `priced_at` timestamptz nullable

**재현/학습용 Trace(강추)**
- `price_calc_trace` jsonb (룰 선택 결과, band_code, 사용한 variant, 오버라이드 여부 등)

**체크 제약(권장)**
- (1) `order_line_id`/`repair_line_id`/`ad_hoc_mode!=NONE` 중 **최소 하나는 존재**
- (2) `pricing_mode=UNIT`이면 `unit_price_krw NOT NULL`
- (3) `pricing_mode=AMOUNT_ONLY`이면 `manual_total_amount_krw NOT NULL`
- (4) `is_plated=true`이면 `plating_variant_id NOT NULL` 권장
- (5) `material_code=00`이면 `material_amount_* = 0` 권장

인덱스: `(shipment_id)`, `(order_line_id)`, `(repair_line_id)`, `(model_name)`

---

## 5.10 결제(복수 수단) — 요청 반영

### (14) payment_header
| 컬럼 | 타입 | 설명 |
|---|---|---|
| payment_id | uuid | PK |
| party_id | uuid | FK → party, NOT NULL |
| paid_at | timestamptz | NOT NULL |
| memo | text |  |
| total_amount_krw | numeric | tender 합계(저장 권장) |
| created_at | timestamptz |  |

### (15) payment_tender_line
| 컬럼 | 타입 | 설명 |
|---|---|---|
| tender_line_id | uuid | PK |
| payment_id | uuid | FK → payment_header, NOT NULL |
| method | enum(BANK,CASH,GOLD,SILVER,OFFSET) | NOT NULL |
| amount_krw | numeric | NOT NULL(환산 고정, LOCK) |
| meta | jsonb | GOLD/SILVER면 중량/평가시세/평가일 등 |
| created_at | timestamptz |  |

> 결제 입력 시점에 환산 고정(A).  
> 이후 AR 원장에는 payment_id 기준으로 “총액 1줄”만 내려서 원장 단순화.

---

## 5.11 반품(부분반품 + override)

### (16) return_line
| 컬럼 | 타입 | 설명 |
|---|---|---|
| return_line_id | uuid | PK |
| party_id | uuid | FK → party, NOT NULL |
| shipment_line_id | uuid | FK → shipment_line, NOT NULL |
| return_qty | int | default 1 |
| auto_return_amount_krw | numeric | 자동 계산값 |
| final_return_amount_krw | numeric | override 가능(기본=auto) |
| reason | text |  |
| occurred_at | timestamptz | NOT NULL |
| created_at | timestamptz |  |

---

## 5.12 AR 원장(ledger) — 단 하나의 진실(SoT)

### (17) ar_ledger
| 컬럼 | 타입 | 설명 |
|---|---|---|
| ar_ledger_id | uuid | PK |
| party_id | uuid | FK → party, NOT NULL |
| occurred_at | timestamptz | NOT NULL |
| entry_type | enum(SHIPMENT,PAYMENT,RETURN,OFFSET,ADJUST) | NOT NULL |
| amount_krw | numeric | NOT NULL(증가 + / 감소 -) |
| shipment_id | uuid | nullable |
| shipment_line_id | uuid | nullable(부분반품 대비) |
| payment_id | uuid | nullable |
| return_line_id | uuid | nullable |
| memo | text |  |
| created_at | timestamptz |  |

핵심 뷰:
- `v_ar_balance_by_party`: `sum(amount_krw)` by party

---

## 5.13 “자동으로 생기는 데이터” 핵심 2종(분석/ML에 필수)

### (18) status_event (리드타임/KPI의 핵심)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| event_id | uuid | PK |
| entity_type | enum(ORDER_LINE,REPAIR_LINE,SHIPMENT_HEADER) | NOT NULL |
| entity_id | uuid | NOT NULL |
| from_status | text |  |
| to_status | text | NOT NULL |
| occurred_at | timestamptz | NOT NULL |
| actor_person_id | uuid | FK → person, nullable |
| reason | text |  |
| correlation_id | uuid | nullable |

### (19) decision_log (지도학습 라벨/설명가능성)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| decision_id | uuid | PK |
| entity_type | text | ORDER_LINE/SHIPMENT_LINE/RETURN_LINE 등 |
| entity_id | uuid |  |
| decision_kind | enum(MASTER_MATCH,PRICE_OVERRIDE,DEDUCTION_OVERRIDE,PLATING_OVERRIDE,RETURN_OVERRIDE,STATUS_OVERRIDE) |  |
| before | jsonb |  |
| after | jsonb |  |
| actor_person_id | uuid |  |
| occurred_at | timestamptz |  |
| note | text |  |

---

## 6) 요청 3번(납기/우선순위) — “추천대로” 최적안(LOCK 제안)
> 리드타임 분석/지연 분석에 압도적으로 도움 되므로 Phase1부터 강추.

### order_line / repair_line에 추가 추천
- `requested_due_date` (date) : 거래처 요청 납기
- `priority_code` enum(NORMAL,URGENT,VVIP 등) : 우선순위
- `requested_ship_window` text/jsonb(선택) : “오후/당일/주말제외” 같은 자연어 요청

이 3개는 향후:
- “요청 납기 대비 지연율”
- “우선순위별 병목”
- “급한 주문의 마진/반품률”
분석에 바로 쓰임.

---

# 7) 출고 확정 트랜잭션(핵심) — 데이터가 깨지지 않게
출고 확정 시 반드시 한 트랜잭션으로:
1) `shipment_header.status = CONFIRMED`, `confirmed_at` set
2) 각 `shipment_line`에 대해:
   - 참조 데이터 로드(order_line/repair_line/master_item, labor_band_rule, plating_price_rule, market_tick)
   - `pricing_mode`별로 계산:
     - RULE: 소재 + 공임 + 도금 → sell/cost 스냅샷 → `total_amount_*`
     - UNIT: `unit_price × qty`로 `total_amount_sell` 확정(도금 포함)  
       - (권장) RULE 산식 값은 `price_calc_trace`에 기록만 남겨도 됨
     - AMOUNT_ONLY: `manual_total_amount_krw`
   - `is_priced_final=true`, `priced_at` set
3) AR 증가:
   - `ar_ledger(entry_type=SHIPMENT, amount=+sum(lines.total_amount_sell))` 1줄 생성
   - (선택) 부분반품 정밀 추적이 필요하면 shipment_line_id 단위로도 생성 가능(Phase1은 1줄 추천)
4) 상태 자동:
   - 연결된 `order_line.status=SHIPPED`, `repair_line.status=SHIPPED`
   - 각 변경은 `status_event`로 기록

---

# 8) UI(Phase1) — “데이터가 쌓이게” 설계(버튼/입력/자동로그)

## 8.1 주문(라인) 페이지
### 주요 목표
- 입력이 빠르고, 상태 전환이 명확하고, **모든 변경이 로그로 남음**

### 필수 컴포넌트
- 주문 라인 생성 폼(필수 4개 + 옵션)
  - 거래처, 모델명, 종류(suffix), 색상 (NOT NULL)
  - 수량, 도금체크 + P/W/G 선택
  - 납기(requested_due_date), 우선순위(priority)
  - source_channel(전화/카톡/현장/자동)
- 리스트/필터
  - 상태, 거래처, 공장(모델 prefix 추정), 카테고리, 도금여부, 납기 임박
- 액션
  - 상태 변경 버튼(ORDER_PENDING→…)
  - **출고 만들기**(선택한 라인 → 거래처별로 shipment draft 생성)
- 자동 생성 데이터
  - status_event(상태 변경)
  - decision_log(마스터 매칭을 사람이 확정/override 할 때)

## 8.2 출고 페이지
### 주요 목표
- 출고 확정 시 “가격·미수·로그”가 한 번에 정확히 찍혀야 함

### 화면 구성
- 출고 헤더: 거래처/주소/메모
- 출고 라인 편집:
  - 주문/수리 라인 검색 추가 + ad-hoc 추가
  - model_name 입력 시 마스터 자동 불러오기(카테고리/기성 공임/차감중량/도금 기본)
  - 실측중량 입력(필수, 00/AMOUNT_ONLY 예외)
  - 차감중량 override 가능(토글 + 입력)
  - 도금 선택(P/W/G + variant 선택)
  - 가격모드 선택(RULE/UNIT/AMOUNT_ONLY)
    - UNIT: 단가 입력(도금 포함)
- 확정 버튼:
  - 확정 후 라인 편집 잠금(원칙)
  - AR 원장 + 생성 결과 표시(미수 증가액)

## 8.3 미수(AR) 페이지
- 거래처별 잔액 리스트(AR 합계)
- 거래처 상세: 원장 타임라인(출고+/결제-/반품-)
- 결제 등록:
  - payment_header 생성
  - tender_line 여러 개 추가(금+현금 등)
  - 총액 확정 → ar_ledger(PAYMENT, -총액)
- 반품 등록:
  - 출고라인 선택 + 수량 입력
  - 자동 계산값 표시 + override 입력
  - ar_ledger(RETURN, -최종금액)

## 8.4 수리 페이지
- 수리 접수 등록(유상/무상, 수리비 수동, 도금 가능)
- 상태 변경 + status_event
- 출고에 포함시키기(출고 만들기 연동)

## 8.5 마스터카드 페이지
- 모델 검색/상세/수정
- 공임(sell/cost) 분해 입력 + 도금 기본값
- labor_profile_mode(MANUAL/BAND) + band_code 설정
- 기성중량/차감중량 관리
- “예상가 계산(참고)” 표시(시세 기반)

---

# 9) 분석/자동화/ML을 위해 “지금 쌓이면 대박인 지표” (예시)
- 리드타임:
  - ORDER_PENDING→SENT_TO_VENDOR→WAITING_INBOUND→READY_TO_SHIP→SHIPPED
  - 공장 prefix/벤더별 분해
- 가격/마진:
  - `total_sell - total_cost` by 카테고리/도금/재질/단가제
- 도금 영향:
  - 도금 유무가 반품률/마진/리드타임에 미치는 영향
- 단가제 vs 룰제:
  - 거래처별 단가제 사용 빈도 + 마진 + 회수기간(DSO)
- 매칭 학습 데이터:
  - model_name_raw → master_item 매칭 결과(사람 확정/override) 라벨

---

## 10) 남은 미결정(최소) — “바로 구현”을 위해 딱 2개만 체크
1) AR 원장(SHIPMENT)을 **출고장 1줄**로 남길지, **출고라인 여러 줄**로 남길지  
   - 추천(Phase1): **출고장 1줄**(단순/빠름) + 부분반품은 return_line이 shipment_line 참조로 해결  
2) vendor_party_id_guess(모델 prefix) 규칙  
   - `{공장이니셜}` 매핑 테이블을 둘지(추천), 아니면 그냥 자유입력으로 둘지

> 위 2개는 내가 “추천값”으로 바로 잠글 수도 있어(원하면 “추천대로 잠가”라고 해줘).

---

# 11) 다음 산출물(원하면 바로 작성)
- **최종 v1 스키마 사전(테이블·컬럼·타입·NOT NULL·FK·CHECK·인덱스)** 완성본
- “출고확정/결제등록/반품등록/상태변경/마스터업서트/시세적재”의 **쓰기 함수(fn_*) PRD**
- 페이지별 **UI PRD(폼 필드/검증/버튼/에러/로그 발생 규칙)**

