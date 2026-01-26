# PHASE1_FINAL_UIUX_PRD

참고 문서 경로: `C:\Users\RICH\.gemini\antigravity\scratch\cms_s\docs`

## 전역 헌법(LOCK) — 위반 시 반려

아래 규칙은 Phase1 UI/UX의 절대 규칙이다. 하나라도 위반하면 구현을 반려한다.

- base table 직접 write 금지(INSERT/UPDATE/DELETE 금지)
- 모든 쓰기 = `cms_fn_*` RPC만 호출
- 버튼 1개 = RPC 1회(한 버튼에서 다중 write 연쇄 금지)
- Confirm/가격/AR 계산 로직을 UI에서 재구현 금지(서버 SoT)
- UUID 직접 입력 UX 금지(검색/선택만)
- Confirm 가드(필수)
  - 라인 0개면 confirm 금지
  - 14/18/24 RULE 라인 measured_weight 없으면 금지
  - is_plated=true인데 plating_variant_id 없으면 금지
- enum 값 하드코딩 금지(“DB enum 실제 값”으로만 드롭다운 구성)
- `_live` 전환/설계/언급은 이번 Phase1 PRD에서 제외(나중에 함)

---

## 1) 목적/범위(Phase1)

- 운영이 가능한 핵심 플로우 UI를 완성하고, 데이터가 정확히 쌓이도록 한다.
- Phase1 포함: Party, Orders(라인), Repairs, Shipments(확정 포함), AR(결제/반품), Catalog/Master, Settings(제한적 관리), Dashboard 요약.
- Phase2 제외: 구매/재고 등.

---

## 2) 전역 UI/UX 원칙(디자인 시스템) — 레퍼런스 이미지 기준

레퍼런스: `ref_1.png`(Catalog/List), `ref_2.png`(Detail/Edit)

- 레이아웃 언어: Master-Detail / List-Detail / Two-pane / Split-pane 스타일
- 좌측 사이드바: 아이콘+라벨, 현재 메뉴 강조, 하단 Settings 고정
- 상단 액션바: 페이지 타이틀(좌) + 우측 CTA 묶음
- 필터바: 검색 입력 + 2~4개 드롭다운 + More Filters 버튼
- 본문: 카드형 컨테이너 여러 개를 세로로 적층
- 리스트 카드: 썸네일(옵션) + 타이틀 + 상태 배지 + 메타 타일
- 디테일: 섹션 헤더 + 폼 그리드 + 인라인 테이블
- 톤: 넉넉한 여백, 라운드, 얕은 쉐도우, 명확한 계층 타이포
- 상태 배지: Active/New/Pending 등 칩 형태
- 다크모드 토글(가능하면) / 최소 라이트모드 완성

### 2.1 그리드/컨테이너 규격

- Desktop 12-col
  - Left(List): 4~5 cols (35~45%)
  - Right(Detail): 7~8 cols (55~65%)
- Tablet 이하: List/Detail 세로 스택 (Detail은 Drawer/Route 전환 가능)

### 2.2 컨테이너 ID 네이밍(고정)

- 페이지 루트: `{page}.root`
- 상단바: `{page}.actionBar`
- 필터바: `{page}.filterBar`
- 본문: `{page}.body`
- 리스트: `{page}.listPanel`
- 상세: `{page}.detailPanel`
- 공통 상세 스택: `{page}.detail.basic`, `{page}.detail.table`, `{page}.detail.summary`, `{page}.detail.activity`, `{page}.detail.raw`

### 2.3 전역 상태/로딩/토스트

- Initial Load: List Skeleton 8~10개 + Detail Skeleton(기본정보 6줄 + 테이블 5행)
- Refetch: 리스트 상단 얇은 progress bar + 기존 데이터 유지
- Empty: “데이터 없음” + CTA(새로 만들기)
- Error: “다시 시도” 버튼 + 오류 ID(로그용)
- Saving: 버튼 스피너 + 폼 disabled
- Modal Loading: 검색 결과 skeleton 5개

토스트(기본값, PHASE1_CHECK 우선):
- 성공(저장): “저장 완료” / sub: “{entity} 업데이트됨”
- 성공(생성): “생성 완료” / sub: “{entity} 생성됨”
- 성공(삭제): “삭제 완료”
- 유효성 실패: “필수 항목을 확인해 주세요” + 문제 필드 라벨
- RPC 실패: “처리 실패” + “잠시 후 다시 시도해 주세요”
- Confirm 가드 실패:
  - “출고 확정 불가: 라인이 없습니다”
  - “출고 확정 불가: 실측중량이 필요합니다”
  - “출고 확정 불가: 도금 Variant를 선택해 주세요”

---

## 3) 전역 헌법(LOCK) — 상세

- 쓰기(WRITE): base table 직접 write 금지, RPC만 허용
- 돈(AR): AR 증가는 출고 확정에서만, 결제/반품은 음수 기록
- 가격 확정: 주문/수리 입력 단계 가격 없음, 출고 확정에서만 스냅샷 잠금
- 서버 가드: 라인 0개/중량 누락/도금 누락은 confirm 실패
- enum/상태: DB enum 실제 값만 사용
- UUID 입력: 금지

---

## 4) 페이지 IA(사이드바 메뉴/라우팅) + 권한 기준(최소)

- `/dashboard` Dashboard (요약)
- `/party` Party (거래처)
- `/orders` Orders (주문 라인)
- `/repairs` Repairs (수리)
- `/shipments` Shipments (출고)
- `/ar` AR (미수/결제/반품)
- `/catalog` Catalog/Master (마스터카드)
- `/settings` Settings (시세/도금/룰 등 read-only 또는 제한적 관리)

권한(Phase1 최소):
- staff/authenticated만 접근
- 쓰기 버튼은 RPC 권한 전제
- Confirm/결제/반품은 권한 체크 후 노출

---

## 5) 기술 스택(구현 기준)

- Node.js 20 LTS
- Next.js(App Router) + TypeScript
- Tailwind CSS
- UI: shadcn/ui(Radix)
- 폼/검증: React Hook Form + Zod
- 테이블: TanStack Table
- 데이터 패칭: React Query 또는 SWR 중 1개로 통일
- 토스트: Sonner 계열 1개로 통일
- 날짜: date-fns

---

## 6) 페이지별 PRD(코딩 체크리스트)

아래 템플릿을 모든 페이지에 동일 포맷으로 적용한다.

### 6.1 Dashboard

- 페이지 목적: 운영 KPI 요약과 핵심 페이지 바로가기 제공
- Route / 메뉴명 / 권한: `/dashboard` / Dashboard / staff
- 레이아웃: 12-col, 상단 요약 카드 4~6개, 하단 최근 활동 리스트
- 컴포넌트 구성: KPI 카드, Recent Shipments/Orders 리스트 카드, Quick Links
- 데이터 소스: read-only select 또는 `cms_v_*` 요약 뷰(존재 시)
- 필드 정의: KPI 값(금액/카운트), 기간 필터(7d/30d)
- 액션(버튼): “Go to Shipments/Orders/AR” 링크
- Empty/Error/Skeleton: KPI 카드 6개 스켈레톤 + 리스트 5행 스켈레톤
- Confirm/잠금/수정 제한: 해당 없음
- 수용 기준: KPI 로드, 링크 동작, 에러/빈 상태 표시

### 6.2 Party (거래처)

- 페이지 목적: 거래처(customer/vendor) 등록/수정/활성 관리
- Route / 메뉴명 / 권한: `/party` / Party / staff
- 레이아웃: 12-col, Left 4~5 cols / Right 7~8 cols
- 컴포넌트 구성: ActionBar, FilterBar, CardList, DetailStack
- 데이터 소스: `cms_party` read-only select
- 필드 정의:
  - name*(text)
  - party_type*(select: customer/vendor)
  - phone(text)
  - region(text/select)
  - address(text)
  - note(textarea)
- 액션(버튼):
  - 저장 → `cms_fn_upsert_party_v1` → “저장 완료”
- Empty/Error/Skeleton: list 8 cards + detail 6줄 + 버튼 disabled
- Confirm/잠금/수정 제한: 해당 없음
- 수용 기준: 필수값 검증, RPC 1회 호출, UUID 직접 입력 없음

### 6.3 Orders (주문 라인)

- 페이지 목적: 주문 라인 입력/상태 관리/출고 생성
- Route / 메뉴명 / 권한: `/orders` / Orders / staff
- 레이아웃: Left list + quick create, Right detail
- 컴포넌트 구성: QuickCreate 카드, CardList, DetailStack, Create Shipment 모달
- 데이터 소스: `cms_order_line` read-only select
- 필드 정의(Quick Create):
  - customer*(SearchSelect)
  - model_name*(text)
  - suffix*(text)
  - color*(text)
  - qty(int, default 1, >=1)
  - is_plated(checkbox)
  - plating_variant(SearchSelect, is_plated=true일 때 required)
- 액션(버튼):
  - 생성 → `cms_fn_upsert_order_line_v1` → “생성 완료”
  - 선택 라인 출고 생성 → 서버 흐름에 맞춰 shipment draft 생성 + 라인 추가
- Empty/Error/Skeleton: list 8 cards + detail 6줄 + activity 3줄
- Confirm/잠금/수정 제한: is_plated=true면 plating_variant 필수
- 수용 기준: 필수값 검증, enum 하드코딩 금지, RPC 1회

### 6.4 Repairs (수리)

- 페이지 목적: 수리 접수/상태/출고 연결
- Route / 메뉴명 / 권한: `/repairs` / Repairs / staff
- 레이아웃: Left list / Right detail
- 컴포넌트 구성: QuickCreate(옵션), CardList, DetailStack
- 데이터 소스: `cms_v_repair_line_enriched_v1`
- 필드 정의:
  - customer*(SearchSelect)
  - received_at*(date)
  - model_name(text)
  - suffix(text)
  - material(select: DB enum)
  - qty(int >=1)
  - measured_weight(number >=0)
  - is_paid(toggle)
  - repair_fee_krw(number, is_paid=true일 때 required)
  - is_plated + plating_variant(is_plated=true일 때 required)
- 액션(버튼):
  - 저장 → `cms_fn_upsert_repair_line_v1` → “접수 저장 완료”
- Empty/Error/Skeleton: list 8 cards + detail form + activity skeleton
- Confirm/잠금/수정 제한: measured_weight는 view alias, 저장은 RPC에서 처리
- 수용 기준: 필수값 검증, RPC 1회

### 6.5 Shipments (출고)

- 페이지 목적: 출고 헤더/라인 관리 및 확정(가격/AR 스냅샷)
- Route / 메뉴명 / 권한: `/shipments` / Shipments / staff
- 레이아웃: Left list / Right detail (container stack)
- 컴포넌트 구성: Header form, Add Lines buttons, Lines table, Summary, Confirm, Activity
- 데이터 소스: `cms_shipment_header`, `cms_shipment_line` read-only select
- 필드 정의(헤더):
  - customer*(SearchSelect)
  - ship_date(date)
  - ship_to_address(text)
  - memo(textarea)
- 액션(버튼):
  - 헤더 생성 → `cms_fn_create_shipment_header_v1` → “출고 문서 생성 완료”
  - 라인 추가(주문) → `cms_fn_add_shipment_line_from_order_v1`
  - 라인 추가(수리) → `cms_fn_add_shipment_line_from_repair_v1`
  - 라인 추가(ad-hoc) → `cms_fn_add_shipment_line_ad_hoc_v1`
  - 라인 수정 → `cms_fn_update_shipment_line_v1`
  - 라인 삭제 → `cms_fn_delete_shipment_line_v1`
  - 확정 → `cms_fn_confirm_shipment` → “출고 확정 완료”
- Empty/Error/Skeleton: list 6 cards + detail header/table/summary skeleton
- Confirm/잠금/수정 제한:
  - 라인 0개/중량 누락/도금 누락 시 confirm disabled + 토스트
  - confirm 이후 헤더/라인 읽기 전환
- 수용 기준: Confirm 가드 UI 재현, RPC 1회, 가격/AR 로직 재구현 금지

### 6.6 AR (미수/결제/반품)

- 페이지 목적: 거래처 잔액/원장 조회 + 결제/반품 기록
- Route / 메뉴명 / 권한: `/ar` / AR / staff
- 레이아웃: Left party list / Right ledger detail
- 컴포넌트 구성: Party cards, Ledger table, Payment modal, Return modal
- 데이터 소스:
  - 리스트: `v_ar_balance_by_party` 또는 AR position view
  - 상세: `cms_ar_ledger` read-only select
- 필드 정의(결제 모달):
  - party*(SearchSelect)
  - occurred_at(date, default today)
  - tenderLines(method, amount, note)
- 필드 정의(반품 모달):
  - party*(SearchSelect)
  - shipment_line*(SearchSelect)
  - return_qty*(int >=1)
  - amount(auto + override)
  - memo(text)
- 액션(버튼):
  - 결제 등록 → `cms_fn_record_payment` → “결제 등록 완료”
  - 반품 등록 → `cms_fn_record_return` → “반품 등록 완료”
- Empty/Error/Skeleton: party list 8 + ledger 10 rows + modal 3~4 rows
- Confirm/잠금/수정 제한: AR 증가는 출고 확정에서만
- 수용 기준: 음수 잔액(CREDIT) 표시, RPC 1회

### 6.7 Catalog/Master (마스터카드)

- 페이지 목적: 모델 마스터 관리(기본값/공임/도금)
- Route / 메뉴명 / 권한: `/catalog` / Catalog / staff
- 레이아웃: Left list / Right detail (ref_1/ref_2 스타일 적용)
- 컴포넌트 구성: 카드형 리스트, Basic form, Pricing table
- 데이터 소스: `cms_master_item` read-only select
- 필드 정의:
  - model_name*(text)
  - category(select)
  - standard_material(select)
  - default_deduction_g(number)
  - labor_profile_mode(select: MANUAL/BAND)
  - labor_band_code(text, BAND일 때)
  - plating defaults
- 액션(버튼):
  - 저장 → 해당 upsert RPC가 존재할 경우만 사용, 없으면 read-only
- Empty/Error/Skeleton: list 8 cards + detail form 6줄
- Confirm/잠금/수정 제한: Phase1은 없어도 출고가 막히지 않게
- 수용 기준: 리스트/디테일 레이아웃 ref_1/ref_2 준수

### 6.8 Settings

- 페이지 목적: 시세/도금/룰 조회 또는 제한적 관리
- Route / 메뉴명 / 권한: `/settings` / Settings / staff
- 레이아웃: 단일 column 카드 스택
- 컴포넌트 구성: read-only table + 제한적 편집 모달(있을 경우)
- 데이터 소스: `cms_market_tick`, `cms_plating_variant`, `cms_labor_band_rule` read-only select
- 액션(버튼): Phase1 기본은 read-only
- Empty/Error/Skeleton: table 5행 + 카드 3개
- Confirm/잠금/수정 제한: 쓰기 시 RPC만 허용
- 수용 기준: enum 하드코딩 금지

---

## 7) 공통 컴포넌트/패턴

- ActionBar: Title + CTA 오른쪽 정렬
- FilterBar: search + dropdown + More Filters
- CardList + ListCard: 썸네일/타이틀/배지/메타 타일
- DetailStack: 4~6개 컨테이너 스택
- DataTable: 인라인 편집 + Row Save/Delete
- Modal: 검색/선택/확정/결제/반품
- SearchSelect: UUID 직접 입력 금지, 검색/선택만

---

## 8) API 호출 규약(Supabase/RPC/View) + 에러 처리/관찰성

- 조회: `cms_v_*` 뷰 우선, 필요 시 read-only select
- 쓰기: `supabase.rpc('cms_fn_*', params)`만
- env 키: anon key만 프론트에서 사용(서비스 role 금지)
- 에러 처리:
  - RPC 실패 시 “처리 실패” 토스트
  - 가능한 경우 `correlation_id` 로그 키 포함
- 관찰성: error toast에 오류 ID 표시

---

## 9) 함정/주의사항(재발 방지)

- 주문 status enum에 `DRAFT` 넣으면 오류 → UI 하드코딩 금지
- repair_line 컬럼명: `weight_received_g` (뷰는 `measured_weight_g` alias)
- party 컬럼명: `note` (memo 아님)
- plating_variant에 `pv.code` 없음 → `display_name` 사용

---

## 10) QA/수용 기준(“Done” 정의 + 회귀 체크)

- 모든 쓰기 동작이 RPC로만 연결
- Confirm 가드 3종이 disable + 필드 하이라이트 + 토스트로 재현
- UUID 직접 입력 필드 0개
- 모든 페이지에 Skeleton/Empty/Error 상태 존재
- 리스트/디테일 패턴이 레퍼런스처럼 컨테이너 스택 유지
- 회귀 체크 5개:
  - measured_weight 없는 14/18/24 라인 confirm 실패
  - is_plated=true & plating_variant_id null confirm 실패
  - shipment 라인 0개 confirm 실패
  - payment/return offset 잔액 계산 정상
  - repair fee만 있는 라인 cost 정책 정상(서버 SoT)
