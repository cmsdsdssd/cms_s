# Draft: Shipments Order Search Filters

## Requirements (confirmed)
- Shipments 주문검색 기본 필터를 "미출고만" + `is_store_pickup = false`로 설정.
- `is_store_pickup` 필터는 UI 라벨을 "매장출고"로 표시.
- `is_store_pickup`은 토글 on/off 제공, 기본값은 OFF.
- 필터를 OR/AND로 엮어 볼 수 있는 조건(연산자)도 추가 필요.

## Technical Decisions
- 대상 화면: `/shipments` 주문검색(주문 선택 모달/패널) 기본 필터에서 적용.
- 기존 기본값 `onlyReadyToShip = true` 유지하고 여기에 `is_store_pickup = false` 추가.
- 매장출고 필터 기준: 주문검색 쿼리에서 최신 `cms_shipment_header.is_store_pickup` 조인(없으면 false).
- AND/OR 토글은 "미출고만"+"매장출고" 조합에만 적용, 검색어는 항상 AND.
- 테스트 전략: 자동화 테스트 없음, 에이전트 실행 QA 시나리오 포함.

## Research Findings
- `/web/src/app/(app)/shipments/page.tsx`에서 주문검색 상태: `onlyReadyToShip`(default true), `searchQuery`, `debouncedQuery`.
- 주문검색 결과 필터링은 `filteredLookupRows`에서 `onlyReadyToShip`로 상태 필터.
- `is_store_pickup` 필드는 `cms_shipment_header`에 존재(기본 false). UI 라벨은 기존에 "매장출고"로 사용 중.
- `is_store_pickup` 사용 위치: `/web/src/app/(app)/shipments/page.tsx`, `inline-shipment-panel`, `shipments_print`, `workbench` 등.
- `shipments_main` 등 워크벤치형 화면에서 AND/OR 토글 패턴(`filterOperator`)이 존재.
- `/web/src/app/api/order-lookup/route.ts`는 검색어 `q`를 여러 필드에 OR(ilike)로 적용.
- 디자인 시스템은 Tailwind 기반 커스텀; 전용 Switch 컴포넌트 없음(checkbox/버튼 토글 패턴 사용).
- 테스트 인프라: `web/package.json`에 Playwright 의존성은 있으나 설정/테스트 파일 없음. `supabase/tests/` SQL 회귀 테스트와 `web/scripts/contract-tests.mjs`, `web/src/scripts/check-db-consistency.ts` 같은 스크립트 기반 검증 존재.

## Open Questions
- "주문검색" 적용 범위가 `/shipments`의 주문 lookup(모달/패널)만인지, `/shipments_main`의 미출고 목록 필터까지 포함인지 확인 필요.
- OR/AND 조건은 어떤 필터 조합에 적용할지(미출고/매장출고/검색어 등) 확정 필요.
- `is_store_pickup=false` 기본 필터는 API 쿼리(`/api/order-lookup`)에 포함할지, 클라이언트 필터로 처리할지 결정 필요.

## Scope Boundaries
- INCLUDE: `/shipments` 주문검색 기본 필터와 필터 UI 토글 추가.
- INCLUDE: `/shipments_main` 미출고 목록 필터에도 동일한 기본 필터/토글 적용.
- EXCLUDE: 출고 확정/저장 로직 변경, 기존 매장출고 저장/확정 플로우 변경.
