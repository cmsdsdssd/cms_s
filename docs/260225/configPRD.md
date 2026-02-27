# PRD: Shipment Receipt Prefill SoT 고정 (Receipt Match CONFIRMED Snapshot 기반)

**문서버전:** v1.0  
**작성일:** 2026-02-25 (KST)  
**오너:** (TBD)  
**적용범위:** 출고입력(Shipments) 화면의 PREFILL, 영수증 매칭 확정(Workbench Confirm) 이후 플로우

---

## 1) 문제정의

### 1.1 현재 사용자가 겪는 핵심 문제
* PREFILL을 “총공임(흡수공임 포함)” 기준으로 채우라고 해도, 시스템이 어디가 진실(SoT)인지 일관되게 못 잡아서 결과가 흔들린다.
* 특히 “영수증에 따라 적용되는 규칙(기본공임 판매가 = 영수증 기본공임 원가 + 마스터 기본공임 마진 + 흡수공임 등)”이 PREFILL 단계에서 다시 계산되거나, 프론트에서 아이템/합계를 재구성하면서 값이 달라지는 순간 사용자는 “왜 제대로 안 들어가냐 / 어디서 깨지냐”고 느낀다.

### 1.2 이 PRD의 결론(당신이 확정한 방향)
* **SoT는 “영수증 매칭확정 당시, 규칙에 따라 확정된 값 스냅샷”**이다. (Q1=1)
* PREFILL은 CONFIRMED 매칭 스냅샷만 사용한다. (Q2=A)
* PREFILL 결과는 confirm(v6 policy v2)와 완전히 동일한 결과를 재현해야 한다. (Q3=A)
* 선택 기준은 confirmed_at 최신 1건(실제로는 “order_line_id 당 CONFIRMED 1건” 제약이 있어 사실상 1개). (Q4=A)
* 총공임 SoT는 base + extra 파생이다. (Q5=A)
* MATERIAL_MASTER 계열은 PREFILL에서 항상 제거한다. (Q7=A)
* 공임(판매가)은 무조건 100원 단위 올림이다. (Q8)
* PREFILL 값은 “결정값처럼” 동작해야 하며, 사용자가 수정하면 **로그(감사/분석)**가 남아야 한다. (Q9=B)
* 설명가능성(Explainability)은 필수다. (Q10=A)
* DB가 SoT다. (Q12=A)

---

## 2) 목표와 비목표

### 2.1 목표(Goals)
* **Prefill SoT 단일화**
    * 출고입력 PREFILL은 오직 DB에 저장된 CONFIRMED 스냅샷만을 기준으로 필드를 채운다.
    * “다시 계산 / 프론트 재구성 / 다른 소스 합성”으로 값이 달라지지 않는다.
* **Confirm 정책과 결과 100% 동일**
    * 정책 엔진(현행: cms_fn_receipt_line_match_confirm_v6_policy_v2)이 만든 결과를 PREFILL이 그대로 재현한다.
* **공임 판매가 100원 단위 올림 불변식**
    * base/extra/total labor(판매가) 관련 값은 저장/조회 경계에서 항상 100원 올림을 보장한다.
* **Explainability 제공**
    * “왜 이 금액이 나왔는지”를 운영/개발/CS가 추적 가능해야 한다.
    * 최소 단위: 어떤 입력(영수증 어떤 키), 어떤 마스터값, 어떤 흡수공임 항목, 어떤 도금 룰이 적용됐는지.
* **Manual Edit 허용 + 감사로그**
    * 사용자가 수정할 수 있다.
    * 단, 수정이 발생하면 “누가/언제/무엇을/왜”가 DB에 남아 데이터분석 가능해야 한다.

### 2.2 비목표(Non-goals)
* SUGGESTED(미확정) 영수증 매칭을 PREFILL에 반영하지 않는다.
* CONFIRMED 이후 마스터 변경이 과거 스냅샷을 자동으로 재계산/갱신하지 않는다.
* 소재(Material) 가격을 100원 단위로 강제하지 않는다. (공임 sell만 강제)

---

## 3) SoT 정의(불변식)

### 3.1 SoT(단일 진실) 정의
**SoT는 “CONFIRMED 시점의 스냅샷”**이며 저장 위치는 아래다:

* **public.cms_shipment_line (출고 라인 스냅샷)**
    * base_labor_krw (기본공임 판매가)
    * extra_labor_krw (기타/알/도금/흡수 등 포함 추가공임 판매가)
    * extra_labor_items (추가공임 breakdown JSON)
    * labor_total_sell_krw (= base + extra)
    * pricing_policy_version, pricing_policy_meta (설명가능성 메타)
* **public.cms_receipt_line_match (영수증-주문 매칭 스냅샷)**
    * status='CONFIRMED', confirmed_at
    * selected_factory_labor_basic_cost_krw, selected_factory_labor_other_cost_krw (원가 스냅샷)
    * pricing_policy_version, pricing_policy_meta (정책 근거)

> PREFILL은 “새 계산”이 아니라, 위 저장값을 정규화해서 그대로 제공한다.

### 3.2 핵심 불변식(Invariants)
* **I1.** 총공임 판매가 SoT = base_labor_krw + extra_labor_krw
* **I2.** 공임 판매가( base/extra/total )는 항상 100원 단위 올림
* **I3.** PREFILL은 CONFIRMED 매칭 1건만 사용
* **I4.** PREFILL 응답에 MATERIAL_MASTER 계열 extra item은 포함하지 않음
* **I5.** Explainability 메타는 prefill에서 항상 노출 가능
* **I6.** 사용자가 수정한 경우 반드시 override log가 남아야 함

---

## 4) 현행(As-is) 구현 사실 요약 (코드/DB 기반)

### 4.1 Confirm 정책 엔진(규칙 적용 위치)
* **DB 함수:** `public.cms_fn_receipt_line_match_confirm_v6_policy_v2`
* **주요 동작 요약:**
    1. 영수증 JSON에서 기본공임 원가/기타공임/알공임 qty/도금비 등을 파싱
    2. 마스터 기본공임 마진 + 흡수공임(cms_master_absorb_labor_item_v1) + 도금 마크업룰(cms_plating_markup_rule_v1) 적용
    3. 결과를 `public.cms_fn_shipment_update_line_v1(...)`로 `cms_shipment_line`에 저장
    4. `cms_receipt_line_match` 및 `cms_shipment_line`에 `pricing_policy_meta` 저장

### 4.2 Prefill API(현행)
* **엔드포인트:** `GET /api/shipment-receipt-prefill?order_line_id=...`
* **구현 파일:** `web/src/app/api/shipment-receipt-prefill/route.ts`
* **동작:**
    1. `cms_receipt_line_match`에서 `order_line_id` + `status=CONFIRMED` 1건 조회
    2. `cms_v_receipt_line_items_flat_v1`에서 영수증 line JSON(무게/공임원가/알공임 qty 등) 조회
    3. `cms_shipment_line`에서 `base_labor_krw` / `extra_labor_krw` / `extra_labor_items` 조회
    4. extra items에서 MATERIAL_MASTER 계열 제거 후 합계/라운딩 계산
    5. `labor_prefill_snapshot`(hash 포함) 구성해 반환

### 4.3 Manual override 로그(현행)
* **테이블:** `public.cms_shipment_override_log`
* **API:** `POST /api/shipment-override-log`
* **동작:** 출고 저장/확정 시 “수동조정 발생”이면 best-effort로 로그 적재

---

## 5) To-be: 요구사항(Functional Requirements)

### 5.1 PREFILL SoT 정책
* **FR-1. PREFILL은 CONFIRMED 스냅샷만 사용**
    * 입력: `order_line_id`
    * 조회: `cms_receipt_line_match`에서 `status='CONFIRMED'` 1건(confirmed_at 최신)
    * 없으면 `{ data: null }`
    * SUGGESTED/REJECTED/CLEARED는 사용하지 않음
* **FR-2. PREFILL은 “재계산 금지”, “스냅샷 재현”**
    * PREFILL에서 새 규칙 엔진 실행 금지
    * 흡수공임 테이블을 다시 읽어서 계산하지 않는다.
    * 마스터 변경을 반영하기 위해 재계산하지 않는다.
    * 오직 “CONFIRMED 당시 cms_shipment_line에 저장된 결과”를 꺼내서 보여준다.
    * (Q3=A) confirm과 동일 결과를 만족하는 가장 안전한 방식은 “confirm이 저장한 결과를 그대로 읽는 것”이다.
* **FR-3. 공임 판매가 100원 올림(무조건)**
    * 아래 값들은 항상 100원 단위 올림이어야 한다:
        * `cms_shipment_line.base_labor_krw`
        * `cms_shipment_line.extra_labor_krw`
        * `cms_shipment_line.labor_total_sell_krw`
        * PREFILL 응답의 `shipment_base_labor_krw`, `shipment_extra_labor_krw`, `labor_prefill_snapshot.*_sell_krw`
    * **주의(중요):** 현재 `cms_fn_shipment_line_strip_material_master_v1` 트리거는 material master strip 시 `extra_labor_krw`를 “합계”로만 재계산하고 100원 올림을 하지 않는다. To-be에서는 strip 이후에도 100원 올림을 다시 적용해야 한다.
* **FR-4. MATERIAL_MASTER는 PREFILL에서 항상 제거**
    * PREFILL 응답의 `shipment_extra_labor_items` 및 `labor_prefill_snapshot.extra_labor_items`는 아래 조건 중 하나라도 해당하면 포함하지 않는다:
        * `type LIKE 'MATERIAL_MASTER:%'`
        * `meta.class='MATERIAL_MASTER'`
        * `meta.source='master_material_labor'`
    * 단, DB에 저장 자체는 트리거 정책에 따르되(현행은 draft에서 strip), 응답은 항상 제거 후 반환한다.
* **FR-5. PREFILL은 “결정값처럼” 동작**
    * PREFILL로 채워진 값은 “추천값”이 아니라 확정값(결정값)처럼 취급한다.
    * 사용자가 수정할 수는 있지만, 수정은 곧 “override”이며 감사/분석 대상이다.

### 5.2 Explainability 요구사항
* **FR-6. PREFILL 응답은 정책 근거를 포함해야 한다(필수)**
    * PREFILL 응답에는 최소 다음이 포함되어야 한다:
        * `pricing_policy_version`
        * `pricing_policy_meta` (정책 엔진이 저장한 메타)
            * 예: `receipt_basic_cost_krw`, `receipt_other_cost_krw`, `base_margin_krw`
            * `absorb_base_to_base_krw` / `absorb_plating_krw` / `absorb_etc_total_krw`
            * `plating_cost_krw` / `plating_margin_krw` / `plating_sell_krw`
            * `stone_cost_total_krw` / `stone_sell_total_krw`
        * `labor_prefill_snapshot` + `snapshot_hash`
        * extra labor items 각 항목의 meta에 다음을 보장(가능한 범위 내):
            * `engine/source`(어떤 엔진이 만든 항목인지)
            * `bucket/class`
            * `absorb_item_id`(흡수공임이면)
            * `cost_krw/sell_krw/margin_krw`(가능하면)
* **FR-7. UI에서 설명가능성 표시**
    * 출고입력 화면에 “가격근거(증빙)” 영역을 제공(현행 PLATING_DEBUG 같은 로그성 출력이 아니라 UI)
    * 최소 표시 항목:
        * **기본공임:** 영수증 원가/마스터 마진/흡수공임(BASE) 합성
        * **알공임:** qty 출처(영수증 vs 마스터 default), 흡수공임(STONE) 포함 여부
        * **도금:** 영수증 도금비 파싱 키, 적용 룰(가능하면 rule id), 흡수공임(PLATING) 포함
        * **기타공임:** OTHER_LABOR_BASE fallback 적용 여부
        * **라운딩:** 100원 올림 적용으로 인한 차이(있다면)

### 5.3 Manual Override & Logging 요구사항
* **FR-8. Manual override 발생 조건 정의**
    * 아래 중 하나라도 true면 “override 로그”를 남긴다:
        * `pricing_mode`가 `AMOUNT_ONLY` 또는 `MANUAL`
        * base/extra/other/아이템이 prefill 이후 사용자에 의해 변경됨(Dirty)
        * total amount override 수행
* **FR-9. override 로그는 분석 가능 형태로 남는다 (필수)**
    * 현행 `cms_shipment_override_log`를 그대로 쓰되, payload에 아래 필드를 반드시 포함하도록 강화한다:
        * **공통:** `order_line_id`, `shipment_id`, `shipment_line_id`, `actor_person_id`
        * **event_type:** SAVE / FINAL_CONFIRM
        * **reason_code, reason_detail**
        * **baseline(확정 스냅샷):** `prefill_snapshot_hash`, `prefill_snapshot_version`, `prefill_base_labor_sell_krw`, `prefill_extra_labor_sell_krw`, `prefill_extra_labor_items`(가능하면)
        * **final(사용자 저장값):** `final_base_labor_krw`, `final_extra_labor_krw`, `final_extra_labor_items`, `final_total_labor_krw`
        * **diff(선택):** `delta_base`, `delta_extra`, `delta_total`
    * 이렇게 해야 “결정값” 데이터 분석 시 “정책 엔진 스냅샷 대비 얼마나/왜 달라졌는지”를 정량화할 수 있다.

---

## 6) 데이터/인터페이스 명세

### 6.1 PREFILL API Contract(유지 + 강화)
* **입력**
    * `order_line_id` (string/uuid)
* **출력(data)**
    * 현재 응답 형태를 깨지 않되, 아래를 명세로 고정한다:
        * `receipt_id`, `receipt_line_uuid`, `order_line_id`, `shipment_line_id`
        * `status = CONFIRMED`
        * `confirmed_at`
        * **영수증 기반:**
            * `receipt_weight_g`, `receipt_deduction_weight_g`
            * `receipt_labor_basic_cost_krw`, `receipt_labor_other_cost_krw`
            * `stone_center_qty/sub1_qty/sub2_qty`
            * `stone_center_unit_cost_krw/sub1_unit_cost_krw/sub2_unit_cost_krw`
            * `stone_labor_krw` (영수증 파싱 기반 계산값)
        * **출고 스냅샷(SoT):**
            * `shipment_base_labor_krw` (100원 올림)
            * `shipment_extra_labor_krw` (100원 올림, MATERIAL_MASTER 제거 반영)
            * `shipment_extra_labor_items` (MATERIAL_MASTER 제거)
            * (권장 추가) `shipment_labor_total_sell_krw` (base+extra)
            * (권장 추가) `shipment_pricing_mode`, `shipment_manual_total_amount_krw`
        * **정책 근거:**
            * `pricing_policy_version`
            * `pricing_policy_meta`
        * **스냅샷 객체:**
            * `labor_prefill_snapshot`:
                * `snapshot_version`, `snapshot_source` (SHIPMENT_LINE), `snapshot_hash`
                * `base_labor_sell_krw`, `base_labor_cost_krw`
                * `extra_labor_sell_krw`, `extra_labor_cost_krw`
                * `policy_plating_sell_krw`, `policy_plating_cost_krw`
                * `policy_absorb_plating_krw`, `policy_absorb_etc_total_krw`, `policy_absorb_decor_total_krw`, `policy_absorb_other_total_krw`
                * `extra_labor_items`

### 6.2 DB SoT 강화를 위한 변경 요구(핵심)
* **DB-1. Material master strip 트리거의 라운딩 불변식 보장**
    * 대상: `public.cms_fn_shipment_line_strip_material_master_v1()`
    * 현재: strip 후 `extra_labor_krw`를 “합”으로만 재계산 → 100원 올림 누락 가능
    * **To-be:**
        * strip 후: `after_extra = ceil(sum_kept / 100) * 100`
        * `manual_labor_krw` / `labor_total_sell_krw`도 `base+after_extra`로 재계산
        * `total_amount_sell_krw`도 동일 정책으로 재계산
    * 또한 backfill update 쿼리(0712 하단)도 동일 라운딩 적용.
* **DB-2. PREFILL SoT를 DB에서 “한 번만” 정의(권장)**
    * Q12=A를 엄격히 만족하려면 DB 뷰 또는 함수로 “prefill 스냅샷”을 정의한다.
    * **권장안:**
        * `public.cms_fn_shipment_receipt_prefill_sot_v1(p_order_line_id uuid) returns jsonb`
        * 내부에서 CONFIRMED match, receipt flat view, shipment_line을 조인
        * MATERIAL_MASTER 제거, labor sell 100원 올림, policy_meta 포함
        * 결과를 JSON으로 반환
    * 그리고 Next API(`/api/shipment-receipt-prefill`)는 이 RPC를 호출하는 thin proxy로 변경한다.
    * → 이렇게 하면 “TS/FE 재계산”이 사라져 SoT가 DB로 수렴한다.

---

## 7) 사용자 시나리오 / 수용기준(AC)

### 7.1 기본 시나리오
* **AC-1. CONFIRMED 매칭 존재**
    * Given: `order_line_id`에 대해 `cms_receipt_line_match.status=CONFIRMED`이고 `shipment_line`이 존재
    * When: PREFILL 호출
    * Then:
        * base/extra/total labor sell은 100원 단위 올림
        * extra items는 MATERIAL_MASTER 제거
        * `labor_prefill_snapshot.hash`가 안정적으로 생성됨
        * `pricing_policy_meta`가 포함됨
* **AC-2. CONFIRMED 매칭 없음**
    * Then: `{ data: null }`

### 7.2 당신이 준 대표 실패 케이스(필수 AC)
* **AC-3. “기타공임에 새로운 내용 추가(기존에 있던 내용 X)” 반영**
    * Given: 영수증 JSON에 `labor_other_cost_krw`(또는 대응 키)가 새로 추가/증가
    * When: 매칭확정을 다시 수행(Confirm)
    * Then:
        * `cms_shipment_line.extra_labor_items`에 **기타공임 반영 항목(예: OTHER_LABOR_BASE 또는 정책 엔진이 생성한 ETC 항목)**이 존재
        * PREFILL은 그 항목을 그대로 노출(단, MATERIAL_MASTER 제외)
        * `shipment_extra_labor_krw` 및 `labor_total_sell_krw`가 증가하며 100원 올림 유지
* **AC-4. “공임 상승분 반영”**
    * Given: 사용자가 출고입력에서 공임 상승분을 extra item 또는 base 조정으로 반영하고 저장
    * When: 저장(SAVE) 이후 PREFILL 재조회
    * Then:
        * PREFILL은 저장된 최종값을 SoT로 노출(=결정값)
        * `cms_shipment_override_log`에 SAVE 이벤트가 기록되고, `reason_code/detail` 및 `prefill_snapshot_hash` + `final` 값이 포함된다.

---

## 8) 프론트엔드(Shipments) 동작 요구사항

* **FE-1. PREFILL Hydration은 “스냅샷 재현”이어야 한다**
    * CONFIRMED snapshot이 존재하면:
        * base labor 입력값 = snapshot base labor
        * extra labor items UI 목록 = snapshot items 그대로
    * 스냅샷 존재 시, 마스터 재조회로 auto merge/auto 생성하여 SoT를 바꾸는 행위 금지
    * (필요하면) “표시용 보조 정보”는 별도 영역에서만 보여주고 저장 payload에 섞지 않는다.
* **FE-2. 자동 보정(remainder adjustment) 정책**
    * 원칙: SoT가 DB에 고정되면 “remainder item” 같은 프론트 보정은 없어야 한다.
    * 불가피하게 과거 데이터/레거시를 위해 필요하면:
        * 보정은 display-only로 제한하거나
        * 저장 시에는 `meta.source='UI_AUTO_DISPLAY_ONLY'` 등으로 명확히 구분하고 분석에서 제외 가능해야 한다.

---

## 9) 운영/모니터링

### 9.1 무결성 체크(권장)
* 정기적으로 아래를 체크하는 뷰/쿼리를 운영:
    * `labor_total_sell_krw == base_labor_krw + extra_labor_krw`
    * `base_labor_krw % 100 == 0`, `extra_labor_krw % 100 == 0`
    * `extra_labor_krw == ceil(sum(extra_labor_items.amount)/100)*100` (MATERIAL_MASTER 제거 기준)

### 9.2 디버그/CS 대응
* 특정 `shipment_line_id`에 대해:
    * 어떤 영수증(Receipt) 라인에서 왔는지
    * Confirm 당시 `policy_meta`(입력값/룰)
    * 이후 override 로그(누가/왜/무엇을 바꿨는지) 를 한 화면에서 추적 가능해야 한다.

---

## 10) 구현 계획(권장 순서)

* **Phase 1 (SoT 깨짐 즉시 방지)**
    * `cms_fn_shipment_line_strip_material_master_v1` 라운딩 보장 패치
    * PREFILL 응답에서 `shipment_labor_total_sell_krw`(선택) 추가
* **Phase 2 (DB SoT 완성)**
    * `cms_fn_shipment_receipt_prefill_sot_v1(order_line_id)` RPC/뷰로 PREFILL SoT를 DB에 고정
    * Next API는 thin proxy로 전환(또는 FE가 직접 RPC 호출)
* **Phase 3 (설명가능성/분석 강화)**
    * override log payload에 baseline `snapshot_hash` + `final` 값 포함 강화
    * `pricing_policy_meta`에 “입력 키 출처/룰 식별자(rule id 등)” 추가(가능하면)

---

## 11) 요약(당신 답변을 반영한 최종 원칙)

1. PREFILL SoT는 **“매칭확정 당시 DB 정책 엔진이 만든 출고 스냅샷”**이다.
2. PREFILL은 CONFIRMED만 사용하며, 재계산은 금지한다.
3. 100원 올림 불변식을 유지하며 MATERIAL_MASTER는 제거한다.
4. 설명가능성(Meta)은 필수이며, 수정 시 로그를 반드시 남긴다.
5. 모든 진실(SoT)은 DB 중심으로 수렴한다.