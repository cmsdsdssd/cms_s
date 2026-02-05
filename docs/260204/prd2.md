# [CODING AGENT PROMPT] 출고확정 → AR 시세/소재 반영(#4) E2E 보장 + 운영용 AR 재계산(Resync) UI/검증 추가

## 0) 절대 규칙 (필수)
* **DB SoT**는 `public.cms_*` 오브젝트만 사용. `ms_s` 등 타 스키마 사용 금지
* **앱 코드에서 직접 INSERT/UPDATE 금지** → 쓰기는 반드시 **RPC(Function)** 로만
* **마이그레이션은 ADD-ONLY.** 기존 migration 수정/재작성 금지
* (이번 작업은 원칙적으로 프론트/검증만. 단, 불가피하게 migration이 필요하면 `supabase/migrations` 폴더에서 가장 늦은 타임스탬프보다 더 큰 값으로 새 파일 생성)
* 레포 컨벤션/권한/RLS 패턴 유지

---

## 1) 이미 완료된 DB 변경 (전제)
사용자가 DB push 완료:
* `cms_fn_ar_create_from_shipment_confirm_v1(p_shipment_id)` 가
    * `material_code 999`를 silver로 처리(purity 1.0)
    * 기존 invoice가 있으면 **UPDATE**, 없으면 **INSERT** 하는 idempotent upsert로 변경됨
    * return `jsonb`에 `{ ok, shipment_id, updated, inserted }` 형태로 결과를 주도록 변경됨
* 즉, 이제 프론트에서 **“출고확정 시 AR 계산이 맞는지 확인/복구할 수 있는 UI + 검증 루틴”**을 추가하면 #4가 실무적으로 완성된다.

---

## 2) 목표(What to ship)
**(A) 출고확정 후 AR 계산이 “정상”임을 UI/검증으로 확인 가능**
* 출고확정(현재 RPC: `cms_fn_confirm_shipment_v3_cost_v1`) 이후, AR 화면에서 해당 shipment의 invoice가
    * 999인 라인도 `commodity_type='silver'`
    * `commodity_due_g > 0`
    * `commodity_price_snapshot_krw_per_g > 0`
    * `material_cash_due_krw > 0`
* 로 보이는지 확인 가능해야 함

**(B) 과거에 잘못 생성된 invoice(999 due=0)를 “한 버튼으로 복구” 가능**
* 운영 편의 기능: 특정 `shipment_id`에 대해
    * `cms_fn_ar_create_from_shipment_confirm_v1` 를 재호출해서 AR invoice를 갱신
    * 결과(updated/inserted)를 토스트로 보여주고
    * 관련 query를 refetch 해서 화면이 즉시 갱신되게

---

## 3) 구현 범위(프론트) — 반드시 이대로

### 3-1) RPC 계약(CONTRACTS)에 함수 등록
* **파일:** `web/src/lib/contracts.ts`
* `CONTRACTS.functions`에 아래 추가:
    * **key:** `arInvoiceResyncFromShipment`
    * **value:** `"cms_fn_ar_create_from_shipment_confirm_v1"`
* (옵션) env override 패턴도 맞추고 싶으면 `NEXT_PUBLIC_RPC_AR_INVOICE_RESYNC` 같은 키로 허용

### 3-2) shipments 페이지에 “AR 재계산” 버튼 추가
* **파일:** `web/src/app/(app)/shipments/page.tsx`
* **요구사항:**
    * 사용자가 현재 선택한 shipment(`currentShipmentId`)가 있고, 그 shipment가 confirmed 상태(또는 confirmed_at 존재)일 때만 버튼 활성화
    * **버튼 라벨 예:** `AR 재계산(999 포함)`
    * **클릭 시:**
        * `useRpcMutation`로 `CONTRACTS.functions.arInvoiceResyncFromShipment` 호출
        * **payload:** `{ p_shipment_id: shipmentId }` (uuid string)
    * **성공 시:**
        * 반환 jsonb의 `updated`, `inserted`를 읽어서 `toast.success`에 상세 메시지 표시
        * 예: `AR 재계산 완료 (updated=3, inserted=0)`
    * **그리고 최소한 아래 중 1개는 반드시 수행:**
        * AR 관련 query가 이 페이지에 있으면 refetch
        * 없으면, “AR 페이지로 이동” 링크 버튼(또는 toast action)을 제공해서 사용자가 즉시 확인 가능하게
* **추가 가드:**
    * `shipmentId`가 없으면 실행 금지
    * RPC 에러 시 `useRpcMutation` 에러 핸들러 토스트로 충분

### 3-3) AR 페이지에서 “999 이상징후 감지 + 원클릭 Fix” 제공
* **파일:** `web/src/app/(app)/ar/page.tsx`
* 현재 AR 페이지는 `cms_v_ar_invoice_position_v1`를 쓰고 있고 row에 `material_code`, `commodity_type`, `material_cash_due_krw`, `commodity_due_g`, `commodity_price_snapshot_krw_per_g` 등이 있음.
* **구현:**
    * **“이상징후(999 bug 흔적)” 조건:**
        ```javascript
        material_code === '999' && (
          commodity_type === null ||
          material_cash_due_krw === 0 ||
          commodity_due_g === 0 ||
          commodity_price_snapshot_krw_per_g === 0
        )
        ```
    * 위 조건을 만족하는 invoice row가 선택되어 있거나 목록에 존재하면:
        * 상단 ActionBar 또는 우측 디테일 영역에 버튼 표시: `AR 재계산(선택 출고)`
        * **클릭 시:** 해당 row의 `shipment_id`를 사용해서 `cms_fn_ar_create_from_shipment_confirm_v1` 호출
        * **성공 시:** `updated`/`inserted` 토스트 표시 및 AR invoice 포지션 query를 `refetch()` 해서 값이 즉시 바뀌는지 확인 가능하게
* **주의:**
    * `shipment_id`가 null이면 버튼 비활성화
    * “선택된 invoice row” 기준으로 동작 (사용자 실수 방지)

### 3-4) 타입(반환 타입) 명확히
* 프론트에서 결과 파싱 실수 방지용으로 타입 정의 추가 권장:
* 위치는 `ar/page.tsx` 안에 local type으로 둬도 되고, 공용이면 `web/src/types/rpc.ts` 같은 파일 만들어도 됨.
* **예시 타입:**
```typescript
type ArResyncResult = {
  ok?: boolean;
  shipment_id?: string;
  updated?: number;
  inserted?: number;
};
```

---

## 4) (선택) 운영용 SQL 스니펫 추가
DB는 이미 수정됐지만, 운영자가 콘솔에서 한 번에 돌릴 수 있게 스니펫 추가하면 좋음.
* **위치:** `supabase/snippets/fix_ar_invoice_999_resync.sql`
* **내용:** “999인데 material_cash_due_krw=0인 shipment_id 목록 뽑아서, shipment_id마다 cms_fn_ar_create_from_shipment_confirm_v1 호출하는 DO 블록”
* **단, 직접 update/insert SQL로 테이블 때리지 말고, 함수 호출로만.**

---

## 5) 완료 기준(DoD) — 이거 통과 못하면 재작업
1.  **시나리오 1: 신규 출고확정(999 포함)**
    * shipments에서 999 소재 라인이 있는 shipment를 출고확정
    * AR 페이지에서 해당 shipment_line invoice 확인: `commodity_type='silver'`, `material_cash_due_krw > 0`, `commodity_due_g > 0`, `commodity_price_snapshot_krw_per_g > 0`
2.  **시나리오 2: 과거 잘못된 invoice 복구**
    * AR에서 999인데 `material_cash_due_krw=0` 같은 이상 row 선택
    * `AR 재계산(선택 출고)` 클릭
    * 토스트에 `updated>=1` 또는 `inserted>=1` 표시
    * refetch 후 값이 정상으로 바뀜
3.  **시나리오 3: shipments에서 수동 재계산**
    * shipments에서 confirmed shipment 선택
    * `AR 재계산(999 포함)` 클릭
    * 토스트에 `updated`/`inserted` 수치 표시
    * AR 페이지로 이동해 값 정상 확인

---

## 6) 구현 팁(실수 방지)
* RPC 파라미터명은 반드시 `p_shipment_id`로 보내기(서버 함수 시그니처 준수)
* AR 페이지는 데이터가 많으니 refetch는 “필요한 query만” (invoicePosition 쿼리) refetch
* UI는 과하게 만들지 말고 “버튼 + 토스트 + refetch”로 끝내기 (운영 안정성 우선)