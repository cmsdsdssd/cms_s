# Shopping Sync 운영 규칙 v2 (260228)

## 1. 목적
- 옵션 조합 전체(예: 2*3*3=18개)를 수동 관리하지 않고, 옵션값 단위(2+3+3=8개)만 설정해서 자동 계산/Push한다.
- 옵션 Sync는 R1/R2/R3만 사용한다. R4는 전역 정책이며 옵션 룰에서 제외한다.
- R2는 반드시 R1에서 결정된 소재 컨텍스트를 따른다.

## 2. 핵심 원칙
- **원칙 A (옵션값 단위 운영)**: 사용자는 옵션값(소재/사이즈/색상)만 등록한다.
- **원칙 B (조합 자동 계산)**: 시스템이 옵션값 조합을 생성해 각 조합별 추가금을 계산한다.
- **원칙 C (등록 룰만 Sync)**: 등록된 범위/조건에 매칭되는 룰이 없으면 Sync 불가(저장/재계산/Push 차단).
- **원칙 D (R1 선결정)**: R1에서 `effective_material_code`를 먼저 확정하고, R2는 그 소재로만 매칭한다.

## 3. 룰 체계

### 3.1 R1 소재 시세 차액 룰 (옵션룰)
- 역할: 마스터 소재 대비 옵션 소재 차액 계산.
- 출력: `r1_delta_krw`, `effective_material_code`.
- 필수: SYNC에서 R1 활성 시 반드시 매칭 1건 필요.

### 3.2 R2 사이즈/중량 구간 룰 (옵션룰)
- 역할: 사이즈값/중량구간 기반 추가금 계산.
- 매칭키: `effective_material_code(from R1)` + `category_code` + `weight_range` + `option_range_expr`.
- 관계형 연동: 선택적으로 `linked_r1_rule_id`를 설정해 특정 R1 룰과 강결합 가능.
- 필수: SYNC에서 R2 활성 시 반드시 매칭 1건 필요.

### 3.3 R3 색상 도금/마진 룰 (옵션룰)
- 역할: 색상코드 기반 추가금 계산.
- 필수: SYNC에서 R3 활성 시 반드시 매칭 1건 필요.

### 3.4 R4 전역 마진/라운딩 (전체 정책)
- 역할: `(R1+R2+R3 + 기타 원가)` 이후 최종 마진/라운딩.
- 위치: `pricing_policy` 관리영역 전용.
- 금지: 옵션 편집 UI에서 R4 노출/수정 금지.

## 4. 라운딩 단위 설정 (Settings)
- Settings > 옵션 룰 관리에서 룰 타입별 라운딩 설정을 지원한다.
- 공통 필드
  - `rounding_unit`: 100, 300, 500, 1000, 직접입력
  - `rounding_mode`: CEIL / ROUND / FLOOR
- 적용 시점
  - R1: R1 delta 계산 직후
  - R2: R2 delta 계산 직후
  - R3: R3 delta 계산 직후
  - R4: 최종 단계에서 1회

## 5. 데이터 필드 명세

### 5.1 sales_channel_product
- `option_price_mode` (`SYNC` | `MANUAL`)
- `sync_rule_set_id` (SYNC 필수)
- `option_material_code`
- `option_color_code`
- `option_size_value`
- `sync_rule_material_enabled` (R1 on/off)
- `sync_rule_weight_enabled` (R2 on/off)
- `sync_rule_plating_enabled` (R3 on/off)

### 5.2 sync_rule_r1_material_delta
- `rule_id`
- `rule_set_id`
- `source_material_code`
- `target_material_code`
- `match_category_code`
- `weight_min_g`, `weight_max_g`
- `option_weight_multiplier`
- `rounding_unit`, `rounding_mode`
- `priority`, `is_active`

### 5.3 sync_rule_r2_size_weight
- `rule_id`
- `rule_set_id`
- `linked_r1_rule_id` (nullable, FK to R1)
- `match_material_code` (실제 매칭은 R1의 effective material 기준)
- `match_category_code`
- `weight_min_g`, `weight_max_g`
- `option_range_expr`
- `delta_krw`
- `rounding_unit`, `rounding_mode`
- `priority`, `is_active`

### 5.4 sync_rule_r3_color_margin
- `rule_id`
- `rule_set_id`
- `color_code`
- `margin_min_krw`, `margin_max_krw`
- `delta_krw`
- `rounding_unit`, `rounding_mode`
- `priority`, `is_active`

## 6. 검증 규칙

### 6.1 저장 검증 (옵션 저장)
- SYNC일 때
  - `sync_rule_set_id` 필수
  - R1 활성 시 R1 매칭 필수
  - R2 활성 시 R1 결과 소재 기준 R2 매칭 필수
  - R3 활성 시 R3 매칭 필수
- 위 조건 중 하나라도 실패하면 저장 차단.

### 6.2 재계산 검증 (recompute)
- SYNC 옵션에서 활성 룰 미매칭 시 해당 옵션 스냅샷 생성 차단.
- 응답에 `blocked_by_missing_rules`를 포함해 원인 노출.

### 6.3 미리보기 검증 (preview)
- `matched_samples` / `unmatched_samples` 분리 제공.
- `missing_rules` 배열로 어떤 룰이 비었는지 반환.

## 7. 에러 코드 규약
- `SYNC_RULE_NOT_REGISTERED` (422)
  - 의미: 활성 룰 중 등록/매칭 실패
  - payload: `missing_rules` (예: ["R2"])
- `SYNC_RULE_SET_REQUIRED` (400)
  - 의미: SYNC인데 rule_set 미지정
- `SYNC_RULE_OUT_OF_RANGE` (422)
  - 의미: 소재/카테고리/중량/사이즈/색상 범위 미매칭
- `SYNC_RULE_R1_REQUIRED` (422)
  - 의미: R2/R3 평가 전 R1 소재결정 실패

## 8. 계산 순서(고정)
1) R1 매칭/계산 -> `effective_material_code` 확정
2) R2 매칭/계산 (`effective_material_code` 사용)
3) R3 매칭/계산
4) R1+R2+R3 합산
5) R4(전역 마진/라운딩) 적용

## 9. 운영 예시
- 옵션 축: 소재(14K,18K) / 사이즈(3,5,7) / 색상(W,G,P)
- 운영 등록: 옵션값 기준 총 8개만 세팅
- 계산 시: 18개 조합 자동 생성
- `18K + 5호 + W` 조합은
  - R1: 18K 소재 차액
  - R2: 18K 컨텍스트 사이즈룰
  - R3: W 색상룰
  - 합산 후 R4 적용
