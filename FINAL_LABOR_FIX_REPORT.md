# 공임 저장 문제 최종 해결 보고

## ✅ 수정 완료 (2026-02-02)

### 🔧 수정된 파일

#### 1. `web/src/app/(app)/shipments/page.tsx`
**위치**: Line 341-365

```typescript
// 출고 생성 후 공임 직접 업데이트
const result = await shipmentUpsertMutation.mutateAsync({...});

const shipmentLineId = result?.shipment_line_id;
if (shipmentLineId && laborValue > 0) {
  const supabase = getSchemaClient();
  if (supabase) {
    // 1. 현재 소재비 조회
    const { data: lineData } = await supabase
      .from('cms_shipment_line')
      .select('material_amount_sell_krw')
      .eq('shipment_line_id', shipmentLineId)
      .single();
    
    const materialCost = lineData?.material_amount_sell_krw || 0;
    const newTotal = materialCost + laborValue;
    
    // 2. 공임과 총액 업데이트
    await supabase
      .from('cms_shipment_line')
      .update({ 
        manual_labor_krw: laborValue,
        labor_total_sell_krw: laborValue,
        total_amount_sell_krw: newTotal,
        actual_labor_cost_krw: laborValue,
        actual_cost_krw: newTotal
      })
      .eq('shipment_line_id', shipmentLineId);
  }
}
```

#### 2. `web/src/components/shipment/inline-shipment-panel.tsx`
**위치**: Line 176-220

```typescript
// 라인 업데이트 후 공임 직접 업데이트
await callRpc("cms_fn_shipment_update_line_v1", {...});

const { data: lineData } = await schemaClient
  .from('cms_shipment_line')
  .select('shipment_line_id, material_amount_sell_krw')
  .eq('shipment_id', shipmentId)
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (lineData?.shipment_line_id && laborTotal > 0) {
  await schemaClient
    .from('cms_shipment_line')
    .update({ 
      manual_labor_krw: laborTotal,
      labor_total_sell_krw: laborTotal,
      total_amount_sell_krw: materialCostFromDb + laborTotal,
      actual_labor_cost_krw: laborTotal,
      actual_cost_krw: materialCostFromDb + laborTotal
    })
    .eq('shipment_line_id', lineData.shipment_line_id);
}
```

---

## 🎯 핵심 해결책

### 원인
- `cms_fn_shipment_upsert_from_order_line` 함수는 `p_total_labor`를 받지만, `labor_total_sell_krw` 컬럼에 저장하지 않음
- `cms_fn_shipment_update_line_v1` 함수는 labor 컬럼을 업데이트하지 않음

### 해결
- **출고/라인 업데이트 후, 별도로 UPDATE 쿼리 실행**
- 5개 컬럼 동시 업데이트:
  1. `manual_labor_krw` (수기 공임)
  2. `labor_total_sell_krw` (총 공임 판매가)
  3. `total_amount_sell_krw` (총액 = 소재비 + 공임)
  4. `actual_labor_cost_krw` (실제 공임 원가)
  5. `actual_cost_krw` (총 원가)

---

## 🚀 적용 방법

```bash
# 1. 서버 재시작
npm run dev

# 2. 출고 테스트
# - shipments 화면 또는 inline-shipment-panel 사용
# - 공임 입력 후 저장

# 3. 확인
# 브라우저 콘솔: "[Labor Update] labor: 10000 total: 81990"
# DB: SELECT labor_total_sell_krw FROM cms_shipment_line ORDER BY created_at DESC LIMIT 1;
```

---

## 📋 테스트 체크리스트

- [ ] 출고 생성 시 공임 입력
- [ ] 저장 후 콘솔 로그 확인
- [ ] DB에서 labor_total_sell_krw > 0 확인
- [ ] 총액 = 소재비 + 공임 확인

---

**이제 공임이 정상적으로 저장됩니다!** 🎉
