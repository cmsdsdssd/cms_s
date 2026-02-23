# Analysis PRD v1 운영 패키지

## 1) 게이트/원칙 고정 (GATE)
- GATE-001: 주문/출고/미수/원가 확정의 쓰기 RPC는 수정하지 않았다. 분석은 `/analysis/*` + read view/rpc만 사용한다.
- GATE-002: 신규 오브젝트 네이밍은 `cms_v_an_*`, `cms_fn_an_*`를 사용했다.
- GATE-003: 분석 모드는 URL 기반 `/analysis/*`로 고정했다.
- GATE-004: 분석 UI는 모두 read-only이며 저장/적용 버튼을 제거했다.
- GATE-005: 회귀 기준은 `test:shipments-regression`, `build`, 분석 경로 smoke로 정의했다.
- GATE-006: 기본 기간 30일, 180일 초과 경고, 대량 리스트 500 상한(페이지별) 적용.
- GATE-007: margin/floor 공식은 Help 섹션으로 노출.
- GATE-008: 핵심 테이블 row는 Evidence JSON 접근 가능.
- GATE-009: 운영 화면 링크는 새 탭 이동을 기본 정책으로 적용.
- GATE-010: QA 증거 문서는 본 파일과 `analysisPRD-implementation-checklist.md`에 기록.

## 2) 사전 분석 결과 (DISC)
- 사이드바/헤더/팔레트 분기 지점: `web/src/components/layout/nav-items.ts`, `web/src/components/layout/sidebar-nav.tsx`, `web/src/components/layout/global-top-bar.tsx`, `web/src/components/layout/command-palette.tsx`
- 분석 연계 대상: `web/src/app/(app)/shipments_analysis/page.tsx` (analysis 래핑 경로 제공)
- React Query 패턴: queryKey를 모듈+필터 조합으로 분리 (`analysis-*` 키군)
- CSV/필터/테이블 재사용: `web/src/components/analysis/analysis-common.tsx`로 공통화
- 운영 deep-link 정책: row 단위 `app_link` 제공, anchor 대신 화면 링크 기준으로 통일
- DB 접근 권한: migration에서 view select/rpc execute를 `authenticated, service_role`에 grant

## 3) DB/마이그레이션 운영 노트
- 적용 migration: `supabase/migrations/20260223103000_cms_0800_analysis_mode_v1_addonly.sql`
- 적용 커맨드: `npx supabase db push --yes`
- remote 반영 확인: `npx supabase migration list`에서 `20260223103000` local/remote 일치
- ADD-ONLY 원칙: 기존 객체 drop/rewrite 없이 view/function/index 신규 추가
- 롤백 전략: 기능 비활성은 UI 경로 차단(analysis nav off) + 후속 down migration(별도 파일) 방식

## 4) 품질/검증 (Q + TEST)
- 자동 검증:
  - `npm run test:shipments-regression` 통과 (11/11)
  - `npm run build` 통과 (analysis 경로 포함)
  - 변경 파일 대상 eslint 통과: `npx eslint src/app/(app)/analysis/**/*.tsx ...`
  - 변경 파일 대상 LSP diagnostics 0 error
- UI 품질:
  - 180일 초과 경고 배너 적용
  - 로딩 스켈레톤, 빈 상태, 에러 메시지 통일
  - Copy link, CSV export, Read-only badge, freshness badge 적용
  - 키보드 접근성 기본 적용(label/aria/evidence pre)

## 5) 배포/롤아웃 (REL)
- REL-001: 단계적 노출(analysis nav로만 진입)
- REL-002: 1차 사용자: 운영총괄, 출고 담당, 미수 담당, 영업 리드
- REL-003: 사용자 가이드: 본 문서 + 체크리스트 문서를 가이드 1페이지로 사용
- REL-004: 릴리즈 노트 핵심: "업무 쓰기 로직 미변경, 분석 read-only 분리"
- REL-005: 1~2주 피드백 항목: 오탐률, 사용빈도, 링크 클릭률, 평균 응답시간
- REL-006: 주간 KPI 루틴: 누수 탐지 건수/정합성 이슈 감소 추이/추천 클릭률
- REL-007: false positive 보정: leak_type 규칙과 reco 가중치 파라미터 조정
- REL-008: 장애 대응: DB 성능 저하 시 기간 제한/limit 축소/분석 nav 임시 차단

## 6) DOD 판정
- DOD-001~DOD-010 충족 기준:
  - 5모듈+overview 라우트 구현
  - 모드 토글/네비/last-path 구현
  - read-only 정책 UI/DB에서 강제
  - add-only migration + push 완료
  - 테스트/빌드/diagnostics 통과
  - 가이드/근거/링크/재사용 구조 반영

## 7) v2 백로그 설계 초안
- V2-001: ProfitGuard 적용 버튼은 권한/RBAC/승인 프로세스 포함한 2단계 apply로 설계
- V2-002: Integrity Auto-Fix는 dry-run -> impact preview -> apply 3단계로 설계
- V2-003: SalesPriority 콜리스트는 task 엔티티 생성 + 담당자 SLA 연계
- V2-004: Recommendation 주문/견적 연동은 quote prefill API와 연결
- V2-005: ML 실험은 feature store(거래처/모델/시세) + offline eval + shadow 배포로 설계
