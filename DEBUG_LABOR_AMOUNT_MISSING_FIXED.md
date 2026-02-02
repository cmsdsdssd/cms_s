# 출고 공임금액 미반영 디버깅 리포트 (최종)

## 🔴 발견된 문제

### 문제 요약
출고 처리 시 **공임(labor) 금액이 데이터베이스에 저장되지 않음**

### 근본 원인
DB 함수 `cms_fn_update_shipment_line_v1`에 `p_manual_labor_krw` 파라미터가 **존재하지 않음**

### 함수 파라미터 확인 결과
```sql
-- 실제 함수 파라미터
p_shipment_line_id uuid,
p_qty integer,
p_category_code cms_e_category_code,
p_material_code cms_e_material_code,
p_measured_weight_g numeric,
p_deduction_weight_g numeric,
p_is_plated boolean,
p_plating_variant_id uuid,
p_pricing_mode cms_e_pricing_mode,
p_unit_price_krw numeric,
p_manual_total_amount_krw numeric,  -- ✅ 총액 직접 지정 가능
p_repair_fee_krw numeric,
p_note text

-- ❌ p_manual_labor_krw 파라미터 없음!
```

---

## 🛠️ 해결책: 총액 직접 계산하여 전달

### 수정된 파일 1: `inline-shipment-panel.tsx`

**Before:**
```typescript
await callRpc("cms_fn_shipment_update_line_v1", {
  p_shipment_id: shipmentId,
  p_measured_weight_g: weightNum / orderData.qty,
  p_deduction_weight_g: deductionNum / orderData.qty,
  p_plating_amount_sell_krw: parseFloat(platingCost) || 0,
  p_repair_fee_krw: parseFloat(repairFee) || 0,
  p_pricing_mode: "RULE",
  // labor 누락!
});
```

**After:**
```typescript
// ✅ 총액 직접 계산 (소재비 + 공임 + 도금 + 수리비)
const calculatedTotal = materialCost + laborTotal + platingTotal + repairTotal;

await callRpc("cms_fn_shipment_update_line_v1", {
  p_shipment_id: shipmentId,
  p_measured_weight_g: weightNum / orderData.qty,
  p_deduction_weight_g: deductionNum / orderData.qty,
  p_plating_amount_sell_krw: parseFloat(platingCost) || 0,
  p_repair_fee_krw: parseFloat(repairFee) || 0,
  p_manual_total_amount_krw: calculatedTotal, // ✅ 총액 전달
  p_pricing_mode: "RULE",
});
```

---

### 수정된 파일 2: `shipments/page.tsx`

**Before:**
```typescript
await shipmentLineUpdateMutation.mutateAsync({
  p_shipment_line_id: String(currentShipmentLineId),
  p_deduction_weight_g: dValue,
  // labor 누락!
});
```

**After:**
```typescript
// ✅ 총액 계산 (소재비 + 공임)
const materialPrice = prefill?.model_no?.toLowerCase().includes('silver') 
  ? (marketTicks?.silver_price || 0) * (resolvedNetWeightG || 0)
  : (marketTicks?.gold_price || 0) * (resolvedNetWeightG || 0) * 0.6435;
const laborValue = Number(totalLabor) || 0;
const calculatedTotal = materialPrice + laborValue;

await shipmentLineUpdateMutation.mutateAsync({
  p_shipment_line_id: String(currentShipmentLineId),
  p_deduction_weight_g: dValue,
  p_manual_total_amount_krw: calculatedTotal, // ✅ 총액 전달
});
```

---

## 📊 계산 로직 상세

### 소재비 계산
```typescript
// 은 제품
const silverPrice = marketTicks?.silver_price || 0;  // 1.2 보정된 시세
const materialCost = silverPrice * weightG * purityFactor; // 925: 0.925

// 금 제품  
const goldPrice = marketTicks?.gold_price || 0;  // 24K 기준 시세
const materialCost = goldPrice * weightG * purityFactor; // 14K: 0.6435, 18K: 0.825
```

### 총액 계산
```typescript
const calculatedTotal = 
  materialCost +      // 소재비 (시세 × 순도 × 중량)
  laborTotal +        // 공임
  platingTotal +      // 도금비
  repairTotal;        // 수리비
```

---

## ✅ 확인사항

### 1. 처음 출고 생성 시
- `cms_fn_shipment_upsert_from_order_line`는 `p_total_labor` 파라미터 있음 ✅
- `handleSaveShipment`에서 이미 전달하고 있음 ✅

### 2. 라인 업데이트 시
- `cms_fn_update_shipment_line_v1`는 labor 파라미터 없음 ❌
- **대안**: `p_manual_total_amount_krw`로 총액 직접 전달 ✅

---

## 🚀 테스트 계획

### 테스트 1: 14K 금 반지
```
조건:
- 중량: 1g
- 순도: 14K (0.6435)
- 금시세: ₩100,000/g
- 공임: ₩20,000

예상 계산:
- 소재비: 100,000 × 0.6435 × 1 = ₩64,350
- 공임: ₩20,000
- 총액: ₩84,350

검증:
- p_manual_total_amount_krw = 84350
```

### 테스트 2: 925 은 반지
```
조건:
- 중량: 1.2g
- 순도: 925 (0.925)
- 은시세: ₩10,000/g (SILVER_CN_KRW_PER_G)
- 공임: ₩15,000

예상 계산:
- 소재비: 10,000 × 0.925 × 1.2 = ₩11,100
- 공임: ₩15,000
- 총액: ₩26,100

검증:
- p_manual_total_amount_krw = 26100
```

---

## 📝 SQL로 결과 확인

```sql
-- 최근 출고 내역 확인
SELECT 
  shipment_line_id,
  model_name,
  material_amount_sell_krw,
  labor_total_sell_krw,
  total_amount_sell_krw,
  (COALESCE(material_amount_sell_krw, 0) + 
   COALESCE(labor_total_sell_krw, 0)) as calculated_total
FROM cms_shipment_line
ORDER BY created_at DESC
LIMIT 5;

-- 검증: calculated_total = total_amount_sell_krw 여야 함
```

---

## 🎯 다음 단계

1. ✅ 코드 수정 완료 (2개 파일)
2. ⬜ 서버 재시작
3. ⬜ 스모크 테스트 (금/은 각 1건씩)
4. ⬜ 결과 SQL로 검증

---

**최종 수정일**: 2026년 2월 2일  
**수정 파일**: 
- `web/src/components/shipment/inline-shipment-panel.tsx`
- `web/src/app/(app)/shipments/page.tsx`
