# [CODING AGENT PROMPT] (FRONTEND ONLY) 주문 보석 “자입/타입” 저장 + 영수증 매칭확정 v2 전환 + 출고대기(Shipments) UI 회귀 0% 보장

### 0) 절대 규칙 (Regression 0%)
* **DB는 이미 내가 push함. 너(코덱스)는 프론트엔드만 수정한다.**
* 기존 기능/화면/워크플로우가 절대 깨지면 안 된다.
* 기존 RPC(v1/v3)들은 DB에 남아있지만, 프론트는 아래 새 RPC를 사용한다:
    * 주문 upsert: `cms_fn_upsert_order_line_v4`
    * 영수증 매칭확정(confirm): `cms_fn_receipt_line_match_confirm_v2`
* `extra_labor_items` 스키마는 UI가 읽는 형태로 DB에서 이미 맞춰져 있다(0380으로 보정됨). 프론트는 이를 그대로 표시해야 한다.
* 실패 시 에러 메시지/로딩 상태/토스트 등 UX가 기존보다 나빠지면 안 된다.

### 1) 목표/동작 정의 (사용자 관점)
#### A) 주문(Orders) 화면에서 “석 공급유형” 입력/저장
* 중심석/보조1석/보조2석 각각에 대해:
    * 공급유형 드롭다운: 자입(SELF) / 타입(PROVIDED)
    * 석 이름 + 석 개수 입력
* **규칙:**
    * `stone_name`이 비어있으면 `supply_type`은 null로 저장(선택 UI disabled)
    * `stone_name`이 있고 `supply_type`이 비어있으면 `SELF`로 자동 지정
    * `stone_qty`는 정수(0 이상), name이 있으면 qty>0 권장(서버가 validation 할 수 있으니 프론트에서도 기본 validation)

#### B) 영수증 라인 워크벤치에서 “매칭 확정” 시 v2 RPC가 호출되어 출고대기 생성
* 매칭 확정(confirm)을 누르면:
    * `cms_fn_receipt_line_match_confirm_v2` 호출
    * 성공 시 기존과 동일하게 shipment draft가 생성되고, shipments로 이어짐
* **v2에서 계산되는 내용:**
    * 자입(SELF)인 석은 영수증 `unit_cost × qty`가 기타공임 원가에 포함됨
    * 타입(PROVIDED)은 보석원가 제외
    * 마스터 기반 석마진은 qty에 비례해 기타공임에 반영됨
* 프론트는 결과 return json에서 `missing_unit_cost_warn` 같은 플래그가 있으면 화면에 경고 배지/토스트로 노출(필수는 아니지만 UX상 추천)

### 2) 변경 파일/포인트 (정확히)
#### (1) Orders 저장 RPC v4로 전환
* **파일:** `web/src/app/api/order-upsert/route.ts`
* 기존 `cms_fn_upsert_order_line_v3` 호출을 **`cms_fn_upsert_order_line_v4`**로 변경
* payload에 아래 3개 필드 추가:
    * `p_center_stone_source`: "SELF" | "PROVIDED" | null
    * `p_sub1_stone_source`: "SELF" | "PROVIDED" | null
    * `p_sub2_stone_source`: "SELF" | "PROVIDED" | null
* **서버로 보내는 규칙:**
    * stone_name이 비면 source는 null
    * stone_name이 있고 source가 비면 "SELF"
* **주의:** 기존 필드명은 내가 DB에서 `center_stone_source`/`sub1_stone_source`/`sub2_stone_source`로 추가했다. 파라미터 이름은 v4에서 `p_center_stone_source` … 이므로 반드시 정확히 맞춰라.

#### (2) Orders 화면 UI에 공급유형 드롭다운 추가
* **파일:** `web/src/app/(app)/orders/page.tsx`
* 각 row(주문라인) state에 다음 값을 추가:
    * `centerStoneSource?`: "SELF" | "PROVIDED" | ""
    * `sub1StoneSource?`: "SELF" | "PROVIDED" | ""
    * `sub2StoneSource?`: "SELF" | "PROVIDED" | ""
* **데이터 로딩 시(기존 order_line fetch 결과):**
    * DB 컬럼 값이 있으면 그 값 사용
    * 없으면 "" (미정)
* **UI:**
    * `stone_name` 입력 옆에 qty input (number) 및 source dropdown 배치
    * `stone_name`이 비어있으면 dropdown disabled + 값 ""
    * `stone_name`이 입력되면 dropdown 기본 "SELF"로 자동세팅
* **저장 시:**
    * ""는 null로 변환하여 API payload로 보내기

#### (3) Receipt workbench confirm RPC v2로 전환
* **파일:** `web/src/lib/contracts.ts` (또는 RPC 이름을 상수로 관리하는 곳)
* `cms_fn_receipt_line_match_confirm_v1` → **`cms_fn_receipt_line_match_confirm_v2`**
* 기존 호출부는 함수명만 갈아타면 되게 유지하되, response handling은 v2 return 형태도 호환되게 한다.
* 만약 workbench가 직접 문자열로 rpc명을 쓴다면 그 파일에서 수정: `web/src/app/(app)/new_receipt_line_workbench/...` (repo에서 confirm 버튼이 있는 곳)

### 3) 타입/스키마/검증 (반드시)
#### A) Frontend TypeScript 타입 추가/수정
* StoneSource 타입 정의:
  ```typescript
  export type StoneSource = "SELF" | "PROVIDED";
  ```
* Orders row 타입에 optional로 추가

#### B) API payload 타입
* `order-upsert` route에서 body parsing 시 공급유형 3개를 받아서 supabase rpc에 전달
* 값이 "SELF" | "PROVIDED" | null 외면 즉시 400 처리(프론트 버그 조기 발견)

#### C) UI 회귀 방지
* Orders 화면에서 공급유형을 추가해도:
    * 기존 “저장/수정/검색/필터/정렬”이 깨지면 안 됨
    * 기존 row 확장/축소 UI가 있으면 layout 깨지면 안 됨

### 4) 필수 테스트 시나리오 (코드에 주석으로 적고 직접 체크)
1. **레거시 주문 (stone source 없음):** 기존 주문라인 열기 → 저장 눌러도 에러 없이 저장되어야 함 (source=null 허용)
2. **신규 주문: 중심석=타입(PROVIDED):** name/qty 입력 + source=PROVIDED 저장 → reload 후 그대로 유지 확인
3. **Workbench 매칭 확정 v2 동작:** confirm 버튼 → v2 호출 성공 → shipments draft 생성 확인 (에러/로딩 처리 기존과 동일 유지)
4. **missing_unit_cost_warn 노출(선택):** 자입인데 unit_cost 0인 영수증 라인에서 confirm 시 서버가 warn=true를 주면 토스트로 “자입 보석 단가가 0입니다(확인 필요)” 표시

### 5) 권장 구현 디테일 (실수 방지)
#### A) “자동 SELF 세팅”은 UI 표시만 하고 저장은 사용자가 선택했을 때만(레거시 보존)
* `stone_name` 입력하면 드롭다운 UI는 SELF로 보이게 할 수 있으나, 실제 저장 payload는 기존에 DB 값이 없고 사용자가 직접 선택하지 않았다면 null로 보내는 방식이 가장 안전(기존 데이터 의미 보존).
* 구현 방법: row에 `centerStoneSourceTouched: boolean` 같은 플래그를 둬서 사용자가 드롭다운을 만졌을 때만 저장하거나, `stone_source`가 null이면 default SELF를 서버에서 처리하도록 두고 프론트는 null 보내기.

#### B) payload mapping 함수 만들기
* Orders row → RPC params mapping은 한 함수로 중앙화해서 실수 방지 (string trim, ""→null, name 없으면 qty도 null 처리 등).

#### C) RPC name은 상수로 관리
* `contracts.ts`에 `receiptLineMatchConfirmFn = "cms_fn_receipt_line_match_confirm_v2"` 같은 상수화.

### 6) 완료 기준(Definition of Done)
* Orders에서 `stone_source`를 저장/로드/수정 가능
* Receipt workbench confirm이 v2를 호출하고 shipment draft 생성이 정상
* shipments 화면에서 `extra labor breakdown` 표시가 깨지지 않음
* 레거시 데이터(기존 주문/영수증/출고) 흐름이 그대로 동작 (회귀 0)

### 7) PR에 반드시 포함할 것
* 변경 파일 목록
* 수동 테스트 결과 스크린샷 또는 체크리스트 코멘트
* “왜 회귀가 없는지”에 대한 간단 설명(함수명 교체만, 기존 로직 보존)
* **(참고) 서버 파라미터 이름 정확히**
    * 주문 upsert v4: `p_center_stone_source`, `p_sub1_stone_source`, `p_sub2_stone_source`
    * 매칭확정 v2: `cms_fn_receipt_line_match_confirm_v2`