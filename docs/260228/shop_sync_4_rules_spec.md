# Shop Sync 4 Rules Spec (260228)

## 목적
- 쇼핑몰 가격 Sync를 옵션별로 일관되게 운영하기 위한 4가지 규칙을 명확히 정의한다.
- `SYNC` 모드에서 어떤 계산이 적용되는지 운영자/개발자가 동일하게 이해하도록 한다.

## 기본 원칙
- SoT(Source of Truth)는 내부 시스템이다.
- 옵션별 최종목표가는 내부 계산 결과를 기준으로 결정한다.
- Push 단계에서는 계산된 최종목표가를 Cafe24 상품/옵션에 반영한다.

## Sync Rule 1: 소재 시세 연동
- 의미: 금/은 시세(tick)와 소재 계수를 반영해 재료비를 계산한다.
- 입력
  - `material_code_default`
  - 시장시세(`gold_price_krw_per_g`, `silver_price_krw_per_g`)
  - 소재 계수(`material_factor`)
  - 옵션 소재배수(`material_multiplier_override`, 옵션행)
- 계산 개요
  - `net_weight_g * tick * material_factor * option_material_multiplier`
- 기대효과
  - 시세 변동 시 재료비가 자동 반영된다.

## Sync Rule 2: 중량 구간/증분 연동
- 의미: 옵션(예: 사이즈/중량 구간)에 따라 순중량을 증감해 가격에 반영한다.
- 입력
  - 마스터 순중량(`weight_default_g - deduction_weight_default_g`)
  - 옵션 중량 증분(`size_weight_delta_g`)
- 계산 개요
  - `net_weight_g = max(base_net_weight + size_weight_delta_g, 0)`
  - 위 순중량으로 소재비 재계산
- 기대효과
  - 옵션별 실중량 차이가 가격에 정확히 반영된다.

## Sync Rule 3: 도금 공임 연동
- 의미: 도금 공임을 포함/제외하여 옵션별 공임 계산에 반영한다.
- 입력
  - 마스터 공임 항목(기본/센터/보석군)
  - 도금 포함 여부(`include_master_plating_labor`)
  - 도금 기본값(`plating_price_sell_default`)
- 계산 개요
  - `labor_raw = base labor + stone labor + (include_plating ? plating_labor : 0)`
- 기대효과
  - 도금 정책 변경이 옵션가격에 즉시 반영된다.

## Sync Rule 4: 마진/라운딩 연동
- 의미: 채널별 마진과 라운딩 정책으로 판매 목표가를 결정한다.
- 입력
  - 채널 정책(`margin_multiplier`, `rounding_unit`, `rounding_mode`)
  - 조정값(`pricing_adjustment`, `channel_base_price_adjustment_log`, `option_price_delta_krw`)
- 계산 개요
  - `(소재비 + 공임 + 조정) * margin_multiplier`
  - 라운딩 후 최종 목표가 산출
- 기대효과
  - 채널 운영정책(마진/끝자리)이 가격에 일관 반영된다.

## 옵션별 모드 정의
- `SYNC`
  - 위 4가지 규칙을 적용해 옵션별 목표가를 계산한다.
- `MANUAL`
  - 운영자가 입력한 수동 목표가(`option_manual_target_krw`)를 우선 사용한다.
  - `SYNC` 계산값은 참고값으로만 남는다.

## 운영 플로우
1. 현재가 불러오기 (`pull`)
2. 재계산 (`recompute`)
3. 옵션별 검토/수정 (`SYNC` 또는 `MANUAL`)
4. Push (`push`)
5. 잡 로그(`price_sync_job_item`)로 성공/실패/원인 확인

## 확인 포인트
- `SYNC`인데 목표가가 비정상(0/null)인 옵션이 없는지
- `MANUAL` 옵션의 수동목표가가 의도대로 유지되는지
- Push 후 `after_price_krw`가 `target_price_krw`와 일치하는지
