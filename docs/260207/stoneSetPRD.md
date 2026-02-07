# [CODING AGENT PROMPT] Shipments 계산근거(룰/마스터부가마진) UI 완성 + Settings(글로벌 룰 관리) + Master(부가마진 편집) + Order upsert v6로 교체

## 0) 절대 규칙 (충돌/장애 방지)
- DB 마이그레이션/스키마 변경 금지 (이미 push 완료)
- 기존 기능/화면 흐름/버튼 동작 유지
- **Shipments 페이지의 “출고 정보 입력” 영역(입력 폼)** 은 로직/레이아웃/필드 변경 금지  
  - 변경해도 되는 건 “출고 정보 입력” 위/옆에 있는 영역(현재는 ‘계산근거’ 패널)과 Settings / Catalog / API route
- 레이아웃 “짤림” 방지: 우측 메인 컬럼은 반드시 `min-w-0`, 테이블은 `overflow-x-auto`로 스크롤 처리
- 새로 추가하는 Settings/Rules는 **관리용 UI** 이므로, 최소한의 검증(숫자/범위/필수값) + 실패 시 에러 메시지 표시

---

## 1) 현재 DB/계약(이미 존재, 참고)
### 1.1 글로벌 룰 테이블
- table: `public.cms_pricing_rule_v1`
- columns (핵심):
  - `rule_id uuid PK`
  - `component cms_e_pricing_rule_component` = `SETTING | STONE | PACKAGE`
  - `scope cms_e_pricing_rule_scope` = `ANY | SELF | PROVIDED | FACTORY`
  - `vendor_party_id uuid null` (null이면 모든 공장 글로벌)
  - `min_cost_krw numeric not null`
  - `max_cost_krw numeric null`
  - `markup_kind cms_e_pricing_rule_markup_kind` (현재 `ADD_KRW`)
  - `markup_value_krw numeric not null`
  - `priority int not null default 100`
  - `is_active boolean not null default true`
  - `note text`
  - `created_at/updated_at`
- 룰 픽 함수:
  - `public.cms_fn_pick_pricing_rule_markup_v1(p_component, p_scope, p_vendor_party_id, p_cost_basis_krw)`
  - return: `{ markup_krw, picked_rule_id }`

### 1.2 마스터 부가마진(개당)
- `public.cms_master_item`:
  - `setting_addon_margin_krw_per_piece numeric not null default 0`
  - `stone_addon_margin_krw_per_piece numeric not null default 0`

### 1.3 주문 라인 공급구분(이미 사용 중)
- `public.cms_order_line`:
  - `center_stone_source/sub1_stone_source/sub2_stone_source` : `cms_e_stone_supply_source` = `SELF | PROVIDED | FACTORY`
- 주문 upsert 최신:
  - `cms_fn_upsert_order_line_v6(...)`  (v5는 중복 시그니처 문제 있음 → **v6만 사용**)

### 1.4 Shipments 계산근거
- 저장 위치: `cms_shipment_line.extra_labor_items` (jsonb)
- 읽는 경로:
  - `web/src/app/api/shipment-receipt-prefill/route.ts`
  - → `web/src/app/(app)/shipments/page.tsx`
  - → `web/src/components/shipments/ShipmentPricingEvidencePanel.tsx`
- Evidence Panel은 이미 다음 type들을 표시 가능:
  - `COST_BASIS`, `RULE_MARKUP`, `MASTER_ADDON_MARGIN`, `WARN`
  - 기존 레거시: `CENTER`, `SUB1`, `SUB2`, `OTHER`, `PLATING` 등

---

## 2) 목표 (이번 작업에서 반드시 완료)
### A) Settings에 “글로벌 룰(물림/원석/패키지) 관리 UI” 추가
- 위치: `web/src/app/(app)/settings/page.tsx`에 **새 카드 섹션** 추가 (권장: `lg:col-span-2`로 전체 폭 사용)
- 기능:
  1) 룰 목록 조회(테이블)
  2) 룰 생성/수정(Upsert)
  3) 룰 비활성화/삭제(가능하면 삭제 대신 비활성 권장. 삭제는 confirm modal)
  4) 룰 픽 “테스트 패널” 제공:
     - component/scope/vendor/cost_basis 입력 → `cms_fn_pick_pricing_rule_markup_v1` 호출 → `picked_rule_id`, `markup_krw` 표시

### B) Catalog(마스터 수정 화면)에 “마스터 부가마진(개당)” 2개 입력 UI 추가
- 대상 페이지(둘 다 존재하므로 둘 다 반영):
  - `web/src/app/(app)/catalog/page.tsx`
  - `web/src/app/(app)/2_catalog/page.tsx`
- 추가 필드:
  - “세팅 부가마진(개당, 원)” = `setting_addon_margin_krw_per_piece`
  - “원석 부가마진(개당, 원)” = `stone_addon_margin_krw_per_piece`
- 저장:
  - 둘 다 기존 저장 API `POST /api/master-item` 로 payload 확장
  - 서버 route에서 `cms_master_item` update에 두 컬럼 포함

### C) Order upsert API를 v6로 교체 (중복 시그니처(v5)로 인한 장애 예방)
- 파일: `web/src/app/api/order-upsert/route.ts`
- 변경:
  - `cms_fn_upsert_order_line_v5` 호출을 **v6로 교체**
  - payload 파라미터 순서/이름을 v6 시그니처에 정확히 맞춤
  - `center/sub1/sub2_stone_source` 기본값:
    - 지금까지 레거시가 “공입(FACTORY)” 성격이므로,
    - **source가 비어있으면 FACTORY로 기본 처리** (SELF 기본 처리 금지)
  - 예외 fallback:
    - v6가 없는 환경(거의 없겠지만)을 대비해, “function not found” 계열만 v3로 fallback(기존 파일 로직 유지)

### D) Shipments 화면 레이아웃 “짤림” 방지 + 현재 스크린샷 형태 유지
- Shipments 페이지는 이미 “계산근거” 패널이 들어가 있는 상태로 보이는데, 다음을 최종 보장:
  - “계산근거” 패널은 **출고 정보 입력 위**에 존재 (스크린샷처럼)
  - 우측 컬럼 `min-w-0`, 패널 내부 테이블은 `overflow-x-auto`
  - 좌측 주문 카드/검색 패널과 우측 패널이 같이 있을 때 가로폭이 줄어도 **잘리지 않고 스크롤** 처리

---

## 3) 구현 상세 (파일별 작업 지시)

### 3.1 Settings: 룰 관리 UI
#### 3.1.1 새 API Route 추가 (service role 사용)
- 파일 생성: `web/src/app/api/pricing-rules/route.ts`
- 요구사항:
  - `GET`: 룰 목록 반환 (기본 최신 우선: updated_at desc)
  - `POST`: upsert (rule_id 없으면 `crypto.randomUUID()`로 생성)
  - `DELETE`: rule_id로 삭제 (또는 `POST` action으로 is_active=false 처리도 가능)
- 검증(최소):
  - min_cost_krw >= 0
  - max_cost_krw가 있으면 max>=min
  - markup_value_krw >= 0
  - priority int (없으면 100)
  - component/scope enum 값만 허용
- 쿼리:
  - select는 `cms_pricing_rule_v1` 전체 필드
  - upsert는 rule_id 기준

#### 3.1.2 Settings 페이지에 카드 추가
- 파일: `web/src/app/(app)/settings/page.tsx`
- UI 구성(권장):
  - `<Card className="lg:col-span-2">` 로 전체 폭
  - 상단: 제목 “가격 룰(글로벌)”
  - 좌측: 룰 생성/수정 폼
    - component dropdown(SETTING/STONE/PACKAGE)
    - scope dropdown(ANY/SELF/PROVIDED/FACTORY)
    - vendor dropdown(“전체 공장(빈값)” + `/api/vendors`에서 목록)
    - min_cost / max_cost(옵션) / markup_value / priority / is_active / note
    - 저장 버튼(생성/수정)
  - 우측 또는 하단: 룰 목록 테이블
    - Active, Component, Scope, Vendor, Range, Markup, Priority, Note, Updated, Actions(Edit/Delete)
    - Edit 클릭 시 폼에 로드
    - Delete는 confirm
  - 하단: “룰 테스트” 패널
    - component/scope/vendor/cost_basis 입력
    - `schemaClient.rpc("cms_fn_pick_pricing_rule_markup_v1", ...)` 호출(권한 부여되어 있음)
    - 결과 표시: picked_rule_id / markup_krw
- 상태관리:
  - `useQuery`로 `/api/pricing-rules`
  - `useMutation`으로 upsert/delete
  - 성공 시 invalidate(refetch)

---

### 3.2 Master 부가마진: catalog/2_catalog에 입력 필드 추가 + 저장
#### 3.2.1 서버 route 확장
- 파일: `web/src/app/api/master-item/route.ts`
- 현재 update payload에 아래 2개를 포함해서 `cms_master_item.update()`에 전달:
  - `setting_addon_margin_krw_per_piece`
  - `stone_addon_margin_krw_per_piece`
- null/undefined 처리:
  - 입력이 없으면 보내지 않거나 0으로 normalize (DB default 0이므로 “비워두면 0” UX 권장)

#### 3.2.2 Catalog UI 확장 (두 페이지)
- 파일:
  - `web/src/app/(app)/catalog/page.tsx`
  - `web/src/app/(app)/2_catalog/page.tsx`
- “마스터 편집 모달/패널”에 숫자 입력 2개 추가:
  - 라벨:
    - “세팅 부가마진(개당, 원)”
    - “원석 부가마진(개당, 원)”
  - helper text:
    - “룰 마진 외에 마스터별로 추가로 붙이는 개당 마진”
- 저장 payload에 두 값 포함해서 `/api/master-item`로 전달

---

### 3.3 Order upsert: v6로 교체 (중복 v5 장애 방지)
- 파일: `web/src/app/api/order-upsert/route.ts`

#### 변경 1) rpc 호출 함수명 교체
- 기존: `cms_fn_upsert_order_line_v5`
- 변경: `cms_fn_upsert_order_line_v6`

#### 변경 2) v6 파라미터 매핑 정확히
v6 args (순서/이름 중요):
- p_customer_party_id
- p_master_id
- p_qty
- p_size
- p_is_plated
- p_plating_variant_id
- p_plating_color_code
- p_requested_due_date
- p_priority_code
- p_source_channel
- p_memo
- p_order_line_id
- p_center_stone_source
- p_center_stone_name
- p_center_stone_qty
- p_sub1_stone_source
- p_sub1_stone_name
- p_sub1_stone_qty
- p_sub2_stone_source
- p_sub2_stone_name
- p_sub2_stone_qty
- p_actor_person_id
- p_suffix
- p_color
- p_material_code

#### 변경 3) source 기본값 정책 (중요)
- 레거시(미입력) 대부분이 공입/기성 성격 → **source 미지정이면 FACTORY**
- 단, name/qty가 비어있으면 source도 null로 보내도 됨
- 구현 예:
  - name이 비어있으면 source=null
  - name이 있으면 source가 null/undefined면 `'FACTORY'`

---

### 3.4 Shipments 레이아웃 “짤림” 방지 (스크린샷 유지)
- 파일: `web/src/app/(app)/shipments/page.tsx` / `web/src/components/shipments/ShipmentPricingEvidencePanel.tsx`
- 요구:
  - 계산근거 패널은 **출고 정보 입력 위**에 유지
  - 우측 컨테이너에 `min-w-0` 확인/추가
  - Evidence Panel 내부 테이블은 이미 `overflow-x-auto`가 있으나, 부모에 `min-w-0`가 빠져 있으면 추가
  - “출고 정보 입력” 카드 영역은 변경 금지

---

## 4) 완료 기준 (Acceptance / Smoke Test)
### 4.1 룰 설정 UI
1) Settings에서 룰 3개 생성:
   - (SETTING, ANY, vendor=null, min=0, max=null, markup=200, priority=100, active=true)
   - (STONE, SELF, vendor=null, min=0, max=null, markup=500, priority=100, active=true)
   - (PACKAGE, FACTORY, vendor=null, min=0, max=null, markup=1000, priority=100, active=true)
2) 룰 테스트에서:
   - component=SETTING, scope=SELF, vendor=아무거나, cost=1000 → markup이 200 또는 더 특이 룰이면 그 값으로 반환되는지 확인

### 4.2 마스터 부가마진
1) 마스터 편집에서
   - setting_addon=300, stone_addon=700 저장
2) 저장 후 재조회 시 값 유지 확인

### 4.3 주문 저장(v6)
1) 주문 생성/수정에서 center/sub1/sub2 source를 선택(SELF/PROVIDED/FACTORY) 후 저장
2) API route가 v6로 정상 호출되어 에러 없이 저장되는지 확인
3) source 미선택 + stone name 입력 시 source가 FACTORY로 저장되는지 확인

### 4.4 Shipments 계산근거 표시
1) 영수증 매칭확정(v3)로 shipment_line 생성 후 shipments 페이지 진입
2) 상단 “계산근거” 패널에서:
   - 기본공임 계산근거 표시
   - 보석/기타공임 계산근거에서:
     - 원가근거(COST_BASIS)
     - 규칙마진(RULE_MARKUP)
     - 마스터추가마진(MASTER_ADDON_MARGIN)
     - 경고(WARN)가 있으면 표시
3) 브라우저 폭 줄여도 “짤림” 없이 테이블이 가로 스크롤되는지 확인

---

## 5) 참고: 기존 파일 경로
- Evidence Panel: `web/src/components/shipments/ShipmentPricingEvidencePanel.tsx`
- Shipments: `web/src/app/(app)/shipments/page.tsx`
- Settings: `web/src/app/(app)/settings/page.tsx`
- Vendors API: `web/src/app/api/vendors/route.ts`
- Order upsert API: `web/src/app/api/order-upsert/route.ts`
- Master update API: `web/src/app/api/master-item/route.ts`
- Catalog: `web/src/app/(app)/catalog/page.tsx`, `web/src/app/(app)/2_catalog/page.tsx`

== 끝. 위 요구사항대로 PR 만들어서 코드 반영해라. ==
