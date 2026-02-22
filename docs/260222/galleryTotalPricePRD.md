# PRD: 카탈로그 갤러리 총금액 동기화 (DECOR 소재 제외 / DECOR 공임 포함) + 성능 최적화(12개/페이지)

## 0) 핵심 요약
* 갤러리 카드의 “총공임/총가격”이 디테일 패널과 완전히 일치하도록 만든다.
* 총가격 구성은 base 소재 + base 공임(흡수 포함) + decor 공임(흡수 포함).
* **DECOR 소재금액은 계산/표시/합산 모두 하지 않는다.**
* 성능을 위해 갤러리 페이지당 아이템 수를 12개로 제한하고, N+1 네트워크 호출을 배치 2회 수준으로 제한한다.

## 1) 배경 / 현재 문제
### 1-1. 갤러리에서 총가격이 디테일과 안 맞는 이유 (현 코드 기준)
**파일:** `web/src/app/(app)/catalog/page.tsx` (갤러리 렌더링 map 내부)

1. **중량/공제 계산 오류**
    * `item.weight`는 이미 "순중량 g (+총중량 g)(-공제 g)" 형태라 `parseFloat(item.weight)`가 순중량(net) 를 뽑는다.
    * 그런데 갤러리에서 `deduction_weight_default_g`를 또 적용해서 공제가 2번 반영되는 구조가 생김.
    * 그리고 `calculateMaterialPrice(material, weight, deduction)` 내부에서도 `(weight - deduction)`을 다시 하므로 소재금액이 틀어질 수 있음.
2. **갤러리 총공임이 디테일과 다름**
    * 갤러리는 `labor_total_sell` 또는 `labor_base/stone`만 사용(흡수공임/도금/DECOR 미반영).
    * 디테일은 `computeAbsorbImpactSummary` + `plating` + `etc` + `DECOR` 공임을 포함함.
3. **DECOR 공임(흡수 포함)이 갤러리에서 누락**
    * 디테일은 BOM 라인 중 `LINE_KIND:DECOR` 라인을 골라 구성품 마스터별 `computeMasterLaborTotalsWithAbsorb()`를 곱해 합산함.
    * 갤러리는 BOM 라인을 안 보므로 DECOR 공임이 빠져 총가격 불일치.

---

## 2) 목표(Goals)
### 2-1. 기능 목표
갤러리 카드의 “총공임/총가격”을 디테일 패널과 동일 결과로 계산한다.
계산식(SELL 기준)은 다음과 같아야 함:

**✅ 계산식(정의)**
* **baseMaterialSell**
    * `calculateMaterialPrice(base.material_code_default, base.weight_default_g, base.deduction_weight_default_g)`
* **baseLaborSellWithAbsorb**
    * `computeMasterLaborTotalsWithAbsorb(baseMasterRow, baseAbsorbItems).sellPerUnit`
* **decorLaborSellWithAbsorbTotal**
    * 활성 레시피의 BOM 라인 중 `LINE_KIND:DECOR` 라인만 대상으로
    * 각 라인에 대해:
        * `componentTotals = computeMasterLaborTotalsWithAbsorb(componentMasterRow, componentAbsorbItems)`
        * `decor += componentTotals.sellPerUnit * qty_per_unit`
* **totalLaborSell** = `baseLaborSellWithAbsorb` + `decorLaborSellWithAbsorbTotal`
* **totalSell** = `roundUpToThousand(baseMaterialSell + totalLaborSell)`

> ❗️**중요**: DECOR 소재금액(재질금액)은 합산하지 않는다. (component 재질/중량 기반 소재금액 계산 금지)

### 2-2. 성능 목표
* 갤러리 모드 페이지 사이즈: **12개**
* 페이지당 네트워크 호출:
    1. DECOR 라인 배치 조회 1회
    2. 흡수공임 배치 조회(제품 + DECOR 구성품 마스터) 1회
    * → **총 2회 목표**
* 기존 “페이지 진입 시 8개 프리패치”는 갤러리에서 줄이거나 끈다(리소스 절감).

---

## 3) 비목표(Non-goals)
* BOM 전체 flatten 롤업(ACCESSORY 포함 전체 합산) 구현
* DECOR 소재금액 합산
* 원가/마진 정책 변경(천원 올림 정책 유지)

---

## 4) 구현 설계(데이터 흐름)
### 4-1. 프론트(갤러리)에서 필요한 데이터
1. 현재 페이지 제품 마스터 IDs: `pageProductIds`
2. 각 제품의 DECOR BOM 라인(구성품 master_id + qty): `decorLinesByProductId`
3. 페이지 전체에서 참조되는 `master_ids` = `pageProductIds` ∪ `decorComponentMasterIds`
4. 위 `master_ids`의 흡수공임 아이템: `absorbItems` (배치)

### 4-2. 새로운 API 필요
기존 `/api/bom-recipes`, `/api/bom-lines`는 단건이라 12개면 N+1이 발생함.
→ **배치 DECOR 라인 전용 API를 추가한다.**

---

## 5) 태스크 분해 (코딩 에이전트용)

### Task 1. 갤러리 페이지 사이즈를 12로 변경
* **파일:** `web/src/app/(app)/catalog/page.tsx`
* **변경 전**
```typescript
const activePageSize = view === "gallery" ? 24 : 20;
```
* **변경 후**
```typescript
const activePageSize = view === "gallery" ? 12 : 20;
```
* **AC**
    * 갤러리 모드에서 한 페이지에 정확히 12개 카드만 표시
    * 페이지네이션(totalPages/rangeStart/rangeEnd) 정상 동작

### Task 2. 갤러리 중량/소재금액 계산 버그 수정(공제 2중 적용 제거)
* **파일:** `web/src/app/(app)/catalog/page.tsx` (갤러리 카드 map 내부)
* **현 문제 코드(요약)**
    * `const weight = parseFloat(item.weight); // net`
    * `calculateMaterialPrice(materialCode, weight, deduction) // 내부에서 또 -deduction`
* **수정 요구**
    * weight는 반드시 `row.weight_default_g`(gross) 기반으로 계산
    * netWeight 표시도 `gross - deduction`으로
* **수정 스펙**
```typescript
const grossWeight = Number(row?.weight_default_g);
const hasWeight = Number.isFinite(grossWeight);
const deduction = Number(row?.deduction_weight_default_g ?? 0) || 0;
const netWeight = hasWeight ? Math.max(grossWeight - deduction, 0) : null;

const baseMaterialSell = hasWeight
  ? calculateMaterialPrice(materialCode, grossWeight, deduction)
  : 0;
```
* **AC**
    * 디테일 패널의 소재금액 계산(=gross-deduction)과 갤러리 총가격의 “소재 파트”가 동일
    * 공제중량이 2번 반영되는 현상이 사라짐

### Task 3. 신규 API 추가: GET /api/bom-decor-lines
* **목적:** 여러 `product_master_id`에 대해 “기본 선택 레시피”의 DECOR 라인만 한번에 반환.
* **파일(신규):** `web/src/app/api/bom-decor-lines/route.ts`
* **Query:** `product_master_ids`: CSV (uuid 배열)
* **Response**
```typescript
type DecorLineLite = {
  product_master_id: string;
  bom_id: string;
  bom_line_id: string;
  component_master_id: string;
  component_master_model_name: string | null;
  qty_per_unit: number;
  note: string | null;
  line_no: number;
};

return { data: DecorLineLite[] }
```
* **레시피 선택 규칙(디테일과 동일하게)**
    * `cms_v_bom_recipe_worklist_v1`(= `CONTRACTS.views.bomRecipeWorklist`)에서 `product_master_id in (...)`
    * 각 `product_master_id`에 대해:
        * `variant_key`가 null/blank인 row 우선, 없으면 해당 product의 첫 row
        * (디테일과 싱크가 최우선이므로 `is_active` 필터는 적용하지 않음. 디테일도 기본 선택에 `is_active`를 고려하지 않음.)
* **라인 필터**
    * `cms_v_bom_recipe_lines_enriched_v1`(= `CONTRACTS.views.bomRecipeLinesEnriched`)에서:
        * `bom_id` in (선택된 `bom_id`들)
        * `is_void = false`
    * 서버에서 최종적으로 필터:
        * `note.trim().toUpperCase().startsWith("LINE_KIND:DECOR")`
        * `component_ref_type === "MASTER"` AND `component_master_id` 존재 (공임 계산은 마스터만 가능하므로 PART는 제외)
* **제한/가드**
    * `product_master_ids` 최대 60개(또는 100개) 제한. 초과 시 400.
* **헤더:** 다른 route와 동일하게 `dynamic="force-dynamic"`, `revalidate=0`, `Cache-Control: no-store`
* **AC**
    * 요청한 제품들에 대해 DECOR 라인만 반환
    * BOM/DECOR가 없는 제품은 라인이 0건(에러 아님)
    * PART 라인은 반환되지 않음

### Task 4. 갤러리: DECOR 라인 배치 조회(useQuery) 추가
* **파일:** `web/src/app/(app)/catalog/page.tsx`
* **추가 로직**
    * `pageProductIds = uniq(pageItems.map(i => i.id))`
    * `decorLinesQuery`:
        * `queryKey: ["catalog", "gallery", "decorLines", pageProductIdsSortedKey]`
        * `enabled: view==="gallery" && pageProductIds.length>0`
        * `fetch: /api/bom-decor-lines?product_master_ids=...`
        * `staleTime: 60_000`, `refetchOnWindowFocus: false`
    * `decorLinesByProductId = Map<productId, DecorLineLite[]>`
    * `decorComponentMasterIds = Set<component_master_id>`
* **AC**
    * 갤러리 한 페이지당 `/api/bom-decor-lines` 호출은 1회
    * 데이터는 product별로 정상 그룹핑됨

### Task 5. 갤러리: 흡수공임 배치 조회(제품 + DECOR 구성품) 추가
* **파일:** `web/src/app/(app)/catalog/page.tsx`
* **요구**
    * `pricingMasterIds = union(pageProductIds, decorComponentMasterIds)`
    * 흡수공임 batch query:
        * `/api/master-absorb-labor-items?master_ids=...`
        * `queryKey: ["catalog","gallery","absorbBatch", pricingMasterIdsSortedKey]`
        * `enabled` 조건: `view==="gallery" && decorLinesQuery.isSuccess && pricingMasterIds.length>0` (decorLinesQuery 성공 후에 한번만 실행되어 2번 호출되는 것 방지)
    * 결과를 `absorbByMasterId: Map<string, MasterAbsorbLaborItem[]>`로 변환
* **AC**
    * 갤러리 페이지당 흡수공임 호출은 1회
    * 제품/구성품 마스터 모두 흡수공임이 맵에 들어감(없으면 empty로 처리 가능)

### Task 6. 갤러리 카드의 “총공임/총가격” 계산을 디테일과 동일하게 교체
* **파일:** `web/src/app/(app)/catalog/page.tsx` (갤러리 카드 map 내부)
* **기존 제거 대상**
    * `laborSell = row.labor_total_sell ?? (...)`
    * `totalPrice = calculateMaterialPrice(... item.weight ...) + laborSell`
* **신규 계산식(필수)**
```typescript
// base
const baseTotals = computeMasterLaborTotalsWithAbsorb(
  row,
  absorbByMasterId.get(item.id) ?? []
);
const baseLaborSell = baseTotals.sellPerUnit;

// decor labor only (NO decor material)
const decorLines = decorLinesByProductId.get(item.id) ?? [];
const decorLaborSell = decorLines.reduce((sum, line) => {
  const componentId = String(line.component_master_id ?? "").trim();
  if (!componentId) return sum;
  const qty = Math.max(Number(line.qty_per_unit ?? 0), 0);
  if (!Number.isFinite(qty) || qty <= 0) return sum;

  const componentRow = masterRowsById[componentId] as Record<string, unknown> | undefined;
  if (!componentRow) return sum;

  const componentTotals = computeMasterLaborTotalsWithAbsorb(
    componentRow,
    absorbByMasterId.get(componentId) ?? []
  );
  return sum + componentTotals.sellPerUnit * qty;
}, 0);

const laborSellTotal = baseLaborSell + decorLaborSell;

const totalPrice = hasWeight
  ? roundUpToThousand(baseMaterialSell + laborSellTotal)
  : null;
```
* **표시**
    * “총공임”은 `laborSellTotal`로 표시(= base + decor)
    * “총가격”은 `totalPrice`
* **로딩 게이트(필수)**
    * `decorLinesQuery` 또는 `absorbBatchQuery`가 아직 성공하지 않았으면 총공임/총가격은 "-"(또는 skeleton)로 표시
    * → “부분값 → 완성값”으로 바뀌며 동기화가 흔들리는 느낌 방지
* **AC**
    * 동일 master를 디테일 drawer로 열었을 때:
        * 갤러리 총공임 == 디테일의 `detailLaborSellWithAccessory`
        * 갤러리 총가격 == 디테일의 `totalEstimatedSell`
    * DECOR 소재금액은 어떤 방식으로도 합산되지 않음(코드 리뷰 기준)

### Task 7. 갤러리 prefetch 정책 완화(리소스 절감)
이건 “동기화 계산” 자체와 별개로, 실제 서버 부하를 크게 줄이는 데 중요.
* **파일:** `web/src/app/(app)/catalog/page.tsx`
* **현재:** 페이지 변경 시 `pageItems.slice(0, 8)`을 `prefetchMasterDetailFastPath` 호출
* **변경:** 갤러리에서만 `prefetchCount=4` 또는 `0`으로 축소
* **의도:** 갤러리는 이미 DECOR/흡수 배치를 호출하므로 “디테일 프리패치(Flatten/Recipes/Lines)” 중복을 줄임
* **예시**
```typescript
const prefetchCount = view === "gallery" ? 4 : 8;
const ids = pageItems.slice(0, prefetchCount) ...
```
* **AC**
    * 갤러리 페이지 넘길 때 BOM 관련 호출 폭이 줄어듦(네트워크 탭 확인)
    * 디테일 drawer 오픈 UX는 유지(hover/click prefetch는 남아있음)

### Task 8. QA 체크리스트(수동 검증 시나리오)
PR description에 아래 체크리스트 포함:
1. **DECOR 없는 제품**
    * 갤러리 총가격 == 디테일 총가격
    * 호출: decor-lines는 오지만 빈 배열, absorb batch는 제품만 포함
2. **DECOR 있는 제품(구성품 1~n개)**
    * 갤러리 총공임 == 디테일 총공임(흡수 포함 + decor 포함)
    * 갤러리 총가격 == 디테일 총가격
3. **구성품에 흡수공임(ETC/PLATING/STONE_LABOR 등) 있는 케이스**
    * decor 공임에 그 흡수공임이 반영되는지 확인(디테일과 비교)
4. **weight_default_g 누락/NaN**
    * 총중량/총가격 “-” 표시, 에러 없이 렌더
5. **성능**
    * 갤러리 한 페이지 이동 시 네트워크 호출이 대략 2회 수준인지 확인 (`/api/bom-decor-lines`, `/api/master-absorb-labor-items?master_ids=...`)

---

## 6) 코딩 에이전트에게 보낼 “명령문” (복붙용)

[PR 목표] Catalog gallery total sync 구현.

갤러리 카드의 총공임/총가격을 디테일 패널과 100% 동일하게 계산한다.
총가격 = base 소재금액 + base 총공임(흡수 포함) + DECOR 총공임(흡수 포함) 이며 DECOR 소재금액은 절대 포함하지 않는다.

성능을 위해 갤러리 페이지 사이즈는 12개로 고정하고, DECOR 라인 + 흡수공임은 배치 호출로 처리한다.

[필수 변경]
1. `web/src/app/(app)/catalog/page.tsx`에서 `activePageSize`를 `gallery=12`로 변경
2. 갤러리 카드의 중량/소재 계산 버그 수정: `item.weight` `parseFloat` 사용 금지, 반드시 `row.weight_default_g` + `row.deduction_weight_default_g` 기반으로 계산
3. 신규 API `GET /api/bom-decor-lines` 추가 (`web/src/app/api/bom-decor-lines/route.ts`)
    - 입력: `product_master_ids=csv`
    - 각 product별 기본 레시피(`variant_key` empty 우선, 없으면 첫번째) 선택
    - `cms_v_bom_recipe_lines_enriched_v1`에서 `is_void=false` 라인 중 `LINE_KIND:DECOR` + `component_ref_type=MASTER`만 반환
4. 갤러리에서 페이지별로
    - `/api/bom-decor-lines` 1회 호출
    - 제품+구성품 union `master_ids`로 `/api/master-absorb-labor-items?master_ids=...` 1회 호출
5. 갤러리 총공임/총가격 계산은 `computeMasterLaborTotalsWithAbsorb()`를 base/decors 모두에 사용하여 디테일과 동일 결과를 보장
6. 로딩 중엔 총공임/총가격을 `-`로 표시(부분값 노출 금지)
7. (권장) 갤러리 페이지 전환 시 `prefetchMasterDetailFastPath` 호출 개수 8→4(또는 0)로 축소

[DoD]
- DECOR 없는 제품/DECOR 있는 제품 모두에서 갤러리 총가격 == 디테일의 `totalEstimatedSell`
- 갤러리 총공임 == 디테일의 `detailLaborSellWithAccessory`
- 갤러리 `pageSize=12`
- DECOR 소재금액이 합산되는 로직이 코드에 존재하지 않음