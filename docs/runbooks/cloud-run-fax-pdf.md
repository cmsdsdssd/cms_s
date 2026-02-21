# Cloud Run 배포 런북 (U+ PDF 인쇄 전송)

## 1) 개요

- 서비스: Next.js(`web`) + `/api/fax-pdf`
- 리전: `asia-northeast3` (Seoul)
- 목적: `uplus_print`를 Cloudflare PDF 기반 인쇄 전송으로 운영

## 2) 필수 시크릿/환경변수

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (Secret Manager 권장)
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` (Secret Manager 권장)
- `TZ=Asia/Seoul`

## 3) 권장 Cloud Run 설정

- Region: `asia-northeast3`
- Request timeout: `600s`
- Container port: `8080`
- Concurrency: 40 (초기값)
- Memory: 1Gi (초기값)
- CPU: 1 vCPU (초기값)

## 4) 배포 절차

1. 이미지 빌드/푸시
2. Cloud Run 서비스 업데이트 (리전/타임아웃/시크릿 주입 포함)
3. 스모크 테스트
   - `GET /` 정상
   - `POST /api/fax-pdf` 정상/오류 분기 확인

## 5) 스모크 테스트 체크

- 정상:
  - `success=true`
  - `pdf.signed_url` 반환
  - `pdf.expires_in=600`
- 오류:
  - 429 또는 5xx에서 `action=fallback_print_html` 반환

## 6) 장애 대응

- Cloudflare 429/5xx 증가 시:
  - UI 폴백(HTML 인쇄)으로 업무 지속
  - Cloudflare 토큰/요금제/쿼터 확인
- signed URL 생성 실패:
  - Supabase bucket 권한/경로/서비스키 확인
