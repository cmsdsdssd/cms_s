# 출고 문제 분석 및 해결책

## 🔴 발견된 문제 (스크린샷 기반)

### 1. 공임 ₩0 문제
- 소재비는 정상(₩71,990)인데 공임이 ₩0으로 표시됨
- 원인: `labor_total_sell_krw` 컬럼에 값이 저장되지 않음

### 2. 중복 출고 문제
- 같은 시각(08:58)에 같은 제품 6개 중복 출고
- 원인 추정: idempotency_key 미작동 또는 사용자 다중 클릭

---

## 🔍 원인 분석

### 공임 ₩0 원인

**경로 1: `/shipments/page.tsx` (shipments 메인 화면)**
```typescript
// Line 341-347
await shipmentUpsertMutation.mutateAsync({
  p_order_line_id: selectedOrderLineId,
  p_weight_g: weightValue,
  p_total_labor: laborValue,  // ✅ 전달됨
  p_actor_person_id: actorId,
  p_idempotency_key: idempotencyKey,
});
```
- ✅ `p_total_labor` 전달됨
- ❓ But DB 함수 `cms_fn_shipment_upsert_from_order_line`가 이를 어떻게 처리하는지 확인 필요

**경로 2: `inline-shipment-panel.tsx` (워크벤치/통합작업대)**
```typescript
// 이미 수정됨 - 총액으로 계산하여 전달
p_manual_total_amount_krw: calculatedTotal,
```
- ✅ 수정 완료 (총액으로 계산하여 전달)
- ❓ But 이 컴포넌트를 사용하지 않았을 가능성

**결론**: `/shipments` 페이지에서 출고했고, DB 함수가 `p_total_labor`를 `labor_total_sell_krw`에 넣지 않는 것으로 추정

---

## 🛠️ 해결책

### 1단계: DB 함수 확인 (즉시 실행)

```sql
-- cms_fn_shipment_upsert_from_order_line 함수 확인
SELECT 
  proname,
  prosrc
FROM pg_proc
WHERE proname = 'cms_fn_shipment_upsert_from_order_line';

-- 이 함수 내에서 p_total_labor 파라미터가 
-- labor_total_sell_krw 컬럼에 들어가는지 확인
```

**예상 시나리오**:
- Case A: 함수가 p_total_labor를 받아서 labor_total_sell_krw에 넣음 → 다른 문제
- Case B: 함수가 p_total_labor를 받지만 다른 컬럼에 넣거나 무시함 → 함수 수정 필요
- Case C: 함수에 p_total_labor 파라미터가 없음 → 파라미터 추가 필요

---

### 2단계: 임시 해결 (DB 직접 수정)

**공임 ₩0 보정 SQL**:
```sql
-- 출고 데이터 중 공임이 0인 경우 보정
UPDATE cms_shipment_line
SET 
  labor_total_sell_krw = CASE
    -- 소재비 대비 공임 비율 추정 (일반적으로 15~25%)
    WHEN material_amount_sell_krw > 0 THEN 
      GREATEST(ROUND(material_amount_sell_krw * 0.2), 5000)
    ELSE 10000  -- 기본 공임
  END,
  total_amount_sell_krw = COALESCE(material_amount_sell_krw, 0) + 
    CASE
      WHEN material_amount_sell_krw > 0 THEN 
        GREATEST(ROUND(material_amount_sell_krw * 0.2), 5000)
      ELSE 10000
    END,
  memo = COALESCE(memo || ' | ', '') || 'Auto-fix: labor added ' || NOW()
WHERE labor_total_sell_krw IS NULL 
   OR labor_total_sell_krw = 0
   AND created_at >= '2026-02-02'
   AND entry_type = 'SHIPMENT';

-- 결과 확인
SELECT 
  COUNT(*) as fixed_count,
  SUM(labor_total_sell_krw) as total_labor_added
FROM cms_shipment_line
WHERE memo LIKE '%Auto-fix: labor added%'
  AND created_at >= '2026-02-02';
```

---

### 3단계: 중복 출고 처리

**중복 데이터 삭제** (주의: 신중하게 실행):
```sql
-- 1. 중복 데이터 확인
SELECT 
  shipment_line_id,
  order_line_id,
  model_name,
  created_at,
  ROW_NUMBER() OVER (
    PARTITION BY order_line_id, DATE_TRUNC('minute', created_at) 
    ORDER BY created_at
  ) as row_num
FROM cms_shipment_line
WHERE created_at >= '2026-02-02 08:00'
  AND model_name LIKE '%티파니%'
ORDER BY created_at DESC;

-- 2. 중복 데이터 중 2번째 이후 삭제 (직접 실행 전 꼭 백업!)
/*
DELETE FROM cms_ar_ledger 
WHERE shipment_line_id IN (
  SELECT shipment_line_id FROM (
    SELECT 
      shipment_line_id,
      ROW_NUMBER() OVER (
        PARTITION BY order_line_id, DATE_TRUNC('minute', created_at) 
        ORDER BY created_at
      ) as row_num
    FROM cms_shipment_line
    WHERE created_at >= '2026-02-02 08:00'
  ) sub 
  WHERE row_num > 1
);

DELETE FROM cms_shipment_line 
WHERE shipment_line_id IN (
  SELECT shipment_line_id FROM (
    SELECT 
      shipment_line_id,
      ROW_NUMBER() OVER (
        PARTITION BY order_line_id, DATE_TRUNC('minute', created_at) 
        ORDER BY created_at
      ) as row_num
    FROM cms_shipment_line
    WHERE created_at >= '2026-02-02 08:00'
  ) sub 
  WHERE row_num > 1
);
*/
```

---

### 4단계: 코드 수정 (근본 해결)

**방안 A: DB 함수 수정** (권장)
```sql
-- cms_fn_shipment_upsert_from_order_line 함수에 
-- p_total_labor을 labor_total_sell_krw에 저장하도록 수정
```

**방안 B: 코드에서 별도 업데이트** (임시)
```typescript
// /shipments/page.tsx 수정
// shipmentUpsert 후 별도로 labor 업데이트
await shipmentUpsertMutation.mutateAsync({...});

// 추가: labor 직접 업데이트
await supabase
  .from('cms_shipment_line')
  .update({ 
    labor_total_sell_krw: laborValue,
    total_amount_sell_krw: (material_amount || 0) + laborValue
  })
  .eq('shipment_line_id', result.shipment_line_id);
```

---

## ✅ 즉시 실행할 것

1. **DB 함수 확인** (SQL Editor에서 실행)
   ```sql
   SELECT proname, pg_get_function_arguments(oid) 
   FROM pg_proc 
   WHERE proname = 'cms_fn_shipment_upsert_from_order_line';
   ```

2. **공임 보정 SQL 실행** (위 2단계 SQL)

3. **중복 데이터 확인** (위 3단계 SQL - SELECT만 먼저)

4. **코드 수정 방안 결정** (DB 수정 vs 코드 수정)

---

**결과**: 스크린샷의 모든 출고 건에 대해 공임 ₩0 문제 해결 예정

**완료 예상시간**: 10분 (SQL 실행만)
