# 재고관리 PRD v1.1 (Inventory + Stocktake)

* **SoT:** `public.cms_*`
* **Write:** RPC-only (`public.cms_fn_*`)
* **Read:** View-only (`public.cms_v_*`)
* **원칙:** 입/출 수량 완벽 일치 필요 X, **기록 누락 0** (입고/출고/조정/이동/반품/수납/상태이벤트는 모두 남음)
* **우선순위:** 데이터분석(1) > 운영안정(2)

---

## 0) 시스템이 보장해야 하는 핵심

### 0.1 절대 보장 (LOCK)
* **기록 보존:** 입고/출고 기록은 무조건 남는다. (실수/중복/부분실패가 있어도 “기록” 자체가 사라지지 않음)
* **실사(Stocktake)의 정의:** “현재 재고를 맞추는 행위”가 아니라, **스냅샷(as-of) 기준의 관측값을 기록**하고, 필요하면 자동으로 `ADJUST` 이동을 생성하는 것.
* **삭제 금지:** 라인/이동은 `void` 처리로만 무효화하고 이력은 남긴다.
* **운영 편의:** 실사 중에도 입/출이 발생할 수 있음 → 그래서 `snapshot_at` 기준으로 `system_qty_asof`를 계산한다.

### 0.2 실사가 꼬이는 대표 원인과 방지책
1.  **원인A:** 실사 도중 입/출이 섞여서 “시스템 수량”이 바뀜
    * → **방지책:** `snapshot_at` 기준으로 계산해서 방지.
2.  **원인B:** `delta=0`인데도 조정이 생성되거나, 반대로 `delta≠0`인데 조정이 누락
    * → **방지책:** 규칙 확립 (`delta=0`이면 ADJUST 생성 금지, `delta≠0`이면 ADJUST 생성 + POST). (0219로 해결)
3.  **원인C:** Finalize를 여러 번 눌러 중복 조정 생성
    * → **방지책:** `idempotency_key = STOCKTAKE:{session_id}`로 멱등 보장. (0219로 해결)
4.  **원인D:** 라인 수정/삭제가 뒤죽박죽
    * → **방지책:** 수정은 `DRAFT` 상태에서만, 삭제는 `void` 처리만 허용.

---

## 1) 데이터 모델 (ADD-ONLY) — 현재 상태 기준 확정

### 1.1 기존 Inventory Move (이미 구축됨)
* **테이블:** `cms_inventory_move_header`, `cms_inventory_move_line`
* **뷰:** `cms_v_inventory_position_by_item_label_v1`
    * 라벨(`item_ref_type` + `item_name` + `variant_hint`) 단위로 on_hand 집계(POSTED만).

### 1.2 Stocktake (이번에 추가된 오브젝트)
* **테이블:**
    * `cms_inventory_count_session`
        * `status`: `DRAFT` | `FINALIZED` | `VOID`
        * `snapshot_at`: 실사 기준 시점
        * `generated_move_id`: finalize 시 생성된 ADJUST move_id (`delta=0`이면 null)
    * `cms_inventory_count_line`
        * `counted_qty`: 실사 수량(관측)
        * `system_qty_asof`: snapshot 기준 시스템 수량(확정 시 기록)
        * `delta_qty`: `counted - system` (확정 시 기록)
        * Delete 금지 → `is_void` + `void_reason` 사용
* **Enum (추가):**
    * `cms_e_inventory_count_status`
    * `cms_e_entity_type`에 `STOCKTAKE_SESSION`, `STOCKTAKE_LINE` 추가됨 (0218).

---

## 2) RPC 시그니처 (Write-only)

### 2.1 실사 세션/라인

**세션 생성**
```sql
cms_fn_create_inventory_count_session_v1(
  snapshot_at, location_code?, session_code?, memo?, meta?,
  idempotency_key?, actor_person_id?, note?, correlation_id?
) -> session_id
```

**라인 추가 (자동 line_no)**
```sql
cms_fn_add_inventory_count_line_v1(
  session_id, item_ref_type, item_name, counted_qty,
  master_id?, part_id?, variant_hint?, note?, meta?,
  actor_person_id?, note2?, correlation_id?
) -> count_line_id
```

**라인 Upsert (수정/삽입)**
```sql
cms_fn_upsert_inventory_count_line_v1(
  session_id, line_no, item_ref_type, item_name, counted_qty,
  master_id?, part_id?, variant_hint?, note?, meta?,
  count_line_id?, actor_person_id?, note2?, correlation_id?
) -> count_line_id
```

**라인 Void**
```sql
cms_fn_void_inventory_count_line_v1(
  count_line_id, reason, actor_person_id?, note?, correlation_id?
) -> void
```

**세션 Finalize**
```sql
cms_fn_finalize_inventory_count_session_v1(
  session_id, generate_adjust=true, actor_person_id?, note?, correlation_id?
) -> jsonb
```
* **동작:**
    * 모든 라인에 `system_qty_asof`, `delta_qty` 계산 저장.
    * `delta=0`이면 move 생성 없이 `FINALIZED`.
    * `delta≠0`이면 `ADJUST` move 생성(멱등) + 라인 생성 + `POST` + session `FINALIZED`.

**세션 Void**
```sql
cms_fn_void_inventory_count_session_v1(
  session_id, reason, actor_person_id?, note?, correlation_id?
)
```

---

## 3) Read View (프론트는 뷰로만 읽기)

### 3.1 실사 화면에 필요한 뷰
* `cms_v_inventory_count_sessions_v1`: 세션 리스트 + line_count / delta_line_count / sum_abs_delta + generated_move 상태
* `cms_v_inventory_count_lines_enriched_v1`: 세션/라인 상세 + master 모델명 조인
* `cms_v_inventory_stocktake_variance_v1`: `abs(delta)` 큰 순으로 정렬 (실사 검토 화면)

### 3.2 재고 포지션 (이미 있음)
* `cms_v_inventory_position_by_item_label_v1`: `on_hand_qty`, `last_move_at` 등 (POSTED만)

---

## 4) 운영 플로우 (UI/UX 기준 “자동 트래킹” 느낌)

### 4.1 재고관리 페이지 탭 구성(권장)
1.  **현재재고(Position)**
    * 뷰: `cms_v_inventory_position_by_item_label_v1`
    * 검색: `item_name`, `variant_hint`, `item_ref_type`
    * 액션: “실사 세션 만들기” 버튼 (바로 `snapshot_at=now`로 생성)
2.  **입고/출고/조정(Moves)**
    * 리스트: `cms_inventory_move_header`를 직접 읽지 말고(원칙상) 차후 `cms_v_inventory_moves_v1` 같은 뷰를 추가 권장 (지금은 기존 뷰/쿼리로 임시 가능).
    * 액션: 입고 등록(RPC), 출고 등록(RPC), 이동 등록(RPC).
    * *조정은 실사 finalize가 자동 생성하는 것이 기본.*
3.  **재고조사(Stocktake)**
    * 세션 리스트: `cms_v_inventory_count_sessions_v1`
    * 세션 상세: `cms_v_inventory_count_lines_enriched_v1`
    * Variance 탭: `cms_v_inventory_stocktake_variance_v1`
    * 버튼: “라인 추가”, “라인 void”, “Finalize (조정 생성)”, “Finalize (기록만)”, “세션 void”(DRAFT만).

### 4.2 실사 UX 디테일 (꼬임 방지)
* **스냅샷 표시:** 세션 생성 시 `snapshot_at`을 화면에 크게 표시 (예: “스냅샷: 2026-01-28 11:15”).
* **빠른 입력:** `item_name` + `counted_qty` 2개만으로도 가능 (`UNLINKED`). 나중에 마스터 연결하고 싶으면 `item_ref_type=MASTER`로 수정.
* **Finalize 흐름:**
    1.  Variance 미리보기 (“delta 큰 항목부터 확인하시겠습니까?”)
    2.  확정 시 서버에서 `system_qty_asof` / `delta_qty` 저장.
    3.  `delta≠0`이면 `ADJUST` 생성 + `POST`.
    4.  Finalize 후에는 라인 추가/수정/void 전부 막힘 (서버가 막음).

---

## 5) 회귀 테스트 5개 고정 (Regression)

*이미 `_inventory_stocktake_regression.sql`가 사실상 아래를 수행함.*

1.  `delta=0`이면 move 생성 안됨.
2.  `counted > system`이면 `ADJUST IN` 생성 + position 증가.
3.  `counted < system`이면 `ADJUST OUT` 생성 + position 감소.
4.  `snapshot_at` 이후 발생한 move는 `system_qty_asof`에 포함되면 안 됨.
5.  뷰 3개(select) 동작 보장.

---

## 6) 시드데이터 재현 세트 (운영/개발 공용)

### 6.1 “라벨 기반” 시드 (마스터 없이도 재고가 굴러가야 함)
* `STK_ITEM_A` receipt +10
* Stocktake counted 12 → adjust +2
* Stocktake counted 7 → adjust -5

### 6.2 “as-of 스냅샷 검증” 시드
* `STK_ASOF_ITEM` receipt +10 (t0-2m)
* `snapshot_at=t0-1m`
* receipt +5 (t0+10m) ← 시스템 수량에 포함되면 안 됨.
* *(이건 이미 regression에 포함되어 있음)*

---

## 7) 프론트엔드 구현계획 (바이브코딩용, Next.js 기준)

### 7.1 페이지/컴포넌트 구조(권장)
* `/inventory`
    * `PositionTable` (현재재고)
    * `MovesPanel` (입/출/이동 입력 폼 + 최근 이동 리스트)
    * `StocktakePanel`
        * `SessionsList`
        * `SessionDetail`
        * `CountLinesTable`
        * `VarianceTable`
        * `FinalizeDialog`

### 7.2 API 호출 규칙
* **READ:** `/rest/v1/cms_v_*`
* **WRITE:** `/rest/v1/rpc/cms_fn_*`
* **공통 사항:**
    * 모든 RPC 호출에 `correlation_id(uuid)` 생성해서 넣기 (클라이언트에서).
    * **Idempotency Key 전략:**
        * 세션 생성: `STOCKTAKE:CREATE:{snapshot_at}:{location_code?}:{user}`
        * Finalize: 서버가 `STOCKTAKE:{session_id}`로 이미 멱등 보장.

### 7.3 UI에서 반드시 보여줘야 하는 안전장치
* 세션 상태 (`DRAFT` / `FINALIZED` / `VOID`)
* `snapshot_at`
* **Finalize 결과:** `generated_move_id`, `generated_move_status(POSTED)`