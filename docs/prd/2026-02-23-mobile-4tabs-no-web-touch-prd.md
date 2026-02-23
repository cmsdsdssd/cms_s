# 모바일 4탭(홈 제외) 전용 구현 PRD

작성일: 2026-02-23  
작성자: OpenCode

## 1) 배경과 목표

현재 모바일 네비게이터 5탭은 `출고 | 카탈로그 | 홈 | 미수 | 설정`이며, 실제 탭 정의는 `web/src/components/layout/mobile-tabs.ts`에 있습니다.  
요청사항은 **홈 탭을 제외한 4개 탭(출고/카탈로그/미수/설정)을 모바일에서 보기 좋게 재구현**하되, **기존 웹 화면/컴포넌트는 수정하지 않는 것**입니다.

핵심 목표:

- 기존 웹 업무 화면(`web/src/app/(app)/**`, `web/src/components/**`)을 건드리지 않는다.
- 모바일은 전용 화면 계층으로 분리해 깨짐(가림, 비가시, 과밀 테이블, 좌우 분할 고정폭)을 해소한다.
- 네비게이터의 5탭 정보 구조는 유지하되, 본 PRD 구현 범위는 홈 제외 4탭으로 제한한다.

## 2) 현황 진단 (근거)

### 2.1 모바일 5탭 소스

- `web/src/components/layout/mobile-tabs.ts:25`
  - 출고: `/shipments_main`
  - 카탈로그: `/catalog`
  - 홈: `/dashboard`
  - 미수: `/ar/v2`
  - 설정: `/me`

### 2.2 깨짐 원인 패턴

1. **데스크톱 전제 2패널 고정 레이아웃**
   - `web/src/app/(app)/ar/v2/page.tsx:1285` (`h-[calc(100vh-4rem)] overflow-hidden` + `w-80` 좌측 패널)
   - `web/src/app/(app)/ap/page.tsx:608` (`h-[calc(100vh-4rem)] overflow-hidden` + `w-80` 좌측 패널)
   - `web/src/app/(app)/settings/page.tsx:1205` (`h-[calc(100vh-4rem)] overflow-hidden` + `w-80` 좌측 패널)

2. **초광폭 표/그리드 기반 화면**
   - `web/src/app/(app)/shipments_main/page.tsx:883` (10열 고정형 그리드 헤더)
   - `web/src/app/(app)/shipments_main/page.tsx:909` (10열 고정형 본문 행)

3. **카탈로그는 gallery는 상대적으로 양호하나 list는 split 기반**
   - `web/src/app/(app)/catalog/page.tsx:7306` (`view === "list"`일 때 `SplitLayout`)
   - `web/src/app/(app)/catalog/page.tsx:7329` (`view === "gallery"` 반응형 카드 그리드)

4. **하단 네비게이션 보정이 일부 페이지만 적용됨**
   - `web/src/app/globals.css:216`~`223`에서 특정 root id만 높이 보정
   - 즉, 페이지별 예외 대응이 누적되는 구조이며 확장성이 낮음

## 3) 범위

### 3.1 In Scope (이번 PRD)

- 출고 탭 모바일 전용 화면
- 카탈로그 탭 모바일 전용 화면 (gallery 중심)
- 미수 탭 모바일 전용 화면 (거래처미수/공장미수)
- 설정 탭 모바일 전용 화면 (`/me` + `/settings` 대체 UX)

### 3.2 Out of Scope

- 홈 탭 개선 (요청에 따라 제외)
- 기존 웹 데스크톱 화면 리팩토링
- 기존 업무 로직/DB 스키마 수정

## 4) 비기능 원칙 (중요)

1. **웹 코드 비수정 원칙**
   - 금지: 기존 웹 페이지/컴포넌트 파일 내용 변경
   - 허용: 모바일 전용 신규 파일 추가, 모바일 라우팅 게이트 추가

2. **모바일 전용 계층 분리 원칙**
   - 신규 네임스페이스: `web/src/mobile/**`, `web/src/app/(m)/**`
   - 기존 `web/src/app/(app)/**`는 읽기 전용(참조만)

3. **기능 동등성보다 사용성 우선 원칙**
   - 모바일에서는 핵심 태스크(조회/선택/저장) 중심으로 화면 단순화
   - 고급 관리 기능은 단계적 노출(드릴다운)

## 5) 목표 아키텍처 (웹 비수정형)

## 5.1 라우팅 전략

- 모바일 진입 시 기존 탭 경로를 모바일 전용 경로로 리다이렉트
  - `/shipments_main` -> `/m/shipments`
  - `/shipments_history` -> `/m/shipments/history`
  - `/catalog` -> `/m/catalog`
  - `/ar/v2` -> `/m/receivables/ar`
  - `/ap` -> `/m/receivables/ap`
  - `/me` -> `/m/settings`
  - `/settings` -> `/m/settings/advanced`

- 구현 위치(인프라): `web/src/middleware.ts`에 모바일 라우팅 게이트 확장
  - 기존 인증 가드 유지
  - 모바일 조건(UA + viewport 힌트 + opt-in 쿠키) 기반 분기

## 5.2 신규 구조

```text
web/src/mobile/
  shipments/
    ShipmentsMobileScreen.tsx
    ShipmentsHistoryMobileScreen.tsx
  catalog/
    CatalogMobileScreen.tsx
  receivables/
    ArMobileScreen.tsx
    ApMobileScreen.tsx
  settings/
    SettingsMobileScreen.tsx
    SettingsAdvancedMobileScreen.tsx
  shared/
    MobilePage.tsx
    MobileSection.tsx
    MobileStickyActions.tsx
    MobileDataList.tsx
```

```text
web/src/app/(m)/
  shipments/page.tsx
  shipments/history/page.tsx
  catalog/page.tsx
  receivables/ar/page.tsx
  receivables/ap/page.tsx
  settings/page.tsx
  settings/advanced/page.tsx
```

## 6) 탭별 구체 구현 계획 (홈 제외 4개)

## 6.1 출고 탭 (`/m/shipments`, `/m/shipments/history`)

문제:

- 기존 `shipments_main`은 필터 패널 + 대형 리스트 그리드(10열)로 모바일 가독성이 낮음.

모바일 구현:

- 상단 2세그먼트: `출고대기 | 출고완료`
- 리스트 카드형 변환(1행 1아이템)
  - 핵심 필드: 상태, 고객, 모델, 수량, 색상, 발주/입고일
- 다중 선택 UX는 하단 sticky 액션 바로 축약
  - `선택 n건`, `출고 생성`, `선택 해제`
- 고급 필터는 Bottom Sheet로 이동

데이터/로직:

- 기존 조회 로직과 동일 쿼리 키 재사용 (`cms/unshipped_order_lines`)
- 정렬/필터 조건 스키마는 동일하게 유지

산출물:

- `ShipmentsMobileScreen.tsx`
- `ShipmentsHistoryMobileScreen.tsx`

## 6.2 카탈로그 탭 (`/m/catalog`)

문제:

- list 모드는 `SplitLayout` 기반이라 모바일에서 작업 피로도가 높음.

모바일 구현:

- 기본/강제 뷰를 gallery로 고정 (모바일에서는 list 비노출)
- 2열 카드 그리드 고정 (`sm` 미만에서도 2열 유지)
- 상세는 우측 패널 대신 풀스크린 시트/드로어로 분리
- 필터는 상단 compact chips + 상세 필터 sheet 조합

데이터/로직:

- 기존 카탈로그 조회/정렬/필터 로직 재사용
- 모바일은 page size를 작게(예: 20) 유지하고 점진적 로드 적용

산출물:

- `CatalogMobileScreen.tsx`

## 6.3 미수 탭 (`/m/receivables/ar`, `/m/receivables/ap`)

문제:

- AR/AP 모두 `h-[calc(100vh-4rem)] + overflow-hidden + w-80 좌측패널` 구조로 모바일에서 스크롤/가시성 이슈 발생.

모바일 구현:

- 상단 세그먼트: `거래처미수 | 공장미수`
- 좌측 리스트/우측 상세 2패널을 단일 스택 흐름으로 전환
  - 1단계: 상대 선택 리스트
  - 2단계: 선택 상대의 상세/원장/액션
- 결제/조정 액션은 별도 full-height sheet로 제공
- 위험 액션(조정/상계/반품)은 확인 단계 1회 추가

데이터/로직:

- 기존 RPC 호출 계약(`CONTRACTS.functions.*`) 변경 없음
- 모바일은 view 상태만 단순화하고 payload는 동일

산출물:

- `ArMobileScreen.tsx`
- `ApMobileScreen.tsx`

## 6.4 설정 탭 (`/m/settings`, `/m/settings/advanced`)

문제:

- 기존 settings는 데스크톱형 사이드바+콘텐츠 2컬럼이며 정보 밀도가 높음.

모바일 구현:

- `/m/settings`: 계정/기본설정 허브(프로필, 주요 토글, 빠른 링크)
- `/m/settings/advanced`: 마진/시세/팩스를 섹션별 아코디언으로 분리
- 폼은 1열 + sticky 저장 버튼 + 변경사항 배지 표시

데이터/로직:

- `/me`의 허브 역할을 모바일 전용으로 승격
- 기존 설정 API/RPC 호출은 그대로 재사용

산출물:

- `SettingsMobileScreen.tsx`
- `SettingsAdvancedMobileScreen.tsx`

## 7) 단계별 실행 계획

### Phase 1: 모바일 라우팅 게이트

- 모바일 경로 맵 정의
- `/m/**` 라우트 기본 골격 생성
- 홈 제외 4탭 엔트리만 우선 라우팅

### Phase 2: 출고/카탈로그 우선 전환

- 출고 카드형 리스트 + 선택 액션 바
- 카탈로그 gallery 고정 + 상세 시트

### Phase 3: 미수/설정 전환

- AR/AP 스택형 구조 전환
- 설정 허브 + 고급설정 분리

### Phase 4: 안정화

- 모바일 회귀 테스트
- 성능/스크롤/키보드 입력 안정화
- 탭 이동 시 상태 복원(필터/선택) 점검

## 8) 수용 기준 (Acceptance Criteria)

1. 홈을 제외한 4탭(출고/카탈로그/미수/설정)이 모바일에서 깨짐 없이 동작한다.
2. 기존 웹 페이지 파일 수정 없이 모바일 전용 신규 계층으로 구현된다.
3. 출고 탭에서 다중 선택 후 출고 생성 진입이 가능하다.
4. 카탈로그 탭은 모바일에서 gallery 전용으로 동작하고 상세 편집 진입이 가능하다.
5. 미수 탭은 거래처/공장 세그먼트 전환과 결제/조정 액션 수행이 가능하다.
6. 설정 탭은 기본 허브와 고급설정 화면이 분리되어 모바일에서 입력/저장이 가능하다.
7. 하단 탭/브라우저 UI/키보드 표시 상태에서 CTA가 가려지지 않는다.

## 9) QA 체크리스트

- iOS Safari / Android Chrome 실기기 확인
- 탭 왕복 20회 시 상태 손실 여부(필터/검색어/선택)
- 소프트키보드 열림 시 입력창/저장 버튼 가림 여부
- 긴 리스트에서 스크롤 끊김/점프 여부
- 네트워크 지연 상태에서 로딩/오류 UI 일관성

## 10) 리스크와 대응

- 리스크: 모바일/웹 로직 분기로 유지보수 비용 증가
  - 대응: 도메인 로직은 공용 hook으로 유지, UI만 분리

- 리스크: 라우팅 게이트 오작동(데스크톱 오탐)
  - 대응: opt-in 쿠키 기반 rollout + fallback 토글 제공

- 리스크: 미수 액션 오류 영향도 큼
  - 대응: 액션 확인 단계 + idempotency key + 에러 메시지 표준화

## 11) 롤아웃 계획

1. 내부 QA 전용 플래그로 `/m/**` 공개
2. 직원 계정 10% 대상 canary
3. 이슈 없으면 전 사용자 확대
4. 안정화 후 모바일 게이트를 기본값으로 전환

---

본 PRD는 "웹 화면 비수정" 제약을 지키기 위해 **모바일 전용 라우트/컴포넌트를 신설**하는 전략을 기준으로 작성했다.
