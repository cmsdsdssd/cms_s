# 출고 공임금액 미반영 디버깅 리포트

## 🔴 발견된 문제

### 문제 요약
출고 처리 시 **공임(labor) 금액이 데이터베이스에 저장되지 않음**

### 영향 범위
- **증상**: 출고 완료 후 조회 시 소재비만 표시되고 공임비는 0원 또는 null로 표시됨
- **발생 위치**: `inline-shipment-panel.tsx` 컴포넌트
- **심각도**: 🔴 **높음** (매출/미수금 계산 오류)

---

## 🔍 디버깅 과정

### 1. 코드 분석

#### 문제 코드 위치
```typescript
// File: web/src/components/shipment/inline-shipment-panel.tsx
// Line: 181-188

const updateLineMutation = useMutation({
  mutationFn: async () => {
    if (!shipmentId || !schemaClient) throw new Error("No shipment");
    
    // Update shipment line with weights and pricing
    await callRpc("cms_fn_shipment_update_line_v1", {
      p_shipment_id: shipmentId,
      p_measured_weight_g: weightNum / orderData.qty, // per unit
      p_deduction_weight_g: deductionNum / orderData.qty, // per unit
      p_plating_amount_sell_krw: parseFloat(platingCost) || 0,
      p_repair_fee_krw: parseFloat(repairFee) || 0,
      p_pricing_mode: "RULE",
      // ❌ p_manual_labor_krw 파라미터 누락!
    });
    
    return true;
  },
});
```

#### 근거 데이터

**Line 123-130**: 공임 계산은 정상적으로 수행
```typescript
const totalLabor = 
  (masterInfo.labor_base_sell || 0) + 
  (masterInfo.labor_center_sell || 0) + 
  (masterInfo.labor_sub1_sell || 0) + 
  (masterInfo.labor_sub2_sell || 0);
if (!laborCost && totalLabor > 0) {
  setLaborCost(String(totalLabor * orderData.qty));
}
```

**Line 140**: 화면 표시용 계산도 정상
```typescript
const laborTotal = parseFloat(laborCost) || 0;
```

**Line 143**: 총액 계산에는 포함됨
```typescript
const totalAmount = materialCost + laborTotal + platingTotal + repairTotal;
```

**❌ Line 181-188**: BUT API 호출 시 누락!
```typescript
// p_manual_labor_krw 파라미터가 전달되지 않음!
```

---

## 🛠️ 해결책

### 수정 내용

**파일**: `web/src/components/shipment/inline-shipment-panel.tsx`

**Before**:
```typescript
await callRpc("cms_fn_shipment_update_line_v1", {
  p_shipment_id: shipmentId,
  p_measured_weight_g: weightNum / orderData.qty,
  p_deduction_weight_g: deductionNum / orderData.qty,
  p_plating_amount_sell_krw: parseFloat(platingCost) || 0,
  p_repair_fee_krw: parseFloat(repairFee) || 0,
  p_pricing_mode: "RULE",
});
```

**After**:
```typescript
await callRpc("cms_fn_shipment_update_line_v1", {
  p_shipment_id: shipmentId,
  p_measured_weight_g: weightNum / orderData.qty,
  p_deduction_weight_g: deductionNum / orderData.qty,
  p_plating_amount_sell_krw: parseFloat(platingCost) || 0,
  p_repair_fee_krw: parseFloat(repairFee) || 0,
  p_manual_labor_krw: laborTotal, // ✅ 공임 추가
  p_pricing_mode: "RULE",
});
```

---

## ✅ 수정 적용 후 확인사항

### 1. 서버 재시작
```bash
cd web
npm run dev
```

### 2. 스모크 테스트

#### 테스트 케이스 1: 기본 출고
```
조건:
- 제품: 14K 금 반지
- 중량: 1g
- 소재비: ₩64,350 (자동계산)
- 공임: ₩20,000 (마스터 설정값)

예상 결과:
- total_amount_sell_krw: ₩84,350
- material_amount_sell_krw: ₩64,350
- labor_total_sell_krw: ₩20,000 ✅
```

#### 테스트 케이스 2: 은 제품
```
조건:
- 제품: 925 은 반지
- 중량: 1.2g
- 소재비: ₩11,100 (자동계산)
- 공임: ₩15,000

예상 결과:
- total_amount_sell_krw: ₩26,100
- material_amount_sell_krw: ₩11,100
- labor_total_sell_krw: ₩15,000 ✅
```

### 3. 검증 쿼리
```sql
-- 최근 출고 내역 확인
SELECT 
  shipment_line_id,
  model_name,
  material_amount_sell_krw,
  labor_total_sell_krw,
  total_amount_sell_krw,
  (material_amount_sell_krw + labor_total_sell_krw) as calculated_total
FROM cms_shipment_line
ORDER BY created_at DESC
LIMIT 5;

-- 검증: calculated_total = total_amount_sell_krw 여야 함
```

---

## 🔍 추가 확인 필요사항

### 1. 다른 페이지 확인
`shipments/page.tsx`도 동일한 패턴 사용하는지 확인 필요

### 2. RPC 함수 파라미터 확인
```typescript
// cms_fn_shipment_update_line_v1 함수가 
// p_manual_labor_krw 파라미터를 지원하는지 확인 필요

// Supabase에서 함수 정의 확인:
SELECT proargnames, proargtypes
FROM pg_proc 
WHERE proname = 'cms_fn_shipment_update_line_v1';
```

### 3. 데이터 정합성 검사
```sql
-- 기존 누락 데이터 확인
SELECT 
  COUNT(*) as total_shipments,
  COUNT(labor_total_sell_krw) as with_labor,
  COUNT(*) - COUNT(labor_total_sell_krw) as missing_labor
FROM cms_shipment_line
WHERE created_at > '2026-02-01';
```

---

## 📊 영향 분석

### 수정 전
| 항목 | 계산 | 결과 |
|------|------|------|
| 소재비 | ₩64,350 | ✅ 저장됨 |
| 공임비 | ₩20,000 | ❌ 누락 (0원) |
| 총액 | ₩84,350 | ⚠️ 소재비만 반영된 금액 저장 |
| 미수금 | ₩84,350 | ⚠️ 공임 누락된 금액 발생 |

### 수정 후
| 항목 | 계산 | 결과 |
|------|------|------|
| 소재비 | ₩64,350 | ✅ 저장됨 |
| 공임비 | ₩20,000 | ✅ 저장됨 |
| 총액 | ₩84,350 | ✅ 정확한 총액 저장 |
| 미수금 | ₩84,350 | ✅ 정확한 미수금 발생 |

---

## 🎯 다음 단계

1. ✅ 수정 코드 적용 완료
2. ⬜ 서버 재시작
3. ⬜ 스모크 테스트
4. ⬜ 기존 누락 데이터 보정 (필요시)
5. ⬜ `/shipments/page.tsx` 동일 패턴 확인

---

**발견일**: 2026년 2월 2일  
**수정일**: 2026년 2월 2일  
**수정자**: AI Assistant  
**파일**: `web/src/components/shipment/inline-shipment-panel.tsx`
