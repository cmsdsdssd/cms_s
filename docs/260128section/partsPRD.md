# PRD — PHASE2 부속관리(Parts: 부자재/스톤) Web App v1

## 0) 한 줄 결론
부속(부자재/스톤)의 “마스터/입고/사용(소비)/미등록(unlinked) 정리/분석”을 한 화면에서 2~3클릭으로 처리하고, **원장(inventory_move)**에 모든 이벤트가 누락 없이 남도록 한다.

---

## 1) 목표와 성공 기준

### 1.1 목표
* **완전성:** 입고/사용(소비)/회수/조정 등 부속 관련 이벤트가 `inventory` 원장에 100% 기록되도록 한다.
* **운영 편의성 (귀찮음 때문에 깨지는 것 방지):**
    * “모르는 품명”도 일단 기록(`UNLINKED`) 가능.
    * 반복 입력을 템플릿/최근 기록 재사용으로 최소화.
* **데이터 분석 (1순위):**
    * 최소 필수 필드(`occurred_at`, `qty`, `unit`, `item_name/part_id`, `memo/meta`, `source`)가 항상 남는다.
    * 일별 사용량/금액 집계가 바로 가능해야 한다.

### 1.2 성공 기준 (Acceptance Criteria)
* **(A1)** “사용 기록 저장”을 누르면 항상 `inventory_move_header/line`에 1건 이상 생성된다 (실패 시 UI가 명확히 에러 표시).
* **(A2)** 부속 마스터가 없더라도 사용 기록이 가능하고(`unlinked`), 후속 정리 화면에서 누락 없이 확인된다.
* **(A3)** 입고 시 단가(`unit_cost_krw`)를 선택적으로 입력 가능하고, 미입력 시 `last_unit_cost_krw` 자동 적용(가능할 때).
* **(A4)** 부속 리스트에서 현재 보유량(`on-hand`)을 즉시 볼 수 있다 (정확히 맞을 필요는 없지만 “원장 기반 추적”은 가능).
* **(A5)** “일별 사용량(및 금액)” 화면이 기본 제공된다.

---

## 2) 범위

### 2.1 v1 포함
* 부속 마스터 CRUD (실제 쓰기는 RPC upsert)
* 입고 기록 (Receipt)
* 사용/소비 기록 (Usage/Issue)
* 미등록(`unlinked`) 워크리스트 (정리 유도)
* 원장 조회 (라인 단위)
* 일별 사용량/금액 분석

### 2.2 v1 제외 (후속 v1.1+)
* BOM 자동소비 (주문/수리/출고 확정 연동)
* 재주문 알림 (하한/상한 기반)
* 위치별 재고 (`warehouse`/`bin`)
* 과거 `unlinked` 라인을 “수정”하여 `part_id`로 재연결 (원칙상 RPC 추가로 가능하지만 v1에서는 조회/정리 유도까지만)

---

## 3) 헌법 (고정 규칙)

* **Write는 RPC만:** `public.cms_fn_*` 만 호출 (base table 직접 `INSERT`/`UPDATE`/`DELETE` 금지).
* **Read는 뷰 중심:** `public.cms_v_*` 우선 사용 (필요 시 보조적으로 base SELECT 허용되더라도 v1은 뷰 우선).
* **정합성:** 입/출 정합이 완벽할 필요는 없음. 대신 입 기록/출 기록/회수/조정/상태 이벤트는 **누락 0이 목표**.
* **“귀찮아서 깨짐” 방지:**
    * Unknown 품명도 기록 가능 (`UNLINKED`).
    * 입력 최소, 자동 프리필, 최근 기록 재사용 지원.

---

## 4) 라우팅/네비게이션 (웹앱)

### 4.1 메뉴 추가
* **Sidebar 신규 메뉴:** `/parts` — “부속”
* **Retool 느낌 유지:** 기존 ActionBar + FilterBar + SplitLayout + Card 패턴 그대로 적용.

### 4.2 페이지 구조
* **단일 페이지 (`/parts`) 내 모드 전환 (세그먼트):**
    * 모드: **[부속(기본)]** / **[미등록 정리]** / **[분석]**
* **모드에 따라 왼쪽 리스트 데이터 소스 변경:**
    * **부속 모드:** `cms_v_part_master_with_position_v1`
    * **미등록 모드:** `cms_v_part_unlinked_worklist_v1`
    * **분석 모드:** 왼쪽은 요약(옵션), 오른쪽에 분석 테이블/차트

---

## 5) 데이터 계약 (Backend Contract)

*아래 이름은 이미 구축 완료된 RPC/뷰 기준.*

### 5.1 Read Views
* `public.cms_v_part_master_with_position_v1`: 부속 마스터 + 현재 포지션(on-hand) + 재주문 기준 표시.
* `public.cms_v_part_move_lines_v1`: 부속별 원장 라인 조회(입/출, 단가/금액, 메모/meta).
* `public.cms_v_part_unlinked_worklist_v1`: UNLINKED 사용/출고 라인 중 “part_id 없는 것” 집계/정리 대상.
* `public.cms_v_part_usage_daily_v1`: 일별 사용량/금액 집계 (분석 기본).
    * *구현 팁: 뷰 컬럼은 `.select("*")`로 붙이고, UI 표시는 안전하게 fallback 처리 (`part_name || item_name || "-"`).*

### 5.2 Write RPC
* `public.cms_fn_upsert_part_item_v1(...) -> uuid`
    * 필수: `p_part_name`
    * 수정: `p_part_id` 전달
    * 기타: `kind(PART/STONE)`, `unit_default(EA/G/M)`, `is_reusable`, `reorder_min/max`, `qr_code`, `memo/meta`
* `public.cms_fn_add_part_alias_v1(p_part_id uuid, p_alias_name text, ...) -> uuid`
* `public.cms_fn_record_part_receipt_v1(...) -> uuid`
    * `p_lines` jsonb (array)
    * header: `occurred_at`, `location_code`, `vendor_party_id(optional)`, `memo`, `source`, `idempotency_key`
* `public.cms_fn_record_part_usage_v1(...) -> uuid`
    * `p_lines` jsonb (array)
    * header: `occurred_at`, `location_code`, `use_kind(optional)`, `ref_doc_type/id(optional)`, `memo`, `source`, `idempotency_key`

### 5.3 Idempotency/Correlation 정책 (프론트)
* **저장 버튼 클릭 시 생성:**
    * `correlation_id = crypto.randomUUID()`
    * `idempotency_key = "parts:<action>:<correlation_id>"`
* **RPC 전달:**
    * `p_correlation_id` (uuid 타입 받는 RPC)
    * `p_idempotency_key` (receipt/usage)

---

## 6) UI/UX 상세 설계 (Retool 스타일)

### 6.1 공통 레이아웃
* **상단 ActionBar:**
    * Title: “부속”, Subtitle: “부자재/스톤 입고·사용 기록 및 분석”
    * Actions: `+ 부속 추가`, `+ 입고 기록`, `+ 사용 기록`
* **FilterBar:**
    * 모드 세그먼트: `[부속]`, `[미등록정리]`, `[분석]`
    * 검색: “이름 검색”
    * 필터(부속 모드): `kind` (PART/STONE/ALL), `unit` (EA/G/M/ALL), `재주문 상태` (below_min/normal/all), `active only` 토글
* **본문 SplitLayout:** Left(리스트 패널), Right(상세/입력 패널)

### 6.2 모드=부속 (기본)
#### 6.2.1 왼쪽 리스트 (부속 리스트)
* **데이터:** `cms_v_part_master_with_position_v1`
* **표시:**
    * Title: `part_name`
    * Badge: PART(neutral) / STONE(primary or warning) / `below_min`이면 warning 추가
    * Subtitle: `onhand_qty + unit_default` (예: 123 EA)
    * Meta: `last_unit_cost_krw` 요약
* **동작:** 클릭 시 `selectedPartId` 설정, 상단 `+ 신규` 버튼.

#### 6.2.2 오른쪽 상세 탭 (부속 선택 시)
* **탭 구성:** 기본정보 / 별칭 / 원장 / 분석
* **탭1: 기본정보 (마스터 편집)**
    * 필드: `part_name`, `part_kind`, `family_name`, `spec_text`, `unit_default`, `is_reusable`, `reorder_min/max`, `qr_code`, `note/meta`
    * 버튼: 저장 (RPC `cms_fn_upsert_part_item_v1`) → 성공 시 Toast, Invalidate
* **탭2: 별칭**
    * 목록 표, 입력(`alias_name`), `별칭 추가` 버튼 (RPC `cms_fn_add_part_alias_v1`)
    * 추천 Alias(최근 unlinked) 표시
* **탭3: 원장**
    * 데이터: `cms_v_part_move_lines_v1` (where `part_id=selectedPartId`)
    * 필터: 기간, Direction, Source
    * 컬럼: `occurred_at`, `direction`, `qty/unit`, `unit_cost/amount`, `memo`, `move_id`
* **탭4: 분석**
    * 데이터: `cms_v_part_usage_daily_v1` 필터링
    * 표: `day`, `qty`, `amount_krw`

### 6.3 “+ 입고 기록” (Modal/Right Panel Form)
* **UX:** “한 번에 여러 줄 + 자동 프리필 + 템플릿”
* **Header:** `occurred_at`, `vendor_party_id`, `location_code`, `source`, `memo`
* **Lines (반복 Row):**
    * Part 선택: SearchSelect(등록) or 직접입력(미등록 허용→자동 마스터 생성)
    * `qty` (필수), `unit`, `unit_cost_krw`, `meta`
* **Actions:** `행 추가`, `최근 라인 불러오기`, `저장` (RPC `cms_fn_record_part_receipt_v1`)

### 6.4 “+ 사용 기록” (Modal/Right Panel Form)
* **Header:** `occurred_at`, `use_kind`, `ref_doc_type/id` (v1은 입력란만), `location_code`, `source`, `memo`
* **Lines:** Part 선택 or 직접입력, `qty`, `unit`, `unit_cost_krw` (없으면 last cost 자동)
* **정책:** 미등록 이름 저장 시 `UNLINKED`로 원장 기록(막지 않음). 저장 후 “미등록정리” 알림.
* **Actions:** `저장` (RPC `cms_fn_record_part_usage_v1`)

### 6.5 모드=미등록정리 (Unlinked Worklist)
* **Left List:** `cms_v_part_unlinked_worklist_v1` (Title: `item_name`, Badge: danger)
* **Right Panel:** 상세 라인 목록 + 액션
    * `이 이름으로 부속 생성` (RPC `cms_fn_upsert_part_item_v1`)
    * `기존 부속에 별칭으로 붙이기` (RPC `cms_fn_add_part_alias_v1`)
* **주의:** v1은 과거 라인 업데이트 안 함. 향후 자동 매칭 유도.

### 6.6 모드=분석
* **기본 표:** `cms_v_part_usage_daily_v1` (필터: 기간, kind, top N)
* **컬럼:** `day`, `part_name`, `qty`, `amount_krw`
* **추가:** 비용/사용량 상위 TOP 20, 미등록 비중 카드

---

## 7) 구현 설계 (파일 단위 Task List)

### 7.1 필수 수정/추가 파일
* **Sidebar:** `web/src/components/layout/sidebar.tsx` (메뉴 추가)
* **Contracts:** `web/src/lib/contracts.ts` (뷰/함수 등록)
* **Page:** `web/src/app/(app)/parts/page.tsx` (신규)
* **Components:**
    * `web/src/components/parts/PartsList.tsx`
    * `web/src/components/parts/PartsDetail.tsx`
    * `web/src/components/parts/PartsReceiptModal.tsx`
    * `web/src/components/parts/PartsUsageModal.tsx`
    * `web/src/components/parts/PartsUnlinkedPanel.tsx`
    * `web/src/components/parts/PartsAnalyticsPanel.tsx`
* **API Helper:** `web/src/lib/api/cmsParts.ts` (신규)

---

## 8) 캐시/리프레시 규칙 (React Query)
* **Invalidate Keys:**
    * `["cms","parts","list", ...]`
    * `["cms","parts","detail", partId]`
    * `["cms","parts","moves", partId]`
    * `["cms","parts","unlinked"]`
    * `["cms","parts","analytics"]`

---

## 9) 오류/예외 처리 (운영 깨짐 방지)
* **Qty <= 0:** 프론트 차단.
* **Unit:** EA/G/M 외 선택 제한.
* **RPC 실패:** Toast 에러 메시지, 폼 데이터 유지.
* **미등록 사용:** 실패 아님 → 정리 대상으로 유도 (저장 후 “미등록정리” 배지/버튼 제공).

---

## 10) 보안/RBAC (웹앱 관점)
* **Staff 사용 가능.**
* **쓰기 버튼 활성:** `isFnConfigured(CONTRACTS.functions.xxx)` 체크.
* **Actor ID:** 현재 `null` 허용 (추후 인증 도입 시 `p_actor_person_id` 주입).