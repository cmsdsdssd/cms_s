# 출고 원가 시스템 구현 - 정석 순서

## 📋 실행 순서 (정석대로)

### Step 1: DB 스키마 변경 (DDL)
**파일**: `06_implement_cost_system.sql` (Line 1-25)
- 컬럼 추가
- 인덱스 생성

### Step 2: 함수 생성 (DQL/DML)
**파일**: `06_implement_cost_system.sql` (Line 28-143)
- extract_cost_from_receipt()
- get_master_pricing()
- calculate_shipment_price()

### Step 3: 통합 프로시저 생성
**파일**: `06_implement_cost_system.sql` (Line 146-267)
- confirm_shipment_with_cost_v1()

### Step 4: 기존 데이터 마이그레이션
**파일**: `06_implement_cost_system.sql` (Line 270-290)
- NULL 값 채우기

### Step 5: 프론트엔드 수정
- API 호출 변경
- UI에 원가/마진 표시

---

## ✅ Step 1 실행: DB 스키마 변경

```sql
-- Supabase SQL Editor에서 실행
-- 파일: web/sql/06_implement_cost_system.sql 의 1-25라인

-- 1.1 컬럼 추가
ALTER TABLE cms_shipment_line 
ADD COLUMN IF NOT EXISTS actual_cost_krw INTEGER,
ADD COLUMN IF NOT EXISTS actual_material_cost_krw INTEGER,
ADD COLUMN IF NOT EXISTS actual_labor_cost_krw INTEGER,
ADD COLUMN IF NOT EXISTS cost_note TEXT,
ADD COLUMN IF NOT EXISTS receipt_id UUID REFERENCES cms_receipt_inbox(receipt_id);

-- 1.2 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_shipment_line_receipt_id ON cms_shipment_line(receipt_id);
CREATE INDEX IF NOT EXISTS idx_shipment_line_actual_cost ON cms_shipment_line(actual_cost_krw);
```

**이 SQL을 지금 실행해주세요!**

---

## 다음 단계 (Step 1 완료 후)

Step 1 실행 결과가 "Success"면 Step 2 (함수 생성) 진행하겠습니다.

**지금 실행하고 결과 알려주세요** 🚀
