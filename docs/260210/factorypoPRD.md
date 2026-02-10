# ✅ 코딩 에이전트 프롬프트 (Factory PO History UI/UX 고도화)
당신은 Next.js(App Router) + React Query + Tailwind 기반의 사내 운영툴을 개선하는 시니어 프론트엔드 엔지니어입니다.

현재 factory_po_history 화면이 카드가 반복되는 단조로운 형태라 탐색/검증 속도가 느리고 스크롤 비용이 큽니다.

이를 업무형 “마스터-디테일(좌 리스트 · 우 상세)” 구조로 고도화해 주세요.

### 0) 작업 대상/환경
* **레포:** cms_s-main/web
* **대상 페이지:** `web/src/app/(app)/factory_po_history/page.tsx`
* **데이터 소스 유지(필수):**
    * View: `CONTRACTS.views.factoryPoSummary`
    * RPC: `CONTRACTS.functions.factoryPoGetDetails`
* **DB/서버/RPC 스키마 변경 금지** (프론트만으로 해결)
* **KST 처리 유지** (현재 코드의 `getKstYmd`, `shiftYmd`, `formatTimeKst` 등 활용 가능)
* **UI 톤 유지:** `var(--panel)`, `var(--panel-border)` 등 기존 디자인 토큰 사용

### 1) 최종 목표(UX)
* **핵심 사용자 플로우를 빨라지게 만들 것**
    * 특정 날짜에 공장별 전송 건수/수량을 한눈에 스캔
    * 공장 선택 → 해당 공장의 PO 목록을 정렬/검색/필터로 즉시 탐색
    * PO 상세에서 라인 검증 후 이전/다음 PO로 연속 확인
* **“단조로움” 해결 방식(디자인보다 정보 구조)**
    * 긴 카드 스택 제거 → 좌측 “공장 리스트” + 우측 “PO 테이블/리스트”
    * 상태를 텍스트가 아니라 Badge/Chip으로 시각화
    * 로딩/빈/에러 상태는 Skeleton/Action CTA 제공

### 2) 구현 범위(필수) — PR 단위로 쪼개서 진행해도 됨
#### [필수-1] 상단 ActionBar 개선(Sticky + 아이콘 + 상태)
현재 페이지 상단 영역을 sticky로 고정
* 상단 wrapper에 `sticky top-0 z-30 + backdrop-blur` 유지
* 버튼 텍스트 ◀ ▶ → lucide-react 아이콘(`ChevronLeft`, `ChevronRight`)
* 새로고침 버튼 `RefreshCw` 아이콘 추가
* **“마지막 갱신 시간”** 표시(예: 마지막 갱신: 14:02:11)
    * `summaryQuery.dataUpdatedAt` 활용하거나 refetch 시각 state로 관리

#### [필수-2] KPI를 KpiCard로 교체 + 전일 대비 Δ 표시
* 기존 KPI 3개(전송 PO 수 / 총 라인 수 / 총 수량) → `KpiCard` 사용
* 파일: `web/src/components/ui/kpi-card.tsx` 존재
* 전일(선택일 - 1일) 데이터도 동일 조건으로 1회 조회하여 Δ 계산
* 새 queryKey: `["factory-po-history-prev", prevDate, vendorPartyId, vendorPrefix]`
* trend 텍스트 예시: `▲ 4 / ▼ 2 / ± 0`
* 음수일 때 trend 색이 초록만 나오지 않도록(현재 KpiCard trend는 success 고정)
    * **옵션 A:** KpiCard 확장(예: `trendTone?: "success"|"danger"|"muted"`)
    * **옵션 B:** trend를 JSX로 넘기지 못하면 KpiCard를 복제 개선 (권장 A)

#### [필수-3] 메인 레이아웃을 “좌 공장 리스트 · 우 PO 리스트”로 변경
기존 `grouped.map()`로 공장 카드가 아래 쌓이는 구조를 제거
* **레이아웃:** md 이상에서 2단 그리드
    * 좌(약 280~360px): 공장 리스트
    * 우: PO 리스트(테이블/리스트)
* 모바일(sm)에서는 1단으로 폴백(기존 SearchSelect를 유지하거나, 좌 리스트를 상단으로 접기)
* **좌측 공장 리스트 컴포넌트 신규 생성**
    * 신규 폴더 생성: `web/src/app/(app)/factory_po_history/_components/FactoryVendorList.tsx`
    * 참고 패턴: `web/src/app/(app)/ap/_components/ApVendorList.tsx` (검색 + 선택 UI)
    * 요구사항:
        * 리스트 상단에 검색 Input(공장명/party_id/prefix 검색)
        * 각 공장 항목에 요약 표시: 건수 n, 총수량 qty
        * 선택 상태 강조(현재 AP 스타일처럼)
        * 선택 시 URL 쿼리 업데이트: party_id 우선(`vendor_party_id`), 없으면 prefix(`vendor_prefix`), “전체” 선택 가능(쿼리 제거)
* **우측 PO 리스트 컴포넌트 신규 생성**
    * 신규: `web/src/app/(app)/factory_po_history/_components/PoList.tsx` (또는 `PoTable.tsx`)
    * 요구사항(우측 상단 컨트롤):
        * 검색 Input: PO/모델/거래처 텍스트 검색(클라이언트 필터)
        * Provider 필터(Chip/Select): `fax_provider` 기준
        * 정렬: 전송시간(기본: 오래된→최신 or 최신→오래된 중 하나 명확히), 총수량 desc, 라인수 desc
    * 렌더링(각 PO row):
        * 주요 표시: 전송시간, po_id, 라인수, 총수량, provider
        * 상태 Badge: provider → `Badge tone="primary"`, `fax_payload_url` 없으면 `Badge tone="warning"` “파일 없음”
        * 액션: FAX 열기 버튼 (없으면 disabled + title로 이유), 상세 버튼(오른쪽 Drawer 열기)
    * 구현 방식은 2가지 중 택1:
        * A) 단순 HTML table + 정렬/필터는 state로 처리(가장 안전)
        * B) `@tanstack/react-table`(이미 deps에 있음)로 정렬/필터/페이지네이션까지 제공(권장)

### 3) 상세 화면 개선(필수): Modal → 우측 Drawer(슬라이드 패널)
현재 상세는 Modal이라 컨텍스트가 끊기므로 오른쪽 Drawer로 변경하세요.
* **Drawer 컴포넌트 추가**
    * 신규 파일: `web/src/components/ui/drawer.tsx`
    * 스펙: open, onClose, title, children, className, overlay 클릭 시 닫기, 우측에서 슬라이드(transition). 애니메이션은 CSS로 간단히.
    * 너비: `w-[min(720px,100vw)]` 정도, 모바일에서는 full
    * 기존 Modal 스타일 토큰 최대한 재사용
* **Drawer 내용(상세)**
    * 헤더: po_id, vendor, 전송시간, provider badge, 라인수/총수량
    * 탭(간단 state로 구현):
        * **라인 상세:** 기존 표 그대로 이식하되 라인 내 검색 Input(모델/거래처), 합계 수량 표시
        * **FAX 미리보기:** `fax_payload_url` 있으면 iframe/embed(가능하면), 없으면 빈 상태 + 안내, “새 창 열기” 버튼 제공
* **“이전/다음 PO” 네비게이션(필수)**
    * 현재 우측 리스트의 “필터된 PO 배열” 기준으로 index를 계산해서 Drawer 상단에 이전, 다음 버튼 제공
    * 이동 시 `activePoId` 변경 → `detailQuery` 갱신
    * 목표: 연속 검증 시 “닫기→다시 클릭” 반복 제거

### 4) 상태/품질(필수)
* **로딩/에러/빈 상태**
    * 로딩: Skeleton 기반으로 표시 (`web/src/components/ui/skeleton.tsx`)
    * 에러: 화면에 메시지 + “재시도” 버튼
    * 빈 상태: “조회된 전송 내역이 없습니다.” 대신 날짜 변경/전체 보기/새로고침 CTA 버튼 제공
* **토스트**(선택이지만 권장)
    * 에러/복사/다운로드 등의 행동 결과는 sonner toast 사용 가능

### 5) (선택/추가 점수) 생산성 기능
가능하면 아래도 추가:
* 우측 PO 리스트 CSV 내보내기(현재 필터 반영)
* 상세 라인 CSV 내보내기
* 현재 필터 상태 URL “링크 복사”

### 6) 파일 구조(권장)
* `web/src/app/(app)/factory_po_history/page.tsx`: 레이아웃/쿼리/상단바/선택 상태만 관리하고 UI는 컴포넌트로 분리
* 신규: `web/src/app/(app)/factory_po_history/_components/FactoryVendorList.tsx`
* 신규: `web/src/app/(app)/factory_po_history/_components/PoList.tsx`(or `PoTable.tsx`)
* 신규: `web/src/app/(app)/factory_po_history/_components/PoDetailDrawer.tsx`
* 신규: `web/src/components/ui/drawer.tsx`
* (필요 시) `web/src/hooks/use-debounced-value.ts`

### 7) 완료 기준(반드시 체크)
- [ ] md 이상에서 좌 공장 리스트 / 우 PO 리스트가 동작한다
- [ ] 공장 선택 시 URL 쿼리가 갱신되고 우측 리스트가 즉시 필터된다
- [ ] 우측에서 검색/필터/정렬이 동작한다
- [ ] 상세는 Drawer로 열리고, 라인/팩스 탭이 있다
- [ ] Drawer에서 이전/다음 PO 이동이 된다
- [ ] KPI는 KpiCard이며 전일 대비 Δ가 표시된다
- [ ] 로딩은 Skeleton, 에러/빈 상태는 CTA가 있다
- [ ] `npm run lint` / `npm run build(web)` 기준 오류 없다

### 8) 구현 후 간단한 개발자 메모도 남겨줘
* 변경 요약
* 어떤 기준으로 정렬/필터 기본값을 잡았는지
* Drawer에서 이전/다음 인덱스 계산 방식