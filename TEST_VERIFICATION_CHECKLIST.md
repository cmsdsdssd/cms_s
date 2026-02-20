# ✅ AR 공임 반영 수정 - 테스트 및 검증 체크리스트

## 📋 수정 내용 요약

**문제**: 출고 등록 시 공임(labor)이 AR(미수금)에 반영되지 않음
**원인**: `cms_fn_shipment_upsert_from_order_line` 함수가 `total_amount_sell_krw`를 업데이트하지 않음
**해결**: 함수에 `labor_total_sell_krw`와 `total_amount_sell_krw` 업데이트 로직 추가

---

## 🔍 검증 단계

### 1. DB 함수 수정 확인 ✅

**실행 쿼리:**
```sql
SELECT 
  proname as 함수명,
  prosrc::text LIKE '%labor_total_sell_krw%' as labor_컬럼_업데이트_포함,
  prosrc::text LIKE '%total_amount_sell_krw = COALESCE%' as total_계산_포함
FROM pg_proc
WHERE proname = 'cms_fn_shipment_upsert_from_order_line';
```

**기대 결과:**
- `labor_컬럼_업데이트_포함`: true
- `total_계산_포함`: true

---

### 2. 신규 출고 등록 테스트

**테스트 절차:**
1. 웹 앱에서 주문 선택
2. 중량 입력 (예: 10.5g)
3. 공임 입력 (예: 15,000원)
4. 저장 → 확인

**검증 SQL:**
```sql
SELECT 
  model_name,
  material_amount_sell_krw as 소재비,
  manual_labor_krw as 입력공임,
  labor_total_sell_krw as 저장된공임,
  total_amount_sell_krw as 총금액,
  (material_amount_sell_krw + labor_total_sell_krw) as 계산된총금액,
  CASE 
    WHEN total_amount_sell_krw = (material_amount_sell_krw + labor_total_sell_krw) 
    THEN '✅ PASS' 
    ELSE '❌ FAIL' 
  END as 검증
FROM cms_shipment_line
ORDER BY created_at DESC
LIMIT 1;
```

**기대 결과:**
- `저장된공임` = `입력공임` (15,000)
- `총금액` = `소재비` + `공임`
- 검증 컬럼 = '✅ PASS'

---

### 3. AR 생성 테스트

**테스트 절차:**
1. 출고 확정 (CONFIRMED 상태로 변경)
2. AR 자동 생성 확인

**검증 SQL:**
```sql
SELECT 
  ar.amount_krw as AR금액,
  sl.total_amount_sell_krw as 출고총금액,
  CASE 
    WHEN ar.amount_krw = sl.total_amount_sell_krw 
    THEN '✅ AR 정상 생성' 
    ELSE '❌ AR 금액 불일치' 
  END as 검증
FROM cms_ar_ledger ar
JOIN cms_shipment_line sl ON ar.shipment_line_id = sl.shipment_line_id
ORDER BY ar.created_at DESC
LIMIT 1;
```

**기대 결과:**
- `AR금액` = `출고총금액`
- 검증 컬럼 = '✅ AR 정상 생성'

---

### 4. 기존 데이터 보정 (필요시)

**누락 데이터 확인:**
```sql
SELECT COUNT(*) as 누락건수
FROM cms_shipment_line
WHERE (labor_total_sell_krw IS NULL OR labor_total_sell_krw = 0)
  AND manual_labor_krw > 0
  AND created_at >= '2026-02-02';
```

**보정 실행 (수동공임이 있지만 총공임이 없는 경우):**
```sql
UPDATE cms_shipment_line
SET 
  labor_total_sell_krw = manual_labor_krw,
  total_amount_sell_krw = COALESCE(material_amount_sell_krw, 0) + manual_labor_krw
WHERE (labor_total_sell_krw IS NULL OR labor_total_sell_krw = 0)
  AND manual_labor_krw > 0
  AND created_at >= '2026-02-02';
```

---

### 5. 통합 테스트 시나리오

| 시나리오 | 단계 | 기대 결과 |
|---------|------|----------|
| **신규 출고 등록** | 1. 주문 선택<br>2. 중량/공임 입력<br>3. 저장 | `total_amount_sell_krw`에 공임 포함 |
| **출고 확정** | 1. 출고 CONFIRMED로 변경<br>2. AR 자동 생성 | AR 금액 = 출고 총금액 (소재비+공임) |
| **AR 조회** | 미수금(AR) 화면 확인 | 금액이 올바르게 표시됨 |

---

## 🚨 주의사항

1. **마이그레이션 적용**: 반드시 `supabase db push`로 DB에 적용
2. **캐시 초기화**: Next.js 개발 서버 재시작 (Hot Reload 한계)
3. **로그 확인**: 브라우저 콘솔에서 `[Labor Update]` 로그 확인
4. **백업 권장**: 테스트 전 데이터 백업

---

## 📁 관련 파일

- `supabase/migrations/20260202091500_cms_0277_fix_shipment_upsert_labor.sql` - 함수 수정
- `supabase/migrations/20260202091501_cms_0278_test_ar_labor_fix.sql` - 테스트 스크립트
- `web/src/app/(app)/shipments/page.tsx` - 프론트엔드 (이중 안전장치)

---

## ✅ 최종 확인

- [ ] 마이그레이션 적용 완료
- [ ] 신규 출고 등록 테스트 PASS
- [ ] AR 생성 테스트 PASS
- [ ] 기존 누락 데이터 보정 (필요시)
- [ ] 실제 업무 테스트 완료

**수정 완료일**: 2026-02-02
**수정자**: AI Assistant
**승인 대기**: 사용자 테스트 후 최종 승인
