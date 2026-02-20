# 출고 원가 계산 시스템 재설계

## 🎯 핵심 목표

```
[영수증] → [원가 파악] → [마스터 참고] → [출고가 계산] → [출고]
   ↑                                              ↓
   └────────────── 실제 구매 데이터 ──────────────┘
```

**원칙**: 원가 + 마진 = 출고가 (절대 손해보지 않는 가격)

---

## 📊 현재 문제점

### 1. 공임 ₩0 문제
- 출고 시 공임이 DB에 저장되지 않음
- 결과: 총원가 = 소재비만 계산됨 (공임 누락)
- ML 학습 시 잘못된 데이터 축적

### 2. 영수증-출고 연결 미흡
- 영수증은 "연결"만 되고 원가 반영은 안 됨
- 출고 확정 시 영수증 금액이 자동으로 원가로 들어가야 함

---

## 🏗️ 새로운 아키텍처

### 데이터 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                     1단계: 원가 데이터 수짝                      │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│  [영수증 업로드]                                                │
│  - 총금액 (외화)                                               │
│  - 환율 → 원화 변환                                             │
│  - 중량 (g)                                                    │
│  - 공임 (labor)                                                │
│  - 비고: 추가 항목들 (메모 필드)                                 │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                     2단계: 원가 계산                             │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│  원가 = 소재비 + 공임 + 부가비용                                 │
│                                                                 │
│  소재비 = (영수증 총금액 - 공임) × 환율                         │
│  또는                                                            │
│  소재비 = 중량(g) × 시세 × 순도                                  │
│                                                                 │
│  ※ 영수증에 공임이 별도 표기되어 있으면 그대로 사용              │
│  ※ 없으면 마스터 기본 공임 또는 비고 내용 파싱                   │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                     3단계: 출고가 계산                           │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│  마스터에서 기준가 참고                                          │
│  - material_amount_sell_krw (소재 판매가)                        │
│  - labor_total_sell_krw (공임 판매가)                            │
│                                                                 │
│  BUT! 원가가 더 높으면 원가 기준으로 조정                        │
│  (절대 손해보지 않는 원칙)                                       │
│                                                                 │
│  최종 출고가 = MAX(마스터가, 원가 + 최소마진)                    │
│              = MAX(마스터가, 원가 × 1.05)  // 5% 마진 예시      │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                     4단계: 출고 확정                             │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│  cms_shipment_line에 저장:                                       │
│  - material_amount_sell_krw: 최종 소재 출고가                    │
│  - labor_total_sell_krw: 최종 공임 출고가                        │
│  - total_amount_sell_krw: 총 출고가                              │
│  - actual_cost_krw: 실제 원가 (NEW!)                             │
│  - receipt_id: 연결된 영수증                                     │
│  - cost_note: 비고/메모 (ML 학습용)                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 💾 필요한 DB 변경

### 1. `cms_shipment_line` 테이블 추가 컬럼

```sql
-- 실제 원가 (영수증 기준)
ALTER TABLE cms_shipment_line 
ADD COLUMN IF NOT EXISTS actual_cost_krw INTEGER,
ADD COLUMN IF NOT EXISTS actual_material_cost_krw INTEGER,
ADD COLUMN IF NOT EXISTS actual_labor_cost_krw INTEGER;

-- 비고/메모 (ML 학습용)
ALTER TABLE cms_shipment_line 
ADD COLUMN IF NOT EXISTS cost_note TEXT;

-- 원가 출처 (영수증 ID)
ALTER TABLE cms_shipment_line 
ADD COLUMN IF NOT EXISTS receipt_id UUID REFERENCES cms_receipt_inbox(receipt_id);
```

### 2. 새로운 RPC 함수

```sql
-- 출고 확정 시 원가 계산 및 저장
CREATE OR REPLACE FUNCTION cms_fn_confirm_shipment_v3_cost_v1(
  p_shipment_id UUID,
  p_receipt_id UUID,          -- 영수증 연결
  p_cost_mode TEXT,           -- 'RULE' | 'MANUAL' | 'RECEIPT'
  p_manual_material_krw INTEGER DEFAULT NULL,
  p_manual_labor_krw INTEGER DEFAULT NULL,
  p_min_margin_rate DECIMAL DEFAULT 0.05,  -- 최소 마진 5%
  p_note TEXT DEFAULT NULL,   -- 비고/메모
  ...
)
RETURNS JSONB AS $$
DECLARE
  v_receipt_amount DECIMAL;
  v_receipt_labor DECIMAL;
  v_calculated_material DECIMAL;
  v_calculated_labor DECIMAL;
  v_master_material DECIMAL;
  v_master_labor DECIMAL;
  v_final_material DECIMAL;
  v_final_labor DECIMAL;
BEGIN
  -- 1. 영수증 데이터 조회
  SELECT 
    total_amount_krw,
    labor_amount_krw  -- 영수증에서 공임 추출 (AI 파싱 또는 수기)
  INTO v_receipt_amount, v_receipt_labor
  FROM cms_receipt_inbox
  WHERE receipt_id = p_receipt_id;
  
  -- 2. 마스터 기준가 조회
  SELECT 
    material_amount_sell_krw,
    labor_total_sell_krw
  INTO v_master_material, v_master_labor
  FROM cms_shipment_line
  WHERE shipment_id = p_shipment_id;
  
  -- 3. 원가 계산 (영수증 기준)
  IF p_cost_mode = 'RECEIPT' THEN
    -- 영수증 기준
    v_calculated_material := v_receipt_amount - COALESCE(v_receipt_labor, 0);
    v_calculated_labor := COALESCE(v_receipt_labor, v_master_labor);
  ELSIF p_cost_mode = 'MANUAL' THEN
    -- 수기 입력
    v_calculated_material := p_manual_material_krw;
    v_calculated_labor := p_manual_labor_krw;
  ELSE
    -- RULE: 마스터 기준
    v_calculated_material := v_master_material;
    v_calculated_labor := v_master_labor;
  END IF;
  
  -- 4. 최종 출고가 계산 (손해 방지)
  v_final_material := GREATEST(
    v_master_material,
    v_calculated_material * (1 + p_min_margin_rate)
  );
  
  v_final_labor := GREATEST(
    v_master_labor,
    v_calculated_labor * (1 + p_min_margin_rate)
  );
  
  -- 5. 저장
  UPDATE cms_shipment_line
  SET 
    material_amount_sell_krw = v_final_material,
    labor_total_sell_krw = v_final_labor,
    total_amount_sell_krw = v_final_material + v_final_labor,
    actual_cost_krw = v_calculated_material + v_calculated_labor,
    actual_material_cost_krw = v_calculated_material,
    actual_labor_cost_krw = v_calculated_labor,
    receipt_id = p_receipt_id,
    cost_note = p_note,
    status = 'CONFIRMED'
  WHERE shipment_id = p_shipment_id;
  
  RETURN jsonb_build_object(
    'shipment_id', p_shipment_id,
    'actual_cost', v_calculated_material + v_calculated_labor,
    'final_price', v_final_material + v_final_labor,
    'margin_rate', (v_final_material + v_final_labor) / NULLIF(v_calculated_material + v_calculated_labor, 0) - 1
  );
END;
$$ LANGUAGE plpgsql;
```

---

## 🖥️ 프론트엔드 변경

### 1. 출고 확정 모달 개선

```typescript
// 출고 확정 시 원가/판매가 비교 표시
interface CostComparison {
  // 영수증 기준 원가
  receiptCost: {
    material: number;  // 소재 원가
    labor: number;     // 공임 원가
    total: number;     // 총 원가
  };
  
  // 마스터 기준 판매가
  masterPrice: {
    material: number;
    labor: number;
    total: number;
  };
  
  // 최종 출고가 (손해 방지 적용)
  finalPrice: {
    material: number;
    labor: number;
    total: number;
  };
  
  // 마진 정보
  margin: {
    amount: number;    // 마진액
    rate: number;      // 마진율
    isProfit: boolean; // 이익 여부
  };
}
```

### 2. UI 예시

```
┌─────────────────────────────────────────┐
│           출고 확정 (원가 반영)          │
├─────────────────────────────────────────┤
│                                         │
│  📄 영수증 원가                          │
│     소재: ₩50,000 (영수증)              │
│     공임: ₩10,000 (영수증/비고)          │
│     총원가: ₩60,000                     │
│                                         │
│  📊 마스터 기준가                        │
│     소재: ₩71,990                       │
│     공임: ₩0 ⚠️ (미설정)                │
│                                         │
│  💰 최종 출고가 (자동 계산)              │
│     소재: ₩71,990 ✅ (마스터가 > 원가)   │
│     공임: ₩15,000 ✅ (원가+25% 마진)     │
│     ─────────────────                   │
│     총액: ₩86,990                       │
│     마진: ₩26,990 (31%) 🟢              │
│                                         │
│  📝 비고/메모 (ML 학습용)                │
│     [추가 공임: 도금 비용 포함됨]        │
│                                         │
│     [   출고 확정   ]                   │
└─────────────────────────────────────────┘
```

---

## 🤖 미래: ML 예측 시스템

### 학습 데이터 구조

```json
{
  "input_features": {
    "model_name": "GR-001-GOLD",
    "material_type": "GOLD_14K",
    "weight_g": 1.2,
    "market_price_per_g": 100000,
    "order_qty": 5,
    "plating": true,
    "plating_color": "ROSEGOLD",
    "stone_count": 3,
    "receipt_cost_note": "도금 추가비 5,000원, 급제작비 10,000원"
  },
  "actual_cost": {
    "material": 64350,
    "labor": 25000,
    "total": 89350
  },
  "predicted_vs_actual": {
    "master_labor": 15000,    // 마스터 기존
    "actual_labor": 25000,    // 실제 발생
    "variance": 10000         // 차이 (학습 포인트)
  }
}
```

### 예측 모델

```python
# 출고가 예측 모델 (Fine-tuned LLM 또는 Regression)
class ShipmentPricePredictor:
    def predict(self, input_data):
        """
        입력: 제품 정보 + 비고 내용
        출력: 예상 원가 (소재, 공임)
        """
        # 1. 비고 텍스트 파싱 (추가 비용 추출)
        additional_costs = parse_note(input_data['receipt_cost_note'])
        
        # 2. 기본 원가 계산
        base_cost = calculate_base_cost(input_data)
        
        # 3. 과거 유사 케이스 검색 (RAG)
        similar_cases = find_similar_shipments(input_data)
        
        # 4. 최종 예측
        predicted_cost = model.predict([
            base_cost,
            additional_costs,
            similar_cases.average_variance
        ])
        
        return predicted_cost
```

---

## 📋 구현 로드맵

### Phase 1: 긴급 수정 (오늘)
- [ ] DB 컬럼 추가 (actual_cost_krw, cost_note)
- [ ] RPC 함수 수정 (원가 계산 로직 추가)
- [ ] 공임 ₩0 문제 해결

### Phase 2: 원가 시스템 (이번 주)
- [ ] 영수증-출고 연결 개선
- [ ] 출고 확정 UI에 원가/마진 표시
- [ ] 비고/메모 필드 추가

### Phase 3: 데이터 축적 (1개월)
- [ ] 실제 원가 데이터 수집
- [ ] 마스터 가격 vs 실제 원가 비교 분석

### Phase 4: ML 도입 (3개월~)
- [ ] 학습 데이터셋 구축
- [ ] 예측 모델 개발
- [ ] 예측 출고가 추천 기능

---

## 🎯 지금 당장 할 일

### 1. DB 컬럼 추가
```sql
-- 즉시 실행
ALTER TABLE cms_shipment_line 
ADD COLUMN IF NOT EXISTS actual_cost_krw INTEGER,
ADD COLUMN IF NOT EXISTS actual_material_cost_krw INTEGER,
ADD COLUMN IF NOT EXISTS actual_labor_cost_krw INTEGER,
ADD COLUMN IF NOT EXISTS cost_note TEXT;
```

### 2. RPC 함수 확인/수정
```sql
-- 현재 함수 확인
SELECT proargnames, prosrc 
FROM pg_proc 
WHERE proname = 'cms_fn_shipment_upsert_from_order_line';

-- p_total_labor이 labor_total_sell_krw에 저장되는지 확인
```

### 3. 기존 데이터 보정
```sql
-- 공임 마스터 기준으로 복원
UPDATE cms_shipment_line sl
SET labor_total_sell_krw = (
  SELECT (mi.labor_base_sell + mi.labor_center_sell + mi.labor_sub1_sell + mi.labor_sub2_sell) 
  FROM cms_master_item mi
  JOIN cms_order_line ol ON sl.order_line_id = ol.order_line_id
  WHERE mi.master_item_id = ol.matched_master_id
)
WHERE sl.labor_total_sell_krw = 0
  AND sl.created_at >= '2026-02-02';
```

---

**목표**: 손해보지 않는 출고 + ML로 스마트한 가격 예측
