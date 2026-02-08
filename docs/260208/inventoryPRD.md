# ✅ 코딩 에이전트용 고도화 프롬프트 (그대로 붙여넣기)

당신은 시니어 풀스택 엔지니어입니다. 이 레포는 Next.js(App Router) + Supabase(Postgres, SQL migrations, RPC) 기반이며, 재고/출고 프로세스를 “실무에서 틀어지지 않게” 고도화해야 합니다.

## 0) 목표(필수)
* **재고 위치 트래킹을 강제**해서 “어디에 무엇이 있는지”가 항상 명확해야 함
* **출고(판매) 시점의 시세/판매가 반영**을 시스템적으로 보장해야 함
* **재고 위치를 너무 많이 쓰지 않도록(최적화)**: top-level location은 최소화하고, 필요시 하위 bin으로만 세분화
* **출고/이동/실사(Stocktake)까지 프로세스/DB/화면이 서로 충돌 없이 일관되게 동작**해야 함
* 운영자가 “지금 재고 관리가 잘 되고 있는지” 바로 판단할 수 있도록 **Inventory Health(진단/예외) 지표 + 화면**을 제공

---

## 1) 현재 레포 파악(이미 존재하는 것 / 반드시 참고)

### (A) DB: inventory 구조
* `cms_inventory_move_header`에 `location_code`가 있지만 NULL 허용이라 트래킹이 새는 구멍이 있음
* 테이블 정의: `supabase/migrations/20260128200100_cms_0208_inventory_tables.sql`
* 자동 출고(Shipment confirm → inventory ISSUE 생성)에서 `location_code`를 null로 넣는 코드가 존재
* `cms_fn_emit_inventory_issue_from_shipment_confirmed_v2`가 `p_location_code := null` 사용
* 정의 파일(현행): `supabase/migrations/20260201001000_cms_0262_realign_confirm_shipment_chain.sql`
* inventory post 함수 `cms_fn_post_inventory_move_v1`는 방향성 검증은 하지만 location 필수 검증이 없음
* 정의 파일: `supabase/migrations/20260128300200_cms_0209_inventory_functions.sql`

### (B) DB: 이미 있는 “위치 기능”
* `cms_fn_quick_inventory_move_v2`는 `p_location_code` 지원
* `cms_fn_transfer_inventory_v1` (OUT+IN 생성) 이미 존재 → 이동 기록 표준화 가능
* 파일: `supabase/migrations/20260129174506_cms_0230_inventory_location_ops.sql`

### (C) FE: inventory 화면
* `web/src/app/(app)/inventory/page.tsx`에 `LOCATION_OPTIONS`가 하드코딩
* 현재 값: `MAIN/WAREHOUSE/SHOP/FACTORY`
* 앞으로는 DB 기반 동적 로딩 + 최소 location 정책으로 변경 필요

### (D) FE/DB: 출고(Shipment) 흐름
* confirm RPC: `cms_fn_confirm_shipment_v3_cost_v1` (contracts에 연결)
* store pickup confirm: `cms_fn_confirm_store_pickup_v1`
* store pickup flag: `cms_fn_set_shipment_store_pickup_v1`
* shipments 화면: `web/src/app/(app)/shipments/page.tsx`
* contracts: `web/src/lib/contracts.ts`

---

## 2) 우리가 원하는 “현실 운영 SOP”(시스템이 강제해야 하는 규칙)

### (A) 위치 최소화 정책(Top-level 3개)
현 물리 위치는 많지만(3층/매장/지하/집3곳), 시스템 top-level location은 3개로 고정한다.

1.  **OFFICE** : 사무실(3층 + 지하를 합친 상위 개념)
2.  **STORE** : 매장
3.  **OFFSITE**: 외부(집_나 / 집_엄마 / 집_세진엄마 등 전부 포함)

세부 구분이 필요하면 **bin(하위 보관함 코드)**로만 나눈다.
* **OFFICE bins**: F3, B1
* **OFFSITE bins**: HOME_ME, HOME_MOM, HOME_SEJIN_MOM
* **STORE bins**: 필요시 FRONT, BACK

**핵심**: “위치는 적게, 대신 bin으로 세분화” → 트래킹 누락/혼선 최소화

### (B) 출고(판매)는 “출고 시점 시세/판매가”를 반드시 반영
* 재고 원가(cost)는 과거 기록(영수증/매입원가/원가 스냅샷)을 유지
* 출고(sale)는 출고 시점의 시세(시장가) 기반으로 판매가 산정/스냅샷을 남겨야 함
* 이 레포는 이미 shipment confirm 시 market tick snapshot/가격 잠금(pricing_locked_at 등)을 수행하므로:
    * **원칙**: 판매 출고는 Shipment confirm로만 처리(inventory quick ISSUE는 “조정/이동/폐기”용)
    * shipment confirm 시 생성되는 inventory ISSUE는 반드시 해당 출고 문서(Shipment)와 연결되고, 시세/판매가 산정은 shipment에서 담당

### (C) 물리 이동이 발생하면 반드시 Transfer로 기록
* OFFICE ↔ STORE ↔ OFFSITE 이동은 `cms_fn_transfer_inventory_v1`로 OUT/IN 자동 생성
* 재고가 “어디 있는지”는 이동 기록으로만 바뀌도록 유도/강제

---

## 3) 구현 요구사항(필수 Deliverables)
아래를 **DB(migrations) + RPC + FE(UI)**까지 한 번에 완성해라. “부분 구현” 금지.

### 3-1) DB: Location/Bin 마스터 테이블 추가 + seed
* **✅ 새 테이블**
    * `cms_location`
        * `location_code` text primary key
        * `location_name` text not null
        * `is_active` boolean not null default true
        * `sort_order` int not null default 0
        * (선택) `note` text, `meta` jsonb default '{}'
    * `cms_location_bin`
        * `bin_code` text primary key
        * `location_code` text not null references cms_location(location_code)
        * `bin_name` text not null
        * `is_active` boolean not null default true
        * `sort_order` int not null default 0
* **✅ seed(초기 데이터)**
    * `cms_location`: `OFFICE`, `STORE`, `OFFSITE`
    * `cms_location_bin`:
        * `OFFICE`: `F3`, `B1`
        * `OFFSITE`: `HOME_ME`, `HOME_MOM`, `HOME_SEJIN_MOM`
        * `STORE`: 필요 시 `FRONT`, `BACK`

> **중요**: 기존 데이터/화면 호환을 위해 과거 코드(MAIN/WAREHOUSE/SHOP/FACTORY)가 존재할 수 있음. 운영 혼선이 없게 “마이그레이션+가드”까지 완성해라.
> * **권장안(정리형)**: 기존 코드 → 신규 코드로 데이터 마이그레이션(update)하고, UI는 신규만 노출
>     * MAIN/WAREHOUSE → OFFICE
>     * SHOP → STORE
>     * FACTORY → OFFSITE (또는 사용처 있으면 별도 논의하되 기본은 OFFSITE로 흡수)

### 3-2) DB: “location_code/bin_code 필수화” (새는 구멍 제거)
* **✅ 컬럼 확장(필수)**
    * `cms_inventory_move_header`에 `bin_code` text null 추가
    * `cms_inventory_count_session`에 `bin_code` text null 추가(실사도 bin 단위 가능)
    * `cms_shipment_header`에 아래 추가:
        * `source_location_code` text not null default 'OFFICE'
        * `source_bin_code` text null
* **✅ 검증 규칙(필수)**
    * **POSTED** inventory move는 `location_code`가 반드시 있어야 한다.
    * `cms_fn_post_inventory_move_v1`에 검증 추가(또는 v2를 만들고 FE/contracts 교체)
    * move_type이 RECEIPT/ISSUE/ADJUST/TRANSFER 어떤 것이든 POSTED면 `location_code` 필수
    * `location_code`/`bin_code`는 마스터 테이블의 active 값만 허용
    * helper 함수 예: `cms_fn_assert_location_active_v1(location_code, bin_code)`
    * upsert/post/confirm에서 공통 호출
* **기존에 POSTED인데 location_code가 null인 레거시 데이터가 있으면:**
    * 데이터 백필(backfill) 마이그레이션을 같은 PR에 포함해라.
    * 최소한:
        * ref_doc_type='SHIPMENT' 연계 move는 shipment_header.source_location_code로 채움(없으면 OFFICE)
        * 나머지 null은 OFFICE로 채우되, meta에 `"backfilled": true` 남겨 추적 가능하게
    * 목표는 “앞으로는 location null이 다시는 생기지 않음”이다.

### 3-3) DB: Shipment confirm → Inventory ISSUE 생성 시 “출고 위치” 반영
* **✅ 핵심 수정(필수)**
    * `cms_fn_emit_inventory_issue_from_shipment_confirmed_v2`에서 현재 `p_location_code := null`인 부분을 제거하고 `cms_shipment_header.source_location_code`(+ `source_bin_code`까지)를 사용하여 inventory move header에 기록해라.
* **store pickup인 경우:**
    * store pickup 설정/확정 시 `source_location_code`가 자동으로 `STORE`가 되게 보장
    * `cms_fn_set_shipment_store_pickup_v1`를 수정하거나 v2를 만들어서:
        * `is_store_pickup=true`로 바뀌면 `source_location_code='STORE'`(bin은 선택)
        * 이미 사용자가 `source_location_code`를 명시했다면 충돌 방지 정책을 명확히(보통 STORE로 강제)
* **✅ 충돌 방지(필수)**
    * shipment가 CONFIRMED인데 inventory issue가 다시 emit되는 중복 문제 방지:
    * 기존 idempotency(`SHIPMENT_ISSUE:shipment_id`) 유지
    * location/bin 변경만으로 재-emit이 일어나지 않도록(이미 POSTED면 return) 보장

### 3-4) FE: Location/Bin을 “DB에서 동적 로딩” + 최소 location만 사용
* **✅ inventory UI 수정(필수)**
    * 파일: `web/src/app/(app)/inventory/page.tsx`
    * 하드코딩 `LOCATION_OPTIONS` 제거
    * Supabase에서 `cms_location` / `cms_location_bin`을 조회해서 드롭다운 구성
    * Quick Move / Stocktake Session 생성에:
        * `location_code` 필수(최소 OFFICE/STORE/OFFSITE)
        * `bin_code`는 선택(옵션)
    * 기존에 “미지정(NULL)” 같은 옵션은 백필 완료 후엔 원칙적으로 숨김(단, 레거시 점검용 토글로만 남길 수 있음)
* **✅ shipments UI 수정(필수)**
    * 파일: `web/src/app/(app)/shipments/page.tsx`
    * Shipment Header 영역에 “출고 위치(source_location_code/source_bin_code)” 선택 UI 추가
    * store pickup 흐름에서:
        * `is_store_pickup=true`면 `source_location_code`는 `STORE`로 자동 세팅/잠금(또는 강력 추천)
    * confirm 버튼 누를 때:
        * `source_location_code`가 없으면 confirm 불가(프론트에서 먼저 막고, DB에서도 막아야 함)
* **✅ contracts 수정(필수)**
    * 파일: `web/src/lib/contracts.ts`
    * 새 view/RPC를 추가했다면 정확히 매핑
    * 기존 RPC명을 바꿨다면 환경변수 override 고려하면서 안전하게 교체

### 3-5) Inventory Health(“지금 재고관리가 잘 되고 있나?”) 진단 지표 + 화면
운영자가 즉시 상태를 판단할 수 있도록 아래를 제공.

* **✅ DB View/RPC (필수)**
    * `cms_v_inventory_health_summary_v1` (요약 지표 1 row)
        * 최근 30일/90일 기준:
        * posted move 중 location_code null 건수(백필 후 0이어야 함)
        * negative stock SKU 수
        * unlinked posted line 수
        * stale draft move 수(24h 이상)
        * location별 onhand 분포(OFFICE/STORE/OFFSITE) 및 location count(재고가 있는 location 종류 수)
    * `cms_v_inventory_health_issues_v1` (리스트)
        * 예외 항목을 표준 포맷으로 제공(현재 `cms_v_inventory_exceptions_v1` 확장하거나 별도 생성)
* **✅ FE 화면(필수)**
    * inventory 페이지에 “Health/진단” 섹션 추가
    * KPI 카드(요약)
    * 예외 리스트 테이블(클릭 시 관련 move/shipment로 추적 가능하면 더 좋음)
    * location 분포(간단한 표/바 차트 가능)

---

## 4) 데이터 마이그레이션/호환성(반드시 포함)
기존 코드(MAIN/WAREHOUSE/SHOP/FACTORY) 데이터가 있을 가능성이 크다. PR 안에 아래를 반드시 포함:
* (선택한 정책에 따라) location 코드 정규화 update SQL
* POSTED move의 null location 백필 SQL
* shipment_header 기존 row에 `source_location_code` backfill (기본 OFFICE, store_pickup이면 STORE)

---

## 5) 테스트/검증(필수)
* **✅ SQL 레벨 최소 테스트(필수)**
    * “POSTED move인데 location_code null이면 post가 실패” 테스트
    * “shipment confirm 시 생성되는 ISSUE move에 source_location_code가 박힘” 테스트
    * “store pickup 설정/확정 시 source_location_code=STORE 강제” 테스트
* **✅ FE 레벨 스모크 테스트(필수)**
    * inventory quick move: location 선택 없이 제출 시 오류
    * shipment confirm: source_location 없이 confirm 불가
    * location 목록이 DB seed를 그대로 반영

---

## 6) 구현 방식 가이드(중요: 충돌 방지)
* 기존 RPC를 무작정 깨지 말고, 가능하면 v2/v3로 추가 후 contracts에서 교체. (단, 이미 프론트가 v1을 쓰고 있고 변경폭이 작으면 v1 in-place 수정도 허용하지만, 그 경우 영향 범위 분석/회귀 방지 필수)
* supabase migration 파일은 레포 내 가장 최신 timestamp 이후로 생성해서 덮어쓰기 충돌 방지
* 모든 SQL 함수는 레포 스타일대로: `security definer`, `set search_path = public, pg_temp`
* 필요한 grant 추가(anon/authenticated/service_role)
* 로그/감사: 기존 패턴(`cms_decision_log`, `cms_status_event`) 최대한 유지

---

## 7) 최종 완료 기준(Acceptance Criteria)
아래를 모두 만족해야 “완료”다.
1.  Shipment confirm으로 생성된 inventory ISSUE는 항상 `source_location_code`가 기록된다(= null 불가)
2.  inventory move POSTED는 location 없으면 시스템적으로 불가능
3.  UI에서 사용자가 실수로 location을 빼먹을 수 없다(프론트+DB 이중 가드)
4.  location은 OFFICE/STORE/OFFSITE 3개만 운영 기본값으로 노출되고, 세부는 bin으로 관리 가능
5.  Inventory Health 화면에서 “현재 상태가 좋은지/문제가 뭔지”가 즉시 보인다
6.  기존 데이터가 있더라도 마이그레이션으로 깨지지 않고 정상 동작

---

## 8) 산출물(코드 외 문서도 필수)
레포에 `docs/inventory_sop.md` (또는 비슷한 이름)로 다음을 문서화해라.
* 입고/이동/출고/실사 표준 운영 프로세스
* location/bin 정책(3개 location + bin 예시)
* “출고는 shipment confirm으로만” 원칙과 이유(시세/판매가 스냅샷 보장)
* 예외(Health) 지표 해석과 대응 방법

---

### 시작할 때 해야 할 일(에이전트 체크리스트)
1.  `contracts.ts`에서 실제 쓰는 RPC/view 목록 확인
2.  DB에서 최신 confirm/emit 함수 정의가 어떤 migration에 있는지 확인 후 “가장 최신 기준”으로 수정
3.  location seed/백필/가드 → FE 동적 로딩 → shipment source_location 연결 → health view/UI 순으로 단계적으로 완성
4.  최소 테스트 추가 후 스모크 확인

### (선택) 추가 개선 아이디어(시간 되면)
* Transfer UI 버튼(선택 master/qty/from/to) 추가해서 이동 기록을 더 쉽게 만들기
* bin까지 포함한 position view `cms_v_inventory_position_by_master_item_location_bin_v1` 추가
* 출고 위치 변경 시(드문 케이스) 이미 emit된 move가 있으면 “수정 불가/취소 후 재확정” 정책 명확화