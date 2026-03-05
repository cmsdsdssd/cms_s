# PRD: 쇼핑몰 가격구성 통합 SoT (Bucket + Margin Stack + Snapshot Flatten View)

- 문서 버전: v1.0
- 작성일: 2026-03-05
- 작성 목적: 가격 계산/동기화/설명(Explain)에서 동일한 결과를 재현할 수 있도록, 공임/흡수공임/소재/마진 레이어를 단일 계약으로 고정한다.

---

## 1) 문제 정의

현재 운영 이슈는 아래 3가지가 반복된다.

1. 같은 상품이라도 조회 시점/화면에 따라 공임 구성 근거가 달라 보인다.
2. 라이브 마스터 테이블 조인 기반 설명은 과거 run 재현성이 떨어진다.
3. 마진 전략이 `단일 multiplier` 중심이라, 소재/공임/전체 레이어별 실험이 어렵다.

핵심 요구는 다음과 같다.

- 공임 항목별(기본/알/도금/기타/장식)로 원가/흡수/합계를 모두 본다.
- 흡수공임은 bucket별로 분리해서 본다.
- 도금은 값은 항상 보되, 반영 여부는 체크박스로 제어한다.
- run 시점 설명값은 절대 변하지 않게 고정한다.

---

## 2) 목표 / 비목표

### 2.1 목표 (Goals)

1. `pricing_snapshot` 기반 단일 Flatten View를 도입해 설명값을 단일화한다.
2. 공임 항목별 `원가`, `흡수`, `원가+흡수`, `판매가`를 같은 행에서 조회한다.
3. 마진 레이어를 `소재%`, `공임%`, `전체%`로 분리하고, 각 레이어별 기준(`COST`/`SELL`)을 지원한다.
4. 도금 반영 여부(`include_plating`)를 계산 파라미터로 명시한다.

### 2.2 비목표 (Non-Goals)

1. 이번 단계에서 타 채널 신규 연동은 하지 않는다.
2. 이번 단계에서 기존 이력 테이블을 삭제/파괴적으로 변경하지 않는다.
3. 이번 단계에서 과거 스냅샷을 재계산해 덮어쓰지 않는다.

---

## 3) 핵심 설계 결론

### 3.1 SoT 원칙

- 계산 SoT: `web/src/app/api/pricing/recompute/route.ts`
- 이력/설명 SoT: `pricing_snapshot` + `breakdown_json`
- UI/API Explain은 스냅샷 기반으로만 계산 결과를 노출한다.

### 3.2 안전성 원칙

- 라이브 `cms_master_item`, `cms_master_absorb_labor_item_v1`는 "현재 참고용"으로만 사용한다.
- 과거 run 설명은 라이브 조인 재계산을 금지한다.
- 스냅샷에 계산 당시 파라미터와 중간 결과를 모두 고정 저장한다.

### 3.3 View 전략

- 운영자가 이해하기 쉬운 "한 뷰"를 제공한다: `vw_price_composition_flat_v1`
- 단, 데이터 소스는 snapshot 계열만 사용해 시점 드리프트를 방지한다.

---

## 4) 사용자 시나리오

### 시나리오 A: 가격 구성 검토

운영자는 상품 한 개를 열어 아래를 즉시 확인한다.

- 기본공임 원가/흡수/합계
- 알공임 원가/흡수/합계
- 도금공임 원가/흡수/합계
- 기타공임 원가/흡수/합계
- 장식공임 원가/흡수/합계
- 소재 원가, 마진 후 가격, 최종 타겟가

### 시나리오 B: 도금 제외 시뮬레이션

- `include_plating=false`로 재계산하면, 도금 raw 값은 유지하되 최종 계산 반영값만 제외한다.

### 시나리오 C: 마진 전략 실험

- 소재 10%(COST), 공임 15%(COST), 전체 5%(SELL) 조합으로 시뮬레이션하고 결과를 run 스냅샷으로 비교한다.

---

## 5) 기능 요구사항 (Functional Requirements)

### FR-01 Bucket/항목별 컬럼 제공

다음 항목은 모두 컬럼으로 제공해야 한다.

- 기본공임: `cost`, `absorb`, `cost_plus_absorb`, `sell`
- 알공임: `cost`, `absorb`, `cost_plus_absorb`, `sell`
- 도금공임: `cost`, `absorb`, `cost_plus_absorb`, `sell`
- 기타공임: `cost`, `absorb`, `cost_plus_absorb`, `sell`
- 장식공임: `cost`, `absorb`, `cost_plus_absorb`, `sell`

### FR-02 흡수공임 bucket 분리

- `BASE_LABOR`, `STONE_LABOR`, `PLATING`, `ETC` bucket별 합계 컬럼을 노출한다.
- 필요 시 `GENERAL/MATERIAL` 클래스 합계도 함께 노출한다.

### FR-03 도금 포함 여부

- `include_plating` 플래그를 정책/요청에서 받는다.
- 도금 raw 컬럼은 항상 보존한다.
- 최종 계산식에서만 `include_plating` 반영 여부를 분기한다.

### FR-04 Margin Stack

정책은 아래 레이어를 지원한다.

- material margin (bps + basis)
- labor margin (bps + basis)
- total margin (bps + basis)

`basis`는 `COST` 또는 `SELL`.

### FR-05 Snapshot Freeze

아래 항목은 스냅샷에 고정 저장한다.

- margin stack 원본/해석값
- bucket별 중간금액
- 최종 target 계산 단계별 금액

---

## 6) 계산 순서 (정책 고정)

1. 소재 계산: `material_cost_final_krw`
2. 공임 계산: 기본/알/도금/기타/장식 + 흡수 반영
3. `base_total_pre_margin_krw` 계산
4. margin stack 적용
   - material layer
   - labor layer
   - total layer
5. 옵션/조정/오버라이드/바닥가 순으로 최종 타겟 생성

### Margin 수식

- COST 기준: `out = base * (1 + p)`
- SELL 기준: `out = base / (1 - p)` (단, `p < 1`)

---

## 7) Flatten View 컬럼 정의 (설명 + 예시)

뷰 이름: `vw_price_composition_flat_v1`

### 7.1 식별/시점

| 컬럼 | 설명 | 예시 |
|---|---|---|
| channel_id | 채널 ID | `9d7c22c7-...` |
| compute_request_id | 계산 배치 ID | `e2baf006-...` |
| master_item_id | 마스터 ID | `4551f046-...` |
| channel_product_id | 채널 상품 ID | `f1ada7e1-...` |
| external_product_no | 쇼핑몰 상품번호 | `P000000N` |
| external_variant_code | 쇼핑몰 변형코드 | `P000000N000E` |
| computed_at | 계산시각 | `2026-03-05T00:30:11Z` |

### 7.2 소재/총합

| 컬럼 | 설명 | 예시 |
|---|---|---|
| material_cost_raw_krw | 소재 원시 원가 | `2640440` |
| material_cost_final_krw | 소재 환산 원가 | `1699123` |
| labor_cost_total_plus_absorb_krw | 공임 총 원가(흡수 포함) | `...` |
| base_total_pre_margin_krw | 마진 전 총합 | `1961823` |
| price_after_margin_krw | 마진 후 금액 | `2158005` |
| final_target_price_krw | 최종 반영 타겟 | `2159000` |

### 7.3 공임 항목별 (요청 핵심)

| 컬럼 | 설명 | 예시 |
|---|---|---|
| base_labor_cost_krw | 기본공임 원가 | `10000` |
| base_labor_absorb_krw | 기본공임 흡수 | `25770` |
| base_labor_cost_plus_absorb_krw | 기본공임 원가+흡수 | `35770` |
| base_labor_sell_krw | 기본공임 판매가 | `20000` |
| stone_labor_cost_krw | 알공임 원가 | `105000` |
| stone_labor_absorb_krw | 알공임 흡수 | `100` |
| stone_labor_cost_plus_absorb_krw | 알공임 원가+흡수 | `105100` |
| stone_labor_sell_krw | 알공임 판매가 | `105000` |
| plating_labor_cost_krw | 도금공임 원가 | `5000` |
| plating_labor_absorb_krw | 도금공임 흡수 | `1000` |
| plating_labor_cost_plus_absorb_krw | 도금공임 원가+흡수 | `6000` |
| plating_labor_sell_krw | 도금공임 판매가 | `8000` |
| etc_labor_cost_krw | 기타공임 원가 | `0` |
| etc_labor_absorb_krw | 기타공임 흡수 | `162411` |
| etc_labor_cost_plus_absorb_krw | 기타공임 원가+흡수 | `162411` |
| etc_labor_sell_krw | 기타공임 판매가 | `126000` |
| decor_labor_cost_krw | 장식공임 원가 | `126000` |
| decor_labor_absorb_krw | 장식공임 흡수 | `0` |
| decor_labor_cost_plus_absorb_krw | 장식공임 원가+흡수 | `126000` |
| decor_labor_sell_krw | 장식공임 판매가 | `126000` |

### 7.4 흡수공임 bucket/class

| 컬럼 | 설명 | 예시 |
|---|---|---|
| absorb_base_labor_krw | BASE_LABOR 합계 | `25770` |
| absorb_stone_labor_krw | STONE_LABOR 합계 | `100` |
| absorb_plating_krw | PLATING 합계 | `1000` |
| absorb_etc_krw | ETC 합계 | `162411` |
| absorb_general_class_krw | GENERAL 클래스 합계 | `136870` |
| absorb_material_class_krw | MATERIAL 클래스 합계 | `52411` |
| absorb_total_krw | 흡수 총합 | `189281` |

### 7.5 정책/마진/옵션

| 컬럼 | 설명 | 예시 |
|---|---|---|
| include_plating | 도금 반영 여부 | `true` |
| material_margin_bps | 소재 마진 bp | `1000` |
| material_margin_basis | 소재 마진 기준 | `COST` |
| labor_margin_bps | 공임 마진 bp | `1500` |
| labor_margin_basis | 공임 마진 기준 | `COST` |
| total_margin_bps | 전체 마진 bp | `500` |
| total_margin_basis | 전체 마진 기준 | `SELL` |
| rounding_unit | 반올림 단위 | `1000` |
| rounding_mode | 반올림 모드 | `CEIL` |
| floor_price_krw | 바닥가 | `0` |
| floor_clamped | 바닥가 클램프 여부 | `false` |

---

## 8) API/UI 변경 요구

1. `pricing/recompute`는 위 컬럼을 구성할 수 있는 중간 결과를 snapshot에 저장한다.
2. `channel-price-snapshot-explain`는 snapshot 값만 정식 계산 근거로 반환한다.
3. `auto-price`는 항목별 컬럼 + `include_plating` 토글을 지원한다.

---

## 9) 마이그레이션 계획 (Add-only)

1. `pricing_policy`에 margin stack 컬럼 추가
2. `pricing_snapshot.breakdown_json`에 스키마 버전 + bucket 세부 구조 추가
3. `vw_price_composition_flat_v1` 생성
4. 기존 API는 backward compatible 유지

---

## 10) 안정성/리스크

### 주요 리스크

1. 라이브 테이블 조인으로 인한 과거 run 값 드리프트
2. SELL basis에서 `p >= 1`로 인한 폭발값
3. 도금 포함 토글이 계산과 표시에서 불일치

### 대응

1. snapshot 기반 계산 근거 강제
2. DB check + runtime guard (`bps` 범위 제한)
3. `include_plating`를 계산 입력/결과에 모두 저장

---

## 11) 수용 기준 (Acceptance Criteria)

1. 동일 `compute_request_id` 재조회 시 `final_target_price_krw`가 변하지 않는다.
2. 공임 항목별 `원가+흡수` 합계가 총공임 컬럼과 일치한다.
3. `include_plating=false` 시 도금 관련 raw는 유지되고, 최종 타겟 반영만 제외된다.
4. margin stack 미설정 채널은 기존 `margin_multiplier` 동작과 동일 결과를 낸다.

---

## 12) 롤아웃 단계

1. Shadow 계산 (신규 컬럼 계산만 저장, UI 미노출)
2. 운영자 UI에 읽기 전용 노출
3. 토글/정책 편집 활성화
4. cron 자동 동기화 경로에서 신규 컬럼 기반 explain 전환
