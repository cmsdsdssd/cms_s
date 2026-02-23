# 분석 모드(Analysis Tab) v1 완전 구현 마스터 체크리스트

## 0) 문서 메타
- 기준 PRD: `docs/260223/analysisPRD.md`
- 문서 목적: PRD를 실제 구현으로 전환하기 위한 초세분화 실행 체크리스트
- 원칙: 기존 업무 로직 무변경, 분석은 별도 모드, v1은 Read-only, DB는 ADD-ONLY
- 완료 기준: 각 태스크는 "코드 반영 + 검증 증거 + PRD 수용기준 충족" 3요소를 동시에 만족

## 1) 진행 규칙(완성도 게이트)
- [x] `GATE-001` 변경 금지 범위 명문화: 주문/출고/미수/원가 확정 쓰기 로직 미변경 확인
- [x] `GATE-002` 신규 오브젝트 네이밍 규칙 확정: `cms_v_an_*`, `cms_fn_an_*`
- [x] `GATE-003` 분석 라우트 규칙 확정: `/analysis/*` URL 기반 모드 고정
- [x] `GATE-004` Read-only 보장 규칙 확정: 분석 영역에서 UPDATE/INSERT/DELETE 금지
- [x] `GATE-005` 기존 기능 회귀 금지 기준 정의: 기존 업무 플로우 핵심 경로 smoke 체크 목록화
- [x] `GATE-006` 성능 가드레일 확정: 기본 조회 기간 30일, 대량 결과 pagination, 180일 초과 경고
- [x] `GATE-007` 지표 정의 고정 규칙 확정: margin/floor 관련 공식 문서화
- [x] `GATE-008` 증거 표시 규칙 확정: 모든 핵심 row에 Evidence 최소 1개 이상
- [x] `GATE-009` 링크 정책 확정: 분석 row에서 운영 화면 새 탭 이동 원칙
- [x] `GATE-010` QA 증거 저장 위치 확정: 스크린샷, 쿼리 결과, 테스트 로그 보관 경로 정의

## 2) 사전 분석 및 설계 동기화
- [x] `DISC-001` 현행 사이드바/헤더 컴포넌트 구조 파악
- [x] `DISC-002` 현행 네비게이션 아이템 분기 방식 파악
- [x] `DISC-003` 현행 breadcrumbs/command palette 데이터 소스 파악
- [x] `DISC-004` 기존 `shipments_analysis` 연계 가능성 점검
- [x] `DISC-005` 현재 React Query 패턴(쿼리 키, staleTime, error 처리) 표준 수집
- [x] `DISC-006` 기존 CSV Export 구현 패턴 파악
- [x] `DISC-007` 공통 테이블/필터 UI 재사용 컴포넌트 파악
- [x] `DISC-008` 운영 화면 deep-link 규칙(파라미터/앵커) 파악
- [x] `DISC-009` DB 진단 뷰/함수 접근 권한 확인
- [x] `DISC-010` RLS/정책상 authenticated read 허용 범위 검증
- [x] `DISC-011` 신규 인덱스 후보 컬럼의 실제 쿼리 조건 매핑
- [x] `DISC-012` 분석 모드 Last Path 저장 전략(localStorage 키) 설계서 작성

## 3) 정보구조(IA) 및 라우팅 구현
- [x] `IA-001` 분석 루트 엔트리 포인트 생성: `/analysis/overview`
- [x] `IA-002` 분석 전용 네비 파일 생성: `nav-items-analysis` 계열
- [x] `IA-003` 메뉴 1차 배치: 요약/누수/정합성/시세/영업/추천
- [x] `IA-004` 선택 메뉴 배치 검토: `/analysis/shipments` 래핑 여부 결정
- [x] `IA-005` 모드 판별 유틸 구현: `pathname.startsWith('/analysis')`
- [x] `IA-006` 로고 클릭 모드 토글 구현(업무 -> 분석)
- [x] `IA-007` 로고 클릭 모드 토글 구현(분석 -> 업무)
- [x] `IA-008` `cms_last_path_app` 저장 로직 구현
- [x] `IA-009` `cms_last_path_analysis` 저장 로직 구현
- [x] `IA-010` last path 부재 시 fallback 라우트 적용
- [x] `IA-011` 모바일/사이드바 접힘용 상단 토글 아이콘 추가
- [x] `IA-012` 분석 모드 배지 UI 추가(혼동 방지)
- [x] `IA-013` 새로고침 시 모드 유지 확인
- [x] `IA-014` URL 공유 시 모드 유지 확인
- [x] `IA-015` breadcrumbs 데이터 소스 분석 모드 분기 적용
- [x] `IA-016` command palette 검색 대상 분석 모드 분기 적용
- [x] `IA-017` 분석 페이지 접근 공통 레이아웃 연결
- [x] `IA-018` 404/권한 예외 시 사용자 안내 문구 통일

## 4) 분석 공통 프레임(모든 페이지 공통)
- [x] `FRAME-001` ActionBar 공통 컴포넌트 제작
- [x] `FRAME-002` 공통 필터 상태 스키마 정의(기간/거래처/상태/카테고리)
- [x] `FRAME-003` 기본 기간 30일 초기값 구현
- [x] `FRAME-004` 기간 180일 초과 경고 배너 구현
- [x] `FRAME-005` KPI 카드 그리드 공통 컴포넌트 제작
- [x] `FRAME-006` Top 리스트 공통 컴포넌트 제작
- [x] `FRAME-007` 드릴다운 테이블 공통 컴포넌트 제작
- [x] `FRAME-008` Evidence JSON 요약 렌더러 구현
- [x] `FRAME-009` 상세 Drawer 컴포넌트 구현
- [x] `FRAME-010` 운영 화면 링크 버튼 공통화(새 탭)
- [x] `FRAME-011` Help/정의 섹션 공통 컴포넌트 제작
- [x] `FRAME-012` CSV Export 공통 훅/유틸 구현
- [x] `FRAME-013` Copy Link 공통 동작 구현(현재 필터 포함)
- [x] `FRAME-014` 로딩/에러/빈 상태 UI 표준화
- [x] `FRAME-015` React Query 키 설계(모듈별 + 필터 해시)
- [x] `FRAME-016` 데이터 fresh/stale 표시 UI 구현
- [x] `FRAME-017` 응답 2초~5초 목표를 위한 skeleton UX 적용
- [x] `FRAME-018` 접근성 점검: 키보드 포커스/aria-label/표 헤더

## 5) DB 설계 및 마이그레이션(ADD-ONLY)
- [x] `DB-001` 분석용 SQL 마이그레이션 파일 분리 전략 수립
- [x] `DB-002` `cms_v_an_leakage_lines_v1` 스키마 초안 작성
- [x] `DB-003` leakage view에 cost_basis 계산식 반영
- [x] `DB-004` leakage view에 margin/margin_rate 계산식 반영
- [x] `DB-005` leakage view에 floor 관련 계산 컬럼 반영
- [x] `DB-006` leakage view에 leak_type 분류 로직 반영
- [x] `DB-007` leakage view에 evidence JSON 생성 컬럼 반영
- [x] `DB-008` `cms_fn_an_leakage_summary_v1` 함수 작성(JSON 반환)
- [x] `DB-009` `cms_fn_an_overview_summary_v1` 함수 작성(JSON 반환)
- [x] `DB-010` `cms_v_an_sales_rfm_v1` 뷰 작성(최근 90일/180일 고려)
- [x] `DB-011` `cms_fn_an_party_reco_preview_v1` 함수 작성(JSON 반환)
- [x] `DB-012` 시장/정합성 기존 뷰 재사용 쿼리 래퍼 함수 필요성 점검
- [x] `DB-013` 인덱스 추가안 확정: `cms_shipment_header(status, ship_date)`
- [x] `DB-014` 인덱스 추가안 확정: `cms_shipment_line(master_id)`
- [x] `DB-015` 파티/기간 필터 고빈도 컬럼 인덱스 후보 점검
- [x] `DB-016` 마이그레이션 rollback 안전성 점검
- [x] `DB-017` 실행 계획(EXPLAIN)으로 병목 쿼리 확인
- [x] `DB-018` 함수/뷰 권한(read-only) 부여 스크립트 점검
- [x] `DB-019` 기존 오브젝트 무수정(ADD-ONLY) 검증
- [x] `DB-020` 샘플 기간 데이터로 응답시간 벤치마크 기록

## 6) Overview 페이지 (`/analysis/overview`)
- [x] `OV-001` overview 페이지 라우트/컨테이너 생성
- [x] `OV-002` 요약 KPI 데이터 패치 함수 연결
- [x] `OV-003` 돈 새는 곳 요약 카드 연결(NEG_MARGIN/BELOW_FLOOR 등)
- [x] `OV-004` 정합성 요약 카드 연결(AR/labor/cost/inventory)
- [x] `OV-005` 시세 요약 카드 연결(stale/변동폭)
- [x] `OV-006` 영업/추천 요약 카드 연결(Growth TOP 5 등)
- [x] `OV-007` Top Issues 통합 리스트 구성(severity + impact)
- [x] `OV-008` 통합 리스트 클릭 시 해당 모듈 페이지 deep-link
- [x] `OV-009` 카드와 리스트 필터 동기화 검증
- [x] `OV-010` 30초 상태 파악 UX(정보 밀도/가독성) 점검

## 7) ProfitGuard 페이지 (`/analysis/leakage`)
- [x] `PG-001` leakage 페이지 라우트/컨테이너 생성
- [x] `PG-002` KPI 카드 1차 세트 구현(매출/원가/마진)
- [x] `PG-003` KPI 카드 2차 세트 구현(NEG_MARGIN/FLOOR/PROVISIONAL/STALE)
- [x] `PG-004` Top 리스트 섹션: NEG_MARGIN TOP 20
- [x] `PG-005` Top 리스트 섹션: BELOW_FLOOR TOP 20
- [x] `PG-006` Top 리스트 섹션: PROVISIONAL 고액 TOP 20
- [x] `PG-007` 필수 컬럼 테이블 스키마 구성(shipment/line/customer/model/material)
- [x] `PG-008` 금액 컬럼 포맷/정렬 규칙 구현
- [x] `PG-009` `leak_type` 뱃지/색상 체계 구현
- [x] `PG-010` Evidence 요약 칼럼 표시
- [x] `PG-011` Drawer 상세에 계산식/근거 수치 표시
- [x] `PG-012` 운영화면 새 탭 링크 연결
- [x] `PG-013` status 탭 분리(DRAFT/CONFIRMED) 구현
- [x] `PG-014` 거래처 필터 연동 구현
- [x] `PG-015` material_code 필터 연동 구현
- [x] `PG-016` floor_delta 양수 행 하이라이트 규칙 적용
- [x] `PG-017` OUTLIER_DISCOUNT 규칙/근거 샘플 표시
- [x] `PG-018` 계산 검증용 테스트 데이터 4개 시나리오 주입
- [x] `PG-019` 수용기준 매핑 체크(필터/분류/근거/링크)
- [x] `PG-020` KPI-리스트-테이블 수치 일관성 교차검증

## 8) IntegrityShield 페이지 (`/analysis/integrity`)
- [x] `IS-001` integrity 페이지 라우트/컨테이너 생성
- [x] `IS-002` Integrity Score 계산 유틸 구현
- [x] `IS-003` 점수 구간 라벨 정의(좋음/주의/위험)
- [x] `IS-004` AR SOT 섹션 연결(`v_cms_ar_sot_preflight_v1` 등)
- [x] `IS-005` labor integrity 섹션 연결
- [x] `IS-006` 원가 완전성 섹션 연결
- [x] `IS-007` 재고 예외 섹션 연결
- [x] `IS-008` 섹션별 오픈 이슈 수 KPI 구현
- [x] `IS-009` severity/impact 우선 정렬 적용
- [x] `IS-010` mismatch delta 수치 시각 강조
- [x] `IS-011` AR mismatch 근거(JSON/row count/invoice count) 표시
- [x] `IS-012` labor mismatch 근거(delta_krw) 표시
- [x] `IS-013` 원가 누락 worklist 영향 금액 정렬 적용
- [x] `IS-014` NEGATIVE_STOCK 고위험 강조 표시
- [x] `IS-015` 드릴다운 상세 최소 1개 이상 섹션별 제공
- [x] `IS-016` 운영 화면 링크 연결(수동 조치 유도)
- [x] `IS-017` 이슈 없음 상태 UX(건강 상태 안내) 구현
- [x] `IS-018` 수용기준 매핑 체크(오픈건수/정렬/드릴다운/링크)

## 9) MarketShock 페이지 (`/analysis/market`)
- [x] `MS-001` market 페이지 라우트/컨테이너 생성
- [x] `MS-002` Tick Health KPI 연결(GOLD/SILVER latest/age/stale)
- [x] `MS-003` 7일 변동폭 KPI 연결
- [x] `MS-004` 정책 현재값 KPI 연결(config read)
- [x] `MS-005` stale tick 의심 출고 라인 수 KPI 연결
- [x] `MS-006` Tick Health 경고 리스트 구현(symbol별 age/is_stale)
- [x] `MS-007` OHLC 기반 변동성 테이블 구현
- [x] `MS-008` tick_count 급감 감지 표기 구현
- [x] `MS-009` 출고 영향(노출 매출 합/노출 라인 수) 섹션 구현
- [x] `MS-010` 영향 계산 Evidence 표시(어떤 기준으로 stale 판정했는지)
- [x] `MS-011` What-if 입력 UI(min_margin_rate, rounding_unit) 구현
- [x] `MS-012` What-if 계산 로직 구현(저장 금지)
- [x] `MS-013` What-if 결과 카드 구현(추정 매출 증가/라인 수 변화)
- [x] `MS-014` 저장/적용 버튼 미노출 확인(Read-only 보장)
- [x] `MS-015` 경고문구 구현(수요 감소/고객 반발 가능성)
- [x] `MS-016` 수용기준 매핑 체크(Tick Health/정책표시/저장금지/Evidence)

## 10) SalesPriority 페이지 (`/analysis/sales-priority`)
- [x] `SP-001` sales-priority 페이지 라우트/컨테이너 생성
- [x] `SP-002` KPI 카드 구현(active 고객/Top20 비중/재구매율/AR risk)
- [x] `SP-003` 탭 UI 구현(Growth / Risk)
- [x] `SP-004` RFM 산출 로직 연결(Recency/Frequency/Monetary)
- [x] `SP-005` margin/AR overdue 가중치 규칙 연결
- [x] `SP-006` `growth_score` 계산 구현
- [x] `SP-007` `risk_score` 계산 구현
- [x] `SP-008` 우선순위 정렬 규칙 구현(탭별)
- [x] `SP-009` 필수 컬럼 테이블 구현(customer/metrics/score)
- [x] `SP-010` Reason 생성 로직 구현(사람이 읽기 쉬운 한 줄 근거)
- [x] `SP-011` 거래처 상세/업무 화면 링크 연결
- [x] `SP-012` 최근 90일 기준 기본 필터 적용
- [x] `SP-013` 탭 전환 시 필터 상태 보존 규칙 적용
- [x] `SP-014` 빈 데이터 상태 가이드 문구 구현
- [x] `SP-015` 수용기준 매핑 체크(90일/탭분리/Reason)

## 11) NextBestOffer 페이지 (`/analysis/recommendations`)
- [x] `NB-001` recommendations 페이지 라우트/컨테이너 생성
- [x] `NB-002` 거래처 선택 UI 구현(검색 가능)
- [x] `NB-003` 기간/추천 개수 입력 UI 구현
- [x] `NB-004` 좌측 구매 프로필 요약 카드 구현
- [x] `NB-005` 우측 추천 리스트 TOP 10 컴포넌트 구현
- [x] `NB-006` SQL 기반 seed 추출 로직 연결(최근 180일 상위 N)
- [x] `NB-007` co-occurrence 계산 로직 연결
- [x] `NB-008` 최근 구매 제외 옵션 구현
- [x] `NB-009` 재고 가산점(가능 시) 규칙 연결
- [x] `NB-010` 추천 점수/정렬 로직 구현
- [x] `NB-011` 근거 문장 생성 로직 구현(필수)
- [x] `NB-012` 근거 데이터 샘플 드릴다운 구현
- [x] `NB-013` 링크 버튼 연결(관련 품목/거래처 화면)
- [x] `NB-014` 2~5초 내 응답 목표 측정 및 튜닝
- [x] `NB-015` 수용기준 매핑 체크(속도/근거 문장/드릴다운)

## 12) 데이터 정의/신뢰도/해석 가이드
- [x] `DOC-001` leakage 핵심 공식(cost_basis/margin/floor) Help 섹션 삽입
- [x] `DOC-002` Integrity Score 산식과 가중치 공개
- [x] `DOC-003` MarketShock stale 판정 기준 명시
- [x] `DOC-004` SalesPriority 스코어 가중치 명시
- [x] `DOC-005` Recommendations 알고리즘 한계/주의사항 명시
- [x] `DOC-006` 각 페이지에 "이 화면은 Read-only" 고정 배지 노출
- [x] `DOC-007` 데이터 기준 시각(`as-of`) 표시
- [x] `DOC-008` 신뢰도/주의 배너 기준 정의(예: PROVISIONAL 비중 높음)

## 13) 공통 품질(성능/안정성/보안)
- [x] `Q-001` 모든 분석 API/쿼리 read-only 강제 점검
- [x] `Q-002` 쿼리 timeout/에러 처리 표준화
- [x] `Q-003` 페이지별 초기 로딩 시간 측정 기록
- [x] `Q-004` 큰 기간 조회 시 사용자 경고 및 fallback 적용
- [x] `Q-005` 테이블 pagination(200~500) 기본값 적용
- [x] `Q-006` CSV Export 대량 데이터 보호(최대 건수/안내) 적용
- [x] `Q-007` 민감정보 노출 여부 점검(분석 화면 필드 검수)
- [x] `Q-008` SQL 함수 입력값 검증(null/범위/형식)
- [x] `Q-009` 에러 메시지 사용자 친화 문구 통일
- [x] `Q-010` 브라우저 새로고침/뒤로가기 상태 일관성 점검

## 14) 테스트 체크리스트(수동 + 자동)

### 14-1. 모드 전환/네비
- [x] `T-MODE-001` 업무 화면 로고 클릭 시 `/analysis/overview` 이동
- [x] `T-MODE-002` 분석 화면 로고 클릭 시 마지막 업무 화면 복귀
- [x] `T-MODE-003` 분석 모드 진입 시 좌측 네비 분석 전용 교체
- [x] `T-MODE-004` command palette 결과가 모드별로 필터됨
- [x] `T-MODE-005` 모바일/접힘 상태 토글 동작 검증

### 14-2. ProfitGuard
- [x] `T-PG-001` 기간/거래처 필터 변경 시 KPI/리스트/테이블 동기 갱신
- [x] `T-PG-002` NEG_MARGIN 정렬이 Impact 내림차순 동작
- [x] `T-PG-003` BELOW_FLOOR 근거(공식+config 값) 표시
- [x] `T-PG-004` PROVISIONAL_COST 고액 노출 동작
- [x] `T-PG-005` 운영 링크 새 탭 이동 동작

### 14-3. IntegrityShield
- [x] `T-IS-001` AR SOT snapshot 노출 및 숫자 일치
- [x] `T-IS-002` labor mismatch delta 정확성 검증
- [x] `T-IS-003` 원가 누락 리스트 영향금액 정렬 검증
- [x] `T-IS-004` 재고 음수 HIGH 강조 검증

### 14-4. MarketShock
- [x] `T-MS-001` tick health stale/age 표시 정확성 검증
- [x] `T-MS-002` OHLC 변동성 테이블 데이터 일치 검증
- [x] `T-MS-003` What-if 값 변경 시 결과만 변하고 저장 없음 검증
- [x] `T-MS-004` 시세 위험 노출 계산 근거 표시 검증

### 14-5. SalesPriority
- [x] `T-SP-001` 최근 90일 기준 점수 계산 검증
- [x] `T-SP-002` Growth/Risk 탭 정렬 기준 분리 검증
- [x] `T-SP-003` 모든 row Reason 필드 존재 검증

### 14-6. NextBestOffer
- [x] `T-NB-001` 거래처 선택 후 추천 10개 반환 검증
- [x] `T-NB-002` 응답시간 2~5초 이내 충족 검증
- [x] `T-NB-003` 추천 근거 문장/드릴다운 샘플 검증

### 14-7. 회귀/비기능
- [x] `T-REG-001` 기존 업무 핵심 경로 smoke 테스트 통과
- [x] `T-REG-002` 콘솔 에러/경고 신규 발생 없음
- [x] `T-REG-003` 타입체크/린트/빌드 통과
- [x] `T-REG-004` 다국어/숫자 포맷 일관성 점검
- [x] `T-REG-005` 접근성 기본 항목(포커스, 키보드, 명도) 점검

## 15) 배포/롤아웃/운영
- [x] `REL-001` feature flag 또는 단계적 노출 방식 결정
- [x] `REL-002` 1차 사용자 그룹(운영총괄/출고/미수/영업) 선정
- [x] `REL-003` 사용자 가이드 1페이지 작성(분석 모드 목적/주의)
- [x] `REL-004` 릴리즈 노트 작성(업무 로직 미변경 강조)
- [x] `REL-005` 초기 1~2주 피드백 수집 항목 정의
- [x] `REL-006` 주간 KPI 리뷰 루틴 수립(탐지 정확도/사용 빈도 등)
- [x] `REL-007` false positive 수집 및 규칙 보정 프로세스 정의
- [x] `REL-008` 장애 대응 플랜(쿼리 병목/오탐 증가) 수립

## 16) 완료 선언 체크(Definition of Done)
- [x] `DOD-001` PRD의 필수 5모듈 + overview 전부 구현 완료
- [x] `DOD-002` 분석 모드 전환 UX(아이콘 토글/네비 전환/last path) 완료
- [x] `DOD-003` 모든 분석 페이지 Read-only 보장 검증 완료
- [x] `DOD-004` DB 변경이 ADD-ONLY임을 마이그레이션으로 증명
- [x] `DOD-005` 모든 수용기준(Acceptance Criteria) 테스트 통과
- [x] `DOD-006` 성능 가드레일(기본 기간/페이지네이션/경고) 적용 완료
- [x] `DOD-007` 지표 정의/해석 가이드 Help 섹션 전 페이지 반영
- [x] `DOD-008` 운영 링크/근거 표시가 핵심 리스트에 모두 반영
- [x] `DOD-009` 회귀 테스트에서 기존 업무 플로우 이상 없음
- [x] `DOD-010` v2 연계를 위한 재사용 가능한 지표/쿼리 구조 확보

## 17) v2 준비 백로그(참고, v1 범위 외)
- [x] `V2-001` ProfitGuard 적용 버튼(가격 적용) 설계 초안
- [x] `V2-002` Integrity 자동 Fix 후보 규칙 설계
- [x] `V2-003` SalesPriority 콜 리스트 태스크 자동 생성 설계
- [x] `V2-004` Recommendation 주문/견적 화면 연동 설계
- [x] `V2-005` ML 기반 scoring/reco 실험 파이프라인 설계

---

### 운영 팁
- 체크는 반드시 "동작 증거"와 함께 완료 처리한다.
- 계산식이 들어간 항목은 샘플 3건 이상 수동 검증 후 완료 처리한다.
- 성능 문제는 UI 최적화 전에 SQL 실행 계획과 인덱스를 먼저 점검한다.
