# 쇼핑몰 구현 3중 역검증 리포트 (PRD/ERD/체크리스트)

- 기준 시각: 2026-02-27
- 기준 문서:
  - `docs/260227/shoppingmall_prd_final.md`
  - `docs/260227/shoppingmall_erd_final.md`
  - `docs/260227/shoppingmall_implementation_master_checklist.md`

---

## 1) 구현 반영 요약

이번 세션에서 실제 반영한 항목:

1. DB Wave1 마이그레이션 8개 추가
- `supabase/migrations/20260227110000_cms_1001_shop_channel_core_addonly.sql`
- `supabase/migrations/20260227111000_cms_1002_shop_policy_factor_addonly.sql`
- `supabase/migrations/20260227112000_cms_1003_shop_adjustment_override_addonly.sql`
- `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`
- `supabase/migrations/20260227114000_cms_1005_shop_latest_views_addonly.sql`
- `supabase/migrations/20260227115000_cms_1006_shop_dashboard_view_addonly.sql`
- `supabase/migrations/20260227116000_cms_1007_shop_security_grants_addonly.sql`
- `supabase/migrations/20260227117000_cms_1008_shop_seed_and_smoke_addonly.sql`

2. 백엔드 API 라우트 구현
- 채널/계정
  - `web/src/app/api/channels/route.ts`
  - `web/src/app/api/channels/[id]/account/route.ts`
- 매핑
  - `web/src/app/api/channel-products/route.ts`
  - `web/src/app/api/channel-products/[id]/route.ts`
- 정책/팩터/조정/오버라이드
  - `web/src/app/api/pricing-policies/route.ts`
  - `web/src/app/api/pricing-policies/[id]/route.ts`
  - `web/src/app/api/material-factor-sets/route.ts`
  - `web/src/app/api/material-factor-sets/[id]/route.ts`
  - `web/src/app/api/pricing-adjustments/route.ts`
  - `web/src/app/api/pricing-adjustments/[id]/route.ts`
  - `web/src/app/api/pricing-overrides/route.ts`
  - `web/src/app/api/pricing-overrides/[id]/route.ts`
- 계산/동기화
  - `web/src/app/api/pricing/recompute/route.ts`
  - `web/src/app/api/channel-prices/pull/route.ts`
  - `web/src/app/api/channel-prices/push/route.ts`
  - `web/src/app/api/price-sync-jobs/route.ts`
  - `web/src/app/api/price-sync-jobs/[job_id]/route.ts`
- 공통 유틸
  - `web/src/lib/shop/admin.ts`

3. 체크리스트 최신화
- 완료 항목 체크 + 증거 파일 경로 반영
- 강제 원칙(`RULE-*`) 및 3중 검증 게이트(`VERIFY-*`) 반영

---

## 2) PRD 기준 검증

## 2.1 충족(완료)
- FR-001 채널 설정 API 구현 완료
- FR-002 상품 매핑 CRUD API 구현 완료
- FR-003 정책 관리 API 구현 완료
- FR-004 Factor Set API 구현 완료(세트 생성/수정 + factor rows upsert)
- FR-005 Adjustment CRUD API 구현 완료
- FR-006 재계산 API 구현 완료(대상 필터, factor set override, snapshot bulk insert, 요약 응답)
- FR-007 Pull API 구현 완료(Cafe24 HTTP 호출 + 401 재시도 + 429 backoff + snapshot 저장)
- FR-008 Push API 구현 완료(job/item 생성, item별 push/검증조회, 부분실패 허용, job 집계)
- FR-010 동기화 로그 조회 API 구현 완료

## 2.2 부분 충족(추가 구현 필요)
- FR-009 통합 대시보드 UI는 1차 구현 완료(필터/테이블/액션), 단 상세 Drawer/고급필터/정렬 일부 미완
- FR-011 bucket 상세페이지 연동 미구현(테이블만 확보)
- Cafe24 OAuth refresh endpoint/method의 공식 문서 예시가 불완전하여, 현재 구현(`POST /api/v2/oauth/token`)에 대한 실계정 E2E 검증 필요

---

## 3) ERD 기준 검증

## 3.1 충족(완료)
- ERD의 핵심 엔터티 생성 완료
  - `sales_channel`, `sales_channel_account`, `sales_channel_product`
  - `pricing_policy`, `pricing_policy_rule`
  - `material_factor_set`, `material_factor`
  - `pricing_adjustment`, `pricing_override`
  - `pricing_snapshot`, `channel_price_snapshot`
  - `price_sync_job`, `price_sync_job_item`
  - `bucket`, `bucket_master_item`
- latest helper view + dashboard view 생성 완료
  - `pricing_snapshot_latest`
  - `channel_price_snapshot_latest`
  - `v_channel_price_dashboard`
- 핵심 인덱스/제약/트리거 추가 완료

## 3.2 부분 충족(추가 구현 필요)
- RLS를 역할별로 세밀하게 완성/검증하는 단계는 추가 필요
- 운영 기준 데이터 암호화(토큰 필드 실암호화) 구현은 별도 보안 작업 필요

---

## 4) 체크리스트 기준 검증

## 4.1 이번 세션에서 완료 처리한 대표 항목
- `DB-ENUM-001`~`DB-ENUM-013`
- `DB-CH-001`~`DB-CH-013`
- `DB-POL-001`~`DB-POL-008`
- `DB-FAC-001`~`DB-FAC-008`
- `DB-ADJ-001`~`DB-ADJ-008`
- `DB-OVR-001`~`DB-OVR-004`
- `DB-SNP-001`~`DB-SNP-008`
- `DB-CPR-001`~`DB-CPR-005`
- `DB-JOB-001`~`DB-JOB-009`
- `DB-BKT-001`~`DB-BKT-004`
- `DB-VIEW-001`~`DB-VIEW-007`
- `DB-RPC-001`~`DB-RPC-003`
- `API-CH-001`~`API-CH-003`
- `API-AC-001`, `API-AC-002`
- `API-MAP-001`~`API-MAP-003`
- `API-POL-001`, `API-POL-002`
- `API-FAC-001`~`API-FAC-005`
- `API-ADJ-001`~`API-ADJ-005`
- `API-OVR-001`~`API-OVR-002`
- `API-PRC-001`~`API-PRC-005`
- `API-PULL-001`~`API-PULL-004`
- `API-PUSH-001`~`API-PUSH-008`
- `API-JOB-001`, `API-JOB-002`
- `CAF-001`~`CAF-007`, `CAF-009`~`CAF-011`, `CAF-013`
- `FE-IA-001`~`FE-IA-006`, `FE-IA-008`
- `FE-CH-001`, `FE-CH-004`, `FE-CH-005`, `FE-CH-007`, `FE-CH-008`
- `FE-MAP-003`~`FE-MAP-005`
- `FE-POL-001`, `FE-POL-003`, `FE-FAC-001`, `FE-FAC-005`
- `FE-DASH-001`~`FE-DASH-005`, `FE-DASH-008`, `FE-DASH-014`~`FE-DASH-018`
- `FE-LOG-001`, `FE-LOG-005`, `FE-LOG-006`, `FE-LOG-008`, `FE-LOG-009`

## 4.2 미완료 핵심 항목 (완벽 구현을 위해 필수)
- 보안 심화(`SEC-*`): 토큰 실암호화, 역할별 권한/RLS 검증
- 엔진 구조화(`ENG-*`): 계산 엔진 모듈 분리 및 테스트 보강
- Frontend 잔여(`FE-*`): CSV, Drawer, 고급 필터/정렬, 로그 필터, 권한 가드
- 테스트(`UT-*`, `IT-*`, `E2E-*`) 전반
- 성능(`PERF-*`) 및 릴리즈(`REL-*`) 전반
- 최종 게이트(`FG-*`, `DOD-*`) 전부

---

## 5) 기술 검증 결과

- TypeScript/빌드 검증:
  - `web`에서 `npm run build` 3회 성공
  - 새 API 라우트가 Next route manifest에 정상 등재됨
- LSP 진단:
  - 신규 TS 파일 diagnostics: no error
- 참고:
  - `.md`는 LSP 미지원 환경이라 문법 진단 불가
  - 신규 SQL 마이그레이션은 실제 DB apply 검증이 아직 필요

---

## 6) 현재 결론

- "설계 -> 핵심 DB/API/Cafe24 연결 + FE 1차" 단계까지는 완료됐다.
- 현재 상태는 운영 직전이 아니라 "베타 구현" 단계이며, 보안/테스트/성능/운영검증이 남아 있다.
- 다음 실행 우선순위:
  1) Wave1 마이그레이션 실제 apply(local/staging) + smoke query
  2) Cafe24 실계정 E2E 검증(토큰 refresh, pull/push 성공/실패 케이스)
  3) FE 미완 항목(`FE-DRW-*`, CSV, 로그/대시보드 고급 필터) 완료
  4) `SEC-*`, `UT/IT/E2E`, `PERF-*`, `REL-*`, `FG/DOD` 순차 완료
