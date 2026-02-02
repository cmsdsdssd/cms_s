# 원자재(금/은) 결제 프로세스 가이드

## 개요

**목적**: 금/은 원자재(실물)를 사용한 결제 및 복합 결제(소재+공임 분리) 처리  
**적용제품**: 귀금속 제품 (반지, 목걸이 등)  
**핵심개념**: 소재비(원자재)와 공임비를 분리 계산 및 결제

---

## 💡 핵심 개념: 결제 분리

### 일반적인 결제 (현금/계좌)
```
총액 = (소재비 + 공임비) → 한 번에 현금/계좌로 결제
```

### 원자재 결제 (금/은 실물)
```
총액 = 소재비(금/은 실물) + 공임비(현금/계좌)
        ↓                    ↓
   실제 금/은 전달      별도 현금 결제
```

**예시:**
- 14K 반지 1g (공임 10,000원)
- 소재비: 금 0.6435g 실물 전달
- 공임비: 10,000원 현금/계좌 결제

---

## 📊 소재별 가격 계산 공식

### 1. 은 (Silver) 계산

#### 기본 공식
```
[최종 은가격] = [시세] × [순도계수] × [중량]
```

#### 상세 계산
```
1. 시세 가져오기
   - SILVER_CN_KRW_PER_G (중국 은시세) 사용
   - 이미 1.2가 곱해진 값으로 제공됨
   
2. 순도 계수 적용
   - 925 (92.5% 순은): × 0.925
   - 999 (99.9% 순은): × 1.0 (추후 지원)
   
3. 중량 곱하기
   - 예: 1g × 시세 × 0.925
```

#### 계산 예시
| 순도 | 시세 | 순도계수 | 중량 | 소재비 계산 | 결과 |
|------|------|----------|------|-------------|------|
| 925 | ₩10,000 | 0.925 | 1.2g | 10,000 × 0.925 × 1.2 | **₩11,100** |
| 925 | ₩12,500 | 0.925 | 2.0g | 12,500 × 0.925 × 2.0 | **₩23,125** |
| 999 | ₩10,000 | 1.0 | 1.0g | 10,000 × 1.0 × 1.0 | **₩10,000** |

#### ⚠️ 주의사항
```
[SILVER_CN_KRW_PER_G] ≠ [SILVER_KRW_PER_G]

- SILVER_CN_KRW_PER_G: 이미 1.2가 곱해진 중국 은시세 (사용!)
- SILVER_KRW_PER_G: 순수 국내 은시세 (직접 1.2를 곱해야 함)

★ 실제 사용: SILVER_CN_KRW_PER_G (이미 보정된 값)
```

---

### 2. 금 (Gold) 계산

#### 기본 공식
```
[최종 금가격] = [시세] × [순도계수] × [중량]
```

#### 상세 계산
```
1. 시세 가져오기
   - GOLD_KRW_PER_G (금 24K 기준 시세) 사용
   
2. 순도 계수 적용
   - 14K: × 0.6435 (58.5% 순금)
   - 18K: × 0.825 (75% 순금)
   - 24K: × 1.0 (99.9% 순금)
   
3. 중량 곱하기
   - 예: 1g × 시세 × 0.6435
```

#### 계산 예시
| 종류 | 순도 | 시세 | 순도계수 | 중량 | 소재비 계산 | 결과 |
|------|------|------|----------|------|-------------|------|
| 14K | 58.5% | ₩100,000 | 0.6435 | 1.0g | 100,000 × 0.6435 × 1.0 | **₩64,350** |
| 18K | 75% | ₩100,000 | 0.825 | 1.0g | 100,000 × 0.825 × 1.0 | **₩82,500** |
| 24K | 99.9% | ₩100,000 | 1.0 | 1.0g | 100,000 × 1.0 × 1.0 | **₩100,000** |

#### 순도 계수 상세
| K금 | 순도 | 계수 | 설명 |
|-----|------|------|------|
| 14K | 58.5% | 0.6435 | 가장 일반적인 실용 금 |
| 18K | 75.0% | 0.825 | 고급 주얼리용 |
| 24K | 99.9% | 1.0 | 순금 (투자/컬렉션) |

---

## 💰 총 금액 계산 (소재비 + 공임비)

### 공식
```
[총 판매금액] = [소재비] + [공임비]

여기서:
- 소재비 = 시세 × 순도계수 × 중량
- 공임비 = 10,000원 (예시) 또는 마스터 설정값
```

### 계산 예시들

#### 예시 1: 925 은 반지
```
조건:
- 순도: 925 (0.925)
- 중량: 1.2g
- 공임: 15,000원
- 은시세: ₩10,000/g

계산:
1. 소재비 = 10,000 × 0.925 × 1.2 = ₩11,100
2. 공임비 = ₩15,000
3. 총액 = ₩11,100 + ₩15,000 = ₩26,100
```

#### 예시 2: 14K 금 반지
```
조건:
- 순도: 14K (0.6435)
- 중량: 1.0g
- 공임: 20,000원
- 금시세: ₩100,000/g

계산:
1. 소재비 = 100,000 × 0.6435 × 1.0 = ₩64,350
2. 공임비 = ₩20,000
3. 총액 = ₩64,350 + ₩20,000 = ₩84,350
```

#### 예시 3: 18K 금 목걸이
```
조건:
- 순도: 18K (0.825)
- 중량: 3.5g
- 공임: 45,000원
- 금시세: ₩98,000/g

계산:
1. 소재비 = 98,000 × 0.825 × 3.5 = ₩282,975
2. 공임비 = ₩45,000
3. 총액 = ₩282,975 + ₩45,000 = ₩327,975
```

---

## 💳 결제 방식별 처리

### 현재 시스템의 결제 수단
```typescript
const paymentMethods = ["BANK", "CASH", "GOLD", "SILVER", "OFFSET"];
```

| 결제수단 | 설명 | 사용场景 |
|----------|------|----------|
| `BANK` | 계좌이체 | 일반적인 은행 송금 |
| `CASH` | 현금 | 현장 현금 결제 |
| `GOLD` | 금 실물 | 금 원자재 실물 전달 |
| `SILVER` | 은 실물 | 은 원자재 실물 전달 |
| `OFFSET` | 상계 | 미수금과 상계 처리 |

---

### 결제 방식별 시나리오

#### 시나리오 1: 일반 결제 (현금/계좌)
```
상품: 14K 반지 1g (총 ₩84,350)

결제:
- BANK: ₩84,350 (한 번에 계좌이체)

처리:
- cms_ar_ledger: +84,350 (미수 발생)
- cms_payment_line: BANK -84,350 (수금)
```

#### 시나리오 2: 원자재 결제 (금 실물 + 현금)
```
상품: 14K 반지 1g
- 소재비: ₩64,350 (금 0.6435g)
- 공임비: ₩20,000
- 총액: ₩84,350

결제:
- GOLD: ₩64,350 (금 0.6435g 실물 전달)
- CASH: ₩20,000 (공임 현금 결제)

처리:
1. 출고 시:
   - cms_ar_ledger: +84,350 (총액 미수 발생)
   
2. 수금 시:
   - cms_payment_line: GOLD -64,350 (금 실물 수령)
   - cms_payment_line: CASH -20,000 (현금 수령)
   
3. 재고 처리:
   - 금 재고: +0.6435g (입고)
```

#### 시나리오 3: 원자재 결제 (은 실물 + 계좌)
```
상품: 925 은 반지 1.2g
- 소재비: ₩11,100 (은 1.2g)
- 공임비: ₩15,000
- 총액: ₩26,100

결제:
- SILVER: ₩11,100 (은 1.2g 실물 전달)
- BANK: ₩15,000 (공임 계좌이체)

처리:
1. 출고 시:
   - cms_ar_ledger: +26,100 (총액 미수 발생)
   
2. 수금 시:
   - cms_payment_line: SILVER -11,100 (은 실물 수령)
   - cms_payment_line: BANK -15,000 (계좌 입금)
   
3. 재고 처리:
   - 은 재고: +1.2g (입고)
```

#### 시나리오 4: 복합 결제 (금 + 은 + 현금)
```
상품: 14K/925 믹스 제품
- 금 소재비: ₩64,350
- 은 소재비: ₩11,100
- 공임비: ₩20,000
- 총액: ₩95,450

결제:
- GOLD: ₩64,350 (금 실물)
- SILVER: ₩11,100 (은 실물)
- CASH: ₩20,000 (공임 현금)

처리:
- 3개 payment_line 생성
- 각각 재고 입고 처리
```

---

## 🗄️ 데이터베이스 구조

### 결제 관련 테이블

#### 1. `cms_payment_header` (수금 헤더)
```sql
CREATE TABLE cms_payment_header (
  payment_id UUID PRIMARY KEY,
  party_id UUID NOT NULL,                    -- 거래처
  paid_at TIMESTAMP NOT NULL,                -- 수금일시
  total_amount_krw INTEGER NOT NULL,         -- 총 수금액
  memo TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. `cms_payment_line` (수금 라인 - 결제수단별)
```sql
CREATE TABLE cms_payment_line (
  payment_line_id UUID PRIMARY KEY,
  payment_id UUID NOT NULL,                  -- 헤더 ID
  method VARCHAR(20) NOT NULL,               -- BANK/CASH/GOLD/SILVER/OFFSET
  amount_krw INTEGER NOT NULL,               -- 해당 수단의 금액
  meta JSONB,                                -- 추가 정보 (원자재 중량, 순도 등)
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 3. 원자재 결제 시 meta 정보 예시
```json
{
  "type": "GOLD",
  "purity": "14K",
  "purity_factor": 0.6435,
  "weight_g": 0.6435,
  "market_price_per_g": 100000,
  "calculated_amount": 64350,
  "description": "14K 금 0.6435g"
}
```

```json
{
  "type": "SILVER",
  "purity": "925",
  "purity_factor": 0.925,
  "weight_g": 1.2,
  "market_price_per_g": 10000,
  "calculated_amount": 11100,
  "description": "925 은 1.2g"
}
```

---

## 🔄 전체 프로세스 흐름도

### 원자재 결제 프로세스

```
[1. 주문]
   ↓
cms_order_line 생성
   ↓
[2. 출고]
   ↓
cms_shipment_line 생성
- 소재비 계산 (시세 × 순도 × 중량)
- 공임비 계산
- 총액 = 소재비 + 공임비
   ↓
cms_ar_ledger 생성 (+총액, 미수 발생)
   ↓
[3. 수금/결제]
   ↓
결제 방식 선택:
├─ 일반: BANK/CASH 한 번에
│     ↓
│   cms_payment_line (1건)
│
├─ 원자재: GOLD/SILVER + 현금
│     ↓
│   cms_payment_line (2건 이상)
│   ├─ method: GOLD, amount: 소재비, meta: 중량/순도
│   └─ method: CASH, amount: 공임비
│     ↓
│   [4. 원자재 입고]
│   재고관리 시스템 연동
│   ├─ 금 재고: +중량
│   └─ 은 재고: +중량
│
└─ 상계: OFFSET
      ↓
   기존 미수금과 상계
   
[5. 미수금 감소]
   ↓
cms_ar_ledger 생성 (-수금액)
   ↓
[완료] 잔액 0원
```

---

## 💻 구현 가이드 (개발자용)

### 1. 소재비 계산 함수
```typescript
interface MaterialPriceParams {
  materialType: 'GOLD' | 'SILVER';
  purity: string;           // '14K', '18K', '24K', '925', '999'
  weightG: number;          // 중량(g)
  marketPricePerG: number;  // 시세(원/g)
}

interface MaterialPriceResult {
  purityFactor: number;     // 순도 계수
  materialAmount: number;   // 소재비
  description: string;      // 설명
}

function calculateMaterialPrice(params: MaterialPriceParams): MaterialPriceResult {
  const { materialType, purity, weightG, marketPricePerG } = params;
  
  // 순도 계수 설정
  let purityFactor: number;
  
  if (materialType === 'GOLD') {
    switch (purity) {
      case '14K': purityFactor = 0.6435; break;
      case '18K': purityFactor = 0.825; break;
      case '24K': purityFactor = 1.0; break;
      default: throw new Error(`Unknown gold purity: ${purity}`);
    }
  } else if (materialType === 'SILVER') {
    switch (purity) {
      case '925': purityFactor = 0.925; break;
      case '999': purityFactor = 1.0; break;
      default: throw new Error(`Unknown silver purity: ${purity}`);
    }
  } else {
    throw new Error(`Unknown material type: ${materialType}`);
  }
  
  // 소재비 계산
  const materialAmount = Math.round(marketPricePerG * purityFactor * weightG);
  
  return {
    purityFactor,
    materialAmount,
    description: `${purity} ${materialType.toLowerCase()} ${weightG}g × ₩${marketPricePerG}`,
  };
}

// 사용 예시
const goldPrice = calculateMaterialPrice({
  materialType: 'GOLD',
  purity: '14K',
  weightG: 1.0,
  marketPricePerG: 100000,
});
// 결과: { purityFactor: 0.6435, materialAmount: 64350, ... }
```

### 2. 결제 분할 생성
```typescript
interface PaymentSplit {
  method: 'BANK' | 'CASH' | 'GOLD' | 'SILVER';
  amount: number;
  meta?: object;
}

function createMaterialPayment(
  totalAmount: number,
  materialAmount: number,
  materialType: 'GOLD' | 'SILVER',
  materialMeta: object
): PaymentSplit[] {
  const laborAmount = totalAmount - materialAmount;
  
  return [
    {
      method: materialType,
      amount: materialAmount,
      meta: materialMeta,
    },
    {
      method: 'CASH',  // 또는 BANK
      amount: laborAmount,
      meta: { type: 'labor' },
    },
  ];
}

// 사용 예시
const paymentLines = createMaterialPayment(
  84350,      // 총액
  64350,      // 소재비 (14K 1g)
  'GOLD',
  {
    purity: '14K',
    purity_factor: 0.6435,
    weight_g: 1.0,
    market_price: 100000,
  }
);
// 결과: [
//   { method: 'GOLD', amount: 64350, meta: {...} },
//   { method: 'CASH', amount: 20000, meta: {type: 'labor'} }
// ]
```

### 3. API 호출 예시
```typescript
// 수금 등록 (원자재 + 현금 복합)
const handlePayment = async () => {
  const payload = {
    p_party_id: 'party-123',
    p_paid_at: new Date().toISOString(),
    p_tenders: [
      {
        method: 'GOLD',
        amount: 64350,
        meta: JSON.stringify({
          purity: '14K',
          weight_g: 1.0,
          purity_factor: 0.6435,
        }),
      },
      {
        method: 'CASH',
        amount: 20000,
        meta: JSON.stringify({ type: 'labor' }),
      },
    ],
    p_memo: '금 0.6435g 실물 + 공임 현금',
  };
  
  await paymentMutation.mutateAsync(payload);
};
```

---

## 📋 체크리스트

### 주문/출고 시
- [ ] 제품의 소재 확인 (금/은/기타)
- [ ] 순도 확인 (14K/18K/24K/925)
- [ ] 중량 측정
- [ ] 현재 시세 확인 (cms_market_tick)
- [ ] 소재비 계산
- [ ] 공임비 확인
- [ ] 총액 계산 확인

### 결제 시
- [ ] 결제 방식 선택 (원자재 vs 현금)
- [ ] 원자재 결제 시: 중량/순도 정확히 입력
- [ ] 소재비 + 공임비 = 총액 일치 확인
- [ ] 금/은 실물 입고 처리 (재고관리)
- [ ] cms_payment_line meta 정보 기록

### 재고관리 연동
- [ ] 금 실물 수령 시: 금 재고 +중량
- [ ] 은 실물 수령 시: 은 재고 +중량
- [ ] 입고 내역과 결제 내역 매칭

---

## ⚠️ 주의사항 및 FAQ

### Q1: 금과 은을 동시에 결제받을 수 있나요?
**A**: 네, 가능합니다. 하나의 결제에 여러 개의 `cms_payment_line`을 생성하면 됩니다.
```
예: 금 0.6435g (₩64,350) + 은 1.2g (₩11,100) + 현금 ₩20,000
```

### Q2: 원자재 가격이 변동되면 어떻게 하나요?
**A**: 출고 시점의 시세로 계산됩니다. `cms_shipment_line`에 계산된 금액이 고정되어 저장되므로, 이후 시세 변동과 무관합니다.

### Q3: 순도가 14K인데 18K로 잘못 계산하면?
**A**: 출고 확정 전까지는 수정 가능합니다. 확정 후에는 반품/재출고로 처리해야 합니다.

### Q4: SILVER_CN_KRW_PER_G와 SILVER_KRW_PER_G의 차이는?
**A**: 
- `SILVER_CN_KRW_PER_G`: 이미 1.2가 곱해진 중국 은시세 (✅ 이 값 사용)
- `SILVER_KRW_PER_G`: 순수 시세 (❌ 직접 계산해야 함)

### Q5: 원자재 결제 시 세금계산서는 어떻게 처리?
**A**: 
- 소재비(금/은): 원자재 거래로 별도 세금처리
- 공임비: 용역/재화로 세금계산서 발행
- 별도 회계 처리 필요

---

## 🔗 연동 시스템

### 재고관리 시스템 연동
```
원자재 결제 발생
   ↓
cms_payment_line (method: GOLD/SILVER) 생성
   ↓
재고관리 시스템 API 호출
   ↓
금/은 재고 입고 처리 (+중량)
   ↓
입고내역 ↔ 결제내역 매칭 기록
```

### 회계 시스템 연동
```
원자재 결제
   ↓
별도 회계 처리
   ├─ 소재비: 원자재 매입으로 처리
   └─ 공임비: 매출로 처리
```

---

**문서 작성일**: 2026년 2월 2일  
**버전**: 1.0  
**작성자**: AI Assistant  
**검토 필요**: 개발팀, 회계팀, 영업팀
