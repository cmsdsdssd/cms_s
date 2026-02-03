# Next.js(App Router) + Supabase 신규 영수증/매칭 워크벤치 구현 가이드

너는 Next.js(App Router) + Supabase 실무급 엔지니어다. 아래 요구사항을 빠짐없이 구현하라.

## 핵심 원칙
* **기존 레거시 페이지는 유지**하고, 신규 플로우는 **반드시 `/new_` prefix 라우트**로 만든다.
* 기존 공통 컴포넌트/스타일/훅은 최대한 재사용하되, 신규 코드는 `/new_...` 라우트 아래로 만든다.

---

## 0) 프로젝트 전제/제약
* **프로젝트 구조:** `/web/src/app/(app)/...` 구조의 Next.js App Router
* **Supabase 호출 방식:**
    * `getSchemaClient()` 사용
    * `@tanstack/react-query` 사용
    * RPC는 `useRpcMutation()` + `callRpc()` 패턴 사용
* **“타임아웃 방지” 최우선:**
    * 조회는 항상 `.limit()` / 날짜 필터 / 선택된 receipt만 상세 조회
    * react-query에 `staleTime`/`gcTime` 적절히 설정
* **레거시 보존:** 신규 페이지는 기존 레거시(출고/영수증 페이지들)를 건드리지 않는다.
    * 단, 네비게이션 메뉴에 링크 추가 + `CONTRACTS` 상수에 뷰/RPC 이름 추가 정도의 “얕은 변경”은 허용.

---

## 1) 신규 라우트 (반드시 생성)

### 1.1 메인 워크벤치 페이지
* **파일 경로:** `web/src/app/(app)/new_receipt_line_workbench/page.tsx`
* **URL:** `/new_receipt_line_workbench`

### 1.2 (선택) 딥링크 라우트 (있으면 좋음)
* **파일 경로:** `web/src/app/(app)/new_receipt_line_workbench/[receiptId]/page.tsx`
* **URL:** `/new_receipt_line_workbench/<receipt_uuid>`
* **내용:** 내부는 메인 페이지 재사용(컴포넌트 분리)해서 receipt 자동 선택만 다르게 처리.

---

## 2) 사용해야 하는 DB 오브젝트 (정확한 이름)

### 2.1 뷰 (SELECT)
* `cms_v_receipt_inbox_open_v1`: 영수증 인박스 + pricing_snapshot(line_items 포함)
* `cms_v_receipt_line_items_flat_v1`: pricing_snapshot.line_items를 라인 단위로 flatten
* `cms_v_receipt_line_unlinked_v1`: 매칭(CONFIRMED) 안된 라인만
* `cms_v_receipt_line_link_integrity_v1`: 매칭은 CONFIRMED인데 shipment_line 연결이 깨진 것
* `cms_v_receipt_line_reconcile_v1`: receipt 합계 vs 매칭된 shipment cost 합계 차이

### 2.2 RPC (반드시 이 이름/파라미터로 호출)

#### `cms_fn_upsert_receipt_pricing_snapshot_v2`
* **Params:**
    * `p_receipt_id`
    * `p_currency_code`
    * `p_total_amount`
    * `p_weight_g`
    * `p_labor_basic`
    * `p_labor_other`
    * `p_line_items`

#### `cms_fn_update_vendor_bill_header_v1`
* **용도:** 영수증 헤더 업데이트용으로만 사용 (vendor/issued_at/bill_no/memo)
* **Params:**
    * `p_receipt_id`
    * `p_vendor_party_id`
    * `p_bill_no`
    * `p_bill_date`
    * `p_memo`
* **주의:** `p_lines`는 쓰지 말 것 (우리 신규 라인은 `pricing_snapshot.line_items`가 SoT)

#### `cms_fn_receipt_line_match_suggest_v1`
* **Params:** `p_receipt_id`, `p_receipt_line_uuid`, `p_limit`
* **Returns:** rows with `match_score`, `score_detail_json` 포함

#### `cms_fn_receipt_line_match_confirm_v1`
* **Params:**
    * `p_receipt_id`
    * `p_receipt_line_uuid`
    * `p_order_line_id`
    * `p_selected_weight_g`
    * `p_force`
    * `p_note`
* **결과 JSON 포함:** `shipment_id`, `shipment_line_id`, `created_shipment_draft`

---

## 3) 신규 페이지가 제공해야 하는 “사용자 플로우”
아래 플로우가 **한 화면**에서 가능해야 한다.

### 3.1 영수증 업로드 (기존 API 재사용)
* 업로드 버튼 → 파일 선택 → `/api/receipt-upload` 호출
* 성공 시 `receipt_id`를 받아서 좌측 리스트 상단에 뜨게 하고 자동 선택

### 3.2 영수증 선택 → PDF/이미지 미리보기
* 선택한 receipt의 `file_bucket`/`file_path`/`mime_type`로 `/api/receipt-preview` 호출
* 우측/중앙 패널에 미리보기 표시 (`purchase_cost_worklist`의 미리보기 코드 재사용)

### 3.3 영수증 헤더 입력
* **입력 가능 항목:**
    * `vendor_party_id` (공장)
    * `issued_at` (영수증 날짜)
    * `bill_no` (우리 관리용 번호: “YYYYMMDD_공장이니셜_1” 같은 포맷 안내만; 자동생성은 옵션)
    * `memo`
* 저장 시 `cms_fn_update_vendor_bill_header_v1` 호출 (`p_lines`는 null)

### 3.4 영수증 라인 입력/수정 (핵심)
* 라인들은 `cms_receipt_pricing_snapshot.line_items`(jsonb array)가 **SoT**다.
* UI에서 라인을 추가하면 즉시 UUID를 박고(`line_uuid`) 이후 수정해도 유지해야 한다.
    * 브라우저에서 `crypto.randomUUID()` 사용
* **라인 필드 (최소):**
    * `line_uuid` (UUID, hidden)
    * `customer_factory_code` (공장 영수증에 찍히는 고객코드. 짧게. 예: A-01 권장. 강제는 X)
    * `model_name` (필수)
    * `material_code` (필수, select: 14|18|24|925|999|00)
    * `qty` (기본 1)
    * `weight_g` (공장 라인 중량, 소수 2자리)
    * `labor_basic_cost_krw` (원가)
    * `labor_other_cost_krw` (원가)
    * `total_amount_krw` (원가; 없으면 프론트에서 `labor_basic` + `labor_other`로 자동 계산해 채워넣기 권장)
    * `size`, `color` (옵션)
    * `vendor_seq_no` (옵션: 있으면 입력, 없으면 remark에서 숫자 파싱해도 됨)
    * `remark` (옵션)
* “라인 저장” 버튼 → `cms_fn_upsert_receipt_pricing_snapshot_v2` 호출
    * `p_line_items`에 위 라인 배열을 그대로 넣는다.
    * (옵션) 헤더 totals도 라인 합으로 계산해서 같이 저장해도 좋지만 필수는 아님.

### 3.5 매칭 워크벤치 (사람이 확정)
* 선택한 receipt의 라인들 중, 매칭 안된 라인만 보여주는 “미매칭 목록”이 있어야 한다.
* **데이터 소스:** `cms_v_receipt_line_unlinked_v1` (receipt_id로 필터)
* 사용자가 미매칭 라인 1개를 클릭하면:
    1.  해당 라인의 상세(모델/소재/중량/공임/비고/코드)를 보여주고
    2.  “매칭 제안” 버튼을 누르면 `cms_fn_receipt_line_match_suggest_v1`을 호출해 후보 리스트 표시
* **후보 리스트 UI 요구사항:**
    * 후보는 `match_score` 내림차순으로 표시
    * **각 후보에 최소 표시:**
        * `customer_name`
        * `status` (WAITING_INBOUND / READY_TO_SHIP)
        * `model_name`, `size`, `color`, `material_code`
        * `effective_weight_g`, `weight_min_g`, `weight_max_g`
        * `factory_po_id`, `memo` (있으면)
        * `match_score`
    * `score_detail_json`은 “펼치기”로 보여줘서 왜 점수가 나왔는지 확인 가능하게 한다.

### 3.6 “확정” 시 즉시 shipment draft 생성
* 후보 1개 선택 → 확정 패널에서 다음을 입력:
    * `selected_weight_g` 기본값:
        * 우선 `factory_weight_g`(영수증 라인 중량)
        * 없으면 `effective_weight_g`
    * 안내 텍스트로 `allowed range: weight_min_g ~ weight_max_g` 보여주기
    * 입력값이 범위를 벗어나면 “확정 불가” (서버도 막지만 프론트에서 먼저 막기)
    * `p_note` (선택): 서버에서 shipment_line.memo 제일 앞에 `/receiptId-lineUuid`와 함께 들어감
    * **“재적용(Force)” 토글(옵션):**
        * 이미 CONFIRMED인 라인을 다시 적용해야 할 때만 사용
        * true면 `p_force=true`
* 확정 버튼 → `cms_fn_receipt_line_match_confirm_v1`
* **성공 후 UX:**
    * toast: “매칭 확정 + shipment draft 생성 완료”
    * 결과 JSON의 `shipment_id`를 화면에 노출 + “거래처 작업대 열기” 버튼 제공
    * 가능하면 후보의 `customer_party_id`를 사용해 `/workbench/<partyId>`로 링크
* **react-query invalidate/refetch:**
    * unlinked 목록 갱신
    * receipt open view 갱신
    * (선택) reconcile/link_integrity 갱신

---

## 4) 화면 레이아웃 (권장: 3패널 Split)

### 좌측: Receipt 리스트
* **소스:** `cms_v_receipt_inbox_open_v1`
* **필터:**
    * `status` (UPLOADED/LINKED 등)
    * `vendor_party_id`
    * `날짜 범위` (최근 30~60일 기본)
* 리스트는 50개 단위 limit, “더보기” 가능

### 중앙: 선택한 Receipt 상세 + 라인 에디터
* **상단:** 헤더(vendor/issued_at/bill_no/memo) + 저장
* **중단:** PDF/이미지 preview
* **하단:** 라인 테이블(추가/삭제/저장)

### 우측: 매칭 패널
* **탭 3개 권장:**
    1.  **매칭:** 미매칭 라인 목록 + 후보 제안 + 확정
    2.  **정합성:** `cms_v_receipt_line_reconcile_v1` (receipt_id로 필터)
    3.  **링크오류:** `cms_v_receipt_line_link_integrity_v1` (receipt_id로 필터)
* 탭은 UI 컴포넌트 없으면 간단한 버튼 토글로 구현

---

## 5) 성능/안정성 (타임아웃 방지 규칙)
* `cms_v_receipt_inbox_open_v1`는 기본 `.order(received_at desc).limit(50)`로만 가져오기
* **receipt 선택 시에만:**
    * `cms_v_receipt_line_items_flat_v1`를 receipt_id로 필터해서 가져오기
    * `cms_v_receipt_line_unlinked_v1`를 receipt_id로 필터해서 가져오기
* suggest RPC는 라인 클릭 후 “버튼 눌렀을 때만” 호출
* **react-query 권장:**
    * 리스트 staleTime 1~5분
    * 상세 staleTime 10~30초
* **에러 처리:**
    * RPC 에러는 기존 `useRpcMutation` 토스트 정책 그대로 사용

---

## 6) 구현 시 수정/추가 파일 (최소)

### 6.1 페이지
* `web/src/app/(app)/new_receipt_line_workbench/page.tsx` (필수)
* (선택) `web/src/app/(app)/new_receipt_line_workbench/[receiptId]/page.tsx`

### 6.2 Contracts
* (권장) `web/src/lib/contracts.ts`
* **views에 아래 추가:**
    ```typescript
    receiptInboxOpen: "cms_v_receipt_inbox_open_v1",
    receiptLineItemsFlat: "cms_v_receipt_line_items_flat_v1",
    receiptLineUnlinked: "cms_v_receipt_line_unlinked_v1",
    receiptLineLinkIntegrity: "cms_v_receipt_line_link_integrity_v1",
    receiptLineReconcile: "cms_v_receipt_line_reconcile_v1",
    ```
* **functions에 아래 추가:**
    ```typescript
    receiptPricingSnapshotUpsertV2: "cms_fn_upsert_receipt_pricing_snapshot_v2",
    receiptLineMatchSuggest: "cms_fn_receipt_line_match_suggest_v1",
    receiptLineMatchConfirm: "cms_fn_receipt_line_match_confirm_v1",
    ```

### 6.3 Navigation
* (권장) `web/src/components/layout/nav-items.ts`
* “업무 흐름” 또는 “통합 작업대”에 링크 추가:
    * `{ label: "NEW 영수증/매칭", href: "/new_receipt_line_workbench", icon: ClipboardList }`

---

## 7) 완료 정의 (Acceptance Criteria)
* 업로드 → receipt 선택 → 헤더 저장 → 라인 추가/저장 → 미매칭 라인 클릭 → 제안 → 후보 선택 → weight 범위 확인 → 확정 → shipment draft 생성까지 동작
* 확정 후 미매칭 목록에서 해당 라인이 사라짐
* 정합성 탭에서 receipt 합/매칭 합/차이가 조회됨
* 링크오류 탭에서 “shipment_line 연결 깨짐”이 조회됨
* 모든 신규 코드는 `/new_...` 아래에 있고 레거시 플로우에 영향 없음
* 대량 데이터에서도 기본 화면 로딩이 느리지 않게 limit/필터가 적용됨
* 이 프롬프트대로 구현해라. 모든 RPC/뷰 이름과 파라미터 키는 위에 적힌 그대로 사용해야 한다.
* (오타/대소문자/파라미터명 틀리면 실패)