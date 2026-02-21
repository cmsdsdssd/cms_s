# 구현 체크리스트 (Inventory만, 최소 변경)

## A. 변경 범위 원칙 (반드시 지킬 것)
* **확정 함수(cms_fn_confirm_shipment_v3_cost_v1 등) 절대 수정하지 않기**
* **프론트(shipments/page.tsx) 수정하지 않기 (이번 스코프)**
* **BOM 테이블 스키마/컬럼 추가하지 않기**
* **오직 DB의 재고 emit 함수 1개만 변경:**
`public.cms_fn_emit_inventory_issue_from_shipment_confirmed_v2(p_shipment_id, ...)`
* **이유:** 확정/원가/AR까지 건드리면 나중에 수정할 때 폭발함. 지금 목표는 “출고확정된 내용 기준으로 재고만 정확히 차감”이니까 재고 함수만.

## B. 사전 확인(코드/데이터 구조 확인) — 구현 전 10분 점검
### B1) 출고대기에서 저장되는 장식 qty가 DB에 들어가 있는지
* **테이블:** `cms_shipment_line.extra_labor_items` (jsonb)
* 출고확정 직전에 이미 저장되어 있어야 함 (현재 로직상 저장 후 confirm 하므로 OK)
* `extra_labor_items` 배열 요소에 아래가 존재하는지 샘플 1건 확인
  - `meta.absorb_item_id` (uuid 문자열)
  - `meta.qty_applied` (숫자 또는 숫자 문자열)

### B2) “장식(소재) ↔ BOM 라인” 연결이 DB에 이미 존재하는지
프로젝트에 이미 backfill이 되어 있음:
* `cms_master_absorb_labor_item_v1.note` 형식이 아래인지 확인
  `"BOM_DECOR_LINE:<bom_line_id>;QTY_PER_UNIT:<n>"`
* 이건 이미 마이그레이션 `20260220015000_cms_0613_bom_decor_absorb_backfill_addonly.sql`에서 생성하는 포맷이 맞음.
* ✅ 이게 확인되면, 프론트/확정 로직 손대지 않고도 `absorb_item_id` -> `note` -> `bom_line_id` -> `bom_recipe_line.component_master_id`로 “차감할 소재 마스터”를 정확히 찾을 수 있음.

## C. 실제 작업 1: 새 마이그레이션 1개만 추가 (함수 1개 패치)
기존 migration 파일을 수정하지 말고, “새 migration”으로 함수만 덮어써야 롤백/추적이 쉬움.
* **새 파일 생성**
  예: `supabase/migrations/20260221XXXXXX_cms_0702_inventory_emit_decor_qty_from_shipment.sql`
* 이 파일에는 함수 1개만 `create or replace`로 정의 (다른 함수/테이블 건드리지 않기)
* **대상:** `public.cms_fn_emit_inventory_issue_from_shipment_confirmed_v2(...)`

## D. 실제 작업 2: 함수 내부에서 “BOM 구성품 차감” 파트만 최소 수정
### D1) 유지해야 하는 기존 동작(절대 변경 금지 영역)
아래 블록들은 그대로 유지:
* shipment 헤더 조회/lock + status `CONFIRMED` 체크
* location/bin 결정 및 `cms_fn_assert_location_active_v1`
* move header upsert (`cms_fn_upsert_inventory_move_header_v1`)
* “이미 POSTED면 return” 하는 idempotent 처리
* 기존 move_line void 처리(rebuild_from_shipment)
* 완제품(출고 품목) OUT 라인 생성 (`SHIPMENT_ITEM`)
* 최종 POST (`cms_fn_post_inventory_move_v1`)
* 👉 여기 건드리면 “다른 거 꼬임” 확률이 급상승.

### D2) 바꿀 곳은 딱 1군데: BOM 구성품 라인 생성 loop
현재 함수(0601 기준)에서 이 부분이 문제임:
* **기존:** 모든 BOM 라인에 대해 `p_qty := (c.qty_per_unit * r.qty)`로 차감
* → 장식(소재)도 BOM 기본값으로 차감됨(출고대기 qty 수정이 반영 안 됨)
* **목표 동작(이번 스코프)**
  1. BOM 라인 중 `LINE_KIND:DECOR%` 인 라인만 차감한다.
  2. 그 라인의 차감 수량은 출고대기에서 저장된 qty(`meta.qty_applied`) 를 그대로 사용한다.
  3. `LINE_KIND:ACCESSORY%` 등 나머지 BOM 라인은 이번 스코프에서 차감하지 않는다(스킵)

## E. 구현 디테일: “출고대기 qty → BOM 라인별 수량 맵” 만들기
### E1) shipment_line 1개(r) 기준으로 “bom_line_id -> qty_applied” 맵 만들기
함수 내 `for r in cms_shipment_line ... loop` 안에서, BOM 루프 들어가기 전에 아래를 만든다.

* **변수 선언 추가**
```sql
v_decor_qty_map jsonb := '{}'::jsonb;
v_override_qty numeric;
v_issue_qty numeric;
```

* **r.extra_labor_items에서 장식 항목만 추출해 맵 생성**
핵심 연결:
- `extra_labor_items.meta.absorb_item_id` (uuid)
- `cms_master_absorb_labor_item_v1.absorb_item_id`로 join
- `cms_master_absorb_labor_item_v1.note`에서 `BOM_DECOR_LINE:<bom_line_id>` 파싱
- 같은 `bom_line_id`끼리는 `qty_applied` 합산(안전)

* **추천 SQL 패턴(안전 캐스팅 포함)**
(에이전트가 함수 안에 그대로 넣어 구현하면 됨)

```sql
select coalesce(jsonb_object_agg(t.bom_line_id::text, to_jsonb(t.qty_applied)), '{}'::jsonb)
into v_decor_qty_map
from (
  select
    (substring(a.note from '^BOM_DECOR_LINE:([0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12})'))::uuid as bom_line_id,
    sum(
      case
        when (x.item->'meta'->>'qty_applied') ~ '^[0-9]+(\.[0-9]+)?$'
          then (x.item->'meta'->>'qty_applied')::numeric
        else 0
      end
    ) as qty_applied
  from jsonb_array_elements(coalesce(r.extra_labor_items, '[]'::jsonb)) as x(item)
  join public.cms_master_absorb_labor_item_v1 a
    on a.absorb_item_id =
      case
        when (x.item->'meta'->>'absorb_item_id') ~ '^[0-9a-fA-F-]{8}-' then (x.item->'meta'->>'absorb_item_id')::uuid
        else null
      end
  where coalesce(a.note,'') like 'BOM_DECOR_LINE:%'
  group by 1
) t
where t.bom_line_id is not null and t.qty_applied > 0;
```

이 맵이 만들어지면, BOM 라인 루프에서 `c.bom_line_id`로 바로 qty를 꺼낼 수 있음.

## F. BOM 라인 루프 수정(핵심): “DECOR만 + qty_applied 적용”
### F1) BOM 라인 select에 l.note를 추가로 읽기
현재 select에는 note가 없음 → DECOR 판별 불가
* `select ... l.unit` 뒤에 `, l.note` 추가

### F2) 루프 내부 로직을 아래로 교체
* `LINE_KIND:DECOR%` 인 라인만 처리하고 나머지는 `continue;`
* `override_qty = v_decor_qty_map ->> c.bom_line_id::text`
* `issue_qty = override_qty` (이번 목표는 “출고대기 qty 그대로 차감”)
* `issue_qty <= 0`이면 move line 생성 스킵(업서트 함수가 qty>0 강제)

**의사코드(에이전트 구현 기준)**
```sql
-- inside BOM loop for c
if upper(coalesce(c.note,'')) not like 'LINE_KIND:DECOR%' then
  continue;
end if;

v_override_qty := null;
if v_decor_qty_map ? (c.bom_line_id::text) then
  v_override_qty := (v_decor_qty_map->> (c.bom_line_id::text))::numeric;
end if;

v_issue_qty := coalesce(v_override_qty, 0);

if v_issue_qty <= 0 then
  -- optional warning append
  continue;
end if;

v_line_no := v_line_no + 1;
perform cms_fn_upsert_inventory_move_line_v1(
  p_move_id := v_move_id,
  p_line_no := v_line_no,
  p_direction := 'OUT',
  p_qty := v_issue_qty,
  p_item_name := coalesce(c.component_master_model_name, 'UNKNOWN_DECOR'),
  p_unit := coalesce(nullif(trim(coalesce(c.unit,'')),''), 'EA'),
  p_item_ref_type := c.component_ref_type,
  p_master_id := c.component_master_id,
  p_part_id := c.component_part_id,
  -- ... (중략)
  p_meta := jsonb_build_object(
    'shipment_line_id', r.shipment_line_id,
    'kind', 'DECOR_COMPONENT',
    'bom_id', v_bom_id,
    'bom_line_id', c.bom_line_id,
    'qty_source', 'SHIPMENT_EXTRA_LABOR_QTY_APPLIED'
  )
  -- ... (중략)
);
```
이렇게 하면 “출고확정된 shipment_line의 extra_labor_items.qty_applied”가 그대로 재고 차감 수량이 된다.

## G. 경고/안전장치(“꼬임 방지”를 위해 최소로만)
이번 스코프는 “로직 단순화”가 목표라, 경고는 최소한만 남기자.
* 만약 DECOR BOM 라인이 있는데 `v_decor_qty_map`에서 매칭되는 qty가 없으면:
  - (선택) 그냥 스킵하지 말고 `v_bom_warnings`에 기록만 남김
  - 확정을 막지는 않는다(확정/AR쪽 건드리기 싫으니까)
* `move_header.meta`에 아래만 추가 기록(디버깅용)
  - `decor_qty_map_present`: true/false
  - `decor_applied_lines`: <int>
  - `decor_warnings`: [...] (있을 때만)

## H. 테스트 체크리스트(로컬/스테이징에서 반드시)
### H1) 정상 케이스
* BOM에 `LINE_KIND:DECOR` 라인 존재 + 해당 라인이 `cms_master_absorb_labor_item_v1.note`로 생성되어 있음
* 출고대기 화면에서 장식 qty를 3으로 수정 후 저장
* 출고확정 실행
* **결과 확인:**
  - inventory move에 완제품 OUT 1줄
  - decor 소재 OUT 1줄 이상
  - decor 소재 OUT qty가 3인지 확인 (BOM qty_per_unit 무시되고, shipment qty 적용)

### H2) 매칭 실패 케이스(경고만 남기는지)
* `extra_labor_items`에 `absorb_item_id`가 누락/깨진 상태를 가정
* 출고확정
* 함수가 실패하지 않고(전체 트랜잭션 롤백 안 나고) `move_header.meta`에 `decor_warnings`가 쌓이는지 확인

### H3) 회귀 테스트(다른 로직 영향 없는지)
* 출고확정 후 AR 생성/원가 반영 정상인지(기존대로)
* 기존처럼 재고 move가 POST 되는지
* idempotency 동작(같은 shipment로 함수 다시 호출해도 중복 라인 안 생기는지)

## “최소 변경” 최종 정리 (에이전트에게 한 문장으로)
DB에서 `cms_fn_emit_inventory_issue_from_shipment_confirmed_v2` 하나만 수정해서, BOM 구성품 차감은 `LINE_KIND:DECOR` 라인만 만들고, 수량은 `cms_shipment_line.extra_labor_items[].meta.qty_applied` 값을 그대로 사용해 OUT 처리한다. 나머지 확정/원가/AR/프론트는 건드리지 않는다.