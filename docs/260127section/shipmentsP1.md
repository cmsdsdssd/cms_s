# 출고 페이지 PRD (CMS Phase1 / SoT=public.cms_*) — Shipments

* **범위:** 출고 페이지 1개만.
* **원칙:** Write=RPC only, base table 직접 write 금지. SoT는 `public.cms_*`만 사용.
* **핵심:** 확정(Confirm) 1번 = 가격 스냅샷 잠금 + AR 원장 증가 + 상태 로그 + 연결 주문/수리 상태 갱신이 **“한 트랜잭션”**으로 끝나야 함.

---

## 0) 페이지 목표 (운영 기준)
거래처별로 출고서(헤더) 만들고, 라인을 추가/편집한다.

**확정 버튼을 누르면:**
1. `cms_shipment_header`가 `CONFIRMED`로 잠기고,
2. 각 `cms_shipment_line`이 **가격 스냅샷(`is_priced_final`)**으로 잠기고,
3. `cms_ar_ledger`에 **SHIPMENT(+)**가 기록되고,
4. 연결된 `cms_order_line`/`cms_repair_line` 상태가 `SHIPPED`로 바뀌고,
5. `cms_status_event`가 남는다.

확정 후에는 “재확정/중복확정/편집”이 안전해야 한다(멱등/차단).

---

## 1) 사용자/권한 (LOCK)
**staff/authenticated**

* **Read:** 출고 목록/상세 조회
* **Write:** 아래 RPC만 호출 가능

**DB 정책:**
* base table 직접 `INSERT`/`UPDATE`/`DELETE` 권한 금지
* RLS가 있다면: staff는 table 직접 접근 막고, `SECURITY DEFINER` RPC만 허용

**UI 정책:**
* UI에서 table 직접 write 코드 금지(Supabase client로 insert/update 금지)

---

## 2) SoT 오브젝트 (public.cms_*) 목록 (출고 페이지에서 쓰는 것만)

### 2.1 Tables
* `cms_shipment_header`
* `cms_shipment_line`
* `cms_order_line` (참조/상태갱신 대상)
* `cms_repair_line` (참조/상태갱신 대상)
* `cms_master_item` (라인 디폴트/정책 로딩용)
* `cms_party`, `cms_party_address` (거래처/주소 선택)
* `cms_market_tick` (시세 스냅샷)
* `cms_labor_band_rule` (공임 밴드)
* `cms_plating_variant`, `cms_plating_price_rule` (도금)
* `cms_ar_ledger` (미수 원장)
* `cms_status_event`, `cms_decision_log` (로그)

### 2.2 Views (가능하면 뷰로 읽기)
이미 있는 뷰/워크리스트가 있으면 우선 사용: `cms_v_*` (네가 올린 목록 기준)

**출고 화면에서 “없으면 추가 권장”:**
* `cms_v_shipment_worklist` (헤더 리스트용)
* `cms_v_shipment_detail_v1` (헤더+라인+조인 상세용)

---

## 3) 페이지 구성 (UI/UX) — 정확한 화면 단위

### 3.1 레이아웃
* **좌측(리스트 패널):** 출고 헤더 리스트(Worklist)
* **우측(상세 패널):** 선택한 출고의 헤더 + 라인 편집 + 합계 + 확정 버튼

### 3.2 상단 공통(전역)
* “새 출고 만들기” 버튼
* 검색(거래처명/메모/출고ID 일부)
* 기간 필터(최근 7일/30일/직접)

---

## 4) 출고 리스트(좌측) — Worklist 요구사항

### 4.1 표시 필드(행 1줄 카드/테이블)
* `shipment_id`
* `customer_party_id` + 고객명(조인)
* `status` (`DRAFT` / `CONFIRMED`)
* `ship_date`
* `confirmed_at` (있으면)
* 라인수
* (가능하면) `sum(total_amount_sell_krw)` (`CONFIRMED`인 경우만 확정값 표시)

### 4.2 필터/정렬
**필터:**
* 상태(`DRAFT`/`CONFIRMED`)
* 거래처
* 날짜 범위(`ship_date` 또는 `created_at` 기준)
* “확정 필요”: `status=DRAFT`
* “오류/미완료”: 라인 0개 / 필수값 누락 존재(아래 9장 검증 로직으로 판정)

**정렬(기본):**
* `DRAFT` 우선, 다음 최신 `created_at desc`

### 4.3 리스트 클릭 동작
* 클릭 시 우측 상세 패널 로드
* URL에 `shipment_id` 반영(새로고침 유지)

---

## 5) 출고 상세(우측) — 헤더 섹션

### 5.1 헤더 표시/편집 필드
* `customer_party_id` (거래처 선택)
* `ship_to_address_id` (주소 선택)
* `ship_date` (date)
* `memo`
* `status` (읽기 전용)
* `created_at`, `updated_at`, `confirmed_at` (읽기 전용)

### 5.2 헤더 편집 규칙
* `status=DRAFT`일 때만 편집 가능
* `status=CONFIRMED`이면 전부 읽기 전용(잠금)

### 5.3 헤더 저장 방식
* **권장:** 헤더 업데이트 RPC 추가 (현재 목록에 헤더 update용 함수가 없음)
  * `cms_fn_update_shipment_header_v1(p_shipment_id, p_ship_date, p_ship_to_address_id, p_memo, p_actor_person_id, p_note)`
* **지금 당장 함수 추가가 싫으면:**
  * 헤더는 생성 시 `cms_fn_create_shipment_header_v1`로만 만들고,
  * 수정은 “메모만 허용” 같은 최소 범위로 제한하되 RPC는 반드시 필요.

---

## 6) 출고 라인 섹션 (핵심)
출고 라인은 3가지로 추가한다:
1. 주문에서 가져오기
2. 수리에서 가져오기
3. Ad-hoc(현장/기타) 추가

**라인 편집은 확정 전(DRAFT)에만 가능.**

---

## 7) 라인 추가 UX — 3가지 플로우 (정확히)

### 7.1 주문에서 추가 (From Order)
* **화면:** “주문 검색” 모달/드로어
* **소스:** `cms_order_line` 또는 주문 워크리스트 뷰(권장)
* **필터:**
  * 거래처(현재 shipment의 customer로 기본 고정)
  * 상태(출고 가능 상태만)
  * 모델명/색상/suffix 검색
* **선택 후 “출고 라인 추가” 클릭**
* **호출 RPC:**
  * `cms_fn_add_shipment_line_from_order_v1( p_shipment_id, p_order_line_id, p_qty, p_pricing_mode, p_category_code, p_material_code, p_is_plated, p_plating_variant_id, p_unit_price_krw, p_manual_total_amount_krw, p_note )`
* **추가 직후 UI 동작(자동 채움):**
  * 라인에 다음을 자동 세팅(가능하면 서버에서):
  * `model_name`, `suffix`, `color`, `size`, `qty`는 주문에서 복사
  * `category_code`, `material_code`, `deduction_weight_g`는 master/정책에서 default 로드
  * `is_plated` / `plating_variant_id`는 주문값 우선(없으면 false/null)
  * `pricing_mode` 기본값 `RULE`

### 7.2 수리에서 추가 (From Repair)
* **화면:** “수리 검색” 모달/드로어
* **소스:** `cms_v_repair_line_enriched_v1` (이미 존재) 우선
* **필터:**
  * 고객(현재 shipment 고객으로 고정)
  * 상태(출고 가능)
  * 유상/무상(= `repair_fee_krw > 0`)
  * 도금 여부
* **선택 후 추가**
* **호출 RPC:**
  * `cms_fn_add_shipment_line_from_repair_v1( p_shipment_id, p_repair_line_id, p_qty, p_pricing_mode, p_category_code, p_material_code, p_is_plated, p_plating_variant_id, p_unit_price_krw, p_manual_total_amount_krw, p_repair_fee_krw, p_note )`
* **특이사항(수리 라인):**
  * 수리 라인은 “제품처럼 가격이 자동 계산되지 않을 수 있음”
  * **Phase1 정책:**
    * 수리비는 `cms_shipment_line.repair_fee_krw`에 들어감
    * `pricing_mode`에 따라:
      * `RULE`: 수리비 포함 정책은 confirm 내부 로직이 결정(아래 8장)
      * `AMOUNT_ONLY`: `manual_total_amount_krw`로 최종 매출만 입력 가능

### 7.3 Ad-hoc 추가 (현장/기타)
* **화면:** “기타 라인 추가” 폼
* **입력:**
  * `model_name`(필수), `suffix`, `color`, `size`, `qty`
  * `category_code`(필수)
  * `material_code`(선택)
  * `pricing_mode`(필수)
  * 도금 여부/variant
  * 실측중량/차감중량
  * `UNIT`/`AMOUNT_ONLY`면 가격 입력
* **호출 RPC:**
  * `cms_fn_add_shipment_line_ad_hoc_v1( p_shipment_id, p_model_name, p_suffix, p_color, p_category_code, p_size, p_qty, p_pricing_mode, p_material_code, p_is_plated, p_plating_variant_id, p_measured_weight_g, p_deduction_weight_g, p_unit_price_krw, p_manual_total_amount_krw, p_repair_fee_krw, p_note )`

---

## 8) 라인 편집(수정/삭제) — 필드별 정책

### 8.1 라인 테이블(그리드)에서 편집 가능한 필드 (DRAFT 한정)
* `qty`
* `category_code`
* `material_code`
* `measured_weight_g`
* `deduction_weight_g`
* `is_plated`, `plating_variant_id`
* `pricing_mode`
* `unit_price_krw` (`UNIT` 모드)
* `manual_total_amount_krw` (`AMOUNT_ONLY` 모드)
* `repair_fee_krw` (수리 라인에서만 의미)
* `note`(메모)

**표시만 하고 직접 수정하면 안 되는 것(확정 후 스냅샷):**
* `gold_tick_id`, `gold_tick_krw_per_g`, `silver_tick_*`
* `material_amount_*`, `labor_*`, `plating_amount_*`, `total_amount_*`
* `is_priced_final`, `priced_at`, `price_calc_trace`

### 8.2 라인 수정 RPC
* `cms_fn_update_shipment_line_v1( p_shipment_line_id, p_qty, p_category_code, p_material_code, p_measured_weight_g, p_deduction_weight_g, p_is_plated, p_plating_variant_id, p_pricing_mode, p_unit_price_krw, p_manual_total_amount_krw, p_repair_fee_krw, p_note )`

### 8.3 라인 삭제 RPC
* `cms_fn_delete_shipment_line_v1(p_shipment_line_id, p_note)`

---

## 9) 확정(Confirm) 버튼 — 동작/검증/결과

### 9.1 Confirm 호출 RPC
* `cms_fn_confirm_shipment(p_shipment_id, p_actor_person_id, p_note)`

### 9.2 Confirm 전 UI 검증(프론트)
프론트는 “사용자 경험” 용. **최종 강제는 서버(RPC)**에서 반드시 다시 검증한다.

1.  **라인 0개 금지:** 라인 1개 이상 없으면 확정 버튼 disabled + 경고
2.  **실측중량 필수(금속 소재):**
    * `pricing_mode`가 `RULE`/`UNIT`이고, `material_code`가 14/18/24(또는 금속류)인 라인에서 `measured_weight_g`가 NULL이면 확정 금지
    * 예외: `pricing_mode=AMOUNT_ONLY`거나 `material_code=00`(미상/공용)인 경우
3.  **도금 필수값:** `is_plated=true`인데 `plating_variant_id` NULL이면 확정 금지
4.  **pricing_mode별 필수값:**
    * `UNIT` → `unit_price_krw` 필수
    * `AMOUNT_ONLY` → `manual_total_amount_krw` 필수

### 9.3 Confirm 서버 검증(필수 강제)
서버는 최소 아래를 강제해야 한다:
* shipment 존재/권한/현재 상태가 `DRAFT`인지 확인
* 라인이 1개 이상인지 확인
* 위 9.2의 필수값 체크를 동일하게 수행
* 이미 `CONFIRMED`면:
  * (권장) 멱등 처리: “이미 확정됨” 결과 반환(에러로 터지지 않게)

### 9.4 Confirm 트랜잭션 내 계산(스냅샷) 규격
각 `cms_shipment_line`에 대해:
1. **참조 로드:** 주문/수리/마스터/룰/시세
2. **net_weight 계산:** `net_weight_g = greatest(0, measured_weight_g - deduction_weight_g)`
3. **pricing_mode별 매출(sell) 확정:**
   * `RULE`: 아래 9.5 산식으로 `total_amount_sell_krw` 산출
   * `UNIT`: `total_amount_sell_krw = unit_price_krw * qty`
   * `AMOUNT_ONLY`: `total_amount_sell_krw = manual_total_amount_krw`
4. **원가(cost) 확정:**
   * `RULE`: 산식에 따라 cost도 산출
   * `UNIT`/`AMOUNT_ONLY`: 정책에 따라 cost를 0으로 두거나(Phase1), 참고 산식만 trace에 기록
5. **스냅샷 잠금:**
   * `is_priced_final=true`, `priced_at=now()`
   * `price_calc_trace`에 “사용한 tick/룰/중량/경로”를 JSON으로 저장

### 9.5 RULE 모드 산식(출고 확정 시점)
**(A) 소재비**
* 금/은 tick은 `cms_fn_latest_tick(symbol)`로 가져오고,
* 라인에 `gold_tick_id`, `gold_tick_krw_per_g` 또는 `silver_*`로 스냅샷 저장
* `material_amount_sell_krw`, `material_amount_cost_krw` 산출
* `material_code=00`이면 소재비 0

**(B) 공임**
* `cms_master_item.labor_profile_mode`에 따라:
  * `MANUAL`: master의 `labor_*` 값을 사용
  * `BAND`: `cms_fn_pick_labor_band_rule(category_code, labor_band_code, on_date)`로 룰 선택 후 룰의 `labor_*` 사용
* 합: `labor_total_sell_krw = (base+center+sub1+sub2+bead) * qty`
* cost도 동일 구조

**(C) 도금**
* `is_plated=false`면 0
* `true`면 `cms_fn_pick_plating_rule(plating_variant_id, category_code, material_code, on_date)`로 룰 선택
* fixed + per_g 혼합 가능(룰 테이블 컬럼 기준)
* 산출: `plating_amount_sell_krw`, `plating_amount_cost_krw`

**(D) 수리비**
* `repair_fee_krw`는 별도 필드로 유지
* **Phase1 권장:**
  * sell에 수리비를 포함할지 정책으로 고정(예: 포함)
  * 포함 시: `total_amount_sell_krw += repair_fee_krw`

**(E) 최종 합**
* `total_amount_sell_krw = material_sell + labor_sell + plating_sell (+ repair_fee if policy)`
* `total_amount_cost_krw = material_cost + labor_cost + plating_cost (+ repair_cost_policy 적용 가능)`

### 9.6 Repair cost policy 트리거(이미 존재)
`cms_shipment_line`에는 `cms_trg_repair_cost_policy`가 존재함
* **의미:** `is_priced_final`이 `true`로 바뀌는 순간, repair 라인이고 cost가 0인데 `repair_fee`가 있으면 최소 원가 보정
* 출고 확정에서 `is_priced_final=true`가 되면 자동으로 발동될 수 있으니, confirm 함수는 트리거와 충돌 없이 동작해야 한다(중복 update 주의)

### 9.7 AR 원장 반영(출고 확정 시점)
확정 트랜잭션 안에서 `cms_ar_ledger`에 SHIPMENT + 1줄 생성:
* `party_id = shipment_header.customer_party_id`
* `occurred_at = confirmed_at`
* `entry_type = 'SHIPMENT'(enum)`
* `amount_krw = +sum(lines.total_amount_sell_krw)`
* 연결 키: `shipment_id`
* **확정 후 출고 상세에 “이번 출고로 증가한 미수”를 표시**

### 9.8 상태 이벤트 기록
* shipment 확정: `cms_status_event(entity_type='SHIPMENT', entity_id=shipment_id, from='DRAFT', to='CONFIRMED', occurred_at=confirmed_at)`
* 연결 주문/수리 상태 갱신 시에도 각각 `cms_status_event` 남김

### 9.9 Confirm 결과 UI 표시(반환 jsonb 기반)
확정 RPC는 JSONB로 최소 아래를 반환하도록 맞춘다:
* `shipment_id`
* `status=CONFIRMED`
* `confirmed_at`
* `sum_sell_krw`
* `ar_ledger_id` (생성된 원장 id)
* `line_count`
* (선택) 경고/trace 요약

---

## 10) 확정 후 잠금 규칙(강제)
`cms_shipment_header.status=CONFIRMED`이면:
* 라인 추가/수정/삭제 버튼 숨김 또는 disabled
* 헤더 편집 disabled
* **서버에서도:** `cms_fn_update_shipment_line_v1`, `cms_fn_delete_shipment_line_v1`, `cms_fn_add_*`가 해당 shipment가 CONFIRMED면 에러 반환해야 함(무조건)

---

## 11) 에러/엣지케이스 UX (사용자에게 보여줄 문구까지 고정)
* **라인 0개:** “라인이 0개라서 확정할 수 없습니다.”
* **실측중량 누락:** “실측중량이 없는 라인이 있습니다. 중량을 입력하세요.”
* **도금 variant 누락:** “도금 체크된 라인에 도금 종류(P/W/G)가 선택되지 않았습니다.”
* **UNIT 가격 누락:** “단가 모드인데 단가가 비었습니다.”
* **AMOUNT_ONLY 금액 누락:** “금액 모드인데 금액이 비었습니다.”
* **이미 확정됨:** “이미 확정된 출고입니다.”(멱등이면 성공처럼 처리 + 동일 결과 반환)

---

## 12) 데이터 계약: 출고 화면에서 쓰는 컬럼(라인) — 최소 필드 세트
출고 라인 그리드에서 반드시 보여야 하는 필드:

* **식별/연결:** `shipment_line_id`, `order_line_id`, `repair_line_id`, `ad_hoc_mode`
* **상품 정보:** `category_code`, `model_name`, `suffix`, `color`, `size`, `qty`
* **중량:** `measured_weight_g`, `deduction_weight_g`, `net_weight_g`
* **가격모드/입력:** `pricing_mode`, `unit_price_krw`, `manual_total_amount_krw`
* **시세 스냅샷:** `gold_tick_krw_per_g`, `silver_tick_krw_per_g`
* **도금:** `is_plated`, `plating_variant_id`, `plating_amount_sell_krw`
* **공임:** `labor_total_sell_krw`
* **소재:** `material_code`, `material_amount_sell_krw`
* **수리:** `repair_fee_krw`
* **합계:** `total_amount_sell_krw`, `total_amount_cost_krw`
* **잠금:** `is_priced_final`, `priced_at`
* **추적:** `price_calc_trace`

---

## 13) 회귀 테스트(출고 페이지 고정 5개)
* [ ] shipment 라인 0개 confirm 막힘
* [ ] measured_weight 없는 14/18/24 라인 confirm 막힘
* [ ] plating_variant 없는데 is_plated=true confirm 막힘
* [ ] repair fee만 있는 라인 confirm 후 cost policy 정상 작동
* [ ] confirm 성공 시 AR 원장 1줄(+합계) 생성 + shipment/line 잠금 + status_event 기록