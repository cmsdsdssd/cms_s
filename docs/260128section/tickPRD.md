# PHASE2 — 시세관리(PRD) v1

* **SoT:** `public.cms_*` 고정
* **Write:** RPC(`public.cms_fn_*`) only
* **Read:** View(`public.cms_v_*`) 중심

---

## 0) 목표 (한 문장)

금/은 “원/그램” 최신값을 모든 페이지가 공통으로 참조할 수 있게 만들고, 수동 입력 및 자동 업서트가 동일 RPC를 통해 tick을 누락 없이 기록하게 하여 분석용 시계열 데이터를 확보한다.

---

## 1) 헌법 (절대 규칙)

* ✅ **SoT는 `public.cms_*`만 사용:** `ms_s` 스키마 조회/조인/이관 전부 금지.
* ✅ **Write는 RPC만:** `public.cms_fn_*`만 호출 (Base Table 직접 `INSERT`/`UPDATE`/`DELETE` 금지).
* ✅ **Read는 뷰 중심:** `public.cms_v_*`로 제공.
* ✅ **기록 보존:** “입/출 수량 불일치”가 있더라도, 시세는 이벤트/기록 누락 없이 남겨 분석 가능해야 함.

---

## 2) 백엔드 계약 (이미 구축된 “시세 v1” 기준)

*너가 방금 실행/확인한 흐름(역할 매핑 + 업서트 + ops 최신뷰)을 표준 계약으로 고정한다.*

### 2.1 핵심 컨셉: “symbol enum 직접 쓰지 말고 role로 접근”
* 과거 오류처럼 Enum에 "GOLD"가 없을 수 있음.
* 따라서 UI/자동화는 항상 `role_code='GOLD' | 'SILVER'`만 사용.
* `role_code` → `symbol(enum)` 매핑은 DB가 관리.

### 2.2 모든 페이지가 참조할 “최신 금/은 단일 뷰”
* **View(Ops):** `public.cms_v_market_tick_latest_gold_silver_ops_v1`
* **목적:** “금/은 최신값 한 줄”을 안정적으로 제공.
* **컬럼 예시:**
    * `gold_price_krw_per_g`, `gold_observed_at`, `gold_source`, `gold_tick_id`
    * `silver_price_krw_per_g`, `silver_observed_at`, `silver_source`, `silver_tick_id`
    * `as_of`
* ✅ **원칙:** 전 페이지는 ‘금/은 최신’이 필요하면 이 뷰만 조회한다. (환율 추가 시 뷰 확장)

### 2.3 입력(수동/자동) 공용 RPC
* **RPC:** `public.cms_fn_upsert_market_tick_by_role_v1(...)`
* **호출 주체:** 수동 입력(UI), 자동 수집(n8n/cron)
* **핵심 파라미터 정책:**
    * `p_role_code`: `'GOLD'` 또는 `'SILVER'`
    * `p_price_krw_per_g`: `numeric` (원/그램 고정)
    * `p_observed_at`: 관측시각 (없으면 `now`)
    * `p_source`: `'MANUAL'` | `'TEST'` | `'FEED_xxx'` 등
    * `p_meta`: `jsonb` (원천값/환산근거/스크래핑 URL 등 분석용)
    * `p_correlation_id`: 재시도/중복 방지 (가능하면 넣기)

### 2.4 분석을 위한 조회 뷰 (차트/히스토리)
* **Read 모델 고정 (ADD-ONLY):**
    * `public.cms_v_market_tick_series_v1`: 히스토리 테이블/차트용 (role, observed_at, price, source, meta 등)
    * `public.cms_v_market_tick_daily_ohlc_v1`: 일자별 OHLC (분석/차트)
    * `public.cms_v_market_tick_health_v1`: “마지막 관측 이후 몇 분 지났는지” (stale 알림)
    * `public.cms_v_market_symbol_role_active_v1`: `role_code` ↔ `symbol_label` (운영 상태 확인)
* **원칙:** 시세 페이지는 Base Table 직접 조회 금지. 필요한 컬럼은 뷰로 노출.

### 2.5 회귀 테스트 (5개 고정)
1.  `role` ↔ `symbol` 매핑이 활성 상태로 2개(`GOLD`/`SILVER`) 존재.
2.  `cms_fn_upsert_market_tick_by_role_v1` 호출 → `tick_id` 반환 + `latest` 반영 확인.
3.  `cms_v_market_tick_latest_gold_silver_ops_v1`가 금/은 각각 최신 1개를 정상 반환.
4.  `daily_ohlc` 뷰가 날짜 버킷으로 정상 집계.
5.  `health` 뷰가 `last_observed_at` / `age_minutes`를 정상 계산.

### 2.6 시드데이터 재현 세트 (리셋/데모용)
* **구성:** GOLD 3개, SILVER 3개 (`observed_at` 서로 다른 시각).
* **Source:** `MANUAL`, `TEST`, `FEED_DEMO` 혼합 (`meta` 포함).
* **목표:**
    * 히스토리 테이블 (최소 6줄)
    * 차트 (최소 3포인트)
    * “Latest Ops View”가 금/은 최신값을 잡는지 확인.

---

## 3) 프론트엔드(Next.js) 구현 PRD — repo(zip) 기준

### 3.1 라우팅/네비게이션
* **신규 페이지:** `web/src/app/(app)/market/page.tsx`
* **사이드바 메뉴 추가:**
    * 파일: `web/src/components/layout/sidebar.tsx`
    * 항목: `{ href: "/market", label: "시세", icon: TrendingUp }` (또는 LineChart)

### 3.2 contracts.ts에 뷰/함수 등록
* **파일:** `web/src/lib/contracts.ts`
* **View 추가:**
    ```typescript
    views.marketLatestGoldSilverOps = "cms_v_market_tick_latest_gold_silver_ops_v1";
    views.marketSeries = "cms_v_market_tick_series_v1";
    views.marketDailyOhlc = "cms_v_market_tick_daily_ohlc_v1";
    views.marketHealth = "cms_v_market_tick_health_v1";
    views.marketRoleActive = "cms_v_market_symbol_role_active_v1";
    ```
* **Function 추가 (env 방식):**
    ```typescript
    functions.marketTickUpsertByRole = process.env.NEXT_PUBLIC_CMS_FN_MARKET_TICK_UPSERT_BY_ROLE ?? "cms_fn_upsert_market_tick_by_role_v1";
    ```

### 3.3 화면 구성 (최소 완성 형태)

#### 상단 (ActionBar)
* **제목:** 시세관리
* **서브:** 금/은 원/그램 입력 및 추이

#### 좌측 (SplitLayout Left) — 현재값 + 입력
1.  **“현재 금/은” 카드 2개**
    * 데이터: `cms_v_market_tick_latest_gold_silver_ops_v1`
    * 표시: 가격(₩, 천단위), 관측시각(KST), Source(Badge), Health 기반 Stale 표시(60분 이상 "지연" 배지)
2.  **수동 입력 폼**
    * Role 선택: `GOLD` / `SILVER` (라벨: 금 / 은)
    * `observed_at`: datetime-local (기본값=현재 KST)
    * `price_krw_per_g`: 숫자 입력 (원/그램)
    * `source`: 기본 `MANUAL` (옵션 `TEST` 가능)
    * `meta`/`note`: 옵션 (텍스트 → `meta`로 래핑)
    * **저장 버튼:**
        * RPC: `cms_fn_upsert_market_tick_by_role_v1`
        * 성공 시: Toast Success, 쿼리(Latest/Series/OHLC) Invalidate

#### 우측 (SplitLayout Right) — 히스토리 + 차트
1.  **히스토리 테이블**
    * 데이터: `cms_v_market_tick_series_v1` (최근 N개)
    * 필터: Role(ALL/GOLD/SILVER), 기간(7/30/90일 - `gte` filter)
    * 컬럼: `observed_at`(KST), `role`(금/은), `price_krw_per_g`, `source`, `meta`(요약, 옵션)
2.  **차트 (v1은 라이브러리 추가 없이 간단 SVG 라인차트 권장)**
    * 데이터: `cms_v_market_tick_daily_ohlc_v1`
    * 토글: `GOLD`/`SILVER`
    * 최소 구현: `close` 값 기준 Polyline. 데이터 없으면 "데이터 없음" 표시.

### 3.4 데이터 패칭/상태관리 패턴
* `@tanstack/react-query` 사용.
* `getSchemaClient()`로 뷰 Select.
* Write는 `useRpcMutation` 또는 `callRpc` 사용.
* 에러는 `sonner` Toast로 표시.

### 3.5 확장 포인트 (옵션)
* **Hook 통일:** `web/src/hooks/use-market-latest.ts`
* 내부에서 `cms_v_market_tick_latest_gold_silver_ops_v1` 조회.
* 향후 대시보드/출고/미수 화면 상단 “현재 금/은” 표시에 재사용.

---

## 4) 구현 범위 체크리스트 (코딩 에이전트용)

### 4.1 백엔드 (Repo 반영)
* [ ] DB에 이미 적용된 `cms_0200~0205` 시세 마이그레이션 파일을 `supabase/migrations/`에 추가 (**ADD-ONLY**).
* [ ] 뷰/함수 이름이 PRD와 100% 일치하는지 확인.

### 4.2 프론트 (Next.js)
* [ ] `/market` 페이지 추가.
* [ ] 사이드바에 “시세” 메뉴 추가.
* [ ] `contracts.ts`에 뷰/함수 계약 추가.
* [ ] 최신 카드 2개 + 수동 입력 폼 + 히스토리 + 차트 최소 구현.
* [ ] 성공/실패 Toast, React-Query Invalidate 처리.

### 4.3 수동/자동 입력의 통일 (운영 포인트)
* [ ] UI 입력도, n8n 자동 입력도 동일 RPC(`cms_fn_upsert_market_tick_by_role_v1`)만 호출.
* [ ] 자동 입력은 `source`에 `FEED_KRX`, `FEED_METAL` 등으로 출처를 남기고 `meta`에 원본값/환산근거 기록.