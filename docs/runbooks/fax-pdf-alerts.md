# Fax PDF 알람 운영 가이드

## 관측 이벤트

- `fax_pdf_created`
  - 필드: `po_id`, `vendor_prefix`, `cf_ray`, `duration_ms`, `size_bytes`
- `fax_pdf_failed`
  - 필드: `error_code`, `cf_ray`, `duration_ms`, `details`

## 권장 알람 룰

1. `CF_429` 급증
   - 조건: 5분 내 `fax_pdf_failed(error_code=CF_429)` 임계치 초과
2. `CF_5XX` 에러율 초과
   - 조건: 5분 window 에러율 > 기준치
3. signed URL 실패
   - 조건: `fax_pdf_failed`에서 signed URL 관련 오류 문자열 감지

## 대응 우선순위

1. 업무 연속성 확보: 사용자에게 HTML 인쇄 폴백 안내 유지
2. Cloudflare 측 상태/제한 확인
3. Supabase Storage 권한/버킷 상태 확인
4. 장애 종료 후 샘플 PO 재검증
