# 총공임 SoT 문서 (카탈로그 `catalog/page.tsx` 기준)

> **결론(SoT 선언)**  
> 현재 프로젝트에서 **“총공임(판매)”의 SoT는 `web/src/app/(app)/catalog/page.tsx`의 마스터 상세(=카탈로그 상세) 계산 로직**입니다.  
> 이 로직은 **(1) 마스터 기본공임/알공임/도금 값 + (2) 마스터 흡수공임 + (3) BOM 장식(DECOR) 라인의 “컴포넌트 마스터 총공임(흡수 포함)” 합산**으로 구성됩니다.  
> *(사용자가 언급한 “카탈로그 페이지(2_아님)”은 `/catalog`이며 `/2_catalog`가 아닙니다.)*

---

## 0) 이 문서의 목적

코딩 에이전트(또는 신규 개발자)가 **“총공임(흡수공임 포함)”이 어디서 오고, 무엇을 포함/제외하며, 장식 공임(DECOR)이 어떻게 합산되는지**를 **동일하게 재현**할 수 있도록 “SOT 계산 규칙”을 한 문서로 고정합니다.

---

## 1) 용어 / 구성요소 정의

### 1.1 “총공임(판매)”이 포함하는 것

카탈로그 마스터 상세의 `총공임(판매)`는 아래를 **포함**합니다.

1) **마스터 기본 공임(판매)**
- `labor_base_sell`

2) **마스터 알 공임(판매)**
- 중심/보조1/보조2 공임: `labor_center_sell`, `labor_sub1_sell`, `labor_sub2_sell`
- 각각 `center_qty_default`, `sub1_qty_default`, `sub2_qty_default`로 곱해 합산

3) **마스터 도금 공임(판매)**
- `plating_price_sell_default`

4) **마스터 흡수공임(판매)**
- `cms_master_absorb_labor_item_v1`의 활성(`is_active=true`) 아이템들 중 **자동 제외 규칙(아래 3장) 적용 후 남는 것**

5) **장식(DECOR) 공임(판매)**
- BOM 라인 중 **DECOR 라인**에 대해
- 각 라인의 `component_master_id`가 가리키는 **컴포넌트 마스터의 “총공임(흡수 포함)”**을 계산하고
- 그것을 `qty_per_unit`만큼 곱해 합산

즉, **(상품 마스터 자체 공임 + 장식 컴포넌트 공임 합산)** 구조입니다.

---

### 1.2 “총공임(원가)”(UI에 노출되는 비용 관점)

`catalog/page.tsx` 상세 화면에서 “총공임(원가)”는 대략:

- 마스터의 `labor_*_cost`(기본/중심/보조) + `plating_price_cost_default`
- + 장식(DECOR) 컴포넌트들의 원가 합(컴포넌트 마스터의 원가 * qty)

흡수공임의 **원가 처리**는 현재 UI 기준으로는 “판매(+)”에 비해 단순화되어 있습니다(흡수공임 원가는 0으로 취급되거나, 일부 비교표에서만 간접 반영되는 형태).  
이 문서의 핵심 SoT는 **판매 기준 총공임**이며, 원가 계산은 6장에 “현행 구현”으로 정리합니다.

---

## 2) 데이터가 저장되는 곳 (DB / API / 뷰)

### 2.1 마스터 기본 공임/알공임/도금 (마스터 테이블)

- 테이블(혹은 뷰 기반): **`cms_master_item`**
- 주요 필드:
  - 기본공임: `labor_base_sell`, `labor_base_cost`
  - 중심공임: `labor_center_sell`, `labor_center_cost`, `center_qty_default`
  - 보조1: `labor_sub1_sell`, `labor_sub1_cost`, `sub1_qty_default`
  - 보조2: `labor_sub2_sell`, `labor_sub2_cost`, `sub2_qty_default`
  - 도금: `plating_price_sell_default`, `plating_price_cost_default`
  - 기타: `vendor_party_id`, `master_kind`, `material_code_default`, `weight_default_g`, `deduction_weight_default_g` 등

> **참고 코드(카탈로그 상세 구성)**  
> `selectedDetail` 생성 시 `laborTotalSell`/`laborTotalCost`는 **도금을 제외한** 기본/알 공임만 합산합니다.  
> 도금은 별도 `platingSell / platingCost`로 취급합니다.  
> (`web/src/app/(app)/catalog/page.tsx`)

---

### 2.2 흡수공임 (마스터 흡수공임 테이블)

- 테이블: **`cms_master_absorb_labor_item_v1`**
- API(카탈로그에서 직접 사용):  
  - `GET /api/master-absorb-labor-items?master_id=...`  
  - `GET /api/master-absorb-labor-items?master_ids=...,...` (배치)
  - `POST /api/master-absorb-labor-items` (업서트)

- 주요 필드:
  - `absorb_item_id` (UUID, PK alias)
  - `master_id`
  - `bucket`: `"BASE_LABOR" | "STONE_LABOR" | "PLATING" | "ETC"`
  - `reason`: 표시 라벨/사유
  - `amount_krw`: 기본 금액
  - `note`: 역할(예: 원석 역할) 또는 BOM 동기화 메타
  - `is_active`
  - `labor_class`: `"GENERAL" | "MATERIAL"` (ETC에서 소재성 항목 구분)
  - `material_qty_per_unit`, `material_cost_krw` (labor_class=MATERIAL 일 때 의미)

> **중요: absorb_id ↔ absorb_item_id alias**  
> DB에서는 `absorb_id`가 원래 PK였고, 이후 API 호환을 위해 `absorb_item_id` 등 alias 칼럼을 추가하고 트리거로 동기화합니다.  
> (`supabase/migrations/20260216090000_cms_0603_margin_engine_backend_sql_patch.sql`)

---

### 2.3 장식(DECOR) 라인 (BOM)

카탈로그(갤러리 카드)에서는 DECOR 라인을 아래 API로 가져옵니다.

- `GET /api/bom-decor-lines?product_master_ids=...,...`
  - 기본 레시피(variant_key="")를 우선 선택하고,
  - `note`가 `"LINE_KIND:DECOR..."`인 라인만 반환,
  - `component_ref_type="MASTER"`인 라인만 포함

(구현: `web/src/app/api/bom-decor-lines/route.ts`)

---

## 3) 흡수공임 포함/제외 규칙 (SOT의 핵심)

카탈로그 상세에서 흡수공임을 합산할 때, **중복 집계**를 방지하기 위해 특정 흡수공임은 자동으로 제외합니다.

### 3.1 제외 대상 (강제 제외)

카탈로그 SOT 계산에서 아래는 제외합니다.

- `reason`이 다음 중 하나인 경우(대소문자/공백 정규화 후 비교):
  - `"BOM_AUTO_TOTAL"` (LEGACY)
  - `"ACCESSORY_LABOR"` (부속공임 자동 합산)

또한 bucket이 `ETC`일 때 아래는 제외합니다.

- `note`가 `"BOM_DECOR_LINE:"`로 시작
- `reason`이 `"장식:"`으로 시작
- `note`가 `"BOM_MATERIAL_LINE:"`로 시작
- `reason`이 `"기타-소재:"`로 시작
- `reason`에 `"부속공임"` 문자열 포함

> 구현 위치: `shouldExcludeEtcAbsorbItem()`  
> `web/src/app/(app)/catalog/page.tsx`

---

### 3.2 왜 제외하나?

- BOM의 DECOR 라인은 **별도로 “장식 공임” 합산 루프**에서 계산하여 이미 총공임에 반영됩니다.
- 그런데 동시에 DECOR 라인 정보가 `cms_master_absorb_labor_item_v1`에도 자동 동기화되어 존재할 수 있으므로(4장 참고),
  **흡수공임 합산에서도 제외하지 않으면 두 번 더해지는 문제가 발생**합니다.

---

## 4) BOM ↔ 흡수공임 자동 동기화 (장식 공임이 “잘 가져와지는” 이유)

카탈로그는 BOM 라인을 단순 조회만 하는 게 아니라, 일부 라인을 **흡수공임 테이블에도 “관리용 레코드”로 동기화**합니다.

핵심 구현: `syncBomAutoAbsorbLabor()`  
(`web/src/app/(app)/catalog/page.tsx`)

### 4.1 ACCESSORY 라인 → 흡수공임(BASE_LABOR, ACCESSORY_LABOR)

- BOM 라인 중 `LINE_KIND:DECOR`가 아닌 것은 기본적으로 ACCESSORY로 간주합니다.
- ACCESSORY 라인의 공임 합을 계산해:
  - bucket = `BASE_LABOR`
  - reason = `ACCESSORY_LABOR`
  - amount_krw = accessory lines labor total
  - is_active = accessoryAmount > 0
  로 업서트합니다.

> 단, 이 값은 **SOT 총공임 계산에는 제외**됩니다(3장).

---

### 4.2 DECOR 라인 → 흡수공임(ETC, "장식:...") + (ETC/MATERIAL, "기타-소재:...")

DECOR 라인에 대해 두 종류의 absorb item이 만들어질 수 있습니다.

1) **장식 공임 관리용**
- bucket = `ETC`
- reason = `"장식:" + 컴포넌트명`
- amount_krw = (컴포넌트 마스터의 “기본+알” 공임 * qty_per_unit)로 계산된 값
- note = `"BOM_DECOR_LINE:{bomLineId};QTY_PER_UNIT:{qty}"`

2) **장식 소재(재질) 관리용**
- bucket = `ETC`
- labor_class = `MATERIAL`
- reason = `"기타-소재:" + 컴포넌트명`
- amount_krw = (컴포넌트 마스터 재질/중량 기반 소재가격 **per unit**)
- material_qty_per_unit = qty_per_unit
- material_cost_krw = amount_krw (현행은 동일 값)
- note = `"BOM_MATERIAL_LINE:{bomLineId};QTY_PER_UNIT:{qty}"`

> **중요:** 위 “BOM_*” note/ reason prefix를 가진 absorb item들은  
> **SOT 총공임 계산에서는 제외**됩니다(3장).  
> 즉, “동기화는 존재하지만 가격 합산은 DECOR 라인 루프가 담당”하는 구조입니다.

---

## 5) 총공임(판매) 계산 알고리즘 (정확한 재현용)

아래는 **카탈로그 상세 기준**으로 “총공임(판매)”을 계산하는 표준 절차입니다.

---

### 5.1 입력 (필수)

- `masterRow`: `cms_master_item` 1행 (상품 또는 컴포넌트 마스터)
- `absorbItems`: `cms_master_absorb_labor_item_v1`의 해당 master_id 아이템들 (API/DB 조회)
- `decorLines`: (상품 마스터일 때만) DECOR 라인 리스트
  - 각 라인: `component_master_id`, `qty_per_unit`, `note`
- `componentMasterRowsById`: DECOR 라인의 컴포넌트 마스터 row map
- `componentAbsorbItemsByMasterId`: 컴포넌트별 absorb item map

---

### 5.2 흡수공임 요약치 계산 (bucket별)

카탈로그 구현은 `computeAbsorbImpactSummary()`로 요약치를 계산합니다.

- bucket이 `STONE_LABOR`일 경우:
  - note에서 `STONE_ROLE:` prefix를 파싱하여 역할을 결정 (`CENTER|SUB1|SUB2`, 없으면 CENTER)
  - 적용 수량은 `Math.max(stoneQty, 1)`를 사용 (수량 0이어도 최소 1회 적용)

- bucket이 `ETC`이고 labor_class=`MATERIAL`인 경우:
  - `material_qty_per_unit`만큼 곱해 `etc`에 누적

> 구현:  
> - `parseAbsorbStoneRole()`  
> - `isMaterialAbsorbItem()`  
> - `computeAbsorbImpactSummary()`  
> (`web/src/app/(app)/catalog/page.tsx`)

---

### 5.3 상품 마스터 자체 공임(판매) = 기본+알+도금 + 흡수공임(판매)

카탈로그 상세(`detailLaborSell`) 기준 식은 아래와 같습니다.

```ts
// 1) 마스터 기본값
baseSell = labor_base_sell
centerSell = labor_center_sell
sub1Sell = labor_sub1_sell
sub2Sell = labor_sub2_sell
platingSell = plating_price_sell_default

centerQty = center_qty_default
sub1Qty = sub1_qty_default
sub2Qty = sub2_qty_default

// 2) 흡수공임 요약 (exclusion 필터 통과한 것만)
absorb = computeAbsorbImpactSummary(filteredAbsorbItems, centerQty, sub1Qty, sub2Qty)

// 3) "단가"에 흡수공임(단가 보정) 반영
baseSellWithAbsorb   = baseSell   + absorb.baseLaborUnit
centerSellWithAbsorb = centerSell + absorb.stoneCenterUnit
sub1SellWithAbsorb   = sub1Sell   + absorb.stoneSub1Unit
sub2SellWithAbsorb   = sub2Sell   + absorb.stoneSub2Unit
platingSellWithAbsorb= platingSell+ absorb.platingUnit

// 4) 합산
masterLaborSellExclDecor =
  baseSellWithAbsorb
  + centerSellWithAbsorb * centerQty
  + sub1SellWithAbsorb * sub1Qty
  + sub2SellWithAbsorb * sub2Qty
  + platingSellWithAbsorb
  + absorb.etc
```

---

### 5.4 장식(DECOR) 공임(판매) = Σ (컴포넌트 마스터 총공임(흡수 포함) * qty_per_unit)

```ts
decorLaborSellTotal =
  sum_over_decor_lines(
    computeMasterLaborSellExclDecor(componentMaster, componentAbsorbItems) * qty_per_unit
  )
```

- `computeMasterLaborSellExclDecor()`는 **5.3의 절차를 컴포넌트에 동일 적용**한 값입니다.
- 이 단계 때문에 “장식 공임들도 해당 마스터 흡수공임 포함 총공임을 잘 가져오는” 상태가 됩니다.

---

### 5.5 최종 총공임(판매)

```ts
totalLaborSell = masterLaborSellExclDecor + decorLaborSellTotal
```

---

## 6) 총공임(원가) 계산 (현행 UI 기준)

카탈로그 상세에서 `detailLaborCost`는 아래를 사용합니다.

- 마스터 원가:
  - `labor_base_cost`
  - `labor_center_cost * center_qty_default`
  - `labor_sub1_cost * sub1_qty_default`
  - `labor_sub2_cost * sub2_qty_default`
  - `plating_price_cost_default`
- + DECOR 라인 원가:
  - `computeMasterLaborTotalsWithAbsorb(component).costPerUnit * qty_per_unit`

> 구현: `detailLaborCost` 계산부  
> (`web/src/app/(app)/catalog/page.tsx`)

⚠️ **주의(정확한 재현을 위한 메모)**  
흡수공임 중 labor_class=`MATERIAL` 같은 “소재성” 항목은  
SOT 총공임(판매)에는 포함되지만, 원가 측면은 UI에서 단순화되어(0 취급) 보일 수 있습니다.  
즉, “원가 SoT”는 별도 정의가 필요할 수 있으나, 사용자가 요구한 SoT는 “총공임(판매)”입니다.

---

## 7) 반올림 규칙 (100원 단위 올림)

카탈로그 UI는 공임 표시/계산에서 **100원 단위 올림**을 사용합니다.

- `roundUpToUnit(value, 100)` → `Math.ceil(value/100)*100`
- 래퍼: `roundUpDisplayHundred(value)`
  - value > 0이면 100원 단위 올림
  - value <= 0이면 `Math.round(value)`

> 구현:  
> - `web/src/lib/number.ts` (`roundUpToUnit`)  
> - `web/src/app/(app)/catalog/page.tsx` (`roundUpDisplayHundred`, `formatLaborDisplayKrw`)

---

## 8) “2_catalog / catalog2”와의 관계 (혼동 방지)

프로젝트 내에 다음 경로가 공존합니다.

- `web/src/app/(app)/catalog/page.tsx` ✅ **SOT**
- `web/src/app/(app)/2_catalog/...` ❌ SOT 아님 (레거시/실험성)
- `web/src/app/(app)/catalog2/...` ❓ (별도 화면. 이 문서의 SOT 범위 밖)

따라서 **총공임 로직을 가져오거나 수정할 때는 반드시 `/catalog/page.tsx`를 기준으로** 합니다.

---

## 9) 코딩 에이전트를 위한 체크리스트 (실수 방지)

### 9.1 “총공임(판매)”을 다른 화면/기능에 넣고 싶을 때

- [ ] master row + absorb items + (product라면) decor lines를 모두 확보했는가?
- [ ] absorb items에 `shouldExcludeEtcAbsorbItem()` 규칙을 적용했는가?
- [ ] stone absorb는 `STONE_ROLE:` note 기반으로 CENTER/SUB1/SUB2를 나눴는가?
- [ ] stone absorb 적용 수량은 `Math.max(qty, 1)`로 처리했는가? (카탈로그와 동일)
- [ ] decor labor는 **컴포넌트 마스터의 “흡수 포함 총공임(상품 자체 공임)”**을 계산한 뒤 qty_per_unit을 곱해 합산했는가?
- [ ] 최종 표시/저장은 100원 단위 올림 규칙을 적용했는가?

---

### 9.2 “왜 total labor 필드에 흡수공임이 빠지지?”가 생기는 대표 원인

- 흡수공임 테이블을 조회하지 않음 (master만 보고 끝)
- 흡수공임을 조회했으나 `is_active=false` 아이템을 포함/제외를 반대로 처리
- BOM에서 DECOR 라인을 장식 합산에 넣지 않음 (note가 `LINE_KIND:DECOR`인지 확인)
- BOM에서 DECOR 라인을 absorb item으로도 넣어버려 **중복 합산** 발생(→ exclusion 규칙 필요)
- 100원 올림을 “중간합”에 적용해버려 합산 결과가 카탈로그와 다르게 튐  
  → 카탈로그는 주로 “표시 단계”에서 올림

---

## 10) 검증용 SQL / API 샘플

### 10.1 마스터 기본 공임 조회

```sql
select
  master_id, model_name, vendor_party_id,
  labor_base_sell, labor_center_sell, labor_sub1_sell, labor_sub2_sell,
  center_qty_default, sub1_qty_default, sub2_qty_default,
  plating_price_sell_default,
  labor_base_cost, labor_center_cost, labor_sub1_cost, labor_sub2_cost,
  plating_price_cost_default
from cms_master_item
where master_id = :master_id;
```

### 10.2 흡수공임 조회

```sql
select
  absorb_item_id, bucket, reason, amount_krw, is_active,
  labor_class, material_qty_per_unit, material_cost_krw,
  vendor_party_id, priority, note
from cms_master_absorb_labor_item_v1
where master_id = :master_id
order by priority asc, absorb_id asc;
```

### 10.3 상품의 DECOR 라인 조회(서버/API 로직과 동일하게 하려면)

- 추천: `GET /api/bom-decor-lines?product_master_ids=<id1,id2,...>`

---

## 11) (권장) 공통 라이브러리로 분리 제안

현재 SoT가 `catalog/page.tsx`에 박혀 있어, 다른 화면(출고/매칭/정산 등)에서 **동일 계산을 복붙**하면 쉽게 갈라집니다.

권장 방향:

- `web/src/lib/master-labor-sot.ts` 같은 파일로
  - `shouldExcludeEtcAbsorbItem`
  - `computeAbsorbImpactSummary`
  - `computeMasterLaborSellExclDecor`
  - `computeProductTotalLaborSellInclDecor`
  를 **순수 함수**로 분리
- 모든 화면은 해당 함수를 import하여 사용

> 문서의 SoT가 “코드 위치”에 종속되지 않도록, 장기적으로는 공통 모듈화가 최선입니다.

---

## 12) 요약(딱 한 줄)

**카탈로그 `/catalog` 마스터 상세에서 보이는 `총공임(판매)` = (마스터 자체 공임 + 흡수공임) + Σ(DECOR 라인 컴포넌트 마스터 자체 공임(흡수 포함) * qty)** 가 프로젝트의 SoT입니다.
