# ULW 최종 보고서: 주문-영수증/매칭-출고-미수원장(AR) 정합성 감사

작성일: 2026-02-19

## 0) 목적과 범위

이 보고서는 아래 4개 질문에 대해 코드/SQL 근거로 답한다.

1. 주문 -> 영수증/매칭 -> 출고대기 과정에서 공임/중량이 어떻게 계산/전파되는가?
2. BOM/부품 구성품 공임, 기타공임이 출고 페이지/확정 데이터로 어떻게 반영되는가?
3. 카탈로그 공임과 실제 출고 공임이 왜/어떻게 달라지는가?
4. 출고확정 금액이 AR(미수원장)에 정확히 기록되고, 결제와 함께 SOT 정합성이 유지되는가?

---

## 1) 요구사항 1: 주문 -> 영수증/매칭 -> 출고대기 공임/중량 흐름

### 1-1. 영수증 매칭 확정에서 출고 draft 생성

- 영수증 워크벤치에서 매칭 확정 RPC를 호출한다: `CONTRACTS.functions.receiptLineMatchConfirm` (`web/src/app/(app)/new_receipt_line_workbench/receipt-line-workbench.tsx:1380`).
- 이때 선택 중량/소재코드를 명시 전달한다: `p_selected_weight_g`, `p_selected_material_code` (`web/src/app/(app)/new_receipt_line_workbench/receipt-line-workbench.tsx:3367`).
- 결과에 `shipment_id`를 반환/표시해 출고 초안과 연결됨을 UI에서 확인한다 (`web/src/app/(app)/new_receipt_line_workbench/receipt-line-workbench.tsx:5658`).

### 1-2. 출고 페이지 prefill 소스

- 출고 화면은 `/api/shipment-receipt-prefill`을 호출해 매칭 결과 기반 prefill을 불러온다 (`web/src/app/(app)/shipments/page.tsx:961`).
- API는 `cms_receipt_line_match`(CONFIRMED)에서 최신 확정건을 읽고 (`web/src/app/api/shipment-receipt-prefill/route.ts:34`),
  - 중량/차감중량,
  - 기본/기타 공임 관련 값,
  - 원석 수량/단가/원석공임,
  - 기존 shipment 라인의 `base_labor_krw`, `extra_labor_krw`, `extra_labor_items`
  를 병합 반환한다 (`web/src/app/api/shipment-receipt-prefill/route.ts:100`, `web/src/app/api/shipment-receipt-prefill/route.ts:104`, `web/src/app/api/shipment-receipt-prefill/route.ts:120`).

### 1-3. 출고 화면에서 공임 계산식

출고 UI 핵심 계산식:

- `resolvedEtcLaborTotal = resolvedEtcLaborItemsTotal + resolvedOtherLaborCost + resolvedAutoAbsorbLaborTotal` (`web/src/app/(app)/shipments/page.tsx:2737`)
- `resolvedExtraLaborTotal = resolvedEtcLaborTotal + effectiveStoneLabor` (`web/src/app/(app)/shipments/page.tsx:2742`)
- 기본공임 우선순위: `selected_factory_labor_basic_cost_krw -> receipt_labor_basic_cost_krw -> shipment_base_labor_krw` (`web/src/app/(app)/shipments/page.tsx:2747`)

저장/업데이트 시 전달 필드:

- `p_base_labor_krw`, `p_extra_labor_krw`, `p_extra_labor_items` (`web/src/app/(app)/shipments/page.tsx:1857`, `web/src/app/(app)/shipments/page.tsx:1927`)

요약하면, 출고 공임은 "영수증 확정값 + 사용자 편집 + 자동흡수 + 원석공임"을 합산한 거래 시점 값으로 확정된다.

---

## 2) 요구사항 2: BOM/부품 구성품 공임, 기타공임의 출고 반영 경로

### 2-1. DB 레벨 BOM 반영

- 출고 확정 핵심 함수 `cms_fn_confirm_shipment`는 BUNDLE/BOM 롤업 패치를 포함한다 (`supabase/migrations/20260213195959_cms_0600_bundle_bom_rollup_pricing.sql:721`).
- 해당 마이그레이션은 BUNDLE의 BOM leaf 전개/롤업 및 확정 계산을 수행하도록 구성되어 있다 (`supabase/migrations/20260213195959_cms_0600_bundle_bom_rollup_pricing.sql:1316`).

### 2-2. 프론트 레벨 기타공임/자동흡수/원석공임 반영

- 프론트는 기타공임 항목합 + other labor + auto absorb를 etc 공임으로 계산하고, 여기에 원석공임을 더해 extra 공임을 만든다 (`web/src/app/(app)/shipments/page.tsx:2737`, `web/src/app/(app)/shipments/page.tsx:2742`).
- 이 값이 `p_extra_labor_items`, `p_extra_labor_krw`로 서버에 저장되어 출고 라인 계산에 반영된다 (`web/src/app/(app)/shipments/page.tsx:1858`, `web/src/app/(app)/shipments/page.tsx:1859`).

즉, BOM 기반(백엔드) + 화면 편집 기반(프론트) 공임이 함께 최종 출고 데이터에 반영된다.

---

## 3) 요구사항 3: 카탈로그 공임 vs 실제 출고 공임 차이

결론: 두 값은 같은 시스템 안에 있어도 목적이 달라 동일값이 보장되지 않는다.

- 카탈로그 공임: 마스터/표시 중심 기준값(견적/참조 성격).
- 출고 공임: 거래 확정 중심 값(영수증 매칭, 수동 오버라이드, extra item 편집, 반올림/확정 직전 동기화 포함).

출고 쪽이 실제 장부 반영 기준이 되는 이유:

- 확정 전 라인 업데이트에서 `p_base_labor_krw`, `p_extra_labor_krw`, `p_extra_labor_items`를 재전송 (`web/src/app/(app)/shipments/page.tsx:2349`).
- 확정 RPC 호출 직전 현재 라인의 중량/차감/공임을 한 번 더 동기화 (`web/src/app/(app)/shipments/page.tsx:2295`).

따라서 운영적으로 "카탈로그 표시값"과 "출고 확정값"은 분리해서 이해해야 하며, 정산/미수 기준은 출고 확정값이다.

---

## 4) 요구사항 4: 출고확정 -> AR 기록 -> 결제 정합성(SOT)

### 4-1. 프론트 확정 체인

- 출고 확정 RPC: `shipmentConfirm -> cms_fn_confirm_shipment_v3_cost_v1` (`web/src/lib/contracts.ts:97`).
- 확정 후 AR 재동기화 RPC: `arInvoiceResyncFromShipment -> cms_fn_ar_create_from_shipment_confirm_v1` (`web/src/lib/contracts.ts:124`).
- 이후 정합성 API로 즉시 비교 검증: `/api/check-shipment-ar-consistency` (`web/src/app/(app)/shipments/page.tsx:2508`).

### 4-2. 서버 확정/AR 생성 체인

- `cms_fn_confirm_shipment_v3_cost_v1` 내부에서 다음 순서 수행:
  1) `cms_fn_confirm_shipment`
  2) 수리비/원가/룰 보정/수리라인 동기화
  3) `cms_fn_ar_create_from_shipment_confirm_v1`
  (`supabase/migrations/20260211055010_cms_0426_repair_line_total_sync_before_ar.sql:139`, `supabase/migrations/20260211055010_cms_0426_repair_line_total_sync_before_ar.sql:169`).

- `cms_fn_confirm_shipment`는 idempotent/backfill 가드 후 `SHIPMENT` 엔트리 미존재 시에만 `cms_ar_ledger` insert 수행 (`supabase/migrations/20260213195959_cms_0600_bundle_bom_rollup_pricing.sql:833`, `supabase/migrations/20260213195959_cms_0600_bundle_bom_rollup_pricing.sql:847`).
- 이미 확정된 경우 `already_confirmed=true`로 반환하는 경로가 존재한다 (`supabase/migrations/20260213195959_cms_0600_bundle_bom_rollup_pricing.sql:865`).

### 4-3. AR invoice 재생성/보정 idempotency

- `cms_fn_ar_create_from_shipment_confirm_v1`는 `shipment_line_id` 기준으로 기존 `cms_ar_invoice` 존재 여부를 검사하고, 없을 때만 insert한다 (`supabase/migrations/20260211054010_cms_0425_repair_material_receivable_fix.sql:187`, `supabase/migrations/20260211054010_cms_0425_repair_material_receivable_fix.sql:211`).

### 4-4. 결제(FIFO)와 AR ledger 반영

- `cms_fn_ar_apply_payment_fifo_v3`는 `idempotency_key` 필수이며 중복 key면 `duplicate=true`를 반환한다 (`supabase/migrations/20260211020010_cms_0413_ar_payment_fifo_target_first_v3.sql:49`, `supabase/migrations/20260211020010_cms_0413_ar_payment_fifo_target_first_v3.sql:84`).
- 결제 반영 시 `cms_ar_ledger`에 `entry_type='PAYMENT'` 음수 금액으로 기록된다 (`supabase/migrations/20260211020010_cms_0413_ar_payment_fifo_target_first_v3.sql:346`).
- AR entry type 체계: `SHIPMENT`, `PAYMENT`, `RETURN`, `OFFSET`, `ADJUST` (`supabase/migrations/20260127124308_cms_0001_types.sql:53`).

### 4-5. 정합성 체크 API 동작

- `check-shipment-ar-consistency`는
  - `cms_shipment_line.total_amount_sell_krw` 합계,
  - `cms_ar_ledger.amount_krw`(SHIPMENT) 합계
  를 비교해 `is_consistent`, `diff_krw`를 반환한다 (`web/src/app/api/check-shipment-ar-consistency/route.ts:23`, `web/src/app/api/check-shipment-ar-consistency/route.ts:32`, `web/src/app/api/check-shipment-ar-consistency/route.ts:57`).

---

## 5) 최종 판정 (SOT 관점)

현재 구현은 "AR ledger를 장부 SOT로 유지"하는 방향으로 설계되어 있다.

- 확정 단계: SHIPMENT 원장 생성(중복 방지)
- 재동기화 단계: shipment_line 기준 AR invoice upsert-like 보정
- 결제 단계: idempotency key 기반 FIFO 배분 + PAYMENT 원장 기록
- 검증 단계: shipment 합계 vs AR 합계 즉시 비교

따라서, 실무 정합성 기준은 "출고확정 값(cms_shipment_line)과 AR ledger(cms_ar_ledger)의 일치"로 정의하는 것이 타당하다.

---

## 6) 운영 리스크와 통제 권고

1. 출고 확정 직후 반드시 AR 재동기화 + 정합성 API를 표준 절차로 고정.
2. 결제 등록은 idempotency key 누락 금지(재시도 중복 방지).
3. 수동 조정(OFFSET/ADJUST) 발생 시 정합성 리포트에 별도 태그로 추적.
4. 배치 점검으로 `shipment_total_sell_krw` vs `ar_total_krw` 이탈건을 자동 알림.

---

## 7) 직원용 실무 안내 (화면/열 이름 기준)

직원은 `출고 화면(shipments)`에서 `중량(g)`, `차감중량(g)`, `기본공임`, `기타/추가공임`, `총액`을 확인/수정 후 확정한다. 확정이 끝나면 시스템은 `shipment_id` 단위로 미수원장에 `SHIPMENT` 금액을 기록하고, 이후 결제 입력 시 `PAYMENT`로 차감한다. 점검 화면(정합성 체크)은 `shipment_total_sell_krw`와 `ar_total_krw`를 직접 비교해 차이(`diff_krw`)를 보여주므로, 실무에서 값이 다를 때는 먼저 해당 `shipment_id`의 출고 라인 금액과 AR ledger 엔트리 유형(SHIPMENT/PAYMENT/ADJUST)을 순서대로 확인하면 된다.
