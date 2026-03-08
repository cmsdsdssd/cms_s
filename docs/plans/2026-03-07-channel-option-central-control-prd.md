# PRD: Channel Option Central Control

- Document version: v1.0
- Date: 2026-03-07
- Status: Approved for implementation
- Scope: shopping option central control, product option mapping, auto-price integration, audit trail

---

## Goal

채널별 중앙 규칙으로 상품 옵션 가격을 통제하고, 상품 편집 화면에서는 허용된 값만 선택하게 만들어 SKU 수가 많아져도 일괄 관리가 가능하도록 한다.

## Problem Statement

현재 구조는 다음 한계가 있다.

1. `channel_option_category_v2`가 `option_name`, `option_value`, `category_key`, `sync_delta_krw` 정도만 저장하는 flat 모델이다.
2. `auto-price` 화면은 `optionName` 기준 분류와 `entryKey(option_name::option_value)` 기준 가격이 섞여 있어 중앙 제어 모델을 담기 어렵다.
3. 상품 화면에서 중앙 규칙이 아니라 개별 상품 임시 편집 느낌이 강해 SKU 수가 늘어나면 관리가 불가능하다.
4. 변경 이력과 예외 처리(`기타`)가 비즈니스 개념으로 분리되어 있지 않다.

## Users

- 운영자: 중앙 규칙을 만들고 범위 가격을 일괄 조정하는 사람
- 상품 관리자: 특정 상품 옵션값 row를 중앙 규칙에 매핑하는 사람
- 검수자: legacy 경고, 예외 사유, 변경 이력을 확인하는 사람

## Non-Negotiable Rules

1. 중앙 규칙은 채널별로 관리한다.
2. 상품 화면에서는 중앙 규칙에서 허용된 값만 선택할 수 있다.
3. 중앙 규칙이 겹치면 결과 금액은 누적 가산한다.
4. 중앙 규칙이 바뀌어 기존 매핑값이 허용 범위를 벗어나도 기존값은 유지하고 경고한다.
5. 소재는 항상 마스터 아이템에서 자동으로 채워지고 일반적으로 직접 수정하지 않는다.
6. variant 가격은 variant가 포함하는 옵션값 row들의 resolved delta 합으로 계산한다.
7. `기타`는 수동 추가금액과 사유를 함께 저장하고 추적해야 한다.

## Business Categories

### 1. 소재

- 목적: 가격 계산 context
- 입력: 없음
- 소스: 마스터 아이템 소재 자동 채움
- 결과: 소재명 또는 소재코드에 대응되는 표시값
- 가격 반영: 직접 additive bucket 아님

### 2. 사이즈

- 목적: 중량 기반 추가금
- 1차 카테고리: 소재
- 2차 카테고리: 추가중량
- 결과: 추가금액
- 규칙 키: `material_code + additional_weight_g`
- 선택 제약: 해당 소재에 대해 중앙 규칙이 허용한 추가중량만 선택 가능

### 3. 색상

- 목적: 색상 기반 추가금
- 1차 카테고리: 소재
- 2차 카테고리: 색상
- 3차 카테고리: 추가금액(중앙 규칙에 저장된 값)
- 결과: 추가금액
- 규칙 키: `material_code + color_code`
- 상품 화면: 운영자는 색상만 선택하고 추가금액은 중앙 규칙에서 자동 적용

### 4. 장식

- 목적: 장식 선택 및 장식 추가금
- 1차 카테고리: 모델명
- 2차 카테고리: `소재|중량|총공임(원가+흡수공임)` 참고 정보
- 3차 카테고리: 추가금액
- 결과: 추가금액
- 규칙 키: `decor_master_item_id`
- 참고 정보: 장식 마스터의 소재, 중량, 총공임은 저장 당시 snapshot으로 남기고, 사람은 이 값을 수정하지 않는다.
- 상품 화면 기본 후보: 마스터 아이템 BOM 기준 `부속` 마스터만 우선 노출하고, 체크 해제 시 전체 마스터 노출

### 5. 기타

- 목적: 중앙 규칙으로 표현되지 않는 예외 추가금
- 입력: 수동 추가금액 + 사유
- 결과: 추가금액
- 금액 범위: 100원 ~ 1,000,000원, 100원 단위
- 사유: 필수, 변경 이력 저장

## Central Control Behavior

### Scope

- 규칙은 `channel_id` 기준으로 분리한다.
- 다른 채널은 같은 이름의 규칙이어도 서로 영향 주지 않는다.

### Additive Rule Model

- 중앙 규칙은 절대 최종값이 아니라 additive delta 이벤트다.
- 같은 범위에 여러 규칙이 걸리면 delta를 합산한다.
- 예: `18K, 0.01~0.10g = 3000`, 이후 `18K, 0.07~0.10g = +500`이면 `0.07~0.10g`는 `3500`이 된다.

### Legacy Preservation

- 중앙 규칙 수정으로 기존 매핑값이 허용 범위를 벗어나더라도 값을 즉시 삭제하지 않는다.
- 대신 `legacy_out_of_range` 상태와 경고 메시지를 표시한다.
- 새로 선택할 때는 허용값만 선택 가능하다.

## Product Editing UX

### Main Principle

- 메인 화면은 variant card 중심이 아니라 옵션값 row 중심이다.
- `2 x 3` 옵션 조합이라면 메인 편집은 6 variants가 아니라 5 고유 옵션값 rows 기준으로 보인다.

### Row Behavior by Category

- 소재 row: 자동 채움, 읽기 전용
- 사이즈 row: 소재가 채워지면 허용 추가중량 dropdown 활성화
- 색상 row: 소재가 채워지면 허용 색상 dropdown 활성화
- 장식 row: 기본은 부속 마스터 목록을 우선 보여주고 필요 시 전체 마스터 선택 가능
- 기타 row: 금액 dropdown + 사유 입력

### Warning States

- legacy mapping value outside current allowed range
- missing central rule for required category
- unresolved material from master item
- deleted or inactive central rule reference

## Price Resolution

### Variant Formula

`variant_additional_amount = sum(resolved_delta_krw of mapped option rows in variant) + explicit variant override delta`

### Precedence

1. explicit manual override at variant or mapping level, if active
2. resolved additive sum from size/color/decor/other mappings
3. material contributes context only

### Failure Policy

- 소재 미해결: dependent categories cannot resolve
- 사이즈/색상 required rule missing: unresolved warning, no fake zero-value claim
- 장식/기타 optional 없는 경우: 0 가능, but only when category truly optional

## Settings UX

중앙 규칙 화면은 기존 `shopping/rules` 흐름을 확장 또는 재편해 사용한다.

### Required Operator Capabilities

1. 채널 선택
2. 카테고리별 규칙 목록/검색/생성/비활성화
3. 사이즈 규칙 범위 생성
4. 색상 규칙 생성
5. 장식 규칙 생성
6. 기타 예외 템플릿 또는 자유 사유 기록
7. 규칙 변경 시 영향 SKU 재계산 트리거 또는 대기 상태 표시

## Auditability

- 상품 옵션 매핑 변경 기록 저장
- `기타` 사유 변경 기록 저장
- 중앙 규칙 변경 기록 저장
- 어떤 규칙이 어떤 resolved delta를 만들었는지 역추적 가능해야 한다.

## Acceptance Criteria

1. 상품 옵션 편집에서 중앙 허용값 외 신규 입력이 막힌다.
2. 소재는 마스터 아이템에서 자동 채워지고 일반 편집에서 수정되지 않는다.
3. `2 x 3` 상품은 옵션값 row 기준으로 편집되고 variant 가격은 자동 합산된다.
4. 사이즈는 소재별 허용 중량만 선택할 수 있다.
5. 색상은 소재별 허용 색상만 선택할 수 있고, 금액은 중앙 규칙에서 자동 적용된다.
6. 장식은 기본 부속 마스터 목록을 우선 보여주고 필요 시 전체 마스터를 선택할 수 있다.
7. `기타`는 금액과 사유가 함께 저장되고 이력으로 남는다.
8. 중앙 규칙 겹침 시 additive 누적이 적용된다.
9. 중앙 규칙 변경 후 허용 범위 밖 기존값은 유지되며 경고된다.
10. UI와 계산 로직이 같은 canonical resolved mapping 데이터를 사용한다.

## Out of Scope

- 주문 이력 또는 과거 스냅샷 소급 재계산
- 채널 공통 규칙과 채널 override 동시 지원
- 교차 카테고리 할인/상쇄 규칙
- 소재 수동 override를 일반 기본 동작으로 허용하는 것
