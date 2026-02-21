# Silver Single-Factor Migration Plan & Task Checklist (Add-Only)

## 1) 목적
- 은 계산에서 `silver_adjust_factor` 정책축을 제거하고, 금/은 모두 단일 수식으로 통일한다.
- 표준 수식: `effective_factor = purity_rate * material_adjust_factor`
- 적용 범위: Settings -> 출고확정 -> AR 원장/송장 -> 미수 결제(v2/v3) -> 카탈로그/영수증 표시
- 운영 원칙: 과거 데이터 백필 없이 신규/미래 데이터 기준, DB는 add-only migration만 사용

## 2) 성공 기준 (Definition of Done)
- 신규 출고 건에서 `market_adjust_factor_snapshot = 1`로 고정되고 `effective_factor_snapshot = purity * material_adjust`를 만족한다.
- 신규 AR 생성에서 `commodity_due_g`가 단일 수식 기준으로 계산된다.
- 순금/순은 결제(v2/v3) 시 commodity outstanding이 입력 grams만큼 정확히 감소한다.
- 카탈로그/AR 상세/영수증 환산 표시가 DB snapshot과 동일 규칙으로 계산된다.
- 설정 변경(예: 925 adjust 변경)이 출고/AR/결제/표시에 동일하게 반영된다.

## 3) 아키텍처 결정
- 유지: `material_adjust_factor`, `purity_rate`, `price_basis`
- 제거(의미상): `silver_adjust_factor`, `silver_adjust_factor_snapshot`, silver market factor 곱
- 호환성: 컬럼은 당장 삭제하지 않고 legacy 읽기만 허용, 신규 계산에서는 무시/1 고정

## 4) 핵심 영향 파일(조사 근거)
- Backend SQL
  - `supabase/migrations/20260221031000_cms_0701_material_factor_v2_per_material_addonly.sql`
  - `supabase/migrations/20260221103000_cms_0702_ar_forward_only_and_payment_factor_sync_addonly.sql`
  - `supabase/migrations/20260221112000_cms_0703_fix_record_payment_v2_material_code_type_addonly.sql`
  - `supabase/migrations/20260211000010_cms_0400_ar_payment_fifo_two_pass_material_cash_toggle.sql`
  - `supabase/migrations/20260211020010_cms_0413_ar_payment_fifo_target_first_v3.sql`
- Frontend / API
  - `web/src/lib/material-factors.ts`
  - `web/src/app/(app)/settings/page.tsx`
  - `web/src/app/(app)/catalog/page.tsx`
  - `web/src/app/(app)/ar/page.tsx`
  - `web/src/app/(app)/ar/v2/page.tsx`
  - `web/src/app/(app)/receipts/daily/page.tsx`
  - `web/src/components/receipt/receipt-print.tsx`
  - `web/src/app/api/repairs-prepare-confirm/route.ts`

## 5) 구현 태스크 체크리스트 (순서 고정)

### Task A. DB 단일계수 전환 migration 추가 (add-only)
목표: silver 시장보정 축 제거 및 단일 수식 강제

- [ ] 새 migration 파일 생성: `supabase/migrations/20260221xxxxxx_cms_0704_single_factor_model_addonly.sql`
- [ ] `cms_fn_apply_material_factor_snapshot_v1` 재정의
  - [ ] `market_adjust_factor_snapshot`를 계산 시 1로 고정
  - [ ] `effective_factor_snapshot = purity_rate_snapshot * material_adjust_factor_snapshot`
  - [ ] `material_amount_sell_krw/total_amount_sell_krw` 계산에서 silver market factor 곱 제거
- [ ] `cms_fn_apply_silver_factor_fix_v1` 재정의(no-op 또는 호환용)
  - [ ] 신규 계산에 영향 없도록 보정값 주입 제거
  - [ ] 반환 JSON은 기존 호출자 호환 유지
- [ ] `cms_fn_ar_create_from_shipment_confirm_v1` 재정의
  - [ ] fallback에서 `silver_adjust_factor(_snapshot)` 참조 제거
  - [ ] `effective_factor_snapshot` 우선 사용 보장
- [ ] 필요한 경우 `cms_fn_sync_repair_line_sell_totals_v1` 경유 계산 검증

완료 기준
- [ ] 함수 정의에서 silver factor 곱이 계산식에 남아있지 않음
- [ ] RPC 시그니처/리턴 형태 기존과 동일

### Task B. Confirm 체인 정렬
목표: 출고확정 체인에서 silver 정책축 비활성화

- [ ] 새 migration 파일 생성: `supabase/migrations/20260221xxxxxx_cms_0705_confirm_chain_single_factor_addonly.sql`
- [ ] `cms_fn_confirm_shipment_v3_cost_v1` 재정의
  - [ ] `cms_fn_apply_silver_factor_fix_v1` 호출 제거 또는 no-op 호출만 유지
  - [ ] forward-only guard 유지(기존 동작 보존)
- [ ] confirm 후 AR 생성/검증 체인 순서 유지

완료 기준
- [ ] confirm 경로에서 silver factor 주입 로직 비활성
- [ ] 기존 confirm 결과 JSON 구조 호환

### Task C. 금속 결제 환산 단일화
목표: `record_payment_v2`의 silver price 보정 제거

- [ ] 새 migration 파일 생성: `supabase/migrations/20260221xxxxxx_cms_0706_record_payment_single_factor_addonly.sql`
- [ ] `cms_fn_record_payment_v2` 재정의
  - [ ] silver tick 계산에서 `silver_adjust_factor_snapshot` 곱 제거
  - [ ] 금/은 공통 `v_fine = weight * purity_rate * material_adjust_factor`
  - [ ] purity parse/validation/enum cast(0703 보정사항) 유지

완료 기준
- [ ] 금/은 tender 모두 단일 수식으로 fine weight 산출
- [ ] invalid purity / missing tick 에러 처리 유지

### Task D. 프론트 계산식 단일화
목표: AR/영수증/카탈로그 표시 계산이 DB 단일 수식과 일치

- [ ] `web/src/lib/material-factors.ts` 정리
  - [ ] `silverAdjustApplied` / `marketAdjustApplied` 경로를 deprecated 처리 또는 미사용화
  - [ ] `getMaterialFactor` 기본 계산을 단일 축으로 통일
- [ ] `web/src/app/(app)/ar/page.tsx` 수정
  - [ ] 계산 상세 fallback에서 silver market adjust 곱 제거
- [ ] `web/src/app/(app)/ar/v2/page.tsx` 수정
  - [ ] 계산 상세 fallback에서 silver market adjust 곱 제거
- [ ] `web/src/app/(app)/receipts/daily/page.tsx` 수정
  - [ ] snapshot fallback 계산에서 silver factor 별도 곱 제거
- [ ] `web/src/components/receipt/receipt-print.tsx` 수정
  - [ ] pureWeight fallback에 silver factor 곱 제거
- [ ] `web/src/app/(app)/catalog/page.tsx` 확인
  - [ ] settings factor map 주입 유지 + silver 분기에서 별도 factor 입력 제거
- [ ] `web/src/app/api/repairs-prepare-confirm/route.ts` 수정
  - [ ] silverAdjustApplied 전달 제거

완료 기준
- [ ] UI 표시식과 DB snapshot 계산식이 동일

### Task E. 신규 함량 코드 확장성(금10/은900) 대응
목표: 하드코드 최소화, 신규 코드 추가 시 파급 최소화

- [ ] 단기(이번 작업에 포함)
  - [ ] `web/src/lib/material-factors.ts`의 고정 union 완화 계획 적용
  - [ ] 하드코딩 목록 추출/정리
    - [ ] settings: `MATERIAL_FACTOR_CODES`
    - [ ] catalog: `materialOptions`
    - [ ] repairs API: `REPAIR_MATERIAL_CODES`
    - [ ] workbench/orders/repairs 각 MATERIAL_OPTIONS
- [ ] 중기(다음 스프린트)
  - [ ] `material_codes` lookup 테이블 설계(코드, 표시명, purity, basis, active)
  - [ ] enum(`cms_e_material_code`)과 호환 래퍼 전략 수립
  - [ ] 읽기 경로는 lookup 우선, 쓰기 경로는 검증 함수 경유

완료 기준
- [ ] 신규 코드(예: 10, 900) 추가 시 코드 수정 범위가 settings/data 중심으로 축소

## 6) 검증 체크리스트 (실행 명령 포함)

### 6.1 정적/빌드 검증
- [ ] 수정 파일 LSP diagnostics 0
- [ ] 타입체크: `npx tsc --noEmit` (web)
- [ ] 회귀: `npm run test:shipments-regression` (web)

### 6.2 DB 배포/함수 검증
- [ ] `npx supabase db push`
- [ ] `npx supabase migration list`에서 0704/0705/0706 반영 확인

### 6.3 출고 -> AR 정합성 스모크
- [ ] 최근 확정 shipment N건 대상으로 `cms_fn_verify_shipment_ar_consistency_v1` 전건 통과
- [ ] shipment_line total vs ar_invoice total mismatch 0
- [ ] snapshot 유효성
  - [ ] `effective_factor_snapshot > 0`
  - [ ] `market_adjust_factor_snapshot = 1`

### 6.4 미수 결제(순금/순은) 스모크
- [ ] `cms_fn_ar_apply_payment_fifo_v2` 금/은 grams 결제
  - [ ] outstanding gold/silver가 입력 grams만큼 감소
  - [ ] 동일 idempotency key 재호출 시 duplicate=true, 추가 감소 0
- [ ] `cms_fn_ar_apply_payment_fifo_v3` TARGET_FIRST 동일 검증
- [ ] `cms_fn_record_payment_v2`
  - [ ] GOLD tender(예: 14K) fine_weight 검증
  - [ ] SILVER tender(예: 925/999) fine_weight 검증

### 6.5 UI 스모크
- [ ] settings에서 925/999 adjust 변경
- [ ] 카탈로그 계산값 변경 확인
- [ ] 출고 확정 후 AR 계산 상세/영수증 환산 표시가 동일 규칙으로 반영 확인

## 7) 롤백/비상 대응
- [ ] 함수 시그니처는 유지했으므로 rollback은 이전 migration 기반 `create or replace function`로 복구 가능
- [ ] 운영 중 이슈 시 신규 입력 중단 -> 함수 본문만 이전 버전으로 복구
- [ ] 과거 데이터는 건드리지 않으므로 데이터 복구 범위 최소화

## 8) 작업 순서 요약 (실행용)
1. Task A (0704)
2. Task B (0705)
3. Task C (0706)
4. Task D (Frontend/API)
5. Task E 단기 항목
6. 정적검증 -> db push -> E2E 스모크 -> UI 스모크

---

작성일: 2026-02-21
기준 원칙: AR 원장 SoT 우선, add-only, forward-only, 신규 데이터 우선
