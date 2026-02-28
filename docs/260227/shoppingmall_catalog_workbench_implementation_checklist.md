# 쇼핑몰 Catalog-Style 워크벤치 구현 체크리스트

- 기준 문서:
  - `docs/260227/shoppingmall_catalog_workbench_prd_addendum.md`
  - `docs/260227/shoppingmall_catalog_workbench_erd_addendum.md`
- 체크 상태 규칙:
  - [x] 완료
  - [ ] 미완료

---

## 0) 현재 상태 스냅샷 (이미 구현된 기반)

- [x] `BASE-001` 채널/계정/OAuth 흐름 구현됨 (`/api/shop-oauth/cafe24/*`)
- [x] `BASE-002` pull/recompute/push API 구현됨
- [x] `BASE-003` `v_channel_price_dashboard` 기반 대시보드 조회 구현됨
- [x] `BASE-004` 선택 체크박스 + 일괄 push UI 구현됨
- [x] `BASE-005` 10분 cron 엔드포인트(`/api/cron/shop-sync`) 구현됨
- [x] `BASE-006` 동기화 job/job_item 로그 조회 UI 구현됨

## 0-1) Catalog 패턴 조사 결과

- [x] `DISC-WB-001` 기준 엔트리 확인: `web/src/app/(app)/catalog/page.tsx`
- [x] `DISC-WB-002` 상단 액션 컴포넌트 확인: `web/src/components/layout/action-bar.tsx`
- [x] `DISC-WB-003` 리스트/상세 레이아웃 확인: `web/src/components/layout/split-layout.tsx`
- [x] `DISC-WB-004` 테이블형 대안 확인: `web/src/app/(app)/factory_po_history/_components/PoList.tsx`

---

## 1) DB 확장

- [ ] `WB-DB-001` `shop_e_factor_source` enum 추가
- [ ] `WB-DB-002` `shop_e_batch_preview_status` enum 추가
- [ ] `WB-DB-003` `pricing_snapshot.factor_source` 컬럼 추가
- [ ] `WB-DB-004` `pricing_snapshot.policy_id_used` 컬럼 추가
- [ ] `WB-DB-005` `pricing_snapshot.is_auto_run` 컬럼 추가
- [ ] `WB-DB-006` `price_sync_job.change_set_id` 컬럼 추가
- [ ] `WB-DB-007` `price_sync_job.preview_excluded_count` 컬럼 추가
- [ ] `WB-DB-008` `price_sync_preview` 테이블 생성
- [ ] `WB-DB-009` `price_sync_preview_item` 테이블 생성
- [ ] `WB-DB-010` `v_channel_price_summary` 뷰 생성
- [ ] `WB-DB-011` `v_channel_price_dashboard_workbench` 뷰 생성

---

## 2) 백엔드 API

- [ ] `WB-API-001` `GET /api/channel-price-summary?channel_id=...` 추가
- [ ] `WB-API-002` `GET /api/channel-price-dashboard` 정렬 파라미터 확장(`sort_by`, `sort_order`)
- [ ] `WB-API-003` `GET /api/channel-price-dashboard` 필터 확장(`diff_min`, `only_failed`)
- [ ] `WB-API-004` `POST /api/channel-prices/preview-push` 추가
- [ ] `WB-API-005` preview 결과를 `price_sync_preview*`에 저장
- [ ] `WB-API-006` `POST /api/channel-prices/push`에 `preview_id` 연결
- [ ] `WB-API-007` push 성공 시 `change_set_id` 생성/저장
- [ ] `WB-API-008` push 응답에 성공/실패/제외 건수 포함
- [ ] `WB-API-009` `/api/cron/shop-sync` 실행분 `is_auto_run=true` 저장

---

## 3) 프론트엔드 Workbench UI

### 3.1 Summary
- [ ] `WB-FE-001` 상단 Summary 카드 영역 추가(시세/기준값/freshness)
- [ ] `WB-FE-002` Summary scope 라벨("현재 필터 기준") 명시
- [ ] `WB-FE-003` Summary skeleton 로딩 상태 적용

### 3.2 Filters + Sorting
- [ ] `WB-FE-004` diff 임계값 필터 입력 추가
- [ ] `WB-FE-005` 실패만 필터 추가
- [ ] `WB-FE-006` diff_krw 정렬 UI 추가
- [ ] `WB-FE-007` diff_pct 정렬 UI 추가
- [ ] `WB-FE-008` computed_at 정렬 UI 추가

### 3.3 Table + Batch mode
- [ ] `WB-FE-009` 숫자 컬럼 우측 정렬 + tabular 적용
- [ ] `WB-FE-010` 페이지네이션 기본 20건 적용
- [ ] `WB-FE-011` 선택 시 batch action bar 노출
- [ ] `WB-FE-012` batch mode 중 row 단일 액션 비활성화
- [ ] `WB-FE-013` 전체선택/해제 UX 개선(현재페이지/전체필터 구분)

### 3.4 Preview + Push
- [ ] `WB-FE-014` push 전 preview 모달 추가
- [ ] `WB-FE-015` preview READY/EXCLUDED 분리표시
- [ ] `WB-FE-016` exclusion_code/exclusion_message 가독성 표기
- [ ] `WB-FE-017` preview 확인 후 push 실행 흐름 연결
- [ ] `WB-FE-018` 완료 후 `change_set_id` 토스트/상세 표시

### 3.5 Drawer
- [ ] `WB-FE-019` row 클릭 Drawer 오픈
- [ ] `WB-FE-020` 산식 breakdown 섹션 표시
- [ ] `WB-FE-021` adjustment CRUD 섹션 연결
- [ ] `WB-FE-022` override CRUD 섹션 연결
- [ ] `WB-FE-023` 최근 pull/push 에러 상세 섹션 표시

---

## 4) fallback/source 가시성

- [ ] `WB-FB-001` row에 factor source(global/channel/item/system) 뱃지 표시
- [ ] `WB-FB-002` summary에 active factor set source 표시
- [ ] `WB-FB-003` channel policy 미존재 시 global default fallback 명시
- [ ] `WB-FB-004` settings 기본값(요구사항)과 계산값 일치 검증 쿼리 작성

---

## 5) 운영/검증

- [ ] `WB-QA-001` LSP diagnostics 0 에러 확인(수정 파일 전체)
- [ ] `WB-QA-002` `web` 타입/빌드 성공
- [ ] `WB-QA-003` preview -> push E2E 수동 점검(성공/제외/실패 케이스)
- [ ] `WB-QA-004` cron 실행 후 summary freshness 반영 확인
- [ ] `WB-QA-005` audit/log에 민감정보 노출 없음 확인

---

## 6) 사용자 액션 필요 항목

- [ ] `WB-OPS-001` 운영 환경에 최신 코드 배포
- [ ] `WB-OPS-002` Cloud Run revision env/secret 반영 재확인
- [ ] `WB-OPS-003` Scheduler 강제 실행 후 Cloud Run 로그 공유
- [ ] `WB-OPS-004` Cafe24 실제 테스트몰 상품 5~10건으로 preview/push 검증

---

## 7) 완료 게이트

- [ ] `WB-DONE-001` PRD addendum 항목 구현 매핑 완료
- [ ] `WB-DONE-002` ERD addendum 컬럼/테이블/뷰 반영 완료
- [ ] `WB-DONE-003` 미완료 체크 0건
- [ ] `WB-DONE-004` 운영 재현 경로(요약 문서 + 증적 로그) 확보
