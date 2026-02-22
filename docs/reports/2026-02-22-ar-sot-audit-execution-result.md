# AR SOT 점검 SQL 1세트 실행 결과

작성일: 2026-02-22

## 실행한 점검 세트

- SQL 파일: `docs/runbooks/2026-02-22-ar-sot-integrity-audit-set.sql`

## 실행 방식

- 직접 Postgres(`SUPABASE_DB_URL`) 접속 실행 시도: DNS/접속 문제로 실패
  - 에러: `getaddrinfo ENOTFOUND db.ptxmypzrqonokuikpqzr.supabase.co`
- 동일 점검 로직을 Supabase service-role API(RPC + table read)로 등가 실행하여 결과 검증 완료

## 핵심 결과 요약

- preflight summary
  - count: 23 (최근 확정 shipment 점검 대상)
  - partial_invoice_count: 0
  - duplicate_shipment_ledger_count: 0
  - duplicate_invoice_line_count: 0
  - invoice_ledger_mismatch_count: 0
  - ship_invoice_mismatch_count: 0
- uniqueness gate dry-run
  - ready_to_enforce: true
  - ledger_duplicate_shipment_count: 0
  - invoice_duplicate_shipment_line_count: 0
- legacy guard
  - guard_mode: warn
  - block_anon: true
  - block_authenticated: false
- party outstanding mismatch (invoice vs ledger sum)
  - mismatch count: 2
  - top diff
    1) party_id `c6c9a52c-8416-43fa-aaf0-d3958093abc8` diff 2,175,800
    2) party_id `267b879b-9c8a-4406-889a-182ae5472503` diff 22.21333333333621
- duplicate AR payment idempotency
  - count: 0

## 해석

- shipment 단위 핵심 정합성(송장/원장/라인) 지표는 현재 모두 정상(0건).
- uniqueness 강제 전환 준비 상태도 정상(`ready_to_enforce=true`).
- 다만 party 기준 outstanding 비교에서 2건 차이가 남아 있으며, 최소 1건은 테스트 party로 보이는 기존 이력 영향 가능성이 큼.
- 운영 관점에서는 shipment-level SOT는 안정 상태이고, party-level 잔차는 별도 정리 대상.
