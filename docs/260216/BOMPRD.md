# [CODING AGENT PROMPT] BOM/BUNDLE 완전 정상화 (Frontend 수정 지시서 + db push only 연동)

### 0) 컨텍스트 / 목표
현재 프로젝트에서 BOM(레시피/구성품)과 BUNDLE(상위 구성품 가격 = 하위 leaf 합산)이 “프리뷰(UI) → 출고확정 → 재고 OUT → AR(미수)” 흐름에서 정확히 작동해야 함.
특히:
* 하위 아이템 가격/시세 변동이 상위 BUNDLE 유효가격 프리뷰에 즉시 반영되어야 함
* BUNDLE인데 BOM이 없거나 사이클이면 출고 확정이 UI에서 차단돼야 함
* 출고 확정 시 재고 OUT 라인은 BUNDLE header가 아닌 leaf 구성품만 OUT되어야 함
* 백엔드는 db push only (즉, SQL migration으로만 수정 / 기존 구조 충돌 최소화) 전제.

---

### 1) 이미 준비된 DB Hotfix (db push only)
#### 1-1 적용할 Migration
`supabase/migrations/20260215153000_cms_0601_bom_bundle_hotfix.sql` (이미 제공된 파일)
이 migration은:
* variant_key 정규화/매칭 보강 (프론트 `|` vs 백엔드 `" / "` 불일치 흡수)
* BUNDLE rollup breakdown에 UI-friendly key(`component_*`) 추가 (레거시 키 유지)
* `cms_fn_emit_inventory_issue_from_shipment_confirmed_v2`의 컴파일 에러 + BUNDLE leaf-only OUT 보장

⚠️ 새 DB(초기부터 db push)라면 0600 마이그레이션 자체 문법 에러가 있으면 0600에서 멈추므로 **0600의 4줄 최소 패치가 선행돼야 함.** (이건 별도 안내된 대로)

---

### 2) 프론트엔드 P0 버그 원인 요약 (반드시 수정)
* **P0-A) /api/master-effective-price가 RPC 결과(returns table)를 배열 그대로 반환**
    * Supabase RPC가 returns table이면 data는 배열인데, 프론트는 객체로 가정하고 `pricing_method`, `ok`를 읽어서 항상 undefined가 되는 케이스 발생
    * 결과: Shipments에서 “BOM 오류면 확정 차단” 로직이 실제로는 발동 안 함
* **P0-B) BOM Flatten 디버그 UI가 flatten 함수 결과 스키마와 불일치**
    * DB `cms_fn_bom_flatten_active_v1`는 `leaf_ref_type`, `leaf_master_id`, `leaf_part_id`, `qty_per_product_unit`, `depth`, `path(uuid[])`만 반환
    * 그런데 UI는 `component_master_model_name` 등 “enriched” 키를 기대 → 표가 사실상 빈 값
* **P0-C) Shipments 확정 차단 로직이 “ok=false만” 보고, 로딩/에러 시엔 뚫릴 수 있음**
    * BUNDLE인데 프리뷰 fetch 에러/로딩 중에도 확정 버튼이 눌리면 위험
    * “BUNDLE이면 프리뷰 검증 성공(ok=true) 전까지 확정 불가”로 강화 필요

---

### 3) 프론트엔드 수정 작업 (구현 지시서)

#### ✅ P0-1) API: /api/master-effective-price 응답을 “단일 객체”로 normalize
**파일:** `web/src/app/api/master-effective-price/route.ts`

**해야 할 일:**
1.  data가 배열이면 첫 row만 반환하도록 수정
2.  응답 헤더 `Cache-Control: no-store` 유지
3.  에러 응답은 `{ error: string }` 형태 유지

**패치 예시:**
```typescript
// ...
const { data, error } = await supabase.rpc("cms_fn_get_master_effective_price_v1", {
  p_master_id: masterId,
  p_variant_key: variantKeyRaw && variantKeyRaw.trim() ? variantKeyRaw.trim() : null,
  p_qty: qty,
});

if (error) {
  return NextResponse.json({ error: error.message ?? "유효가격 조회 실패" }, { status: 400 });
}

const row = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
return NextResponse.json(row, { headers: { "Cache-Control": "no-store" } });
```

#### ✅ P0-2) UI: EffectivePriceCard를 방어적으로 만들고 “Shipments 차단”을 위한 상태 콜백 추가
**파일:** `web/src/components/pricing/EffectivePriceCard.tsx`

1.  **queryFn에서 payload normalize**
    * 혹시 route가 배열을 다시 반환하거나, 다른 화면에서 direct로 쓰여도 안전하게 응답 JSON이 배열이면 첫 원소 사용.
2.  **onStateChange(or onQueryStateChange) 콜백 prop 추가**
    * Shipments 페이지가 “로딩/에러/성공”을 감지해서 BUNDLE 확정 차단에 사용하게 함.
    * **추가 prop:**
    ```typescript
    onStateChange?: (state: {
      isLoading: boolean;
      isError: boolean;
      errorMessage: string | null;
    }) => void;
    ```
    * **useEffect로 상태 전달:**
    ```typescript
    useEffect(() => {
      onStateChange?.({
        isLoading: effectivePriceQuery.isLoading,
        isError: effectivePriceQuery.isError,
        errorMessage: effectivePriceQuery.isError ? ((effectivePriceQuery.error as Error)?.message ?? "유효가격 조회 실패") : null,
      });
    }, [effectivePriceQuery.isLoading, effectivePriceQuery.isError, effectivePriceQuery.error, onStateChange]);
    ```
3.  **breakdownColumns fallback (표가 “빈 헤더”가 되지 않게)**
    * 현재 로직은 `preferredOrder`에 없는 키만 오면 `columns=[]`가 되어 표가 깨져 보임.
    * → `preferredOrder` 매칭 결과가 empty면 `Object.keys(firstRow)` 기반으로 fallback.
    * **예:**
    ```typescript
    const cols = preferredOrder.filter((k) => allKeys.has(k));
    if (cols.length > 0) return cols;
    return Array.from(allKeys.values());
    ```
    * DB 0601에서 breakdown에 `component_*` 키를 “추가”했지만, 프론트도 fallback이 있으면 운영이 훨씬 안전함.

#### ✅ P0-3) Shipments: BUNDLE 확정 버튼 차단 로직을 “완전 안전”하게 강화
**파일:** `web/src/app/(app)/shipments/page.tsx`

1.  **“현재 effectiveMasterId가 BUNDLE인지”를 DB에서 조회**
    * Shipments는 현재 master_kind를 확실히 알 수 없어서 pricing_method에 의존했는데, fetch 실패 시 판정 불가 → 확정 차단이 뚫릴 수 있음.
    * 따라서 `effectiveMasterId` 기준으로 `cms_master_item.master_kind` 조회 `useQuery` 추가.
    * **주의:** 이 프로젝트의 테이블 컬럼은 `master_id`가 정답임. (다른 API/코드도 `master_id` 사용) 기존 코드 중 `.select("master_item_id"...).eq("master_item_id"... )` 같은 부분이 있다면, 이번 작업 범위에서 함께 `master_id`로 정리해서 “내부 에러/불필요한 쿼리 실패” 제거 권장.
    * **쿼리 예:**
    ```typescript
    const effectiveMasterKindQuery = useQuery({
      queryKey: ["effective-master-kind", effectiveMasterId],
      enabled: Boolean(schemaClient && effectiveMasterId),
      queryFn: async () => {
        if (!schemaClient || !effectiveMasterId) return null;
        const { data, error } = await schemaClient
          .from("cms_master_item")
          .select("master_id, master_kind")
          .eq("master_id", effectiveMasterId)
          .maybeSingle();
        if (error) throw error;
        return data as { master_id: string; master_kind: string } | null;
      },
    });
    const isEffectiveBundle = effectiveMasterKindQuery.data?.master_kind === "BUNDLE";
    ```
2.  **EffectivePriceCard에서 상태/데이터를 받아 차단 조건 강화**
    * **기존:** `pricing_method==="BUNDLE_ROLLUP" && ok===false` 만 차단
    * **개선:** BUNDLE이면 아래 중 하나라도 true면 차단
        * effective price 로딩 중
        * effective price fetch 에러
        * effectivePriceData 없음
        * effectivePriceData.ok === false
    * **구현:**
    ```typescript
    const [effectivePriceData, setEffectivePriceData] = useState<EffectivePriceResponse | null>(null);
    const [effectivePriceState, setEffectivePriceState] = useState<{isLoading:boolean; isError:boolean; errorMessage:string|null} | null>(null);

    const isBundlePricingBlocked =
      !isStorePickup &&
      !isShipmentConfirmed &&
      isEffectiveBundle &&
      (
        effectivePriceState?.isLoading ||
        effectivePriceState?.isError ||
        !effectivePriceData ||
        effectivePriceData.ok === false
      );
    ```
    * **그리고 EffectivePriceCard 호출부에:**
    ```tsx
    <EffectivePriceCard
      masterId={effectiveMasterId}
      qty={effectiveQty}
      variantKey={resolvedVariantKey}
      title="유효가격 프리뷰"
      showBreakdown
      onDataChange={setEffectivePriceData}
      onStateChange={setEffectivePriceState}
    />
    ```
3.  **차단 시 사용자에게 이유 표시(로딩/에러/ok=false)**
    * 로딩: “BUNDLE 유효가격 계산 중(확정 대기)”
    * 에러: “유효가격 조회 실패(확정 불가): {errorMessage}”
    * ok=false: error_message 그대로 표시

#### ✅ P0-4) Flatten 디버그: /api/bom-flatten에서 “enriched 형태로 반환”해서 UI가 제대로 보이게
**파일:** `web/src/app/api/bom-flatten/route.ts`

**목표:**
* DB flatten RPC는 leaf id만 주기 때문에 UI에서 모델명/파트명이 비어보임
* API route에서 master/part 이름을 join해서 기존 UI가 기대하는 키를 반환

**구현 방식(권장):**
1.  RPC 호출로 raw rows 확보
2.  `leaf_master_id`, `leaf_part_id`를 set으로 수집
3.  `cms_master_item`에서 `master_id`, `model_name` 한번에 조회(in)
4.  `cms_part_item`에서 `part_id`, `part_name`, `unit_default` 한번에 조회(in)
5.  raw row를 아래 키로 매핑해서 반환:
    * `depth`
    * `path`는 uuid[] → `" > "` join한 문자열로 변환(디버그 가독성)
    * `qty_per_product_unit`
    * `component_ref_type` = `leaf_ref_type`
    * `component_master_id`, `component_master_model_name`
    * `component_part_id`, `component_part_name`
    * `unit` (MASTER면 "EA", PART면 `unit_default` fallback "EA")

이렇게 하면 `bom/page.tsx`와 `catalog/page.tsx`의 flatten 테이블은 큰 수정 없이 바로 정상 표시됨.

#### ✅ P1) UX/정합성: variant_key 안내 문구 통일
**파일:**
* `web/src/app/(app)/bom/page.tsx`
* `web/src/app/(app)/catalog/page.tsx`

현재 placeholder가 `"suffix / color / size"`로 되어있는데 실제 규칙은 `suffix|color|size`.
UI 혼동이 레시피 매칭 실패로 이어질 수 있으니 문구 수정:
* `"variant_key (예: suffix|color|size). 비우면 DEFAULT"`

---

### 4) 완료 기준(머지 체크리스트)
* **기능 체크**
    * Catalog/BOM 화면 EffectivePriceCard
        * BUNDLE이면 pricing_method = BUNDLE_ROLLUP 표시
        * breakdown 표가 빈 값이 아니고 구성품 행이 보임(최소 타입/이름/수량/금액)
    * Flatten 디버그
        * bom 페이지 / catalog 페이지에서 Flatten 보기 시 타입/구성품 이름/qty/path가 정상 출력
    * Shipments 확정 차단
        * BUNDLE인데 BOM 누락/사이클이면: EffectivePriceCard에 `ok=false` + `error_message` 표시, Confirm 버튼 `disabled`, 토스트/문구로 “확정 불가” 이유 표시
        * BUNDLE인데 유효가격 로딩 중/에러도 Confirm 버튼 `disabled`
        * Non-BUNDLE은 정상 진행: non-bundle은 유효가격 로딩/에러 때문에 불필요하게 막히지 않음(차단 조건이 `isEffectiveBundle`에 걸려있기 때문)

---

### 5) 구현 순서(권장)
1.  `/api/master-effective-price` normalize (P0-1)
2.  `EffectivePriceCard` payload 방어 + `onStateChange` (P0-2)
3.  Shipments: `master_kind` 조회 + 차단 조건 강화 (P0-3)
4.  `/api/bom-flatten` enriched 반환 (P0-4)
5.  placeholder 문구 정리 (P1)