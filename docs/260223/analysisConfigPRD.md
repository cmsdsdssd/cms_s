# [CODING AGENT PRD] Analysis 탭(v1.1) 신뢰도/필터 정합/시각화 고도화

**대상:** `web/src/app/(app)/analysis/*` + `supabase/migrations/*`  
**목적:** “분석 탭 숫자를 믿고 바로 의사결정할 수 있게” 데이터 정합성(필터/단위/정의) + 시각화(추세/분해) 를 v1.1로 완성

---

## 0) 프로젝트 룰(절대 위반 금지)

* **기존 업무 로직/쓰기 플로우 변경 금지**
    * 주문/출고/미수/원가 확정 등 기존 RPC/테이블의 UPDATE/INSERT 흐름 손대지 말 것.
    * 분석은 Read-only 유지.
* **DB 마이그레이션은 ADD-ONLY**
    * 기존 migration 파일 수정 금지.
    * 신규 migration 파일명은 repo 내 가장 큰 타임스탬프보다 미래로 생성 (예: `20260223120000_*`).
* **기존 분석 v1 오브젝트는 유지(호환)**
    * 가능하면 새 버전(`*_v2`)을 추가하고, 프론트만 v2로 전환.
    * 불가피할 때만 `create or replace`로 v1 교체(단, 위험도 명시 + 롤백 플랜 포함).
* **RPC 패턴**
    * `SECURITY DEFINER`
    * `set search_path = public, pg_temp`
    * 필요한 `grant execute` / `grant select` 추가
* **성능 가드레일 유지/강화**
    * 기본 조회 기간 30일, 180일 초과 경고 유지.
    * 테이블 기본 500행 이하(필터 후 적용), Export는 10k 제한(또는 서버 Export 별도).

---

## 1) 현행 문제(코드/DB 근거 기반) — 반드시 해결(P0)

### 1.1 단위(Unit) 혼용으로 KPI가 “거짓말”이 됨
* `cms_fn_an_overview_summary_v1`의 `top_issues.impact_krw`에 금액(KRW) + 건수(count) 가 섞여 있음
* UI(`web/src/app/(app)/analysis/overview/page.tsx`)는 전부 `formatKrw()`로 렌더 → 건수도 원화로 표시됨
* ✅ **해결 방향:** `impact_value` + `impact_unit(KRW/COUNT)` 로 분리(또는 impact_label 제공)

### 1.2 “기간 필터”가 페이지마다 적용/미적용이 섞여 사용자 신뢰 붕괴
* **Integrity:** UI는 from~to를 보여주지만, `cms_fn_an_integrity_snapshot_v1(p_limit)`는 기간 파라미터가 없음. labor/inventory 섹션도 기간 미적용.
* **SalesPriority:** `cms_v_an_sales_rfm_v1`가 `as_of_date=current_date` 고정 → UI 기간 필터 의미 없음.
* **Leakage:** Summary RPC(`cms_fn_an_leakage_summary_v1`)는 party/material/status 필터 미반영, 테이블은 client filter(그리고 limit 500 후 필터).
* ✅ **해결 방향:** “기간 필터의 의미”를 페이지별로 명확히 정의하고, KPI/테이블/차트 모두 동일 필터를 공유하도록 DB+UI 동시 정리

### 1.3 What-if 시뮬레이션이 사실상 0 또는 무의미
* MarketShock(`web/src/app/(app)/analysis/market/page.tsx`)에서 What-if는 `leak_type='STALE_TICK'`의 `floor_delta_krw` 합을 기반으로 계산.
* 그런데 `cms_v_an_leakage_lines_v1`의 `STALE_TICK`은 `floor_delta_krw`가 대부분 0이 되는 구조(조건 순서상) → base가 0이기 쉬움.
* ✅ **해결 방향:** 정책(min_margin, rounding_unit)을 실제로 재계산하는 서버 RPC로 변경.

### 1.4 추천 토글이 동작하지 않거나, 로직이 성립하지 않음
* **Recommendations:** `excludeRecent`, `stockBoost`가 React Query `queryKey`에 없음 → 토글 변경해도 결과가 즉시 바뀌지 않음.
* `excludeRecent`는 `reason_text`에 "최근 구매" 포함 여부로 필터링하지만, DB `reason_text`는 "최근 180일 동시 구매 …" 형태 → 거의 항상 미스매치.
* `stockBoost`는 `reason_text`에 "유사고객" 포함이면 +0.5인데, `reason_text`가 항상 “유사고객 …곳” 포함 → 항상 +0.5.
* ✅ **해결 방향:** 토글/옵션을 서버 파라미터로 공식화하고, `queryKey` 포함.

### 1.5 Copy Link / CSV Export가 “분석용”으로 불충분
* **Copy link:** 필터 상태가 URL에 없어서 “현재 필터 링크 복사”가 사실상 불가능.
* **CSV Export:** `toCsv()`가 object/array를 `[object Object]`로 내보냄 → evidence를 분석에 재사용 불가.
* ✅ **해결 방향:** 1. 필터를 URL querystring과 동기화
    2. CSV stringify 규칙 개선

---

## 2) v1.1 목표(Goals) / 비목표(Non-Goals)

### 2.1 목표(Goals)
* **필터 정합성 100%:** 같은 화면에서 KPI/차트/테이블 수치가 동일 필터 기준으로 일치.
* **단위/정의 명확화:** Count를 KRW로 표시하는 오류 0건.
* **추세 기반 의사결정 지원(시각화 최소 1개/페이지):** 각 분석 페이지에 “추세(일별)” 또는 “분해(top N)” 차트 최소 1개 제공.
* **What-if 시뮬레이션**이 ‘실제 계산’ 기반으로 의미 있게 동작.
* **추천/영업 우선순위**의 필터 UX를 실제 모델(RFM/Reco)과 맞게 재정의.

### 2.2 비목표(Non-Goals)
* 분석 탭에서 정책 저장/적용/자동 조치(UPDATE/INSERT) 제공 (v2).
* 외부 BI 도구 도입 / 대규모 신규 인프라(DWH, 스트리밍).
* 대형 차트 라이브러리 추가(우선 SVG 기반 경량 컴포넌트).

---

## 3) 핵심 설계 원칙(데이터 분석 관점)

1.  **Measure(측정값)와 Unit(단위)를 분리**
    * `impact_value` + `impact_unit` 기본.
    * UI는 unit에 따라 포맷터를 선택.
2.  **기간(Period)과 기준시점(As-of)을 분리**
    * Period: from~to (KST date, inclusive).
    * As-of: now() 또는 “데이터 기준 시각” (timestamp).
    * 페이지마다 “이 KPI는 Period 기반 / 이 KPI는 As-of 기반”을 명시(툴팁/라벨).
3.  **요약 ↔ 드릴다운 일관성**
    * KPI는 “드릴다운 테이블의 필터/범위”와 동일해야 함.
    * 테이블이 Top 500 제한이면 KPI도 “Top500 기준”으로 만들지 말고, 서버에서 전체 집계.
4.  **시각화는 1) 방향(추세), 2) 기여도(파레토) 우선**
    * fancy 차트보다 “의사결정에 필요한 2개”를 고정.

---

## 4) 데이터 계약(DB) — 신규 v2 오브젝트 제안

신규 migration 예시: `supabase/migrations/20260223120000_cms_0801_analysis_mode_v1_1_hardening.sql`

### 4.1 `cms_fn_an_overview_summary_v2(p_from date, p_to date)` returns `jsonb`
* **목적:** overview KPI + top issues를 단위 분리 + (가능하면) 전기(이전 기간) 비교 포함.
* **반환 스키마(제안):**
```json
{
  "as_of": "2026-02-23T12:34:56Z",
  "period": { "from": "2026-01-24", "to": "2026-02-23", "days": 31 },
  "leakage": { ... },
  "integrity": { ... },
  "market": { ... },
  "sales": { ... },
  "recommendations": { ... },
  "top_issues": [
    {
      "title": "NEG_MARGIN lines",
      "severity": "HIGH",
      "impact_value": 12345678.0,
      "impact_unit": "KRW",
      "href": "/analysis/leakage",
      "meta": { "leak_type": "NEG_MARGIN" }
    },
    {
      "title": "AR invoice/ledger mismatch",
      "severity": "HIGH",
      "impact_value": 12,
      "impact_unit": "COUNT",
      "href": "/analysis/integrity"
    }
  ]
}
```
* **구현 포인트:**
    * 기존 v1 top_issues CTE를 그대로 쓰되:
    * 금액/건수는 impact_value로 통일.
    * impact_unit을 KRW / COUNT로 지정.
    * (선택) meta에 기준 필터를 넣어 “클릭 → 같은 조건으로 드릴다운” 가능하게 확장.

### 4.2 Leakage 정합성: Summary/Trend/Breakdown을 “동일 파라미터”로 제공

#### 4.2.1 `cms_fn_an_leakage_summary_v2(...)` returns `jsonb`
* **시그니처(제안):**
```sql
cms_fn_an_leakage_summary_v2(
  p_from date,
  p_to date,
  p_status text default null,          -- 'DRAFT'/'CONFIRMED'/null(전체)
  p_party_id uuid default null,
  p_material_code text default null
) returns jsonb
```
* **반환(예시):**
```json
{
  "as_of": "...",
  "filters": { "from": "...", "to": "...", "status": "CONFIRMED", "party_id": null, "material_code": null },
  "totals": { "sell_krw": 0, "cost_krw": 0, "margin_krw": 0 },
  "counts": { "neg_margin": 0, "below_floor": 0, "provisional": 0, "stale_tick_suspected": 0 },
  "impact": { "neg_margin_abs_krw": 0, "below_floor_delta_krw": 0 }
}
```
* **주의:** stale_tick은 “leak_type”이 아니라 `stale_tick_suspected` 기준으로 별도 count/impact 제공 권장(현재 분류 로직상 STALE_TICK만으로는 누락 많음).

#### 4.2.2 `cms_fn_an_leakage_trend_daily_v1(...)` returns `jsonb`
* 일별(또는 주별) 추세용.
* 최소 컬럼: `day`, `neg_margin_abs_krw`, `below_floor_delta_krw`, `provisional_sell_krw`, `total_sell_krw`.

#### 4.2.3 `cms_fn_an_leakage_breakdown_v1(...)` returns `jsonb`
* Pareto(Top N) 분해용.
* 축: by_party, by_material, by_model 중 1~2개만 v1.1에 포함.
* 반환: `[ {key, impact_krw, count} ]`.

### 4.3 Integrity 정합: “현재 오픈” vs “기간 발생”을 분리해 snapshot 제공

#### 4.3.1 `cms_fn_an_integrity_snapshot_v2(p_from date, p_to date, p_limit int default 200)` returns `jsonb`
* **반환 구조(제안):**
```json
{
  "as_of": "...",
  "period": { "from": "...", "to": "..." },
  "ar": {
    "current": { "invoice_ledger_mismatch_count": 0, "party_level_mismatch_count": 0, "release_gate_green": true },
    "in_period": { "invoice_ledger_mismatch_count": 0, "ship_invoice_mismatch_count": 0 },
    "top_rows": [ { "shipment_id": "...", "confirmed_at": "...", "diff_krw": 50000, "flags": {...} } ]
  },
  "labor": {
    "current": { "mismatch_lines": 0 },
    "in_period": { "mismatch_lines": 0 },
    "top_lines": [ { "shipment_line_id": "...", "delta_krw": 10000, "shipment_status": "CONFIRMED" } ]
  },
  "cost": {
    "in_period_missing_count": 0,
    "top_lines": [ { "shipment_line_id": "...", "ship_date": "...", "sell_krw": 3500000 } ]
  },
  "inventory": {
    "open_exception_count": 0,
    "by_type": [ { "exception_type": "NEGATIVE_STOCK", "count": 3, "severity": 1 } ],
    "top_rows": [ { "exception_type": "...", "severity": 1, "occurred_at": "...", "details": {...} } ]
  }
}
```
* **구현 메모:**
    * AR: `v_cms_ar_sot_preflight_v1`는 `confirmed_at`이 있으므로 기간 필터 가능 → `confirmed_at::date between p_from and p_to`.
    * Labor: `v_cms_shipment_labor_integrity_v1`는 `confirmed_at` 있음 → 기간 필터 가능.
    * Cost: `cms_v_purchase_cost_worklist_v1`의 `ship_date`로 기간 필터.
    * Inventory exceptions: 본질적으로 “오픈 상태” → 기간과 무관, open으로 명시.

### 4.4 MarketShock What-if를 “진짜 정책 계산”으로 제공

#### 4.4.1 `cms_fn_an_market_policy_whatif_v1(...)` returns `jsonb`
* **시그니처(제안):**
```sql
cms_fn_an_market_policy_whatif_v1(
  p_from date,
  p_to date,
  p_status text default 'CONFIRMED',
  p_min_margin_rate numeric,
  p_rounding_unit_krw numeric
) returns jsonb
```
* **반환(예시):**
```json
{
  "as_of": "...",
  "period": { "from": "...", "to": "..." },
  "baseline": { "min_margin_rate": 0.2, "rounding_unit_krw": 5000, "total_floor_delta_krw": 1200000, "impacted_lines": 83 },
  "candidate": { "min_margin_rate": 0.25, "rounding_unit_krw": 10000, "total_floor_delta_krw": 2200000, "impacted_lines": 120 },
  "incremental": { "delta_krw": 1000000, "delta_lines": 37 }
}
```
* **구현 포인트:**
    * baseline은 `cms_market_tick_config(DEFAULT)` 사용(현재 정책).
    * candidate는 입력 파라미터 사용.
    * floor 계산은 `cms_v_an_leakage_lines_v1` 로직과 동일 공식 복제(단, `material_floor_krw`(=material_amount_sell_krw) 포함 필요).
    * 필요 시: v2 leakage view를 만들거나, what-if 함수 내부에서 `shipment_line` 직접 계산.

### 4.5 SalesPriority(RFM) — “기간 from/to” 대신 as_of + window_days로 재설계

#### 4.5.1 `cms_fn_an_sales_rfm_v2(p_as_of date, p_window_days int default 90, p_limit int default 300)` returns table
* 기존 `cms_v_an_sales_rfm_v1`는 current_date 고정이라 UX/공유 불가.
* v1.1 목표: 사용자가 as_of를 선택할 수 있게.
* **반환 컬럼(현재 SalesRow 호환):**
    * customer_party_id, customer_name
    * as_of_date
    * recency_days
    * frequency_window
    * monetary_window_krw
    * margin_rate_window
    * ar_outstanding_krw (현재시점 기준이면 “as-of가 과거여도 현재 AR”임을 UI에 명시)
    * growth_score, risk_score
    * reason_text, app_link

### 4.6 Recommendations — 토글/옵션을 서버 파라미터로 공식화

#### 4.6.1 `cms_fn_an_party_reco_preview_v2(...)` returns `jsonb`
* **시그니처(제안):**
```sql
cms_fn_an_party_reco_preview_v2(
  p_party_id uuid,
  p_from date,
  p_to date,
  p_limit int,
  p_exclude_recent_days int default 90,
  p_stock_boost boolean default true
) returns jsonb
```
* **반환(예시):**
```json
[
  {
    "model_name": "...",
    "base_score": 7.5,
    "stock_on_hand_qty": 12,
    "final_score": 8.1,
    "reason_text": "...",
    "evidence": {...},
    "app_link": "/catalog?model=..."
  }
]
```
* **구현 포인트:**
    * “최근 구매 제외”는 문자열 매칭이 아니라: 해당 party의 최근 N일 구매 모델 set을 만들고 제외.
    * “재고 가산점”은 reason_text가 아니라: `cms_master_item(model_name)` → `cms_v_inventory_position_by_master_item_v1` join해서 `on_hand_qty` 기반 boost.
    * 매칭이 어려우면 v1.1에서는 `stock_on_hand_qty`만 표시하고 boost는 P1로 미룸.

---

## 5) 프론트엔드 설계(구현 지시서 수준)

### 5.1 공통: 필터를 URL과 동기화(= Copy Link가 진짜가 되게)
* **신규 훅 제안:** `web/src/components/analysis/use-analysis-query-state.ts`
    * `getDefaultPeriod()` (30일)
    * `useAnalysisQueryState(schema)`
    * schema 예: `{ from: date, to: date, status?: string, partyId?: string, material?: string }`
    * `useSearchParams()`로 초기값 로드.
    * state 변경 시 `router.replace()`로 querystring 업데이트(Shallow).
* **적용 대상 페이지:**
    * `/analysis/overview`
    * `/analysis/leakage`
    * `/analysis/integrity`
    * `/analysis/market`
    * `/analysis/sales-priority` (단, UX는 as_of + window로 변경)
    * `/analysis/recommendations`
* ✅ **수용 기준:** 필터를 바꾸고 URL을 복사해 새 탭에 열면 동일 조건으로 재현되어야 함.

### 5.2 공통: Refresh/Freshness 개선
* **문제:** 각 페이지 Refresh 버튼이 일부 쿼리만 refetch함(요약/테이블 불일치 가능).
* **개선:**
    * `AnalysisHeaderRefresh`는 페이지에서 `Promise.all([refetchA, refetchB, ...])`로 연결.
    * `AnalysisFreshnessBadge`는 단순 “최신”이 아니라 as_of를 표시하거나 최소 “데이터 기준 시각: YYYY-MM-DD HH:mm (KST)” 문구 제공.

### 5.3 공통: CSV Export 품질 개선
* **변경 파일:** `web/src/components/analysis/analysis-helpers.ts`의 `toCsv()`.
* **요구사항:**
    * 값이 object/array면 `JSON.stringify(value)`로 넣기.
    * 줄바꿈/따옴표 escape는 현행 유지.

### 5.4 공통: 경량 차트 컴포넌트 추가(의존성 추가 금지)
* **신규 컴포넌트 제안:**
    * `web/src/components/analysis/charts/LineChart.tsx` (SVG)
    * `web/src/components/analysis/charts/BarList.tsx` (Top N 가로 막대)
* 스타일은 CSS 변수 기반(테마 연동).
* ✅ **최소 목표:** 각 페이지당 1개 이상: (Trend 또는 Breakdown) 차트 제공.

---

## 6) 페이지별 상세 요구사항

### 6.1 `/analysis/overview` — “단위/정합/추세”가 보이는 진짜 요약
* **변경 사항:**
    * RPC를 `cms_fn_an_overview_summary_v2`로 교체.
    * Top issues: `impact_unit=KRW` → `formatKrw()`, `impact_unit=COUNT` → `${n}건`.
    * (P1) “기간 내 누수 추세” 미니 차트 추가. 데이터: `cms_fn_an_leakage_trend_daily_v1` 또는 overview v2에 trend 포함.
* **수용 기준:**
    * AR mismatch가 **₩가 아니라 “건수”**로 표시.
    * period 변경 시 Top issues와 Leakage/Integrity 요약 KPI가 동시에 변함.

### 6.2 `/analysis/leakage` — KPI/필터/테이블이 100% 일치 + 추세/파레토
* **변경 사항(P0):**
    * **필터 정의 통일:** status(DRAFT/CONFIRMED/ALL), party_id 기반, material_code.
    * **rowsQuery:** 서버 필터 후 order/limit 적용. `queryKey`에 status/partyId/materialCode 포함. `.eq(...)`/`.ilike(...)` 등을 DB에 적용 후 `.order(abs_impact_krw).limit(500)`.
    * **summaryQuery:** `cms_fn_an_leakage_summary_v2` 사용. rowsQuery 필터와 완전히 동일 파라미터로 호출.
    * **“PROVISIONAL 고액 TOP 20” 표시 기준 수정:** 현재 `cost_basis_krw` 표시 → `sell_total_krw`(노출 매출) 또는 `abs_impact_krw`로 표준화(둘 중 1개 결정). 권장: `sell_total_krw`.
    * **OUTLIER_DISCOUNT 관련 UI 제거/비활성(P0):** DB가 해당 leak_type을 생성하지 않으므로 v1.1에서는 UI에서 제거하거나 “(미구현)” 배지로 표기.
* **시각화(P1):**
    * Trend(일별): below_floor_delta_krw / neg_margin_abs_krw 라인 차트.
    * Breakdown: Top 거래처(impact_krw) BarList.
* **수용 기준:**
    * 같은 필터에서 KPI 합계와 테이블(전체 집계 기준) 논리적으로 일치.
    * party/material 필터는 Top500 샘플 편향 없이 적용(=필터 후 limit).

### 6.3 `/analysis/integrity` — “기간 발생”과 “현재 오픈”을 분리해 혼동 제거
* **변경 사항(P0):**
    * RPC를 `cms_fn_an_integrity_snapshot_v2(from,to,limit)`로 교체.
    * **UI 라벨을 명시적으로 분리:** “기간 내 발생(in period)”, “현재 오픈(current)”.
    * **드릴다운 강화:**
        * AR: mismatch top shipments 리스트.
        * Labor: mismatch top lines(delta 큰 순).
        * Cost: worklist 상위(매출 큰 순).
        * Inventory: exception_type별 count + severity 표시.
* **Data Quality Score 재정의(P1 권장):** 단순 count 합이 아니라 rate 기반(분모 포함). 최소한 “count 기반(현행)”이면 “실험용 점수”라고 명시.
* **수용 기준:**
    * 날짜 범위를 바꾸면 “in period” 수치는 바뀌고, “current open”은 그대로(=의도된 동작).
    * UI에 어떤 KPI가 period 기준인지 명확히 써있어야 함.

### 6.4 `/analysis/market` — 정책/시세/노출/What-if가 실제로 연결되게
* **변경 사항(P0):**
    * baseline 정책값을 config에서 읽기: `cms_market_tick_config(DEFAULT)`에서 로드해 input 초기값 세팅.
    * What-if는 `cms_fn_an_market_policy_whatif_v1`로 교체(근사치 금지).
    * “Stale 의심 출고 라인”은 `leak_type='STALE_TICK'`가 아니라 `stale_tick_suspected=true` 기준 집계(누락 방지).
    * **최신 시세(골드/실버) 카드 추가(P1):** `cms_v_market_tick_latest_gold_silver_v1` 사용.
* **시각화(P1):**
    * Tick health: age_minutes Top N bar/list.
    * OHLC: table 유지 + (선택) close 라인 차트.
* **수용 기준:**
    * min_margin/rounding을 바꾸면 delta_krw가 0이 아닌 의미 있는 값으로 변화.
    * “현재 정책값”과 “시뮬레이션 값”이 구분 표기.

### 6.5 `/analysis/sales-priority` — 필터 UX를 RFM 모델과 일치시키기
* **변경 사항(P0):**
    * 기간 from/to UI 제거 또는 “as_of + window_days”로 치환.
    * as_of: date picker 1개, window_days: 30/60/90/180 select.
    * **데이터 소스 교체:** `cms_fn_an_sales_rfm_v2(p_as_of, p_window_days, p_limit)` RPC 호출.
    * **숫자 포맷 통일:** monetary, AR는 KRW 포맷, R/F는 숫자 그대로.
* **시각화(P1):**
    * Growth vs Risk 산점도(간단 SVG). 사분면: “우선 영업(High growth, Low risk)”, “채권 리스크(High risk)” 카운트.
* **수용 기준:**
    * 필터(as_of/window)를 바꾸면 결과가 재계산되어 변한다.
    * 현재의 “기간 from/to” 착시가 사라진다.

### 6.6 `/analysis/recommendations` — 토글이 즉시 반영 + 의미 있는 제외/가산 로직
* **변경 사항(P0):**
    * **party selector UX 개선:** 고전적 드롭다운 대신 검색 input + `cms_party` ilike 조회.
    * **queryKey에 옵션 포함:** `excludeRecentDays`, `stockBoost`, `limit`, `from`, `to` 포함.
    * **서버 로직 교체:** `cms_fn_an_party_reco_preview_v2(...)` 호출.
    * “최근 구매 제외”는 정의된 N일 기반, “재고 가산점”은 (가능하면) inventory 기반.
* **수용 기준:**
    * 토글 클릭 즉시 리스트가 바뀐다(새로고침 없이).
    * “최근 구매 제외”가 실제로 제외를 만든다(0건이면 ‘해당 기간 구매 없음’ 표시).

---

## 7) 변경 파일/모듈 맵(코딩 에이전트용)

### Frontend
* `web/src/app/(app)/analysis/overview/page.tsx`
* `web/src/app/(app)/analysis/leakage/page.tsx`
* `web/src/app/(app)/analysis/integrity/page.tsx`
* `web/src/app/(app)/analysis/market/page.tsx`
* `web/src/app/(app)/analysis/sales-priority/page.tsx`
* `web/src/app/(app)/analysis/recommendations/page.tsx`
* `web/src/components/analysis/analysis-helpers.ts` (CSV)
* `web/src/components/analysis/analysis-common.tsx` (CopyLink, Freshness)
* **(신규)** `web/src/components/analysis/use-analysis-query-state.ts`
* **(신규)** `web/src/components/analysis/charts/*`

### DB (Supabase)
* **(신규)** `supabase/migrations/20260223120000_cms_0801_analysis_mode_v1_1_hardening.sql`
    * `cms_fn_an_overview_summary_v2`
    * `cms_fn_an_leakage_summary_v2`
    * `cms_fn_an_leakage_trend_daily_v1`
    * `cms_fn_an_leakage_breakdown_v1`
    * `cms_fn_an_integrity_snapshot_v2`
    * `cms_fn_an_market_policy_whatif_v1`
    * `cms_fn_an_sales_rfm_v2`
    * `cms_fn_an_party_reco_preview_v2`
    * 각 함수/뷰 권한 grant

---

## 8) QA/수동 테스트 체크리스트(필수 산출물)

1.  **Overview 단위:** Top issues에 count 항목이 ₩로 보이지 않는지 확인.
2.  **Leakage 필터 정합:** status/party/material 변경 시 KPI/테이블/Export가 같은 조건으로 바뀌는지.
3.  **Integrity 기간 vs 현재:** 날짜 바꿔도 “current open” 섹션은 유지되는지, “in period”는 바뀌는지.
4.  **Market What-if:** `min_margin`을 0.20→0.30으로 변경 시 `incremental.delta_krw` 증가 확인. `rounding_unit` 변경 시 delta 변동 확인.
5.  **SalesPriority:** as_of/window 변경 시 recency/frequency/monetary 재계산 확인.
6.  **Recommendations:** `excludeRecentDays` 켜고 끄면 결과가 즉시 변하는지. `stockBoost` on/off 점수/정렬 변화 확인.
7.  **Copy Link:** 필터 적용 후 링크 복사 → 새 탭 열기 → 동일 상태 재현.
8.  **CSV:** evidence/object 컬럼이 `[object Object]`가 아닌 JSON 문자열로 나오는지.

---

## 9) 우선순위/릴리즈 플랜

### P0 (반드시 v1.1)
* 단위 분리(overview top issues)
* 필터 정합(Leakage/Integrity/Sales/Reco)
* What-if 서버 재계산
* Copy link URL 동기화
* CSV export 개선
* Recommendations 토글/로직 정상화

### P1 (가능하면 v1.1, 아니면 v1.2)
* 페이지별 최소 1개 차트(Trend 또는 Breakdown)
* Integrity Score 재정의(rate 기반)
* Market 최신 시세 카드(골드/실버)

### P2 (v2 이후)
* OUTLIER_DISCOUNT 실제 탐지 로직(중앙값/분포 기반)
* 추천 재고/마진/가격조건까지 반영한 고급 스코어링
* 분석 화면에서 “액션(쓰기)” 제공

---

## 10) 완료 정의(Definition of Done)

* 모든 분석 페이지에서 “필터 → KPI/차트/테이블” 수치가 동일 기준으로 움직인다.
* Count는 Count로, KRW는 KRW로 표시(단위 혼용 0건).
* What-if는 입력을 바꾸면 결과가 의미 있게 변한다.
* Copy link로 상태 재현 가능.
* CSV를 내려받아 외부에서 재분석 가능한 형태(JSON 보존).