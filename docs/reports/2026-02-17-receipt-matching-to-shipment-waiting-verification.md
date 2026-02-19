# 영수증/매칭 -> 출고대기 중량/가격 반영 검증 리포트 (2026-02-17)

## 1) 검증 범위

- 목표: 영수증 매칭 이후 `출고대기(Shipments)` 화면에 중량/가격이 누락 없이 반영되는지, 그리고 출고 확정까지 금액이 일관되게 이어지는지 코드 경로 기준으로 전수 점검.
- 점검 축:
  - `receipt_line_match_confirm` 계열 확정 경로
  - `orders_main`에서 선택값 스냅샷 저장 경로
  - `shipments`에서 prefill/fallback 반영 경로
  - `shipment upsert/update` RPC 경로
  - `confirm shipment` 최종 계산/락킹 경로
  - 예외 케이스(00/999, 수동 공임/총액, 수리, 반품)

## 2) 결론 요약

- 매칭 확정 경로는 `shipment draft 생성 -> shipment_line 중량/공임 업데이트 -> receipt 링크 저장 -> order READY_TO_SHIP`까지 연결됨.
- 출고대기 화면은 우선순위가 분명함:
  1. `receipt match prefill` 값
  2. 없으면 `cms_order_line.selected_*` 저장값 fallback
- 금액 계산은 최종적으로 `confirm shipment`에서 `labor_total_sell_krw`, `total_amount_sell_krw`로 확정/락킹됨.
- 모든 핵심 예외 경로(00, 999, 수동 공임/총액, 수리)는 별도 보정 로직이 존재함.

## 3) End-to-End 핵심 경로

### A. 영수증 라인 매칭 확정 -> 출고 draft 생성

- 함수: `cms_fn_receipt_line_match_confirm_v5`
  - `supabase/migrations/20260216090000_cms_0603_margin_engine_backend_sql_patch.sql:233`
- 동작 근거:
  - shipment draft/line 생성: `...:975`, `...:978`
  - 중량/공임 업데이트: `cms_fn_shipment_update_line_v1(...)` 호출 `...:992`
  - shipment_line에 receipt line 링크: `purchase_receipt_id`, `purchase_receipt_line_uuid` 업데이트 `...:1001`
  - receipt usage 링크 기록: `...:1008`
  - order 상태 READY_TO_SHIP 전환: `...:1020`
  - confirmed match 레코드 저장(선택 중량/선택 공임 포함): `...:1028`

### B. orders_main에서 선택값 스냅샷 저장

- 재고 매칭 확정 시 선택 스냅샷 저장:
  - `web/src/app/(app)/orders_main/page.tsx:779`
  - 저장 필드: `selected_base_weight_g`, `selected_deduction_weight_g`, `selected_net_weight_g`, `selected_labor_base_sell_krw`, `selected_labor_other_sell_krw`
- API 저장 처리:
  - `web/src/app/api/order-line-memo/route.ts:61`
  - `cms_order_line`에 위 필드가 null-safe로 업데이트됨.

### C. shipments(출고대기) 반영 우선순위

- `order_line`에서 스냅샷 필드 조회:
  - `web/src/app/(app)/shipments/page.tsx:910`
- 1차: receipt match prefill 적용
  - 중량: `...:975`, `...:977`
  - 차감중량: `...:979`
  - 기본공임: `...:985`, `...:989`
  - 기타공임/알공임: `...:1012`, `...:1019`
- 2차 fallback: `cms_order_line.selected_*`
  - 중량: `...:1056`
  - 기본공임: `...:1065`
  - 기타공임: `...:1069`

### D. shipments 저장/업데이트 RPC

- 업서트 호출:
  - `web/src/app/(app)/shipments/page.tsx:1511`
  - payload: `p_weight_g`, `p_deduction_weight_g`, `p_total_labor` 전달 `...:1616`
- 후속 라인 업데이트:
  - `p_base_labor_krw`, `p_extra_labor_krw`, `p_extra_labor_items`, `p_pricing_mode`, `p_manual_total_amount_krw` 전달 `...:1675`

### E. confirm shipment 최종 확정

- 확정 시 최종 노동/총액 반영:
  - `supabase/migrations/20260213195959_cms_0600_bundle_bom_rollup_pricing.sql:1222`
  - `...:1231`
- 수동 공임 우선 분기 존재:
  - 번들: `...:1082`
  - 일반 라인: `...:1127`

## 4) 경우의 수(케이스 매트릭스)

| 케이스 | 트리거/조건 | 출고대기 반영 필드 | 최종 확정 영향 | 리스크 |
|---|---|---|---|---|
| 기본 매칭 확정 | receipt line -> order line CONFIRMED | selected weight/material/factory labor가 prefill로 유입 | shipment_line labor/total 확정 | 낮음 |
| orders_main 스냅샷 fallback | receipt prefill 부재 | `cms_order_line.selected_*`로 중량/공임 채움 | upsert/update payload로 이어짐 | 낮음 |
| material `00` | 무게 0 허용 대상 | weight 0 허용(음수는 금지) | upsert 가능, 확정 계산 정상 | 중간 |
| material `999` | 은계열 별도 재계산 필요 | 출고대기 입력 후 confirm 시 재계산 | `total_amount_sell_krw` 재정렬 | 중간 |
| 수동 공임/총액 override | 운영자가 수동 입력 | base/extra/manual_total override 값 반영 | confirm에서 manual 우선 | 중간 |
| 수리 라인(repair_line_id) | 수리 출고 | 수리 라인 금액 동기화 로직 적용 | AR 직전 total 재동기화 | 중간 |
| 반품(return) | 기존 shipment_line 기준 반품 | 출고대기 입력값 자체 변경은 아님 | `total_amount_sell_krw` 기준 환입 계산 | 중간 |

## 5) 케이스별 근거

### 5.1 기본 매칭 확정

- `supabase/migrations/20260216090000_cms_0603_margin_engine_backend_sql_patch.sql:992`
- `supabase/migrations/20260216090000_cms_0603_margin_engine_backend_sql_patch.sql:1001`
- `supabase/migrations/20260216090000_cms_0603_margin_engine_backend_sql_patch.sql:1020`

### 5.2 orders_main fallback

- `web/src/app/(app)/orders_main/page.tsx:779`
- `web/src/app/api/order-line-memo/route.ts:61`
- `web/src/app/(app)/shipments/page.tsx:1056`

### 5.3 material 00 (중량 0 허용)

- UI 검증: `web/src/app/(app)/shipments/page.tsx:1560`
- RPC 검증: `supabase/migrations/20260211035010_cms_0419_shipment_upsert_from_order_line_v2_allow_zero_for_00.sql:57`
- 조건 분기: `...:61`

### 5.4 material 999

- 전용 재계산 함수: `supabase/migrations/20260203161000_cms_0337_material_999_pricing_fix.sql:3`
- total 재계산: `...:44`
- confirm 연계 호출: `...:138`

### 5.5 수동 공임/총액 override

- UI payload: `web/src/app/(app)/shipments/page.tsx:1688`
- upsert 저장: `supabase/migrations/20260211035010_cms_0419_shipment_upsert_from_order_line_v2_allow_zero_for_00.sql:73`
- confirm 시 manual 우선: `supabase/migrations/20260213195959_cms_0600_bundle_bom_rollup_pricing.sql:1127`

### 5.6 수리 라인

- 수리 라인 total sync 함수: `supabase/migrations/20260211055010_cms_0426_repair_line_total_sync_before_ar.sql:4`
- `repair_line_id is not null` 분기: `...:49`
- confirm 체인에서 sync 호출: `...:167`

### 5.7 반품

- 반품 계산은 기존 shipment_line total 기반: `supabase/migrations/20260127210000_cms_0023_record_return_v2.sql:53`

## 6) 무결성 체크 장치

- 매칭-출고 링크 무결성 뷰:
  - `supabase/migrations/20260203100000_cms_0328_receipt_line_matching_core.sql:237`
  - mismatch 검출 조건: `...:255`
- CONFIRMED인데 AR 누락 라인 검출 뷰:
  - `supabase/migrations/20260203100000_cms_0328_receipt_line_matching_core.sql:261`

## 7) 확인 결과

- 코드상 전파 체인은 정상적으로 구성되어 있으며, 중량/공임/총액에 대해 fallback 및 예외 분기가 존재함.
- 특히 `receipt prefill -> order selected_* fallback -> shipment upsert/update -> confirm recalculation` 순서가 명확함.
- 운영 리스크는 "입력값 부재/수동 override/재질 특수(00/999)/수리/반품"에서 발생 가능하며, 각 구간에 보정 로직이 이미 있음.

## 8) 권고 테스트 시나리오(실행 체크리스트)

- [ ] 일반재질(14/18/925) + 매칭확정 -> 출고대기 자동 prefill 확인
- [ ] receipt prefill 없는 라인 -> `selected_*` fallback 확인
- [ ] material `00` + 중량 0 저장 가능 확인
- [ ] material `999` 확정 후 total 재계산 확인
- [ ] 수동 총액 덮어쓰기 + 확정 결과 확인
- [ ] repair line 포함 shipment 확정 시 total sync 확인
- [ ] 반품 시 `total_amount_sell_krw` 기준 환입 금액 계산 확인
