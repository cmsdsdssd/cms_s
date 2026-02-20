# [PRD] 소재 함량/보정계수 Settings 중앙화 + 출고확정 시 미수(AR) 정합성 100% 보장

**문서 목적:** 코딩 에이전트가 “누락 없이” 구현하도록, 변경 범위/정의/검증 방법/체크리스트까지 포함한 PRD

**핵심 요구:**
* 소재가격/환산중량 계산에 쓰이는 “함량 × 보정계수”를 SETTINGS에서 중앙 통제
* 출고확정(Confirm) 시 미수(AR)에 반드시, 정확히, 일관되게 반영되도록 보장
* 나중에 계수 변경 시 중앙(Settings)만 바꾸면 전체가 동일하게 따라가며, “한 곳 누락”으로 인한 오류/정지/불일치가 없어야 함

---

## 1) 배경 / 문제 정의

### 현재 상태(문제)
* 금/은 환산 계수가 코드 곳곳에 하드코딩되어 있음
    * 예: 0.6435, 0.825, 0.925 등(프론트, API route, DB 함수 여러 곳)
* 계수가 바뀌는 순간:
    * 일부만 수정 → 화면/출고/AR이 서로 다른 값 사용 → 미수 불일치 발생
    * 출고 확정 이후 AR이 제대로 안 올라가거나 금액/환산중량이 틀어질 가능성

### 목표 상태(해결)
* “함량(purity) × 보정계수(adjust)” 구조를 Settings의 단일 소스(SoT) 로 만들고,
* 출고확정/AR 생성/표시/프린트/각종 계산이 모두 이 Settings SoT(또는 Confirm 시 Snapshot)만 참조하도록 통일
* Confirm 시점에 사용된 계수는 Snapshot으로 저장하여, 이후 Settings가 바뀌어도 과거 출고/미수는 변하지 않게(회계 안전)

---

## 2) 용어 / 계산 정의(SoT)

### 2.1 소재 코드
* `material_code`: '14' | '18' | '24' | '925' | '999' | '00'

### 2.2 “함량 × 보정계수” 정의
* **함량(purity):** 재질의 순도 비율
    * Gold: 14K=0.585 / 18K=0.750 / 24K=1.000
    * Silver: 925=0.925 / 999=1.000
* **보정계수(adjust):** 정산/정책상 적용되는 보정치
    * Gold: 14K=1.1 / 18K=1.1 / 24K=1.0
    * Silver: 기본 1.2 (단, tick 값에 이미 포함된 경우 중복 적용 금지)
    * 즉 “적용되는 보정(adjust_applied)”는 tick 소스에 따라 1.0 또는 1.2가 될 수 있음(현재 시스템 로직 유지)

### 2.3 최종 환산 계수(effective factor)
* `effective_factor = purity × adjust_applied`
* **예시(요구사항 그대로):**
    * Gold 14: 중량 × 0.585 × 1.1
    * Gold 18: 중량 × 0.750 × 1.1
    * Gold 24: 중량 × 1.0
    * Silver 925: 중량 × 0.925 × 1.2 (단 tick에 1.2가 내장되어 있으면 적용은 1.0으로 처리하여 중복 방지)
    * Silver 999: 중량 × 1.0 × 1.2 (동일 조건)

### 2.4 소재금액(소재가격) 계산(룰)
* `material_amount_sell_krw = round( net_weight_g × tick_price_krw_per_g × effective_factor , 0 )`
* **중요:** Confirm 시점에 어떤 tick을 썼는지 + 어떤 adjust_applied가 적용됐는지 + purity는 무엇인지가 출고/AR의 기준값이므로 Snapshot 필요

---

## 3) 범위(Scope)

### In Scope
* Settings에서 소재 함량/보정계수 중앙 관리(SoT)
* 출고확정 시:
    * Shipment line의 소재금액/환산중량 계산이 SoT 기반으로 수행
    * 미수(AR) 레저/인보이스에 정확히 반영
    * Confirm 후 추가 보정(실버 factor fix, unit pricing floor, rule rounding 등)이 있더라도 최종값 기준으로 AR/레저 정합성 유지
* 프론트/서버/DB에서 하드코딩된 계수 제거(실행 코드 기준)

### Out of Scope(명확화)
* 시장 시세 수집(n8n 등) 로직 자체의 정책 변경 (단, “중복 보정 방지” 기존 정책은 유지)
* 과거 출고건을 Settings 변경으로 자동 재평가(회계상 위험)
    * → 과거 건은 Snapshot 값을 기준으로 유지

---

## 4) 성공 기준(Success Criteria) / 반드시 만족해야 하는 정합성

### 4.1 출고확정 → 미수(AR) 반영 “무조건”
* Shipment Confirm RPC 호출 이후:
    * `cms_ar_ledger`에 `entry_type='SHIPMENT'`가 정확히 1건 존재(없으면 생성, 있으면 최신값으로 sync)
    * `cms_ar_invoice`(또는 시스템의 AR invoice 테이블)에 shipment_line 단위 미수 포지션이 생성/업서트

### 4.2 금액 정합성(1원도 틀리면 안 됨)
* `sum(cms_shipment_line.total_amount_sell_krw)` == `sum(cms_ar_ledger.amount_krw where entry_type='SHIPMENT' and shipment_id=...)`

### 4.3 환산중량 정합성(6자리 정밀도)
* 각 shipment_line에 대해:
    * `commodity_due_g == net_weight_g × purity_snapshot × adjust_snapshot_applied`
    * silver의 `adjust_snapshot_applied`는 “중복 방지 로직” 결과(1.0 또는 설정값)

### 4.4 Settings 변경 영향 범위
* Settings에서 purity/보정이 변경되면:
    * 미확정(draft) 화면 미리보기/계산은 즉시 변경 반영 가능
    * 확정된 출고/미수는 snapshot 기반이라 값이 절대 변하면 안 됨

---

## 5) 구현 설계

### 5.1 DB: 설정(SoT) 테이블 추가
**새 테이블(제안)**
`public.cms_material_factor_config`

| 컬럼 | 타입 | 설명 |
| :--- | :--- | :--- |
| material_code | cms_e_material_code PK | '14','18','24','925','999','00' |
| purity_rate | numeric(12,6) not null | 함량(0~1) |
| gold_adjust_factor | numeric(12,6) not null default 1.0 | 금 보정계수(금 재질용). 은/00은 1.0 유지 |
| updated_at | timestamptz | 업데이트 시각 |
| note | text | 비고(선택) |

**Seed(초기값)**
* 14: purity=0.585, gold_adjust=1.1
* 18: purity=0.750, gold_adjust=1.1
* 24: purity=1.000, gold_adjust=1.0
* 925: purity=0.925, gold_adjust=1.0
* 999: purity=1.000, gold_adjust=1.0
* 00: purity=0.000, gold_adjust=1.0
* 은 보정계수(1.2)는 현재처럼 `cms_market_tick_config.silver_kr_correction_factor`를 SoT로 유지하되, “소재 섹션”에서 함께 노출하여 Settings UX 상으로는 한 곳에서 관리되는 느낌을 제공한다.

**접근/권한**
* select는 authenticated 허용(기존 settings 테이블 패턴과 동일)
* 수정은 RPC 통해서만 하거나(권장), 테이블 update 권한 허용 중 택1
    * 권장: RPC(security definer)로 validation + audit log

### 5.2 DB: SoT Upsert RPC 추가
**RPC(제안)**
`public.cms_fn_upsert_material_factor_config_v1(p_rows jsonb, p_actor_person_id uuid default null, p_session_id uuid default null, p_memo text default null) returns jsonb`

* `p_rows`: 배열 형태
```json
[
  {"material_code":"14","purity_rate":0.585,"gold_adjust_factor":1.1},
  ...
]
```
* **Validation:**
    * purity_rate: 0 <= purity_rate <= 1
    * gold_adjust_factor: 0.5 <= gold_adjust_factor <= 2.0 (정책적으로 적절한 범위)
    * material_code는 enum 값만
* **처리:**
    * 각 row upsert
    * audit log 기록(best-effort)

### 5.3 DB: Shipment line에 “계수 Snapshot” 컬럼 추가(회계 안전장치)
**컬럼 추가(제안)**
`public.cms_shipment_line`에 아래 컬럼 추가:

| 컬럼 | 타입 | 설명 |
| :--- | :--- | :--- |
| purity_rate_snapshot | numeric(12,6) | Confirm 시점 함량 |
| gold_adjust_factor_snapshot | numeric(12,6) | Confirm 시점 금 보정(금 라인만 의미) |
| effective_factor_snapshot | numeric(12,6) | Confirm 시점 최종 환산계수(purity×adjust_applied) |

* **Silver의 경우:**
    * purity_rate_snapshot은 `cms_material_factor_config`에서 가져온 값(925=0.925, 999=1.0)
    * adjust_applied는 기존 정책 로직(중복방지) 결과값 사용
    * effective_factor_snapshot = purity_rate_snapshot × silver_adjust_applied
    * silver_adjust_applied 자체는 기존 컬럼 `silver_adjust_factor`(또는 valuation snapshot)와 정합되게 유지

**Backfill(필수)**
* 기존 데이터(과거 출고 포함)에 대해서도 snapshot 컬럼이 null이면 채움
* **Backfill 규칙:**
    * material_code별 purity/gold_adjust를 config seed 값으로 채우고,
    * silver는 기존 silver_adjust_factor 값이 있으면 사용(없으면 1 또는 설정값 정책에 맞게)
* 이 backfill이 있어야 “과거 출고/미수”가 Settings 변경에 영향받지 않음.

### 5.4 DB: 출고확정(Confirm) 및 가격계산 함수들에서 하드코딩 제거
**반드시 수정 대상(최소)**
* `public.cms_fn_confirm_shipment` (최신 정의가 들어있는 migration 기준)
    * 금 라인: 0.6435/0.825 제거 → purity_rate × gold_adjust_factor로 계산
    * 은 라인: 0.925 제거 → config의 purity_rate 사용
    * Confirm 시 shipment_line에 snapshot 컬럼 채움
* `public.cms_fn_apply_silver_factor_fix_v1`
    * 은 라인 계산의 0.925 제거 → config purity_rate 사용
    * 라인/valuation/ledger 정합성 유지
* `public.cms_fn_ar_create_from_shipment_confirm_v1`
    * commodity_due_g 계산에 0.6435/0.825/0.925 제거
    * shipment_line snapshot 컬럼 기반으로만 계산 (과거 안정성)
* **(추가) 룰 가격 미리보기/번들 롤업 관련 함수(실행에 관여하는 경우):**
    * `public.cms_fn_calc_master_rule_price_v1`
    * `public.cms_fn_calc_bundle_rollup_price_v1`
    * 기타 런타임에서 호출되는 “소재 금액 계산” 함수들

**구현 방식(권장)**
* “계수 조회”를 중복 구현하지 말고, DB에 helper를 추가:
    `public.cms_fn_get_material_factor_v1(p_material_code cms_e_material_code) returns table(purity_rate, gold_adjust_factor)`
* Confirm/AR/create 등은:
    * 금: purity × gold_adjust
    * 은: purity × silver_adjust_applied(기존 로직 결과)
* Snapshot 저장을 Confirm 내부에서 수행(라인 update 시)

### 5.5 DB: 출고확정 이후 “미수 정합성 강제 Sync” (완벽 보장)
**요구사항**
* Confirm 흐름이 어떤 경로로 실행되든(기본 confirm / 재확정 / backfill / store pickup 등):
    * 최종 shipment_line 합계가 레저 미수에 반드시 반영

**구현(권장)**
* Confirm wrapper(현재 `cms_fn_confirm_shipment_v3_cost_v1` 체인)가 끝나는 지점에서:
    * `cms_fn_sync_ar_ledger_from_shipment_v1(p_shipment_id, p_note)` 실행
    * 없으면 insert
    * 있으면 update(항상 최신 합계로)
* 추가로 “검증 함수”를 만들고 로그/리턴에 포함:
    * `cms_fn_verify_shipment_ar_consistency_v1(p_shipment_id) returns jsonb`
    * mismatch 있으면:
        * 원칙: 자동 수정(sync) 후 mismatch 0이 되도록
        * 그래도 mismatch면 RPC 실패(raise) 처리(데이터 불일치 상태로 확정되면 안 됨)

---

## 6) 프론트엔드 변경

### 6.1 공통 유틸/훅 도입(중앙화)
`web/src/lib/material-factors.ts` (예시)
* `normalizeMaterialCode(raw: string): "14"|"18"|"24"|"925"|"999"|"00"`
* `getMaterialFactor({materialCode, factors, silverAdjustApplied?, goldAdjust?})`
* 이 유틸만 사용하고, 페이지별로 factor 계산 로직을 두지 않음

### 6.2 Settings UI 확장
* Settings 페이지에 섹션 추가: “소재 함량/보정계수”
* 표 형태
    * material_code
    * purity_rate (editable)
    * gold_adjust_factor (금 코드만 editable, 은은 disabled=1.0)
    * effective preview (purity×gold_adjust or purity×(silver_kr_factor 표시))
* 저장 버튼 → `cms_fn_upsert_material_factor_config_v1` 호출
* 은 보정계수(1.2)는 기존 “Market Tick Config”에 존재하므로:
    * 본 섹션에 현재 silver_kr_correction_factor 값을 함께 표시(읽기 전용)
    * “은 보정계수는 Market Tick Config를 따름” 안내 문구

### 6.3 하드코딩 제거 대상(프론트/서버)
아래 파일들에서 0.6435/0.825/0.925 등 제거하고 공통 유틸+Settings 데이터로 교체:
* `web/src/app/(app)/catalog/page.tsx`
* `web/src/app/(app)/2_catalog/page.tsx`
* `web/src/app/(app)/inventory/page.tsx`
* `web/src/app/(app)/new_receipt_line_workbench/receipt-line-workbench.tsx`
* `web/src/app/(app)/purchase_cost_worklist/page.tsx`
* `web/src/app/(app)/receipts/daily/page.tsx`
* `web/src/components/receipt/receipt-print.tsx`
* `web/src/app/(app)/ar/page.tsx`, `web/src/app/(app)/ar/v2/page.tsx` (모달 fallback 계산/표시)
* `web/src/app/api/repairs-prepare-confirm/route.ts` (서버 라우트에서도 SoT 조회)
* `web/src/app/api/market-ticks/route.ts` (표시용 0.925 계산이 있다면 SoT 기반으로 변경 가능. 최소한 “하드코딩 0.925” 제거)
* **원칙:** 표시/미리보기/인쇄 모두 동일 SoT 참조

---

## 7) 테스트/검증 계획(“완벽”을 위한 필수 체크리스트)

### 7.1 DB 레벨 자동 검증 SQL(필수 제공)
**A) 런타임 함수에서 하드코딩 잔존 여부 체크(권장)**
```sql
select n.nspname, p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and (
    pg_get_functiondef(p.oid) like '%0.6435%'
    or pg_get_functiondef(p.oid) like '%0.825%'
    or pg_get_functiondef(p.oid) like '%0.925%'
  );
```
결과가 0건이어야 함(실행 함수 기준)

**B) 출고확정 → 레저 정합성(1원 불일치 금지)**
```sql
with ship as (
  select shipment_id, sum(total_amount_sell_krw) as ship_total
  from cms_shipment_line
  where shipment_id = :shipment_id
  group by shipment_id
),
ar as (
  select shipment_id, sum(amount_krw) as ar_total
  from cms_ar_ledger
  where entry_type='SHIPMENT' and shipment_id = :shipment_id
  group by shipment_id
)
select ship.ship_total, ar.ar_total, (ship.ship_total - ar.ar_total) as diff
from ship left join ar using (shipment_id);
```
diff = 0이어야 함

**C) AR invoice 환산중량 검증(샘플)**
* 각 line의 expected due g = net_weight_g × effective_factor_snapshot
* cms_ar_invoice.commodity_due_g와 비교

### 7.2 기능 시나리오 테스트(반드시 수동 검증)
* 각 material_code별(14/18/24/925/999/00) 샘플 출고 라인 생성 → Confirm
* Confirm 후:
    * shipment_line에 snapshot 컬럼 채워졌는지 확인
    * 소재금액/총액이 기대 공식과 동일한지 확인
    * cms_ar_ledger 생성 여부 및 합계 일치 확인
    * cms_ar_invoice가 생성/업서트 되었는지 확인, commodity_due_g 일치 확인
* Settings에서 purity/금 보정계수 변경 후:
    * 새 출고는 변경값 반영
    * 기존 Confirm 출고는 snapshot 기반으로 값 불변(AR도 불변)

### 7.3 회귀 테스트(기본값 기준 “기존과 결과 동일”)
* 기본값(seed) 상태에서, 기존 하드코딩 값으로 계산되던 결과와 100% 동일해야 함
* (예) 14K: purity 0.585 × adjust 1.1 = 0.6435 → 기존 결과 동일

---

## 8) 배포/마이그레이션 계획

1.  **DB migration 1:**
    * `cms_material_factor_config` 생성 + seed
    * upsert RPC 생성
2.  **DB migration 2:**
    * shipment_line snapshot 컬럼 추가 + backfill
3.  **DB migration 3:**
    * `cms_fn_confirm_shipment`, `cms_fn_apply_silver_factor_fix_v1`, `cms_fn_ar_create_from_shipment_confirm_v1` 등 “하드코딩 제거 버전”으로 create or replace
    * (선택) ledger sync/verify 함수 추가 + confirm wrapper에 연결
4.  **프론트 배포:**
    * Settings UI 추가
    * 공통 유틸 도입 후, 하드코딩 제거 대상 파일 전부 교체
5.  **배포 후 점검:**
    * “함수 하드코딩 잔존 체크 SQL” 0건 확인
    * 최근 출고 3건 랜덤으로 AR 정합성 체크

---

## 9) 코딩 에이전트 작업 지침(중요)

* **절대 기존 migration 파일 수정 금지(add-only)**
    * → 항상 새 migration을 추가하고 create or replace function으로 덮어쓰기
* **“SoT는 Settings” 원칙:**
    * 실행 코드에서 0.6435/0.825/0.925 같은 값이 나오면 실패로 간주
    * 예외: seed/backfill 데이터에 숫자가 들어가는 것은 허용(데이터이므로)
* **Confirm/AR는 회계 영역:**
    * 과거 확정 데이터는 Snapshot 기반으로 불변이어야 함
    * Settings 변경이 과거 미수에 영향을 주면 버그

---

## 10) 최종 산출물(Deliverables)

* **새 migration SQL들:**
    * config 테이블/seed
    * upsert RPC
    * shipment_line snapshot 컬럼 + backfill
    * runtime 함수들 하드코딩 제거 버전
* **프론트:**
    * Settings 소재계수 섹션
    * material factor 공통 유틸/훅
    * 하드코딩 제거(지정 파일 전부)
* **검증 SQL/체크리스트 문서(README 혹은 MD)**