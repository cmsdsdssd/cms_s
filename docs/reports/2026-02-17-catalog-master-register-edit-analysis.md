# Catalog 마스터 등록/수정 동작 분석 보고서

- 작성일: 2026-02-17
- 범위: `web/src/app/(app)/catalog/page.tsx`, `web/src/app/api/master-item/route.ts`, `web/src/app/api/master-absorb-labor-items/route.ts`, `web/src/app/api/master-item-cn-cost/route.ts`, `supabase/migrations/20260126084015_cms_0002_tables.sql`, `supabase/migrations/20260216090000_cms_0603_margin_engine_backend_sql_patch.sql`

## 1) 결론 요약

1. `setting_addon_margin_krw_per_piece` / `stone_addon_margin_krw_per_piece`는 현재 엔진 기준에서 **흡수공임과 중복이 아님**.
2. 근거: 엔진에서 `v_addon_margin_total`과 `v_absorb_total`을 **별도로 계산 후 합산**함.
   - `supabase/migrations/20260216090000_cms_0603_margin_engine_backend_sql_patch.sql:855`
   - `supabase/migrations/20260216090000_cms_0603_margin_engine_backend_sql_patch.sql:861`
   - `supabase/migrations/20260216090000_cms_0603_margin_engine_backend_sql_patch.sql:871`
3. 따라서 이번 반영에서는 부가마진 데이터 경로를 제거하지 않고, UI 혼잡도 개선 요구에 맞춰 **흡수공임 섹션 기본 접힘(default collapsed)** 으로 변경함.

## 2) 새 마스터 등록 vs 마스터 수정: UI 동작 플로우

### A. 새 마스터 등록

1. 상단 `새 상품 등록` 버튼 클릭 → `handleOpenNew()` 실행.
   - `web/src/app/(app)/catalog/page.tsx:1211`
2. `resetForm()`으로 폼 상태 초기화.
   - `web/src/app/(app)/catalog/page.tsx:1153`
3. 드로어 오픈 (`setRegisterOpen(true)`).
   - `web/src/app/(app)/catalog/page.tsx:1214`
4. 저장 버튼 클릭 시 `handleSave()` 실행.
   - `web/src/app/(app)/catalog/page.tsx:1333`

### B. 마스터 수정

1. 선택된 아이템 기준 `handleOpenEdit()` 실행.
   - `web/src/app/(app)/catalog/page.tsx:1217`
2. 기존 row(`masterRowsById[selectedItemId]`)를 폼 state로 매핑.
   - `web/src/app/(app)/catalog/page.tsx:1220`
3. 필요 시 흡수공임 목록 조회 (`loadAbsorbLaborItems(selectedItem.id)`).
   - `web/src/app/(app)/catalog/page.tsx:1299`
4. 동일하게 `handleSave()`로 저장.

## 3) 저장 API/DB 경로(정확 매핑)

### A. 마스터 기본 정보 저장

1. 프론트 `handleSave()` payload 생성
   - `web/src/app/(app)/catalog/page.tsx:1348`
2. `POST /api/master-item` 호출
   - `web/src/app/(app)/catalog/page.tsx:1387`
3. 서버 라우트에서 RPC `cms_fn_upsert_master_item_v1` 호출
   - `web/src/app/api/master-item/route.ts:76`
4. RPC 이후 `cms_master_item` 직접 update로 일부 필드 보강
   - `web/src/app/api/master-item/route.ts:129`

### B. 흡수공임 저장

1. 프론트 `handleSaveAbsorbLaborItem()` 호출
   - `web/src/app/(app)/catalog/page.tsx:1462`
2. `POST /api/master-absorb-labor-items`
   - `web/src/app/(app)/catalog/page.tsx:1484`
3. 서버에서 `cms_master_absorb_labor_item_v1` upsert
   - `web/src/app/api/master-absorb-labor-items/route.ts:109`

### C. 중국 원가 보조 저장

1. 마스터 저장 성공 후 보조 API 호출
   - `web/src/app/(app)/catalog/page.tsx:1408`
2. `POST /api/master-item-cn-cost`
3. `cms_master_item`의 `cn_labor_basic_cny_per_g`, `cn_labor_extra_items` update
   - `web/src/app/api/master-item-cn-cost/route.ts:56`

## 4) UI state -> API field -> DB 컬럼 매핑

### A. `cms_master_item` 핵심

- `modelName` -> `model_name` -> `cms_master_item.model_name`
- `masterKind` -> `master_kind` -> `cms_master_item.master_kind`
- `categoryCode` -> `category_code` -> `cms_master_item.category_code`
- `materialCode` -> `material_code_default` -> `cms_master_item.material_code_default`
- `weightDefault` -> `weight_default_g` -> `cms_master_item.weight_default_g`
- `deductionWeight` -> `deduction_weight_default_g` -> `cms_master_item.deduction_weight_default_g`
- `centerQty/sub1Qty/sub2Qty` -> `center_qty_default/sub1_qty_default/sub2_qty_default`
- `laborBaseSell/Center/Sub1/Sub2` -> `labor_base_sell/labor_center_sell/labor_sub1_sell/labor_sub2_sell`
- `laborBaseCost/Center/Sub1/Sub2` -> `labor_base_cost/labor_center_cost/labor_sub1_cost/labor_sub2_cost`
- `platingSell/platingCost` -> `plating_price_sell_default/plating_price_cost_default`
- `laborProfileMode/laborBandCode` -> `labor_profile_mode/labor_band_code`
- `settingAddonMarginKrwPerPiece` -> `setting_addon_margin_krw_per_piece`
- `stoneAddonMarginKrwPerPiece` -> `stone_addon_margin_krw_per_piece`
- `vendorId` -> `vendor_party_id`
- `note` -> `note`
- `imagePath` -> `image_path`

참고 코드:
- payload 생성: `web/src/app/(app)/catalog/page.tsx:1348`
- API update payload: `web/src/app/api/master-item/route.ts:103`

### B. `cms_master_absorb_labor_item_v1` 핵심

- `editingAbsorbItemId` -> `absorb_item_id` -> `cms_master_absorb_labor_item_v1.absorb_item_id`
- `masterId` -> `master_id`
- `absorbBucket` -> `bucket`
- `absorbReason` -> `reason`
- `absorbAmount` -> `amount_krw`
- `absorbIsPerPiece` -> `is_per_piece`
- `absorbVendorId` -> `vendor_party_id`
- `absorbPriority` -> `priority`
- `absorbIsActive` -> `is_active`
- `absorbNote` -> `note`

참고 코드:
- API payload: `web/src/app/(app)/catalog/page.tsx:1487`
- upsert: `web/src/app/api/master-absorb-labor-items/route.ts:109`

## 5) 자동 합산 로직(프론트/엔진)

### A. 드로어 내 즉시 합산(프론트)

- 합계 판매공임
  - `laborBaseSell + laborCenterSell*centerQty + laborSub1Sell*sub1Qty + laborSub2Sell*sub2Qty`
  - `web/src/app/(app)/catalog/page.tsx:437`
- 합계 원가공임
  - `laborBaseCost + laborCenterCost*centerQty + laborSub1Cost*sub1Qty + laborSub2Cost*sub2Qty`
  - `web/src/app/(app)/catalog/page.tsx:439`

### B. 엔진 합산(백엔드)

`v_extra_margin_total`에 아래를 합산:

- setting/package/buy/factory stone margin
- addon margin (`setting_addon_margin_krw_per_piece`, `stone_addon_margin_krw_per_piece` 기반)
- absorb margin (`cms_master_absorb_labor_item_v1` 기반)

근거:
- addon 계산: `supabase/migrations/20260216090000_cms_0603_margin_engine_backend_sql_patch.sql:855`
- absorb 계산: `supabase/migrations/20260216090000_cms_0603_margin_engine_backend_sql_patch.sql:861`
- 최종 합산: `supabase/migrations/20260216090000_cms_0603_margin_engine_backend_sql_patch.sql:871`

=> 현재 설계상 addon과 absorb는 별도 입력원이며, 둘 다 있으면 둘 다 반영됨.

## 6) 이번 UI 변경사항

### 반영

1. 흡수공임 섹션 기본 접힘으로 변경.
   - 사용자가 요약 헤더를 클릭해야 펼쳐짐.
   - 파일: `web/src/app/(app)/catalog/page.tsx`

### 미반영(의도)

1. 세팅/원석 부가마진 필드 제거는 미반영.
2. 사유: 현행 엔진에서 흡수공임과 동일 개념으로 merge되어 있지 않고 별도 합산되어, 즉시 제거 시 가격 결과 변경 위험이 큼.

## 7) 권고안(안전 순서)

1. 1차(현재): UI는 흡수공임 기본 접힘, addon 데이터 경로 유지.
2. 2차(옵션): addon UI를 숨기되 DB 값은 유지(기존 품목 가격 보전).
3. 3차(옵션): addon -> absorb 데이터 이관 후 엔진에서 addon 항목 제거.
