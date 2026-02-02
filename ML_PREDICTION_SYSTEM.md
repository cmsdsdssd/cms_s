# ML/예측 출고가 시스템 설계

## 🎯 목표
비고/메모 데이터를 학습하여 실제 공임을 예측하고, 최적의 출고가를 추천

## 📊 데이터 수집 구조

### 학습 데이터 (Feature)
```json
{
  "input": {
    "model_name": "GR-001-GOLD",
    "material_type": "GOLD_14K",
    "weight_g": 1.2,
    "plating": true,
    "plating_color": "ROSEGOLD",
    "stone_count": 3,
    "order_qty": 5,
    "market_price_at_shipment": 100000,
    "cost_note_text": "도금 추가비 5000원, 급제작비 10000원, 석세팅 3000원"
  },
  "actual": {
    "material_cost": 77160,
    "labor_cost": 25000,
    "total_cost": 102160
  }
}
```

## 🤖 ML 모델 파이프라인

### 1단계: 텍스트 임베딩 (비고/메모 파싱)
```python
# 추가 비용 추출
# "도금 추가비 5000원" → {type: "plating", amount: 5000}
# "급제작비 10000원" → {type: "rush", amount: 10000}
```

### 2단계: 회귀 모델
```python
features = [
  base_material_cost,      # 소재 기본비
  base_labor_cost,         # 마스터 기본 공임
  additional_costs_sum,    # 비고에서 추출한 추가비 총합
  similar_cases_avg_variance  # 과거 유사 케이스 평균 차이
]

model = XGBoostRegressor()
predicted_labor = model.predict(features)
```

### 3단계: 예측 출고가
```python
predicted_total_cost = material_cost + predicted_labor
recommended_price = max(
  master_price,
  predicted_total_cost * 1.05  # 5% 마진
)
```

## 🗄️ ML 전용 테이블

```sql
-- 학습 데이터 저장
CREATE TABLE ml_training_data (
  training_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_line_id UUID REFERENCES cms_shipment_line(shipment_line_id),
  
  -- Features (JSONB)
  features JSONB NOT NULL,
  
  -- Actual values
  actual_labor_cost INTEGER,
  actual_total_cost INTEGER,
  
  -- Prediction results
  predicted_labor_cost INTEGER,
  prediction_error_rate DECIMAL,
  
  -- Model version
  model_version TEXT,
  trained_at TIMESTAMP DEFAULT NOW()
);

-- 예측 결과 저장
CREATE TABLE ml_price_predictions (
  prediction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_line_id UUID,
  
  -- Input
  input_features JSONB,
  
  -- Prediction
  predicted_labor INTEGER,
  predicted_total_cost INTEGER,
  recommended_price INTEGER,
  confidence_score DECIMAL,  -- 0~1
  
  -- Comparison with actual
  actual_labor INTEGER,
  accuracy_rate DECIMAL,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔄 실시간 예측 API

```typescript
// 예측 API 호출
const prediction = await fetch('/api/ml/predict-labor', {
  method: 'POST',
  body: JSON.stringify({
    model_name: 'GR-001-GOLD',
    material_type: 'GOLD_14K',
    weight_g: 1.2,
    cost_note: '도금 추가비 5000원'
  })
});

// 결과
{
  predicted_labor: 23000,      // 예측 공임
  recommended_price: 105000,   // 추천 출고가
  confidence: 0.85,            // 신뢰도 85%
  similar_cases: 5             // 유사 케이스 5건
}
```

## 🎓 학습 주기

```python
# 매일 새벽 3시 자동 학습
cron.schedule('0 3 * * *', async () => {
  // 1. 새로운 데이터 수집
  new_data = fetch_recent_shipments()
  
  # 2. 모델 재학습
  model.fit(new_data)
  
  # 3. 성능 평가
  accuracy = evaluate_model()
  
  # 4. 배포 (정확도 > 80%일 때만)
  if accuracy > 0.8:
      deploy_model()
})
```

## 📊 성능 모니터링

| Metric | Target |
|--------|--------|
| 공임 예측 오차 | < 10% |
| 신뢰도 | > 80% |
| 데이터 축적 | 1000건+ |

---
**이것이 미래의 AI 출고 시스템입니다!** 🚀
