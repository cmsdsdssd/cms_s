# [CODING AGENT PROMPT] 번들(BUNDLE) 마스터 & BOM 롤업 프론트엔드 고도화

## 0) 프론트 목표(정의)
**유저가 할 수 있어야 하는 것**
* 마스터아이템 생성/수정에서 `master_kind`를 설정 (`MODEL`/`PART`/`STONE`/`BUNDLE`)
* **BUNDLE** 마스터에 BOM(레시피/구성품)을 붙이고, 구성품 가격이 바뀌면 BUNDLE 유효가격이 자동으로 바뀌는 걸 UI에서 즉시 확인
* **Shipments(출고)** 에서 매칭된 마스터가 BUNDLE이면
    * 유효가격(롤업) + breakdown을 보여주고
    * BOM 누락/사이클이면 확정 버튼을 막고(사전 차단)
    * 확정되면 서버가 최종값을 저장/락(이미 백엔드 체인에서 처리) → 프론트는 “프리뷰 vs 확정값”을 구분해서 보여줌

---

## 1) 새로 추가할 API 라우트(프론트용 “읽기 전용”)
프론트에서 가격 계산 로직을 복제하지 말고, RPC 결과를 그대로 가져오는 read-only API만 얇게 추가해.

**(A) `/api/master-effective-price` (GET)**
* **입력**: `master_id`, `qty?`, `variant_key?`
* **호출 RPC**: `cms_fn_get_master_effective_price_v1(p_master_id, p_variant_key, p_qty)`
* **출력(그대로 반환)**: `pricing_method`, `ok`, `error_message`, `unit_total_sell_krw`, `unit_total_cost_krw`, `total_total_sell_krw`, `total_total_cost_krw`, `breakdown`
* 이 1개로 대부분 해결됨. (BUNDLE이면 breakdown이 내려오고, 아니면 breakdown=null)

**(B) `/api/bom-flatten` (GET) — “디버그/검증용(강추)”**
* **입력**: `product_master_id`, `variant_key?`
* **호출 RPC**: `cms_fn_bom_flatten_active_v1(p_product_master_id, p_variant_key)`
* **출력**: leaf 리스트 (마스터/파트, `qty_per_product_unit`, `depth`, `path`)
* UI에서 “내 BOM이 실제로 어떤 leaf들로 펼쳐지는지”를 보여주면 운영이 훨씬 편해져. 특히 중첩 BUNDLE에서 필수.

---

## 2) 공통 UI 컴포넌트 1개로 정리 (중복 제거)
레포에 이미 `catalog/page.tsx` 와 `bom/page.tsx` 두 군데에서 BOM 편집 UI가 유사하게 존재해. 여기에 “유효가격 프리뷰 + breakdown 테이블” 붙이다 보면 같은 코드를 2번 치게 돼서, 아래 1개 컴포넌트로 빼는 걸 추천.

**`components/pricing/EffectivePriceCard.tsx` (신규)**
* **입력 props 예시**:
    * `masterId`: string
    * `qty?`: number
    * `variantKey?`: string | null
    * `title?`: string (기본 “유효가격”)
    * `showBreakdown?`: boolean (기본 true)
    * `compact?`: boolean
* **내부**:
    * react-query로 `/api/master-effective-price?...` 호출
    * `ok=false`면 error panel (빨간 배지 + 메시지)
    * `pricing_method === "BUNDLE_ROLLUP"`이면 breakdown 테이블 렌더
    * 숫자는 모두 ₩ 포맷 / g 포맷
* 이걸 Catalog / BOM / Shipments 에서 재사용하면, “번들 가격 프리뷰”가 한 번에 통일됨.

---

## 3) Catalog 페이지 수정 계획 (핵심: BUNDLE 생성/편집 + BOM meta + 프리뷰)
**대상: `web/src/app/(app)/catalog/page.tsx`**

### 3-1) master_kind 편집 UI 추가
* `CatalogItem` 타입/매핑에 `masterKind` 추가 (서버 응답 row에 `master_kind` 이미 포함됨)
* 등록/수정 모달에 `master_kind` Select 추가: `MODEL` / `PART` / `STONE` / `BUNDLE`
* 저장 요청(`/api/master-item`) payload에 `master_kind` 포함 (`master-item/route.ts`가 `p_master_kind` 이미 받는 구조라 프론트만 보내면 됨)
* **BUNDLE 선택 시 UX 규칙**
    * `material_code_default`를 자동으로 "00" 추천/자동세팅
    * `weight_default_g`, `deduction_weight_default_g` 입력은 “비활성/숨김” 처리(번들은 BOM 롤업이 SoT)
    * stone qty 같은 “마스터 자체 스톤 프로필”은 번들에서는 혼동 유발 → 접어두거나 회색 처리(완전 삭제는 말고 disable)

### 3-2) BOM 패널: 레시피 meta 편집 지원(매우 중요)
현재 레시피 업서트 시 `p_meta: {}`로 고정되어 있음. 하지만 번들 롤업 함수는 레시피 meta에서 아래를 읽어가:
* `sell_adjust_krw` (가감액)
* `sell_adjust_rate` (곱셈 비율)
* `round_unit_krw` (단위 올림 기준)

따라서 BOM 패널에 레시피 설정 섹션 추가:
* (숫자 Input) `sell_adjust_rate` (기본 1)
* (숫자 Input) `sell_adjust_krw` (기본 0)
* (숫자 Input) `round_unit_krw` (기본 1000 또는 5000 권장)
* 그리고 레시피 선택 시 `recipesQuery.data`에서 해당 recipe의 meta를 읽어 state에 주입.

**버튼 정책**
* “레시피 저장(업서트)” 버튼 하나로 통일:
    * 선택된 레시피가 있으면 `p_bom_id = selectedRecipeId`로 업데이트
    * 없으면 신규 생성

### 3-3) Catalog 상세 패널에 “유효가격 프리뷰” 추가
* 선택된 master에 대해 `EffectivePriceCard` 렌더
* `variant_key`는:
    * 기본은 null(=DEFAULT 레시피)
    * BOM 패널에서 레시피를 선택했으면 그 레시피의 `variant_key`로 프리뷰 (운영이 직관적)

### 3-4) BOM Flatten 디버그 탭(선택이지만 강추)
* `EffectivePriceCard` 아래에 “Flatten 보기” 토글
* `/api/bom-flatten` 호출해서 leaf 목록 표시
* 운영자가 “왜 가격이 이렇게 나오지?”를 즉시 추적 가능

---

## 4) BOM 페이지 수정 계획 (catalog와 동일 기능 + 운영자 도구 강화)
**대상: `web/src/app/(app)/bom/page.tsx`**
여기는 “BOM만 관리하는 화면”이니까, catalog보다 더 운영툴스럽게:
* 레시피 meta 편집 (`sell_adjust_rate` / `sell_adjust_krw` / `round_unit_krw`)
* `EffectivePriceCard` 기본 노출
* `Flatten` 디버그 기본 노출(또는 버튼)
* 레시피가 INACTIVE면 프리뷰 영역에 경고 배지
* **추가로: “variant_key 생성 도움”**
    * 현재 placeholder에 suffix/color/size가 언급되어 있으니, 입력폼 옆에 “suffix/color/size → variant_key 만들기” helper(간단 문자열 join) 넣으면 실무에서 편해짐.

---

## 5) Shipments 페이지 수정 계획 (실사용 핵심: 확정 전 프리뷰 + 실패 사전 차단)
**대상: `web/src/app/(app)/shipments/page.tsx`**

### 5-1) variant_key 자동 생성(주문 라인 기반)
백엔드 함수들이 `variant_key`를 받으니까, shipments에선 사람 손을 안 타게 만들어.
* order line에 이미 `suffix`, `color`, `size` 필드가 존재하므로 `variant_key = [suffix, color, size].filter(Boolean).join("|")` 같은 규칙으로 통일
* (BOM에서 `variant_key`를 이 규칙으로 만들면 “주문 라인 → 자동 매칭”이 됨)

### 5-2) 매칭된 master에 대해 유효가격 프리뷰 표시
* 매칭된 `master_id` + `qty` + `variant_key`로 `EffectivePriceCard` 렌더
* “출고 확정” 모달 내부 상단에도 동일하게 표시(확정 직전 확인)

### 5-3) BUNDLE에서 BOM 누락/사이클이면 “확정” 막기
`cms_fn_get_master_effective_price_v1`는 예외를 잡아서 `ok=false` + `error_message`로 내려줘.
* `pricing_method === "BUNDLE_ROLLUP" && ok === false` 인 경우:
    * Confirm 버튼 disabled
    * 버튼 옆에 “BOM 오류(확정 불가)” 배지
    * `error_message`를 토스트 + 카드에 표시
* 이렇게 하면 운영자가 “확정 눌렀더니 DB에서 에러”를 보기 전에 화면에서 차단됨.

### 5-4) “프리뷰 vs 확정값” 구분 표시(중요)
* 프리뷰는 실시간 시세/환율 기준
* 확정 후에는 `shipment_line`에 저장된 값(이미 서버 confirm 체인에서 확정/락)을 보여줘야 함
* **권장 UI**:
    * **확정 전**: 유효가격(프리뷰)
    * **확정 후**: 확정된 판매가/원가(저장값) + “프리뷰는 현재 시세로 달라질 수 있음” 작은 안내

---

## 6) QA 시나리오(이거 통과하면 “실전 운영 가능”)
* **A. 기본 번들**
    * BUNDLE 마스터 생성 (`material_code_default`=00)
    * BOM DEFAULT 레시피 생성
    * 구성품으로 MODEL 2개 추가(각 qty 1)
    * Catalog/BOM 화면에서 `EffectivePriceCard`: `pricing_method = BUNDLE_ROLLUP`, breakdown 2줄, 합계가 두 구성품 합과 일치
* **B. 구성품 가격 변경 전파**
    * 구성품 master의 `labor_sell/cost` 또는 시세 영향 값 변경
    * 번들 화면 새로고침 → 유효가격이 즉시 변함(수동 수정 없음)
* **C. 중첩 번들**
    * BUNDLE_A 구성품에 BUNDLE_B 추가
    * BUNDLE_B에 leaf 구성품들 존재
    * BUNDLE_A 유효가격 breakdown이 BUNDLE_B를 leaf로 “펼쳐서” 합산되는지 확인
* **D. BOM 누락/사이클**
    * 번들인데 active 레시피 없으면: `ok=false` + 오류 메시지 노출, Shipments에서 confirm 막힘
    * 사이클(자기 자신 포함) 만들면: `ok=false`로 막혀야 함
* **E. Shipments 확정**
    * 주문 라인에 번들 매칭
    * 프리뷰 `ok=true` 확인
    * 출고확정 → 성공
    * 확정 후 화면에서 “저장된 값”이 표시되고, 프리뷰와 구분됨

---

## 7) 코딩 에이전트에게 바로 줄 “작업 리스트(체크박스)”
* [ ] `/api/master-effective-price` GET 라우트 추가 (RPC: `cms_fn_get_master_effective_price_v1`)
* [ ] `/api/bom-flatten` GET 라우트 추가 (RPC: `cms_fn_bom_flatten_active_v1`)
* [ ] `components/pricing/EffectivePriceCard.tsx` 신규 (`react-query` + breakdown 테이블)
* [ ] `catalog/page.tsx`: `master_kind` 편집 + 저장 payload에 포함 + BUNDLE UX(재질/중량 disable)
* [ ] `catalog/page.tsx`: BOM 레시피 meta 편집 + upsert 시 `p_meta` 반영 + 선택 레시피 로딩
* [ ] `catalog/page.tsx`: `EffectivePriceCard` + (옵션) `Flatten` 디버그
* [ ] `bom/page.tsx`: 위와 동일(중복 제거하거나 공통 훅/컴포넌트 사용)
* [ ] `shipments/page.tsx`: `variant_key` 자동 생성 + `EffectivePriceCard` 표시 + `ok=false`면 confirm disable