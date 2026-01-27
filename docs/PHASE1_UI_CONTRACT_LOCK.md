# docs/PHASE1_UI_CONTRACT_LOCK.md — Phase1 UI/UX 구현 “최종 고정 계약” (LOCK)

**저장 경로(권장):** `C:\Users\RICH\.gemini\antigravity\scratch\cms_s\docs\PHASE1_UI_CONTRACT_LOCK.md`

**참고 문서/레퍼런스:**
- `docs/` 폴더 내 기존 MD 전부
- 레퍼런스 디자인 이미지: `ref_1.png`, `ref_2.png` (동일 폴더)

---

## 0) 목적(한 문장)
산발적으로 존재하는 DB 오브젝트(뷰/함수) 중 **Phase1 UI가 “실제로 사용할 것만” 고정**해서, 코딩 에이전트가 **그대로 구현만** 하도록 만든다.

---

## 1) 전역 헌법(LOCK) — 어기면 전부 반려

### 1.1 DB 접근(READ/WRITE)
- **READ(조회):** `v_*` 뷰만 사용
- **WRITE(쓰기):** `fn_*` RPC만 사용 (`rpc()` 호출만)
- ❌ base table 직접 insert/update/delete 금지
- ❌ UI에서 가격/확정/정산 로직 재구현 금지 (서버 함수/뷰 결과만 사용)

### 1.2 “계약만 사용” 원칙(산발성 봉인)
- 이 문서에 **명시된 뷰/함수만** UI에서 호출/조회 가능
- 문서에 없는 뷰/함수는 **존재하더라도 사용 금지**
- `Shipments`는 현재 확정 계약이 `_live`라 예외적으로 허용

---

## 2) Supabase 클라이언트 “스키마 고정” 규약

현재 클라우드에서 실제로 사용 가능한 스키마는 `ms_s`이며, Phase1 UI는 **`ms_s` 계약을 사용**한다.

> ❗️ **중요:** Supabase JS에서 호출 시 반드시 `.schema('ms_s')`를 고정한다.

### 2.1 READ 예시
```typescript
const db = supabase.schema('ms_s')

const { data, error } = await db
  .from('v_staff_sales_order_list_v1')
  .select('*')
  .limit(50)
```

### 2.2 WRITE(RPC) 예시
```typescript
const db = supabase.schema('ms_s')

const { data, error } = await db.rpc('fn_sales_order_create_v1', {
  // 실제 args는 DB에서 확인 후 매핑 (아래 4번 참고)
})
```

---

## 3) Phase1 “사용 고정” DB 계약 목록

### 3.1 Shipments (출고)
- **READ:** `ms_s.v_staff_ship_ready_customer_live`
- **WRITE:** `ms_s.fn_confirm_shipment_line`, `ms_s.fn_confirm_shipment_line_live`
- **사용 규칙:** Ship Ready 큐(확정 화면)로 고정. 배치 Confirm 시 순차 RPC 반복 호출.

### 3.2 Orders / Sales (주문) — v1 고정
- **READ:** `v_staff_sales_order_list_v1`, `v_staff_sales_order_detail_v1`, `v_staff_sales_order_lines_v1`
- **WRITE:** `fn_sales_order_create_v1`, `fn_sales_order_add_line_v1`, `fn_sales_order_line_update_v1`

### 3.3 Repairs (수리) — v1 고정
- **READ:** `v_staff_repair_cases_v1`, `v_staff_repair_case_detail_v1`, `v_staff_repair_lines_detail_v1`
- **WRITE:** `fn_repair_case_create_v1`, `fn_repair_line_add_v1`, `fn_repair_apply_payment_v1`

### 3.4 AR (미수/결제) — v1 고정
- **READ:** `v_staff_ar_ledgers_v1`, `v_staff_ar_ledger_detail_v1`, `v_order_ar_summary_v1`
- **WRITE:** `fn_ar_ledger_ensure_v1`, `fn_ar_line_post_v1`, `fn_ar_reconcile_v1`

---

## 4) RPC 인자(Args) “확정” 규칙
함수 호출 시 인자를 추측하지 않는다. 반드시 아래 쿼리로 실제 args를 뽑아서 UI 매핑한다.

```sql
select n.nspname as schema, p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='ms_s'
  and p.proname in ('fn_confirm_shipment_line', 'fn_confirm_shipment_line_live')
order by 1,2;
```

---

## 5) UI/UX “코딩 체크리스트”

### 5.A 전역 레이아웃/컴포넌트 규격
- [ ] **그리드:** 12-col 기반 (좌 리스트 4~5 / 우 상세 7~8)
- [ ] **ID 네이밍:** `{page}.{section}.{block}` 고정 (예: `shipments.listPanel`)
- [ ] **로딩:** 스켈레톤 UI (리스트 8개 / 디테일 6줄) 적용
- [ ] **Toast:** 성공(`처리 완료`), 실패(`처리 실패: 잠시 후 다시 시도해 주세요`) 표준 문구 사용

### 5.B Shipments (출고) 상세 구현
- [ ] **데이터:** `ms_s.v_staff_ship_ready_customer_live` 매핑
- [ ] **리스트 카드:** 고객명, 대기 라인수, 총수량 표시
- [ ] **상세 테이블:** `DataTable` + 다중 선택(`multi-row selection`)
- [ ] **액션:** `Confirm Selected` 시 진행률 표시 및 결과 토스트 출력

---

## 6) 완료 정의 (Definition of Done)
- 지정된 뷰/함수 외 호출 0건
- Shipments 단건/다건 Confirm 동작 확인
- 모든 RPC 결과에 표준 토스트 노출
- 모든 로딩 섹션에 스켈레톤 처리 완료
-
### 3.5 Catalog/Master (마스터카드)
- **READ:** `cms_master_item` (read-only select)
- **WRITE:** 없음 (Phase1은 서버 API에서 `cms_master_item` upsert)
