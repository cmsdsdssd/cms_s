# [CODING AGENT PROMPT / MUST SHIP] NEW 영수증 라인 워크벤치 — “확정/출고대기 탭 + 매칭취소(match_clear) + 라인 LOCK UX” 완전 구현

> ✅ 목표: **new_receipt_line_workbench**에서 “수기 입력 오입력/오매칭”을 **업무 장애 없이** 되돌릴 수 있게 한다.  
> ✅ 원칙: **출고확정/정산(AR/AP/재고이동/원가확정/배분)이 시작된 건은 절대 되돌리지 않는다.** > ✅ 방법: shipment가 **DRAFT(출고대기)** 인 경우에만 “매칭취소(match_clear)”를 제공하고, 그 외에는 LOCK + 정정 안내만 제공한다.  
> ✅ 중요: match_clear RPC는 권한상(anon 호출 불가 가능) **프론트에서 직접 /rpc 호출 금지**. 반드시 **Next API(Route)에서 service_role로 호출**한다.

---

## 0) 절대 룰 (깨면 실패)
- DB SoT는 `public.cms_*` 오브젝트만 사용
- 프론트에서 DB 직접 INSERT/UPDATE 금지(쓰기=RPC). 단, **Next API(route)에서 service_role로 RPC 호출/SELECT**는 허용(기존 패턴 동일)
- 기존 기능/화면 동작은 유지. **새 탭/새 API 추가로만 확장**. 기존 탭/버튼/플로우 파괴 금지.
- “충돌/오류 방지”를 위해:
  - 모든 API는 **입력 검증(zod 등)** 필수
  - 모든 API는 **일관된 에러 포맷**으로 응답
  - 모든 프론트는 **로딩/에러/빈상태 처리** 필수
  - 모든 mutation은 **react-query invalidate 범위 정확**해야 함(아래 정의)

---

## 1) 핵심 업무 규칙 (DB가 이미 강제하지만, 프론트도 동일 UX 제공)
### 상태 정의
- **미매칭**: 영수증 라인 저장 완료, `cms_receipt_line_match`에 CONFIRMED 없음
- **매칭확정(출고대기)**: `cms_receipt_line_match.status='CONFIRMED'` + 연결된 `cms_shipment_header.status='DRAFT'`
- **출고확정(LOCK)**: 연결된 `cms_shipment_header.status='CONFIRMED'`
- **다운스트림 존재(LOCK)**: AR ledger / 재고이동 ISSUE / 원가확정 ACTUAL / vendor_bill_allocation / AP alloc 등

### 가능/불가 규칙
1) **미매칭**: 라인 수정/삭제/저장 ✅
2) **매칭확정 + shipment=DRAFT**:
   - 라인 수정/삭제 ❌ (LOCK)
   - **매칭취소(match_clear) ✅** (성공하면 미매칭으로 복귀)
3) **shipment=CONFIRMED 또는 다운스트림 존재**:
   - 매칭취소 ❌
   - 라인 수정/삭제 ❌
   - **정정 영수증 안내**만 제공 ✅

---

## 2) 이미 존재하는 DB 함수 (참고)
- `public.cms_fn_receipt_line_match_clear_v1(receipt_id, receipt_line_uuid, reason, actor_person_id, note, correlation_id) returns jsonb`
  - shipment DRAFT만 허용 + 다운스트림(AR/재고/원가확정/AP alloc/배분) 있으면 에러
- `public.cms_fn_receipt_line_delete_v1(...)`는 CONFIRMED 라인 삭제를 가드로 차단(먼저 match_clear 요구)
- `public.cms_fn_upsert_receipt_pricing_snapshot_v2`는 line_items NULL 덮어쓰기 방지됨(확인됨)

---

## 3) 구현 범위 A: Next API (service_role) — 프론트는 이 API만 호출
> 기존에 `web/src/app/api/new-receipt-workbench/*/route.ts` 패턴이 이미 있다면 그대로 복사해서 사용.
> (서비스롤 클라이언트 생성, 에러 처리, 응답 포맷 스타일 통일)

### 공통 구현 요구사항 (API 전부)
- `export const runtime = 'nodejs'` (service_role 사용 시 edge 불가일 수 있음)
- `export const dynamic = 'force-dynamic'` (캐시로 stale 데이터 방지)
- 입력 검증 필수:
  - GET query: receipt_id uuid, limit number
  - POST body: receipt_id uuid, receipt_line_uuid uuid, reason_code enum
- 응답 포맷 통일:
  - 성공: `{ data: ... }`
  - 실패: `{ error: { message: string, code?: string, hint?: string, details?: any } }`
- DB 오류 메시지는 그대로 message에 넣되, 클라이언트가 매핑할 수 있도록 `code`(가능하면 PostgREST code) 포함

---

### 3-1) API: 확정 매칭 목록 조회
- 파일: `web/src/app/api/new-receipt-workbench/matches/route.ts`
- GET params:
  - `receipt_id` (required uuid)
  - `limit` (optional, default 200, max 500)
- 반환은 “확정된 매칭(CONFIRMED)”만. (출고대기/출고확정 모두 포함)
- 구현 방식(안전/성능):
  1) `cms_receipt_line_match`에서 receipt_id + status='CONFIRMED'로 목록 조회
  2) 결과에서 `shipment_id`, `order_line_id`, `receipt_line_uuid` set 구성
  3) `cms_shipment_header`를 shipment_id IN (...)로 한 번에 조회하여 status map 생성
  4) `cms_v_receipt_line_items_flat_v1`를 receipt_id + receipt_line_uuid IN(...)로 조회하여 라인 요약 map 생성
  5) `cms_v_order_worklist`를 order_line_id IN(...)로 조회하여 고객/주문 요약 map 생성
  6) 서버에서 join해서 `data[]` 구성(프론트에서 N+1 금지)

- 응답 필드(필수):
```ts
type ConfirmedMatchRow = {
  receipt_id: string;
  receipt_line_uuid: string;

  // 영수증 라인 식별/요약
  vendor_seq_no?: string | null;           // 있으면 최우선 표시
  customer_factory_code?: string | null;   // 있으면 같이 표시
  receipt_model_name?: string | null;
  receipt_material_code?: string | null;
  receipt_size?: string | null;
  receipt_color?: string | null;
  receipt_weight_g?: number | null;
  receipt_qty?: number | null;

  // 주문/고객
  order_line_id?: string | null;
  customer_party_id?: string | null;
  customer_name?: string | null;
  order_no?: string | null;

  // shipment
  shipment_id?: string | null;
  shipment_line_id?: string | null;
  shipment_status?: string | null;         // 'DRAFT' | 'CONFIRMED' | ...
  
  // match metadata
  confirmed_at?: string | null;
  selected_weight_g?: number | null;
  selected_material_code?: string | null;
  note?: string | null;
};
```
- 빈 결과: `{ data: [] }` (에러 아님)

### 3-2) API: 매칭취소(match_clear)
- 파일: `web/src/app/api/new-receipt-workbench/match-clear/route.ts`
- POST body:
```ts
type MatchClearRequest = {
  receipt_id: string;          // uuid
  receipt_line_uuid: string;   // uuid
  reason_code: 'INPUT_ERROR' | 'WRONG_MATCH' | 'RECEIPT_CORRECTION' | 'ORDER_CANCEL' | 'TEST' | 'OTHER';
  reason_text?: string;        // optional, user detail
  note?: string;               // optional internal memo
};
```
- 서버에서 p_reason 생성 규칙(중요/일관성):
  - `p_reason = ${reason_code}${reason_text ? ' - ' + reason_text.trim() : ''}`
  - `p_note = note?.trim() ?? null`
  - `correlation_id`는 서버에서 `crypto.randomUUID()` 등으로 생성해도 좋고 null로 둬도 됨
- RPC 호출:
  - `rpc('cms_fn_receipt_line_match_clear_v1', { p_receipt_id, p_receipt_line_uuid, p_reason, p_actor_person_id: null, p_note, p_correlation_id })`
- 성공 응답: `{ data: rpcResultJsonb }`
- 실패:
  - shipment not DRAFT / AR ledger exists / inventory ISSUE / ACTUAL / vendor_bill_allocation / AP alloc / legacy 진행 등 → `{ error: { message, code } }`
- idempotent 보장(프론트 안정성):
  - 백엔드가 이미 clear된 경우 `{ ok: true, already_cleared: true }` 형태일 수 있음
  - → 프론트는 이것도 “성공”으로 처리해야 함.

---

## 4) 구현 범위 B: 워크벤치 UI (new_receipt_line_workbench)
- 파일: `web/src/app/(app)/new_receipt_line_workbench/receipt-line-workbench.tsx`

### 4-1) 탭 추가
- 탭 key: `confirmed`
- 라벨(고정): “확정/출고대기”
- 탭 내 구성:
  - 상단 안내문(고정, 한국어):
    - “확정된 매칭 목록입니다. 출고대기(DRAFT) 상태에서만 ‘매칭취소’가 가능합니다.”
    - “출고확정/정산 진행 건은 취소할 수 없으며, 정정 영수증으로 처리합니다.”

### 4-2) 데이터 로딩(useQuery)
- `selectedReceiptId`가 없으면 query disabled
- `queryKey`: `["new-receipt-workbench","matches",selectedReceiptId]`
- `queryFn`: `GET /api/new-receipt-workbench/matches?receipt_id=...`
- `staleTime`: 짧게(예: 0~5초) 또는 기본. “정산/상태”는 자주 변할 수 있으니 stale 오래 두지 말 것
- 로딩/에러/빈 상태 처리 필수:
  - 로딩: 스켈레톤/Spinner
  - 에러: “불러오기 실패” + 재시도 버튼
  - 빈 상태: “확정된 매칭이 없습니다.” 문구

### 4-3) 화면 표시(테이블/카드)
- 각 row에 최소 표시:
  - 상태 Badge:
    - `shipment_status === 'DRAFT'` → “출고대기” (강조)
    - `shipment_status === 'CONFIRMED'` → “출고확정”
    - 그 외 → 원문(또는 “기타”)
  - 라인 식별: `vendor_seq_no` / `customer_factory_code`
  - 모델/재질/사이즈/색상/중량/수량(있으면)
  - 고객명 / 주문번호(있으면)
  - `confirmed_at`(있으면)

---

## 5) 구현 범위 C: “매칭취소” 모달 + 문구/에러 매핑 (완전 구현)
### 5-1) 버튼 동작
- 버튼 라벨: “매칭취소”
- 버튼 활성 조건:
  - `shipment_status === 'DRAFT'` 일 때만 enabled
- disabled tooltip(고정):
  - “출고확정 이후에는 취소할 수 없습니다. 정정 영수증으로 처리하세요.”

### 5-2) 모달 UI(필수)
- 제목: “매칭취소(출고대기 되돌리기)”
- 안내문(고정):
  - “이 작업은 ‘출고대기(DRAFT)’ 상태에서만 가능합니다.”
  - “취소 후에는 영수증 라인을 수정/삭제하고 다시 매칭할 수 있습니다.”
  - “출고확정/정산(AR/AP/재고이동/원가확정/배분)이 진행된 건은 취소할 수 없으며, 정정 영수증으로 처리해야 합니다.”
- 입력:
  - 사유(필수 select):
    - `INPUT_ERROR`: 입력오류(공임/중량/수량)
    - `WRONG_MATCH`: 오매칭(다른 주문에 연결)
    - `RECEIPT_CORRECTION`: 공장 영수증 정정
    - `ORDER_CANCEL`: 주문 취소/변경
    - `TEST`: 테스트/샘플
    - `OTHER`: 기타
  - 사유 상세(선택 input):
    - placeholder: “예) 공임 120,000을 1,200,000으로 잘못 입력”
  - 메모(선택 textarea):
    - placeholder: “팀 내부 공유 메모(선택)”
- 확인 버튼:
  - 라벨: “매칭취소 실행”
  - 클릭 시 mutation 실행 + 로딩 상태(중복 클릭 방지)

### 5-3) mutation 구현(react-query)
- `POST /api/new-receipt-workbench/match-clear`
- 성공 toast:
  - “매칭취소 완료: 출고대기에서 해제되었습니다.”
- 실패 toast:
  - 기본: 서버 message 그대로 표시
  - 아래 매핑을 추가로 적용(부분 문자열 포함 검사로 충분):
    - "shipment not DRAFT" → “출고확정된 건이라 취소할 수 없습니다. 정정 영수증으로 처리하세요.”
    - "AR ledger exists" → “AR 전표가 이미 생성되어 취소할 수 없습니다. 회계 조정이 필요합니다.”
    - "inventory ISSUE" → “재고 출고(ISSUE) 기록이 있어 취소할 수 없습니다.”
    - "purchase_cost_status" 또는 "ACTUAL" → “원가확정(ACTUAL)이 완료되어 취소할 수 없습니다.”
    - "vendor_bill_allocation" → “원가 배분이 이미 진행되어 취소할 수 없습니다.”
    - "AP alloc" → “AP 배분/상계가 진행되어 취소할 수 없습니다.”
- 실패 시 하단 안내(고정):
  - “이 건은 원본을 수정하지 않습니다. 정정 영수증(새 영수증 업로드)로 처리해주세요.”

### 5-4) invalidate/refetch (반드시 이대로)
- 성공 시 아래를 전부 invalidate:
  - `["new-receipt-workbench","receipts", ...]` (좌측 영수증 목록/상태)
  - `["new-receipt-workbench","lineItems", selectedReceiptId]` (라인 LOCK 해제)
  - `["new-receipt-workbench","unlinked", selectedReceiptId]` (미매칭 목록에 복귀)
  - `["new-receipt-workbench","matches", selectedReceiptId]` (확정 목록 갱신)
  - `["new-receipt-workbench","reconcile", selectedReceiptId]`
  - `["new-receipt-workbench","integrity", selectedReceiptId]`
- 실제 키가 다르면(레거시) 기존 코드에서 키 정의를 찾아 동일하게 맞출 것. “한 군데만 갱신돼서 화면 불일치” 절대 금지.

---

## 6) 구현 범위 D: 라인 테이블 LOCK UX (충돌/오류 방지 핵심)
### 6-1) LOCK 판정 데이터 소스
- `matchesQuery.data`에 존재하는 `receipt_line_uuid` set을 만들고,
- `lineItems` 렌더 시 해당 uuid가 있으면 “확정 매칭된 라인”으로 간주

### 6-2) LOCK 처리 (필수)
- 확정된 라인에 대해:
  - 모든 입력 필드 disabled
  - 삭제 버튼 disabled
  - 라인 우측 Badge:
    - `shipment_status === 'DRAFT'` → “매칭확정(출고대기)”
    - `shipment_status === 'CONFIRMED'` → “출고확정(LOCK)”
  - 라인 하단 작은 안내:
    - DRAFT: “수정/삭제하려면 ‘확정/출고대기’ 탭에서 매칭취소 후 진행하세요.”
    - CONFIRMED: “출고확정 이후에는 수정/삭제할 수 없습니다. 정정 영수증으로 처리하세요.”
  - 삭제 버튼 tooltip:
    - DRAFT: “매칭확정된 라인은 삭제할 수 없습니다. 먼저 매칭취소를 하세요.”
    - CONFIRMED: “출고확정된 라인은 삭제할 수 없습니다.”
- NOTE: 백엔드도 삭제를 막지만, 프론트에서 먼저 막아야 사용자 혼란/오류 호출이 없다.

---

## 7) 보너스(가능하면, 안정성↑): “정정 처리 방법 보기” 팝오버
- 출고확정(LOCK) 라인에 작은 링크 버튼:
  - 라벨: “정정 처리 방법 보기”
  - 팝오버 문구(고정):
    - “출고확정 이후에는 원본 수정/삭제가 불가합니다.”
    - “정정이 필요하면 ‘새 영수증 업로드(정정본)’로 처리하고 사유를 남기세요.”

---

## 8) 디버깅/검증 체크리스트 (이거 통과 못하면 PR 반려)
### 8-1) API 단위 테스트(수동)
- matches API:
  - receipt_id 누락 → 400
  - uuid 형식 불일치 → 400
  - 정상 receipt_id → 200 + data array
- match-clear API:
  - body 누락 → 400
  - uuid 불일치 → 400
  - 정상 DRAFT 케이스 → 200 + data.ok=true
  - 출고확정/다운스트림 케이스 → 500 또는 409(선호) + error.message

### 8-2) UI 시나리오(로컬 수동 QA)
1. 영수증 업로드 → 라인 저장 → 매칭 확정
   - 라인 입력/삭제가 LOCK 되는지
   - confirmed 탭에 항목이 뜨는지
2. confirmed 탭에서 “매칭취소” 성공
   - 해당 항목이 confirmed 탭에서 사라지고(또는 상태 변화)
   - 미매칭 목록으로 라인이 돌아오는지
   - 라인 LOCK 해제되는지
3. shipment CONFIRMED 케이스
   - 매칭취소 버튼 disabled
   - LOCK 안내/정정 안내 문구가 맞는지

### 8-3) 안정성
- `selectedReceiptId` 없을 때 쿼리 호출 0 (`enabled=false`)
- 로딩 중 버튼 중복 클릭 불가
- 네트워크 실패 시 재시도 가능
- 빈 결과 처리(“확정된 매칭 없음”) UI 깨짐 없음

---

## 9) 구현 팁(필수 준수)
- 기존 코드의 Supabase service_role 생성 유틸/패턴이 있으면 반드시 재사용(중복 구현 금지)
- Next route에서 service_role key는 절대 클라이언트로 노출 금지
- typescript strict 통과, 빌드 에러 0
- 성능: IN 쿼리로 묶어서 가져오고 서버에서 join(프론트 N+1 금지)

---

## 10) 최종 산출물(PR에 포함되어야 함)
✅ `web/src/app/api/new-receipt-workbench/matches/route.ts`  
✅ `web/src/app/api/new-receipt-workbench/match-clear/route.ts`  
✅ `web/src/app/(app)/new_receipt_line_workbench/receipt-line-workbench.tsx` 변경(탭 + UI + 모달 + LOCK)  
✅ (있다면) 공용 타입 파일/유틸 최소 변경(불필요한 리팩터링 금지)  
✅ 로컬 QA 캡처/메모(시나리오 3개 통과)

---

### 참고(에이전트가 빠지기 쉬운 함정)
- “매칭확정된 라인 삭제”는 백엔드에서 막히지만, 프론트에서 막지 않으면 사용자들이 계속 에러를 만나고 운영이 꼬인다 → 반드시 LOCK UX로 선제 차단.
- `match_clear`는 service_role route로만 호출. anon/auth RPC 직접 호출은 권한 문제로 깨질 수 있음.
- `invalidate` 범위를 정확히 해야 “한쪽만 갱신되어 화면 불일치”가 안 생김.