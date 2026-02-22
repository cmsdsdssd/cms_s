# 주문→결제 정합성 심층 분석 보고서 (AR SOT)

작성일: 2026-02-22

## 1) 분석 범위

- 주문 -> 공장발주 -> 영수증/매칭 -> 매칭확정(출고대기) -> 출고확정 -> 미수(AR) -> 결제
- 중점 확인:
  - 영수증/매칭 시 중량/공임 반영 방식
  - 매칭확정 이후 shipment prefill 정합성
  - 출고확정 시 소재비/공임 계산 및 AR 생성 체인
  - 원장 SOT 기준 미수/결제 정합성
  - 소수점/반올림 정책 일관성
  - 결제/원장 기록의 snapshot/불변성 보장

## 2) 핵심 결론

- 현재 체인은 `출고확정 -> AR invoice 생성 -> ledger sync -> consistency verify -> lock` 순으로 강화되어, 과거 대비 정합성이 크게 개선됨.
- 확정 이후 수정/되돌리기(unconfirm) 차단, 결제 후 재동기화 제한, lock 이후 ledger 불일치 예외 처리 등 불변성 가드가 다층으로 적용됨.
- 실무적으로는 AR SOT 운용이 가능한 상태이나, 주문 업서트 `v6` SQL 본문이 현재 리포에서 직접 확인되지 않아 주문단 초기 입력 강제 규칙의 100% 증명은 보류.

## 3) 단계별 데이터 체인 검증

### A. 주문 -> 공장발주

- 주문 업서트 호출 경로: `web/src/app/api/order-upsert/route.ts`
  - `cms_fn_upsert_order_line_v6` 호출, 미존재 시 v3 fallback.
- 공장발주 생성 핵심 RPC: `cms_fn_factory_po_create_from_order_lines`
  - `cms_order_line.factory_po_id`를 생성된 PO로 업데이트.

근거:
- `web/src/app/api/order-upsert/route.ts:216`
- `supabase/migrations/20260202110100_cms_0301_factory_po_rpc.sql:89`

### B. 영수증/매칭 -> 매칭확정

- 매칭확정 UI 호출: `receiptLineMatchConfirm` RPC
- 매칭 추천 API: `cms_fn_receipt_line_match_suggest_v1`
- 매칭 리스트 API: `cms_receipt_line_match` + 관련 조회 뷰 조합

근거:
- `web/src/app/(app)/new_receipt_line_workbench/receipt-line-workbench.tsx:1499`
- `web/src/app/(app)/new_receipt_line_workbench/receipt-line-workbench.tsx:3712`
- `web/src/app/api/new-receipt-workbench/match-suggest/route.ts:31`
- `web/src/app/api/new-receipt-workbench/matches/route.ts:55`

### C. prefill에서 중량/공임/스냅샷 반영

- prefill API는 최신 confirmed match를 읽고 labor snapshot 생성 후 hash까지 계산.
- stone labor는 qty x unit_cost 방식으로 계산.
- snapshot 소스(`SHIPMENT_LINE`/`RECEIPT_MATCH`)와 policy meta를 함께 내려 UI hydration에 사용.

근거:
- `web/src/app/api/shipment-receipt-prefill/route.ts:220`
- `web/src/app/api/shipment-receipt-prefill/route.ts:242`
- `web/src/app/api/shipment-receipt-prefill/route.ts:279`
- `web/src/lib/shipments-prefill-snapshot.js:137`

### D. 매칭확정 SQL 정책(v6 policy v2)

- base labor: receipt 기본공임 + master margin(양수는 100원 단위 올림)
- stone/plating/absorb bucket 라우팅 후 extra labor item 구성
- 최종 shipment line 업데이트로 반영

근거:
- `supabase/migrations/20260219193000_cms_0607_receipt_match_confirm_v6_absorb_bucket_routing_addonly.sql:201`
- `supabase/migrations/20260219193000_cms_0607_receipt_match_confirm_v6_absorb_bucket_routing_addonly.sql:203`
- `supabase/migrations/20260219193000_cms_0607_receipt_match_confirm_v6_absorb_bucket_routing_addonly.sql:299`
- `supabase/migrations/20260219193000_cms_0607_receipt_match_confirm_v6_absorb_bucket_routing_addonly.sql:437`

### E. 출고확정 직전 값 고정 + 출고확정 체인

- 출고확정 직전에 현재 라인의 deduction/base/extra를 재저장해 UI 편집값을 최종 반영.
- 확인 후 `shipmentConfirm` RPC 호출.
- 최신 confirm 체인은 AR invoice 생성을 먼저 수행한 후 ledger sync/verify/lock 수행.

근거:
- `web/src/app/(app)/shipments/page.tsx:3644`
- `web/src/app/(app)/shipments/page.tsx:3849`
- `supabase/migrations/20260222085500_cms_0716_ar_ledger_invoice_alignment_for_repair_addonly.sql:344`
- `supabase/migrations/20260222085500_cms_0716_ar_ledger_invoice_alignment_for_repair_addonly.sql:345`
- `supabase/migrations/20260222085500_cms_0716_ar_ledger_invoice_alignment_for_repair_addonly.sql:346`

### F. AR/결제 불변성 및 SOT

- lock 이후 shipment line update 차단.
- unconfirm 차단.
- AR invoice는 결제 할당 존재 시 재동기화 차단.
- lock 이후 ledger 값 불일치 시 예외.
- 결제 FIFO는 idempotency key 필수, duplicate payment 방지.
- 서비스 완불은 invoice_outstanding vs ledger_outstanding mismatch 시 강제 중단.

근거:
- `supabase/migrations/20260221154000_cms_0709_shipment_immediate_lock_safe_fix_addonly.sql:491`
- `supabase/migrations/20260221154000_cms_0709_shipment_immediate_lock_safe_fix_addonly.sql:586`
- `supabase/migrations/20260221155500_cms_0710_immediate_lock_hardening_addonly.sql:51`
- `supabase/migrations/20260222085500_cms_0716_ar_ledger_invoice_alignment_for_repair_addonly.sql:81`
- `supabase/migrations/20260211020010_cms_0413_ar_payment_fifo_target_first_v3.sql:49`
- `supabase/migrations/20260222133000_cms_0725_service_writeoff_actor_fk_and_sot_guard.sql:94`

## 4) 소수점/반올림 검토

- UI/prefill 일부는 100원 올림(`ceil/100`) 사용.
- AR/결제 경로는 KRW 0자리 반올림, 금/은 g 값은 6자리 정밀도 사용.
- AR verify에서 `eps=0.5` 허용 오차로 미세 반올림 차이를 흡수하되, 임계 초과는 예외 처리.

근거:
- `web/src/app/api/shipment-receipt-prefill/route.ts:37`
- `web/src/lib/shipments-prefill-snapshot.js:7`
- `supabase/migrations/20260211020010_cms_0413_ar_payment_fifo_target_first_v3.sql:24`
- `supabase/migrations/20260222085500_cms_0716_ar_ledger_invoice_alignment_for_repair_addonly.sql:182`

## 5) 리스크/보류 포인트

1. 주문 업서트 `v6` 함수 본문 미확인(호출부만 확인): 주문단 입력강제 규칙 100% 증명 보류.
2. API 단순 체크(`Math.round`)는 DB verify 함수 대비 약함(운영 참고용).
3. 수동 override 프로세스는 의도적 변경을 허용하므로 운영 통제 필요.

근거:
- `web/src/app/api/order-upsert/route.ts:216`
- `web/src/app/api/check-shipment-ar-consistency/route.ts:57`
- `web/src/app/(app)/shipments/page.tsx:2983`

## 6) 업무 흐름 예시

- 예시: 은 925 제품 1건
  1) 영수증 라인 입력 -> 매칭 제안/확정
  2) prefill snapshot으로 중량/공임/알공임/도금 반영
  3) 출고 화면 저장 + 확정 직전 라인 재저장
  4) 출고확정 RPC 실행
  5) AR invoice 생성 -> ledger sync -> verify -> lock
  6) 결제 FIFO 적용 -> payment alloc + ledger PAYMENT 반영

## 7) 요구사항 적용 상태 표

| 질문 포인트 | 현재 상태 | 근거 |
|---|---|---|
| 영수증/매칭 시 중량/공임 반영 | 적용됨 | `web/src/app/api/shipment-receipt-prefill/route.ts:123` |
| 매칭확정 prefill 재사용 | 적용됨 | `web/src/app/api/shipment-receipt-prefill/route.ts:279` |
| 출고확정 시 소재비/공임 반영 | 적용됨 | `supabase/migrations/20260221154000_cms_0709_shipment_immediate_lock_safe_fix_addonly.sql:535` |
| AR SOT 기준 미수 생성 | 적용됨 | `supabase/migrations/20260222085500_cms_0716_ar_ledger_invoice_alignment_for_repair_addonly.sql:344` |
| 결제가 AR 기준으로 배분 | 적용됨 | `supabase/migrations/20260211020010_cms_0413_ar_payment_fifo_target_first_v3.sql:213` |
| Snapshot/lock 이후 불변성 | 적용됨 | `supabase/migrations/20260221154000_cms_0709_shipment_immediate_lock_safe_fix_addonly.sql:494` |
| 소수점으로 인한 대규모 드리프트 방지 | 적용됨(허용오차+검증) | `supabase/migrations/20260222085500_cms_0716_ar_ledger_invoice_alignment_for_repair_addonly.sql:233` |
| 완불 시 SOT mismatch 차단 | 적용됨 | `supabase/migrations/20260222133000_cms_0725_service_writeoff_actor_fk_and_sot_guard.sql:94` |
