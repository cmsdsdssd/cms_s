# PRD — “분석 모드(Analysis Tab) v1” 단독 구축 PRD (강추 #1, #8, #10, #2, #3)

## 핵심 원칙(절대 준수)
* **현재 업무 로직/플로우는 절대 안 건드림** (주문/출고/미수/원가 확정 등 기존 UX·RPC·DB 쓰기 로직 그대로)
* **분석은 “별도 탭(모드)”로만 제공**: 좌측 상단 아이콘 클릭 → 분석 모드로 전환 → 좌측 네비게이터도 분석 전용으로 변경
* **v1은 Read-only 분석만** (SELECT/뷰/리포트/시뮬레이션)
* 분석이 “제대로 돌아간다” 검증되면 v2에서 액션/자동화(가격 적용, 정합성 수정, 우선순위 콜 리스트 실행 등) 를 기존 화면에 안전하게 붙임

---

## 0. 문서 정보
* **문서명**: 분석 모드(Analysis Tab) v1 — 매출 극대화/누수 차단/데이터 정합성/영업 효율/추천
* **버전**: v1.0
* **작성일**: 2026-02-23 (KST)
* **적용 범위**: 프론트(UI/네비/분석 페이지) + DB(분석용 View/Read-only RPC/Index 추가)
    * 단, 기존 테이블·기존 RPC 변경은 금지 (ADD-ONLY만)

---

## 1. 배경/문제 정의

### 1.1 지금 가장 큰 문제
* 운영 UI는 “업무 처리(주문/출고/미수/원가)”는 가능하지만,
* **돈이 새는 지점**(마진 음수/정책 미달/시세 오류/원가 미확정 등)을 한 화면에서 발견하기 어렵고
* **데이터 정합성**(미수/원장/출고 총액 불일치, 공임 항목 불일치 등) 이슈를 “사후”에야 알게 되며
* **영업/추천**은 직감과 경험 의존으로 “매출 극대화” 기회가 누락됨

### 1.2 사용자가 요구한 UX 제약
* “지금 당장 돈 새는 걸 막고 싶다” → **강추 #1, #8, #10**
* “영업 효율로 매출을 올리고 싶다” → **강추 #2, #3**
* **단, 지금 로직 안 건드리고**
    * → “분석탭만 따로 만들어서 거기서 보고 싶다”
    * → 좌측 상단 아이콘 클릭 시 분석모드로 전환 + 좌측 네비게이터 변경
    * → 분석이 신뢰되면 나중에 기능(액션) 붙이기

---

## 2. 목표/비목표

### 2.1 목표(Goals)
* 분석 모드(탭) v1을 추가하여, 운영과 분리된 “읽기 전용” 분석 대시보드를 제공
* 아래 5개 “강추” 모듈을 분석 화면에서 완전히 구현 가능한 수준으로 구체화
    * **강추 #1: ProfitGuard**(돈 새는 곳 탐지)
    * **강추 #8: IntegrityShield**(정합성/데이터 품질 진단)
    * **강추 #10: MarketShock**(시세/정책/가격 충격 모니터링)
    * **강추 #2: SalesPriority**(영업 우선순위/타겟팅)
    * **강추 #3: NextBestOffer**(추천/교차판매)
* **각 모듈은**: “요약 KPI” + “원인 드릴다운” + “리스트(액션 후보)” + “예시/근거” 구조로 통일
* **v2(미래)에서 운영 화면에 안전하게 붙일 수 있도록**: 동일한 지표 정의/쿼리/스코어링을 재사용 가능하게 설계

### 2.2 비목표(Non-Goals) — v1에서는 하지 않음
* 출고 확정 로직, 가격 계산 로직, 미수 반영 로직, 원가 배분 로직 등 기존 쓰기 로직 수정/교체
* 자동 수정(정합성 자동 Fix), 자동 가격 적용, 자동 콜/메시지 발송, 자동 추천 저장 등 쓰기/자동화 기능
* 대규모 신규 인프라(별도 데이터웨어하우스, 스트리밍 파이프라인) 강제
    * 단, 확장 설계는 포함

---

## 3. 성공 지표(Success Metrics)
v1은 “분석이 믿을 만한가”를 검증하는 단계입니다.

### 3.1 핵심 KPI
* **누수 탐지 정확도**: (샘플 검증) 분석에서 “누수”로 표시된 50건 중 운영자가 확인했을 때 진짜 문제인 비율 ≥ 80%
* **발견 속도**: “이번 달 누수 TOP 10” 찾는 데 걸리는 시간: 기존 대비 80% 감소
* **정합성 가시화**: AR SOT/공임/원가 이슈의 “현재 오픈 건수”를 1분 내 확인 가능
* **영업 활용성**: SalesPriority 상위 20개 거래처 리스트를 실제로 쓰는지(주간 조회 ≥ 3회)
* **추천 활용성**: 추천 페이지에서 “거래처별 추천” 조회 후, 최소 1개 거래처에서 수동 주문/제안으로 이어지는 비율 ≥ 30%

---

## 4. 사용자/권한/운영 시나리오

### 4.1 주요 사용자(Personas)
* **운영 총괄(대표/관리자)**: 누수/정책/시세/정합성 전체를 한 번에 본다
* **출고 담당**: 출고 전에 “이상 징후”를 보고 수동 조정
* **미수 담당**: AR SOT 이슈를 발견하고, 원인을 추적
* **영업 담당**: 우선순위 고객/추천 품목을 보고 “전화/방문/제안” 준비

### 4.2 권한(Access)
* v1에서는 authenticated 사용자에게 읽기 허용(기존 정책과 동일)
* 향후(선택): “분석 모드 접근”을 role 기반 제한 가능(Feature Flag)

---

## 5. UX 요구사항 — “분석 모드” 전환과 네비게이션

### 5.1 최상위 UX: 좌측 상단 아이콘 클릭 → 분석 모드 전환
**요구사항(필수)**
* 좌측 상단(사이드바 헤더의 로고/아이콘) 클릭 시:
    * 현재가 업무 모드면 → `/analysis/overview` (또는 마지막 분석 페이지)로 이동
    * 현재가 분석 모드면 → 마지막 업무 페이지(또는 `/dashboard`)로 복귀
* 전환 시 좌측 네비게이션은 분석 전용 메뉴로 변경
* 전환 상태는 URL 기반(권장: `/analysis/*`)이므로 새로고침/공유 시에도 동일하게 유지

**강추 이유**
* “업무와 분석 분리”가 확실해져서 기존 로직을 건드릴 위험이 0에 가깝고,
* 분석 UI를 마음껏 확장해도 운영 플로우 안정성이 유지됩니다.

### 5.2 모드 전환 UX 상세
* **전환 버튼 위치**: (필수) 사이드바 헤더 로고 클릭 / (권장) 모바일/사이드바 접힘 상태를 위해 상단바에도 작은 토글 아이콘 추가
* **전환 후 표시**: 상단바 우측 또는 breadcrumbs 옆에 “분석 모드” 배지 표시(혼동 방지)
* **마지막 방문 경로 기억**: localStorage 키 예: `cms_last_path_app`, `cms_last_path_analysis`

### 5.3 분석 모드 좌측 네비게이터(IA)
**분석 모드 메뉴(안) — v1 고정**
* **요약**: `/analysis/overview` : 전체 요약 대시보드(돈/정합/시세/영업/추천)
* **돈 새는 곳 (강추 #1)**: `/analysis/leakage` : 마진 누수/정책 미달/원가 미확정/이상 가격
* **정합성 (강추 #8)**: `/analysis/integrity` : AR SOT/공임 정합/원가 누락/재고 예외
* **시세/정책 (강추 #10)**: `/analysis/market` : 시세 신선도/변동성/시세 충격 영향/시뮬레이션
* **영업 우선순위 (강추 #2)**: `/analysis/sales-priority` : 고객 세그먼트/우선순위/리스트
* **추천 (강추 #3)**: `/analysis/recommendations` : 거래처별 Next Best Offer + 근거
* (선택) `/analysis/shipments` : 기존 `shipments_analysis`를 “분석 모드”에 래핑해서 제공(드릴다운 강화)

---

## 6. 정보 설계 — 분석 화면 공통 규칙

### 6.1 공통 화면 레이아웃 규칙
모든 분석 페이지는 동일 구조로 구성:
1.  **ActionBar**: 제목/부제(기간, 데이터 기준), 공통 필터(기간, 거래처, 상태 등), Export(CSV) / Copy link 버튼
2.  **KPI 카드**: 4~8개 (요약)
3.  **문제/기회 Top 리스트**: (우선순위 정렬)
4.  **드릴다운 테이블**: 컬럼: “무엇이 문제인지(Flag)” + “금액 영향(Impact)” + “근거(Evidence)” + “링크”
5.  **정의/해석(Help) 섹션**: 지표 정의, 계산 방식, 해석 가이드(운영자가 오해하지 않도록)

### 6.2 공통 필터(권장 기본값)
* **기간**: 기본 최근 30일
* **상태**: 돈 새는 곳: DRAFT/CONFIRMED 탭 분리, 정합성: 전체(하지만 기본은 “최근 confirmed”)
* **거래처**: ALL(검색 가능)
* **카테고리/재질(material_code)**: 선택

### 6.3 데이터 처리 원칙(성능/안정)
* v1은 Read-only이므로 대부분은 View + Index + 제한된 기간 필터로 해결
* 과도한 조인은 Read-only RPC로 JSON 반환(프론트 round-trip 줄이기)
* 기본 제한: 테이블 리스트는 기본 200~500 rows, “더 보기”로 pagination, 기간이 180일 초과 시 경고(느려질 수 있음)

---

## 7. 모듈 1 — 강추 #1 “ProfitGuard: 돈 새는 곳 탐지” (분석 전용)

### 7.1 목적
* 마진 음수/정책 미달/원가 미확정/이상 가격을 한 번에 찾아서, “지금 당장 돈 새는 것”을 가시화하고, 운영자가 수동으로 조치할 수 있게 “근거 + 링크” 제공
* **강추 이유**: 매출을 올리는 것보다 먼저 해야 하는 게 누수 차단입니다. 특히 `purchase_cost_status`, `pricing_mode`, `market_tick`이 얽힌 케이스는 사람이 일일이 못 봅니다.

### 7.2 화면: /analysis/leakage
* **A) KPI 카드(예시)**: 기간 매출 합(₩), 기간 원가 합(₩, cost_basis 기준), 기간 마진 합(₩) / 마진율, 마진 음수 라인 수, 정책 미달(가격 바닥선 미만) 라인 수, 원가 미확정(PROVISIONAL) 비중, “시세 stale 의심 라인 수”(MarketShock와 연결 KPI)
* **B) 핵심 리스트(Top 3 섹션)**: 마진 음수 TOP 20 (Impact 큰 순), 정책 바닥선 미달(추정 보정액) TOP 20, 원가 미확정인데 매출이 큰 TOP 20 (리스크 노출)
* **C) 드릴다운 테이블(필수 컬럼)**: `shipment_id` / `shipment_line_id`, `ship_date` / `status`(DRAFT/CONFIRMED), `customer_name`, `model_name` / `material_code` / `qty` / `net_weight_g`, `sell_total`(₩), `cost_basis`(₩), `margin`(₩), `margin_rate`, `pricing_mode`, `leak_type` (NEG_MARGIN / BELOW_FLOOR / PROVISIONAL_COST / STALE_TICK / OUTLIER_DISCOUNT), `evidence`(JSON 요약) + “상세 보기” (drawer), “업무 화면 링크” (새 탭으로: 해당 shipment 상세/라인 위치)

### 7.3 핵심 지표 정의(명확히 고정)
1.  **cost_basis_krw (정책 바닥선 기준 원가)**
    * `cost_basis_krw = coalesce(purchase_total_cost_krw, material_amount_cost_krw + labor_total_cost_krw) + plating_amount_cost_krw`
    * `purchase_total_cost_krw`가 있으면 그걸 최우선(실제 원가), 없으면 “스냅샷 원가(재질+공임+도금)”로 대체
2.  **margin_krw / margin_rate**
    * `margin_krw = total_amount_sell_krw - cost_basis_krw`
    * `margin_rate = margin_krw / nullif(total_amount_sell_krw, 0)`
3.  **정책 바닥선(floor) — UNIT/MANUAL**
    * config: `cms_market_tick_config(DEFAULT).unit_pricing_min_margin_rate`, `unit_pricing_rounding_unit_krw`
    * `floor_raw = cost_basis*(1+min_margin_rate)`
    * `floor_rounded = round_up(floor_raw, rounding_unit)`
    * `unit_total_sell` 계산(현재 로직과 동일한 식을 그대로 복제해 “시뮬레이션”)
    * `final_floor_sell = greatest(unit_total_sell, floor_rounded, material_amount_sell_krw)`
    * `floor_delta = final_floor_sell - total_amount_sell_krw`
    * `delta > 0`이면 “정책 적용 시 올려야 하는 금액(추정)”으로 표시
    * 중요: v1에서는 적용(UPDATE)하지 않고 delta만 보여준다.

### 7.4 다양한 분석 상황(사례) — 이해를 돕는 예시
* **예시 1) 마진 음수 (NEG_MARGIN)**
    * 상황: `sell_total`=₩110,000, `purchase_total_cost`=₩120,000 → `margin`=-₩10,000 (음수)
    * 분석 화면 표시: `leak_type=NEG_MARGIN`, `severity=HIGH`. “원가 확정(영수증 매칭) 후에도 음수인지” vs “임시원가라 과대추정인지”를 구분 표시
    * 운영자 액션(현재는 수동): 해당 라인 열어서 가격 조정 or 원가/매칭 점검
* **예시 2) 정책 바닥선 미달 (BELOW_FLOOR)**
    * 상황: `cost_basis`=₩80,000, `min_margin_rate`=0.20, `rounding`=₩5,000 → `floor_rounded`=100,000. 현재 `sell_total`=95,000 → `floor_delta`=+5,000
    * 분석 화면: “정책 미달 +₩5,000”, 근거: floor 계산식과 config 값 표시
    * 운영자 액션: 출고 확정 전에 수동으로 UNIT/MANUAL 판매가 조정
* **예시 3) 원가 미확정(PROVISIONAL_COST)인데 매출이 큼**
    * 상황: `purchase_cost_status=PROVISIONAL`, `sell_total`=₩3,500,000 (고액)
    * 분석 화면: “원가 미확정 리스크 노출(고액)” 배지
    * 운영자 액션: 원가 작업대/영수증 매칭 우선 처리(수동)
* **예시 4) 이상 할인/가격(OUTLIER_DISCOUNT)**
    * 상황: 동일 모델 최근 평균 단가 150,000인데 특정 거래처만 90,000
    * 분석 화면: “유사 출고 대비 -40%” + 근거 샘플(최근 10건)
    * 운영자 액션: 거래처 계약/특가 여부 확인(수동)

### 7.5 데이터 소스(DB) — v1에서 필요한 View/Read-only RPC(ADD-ONLY)
* (기존 활용) `cms_market_tick_config`, `cms_shipment_header`, `cms_shipment_line`, `cms_party`
* (기존 활용) `cms_v_purchase_cost_worklist_v1` (원가 누락)
* (신규 제안) `cms_v_an_leakage_lines_v1` (read-only view): 위에서 정의한 cost_basis/margin/floor_delta를 미리 계산해주는 뷰
* (신규 제안) `cms_fn_an_leakage_summary_v1(p_from date, p_to date, p_party_id uuid null)`: KPI를 JSON으로 반환(프론트 단순화)

### 7.6 수용 기준(Acceptance Criteria)
* 기간/거래처 필터가 적용될 것
* NEG_MARGIN / BELOW_FLOOR / PROVISIONAL_COST가 분리되어 보일 것
* 각 row에 “근거(숫자/계산식)”가 최소 1개 이상 표시될 것
* 링크 클릭 시 운영 화면으로 이동 가능할 것(새 탭 권장)

---

## 8. 모듈 2 — 강추 #8 “IntegrityShield: 정합성/데이터 품질 진단” (분석 전용)

### 8.1 목적
* “데이터 문제”는 매출/마진/미수에 직접적인 피해를 주는데, 운영 화면에서는 문제를 “경고”로 보기 어렵다 → 이슈 센터 형태로 한 화면에 모아 보여줌 (Read-only)
* **강추 이유**: 정합성이 깨지면 “분석도, 운영도” 다 망가집니다. 특히 이미 DB에 `v_cms_ar_sot_preflight_v1`, `v_cms_shipment_labor_integrity_v1` 같은 강력한 진단 뷰가 있으므로 바로 가치가 나옵니다.

### 8.2 화면: /analysis/integrity
* **A) Integrity Score(점수화)**: `Data Quality Score = 100 - Σ(이슈별 가중치 * 오픈건수 normalize)`. 표시 예: 92점(좋음) / 75점(주의) / 60점(위험). 목적: “지금 시스템 상태가 괜찮은지” 3초 컷
* **B) 섹션 구성(필수 4개)**: AR SOT 정합성, 출고 공임 정합성, 원가 데이터 완전성, 재고 예외

### 8.3 데이터 소스(이미 존재하는 강력한 진단)
* **AR SOT**: `v_cms_ar_sot_preflight_v1`, `cms_fn_ar_sot_monitoring_snapshot_v1(limit)` (요약 JSON), `cms_ar_sot_resolution_queue` (큐 상태)
* **공임 정합**: `v_cms_shipment_labor_integrity_v1`, `cms_fn_shipment_labor_integrity_summary_v1()`
* **원가 완전성**: `cms_v_purchase_cost_worklist_v1`
* **재고 예외**: `cms_v_inventory_exceptions_v1`

### 8.4 다양한 분석 상황(사례) — 예시
* **예시 1) AR invoice_total ≠ ledger_total (INVOICE_LEDGER_MISMATCH)**
    * 상황: 어떤 출고 `shipment_id`에서 `invoice_total`=₩1,200,000 vs `ledger_total`=₩1,150,000
    * 화면 표시: `has_invoice_ledger_mismatch=true`. “차액 ₩50,000” + 관련 `row_count`/`invoice_count` 표시
* **예시 2) 공임 extra_labor_krw vs items sum mismatch**
    * 상황: `extra_labor_krw`=₩30,000, `extra_labor_items sum`=₩20,000 → `delta`=₩10,000
    * 화면 표시: `mismatch_lines` + “delta_krw”
* **예시 3) 원가 링크 누락 (purchase_receipt_id null)**
    * 상황: 출고는 확정됐지만 영수증/원가 링크가 없음 → 마진 분석 불가/왜곡
    * 화면 표시: “원가 누락 worklist”를 그대로 노출 + 영향(매출 규모)로 정렬
* **예시 4) 재고 음수(NEGATIVE_STOCK)**
    * 상황: 특정 `item_name` `on_hand_qty`=-2
    * 화면 표시: `severity=HIGH`, details에 `last_move_at`

### 8.5 수용 기준(Acceptance Criteria)
* 각 섹션별 “오픈 이슈 수”가 한눈에 보일 것
* 이슈 리스트는 `severity`/`impact` 우선순위로 정렬될 것
* 최소 1개 이상 “드릴다운 상세” 제공(이유/근거 JSON)
* 운영 화면 링크 제공(수동 조치 유도)

---

## 9. 모듈 3 — 강추 #10 “MarketShock: 시세/정책/충격 모니터링” (분석 전용)

### 9.1 목적
* 시세가 오래되거나(스테일) 급변하면, 재질 금액, 판매가, 마진이 전부 흔들립니다. v1에서는 시세·정책 상태를 “운영이 아니라 분석에서” 감시하고, “이 정도 변동이면 가격정책(바닥선) 재검토 필요”까지 시뮬레이션
* **강추 이유**: 시세 기반 시스템에서 stale tick/급변은 가장 큰 리스크인데, 이미 `cms_v_market_tick_health_v1`, `cms_v_market_tick_daily_ohlc_v1` 같은 기반이 있어 즉시 구축 가치가 큼.

### 9.2 화면: /analysis/market
* **A) KPI 카드**: GOLD/SILVER 최신 시세(₩/g), age_minutes, stale 여부, 최근 7일 변동폭, 정책 현재값, “stale tick 의심 출고 라인 수”
* **B) 섹션 1: Tick Health**: `cms_v_market_tick_health_v1` 기반: symbol별 `age_minutes`, `is_stale`. TOP 경고: stale 심한 symbol 목록
* **C) 섹션 2: 변동성/충격(Volatility)**: `cms_v_market_tick_daily_ohlc_v1` 기반: 일별 OHLC, `tick_count`. 표시: “변동폭이 큰 날” TOP 10, `tick_count` 급감 표시
* **D) 섹션 3: 출고 영향(Impact)**: 기간 내 출고 라인에서 gold_tick/silver_tick의 `observed_at`이 너무 오래된 상태로 확정됐는지(추정). 출력: “시세 위험 노출 매출 합계(₩)” / “노출 라인 수”
* **E) 섹션 4: 정책 시뮬레이션(What-if) — Read-only**: 사용자가 분석 화면에서만 가정값을 조정 (`min_margin_rate`, `rounding_unit`). 결과: “추정 매출 증가(₩)”, “정책 미달 라인 수 변화”. 주의: 실제 적용/저장은 v1에서 금지(버튼 없음)

### 9.3 예시
* **예시 1) SILVER stale**: SILVER `last_observed_at`이 8시간 전 → `is_stale=true`. Impact 섹션에서 stale 상태로 확정된 출고가 12건 표시.
* **예시 2) 정책 시뮬레이션**: `min_margin` 0.20 → 0.25로 가정 시 추정 `floor_delta` 합계가 +₩2,450,000. “단, 고객 반발/수요 감소 가능” 안내문 제공.

### 9.4 수용 기준
* Tick Health가 즉시 보일 것
* 정책값(현재 config)이 읽히고 표시될 것
* What-if 시뮬레이션이 저장 없이 동작할 것
* Impact 계산 결과가 “근거와 함께” 제공될 것

---

## 10. 모듈 4 — 강추 #2 “SalesPriority: 영업 우선순위/타겟팅” (분석 전용)

### 10.1 목적
* “어느 거래처에 먼저 연락/방문/제안할지”를 데이터로 정렬해서 영업 시간을 매출로 전환하는 효율을 극대화
* **강추 이유**: 영업은 “누굴 먼저 만나느냐”가 돈입니다. 시스템 데이터(출고/미수/반품/마진)를 엮으면 바로 우선순위가 나옵니다(ML 없이도 1차 성과).

### 10.2 화면: /analysis/sales-priority
* **A) KPI 카드**: Active 고객 수, Top 20 고객 매출 비중, 재구매율, AR 리스크 고객 수
* **B) 탭 2개(필수)**: 매출 기회 우선 (Growth) / 회수/리스크 우선 (Risk)
* **C) 거래처 테이블(필수 컬럼)**: `customer_party_id`, `customer_name`, Recency, Frequency, Monetary, Margin, AR Outstanding, Overdue, Priority Score(0~100), “이유(Reason)” 요약 텍스트, “바로가기 링크”

### 10.3 스코어링 설계(v1: 룰 기반 + v2: ML 확장)
* **v1 룰 기반**: RFM 기반 점수 + 추가 가중치(margin_rate 높음+, AR overdue 있음-). 최종: `growth_score`, `risk_score`
* **v2 ML(분석 모드에서만 실험)**: “향후 14일 내 주문 가능성(Propensity)” 예측. Logistic Regression → XGBoost 등.

### 10.4 예시
* **예시 1) Growth TOP 고객**: A거래처 고액+고마진+3주 무구매 → Reason: “리마인드/신상품 제안 적기”
* **예시 2) Risk TOP 고객**: B거래처 AR 고액+정합성 이슈 → Reason: “회수 우선 + 출고 조건 재협상 필요”

### 10.5 수용 기준
* 최소 최근 90일 기준 우선순위가 계산되어 정렬될 것
* Growth/Risk 탭이 분리되어 목적별로 바로 쓰일 것
* 각 거래처 row에 “Reason”가 반드시 표시될 것

---

## 11. 모듈 5 — 강추 #3 “NextBestOffer: 추천/교차판매” (분석 전용)

### 11.1 목적
* “거래처별로 무엇을 제안하면 주문이 날 확률이 높은지”를 보여줘서 영업/상담 시 바로 쓸 수 있는 추천 리스트 제공
* **강추 이유**: 추천은 ‘기능’보다 ‘리스트’가 먼저입니다. 분석 모드에서 추천이 먹히는지 검증하고, 먹히면 v2에서 주문/견적 기능에 연결하면 됩니다.

### 11.2 화면: /analysis/recommendations
* **A) 화면 구성**: 상단: 거래처 선택 + 기간 + 추천 개수. 좌측: 거래처 구매 프로필 요약. 우측: 추천 리스트 TOP 10 (추천 품목, 점수, 근거, 근거 데이터, 링크)
* **B) 추천 알고리즘(v1: SQL 기반 온디맨드)**: Seed: 해당 거래처가 최근 180일에 산 상위 N개 모델. Co-occurrence: 전체 거래 데이터에서 seed와 같이 등장한 모델 찾기. Filter: 최근 구매 품목 제외 옵션.
* **C) v2 고도화(ML/임베딩 추천)**: Two-tower, Matrix Factorization 등 분석 모드에서 먼저 실험.

### 11.3 예시
* **예시 1) 교차판매**: “925 실버 목걸이” 자주 구매 고객에게 “925 펜던트 A” 추천. 근거: “최근 180일 동시 구매 42회”.
* **예시 2) 재고 기반 추천**: 재고 있는 품목 가산점. 근거: “유사 고객 구매 + 현재 재고 5개 보유”.

### 11.4 수용 기준
* 거래처 선택 시 2초~5초 내 추천 결과 표시
* 추천 10개 각각에 “근거 문장”이 반드시 표시
* 드릴다운으로 근거 샘플 확인 가능

---

## 12. 분석 모드 “Overview” — 전체 요약 대시보드

### 12.1 화면: /analysis/overview
목적: 30초 안에 “오늘/이번달 시스템 상태”를 요약
* **돈 새는 곳 요약**: NEG_MARGIN count, BELOW_FLOOR count 등
* **정합성 요약**: AR SOT mismatch count, labor mismatch count 등
* **시세 요약**: gold/silver stale 여부, 변동폭
* **영업/추천 요약**: Growth TOP 5 고객 등
* **“Top Issues” 통합 리스트**: severity + impact 기준으로 10개만

---

## 13. 현재 데이터 관리(현황 분석) + v1에서의 개선 방향(읽기 전용)

### 13.1 현재 상태(레포 기준 확인된 강점)
* DB가 `public.cms_*`로 통합되어 있고, 진단용 뷰·함수가 이미 존재함. 분석 모드는 이미 있는 진단을 UX로 묶는 작업임.

### 13.2 현재 리스크(분석 관점)
* 원가/시세/공임/미수의 연결이 조금만 어긋나도 마진 분석이 왜곡될 수 있음. 분석 탭은 confidence(신뢰도)를 함께 보여줘야 함.

### 13.3 v1에서 도입할 “분석용 데이터 관리 원칙”
* 모든 분석 지표는 정의(공식)와 근거를 포함. 데이터 신선도 및 품질(Integrity Score) 고정 표시. 성능을 위해 read-only RPC 사용.

---

## 14. 기술 요구사항(구현 수준으로 구체화)

### 14.1 프론트엔드 변경(업무 로직 변경 없이)
1.  **모드 감지**: `pathname.startsWith("/analysis")`
2.  **좌측 상단 아이콘 클릭 동작**:
    * 현재 path를 `localStorage`(`cms_last_path_app`, `cms_last_path_analysis`)에 저장
    * 반대 모드의 last_path로 `router.push` (없으면 기본 `/dashboard` 또는 `/analysis/overview`)
3.  **좌측 네비게이터 교체**: `nav-items-analysis.ts` 신설 및 mode에 따라 선택
4.  **Breadcrumbs/CommandPalette**: 모드별로 분리하여 검색 대상 및 매칭 로직 변경
5.  **분석 라우트 추가**: Next.js route `/analysis/*` (Client Component + React Query 사용)

### 14.2 백엔드(DB) — ADD-ONLY 분석 뷰/함수/인덱스
* **원칙**: 기존 테이블/함수 변경 금지. 신규 오브젝트 명명 규칙 `cms_v_an_*`, `cms_fn_an_*`.
* **신규 제안 오브젝트(최소)**:
    * `cms_v_an_leakage_lines_v1`: `shipment_line` + `header` + `party` join. cost_basis, margin 등 계산 컬럼 제공.
    * `cms_fn_an_leakage_summary_v1`: KPI JSON 반환.
    * `cms_fn_an_overview_summary_v1`: overview KPI JSON 반환.
    * `cms_v_an_sales_rfm_v1`: party별 RFM 계산.
    * `cms_fn_an_party_reco_preview_v1`: 추천 결과 JSON 반환.
* **성능 인덱스(ADD-ONLY)**: `cms_shipment_header(status, ship_date)`, `cms_shipment_line(master_id)` 등.

---

## 15. QA / 테스트 체크리스트(수동 + 회귀)

### 15.1 모드 전환 테스트
* [ ] 업무 화면 로고 클릭 → `/analysis/overview` 이동
* [ ] 분석 화면 로고 클릭 → 마지막 업무 화면 복귀
* [ ] 분석 모드 진입 시 네비게이션이 전용 메뉴로 변경
* [ ] CommandPalette 검색 결과가 모드에 맞게 필터링

### 15.2 ProfitGuard(누수) 테스트
* [ ] 필터 변경 시 KPI/리스트 즉시 갱신
* [ ] NEG_MARGIN 리스트 정렬 확인
* [ ] BELOW_FLOOR 계산 근거 표시 확인
* [ ] 링크 클릭 시 새 탭으로 운영 화면 이동

### 15.3 IntegrityShield 테스트
* [ ] AR SOT monitoring snapshot 표시
* [ ] labor integrity mismatch 라인 및 delta 확인
* [ ] 원가 누락 리스트 노출 확인

### 15.4 MarketShock 테스트
* [ ] tick health (stale/age) 표시
* [ ] what-if 시뮬레이션 동작(저장 없이 결과만 변함) 확인

### 15.5 SalesPriority 테스트
* [ ] RFM/스코어 계산 및 정렬 확인
* [ ] Growth/Risk 탭 분리 동작
* [ ] 모든 row에 Reason 표시 확인

### 15.6 NextBestOffer 테스트
* [ ] 거래처 선택 후 추천 결과(10개) 반환 속도 및 정확도
* [ ] 추천 근거 문장 및 드릴다운 샘플 확인

---

## 16. 롤아웃 전략(안전하게)
* **v1 릴리즈**: 분석 모드 탭 기본 노출(또는 feature flag)
* **초기 1~2주**: 운영자는 분석 보고 수동 조치만 수행. 피드백 수집.
* **v2 후보(나중)**: ProfitGuard 적용 버튼, Integrity 자동 fix, SalesPriority 태스크 생성, Recommendation 주문 연동 등.

---

## 결론: v1 구현 범위 요약(딱 지금 원하는 형태)
* ✅ 분석 모드를 별도 탭으로 만들고(좌측 상단 아이콘 클릭 전환)
* ✅ 좌측 네비게이션이 분석 전용으로 바뀌며
* ✅ 기존 업무 로직은 단 1도 안 건드리고
* ✅ 강추 #1/#8/#10/#2/#3을 읽기 전용 분석 페이지로 완성
* ✅ 분석이 검증되면 v2에서 “적용/자동화”를 안전하게 붙일 수 있도록 설계