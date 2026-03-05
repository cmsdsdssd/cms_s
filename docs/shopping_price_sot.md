# Shopping Price SoT

- Version: v1.0
- Date: 2026-03-05
- Scope: 쇼핑몰 가격 계산/설명에서 사용하는 컬럼 의미 고정
- Canonical compute path: `web/src/app/api/pricing/recompute/route.ts`

---

## 1) 목적

이 문서는 `vw_price_composition_flat_v1`(또는 동등한 snapshot flatten view)에서
각 컬럼에 어떤 값이 들어가야 하는지 고정한다.

핵심 원칙:
1. 계산 결과 SoT는 `pricing_snapshot`이다.
2. 뷰는 snapshot만 flatten한다.
3. 특히 흡수공임 컬럼은 "계산 반영값(applied)"만 사용한다.

---

## 2) 용어

- raw absorb: `cms_master_absorb_labor_item_v1` 활성 행 금액 단순 합
- applied absorb: recompute 로직의 필터/배수 반영 후 실제 가격 계산에 들어간 금액

본 문서에서 `absorb_*` 컬럼은 모두 **applied absorb**를 의미한다.
raw는 디버그용 별도 컬럼으로만 허용한다.

---

## 3) 흡수공임 반영 규칙 (필수)

## 3.1 제외 규칙

아래는 계산에서 제외한다.

1. `reason`(정규화 후)이 `BOM_AUTO_TOTAL` 또는 `ACCESSORY_LABOR`
2. `bucket=ETC` 이면서 아래 중 하나:
   - `note` starts with `BOM_DECOR_LINE:`
   - `reason` starts with `장식:`
   - `note` starts with `BOM_MATERIAL_LINE:`
   - `reason` starts with `기타-소재:`
   - `reason` contains `부속공임`

## 3.2 STONE 역할/수량 반영

- `note`의 `STONE_ROLE:`를 파싱해 `CENTER|SUB1|SUB2` 결정
- 역할별 적용 수량:
  - CENTER: `max(center_qty_default, 1)`
  - SUB1: `max(sub1_qty_default, 1)`
  - SUB2: `max(sub2_qty_default, 1)`

## 3.3 MATERIAL ETC 반영

- `bucket=ETC` and `labor_class=MATERIAL`이면
- `amount_krw * material_qty_per_unit`로 반영

## 3.4 도금 반영

- `include_plating=false`이면 absorb의 `PLATING` 버킷은 계산 반영 0
- raw 값은 저장 가능하나, applied 컬럼에는 반영하지 않는다.

---

## 4) 뷰 컬럼 사양 (요약)

뷰 이름: `vw_price_composition_flat_v1`
행 단위: `(channel_product_id, compute_request_id)`

## 4.1 식별 컬럼

- `channel_id`
- `compute_request_id`
- `master_item_id`
- `channel_product_id`
- `external_product_no`
- `external_variant_code`
- `computed_at`

## 4.2 소재/총합 컬럼

- `material_cost_raw_krw`
- `material_cost_final_krw`
- `base_total_pre_margin_krw`
- `price_after_margin_krw`
- `target_price_raw_krw`
- `rounded_target_price_krw`
- `final_target_price_krw`

## 4.3 공임 항목별 컬럼 (모두 계산 반영 기준)

- 기본공임
  - `base_labor_cost_krw`
  - `base_labor_absorb_krw`  # applied only
  - `base_labor_cost_plus_absorb_krw = base_labor_cost_krw + base_labor_absorb_krw`
  - `base_labor_sell_krw`

- 알공임
  - `stone_labor_cost_krw`
  - `stone_labor_absorb_krw` # applied only (STONE_ROLE + qty 반영)
  - `stone_labor_cost_plus_absorb_krw = stone_labor_cost_krw + stone_labor_absorb_krw`
  - `stone_labor_sell_krw`

- 도금공임
  - `plating_labor_cost_krw`
  - `plating_labor_absorb_krw` # applied only, include_plating=false면 0
  - `plating_labor_cost_plus_absorb_krw = plating_labor_cost_krw + plating_labor_absorb_krw`
  - `plating_labor_sell_krw`

- 기타공임
  - `etc_labor_cost_krw`
  - `etc_labor_absorb_krw` # applied only (MATERIAL qty 반영)
  - `etc_labor_cost_plus_absorb_krw = etc_labor_cost_krw + etc_labor_absorb_krw`
  - `etc_labor_sell_krw`

- 장식공임
  - `decor_labor_cost_krw`
  - `decor_labor_absorb_krw` # applied only
  - `decor_labor_cost_plus_absorb_krw = decor_labor_cost_krw + decor_labor_absorb_krw`
  - `decor_labor_sell_krw`

## 4.4 흡수공임 요약 컬럼 (모두 applied)

- `absorb_base_labor_krw`
- `absorb_stone_labor_krw`
- `absorb_plating_krw`
- `absorb_etc_krw`
- `absorb_general_class_krw`
- `absorb_material_class_krw`
- `absorb_total_krw`

검증식:
- `absorb_total_krw = absorb_base_labor_krw + absorb_stone_labor_krw + absorb_plating_krw + absorb_etc_krw`

---

## 5) MS-553유색-R 예시 (실제 데이터)

기준:
- `master_item_id = 4551f046-607f-4bf0-85db-9eafab542cd0`
- `compute_request_id = a0106867-b178-4c7a-a998-59d1f0e6ba88`

### 5.1 raw vs applied 차이

- raw active absorb total: `189281`
- applied absorb total: `3700`

### 5.2 applied 상세

- `base_labor_absorb_krw = 2000`
- `stone_labor_absorb_krw = 700` (100 * center_qty 7)
- `plating_labor_absorb_krw = 1000`
- `etc_labor_absorb_krw = 0`
- `absorb_total_krw = 3700`

### 5.3 왜 raw가 큰가

raw에는 아래가 포함되지만 계산에서는 제외된다.
- `BOM_MATERIAL_LINE:*` 항목
- `BOM_DECOR_LINE:*` 항목
- `ACCESSORY_LABOR`

즉, raw는 설정 현황이고 applied는 가격 반영값이다.

---

## 6) 금지/주의 사항

1. `absorb_*` applied 컬럼에 raw 값을 넣지 않는다.
2. explain에서 live master/absorb 조인으로 과거 run 값을 재계산하지 않는다.
3. 컬럼 의미 변경 시 `snapshot_schema_version`을 올린다.

---

## 7) 수용 기준

1. `absorb_*` 컬럼이 recompute 계산값과 1원 단위로 일치한다.
2. `cost_plus_absorb = cost + absorb` 산술 검증이 모든 row에서 통과한다.
3. `include_plating=false`일 때 `plating_labor_absorb_krw=0`을 만족한다.
4. 동일 `compute_request_id` 재조회 시 값이 불변이다.


---

## 8) 원가산정 변경 대응 원칙 (핵심)

요구사항처럼 산정 방식이 바뀌어도 재활용 가능하게, 뷰는 "완성값"보다 "구성요소"를 우선 저장한다.

### 8.1 반드시 분리 저장할 값

- 소재: `material_cost_raw_krw`, `material_cost_final_krw`
- 공임 항목별 원가: `*_labor_cost_krw`
- 공임 항목별 흡수(반영): `*_labor_absorb_krw`
- 공임 항목별 판매가: `*_labor_sell_krw`

즉, `원가`, `흡수`, `판매가`를 각각 독립 컬럼으로 유지한다.

### 8.2 파생 계산은 조회/레포트에서 조합

아래는 저장이 아니라 파생 계산으로 쓴다.

- 흡수 포함 공임원가:
  - `labor_cost_with_absorb = sum(*_labor_cost_krw + *_labor_absorb_krw)`
- 흡수 제외 공임원가:
  - `labor_cost_without_absorb = sum(*_labor_cost_krw)`
- 흡수 제외 판매가 기준:
  - `labor_sell_without_absorb = sum(*_labor_sell_krw) - sum(*_labor_absorb_krw)`
- 항목별 선택 제외(예: 도금/장식 제외):
  - 해당 bucket만 0 처리 후 동일 수식 적용

### 8.3 운영 규칙

- 기본 SoT 컬럼은 "계산 반영값"(applied) 기준으로 고정한다.
- 다만 원가정책 실험을 위해, 파생식에서 흡수 포함/제외를 자유롭게 선택할 수 있게 한다.
- 이 원칙을 지키면 향후 원가정의 변경(예: 흡수 제외 원가, 판매가 기반 역산)에도 스키마 변경 없이 대응 가능하다.
