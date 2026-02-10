# [CODING AGENT PROMPT] Shipments ↔ Receipt “분석용 링크” 실제 저장 + MANUAL 원가 검증 + Upsert 동시성 방지 (최소 변경/충돌 금지)

## 0) 절대 원칙
- **기존 RPC/시그니처/페이지 동작 깨지지 않게 “최소 diff”만**
- DB 마이그레이션은 **ADD-ONLY** (기존 migration 파일 수정 금지)
- 프론트는 **shipments/page.tsx에서 필요한 부분만 수정**, 리팩토링 금지
- 목표는 3가지:
  1) Shipments에서 선택한 영수증이 **실제로 DB에 링크**로 남게 (`cms_receipt_usage`)
  2) MANUAL 원가 입력 **빈칸/0/음수 금지** (프론트+백엔드 이중 가드)
  3) `cms_fn_shipment_upsert_from_order_line_v2` 동시 호출 시 **중복 생성 방지** (advisory lock)

---

## 1) “영수증 연결(분석용)” 실제 저장 (프론트)
### 문제
- 현재 `web/src/app/(app)/shipments/page.tsx`에는 `receiptUsageUpsertMutation`이 선언만 되어 있고 **사용되지 않음**.
- confirm 직후에 주석만 있고 실제 upsert가 없음: `// ✅ 영수증 연결만 (receipt_usage upsert)`

### 해결
- 아래 2군데 모두에서 “영수증 연결 upsert”를 실행:
  A) **일반 confirm(확정) 성공 직후**
  B) **매장출고(store pickup)로 저장하는 경로에서도** (confirm을 안 하므로 링크가 아예 없어짐)

### 구현 상세
- 이미 mutations 선언이 있음:
  - `const FN_RECEIPT_USAGE_UPSERT = CONTRACTS.functions.receiptUsageUpsert;`
  - `const receiptUsageUpsertMutation = useRpcMutation({ fn: FN_RECEIPT_USAGE_UPSERT })`
- `linkedReceiptId`는 이미 상태로 존재하며, 미리보기 등에 쓰고 있음.
- upsert 호출은 이 RPC를 사용:
  - `cms_fn_upsert_receipt_usage_alloc_v1(p_receipt_id, p_entity_type, p_entity_id, ...)`

#### A) 일반 confirm 흐름에 추가
파일: `web/src/app/(app)/shipments/page.tsx`
- `await confirmMutation.mutateAsync({ ... })` **바로 다음 줄**에 아래 추가:

```ts
const rid = normalizeId(linkedReceiptId);
if (rid) {
  await receiptUsageUpsertMutation.mutateAsync({
    p_receipt_id: rid,
    p_entity_type: "SHIPMENT_HEADER",
    p_entity_id: shipmentId,
    p_actor_person_id: actorId,
    p_note: "link from shipments confirm",
    // p_correlation_id: corr (있으면 넣고 없으면 생략)
  });
}
```

#### B) store pickup “저장” 흐름에도 추가
- `if (shouldStorePickup) { ... return; }` 블록 안에서 `shipmentSetStorePickupMutation` 성공 후, toast 전에 위와 동일한 `receiptUsageUpsert`를 실행.
- store pickup은 confirm을 안 하므로, 이 링크 upsert가 없으면 분석 링크가 영원히 안 남음.

#### UX 문구
- UI 제목 “영수증 연결(선택)”은 유지 가능.
- 단, 설명 문구로 “프리뷰만이 아니라 실제로 DB에 연결되어 분석에 쓰임”을 1줄 추가.

---

## 2) MANUAL 원가 입력 검증 (프론트)
### 문제
- 현재 costLines 생성에서 `unit_cost_krw: Number(cost)` + `>= 0` 필터라서 빈칸/0이 통과할 수 있음.

### 해결
- MANUAL 모드일 때:
  - 빈칸 -> 제출 불가 (toast)
  - 0/음수 -> 제출 불가 (toast)
- (안전장치) shipment에 라인이 여러 개인데 화면이 1라인만 보여서 일부만 보낼 위험이 있으면 제출 차단:
  - `hasOtherLines && !showAllLines && costMode==='MANUAL'`이면 “전체 라인 보기 켜고 전부 입력하라” toast 후 return

### 구현 포인트
- `parseNumberInput`(콤마 처리) 함수가 이미 파일에서 쓰이고 있으니 재사용.
- costLines 만들 때:
  - allowedLineIds 대상 모두에 대해 값 존재 / > 0 확인
  - costLines는 `[{ shipment_line_id, unit_cost_krw }]`로 숫자만 담아 전송

---

## 3) MANUAL 원가 입력 검증 (백엔드)
### 요구
- MANUAL에서 `unit_cost <= 0`이면 raise exception
- 가능하면 “누락(라인 수 부족)”도 막기: shipment 라인 전체가 MANUAL costLines에 포함되어야 함.

### 구현
- 최신 함수 정의는 여기: `supabase/migrations/20260209093000_cms_0363_fix_calc_cte_in_apply_purchase_cost.sql`
- 함수: `public.cms_fn_apply_purchase_cost_to_shipment_v1(...)`
- 기존 파일 수정 금지 → 새 migration 생성해서 `create or replace function`으로 덮어쓰기.
- 새 migration 파일명: `20260211037010_cms_0421_manual_cost_guard.sql` (반드시 현재 migrations 최댓값보다 큰 타임스탬프)

### 추가할 가드(함수 상단 v_mode 설정 직후 추천)
- MANUAL일 때:
  - `cost_lines`가 빈 배열이면 에러
  - element 중 `unit_cost_krw`가 null/빈칸/<=0이면 에러
  - `count(distinct shipment_line_id in cost_lines) == count(shipment lines of shipment_id)` 아니면 에러
- 주의: 숫자 파싱 실패는 기존 CTE 캐스팅이 이미 에러를 내므로, 가드에서는 “<=0/NULL”만 확실히 막아도 됨.

---

## 4) upsert 동시성 방지 (백엔드)
### 문제
- `cms_fn_shipment_upsert_from_order_line_v2`는 `p_idempotency_key`를 실제로 쓰지 않고, 동시 실행 시 중복 shipment 생성 가능.

### 해결(택1 중 advisory lock)
- 같은 `order_line_id`에 대해 트랜잭션 단위로 잠금:
  `perform pg_advisory_xact_lock(hashtext('cms_shipment_upsert:' || p_order_line_id::text));`

### 구현
- 최신 정의 파일: `supabase/migrations/20260211035010_cms_0419_shipment_upsert_from_order_line_v2_allow_zero_for_00.sql`
- 기존 파일 수정 금지 → 새 migration 생성: `20260211037110_cms_0422_shipment_upsert_advisory_lock.sql`
- 함수 `create or replace`로 동일 본문 복사 후, `begin` 다음 초반(파라미터 검증 직후) advisory lock 1줄만 추가.

---

## 5) 완료 기준(검증)
### 1) 출고 확정 후 링크 확인
```sql
select *
from cms_receipt_usage
where entity_type='SHIPMENT_HEADER'
  and entity_id = '<shipment_id>'::text
order by created_at desc;
```

### 2) 영수증에서 사용처 역추적
```sql
select *
from cms_receipt_usage
where receipt_id = '<receipt_id>'
order by created_at desc;
```

### 3) MANUAL 검증
- 프론트에서 빈칸/0 입력 시 제출 막힘
- 백엔드로 억지 호출해도 `MANUAL mode: unit_cost_krw must be > 0` 류 예외 발생

### 4) upsert 동시성
- 같은 `order_line_id`로 동시 실행 시 shipment가 2개 생기지 않음