# 쇼핑몰(카페24) 가격관리 시스템 완전 구현 마스터 체크리스트

## 0) 문서 메타
- 기준 PRD: `docs/260227/shoppingmall_prd_final.md`
- 기준 ERD: `docs/260227/shoppingmall_erd_final.md`
- 목적: 체크리스트를 순서대로 수행하면 PRD/ERD 범위를 누락 없이 구현 가능하도록 초세분화
- 원칙:
  - 기존 `cms_*` 핵심 업무 로직은 파괴적 변경 금지
  - DB 마이그레이션은 add-only
  - 가격 계산은 단일 Pricing Engine SoT 사용
  - pull/push/override/정책 변경은 모두 감사 추적 가능해야 함

## 0-1) 강제 실행 원칙 (필수 준수)
- [x] `RULE-001` 구현은 반드시 본 체크리스트 항목 단위로만 진행한다. (체크리스트 외 작업 금지) (2026-02-27, @assistant, evidence: Wave1 migrations/API scaffolds)
- [x] `RULE-002` 작업 시작 시 해당 항목을 즉시 in-progress로 표시한다. (2026-02-27, @assistant, evidence: session todowrite logs)
- [x] `RULE-003` 작업 완료 시 즉시 [x] 체크 + 완료일 + 담당자 + 증거(커밋/PR/로그)를 남긴다. (2026-02-27, @assistant, evidence: this checklist update)
- [x] `RULE-004` EOD(업무 종료 시) 당일 진행분 누락 없이 체크리스트 최신화한다. (2026-02-27, @assistant, evidence: this checklist update)
- [ ] `RULE-005` 완료 선언 전 반드시 PRD/ERD/체크리스트 3중 역검증을 수행한다.

## 0-2) 완료 전 3중 역검증 게이트 (출시 전 필수)
- [ ] `VERIFY-PRD-001` PRD의 FR-001~FR-011이 구현 결과와 1:1 매핑되는지 확인
- [ ] `VERIFY-ERD-001` ERD의 엔터티/컬럼/제약/인덱스가 실제 DB와 일치하는지 확인
- [ ] `VERIFY-CHK-001` 체크리스트 미체크 항목 0건인지 확인
- [ ] `VERIFY-CHK-002` 체크된 모든 항목에 증거 링크가 있는지 확인
- [ ] `VERIFY-FINAL-001` FG-001~FG-008, DOD-001~DOD-007 전부 [x] 확인

---

## 1) 착수 게이트 (시작 전 반드시 완료)
- [ ] `GATE-001` PRD/ERD 최신 파일 존재 확인 (`shoppingmall_prd_final.md`, `shoppingmall_erd_final.md`)
- [ ] `GATE-002` 구현 브랜치 생성 및 네이밍 규칙 확정 (`feature/shop-pricing-v1` 등)
- [ ] `GATE-003` 환경 구분값 확정 (local/staging/prod)
- [ ] `GATE-004` 카페24 테스트몰 계정 준비 여부 확인
- [ ] `GATE-005` 카페24 OAuth 앱 정보 보관 위치 확정(시크릿 매니저)
- [ ] `GATE-006` RLS/권한 적용 기준 확정 (관리자/운영자/조회자)
- [ ] `GATE-007` 에러코드 표준 초안 작성 (401/409/422/429/5xx)
- [ ] `GATE-008` 시간대/날짜 기준 확정 (KST 기준, DB timestamptz)
- [ ] `GATE-009` 금액 단위 표준 확정 (KRW 정수/소수 허용 범위)
- [ ] `GATE-010` 라운딩 표준 확정 (단위, 모드)
- [ ] `GATE-011` 로그 보관 기간 정책 확정 (예: 180일/365일)
- [ ] `GATE-012` 대시보드 성능 목표값 명문화 (초기 로딩, 검색 응답)

---

## 2) 사전 분석 및 영향도 점검
- [ ] `DISC-001` 기존 `cms_master_item` 필드 유효성 샘플링(Null/범위)
- [ ] `DISC-002` `master_item_id` generated 컬럼 존재 여부 확인
- [ ] `DISC-003` `cms_master_absorb_labor_item_v1` 데이터 품질 점검 (`amount_krw`, `is_active`)
- [ ] `DISC-004` `cms_v_bom_recipe_worklist_v1` 레시피 선택 규칙 재확인
- [ ] `DISC-005` `cms_v_bom_recipe_lines_enriched_v1`에서 DECOR 식별 규칙 재확인
- [ ] `DISC-006` `cms_v_market_tick_latest_by_symbol_ops_v1` 반환 컬럼 확인
- [ ] `DISC-007` 카페24 상품 식별자 `product_no` 타입/길이/포맷 확인
- [ ] `DISC-008` 기존 material factor 관련 객체(`cms_material_factor_config`)와 충돌 위험 점검
- [ ] `DISC-009` 기존 margin 엔진(`cms_0602`, `cms_0603`)과 네임 충돌 점검
- [ ] `DISC-010` 현재 API 디렉터리 구조 확인(`web/src/app/api/*`)
- [ ] `DISC-011` 공통 인증/권한 미들웨어 적용 방식 확인
- [ ] `DISC-012` 공통 에러 응답 포맷 확인
- [ ] `DISC-013` 공통 테이블 컴포넌트/필터 컴포넌트 재사용 가능성 점검
- [ ] `DISC-014` 기존 CSV 업로드 구현 패턴 확인
- [ ] `DISC-015` 기존 백그라운드 잡 처리 패턴 확인(있다면)

---

## 3) DB 설계 반영 (ENUM)
- [x] `DB-ENUM-001` `shop_e_channel_type` 생성 마이그레이션 작성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227110000_cms_1001_shop_channel_core_addonly.sql`)
- [x] `DB-ENUM-002` `shop_e_account_status` 생성 마이그레이션 작성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227110000_cms_1001_shop_channel_core_addonly.sql`)
- [x] `DB-ENUM-003` `shop_e_rounding_mode` 생성 마이그레이션 작성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227111000_cms_1002_shop_policy_factor_addonly.sql`)
- [x] `DB-ENUM-004` `shop_e_factor_scope` 생성 마이그레이션 작성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227111000_cms_1002_shop_policy_factor_addonly.sql`)
- [x] `DB-ENUM-005` `shop_e_adjust_apply_to` 생성 마이그레이션 작성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227112000_cms_1003_shop_adjustment_override_addonly.sql`)
- [x] `DB-ENUM-006` `shop_e_adjust_stage` 생성 마이그레이션 작성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227112000_cms_1003_shop_adjustment_override_addonly.sql`)
- [x] `DB-ENUM-007` `shop_e_adjust_amount_type` 생성 마이그레이션 작성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227112000_cms_1003_shop_adjustment_override_addonly.sql`)
- [x] `DB-ENUM-008` `shop_e_sync_job_status` 생성 마이그레이션 작성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-ENUM-009` `shop_e_sync_item_status` 생성 마이그레이션 작성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-ENUM-010` `shop_e_run_type` 생성 마이그레이션 작성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-ENUM-011` `shop_e_price_state` 생성 마이그레이션 작성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227115000_cms_1006_shop_dashboard_view_addonly.sql`)
- [x] `DB-ENUM-012` `shop_e_bucket_type` 생성 마이그레이션 작성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-ENUM-013` enum 생성 idempotency 처리(`do $$ begin ... exception ... end $$`) (2026-02-27, @assistant, evidence: `cms_1001`~`cms_1006`)
- [ ] `DB-ENUM-014` enum 롤백 문서화(운영 롤백 절차 문서)

---

## 4) DB 테이블 구현 - 채널/매핑
- [x] `DB-CH-001` `sales_channel` 테이블 생성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227110000_cms_1001_shop_channel_core_addonly.sql`)
- [x] `DB-CH-002` `sales_channel.channel_code` unique 인덱스 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227110000_cms_1001_shop_channel_core_addonly.sql`)
- [x] `DB-CH-003` `sales_channel.updated_at` 자동 갱신 트리거 연결 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227110000_cms_1001_shop_channel_core_addonly.sql`)
- [x] `DB-CH-004` `sales_channel_account` 테이블 생성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227110000_cms_1001_shop_channel_core_addonly.sql`)
- [x] `DB-CH-005` `sales_channel_account.channel_id` FK 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227110000_cms_1001_shop_channel_core_addonly.sql`)
- [x] `DB-CH-006` `sales_channel_account` 채널당 1계정 unique 제약 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227110000_cms_1001_shop_channel_core_addonly.sql`)
- [x] `DB-CH-007` `sales_channel_account.status` 기본값/검증 설정 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227110000_cms_1001_shop_channel_core_addonly.sql`)
- [x] `DB-CH-008` `sales_channel_product` 테이블 생성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227110000_cms_1001_shop_channel_core_addonly.sql`)
- [x] `DB-CH-009` `sales_channel_product.master_item_id` FK 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227110000_cms_1001_shop_channel_core_addonly.sql`)
- [x] `DB-CH-010` `sales_channel_product(channel_id, external_product_no)` unique 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227110000_cms_1001_shop_channel_core_addonly.sql`)
- [x] `DB-CH-011` `sales_channel_product(channel_id, master_item_id)` 인덱스 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227110000_cms_1001_shop_channel_core_addonly.sql`)
- [x] `DB-CH-012` `sales_channel_product.mapping_source` 기본값 설정 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227110000_cms_1001_shop_channel_core_addonly.sql`)
- [x] `DB-CH-013` 매핑 테이블 활성/비활성 기본쿼리 scope 문서화 (2026-02-27, @assistant, evidence: `docs/260227/shoppingmall_migration_bundle_wave1.md`)

---

## 5) DB 테이블 구현 - 정책/Factor/조정/오버라이드
- [x] `DB-POL-001` `pricing_policy` 생성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227111000_cms_1002_shop_policy_factor_addonly.sql`)
- [x] `DB-POL-002` `pricing_policy.channel_id` FK 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227111000_cms_1002_shop_policy_factor_addonly.sql`)
- [x] `DB-POL-003` `pricing_policy.margin_multiplier >= 0` check 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227111000_cms_1002_shop_policy_factor_addonly.sql`)
- [x] `DB-POL-004` `pricing_policy.rounding_unit > 0` check 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227111000_cms_1002_shop_policy_factor_addonly.sql`)
- [x] `DB-POL-005` 채널별 활성 정책 1개 partial unique 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227111000_cms_1002_shop_policy_factor_addonly.sql`)
- [x] `DB-POL-006` `pricing_policy_rule` 생성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227111000_cms_1002_shop_policy_factor_addonly.sql`)
- [x] `DB-POL-007` `pricing_policy_rule.policy_id` FK 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227111000_cms_1002_shop_policy_factor_addonly.sql`)
- [x] `DB-POL-008` `pricing_policy_rule.priority` 기본값 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227111000_cms_1002_shop_policy_factor_addonly.sql`)
- [x] `DB-FAC-001` `material_factor_set` 생성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227111000_cms_1002_shop_policy_factor_addonly.sql`)
- [x] `DB-FAC-002` `material_factor_set.scope/channel_id` check 제약 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227111000_cms_1002_shop_policy_factor_addonly.sql`)
- [x] `DB-FAC-003` global default 1개 partial unique 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227111000_cms_1002_shop_policy_factor_addonly.sql`)
- [x] `DB-FAC-004` `material_factor_set` 업데이트 트리거 연결 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227111000_cms_1002_shop_policy_factor_addonly.sql`)
- [x] `DB-FAC-005` `material_factor` 생성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227111000_cms_1002_shop_policy_factor_addonly.sql`)
- [x] `DB-FAC-006` `material_factor.factor_set_id` FK 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227111000_cms_1002_shop_policy_factor_addonly.sql`)
- [x] `DB-FAC-007` `(factor_set_id, material_code)` unique 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227111000_cms_1002_shop_policy_factor_addonly.sql`)
- [x] `DB-FAC-008` `material_factor.multiplier > 0` check 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227111000_cms_1002_shop_policy_factor_addonly.sql`)
- [x] `DB-ADJ-001` `pricing_adjustment` 생성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227112000_cms_1003_shop_adjustment_override_addonly.sql`)
- [x] `DB-ADJ-002` `pricing_adjustment.channel_id` FK 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227112000_cms_1003_shop_adjustment_override_addonly.sql`)
- [x] `DB-ADJ-003` `pricing_adjustment.channel_product_id` FK 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227112000_cms_1003_shop_adjustment_override_addonly.sql`)
- [x] `DB-ADJ-004` `pricing_adjustment.master_item_id` FK 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227112000_cms_1003_shop_adjustment_override_addonly.sql`)
- [x] `DB-ADJ-005` `channel_product_id or master_item_id` 필수 check 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227112000_cms_1003_shop_adjustment_override_addonly.sql`)
- [x] `DB-ADJ-006` `valid_to >= valid_from` check 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227112000_cms_1003_shop_adjustment_override_addonly.sql`)
- [x] `DB-ADJ-007` adjustment 조회 인덱스(channel, product, active, valid period) 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227112000_cms_1003_shop_adjustment_override_addonly.sql`)
- [x] `DB-ADJ-008` channel_product와 channel_id 일치 검증 트리거 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227112000_cms_1003_shop_adjustment_override_addonly.sql`)
- [x] `DB-OVR-001` `pricing_override` 생성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227112000_cms_1003_shop_adjustment_override_addonly.sql`)
- [x] `DB-OVR-002` `pricing_override.channel_id/master_item_id` FK 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227112000_cms_1003_shop_adjustment_override_addonly.sql`)
- [x] `DB-OVR-003` `override_price_krw >= 0` check 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227112000_cms_1003_shop_adjustment_override_addonly.sql`)
- [x] `DB-OVR-004` override 활성 조회 인덱스 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227112000_cms_1003_shop_adjustment_override_addonly.sql`)

---

## 6) DB 테이블 구현 - 스냅샷/동기화/버킷
- [x] `DB-SNP-001` `pricing_snapshot` 생성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-SNP-002` `pricing_snapshot.channel_id` FK 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-SNP-003` `pricing_snapshot.master_item_id` FK 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-SNP-004` `pricing_snapshot.channel_product_id` FK 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-SNP-005` `pricing_snapshot.breakdown_json` default/NOT NULL 설정 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-SNP-006` `pricing_snapshot.applied_adjustment_ids` default 설정 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-SNP-007` latest 조회 인덱스(channel, master, computed_at desc) 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-SNP-008` 채널상품 기준 최신 인덱스(channel, channel_product, computed_at desc) 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-CPR-001` `channel_price_snapshot` 생성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-CPR-002` `channel_price_snapshot.channel_id` FK 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-CPR-003` `channel_price_snapshot.external_product_no` 인덱스 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-CPR-004` 최신 pull 인덱스(channel, external_product_no, fetched_at desc) 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-CPR-005` `fetch_status/http_status/error` 컬럼 기본값/검증 설정 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-JOB-001` `price_sync_job` 생성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-JOB-002` `price_sync_job.channel_id` FK 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-JOB-003` `price_sync_job.status` 기본값 RUNNING 설정 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-JOB-004` `price_sync_job` 인덱스(status, started_at) 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-JOB-005` `price_sync_job_item` 생성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-JOB-006` `price_sync_job_item.job_id` FK 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-JOB-007` `price_sync_job_item` 상태/오류 컬럼 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-JOB-008` `price_sync_job_item` 인덱스(job_id) 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-JOB-009` `price_sync_job_item` 인덱스(channel_id, master_item_id, updated_at desc) 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-BKT-001` `bucket` 생성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-BKT-002` `bucket.slug` unique 인덱스 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-BKT-003` `bucket_master_item` 생성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [x] `DB-BKT-004` `bucket_master_item` 복합 PK(bucket_id, master_item_id) 추가 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`)
- [ ] `DB-BKT-005` bucket 관련 객체를 v1에서 미사용 플래그로 문서화

---

## 7) DB View/RPC 구현
- [x] `DB-VIEW-001` `pricing_snapshot_latest` 보조뷰 생성(distinct-on or window) (2026-02-27, @assistant, evidence: `supabase/migrations/20260227114000_cms_1005_shop_latest_views_addonly.sql`)
- [x] `DB-VIEW-002` `channel_price_snapshot_latest` 보조뷰 생성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227114000_cms_1005_shop_latest_views_addonly.sql`)
- [x] `DB-VIEW-003` `v_channel_price_dashboard` 생성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227115000_cms_1006_shop_dashboard_view_addonly.sql`)
- [x] `DB-VIEW-004` dashboard view에 diff_krw 계산 반영 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227115000_cms_1006_shop_dashboard_view_addonly.sql`)
- [x] `DB-VIEW-005` dashboard view에 diff_pct 계산 반영 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227115000_cms_1006_shop_dashboard_view_addonly.sql`)
- [x] `DB-VIEW-006` dashboard view에 final_target_price 계산 반영(override 우선) (2026-02-27, @assistant, evidence: `supabase/migrations/20260227115000_cms_1006_shop_dashboard_view_addonly.sql`)
- [x] `DB-VIEW-007` dashboard view에 상태값(OK/OUT_OF_SYNC/ERROR/UNMAPPED) 반영 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227115000_cms_1006_shop_dashboard_view_addonly.sql`)
- [x] `DB-RPC-001` 활성 factor set 선택 함수 작성(채널 정책 -> 글로벌 기본 fallback) (2026-02-27, @assistant, evidence: `supabase/migrations/20260227114000_cms_1005_shop_latest_views_addonly.sql`)
- [x] `DB-RPC-002` 활성 adjustment 조회 함수 작성(유효기간/활성 필터) (2026-02-27, @assistant, evidence: `supabase/migrations/20260227114000_cms_1005_shop_latest_views_addonly.sql`)
- [x] `DB-RPC-003` 활성 override 조회 함수 작성 (2026-02-27, @assistant, evidence: `supabase/migrations/20260227114000_cms_1005_shop_latest_views_addonly.sql`)
- [ ] `DB-RPC-004` recompute 결과 저장용 upsert 함수 작성(선택)
- [ ] `DB-RPC-005` sync job 상태 집계 함수 작성(선택)

---

## 8) 권한/보안/RLS
- [ ] `SEC-001` 관리자 역할 식별 방식 확정(role/claim)
- [ ] `SEC-002` `sales_channel_account` 토큰 컬럼 읽기 제한 정책 적용
- [ ] `SEC-003` 토큰 암호화/복호화 유틸 구현 또는 외부 secret manager 연동
- [ ] `SEC-004` `pricing_policy`, `factor`, `adjustment`, `override` 쓰기 권한 관리자 제한
- [ ] `SEC-005` `push` API 관리자 제한
- [ ] `SEC-006` `pull` API 운영자 이상 제한
- [ ] `SEC-007` RLS 정책 테스트 케이스 작성(권한별 성공/실패)
- [ ] `SEC-008` 감사로그 테이블/규칙 연동(누가, 언제, 무엇을)
- [ ] `SEC-009` 민감정보 마스킹 로깅 적용
- [ ] `SEC-010` 운영/개발 환경별 API 키 분리 검증

---

## 9) Pricing Engine 구현 (서버 SoT)
- [ ] `ENG-001` `pricing-engine` 모듈 디렉터리 생성
- [ ] `ENG-002` 입력 타입 정의 (`MasterInput`, `TickInput`, `PolicyInput` 등)
- [ ] `ENG-003` 출력 타입 정의 (`PriceBreakdown`, `PriceResult`)
- [ ] `ENG-004` 순중량 계산 함수 구현
- [ ] `ENG-005` 소재 raw 계산 함수 구현
- [ ] `ENG-006` factor 적용 함수 구현
- [ ] `ENG-007` 총공임 계산 함수 구현(기본/센터/서브/도금/흡수/DECOR)
- [ ] `ENG-008` LABOR PRE adjustment 적용 함수 구현
- [ ] `ENG-009` TOTAL PRE adjustment 적용 함수 구현
- [ ] `ENG-010` 마진 적용 함수 구현
- [ ] `ENG-011` LABOR POST adjustment 적용 함수 구현
- [ ] `ENG-012` TOTAL POST adjustment 적용 함수 구현
- [ ] `ENG-013` 라운딩 함수 구현(unit/mode)
- [ ] `ENG-014` override 적용 함수 구현
- [ ] `ENG-015` breakdown_json 생성 함수 구현
- [ ] `ENG-016` 숫자 안전 처리(Null/NaN/Infinity) 구현
- [ ] `ENG-017` KRW 정수화 규칙 통일
- [ ] `ENG-018` 계산 단계별 trace id 포함
- [ ] `ENG-019` 엔진 단위테스트 작성(정상 10케이스)
- [ ] `ENG-020` 엔진 단위테스트 작성(엣지 10케이스)
- [ ] `ENG-021` 음수 adjustment 케이스 테스트
- [ ] `ENG-022` override 우선순위 테스트
- [ ] `ENG-023` factor set fallback 테스트
- [ ] `ENG-024` 라운딩 모드별 테스트(CEIL/ROUND/FLOOR)
- [ ] `ENG-025` snapshot 컬럼 매핑 테스트

---

## 10) Cafe24 Connector 구현
- [x] `CAF-001` connector 인터페이스 정의(`pullCurrentPrices`, `pushPrices`, `ensureValidAccessToken`) (2026-02-27, @assistant, evidence: `web/src/lib/shop/cafe24.ts`)
- [x] `CAF-002` API base URL 및 버전 헤더 적용 구현 (2026-02-27, @assistant, evidence: `web/src/lib/shop/cafe24.ts`)
- [x] `CAF-003` access token 만료 감지 구현 (2026-02-27, @assistant, evidence: `web/src/lib/shop/cafe24.ts`)
- [x] `CAF-004` refresh token 갱신 호출 구현 (2026-02-27, @assistant, evidence: `web/src/lib/shop/cafe24.ts`)
- [x] `CAF-005` refresh 후 신규 토큰 저장 구현 (2026-02-27, @assistant, evidence: `web/src/lib/shop/cafe24.ts`)
- [x] `CAF-006` 401 발생 시 1회 refresh 후 재시도 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/channel-prices/pull/route.ts`, `web/src/app/api/channel-prices/push/route.ts`)
- [x] `CAF-007` 429 감지 및 backoff 구현 (2026-02-27, @assistant, evidence: `web/src/lib/shop/cafe24.ts`)
- [ ] `CAF-008` usage 헤더 파싱 로직 구현
- [x] `CAF-009` pull 응답 파서 구현(product_no -> current_price) (2026-02-27, @assistant, evidence: `web/src/lib/shop/cafe24.ts`)
- [x] `CAF-010` push 요청 payload 빌더 구현 (2026-02-27, @assistant, evidence: `web/src/lib/shop/cafe24.ts`)
- [x] `CAF-011` push item별 결과 파서 구현 (2026-02-27, @assistant, evidence: `web/src/lib/shop/cafe24.ts`)
- [ ] `CAF-012` 네트워크 timeout/retry 정책 구현
- [x] `CAF-013` 원본 응답(raw_json) 저장 포맷 정의 (2026-02-27, @assistant, evidence: `web/src/app/api/channel-prices/pull/route.ts`, `web/src/app/api/channel-prices/push/route.ts`)
- [ ] `CAF-014` connector 모킹 테스트 작성

---

## 11) API 구현 - 채널/매핑
- [x] `API-CH-001` `GET /api/channels` 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/channels/route.ts`)
- [x] `API-CH-002` `POST /api/channels` 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/channels/route.ts`)
- [x] `API-CH-003` 채널 생성 입력 검증 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/channels/route.ts`)
- [ ] `API-CH-004` 채널 비활성화 API 구현(필요 시)
- [x] `API-AC-001` `GET /api/channels/:id/account` 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/channels/[id]/account/route.ts`)
- [x] `API-AC-002` `POST /api/channels/:id/account` 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/channels/[id]/account/route.ts`)
- [ ] `API-AC-003` 계정 저장 시 토큰 암호화 적용
- [ ] `API-AC-004` 계정 상태 계산 로직 구현
- [x] `API-MAP-001` `GET /api/channel-products` 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/channel-products/route.ts`)
- [x] `API-MAP-002` `POST /api/channel-products` upsert 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/channel-products/route.ts`)
- [x] `API-MAP-003` `DELETE /api/channel-products/:id` 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/channel-products/[id]/route.ts`)
- [ ] `API-MAP-004` CSV 업로드 파서 구현
- [ ] `API-MAP-005` CSV 유효성 에러 리포트 포맷 구현
- [ ] `API-MAP-006` 자동 매핑 추천 엔드포인트 구현(옵션)

---

## 12) API 구현 - 정책/Factor/Adjustment/Override
- [x] `API-POL-001` `GET /api/pricing-policies` 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/pricing-policies/route.ts`)
- [x] `API-POL-002` `PUT /api/pricing-policies/:id` 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/pricing-policies/[id]/route.ts`)
- [ ] `API-POL-003` 정책 업데이트 권한 체크 구현
- [x] `API-FAC-001` `GET /api/material-factor-sets` 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/material-factor-sets/route.ts`)
- [x] `API-FAC-002` `POST /api/material-factor-sets` 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/material-factor-sets/route.ts`)
- [x] `API-FAC-003` `PUT /api/material-factor-sets/:id` 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/material-factor-sets/[id]/route.ts`)
- [x] `API-FAC-004` global default 단일성 검증 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/material-factor-sets/route.ts`, `web/src/app/api/material-factor-sets/[id]/route.ts`)
- [x] `API-FAC-005` factor row CRUD 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/material-factor-sets/[id]/route.ts`)
- [x] `API-ADJ-001` `GET /api/pricing-adjustments` 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/pricing-adjustments/route.ts`)
- [x] `API-ADJ-002` `POST /api/pricing-adjustments` 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/pricing-adjustments/route.ts`)
- [x] `API-ADJ-003` `PUT /api/pricing-adjustments/:id` 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/pricing-adjustments/[id]/route.ts`)
- [x] `API-ADJ-004` `DELETE /api/pricing-adjustments/:id` 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/pricing-adjustments/[id]/route.ts`)
- [x] `API-ADJ-005` adjustment 입력 검증(타겟/단계/값/기간) 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/pricing-adjustments/route.ts`)
- [x] `API-OVR-001` override CRUD API 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/pricing-overrides/route.ts`, `web/src/app/api/pricing-overrides/[id]/route.ts`)
- [x] `API-OVR-002` override 유효기간 검증 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/pricing-overrides/route.ts`)

---

## 13) API 구현 - recompute/pull/push
- [x] `API-PRC-001` `POST /api/pricing/recompute` 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/pricing/recompute/route.ts`)
- [x] `API-PRC-002` recompute 대상 필터(전체/선택) 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/pricing/recompute/route.ts`)
- [x] `API-PRC-003` recompute 시 factor set override 옵션 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/pricing/recompute/route.ts`)
- [x] `API-PRC-004` recompute 결과 snapshot bulk insert 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/pricing/recompute/route.ts`)
- [x] `API-PRC-005` recompute 응답에 성공/실패 건수 반환 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/pricing/recompute/route.ts`)
- [x] `API-PULL-001` `POST /api/channel-prices/pull` 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/channel-prices/pull/route.ts`)
- [x] `API-PULL-002` pull 대상 결정(product_no/master_item_id) 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/channel-prices/pull/route.ts`)
- [x] `API-PULL-003` pull 결과 snapshot 저장 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/channel-prices/pull/route.ts`)
- [x] `API-PULL-004` pull 실패 row 저장 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/channel-prices/pull/route.ts`)
- [x] `API-PUSH-001` `POST /api/channel-prices/push` 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/channel-prices/push/route.ts`)
- [x] `API-PUSH-002` push preview 검증 로직 구현(권장가 존재/매핑 존재) (2026-02-27, @assistant, evidence: `web/src/app/api/channel-prices/push/route.ts`)
- [x] `API-PUSH-003` push job 생성 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/channel-prices/push/route.ts`)
- [x] `API-PUSH-004` push item 생성 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/channel-prices/push/route.ts`)
- [x] `API-PUSH-005` item별 Cafe24 요청 수행 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/channel-prices/push/route.ts`)
- [x] `API-PUSH-006` item별 before/after/status 저장 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/channel-prices/push/route.ts`)
- [x] `API-PUSH-007` job 집계(success/failed/skipped) 업데이트 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/channel-prices/push/route.ts`)
- [x] `API-PUSH-008` 부분 실패 시 전체 중단하지 않는 로직 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/channel-prices/push/route.ts`)
- [x] `API-JOB-001` `GET /api/price-sync-jobs` 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/price-sync-jobs/route.ts`)
- [x] `API-JOB-002` `GET /api/price-sync-jobs/:job_id` 구현 (2026-02-27, @assistant, evidence: `web/src/app/api/price-sync-jobs/[job_id]/route.ts`)

---

## 14) 백엔드 공통 품질
- [ ] `BE-QLT-001` 모든 API 입력 스키마(zod 등) 적용
- [ ] `BE-QLT-002` 공통 에러 응답 포맷 통일
- [ ] `BE-QLT-003` 요청 단위 request_id 생성/전파
- [ ] `BE-QLT-004` structured logging 적용(JSON)
- [ ] `BE-QLT-005` 민감 필드 로깅 제외 규칙 적용
- [ ] `BE-QLT-006` API timeout 기본값 적용
- [ ] `BE-QLT-007` DB 트랜잭션 경계 명시화
- [ ] `BE-QLT-008` 멱등성 키 처리(push/recompute)
- [ ] `BE-QLT-009` 대량 요청 pagination/limit 방어 적용
- [ ] `BE-QLT-010` 예외 메시지 사용자용/내부용 분리

---

## 15) 프론트엔드 IA 및 라우팅
- [x] `FE-IA-001` 사이드바에 `쇼핑몰 관리` 메뉴 추가 (2026-02-27, @assistant, evidence: `web/src/components/layout/nav-items.ts`)
- [x] `FE-IA-002` 하위 메뉴 `채널 설정` 추가 (2026-02-27, @assistant, evidence: `web/src/components/layout/nav-items.ts`)
- [x] `FE-IA-003` 하위 메뉴 `상품 매핑` 추가 (2026-02-27, @assistant, evidence: `web/src/components/layout/nav-items.ts`)
- [x] `FE-IA-004` 하위 메뉴 `가격 대시보드` 추가 (2026-02-27, @assistant, evidence: `web/src/components/layout/nav-items.ts`)
- [x] `FE-IA-005` 하위 메뉴 `동기화 로그` 추가 (2026-02-27, @assistant, evidence: `web/src/components/layout/nav-items.ts`)
- [x] `FE-IA-006` 하위 메뉴 `소재 Factor 관리` 추가 (2026-02-27, @assistant, evidence: `web/src/components/layout/nav-items.ts`)
- [ ] `FE-IA-007` 페이지 접근 권한 가드 적용
- [x] `FE-IA-008` 메뉴 active 상태/브레드크럼 연결 (2026-02-27, @assistant, evidence: `web/src/components/layout/nav-items.ts`)

---

## 16) 프론트엔드 - 채널 설정 페이지
- [x] `FE-CH-001` 채널 목록 테이블 렌더링 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/channels/page.tsx`)
- [ ] `FE-CH-002` 채널 생성 모달 구현
- [ ] `FE-CH-003` 채널 비활성 토글 구현
- [x] `FE-CH-004` 계정 정보 폼 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/channels/page.tsx`)
- [x] `FE-CH-005` access/refresh 만료시각 표시 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/channels/page.tsx`)
- [ ] `FE-CH-006` 연결 상태 배지 구현(CONNECTED/EXPIRED/ERROR)
- [x] `FE-CH-007` API 버전 입력/검증 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/channels/page.tsx`)
- [x] `FE-CH-008` 저장 성공/실패 토스트 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/channels/page.tsx`)

---

## 17) 프론트엔드 - 상품 매핑 페이지
- [ ] `FE-MAP-001` master 검색 필터 구현
- [ ] `FE-MAP-002` product_no 검색 필터 구현
- [x] `FE-MAP-003` 매핑 리스트 테이블 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/mappings/page.tsx`)
- [x] `FE-MAP-004` 매핑 생성 행 추가 UI 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/mappings/page.tsx`)
- [x] `FE-MAP-005` 매핑 삭제 액션 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/mappings/page.tsx`)
- [ ] `FE-MAP-006` CSV 업로드 버튼/드롭존 구현
- [ ] `FE-MAP-007` CSV 업로드 결과(성공/실패 row) 표시 구현
- [ ] `FE-MAP-008` CSV 다운로드 템플릿 제공 구현
- [ ] `FE-MAP-009` 자동 추천 결과 표시(옵션)
- [ ] `FE-MAP-010` 중복/누락 상태 뱃지 구현

---

## 18) 프론트엔드 - 가격 정책/Factor 페이지
- [x] `FE-POL-001` 채널 기본 정책 폼 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/factors/page.tsx`)
- [ ] `FE-POL-002` margin multiplier 입력 검증 구현
- [x] `FE-POL-003` rounding unit/mode 선택 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/factors/page.tsx`)
- [x] `FE-FAC-001` factor set 목록 테이블 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/factors/page.tsx`)
- [ ] `FE-FAC-002` factor set 생성 모달 구현
- [ ] `FE-FAC-003` factor set 상세 소재행 편집 구현
- [ ] `FE-FAC-004` global default 설정 토글 구현
- [x] `FE-FAC-005` scope GLOBAL/CHANNEL 표시 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/factors/page.tsx`)
- [ ] `FE-FAC-006` factor multiplier 입력 검증 구현
- [ ] `FE-FAC-007` 변경 이력 표시 영역(옵션) 구성

---

## 19) 프론트엔드 - 가격 대시보드(핵심)
- [x] `FE-DASH-001` 대시보드 페이지 스켈레톤 구성 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/dashboard/page.tsx`)
- [x] `FE-DASH-002` 채널 선택 드롭다운 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/dashboard/page.tsx`)
- [x] `FE-DASH-003` [현재가 불러오기] 버튼 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/dashboard/page.tsx`)
- [x] `FE-DASH-004` [재계산] 버튼 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/dashboard/page.tsx`)
- [x] `FE-DASH-005` [선택 반영] 버튼 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/dashboard/page.tsx`)
- [ ] `FE-DASH-006` quick policy edit UI 구현
- [ ] `FE-DASH-007` factor 시뮬레이션 드롭다운 구현(저장 없음)
- [x] `FE-DASH-008` 테이블 컬럼 정의 PRD 기준 반영 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/dashboard/page.tsx`)
- [ ] `FE-DASH-009` diff_krw 정렬 구현
- [ ] `FE-DASH-010` diff_pct 정렬 구현
- [ ] `FE-DASH-011` 필터(차액 임계값) 구현
- [ ] `FE-DASH-012` 필터(소재) 구현
- [ ] `FE-DASH-013` 필터(중량 범위) 구현
- [x] `FE-DASH-014` 필터(에러만) 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/dashboard/page.tsx`)
- [x] `FE-DASH-015` 필터(오버라이드만) 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/dashboard/page.tsx`)
- [x] `FE-DASH-016` 필터(adjustment만) 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/dashboard/page.tsx`)
- [x] `FE-DASH-017` 멀티 선택 체크박스 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/dashboard/page.tsx`)
- [x] `FE-DASH-018` 전체 선택/해제 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/dashboard/page.tsx`)
- [ ] `FE-DASH-019` 상태 배지(OK/OUT_OF_SYNC/ERROR/UNMAPPED) 구현
- [ ] `FE-DASH-020` 금액 포맷터 일관화 구현
- [ ] `FE-DASH-021` 빈 상태/로딩 상태/에러 상태 구현

---

## 20) 프론트엔드 - 대시보드 상세 Drawer
- [ ] `FE-DRW-001` 행 클릭 Drawer 오픈 구현
- [ ] `FE-DRW-002` 소재 breakdown(raw/factor/final) 표시
- [ ] `FE-DRW-003` 총공임 breakdown 표시
- [ ] `FE-DRW-004` adjustment 목록 표시
- [ ] `FE-DRW-005` adjustment 추가 폼 인라인 제공
- [ ] `FE-DRW-006` adjustment 수정 액션 제공
- [ ] `FE-DRW-007` adjustment 비활성/삭제 액션 제공
- [ ] `FE-DRW-008` override 정보 표시
- [ ] `FE-DRW-009` override 추가/해제 액션 제공
- [ ] `FE-DRW-010` 최근 pull/push 로그 표시
- [ ] `FE-DRW-011` 에러 메시지 상세 펼침 구현
- [ ] `FE-DRW-012` 복사 가능한 debug payload 표시(옵션)

---

## 21) 프론트엔드 - 동기화 로그 페이지
- [x] `FE-LOG-001` job 목록 테이블 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/sync-jobs/page.tsx`)
- [ ] `FE-LOG-002` job 상태 필터 구현
- [ ] `FE-LOG-003` run type 필터 구현
- [ ] `FE-LOG-004` 기간 필터 구현
- [x] `FE-LOG-005` job 상세 Drawer/페이지 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/sync-jobs/page.tsx`)
- [x] `FE-LOG-006` item별 결과 테이블 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/sync-jobs/page.tsx`)
- [ ] `FE-LOG-007` 실패 row 강조 표시 구현
- [x] `FE-LOG-008` 오류코드/메시지 표시 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/sync-jobs/page.tsx`)
- [x] `FE-LOG-009` before/after 가격 컬럼 표시 구현 (2026-02-27, @assistant, evidence: `web/src/app/(app)/settings/shopping/sync-jobs/page.tsx`)

---

## 22) 배치/스케줄 (선택)
- [ ] `SCH-001` 재계산 스케줄 필요성 확정
- [ ] `SCH-002` pull 스케줄 필요성 확정
- [ ] `SCH-003` 스케줄 실행 권한/계정 확정
- [ ] `SCH-004` 스케줄 실패 알림 채널 설정
- [ ] `SCH-005` 스케줄 잡 idempotency 적용

---

## 23) 감사로그/운영로그
- [ ] `AUD-001` 정책 변경 audit 기록 구현
- [ ] `AUD-002` factor 변경 audit 기록 구현
- [ ] `AUD-003` adjustment 변경 audit 기록 구현
- [ ] `AUD-004` override 변경 audit 기록 구현
- [ ] `AUD-005` pull 실행 audit 기록 구현
- [ ] `AUD-006` push 실행 audit 기록 구현
- [ ] `AUD-007` audit 조회 API/화면 필요 여부 확정

---

## 24) 테스트 - 유닛
- [ ] `UT-001` net_weight 계산 테스트
- [ ] `UT-002` material factor 적용 테스트
- [ ] `UT-003` labor calculation(흡수/장식 포함) 테스트
- [ ] `UT-004` LABOR PRE/POST adjustment 테스트
- [ ] `UT-005` TOTAL PRE/POST adjustment 테스트
- [ ] `UT-006` margin 적용 테스트
- [ ] `UT-007` rounding unit/mode 테스트
- [ ] `UT-008` override 우선 적용 테스트
- [ ] `UT-009` factor fallback(global default) 테스트
- [ ] `UT-010` adjustment 유효기간 필터 테스트
- [ ] `UT-011` snapshot mapping 테스트
- [ ] `UT-012` Cafe24 connector 401->refresh->retry 테스트
- [ ] `UT-013` Cafe24 connector 429 backoff 테스트
- [ ] `UT-014` API validation 에러 테스트

---

## 25) 테스트 - 통합
- [ ] `IT-001` 채널 생성 -> 계정 저장 플로우 테스트
- [ ] `IT-002` 매핑 CSV 업로드 -> 조회 플로우 테스트
- [ ] `IT-003` factor set 생성 -> 정책 연결 -> recompute 테스트
- [ ] `IT-004` adjustment 등록 -> recompute 반영 테스트
- [ ] `IT-005` override 등록 -> final_target 반영 테스트
- [ ] `IT-006` pull 실행 -> channel_price_snapshot 저장 테스트
- [ ] `IT-007` push 실행 -> job/job_item 저장 테스트
- [ ] `IT-008` push 부분 실패 처리 테스트
- [ ] `IT-009` dashboard view 데이터 정합 테스트
- [ ] `IT-010` 권한별 API 접근 제어 테스트

---

## 26) 테스트 - E2E(운영 시나리오)
- [ ] `E2E-001` 시나리오A: 자사몰 channel factor 1.03 적용 후 diff 확인
- [ ] `E2E-002` 시나리오B: global factor 교체 후 다채널 영향 확인(채널 1개라도 경로 검증)
- [ ] `E2E-003` 시나리오C: 특정 상품 LABOR -5000 조정 후 결과 검증
- [ ] `E2E-004` 시나리오D: 특정 상품 TOTAL POST +9900 적용 검증
- [ ] `E2E-005` 시나리오E: override 적용/해제 검증
- [ ] `E2E-006` 시나리오F: bulk push 성공 케이스 검증
- [ ] `E2E-007` 시나리오G: bulk push 일부 실패 케이스 검증
- [ ] `E2E-008` 시나리오H: 토큰 만료 중 pull/push 자동복구 검증

---

## 27) 성능 점검
- [ ] `PERF-001` dashboard 초기 로딩 시간 측정
- [ ] `PERF-002` 필터 변경 응답 시간 측정
- [ ] `PERF-003` recompute 100/500/1000건 실행 시간 측정
- [ ] `PERF-004` push 100건 배치 처리 시간 측정
- [ ] `PERF-005` 최신 뷰 쿼리 explain analyze 수집
- [ ] `PERF-006` 인덱스 효과 전후 비교
- [ ] `PERF-007` 병목 쿼리 최적화 적용 및 재측정

---

## 28) 배포 준비
- [ ] `REL-001` 마이그레이션 dry-run(local) 성공
- [ ] `REL-002` 마이그레이션 dry-run(staging) 성공
- [ ] `REL-003` 환경변수 템플릿 업데이트
- [ ] `REL-004` 운영 시크릿 주입 절차 문서화
- [ ] `REL-005` 릴리즈 노트 작성
- [ ] `REL-006` 롤백 플랜 작성(DB/API/UI)
- [ ] `REL-007` 운영자 가이드(채널연결/매핑/재계산/push) 작성
- [ ] `REL-008` 장애 대응 플레이북(401/429/5xx) 작성

---

## 29) 최종 검증 게이트 (출시 직전)
- [ ] `FG-001` PRD 기능요건 FR-001~FR-011 모두 매핑 완료
- [ ] `FG-002` ERD 엔터티/제약/인덱스 구현 완료
- [ ] `FG-003` 핵심 시나리오 E2E 전부 pass
- [ ] `FG-004` 보안 점검(pass): 토큰 평문 노출 없음
- [ ] `FG-005` 관측성 점검(pass): request_id/job_id 추적 가능
- [ ] `FG-006` 문서 점검(pass): 운영 가이드/장애 가이드 최신화
- [ ] `FG-007` 미해결 이슈 목록 및 우선순위 명시
- [ ] `FG-008` go-live 승인 기록 완료

---

## 30) 완료 정의 (Definition of Done)
- [ ] `DOD-001` 기능: 대시보드에서 권장가/현재가/차액/상태 확인 가능
- [ ] `DOD-002` 기능: factor(글로벌/채널), adjustment(공임/총액, 전/후), override 완전 반영
- [ ] `DOD-003` 기능: pull/push 및 로그 추적 가능
- [ ] `DOD-004` 품질: 계산 결과 재현 가능(snapshot 기반)
- [ ] `DOD-005` 품질: 권한/보안/감사 요구 충족
- [ ] `DOD-006` 품질: 성능 목표 충족
- [ ] `DOD-007` 문서: 운영/장애/릴리즈 문서 완료
