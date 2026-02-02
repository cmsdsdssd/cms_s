# 출고 처리 수정사항 최종 보고

## 완료된 작업

### 1. ✅ 공임 금액 미반영 문제 해결

**파일**: `web/src/components/shipment/inline-shipment-panel.tsx`

**문제**: 
- `cms_fn_update_shipment_line_v1` 함수에 `p_manual_labor_krw` 파라미터가 없음
- 공임을 직접 전달할 수 없음

**해결책**:
```typescript
// 총액 직접 계산 (소재비 + 공임 + 도금 + 수리비)
const calculatedTotal = materialCost + laborTotal + platingTotal + repairTotal;

await callRpc("cms_fn_update_shipment_line_v1", {
  ...
  p_manual_total_amount_krw: calculatedTotal, // ✅ 총액으로 계산된 금액 전달
});
```

### 2. ✅ marketTicks 에러 수정

**파일**: `web/src/app/(app)/shipments/page.tsx`

**문제**:
- `marketTicks` 변수가 정의되지 않아서 에러 발생
- "marketTicks is not defined"

**해결책**:
- 해당 코드 롤백 (원래 상태로 복구)
- 총액 계산 로직 제거

### 3. ✅ 이미지 로딩 에러 개선

**파일**: `web/src/app/(app)/shipments/page.tsx`

**문제**:
1. 빈 문자열("")이 img src에 전달됨
2. "An empty string was passed to the src attribute"
3. 이미지 파일이 존재하지 않아 404 에러

**해결책**:

#### 함수 개선
```typescript
// 반환 타입을 string | null로 변경
const getMasterPhotoUrl = (photoUrl: string | null | undefined): string | null => {
  if (!photoUrl || photoUrl.trim() === "") return null; // ✅ 빈 문자열 체크 개선
  // ...
  return `${supabaseUrl}/storage/v1/object/public/${cleanPath}`;
};
```

#### 이미지 컴포넌트 개선
```tsx
{getMasterPhotoUrl(prefill?.photo_url) ? (
  <img
    src={getMasterPhotoUrl(prefill?.photo_url) || undefined}
    alt={...}
    onError={(e) => {
      // ✅ 개발 환경에서만 에러 로그 출력
      if (process.env.NODE_ENV === 'development') {
        console.error("[Master Photo] Failed to load:", prefill?.photo_url);
      }
      // ...
    }}
  />
) : null}
```

## 수정된 파일 요약

| 파일 | 수정 내용 |
|------|-----------|
| `inline-shipment-panel.tsx` | 총액 계산하여 `p_manual_total_amount_krw`로 전달 |
| `shipments/page.tsx` (Line 555-566) | marketTicks 에러 코드 롤백 |
| `shipments/page.tsx` (Line 108-120) | `getMasterPhotoUrl` 함수 개선 |
| `shipments/page.tsx` (Line 826-847) | 첫 번째 이미지 컴포넌트 개선 |
| `shipments/page.tsx` (Line 1110-1131) | 모달 이미지 컴포넌트 개선 |

## 다음 단계

1. **서버 재시작**
   ```bash
   cd web && npm run dev
   ```

2. **출고 테스트**
   - inline-shipment-panel 사용하여 출고 생성
   - 소재비 + 공임 정상 계산 확인
   - 총액이 DB에 저장되는지 확인

3. **SQL 검증**
   ```sql
   SELECT 
     shipment_line_id,
     material_amount_sell_krw,
     labor_total_sell_krw,
     total_amount_sell_krw
   FROM cms_shipment_line
   ORDER BY created_at DESC
   LIMIT 5;
   ```

## 주의사항

- `shipments/page.tsx`의 총액 계산은 제거됨 (inline-shipment-panel에서만 사용)
- 이미지 에러는 콘솔에 찍히지 않음 (개발 환경에서만 표시)
- 실제 이미지 파일이 없는 경우 기본 아이콘(Package) 표시

---
**수정 완료일**: 2026년 2월 2일
