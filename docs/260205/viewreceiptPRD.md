# [CODING AGENT PROMPT] 날짜별 “출고확정 영수증” + “공장발주 전송완료” 조회 화면 구현 (DB 변경 금지)

### 0) 절대 규칙
* **DB 변경/마이그레이션 금지:** 이번 작업에서는 어떠한 DB 스키마 변경이나 마이그레이션도 수행하지 않음 (ADD-ONLY 포함).
* **읽기 전용:** 기존에 존재하는 View, Table, RPC만 사용하여 데이터를 조회함.
* **기존 기능 유지:** 기존의 출고확정, 출력, 공장발주 위저드, 팩스 전송 로직 등이 깨지지 않도록 “조회/필터 UI”만 추가함.
* **타임존 기준:** 모든 날짜 필터는 **Asia/Seoul(KST)** 기준이며, 하루 단위(**YYYY-MM-DD**)로 처리함.

---

### 1) 목표 (사용자 요구사항)
* **(A) 날짜별 출고확정 영수증 조회**
    * 예: 2026-02-04 선택 시, 해당 날짜에 출고확정된 건을 거래처별로 조회하여 영수증 미리보기 및 출력 기능 제공.
    * 현재 `shipments_main`의 “오늘 출고 영수증” 버튼 기능을 확장하여 날짜 지정이 가능하게 함.
* **(B) 날짜별 공장발주 “전송완료(팩스 sent)” 조회**
    * 예: 2026-02-04 선택 시, 해당 날짜에 **팩스 전송이 완료된 발주(PO)**를 공장(벤더)별로 조회.
    * 벤더별 그룹화 및 PO 상세(모델/수량/거래처) 정보 제공.

---

### 2) 코드베이스에서 반드시 재사용할 것 (기존 자산)
* **출고 영수증 (기존 페이지):** `web/src/app/(app)/shipments_print/page.tsx`
    * 이미 지원되는 쿼리 파라미터: `?date=YYYY-MM-DD`, `?mode=store_pickup`, `?party_id=...`
    * 내부 KST 유틸 함수 활용: `getKstYmd`, `getKstStartIso`, `getKstNextStartIso`, `isValidYmd`
* **공장발주 요약 View:** `CONTRACTS.views.factoryPoSummary = "cms_v_factory_po_summary_v1"`
    * 주요 컬럼: `po_id`, `vendor_party_id`, `vendor_name`, `vendor_prefix`, `status`, `created_at`, `fax_sent_at`, `fax_provider`, `fax_payload_url`, `line_count`, `total_qty`, `model_names`, `customers`
* **공장발주 상세 RPC:** `CONTRACTS.functions.factoryPoGetDetails = "cms_fn_factory_po_get_details"`
    * 입력: `p_po_id uuid` / 출력: `jsonb` (lines 정보 포함)

---

### 3) 구현 작업 1 — shipments_print (출고 영수증) “날짜 지정 UI” 완성

#### 3-1) ActionBar UI 추가
* **날짜 선택:** `<Input type="date">`를 통해 `today` 값을 변경하면 URL 쿼리의 `date`를 갱신함.
* **날짜 이동 버튼:** `◀` (전날), `▶` (다음날) 버튼을 통해 하루 단위로 이동.
* **모드 토글:** “통상(mode 제거)” / “매장출고(mode=store_pickup)” 전환 버튼/탭 추가.
* **상태 동기화:** 모든 필터 상태(`date`, `mode`, `party_id`)는 URL 쿼리스트링을 통해 유지되어 링크 공유가 가능해야 함.

> **날짜 이동 헬퍼 예시:**
> ```javascript
> const shiftYmd = (ymd, delta) => Intl.DateTimeFormat('sv-SE', {
>   timeZone: 'Asia/Seoul',
>   year: 'numeric',
>   month: '2-digit',
>   day: '2-digit'
> }).format(new Date(new Date(`${ymd}T00:00:00+09:00`).getTime() + delta * 86400000));
> ```

#### 3-2) 필터 로직 보완
* 통상 모드에서도 `filterPartyId`가 쿼리에 존재하면 `query.eq("customer_party_id", filterPartyId)`가 적용되도록 수정.

#### 3-3) UX 및 타이틀 개선
* 왼쪽 거래처 리스트 클릭 시 `setActivePartyId`뿐만 아니라 URL 쿼리(`party_id`)도 갱신.
* “전체 보기” 옵션 제공 (쿼리에서 `party_id` 제거).
* 모드에 따른 타이틀 분기: `출고 영수증(통상)` vs `출고 영수증(매장출고)`.

---

### 4) 구현 작업 2 — shipments_main에서 “날짜 지정 후 영수증 열기”
* `shipments_main/page.tsx` 툴바에 날짜 입력 필드(`type="date"`, 기본값 오늘 KST) 추가.
* 기존 “오늘 출고 영수증” 링크를 선택된 날짜가 포함된 `/shipments_print?date=${selectedDate}` 형태로 변경.
* `UnifiedToolbar` 디자인 가이드에 맞춰 높이(`h-8`) 조정.

---

### 5) 구현 작업 3 — 공장발주 전송완료 “날짜별 조회 페이지” 신규 생성

#### 5-1) 라우트 설정
* **경로:** `web/src/app/(app)/factory_po_history/page.tsx`
* **목적:** 특정 날짜에 `fax_sent_at`이 포함된 `SENT_TO_VENDOR` 상태의 PO 조회.

#### 5-2) 쿼리 명세
* **View:** `CONTRACTS.views.factoryPoSummary`
* **필터:**
    * `status` = `SENT_TO_VENDOR`
    * 날짜 범위: `fax_sent_at >= getKstStartIso(date)` AND `fax_sent_at < getKstNextStartIso(date)`
    * 벤더 필터: `vendor_party_id` 또는 `vendor_prefix` (존재 시)
* **정렬:** `fax_sent_at` 오름차순.

#### 5-3) UI 구성
* **ActionBar:** 제목(공장발주 전송내역), 날짜 선택 및 이동 버튼, 벤더 필터(SearchSelect).
* **통계 요약:** 당일 전송 PO 수, 총 라인 수 합계, 총 수량 합계 표시.
* **리스트 렌더링:** 벤더별 그룹화(Group Header: 이름, 접두어, 건수).
* **PO 항목:** 전송 시간(KST), 라인 수/수량, 모델명 및 고객 요약(Truncated), FAX 열기 버튼, 상세 모달 버튼.

#### 5-4) 상세 모달
* `factoryPoGetDetails` RPC를 호출하여 `lines` 정보를 테이블로 표시.
* 컬럼: 고객명, 모델명, Suffix, 색상, 사이즈, 수량, 메모. (조회 전용)

---

### 6) 접근 경로 (네비게이션)
* **사이드바:** `nav-items.ts`의 "업무 흐름" 그룹에 "공장발주 전송내역" 추가.
* **orders_main:** ActionBar에 “발주 전송내역” 바로가기 버튼 추가.

---

### 7) 완료 기준 (체크리스트)
* [ ] `shipments_main`에서 날짜 선택 후 영수증 버튼 클릭 시 해당 날짜의 `shipments_print`로 이동하는가?
* [ ] `shipments_print`에서 날짜 변경 시 데이터가 즉시 동기화되는가?
* [ ] `shipments_print`의 거래처 선택 상태가 URL `party_id`로 유지되어 공유 가능한가?
* [ ] `factory_po_history` 페이지에서 `fax_sent_at` 기준 KST 하루 범위 조회가 정확한가?
* [ ] 벤더별 그룹화 및 FAX 열기 기능이 정상 작동하는가?
* [ ] PO 상세 모달에서 라인 데이터가 올바르게 로드되는가?

---

### 8) 구현 시 주의사항
* **타임존:** 반드시 KST 기준으로 날짜 범위를 계산하여 UTC 오차를 방지할 것.
* **코드 정리:** `shipments_print/page.tsx` 등 기존 파일 수정 시 불필요한 중복 코드(`"use client";` 등)를 정리하되 로직에 영향을 주지 말 것.
* **권한:** 신규 페이지는 기존 페이지의 패턴을 따라 `authenticated` 세션을 전제로 구현함.

---
**다음 단계로 제가 무엇을 도와드릴까요?** 만약 특정 파일(`factory_po_history/page.tsx`)의 구체적인 React 코드 구조 작성이 필요하시다면 말씀해 주세요.