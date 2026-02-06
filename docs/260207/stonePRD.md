# ✅ 코덱스에게 보낼 프롬프트 (완성형)

### 목표 요약 (핵심)
1. **주문 입력(orders)** 에서 중심석/보조1석/보조2석에 대해 **공급구분 드롭다운(SELF/PROVIDED/FACTORY)** 을 선택/저장한다.
2. **영수증 매칭 확정(NEW 영수증/매칭 워크벤치)** 는 `cms_fn_receipt_line_match_confirm_v3` 를 사용한다(기존 v1 사용 금지).
3. **shipments 페이지** 에서 기존 “매칭 정보 입력” 블록을 삭제하고 그 자리에 **기본공임/보석·기타공임 계산근거 패널**을 넣는다.
4. **레이아웃이 짤리지 않도록**(특히 좁은 폭) 반응형/줄바꿈/스크롤 처리를 한다.
5. **출고정보입력(기존 입력 UI)** 는 절대 수정 금지.
6. 계산근거 패널은 DB가 확정 계산한 **evidence(json extra_items)** 를 렌더링하고, 기본공임도 근거를 같이 보여준다.

---

### ✅ DB 전제(이미 적용됨)
* **enum:** `cms_e_stone_supply_source` = `{SELF, PROVIDED, FACTORY}`
* **order upsert:** `cms_fn_upsert_order_line_v6(...)` 존재
* **match confirm:** `cms_fn_receipt_line_match_confirm_v3(...)` 존재
* **pricing rule table:** `cms_pricing_rule_v1`
* **rule pick fn:** `cms_fn_pick_pricing_rule_markup_v1(...)`
* **master addon margin cols:**
    * `cms_master_item.setting_addon_margin_krw_per_piece`
    * `cms_master_item.stone_addon_margin_krw_per_piece`
* **중요:** 프론트는 이제 v1/v2 매칭확정 함수/마스터의 보석별 공임마진 표시를 더 이상 신뢰하면 안 됨. v3에서 `extra_items`로 근거가 내려오고, 룰/부가마진 기반으로 계산됨.

---

### 1) Orders 페이지: 보석 공급구분 드롭다운 추가 + 저장
**수정 파일**
* `web/src/app/(app)/orders/page.tsx`
* `web/src/app/api/order-upsert/route.ts` (RPC 호출 v3 → v6로 변경)

**요구 사항**
* 각 stone role 별로 아래 드롭다운을 추가:
    * 중심석 공급: `p_center_stone_source`
    * 보조1석 공급: `p_sub1_stone_source`
    * 보조2석 공급: `p_sub2_stone_source`
* **UI 레이블(한국어):**
    * `SELF` = “자입(우리가 구매)”
    * `PROVIDED` = “타입(고객 제공)”
    * `FACTORY` = “공입/기성(공장 제공)”
* 저장 payload에는 해당 enum 문자열 그대로 전달 (예: `"SELF"`)
* 돌 이름이 비어있으면 공급구분은 자동으로 `null`로 저장 (돌이 없는데 공급구분만 저장되는 혼란 방지)
* 기존 주문 저장 흐름/검증/도금처리 절대 깨지면 안 됨.

**API 변경 (order-upsert)**
* `web/src/app/api/order-upsert/route.ts` 에서
    * 기존: `supabase.rpc("cms_fn_upsert_order_line_v3", typedPayload)`
    * 변경: `supabase.rpc("cms_fn_upsert_order_line_v6", typedPayload)`
* named-args 방식이라 payload 키만 맞으면 됨.
* 기존 payload에 새로운 키가 없어도 default 처리되므로 호환성 유지됨.

---

### 2) NEW 영수증/매칭 워크벤치: 매칭확정 RPC v3로 전환
**수정 파일**
* `web/src/lib/contracts.ts`
* `web/src/app/(app)/new_receipt_line_workbench/receipt-line-workbench.tsx`

**요구 사항**
* `CONTRACTS.functions.receiptLineMatchConfirm` 를 v1 → v3 로 바꾼다.
    * 기존: `"cms_fn_receipt_line_match_confirm_v1"`
    * 변경: `"cms_fn_receipt_line_match_confirm_v3"`
* confirm 호출 payload에 v3 추가 파라미터를 넣는다:
    * `p_factory_billing_shape` (optional)
    * **enum:** `SETTING_ONLY` | `BUNDLED_PACKAGE` | `SPLIT`
* UI에서는 공입(FACTORY)일 때만 billing shape 선택 드롭다운을 보여주고, 그 외에는 숨긴다.
* 기본값: `BUNDLED_PACKAGE`
* v3 계산은 영수증 `line_item_json`의 세부 키가 있으면 더 정확해지지만, 없어도 fallback 로직이 있음. 다만 최소한 공입일 때 billing shape는 선택/저장하는 걸 권장(향후 정확도).

---

### 3) Shipments 페이지: “매칭 정보 입력” 제거 → “계산근거 패널”로 교체 (레이아웃 안 짤리게)
**수정 파일**
* `web/src/app/(app)/shipments/page.tsx`
* `web/src/app/api/shipment-receipt-prefill/route.ts` (필요 필드 확장)

**절대 조건**
* shipments 페이지 내 **“출고 정보 입력” 섹션(현재 입력 UI)** 은 절대 수정 금지
* 입력 폼, state, 저장 로직, 버튼들 손대지 마라.

**무엇을 바꿀 것인가**
**A. 기존 “매칭 정보 입력” 블록 삭제**
* 현재 `shipments/page.tsx`에 "매칭 정보 입력" 라벨이 있는 카드(왼쪽 패널 하단).
* 그 카드를 삭제하고 동일 위치에 “계산근거” 카드를 넣는다.

**B. 계산근거 패널 구성**
패널은 2개 섹션(아코디언/카드 2개)로 구성:
1. **기본공임 계산근거**
    * 표시 항목:
        * 공장 기본공임 원가(영수증/매칭 값): `selected_factory_labor_basic_cost_krw`
        * 마스터 기본공임 마진: `labor_base_sell` - `labor_base_cost`
        * 출고 기본공임(확정 판매가): `shipment_base_labor_krw` (없으면 추정치로 basic_cost + diff)
    * master cost/sell은 `cms_master_item`에서 matched master id로 조회해야 함
    * → shipments page에서 `order_line`의 `matched_master_id`를 가져오고, `cms_master_item` select 로 가져온다.
2. **보석/기타공임 계산근거 (v3 evidence 렌더)**
    * `cms_shipment_line.extra_labor_items` JSON 배열을 그대로 렌더링한다.
    * v3 함수는 `extra_items`에 아래 타입들을 넣는다:
        * `type: "COST_BASIS"`: 원가 구성 + scope/billing_shape/qty + 각 원가 키
        * `type: "RULE_MARKUP"`: 룰 마진 + rule_id + unit_markup + basis
        * `type: "MASTER_ADDON_MARGIN"`: 마스터 부가마진(세팅/보석 per-piece)
        * `type: "WARN"`: 경고들
    * UI는 “표처럼 다 때려 넣지 말고” `COST_BASIS` / `RULE_MARKUP` / `MASTER_ADDON_MARGIN` / `WARN` 를 섹션별 카드로 나눠서 표시
    * 각 meta는 작은 글씨로 표시
    * `rule_id`는 복사 가능(클립보드 버튼)

**C. 레이아웃이 짤리지 않도록**
* 기존 `"grid grid-cols-2"` 고정은 폭 좁으면 깨짐 → 반응형 변경: `grid grid-cols-1 md:grid-cols-2`
* text가 길면 잘리는 문제: 각 cell에 `min-w-0` + `break-words` + `truncate` 적절히 적용
* 패널 내 테이블 형태가 필요하면: `overflow-x-auto` 를 wrapper에 적용해 가로 스크롤이 생기게 함(짤림 방지)
* shipments 좌측 worklist card가 `h-[calc(100vh-250px)]`라 내부 내용이 잘릴 수 있으니: 계산근거 영역은 내용이 길어도 줄바꿈/스크롤 가능하게 구성. “카드 자체 overflow-hidden” 같은 것 있으면 제거/완화(단, 기존 worklist 스크롤은 유지).

---

### 4) shipments-receipt-prefill API 확장 (계산근거 렌더 위해 필요)
**수정 파일**
* `web/src/app/api/shipment-receipt-prefill/route.ts`
* 기존 반환에 “추가만” 한다 (호환 유지)
* 현재 API는 match row + receipt line json 일부 + shipment line base/extra 정도만 줌. 계산근거 렌더를 위해 아래를 추가:
    * `shipment_line_id` (이미 match row select에 포함돼있을 수 있음 → 없으면 추가 select)
    * `shipment_extra_labor_items`: `cms_shipment_line.extra_labor_items` 그대로 내려주기
    * `receipt_match_overridden_fields`: `cms_receipt_line_match.overridden_fields` 내려주기 (pricing_scope, rule_ids, billing_shape 확인 가능)
* 반환 key들은 optional로, 값 없으면 `null`

---

### 5) 주문/출고 화면에 돌 공급구분 표시 (추가)
* `shipments/page.tsx`에서 주문 상세 보여주는 영역에 중심석/보조1석/보조2석 라인에 공급구분(SELF/PROVIDED/FACTORY)을 같이 표시
* 라벨은 위와 동일(자입/타입/공입)

---

### ✅ 완료 조건(Acceptance Criteria)
1. 주문 저장 시 DB `cms_order_line.center_stone_source/sub1/sub2` 값이 저장된다.
2. 영수증 워크벤치 매칭확정 시 v3 RPC가 호출된다.
3. shipments 페이지에서 기존 “매칭 정보 입력”은 사라지고, 계산근거 패널이 나타난다.
4. 계산근거 패널은 짤림 없이(모바일/좁은 창에서도) 확인 가능하다.
5. 출고정보입력 UI/로직은 변경되지 않는다.
6. 기존 기능(주문 저장/도금/출고확정/매칭취소 등) 충돌 없이 동작한다.

---

### ✅ 스모크 테스트 시나리오(코덱스가 구현 후 내가 할 테스트)
**A. 주문 저장 테스트**
1. Orders 페이지에서 새 주문 생성:
    * 중심석 있음 + 공급구분=SELF
    * 보조1석 있음 + 공급구분=PROVIDED
    * 보조2석 없음(공급구분 선택 불가/자동 null)
2. 저장 후 DB 확인:
    ```sql
    select center_stone_source, sub1_stone_source, sub2_stone_source 
    from cms_order_line where order_line_id=...;
    ```
    * 기대: `SELF`, `PROVIDED`, `NULL`

**B. 매칭확정(v3) 테스트**
1. NEW 영수증 워크벤치에서 해당 주문과 영수증 라인을 매칭 후 “매칭확정”
2. 네트워크 로그에서 RPC가 `cms_fn_receipt_line_match_confirm_v3`인지 확인
3. 결과로 `shipment_line` 생성 확인:
    ```sql
    select shipment_line_id, base_labor_krw, extra_labor_krw, extra_labor_items 
    from cms_shipment_line where purchase_receipt_line_uuid=...;
    ```
    * 기대: `extra_labor_items`에 `COST_BASIS`/`RULE_MARKUP`/`MASTER_ADDON_MARGIN` 들어옴

**C. Shipments 페이지 표시 테스트**
1. shipments 페이지에서 해당 주문 선택
2. “계산근거”가 보이고, 기본공임/보석·기타공임 근거가 표시되는지 확인
3. 창 너비를 줄여도 텍스트/패널이 짤리지 않고 줄바꿈/스크롤로 보이는지 확인

---

### 구현 시 주의사항(충돌 방지)
* DB 스키마 변경은 하지 않는다(이미 push됨).
* 기존 RPC(v1/v2/v3) 삭제/수정 금지. 프론트 호출만 v3/v6로 “전환”.
* API 응답은 기존 키 유지 + 필요한 것만 추가.
* shipments “출고 정보 입력” 섹션은 JSX/로직 모두 수정 금지.

---

### 커밋 단위 권장
1. **order-upsert route:** v6 전환 + orders UI 드롭다운 + payload 추가
2. **receipt workbench:** contracts v3 전환 + billing shape 드롭다운 + confirm payload 추가
3. **shipment-receipt-prefill API 확장 + shipments page 계산근거 패널 교체 + 레이아웃 고도화**