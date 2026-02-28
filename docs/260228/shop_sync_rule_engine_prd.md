# Shopping SYNC Rule Engine PRD (260228)

## 1) 문서 목적
- 옵션 가격 운영을 "옵션별 숫자 수동 입력"에서 "룰 기반 Sync"로 전환한다.
- 유지보수 핵심 목표는 "한 번 수정 -> 조건에 맞는 옵션 전체 자동 반영"이다.
- `SYNC`는 옵션 룰 3개(R1~R3)만 다루고, R4는 전역(전체) 가격정책으로 분리한다.

## 2) 배경 문제
- 현재 방식은 옵션행에 배수/증분/추가금을 직접 입력해야 해서 항목이 많아지면 운영비용이 급격히 증가한다.
- 같은 정책(예: 925 반지 0.2~0.4g 사이즈군)에 대해 반복 수정이 필요해 대량 인상/인하가 비효율적이다.
- 운영자가 원하는 것은 "룰 세트 선택"과 "룰 라인 일괄 조정"이다.

## 3) 목표/비목표
- 목표
  - `SYNC`에서 옵션별 직접 숫자 입력 UI를 제거한다.
  - 옵션은 `SYNC` 시 룰셋만 선택한다.
  - R1/R2/R3 각각에 라운딩 단위(100/500/1000 등)와 직접입력을 지원한다.
  - 룰셋(Set)을 저장/재사용하고, Sync 시 세트를 바로 선택할 수 있게 한다.
  - 일괄 상향/하향(예: 특정 조건 +1000) 기능을 제공한다.
- 비목표
  - Cafe24 API 방식 자체를 변경하지 않는다(계산 결과 push 흐름은 유지).
  - MANUAL 모드는 유지하되 룰 엔진 대상에서 제외한다.

## 4) 용어 정의
- 마스터 소재가격: 마스터 기본 소재 기준으로 계산된 소재비.
- 목표 소재가격: 옵션 소재 기준으로 계산된 소재비.
- 소재 추가금(R1 delta): `목표 소재가격 - 마스터 소재가격`.
- 룰셋(Set): R1/R2/R3 라인 묶음. 옵션의 SYNC 대상은 룰셋이다.
- 전역룰(R4): 채널 전체 가격에 적용되는 마진/라운딩 정책.

## 5) 최종 룰 구조

### R1. 소재 시세 차액 룰 (옵션룰)
- 목적: 옵션 소재 변경(예: 14K -> 18K) 시 소재비 차액을 자동 반영.
- 공식
  - `master_material_price = purity(master) * factor(master) * weight(master) * tick`
  - `target_material_price = purity(target) * factor(target) * weight(master) * option_weight_multiplier * tick`
  - `R1_delta = target_material_price - master_material_price`
- 예시 (사용자 요구 고정)
  - 금시세 10,000원/g, 마스터 14K(함량 0.585), 보정계수 1.1, 중량 1g
  - `master_material_price = 0.585 * 1.1 * 1 * 10000 = 6,435`
  - 옵션 18K(함량 0.750), 18K 옵션중량배수 1.2
  - `target_material_price = 0.750 * 1.1 * 1 * 1.2 * 10000 = 9,900`
  - `R1_delta = 9,900 - 6,435 = +3,465`
  - 옵션 표시 예: `18K (+3,465원)`
- 라운딩
  - R1 전용 라운딩 단위/모드 보유(기본: 100원 단위).
  - 드롭다운: `100 / 500 / 1000 / 직접입력`.

### R2. 사이즈/중량 구간 룰 (옵션룰)
- 목적: 소재/카테고리/중량대/사이즈군별 추가금 운영.
- 매칭 축
  - `material_code` + `category_code` + `weight_range(min~max)` + `option_group(range/list)`
- 예시
  - `925 / 반지 / 0.2~0.4g / 2~4호 => +2,000`
  - `925 / 반지 / 0.2~0.4g / 5~6호 => +3,000`
  - 일괄 조정: "925 반지 0.2~0.4g 사이즈 마진 +1,000" -> 위 두 라인 모두 +1,000
- 라운딩
  - R2 전용 라운딩 단위/모드 보유(기본: 100원 단위).
  - 드롭다운 + 직접입력 동일 적용.

### R3. 색상 도금/마진 룰 (옵션룰)
- 목적: 색상코드(P/W/G 등)별 마진/도금 추가금을 일괄 관리.
- 매칭 축
  - `color_code` + `margin_band(min~max)` (+ 선택적으로 material/category)
- 예시
  - "W 중 3,000~5,000 구간 +1,000" 실행 시 해당 범위 옵션에 일괄 +1,000 적용.
- 라운딩
  - R3 전용 라운딩 단위/모드 보유(기본: 100원 단위).
  - 드롭다운 + 직접입력 동일 적용.

### R4. 전역 마진/라운딩 룰 (전체룰)
- 성격: 옵션 Sync룰이 아니라 채널 전체 가격정책.
- 역할
  - `(R1+R2+R3 반영 결과 + 기타 원가요소)`에 전역 마진 곱
  - 최종 금액 라운딩(천원 올림 등)
- 운영 위치
  - `pricing_policy` 영역(채널 정책 화면)에서만 관리
  - 옵션 편집 화면에서는 노출하지 않음

## 6) 계산 우선순위/충돌 규칙
- 계산 순서
  - 1) R1 delta
  - 2) R2 delta
  - 3) R3 delta
  - 4) R4 전역 마진/최종 라운딩
- 충돌 처리
  - 동일 룰타입에서 다중 매칭 시 `priority` 높은 1개 우선(기본)
  - 운영 옵션으로 `SUM` 모드 허용 가능하나 기본은 `FIRST_MATCH`
- 추적성
  - 계산 결과에 `rule_hit_trace` 기록(어떤 룰 id가 반영되었는지)

## 7) UX 요구사항 (핵심)

### 7.1 Dashboard 옵션 편집
- `SYNC`일 때 입력 항목
  - 룰셋 선택(`rule_set_id`)
  - 미리보기(현재 옵션에 적용된 R1/R2/R3 결과값)
- `MANUAL`일 때 입력 항목
  - `manual_target_krw`
- 제거 항목
  - 소재배수, 사이즈증분, 고정추가금 직접입력 필드

### 7.2 Rule Set 관리 화면 (`settings/shopping/sync-rules`)
- 탭
  - R1 / R2 / R3 / 세트(Set)
- 주요 기능
  - 룰 라인 CRUD
  - 조건 검색(소재/카테고리/중량/색상)
  - 일괄 증감(선택 조건 +N/-N)
  - 라운딩 단위 드롭다운 + 직접입력
  - 영향 미리보기(영향 옵션 수, 샘플 항목)
  - 세트 저장/복제/비활성화

## 8) 데이터 모델(제안)

### 8.1 신규 테이블
- `sync_rule_set`
  - `rule_set_id`, `channel_id`, `name`, `description`, `is_active`, `created_at`, `updated_at`
- `sync_rule_r1_material_delta`
  - 소재/함량/보정/옵션중량배수 참조 키, 라운딩 설정, `priority`, `is_active`
- `sync_rule_r2_size_weight`
  - `material_code`, `category_code`, `weight_min_g`, `weight_max_g`, `option_range_expr`, `delta_krw`, 라운딩 설정, `priority`
- `sync_rule_r3_color_margin`
  - `color_code`, `margin_min_krw`, `margin_max_krw`, `delta_krw`, 라운딩 설정, `priority`
- `sync_rule_set_binding`
  - `rule_set_id`와 R1/R2/R3 라인 연결

### 8.2 기존 테이블 변경
- `sales_channel_product`
  - `sync_rule_set_id` nullable 추가
  - `option_price_mode`가 `SYNC`일 때 `sync_rule_set_id` 필수

## 9) API 설계(제안)
- `GET/POST /api/sync-rule-sets`
- `PUT/DELETE /api/sync-rule-sets/{id}`
- `GET/POST /api/sync-rules/r1`
- `GET/POST /api/sync-rules/r2`
- `GET/POST /api/sync-rules/r3`
- `POST /api/sync-rules/bulk-adjust`
  - 입력: 룰타입, 필터조건, 증감값
  - 결과: 변경건수, 샘플 변경내역
- `POST /api/sync-rules/preview`
  - 입력: rule_set_id + 조건
  - 결과: 영향 옵션 수, 옵션별 before/after

## 10) 운영 시나리오
- 시나리오 A: 18K 옵션 차액 자동반영
  - R1에서 마스터 대비 소재 차액 계산 -> 옵션표시 `(+3,465원)` 자동 생성
- 시나리오 B: 사이즈군 일괄 +1,000
  - R2 조건 필터 후 bulk-adjust 실행 -> 영향 옵션 즉시 재계산
- 시나리오 C: W색상 특정 구간 일괄 +1,000
  - R3에서 `color=W`, `margin 3000~5000` 선택 후 +1000

## 11) 검증/수용 기준
- 기능
  - `SYNC` 옵션은 룰셋만 선택 가능하고 직접 숫자 입력이 불가해야 한다.
  - R1 공식이 예시값(6,435 / 9,900 / +3,465)을 정확히 재현해야 한다.
  - R2/R3 bulk-adjust가 조건 대상 전체에 누락 없이 반영되어야 한다.
  - R4는 옵션 화면이 아닌 전역 정책에서만 관리되어야 한다.
- 로그
  - recompute 결과에 `rule_hit_trace` 저장.
  - push 전/후 금액 및 룰버전 추적 가능.

## 12) 롤아웃 계획
- 1단계: 신규 룰 테이블/세트 API + preview 구현
- 2단계: dashboard 옵션편집을 룰셋 선택 방식으로 전환
- 3단계: recompute에 R1/R2/R3 엔진 연결, R4 분리 고정
- 4단계: bulk-adjust/운영 이력/감사 로그 강화
- 5단계: 기존 옵션 직접값 마이그레이션(가능한 항목은 룰로 흡수)

## 13) 리스크와 완화
- 리스크: 옵션명/사이즈 표기 불일치로 룰 미매칭
  - 완화: option_group 표준화 + 미매칭 리포트
- 리스크: 과도한 일괄수정
  - 완화: 미리보기 + 영향건수 임계치 승인
- 리스크: 룰 중복 충돌
  - 완화: priority + 단일우선 기본정책 + 충돌 경고

## 14) 성공 지표(KPI)
- 룰 기반 일괄 조정 소요시간: 기존 대비 70% 이상 단축
- 수동 옵션 개별 수정 건수: 월 기준 60% 이상 감소
- bulk-adjust 오적용(롤백 필요) 비율: 1% 미만
- recompute 후 push 불일치율: 0.5% 미만

## 15) 결정 고정사항(Deterministic Contract)
- 동일 입력(룰버전/시세/옵션데이터)이면 계산 결과는 항상 동일해야 한다.
- 평가 순서는 고정: `R1 -> R2 -> R3 -> R4`.
- 기본 충돌 정책은 `FIRST_MATCH`이며, `priority ASC(숫자 낮을수록 우선)`로 판정한다.
- 라운딩 적용 시점
  - R1/R2/R3: 각 룰 계산 직후(룰별 설정)
  - R4: 최종 단계에서 1회 적용
- 재실행 드리프트 방지
  - 중간계산은 고정 소수 정밀도(권장 numeric 18,6)로 보관
  - 라운딩 결과는 단계별 단일 필드로 기록

## 16) 배치 작업/롤백 규약
- bulk-adjust 실행은 비동기 Job으로 수행한다.
- 필수 단계
  - preview 생성 -> 영향건수/샘플 확인 -> apply 승인
- 안전장치
  - 영향건수 임계치 초과 시 추가 승인
  - Job idempotency key 필수
  - 실패건 재시도 횟수/중단 기준 명시
- 롤백
  - 룰셋 버전 스냅샷 저장
  - 이전 활성 버전으로 one-click revert 지원

## 17) 감사/관측성 요구사항
- 감사로그 필수 항목
  - 변경자, 변경시각, 변경사유, before/after diff, 대상건수
- 운영 대시보드 지표
  - 룰별 적용건수, 실패건수, 평균 계산시간, 최근 오류코드
- 경보 조건
  - 단일 Job 실패율 임계치 초과
  - 일괄 조정 후 평균 목표가 급변(이상치)

## 18) 테스트 벡터(골든 케이스)
- R1 골든
  - 입력: 14K/18K/배수1.2/시세10000/중량1g/계수1.1
  - 기대: `master=6435`, `target=9900`, `delta=3465`
- R2 골든
  - 입력: 925/반지/0.2~0.4g, 2~4호(+2000), 5~6호(+3000)
  - 일괄 +1000 후 기대: `+3000 / +4000`
- R3 골든
  - 입력: color=W, margin 3000~5000, delta +1000
  - 기대: 범위 내 옵션만 +1000 반영
- R4 골든
  - 입력: subtotal, margin_multiplier, rounding(1000/CEIL)
  - 기대: 전역 라운딩 1회만 적용
