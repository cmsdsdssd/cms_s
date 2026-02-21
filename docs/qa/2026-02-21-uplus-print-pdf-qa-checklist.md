# U+ PDF 인쇄전송 QA 체크리스트 (2026-02-21)

## Acceptance 매핑

| 항목 | 검증 절차 | 기대 결과 | 증적 |
|---|---|---|---|
| Cloud Run(서울) 정상 동작 | 서비스 URL 접속 + API health 확인 | 정상 응답 | 스크린샷/로그 |
| uplus_print 선택 시 PDF 탭 오픈 | 위저드에서 uplus_print 공장으로 발주 생성 + 전송 | 새 탭에 PDF 열림 | 스크린샷 |
| U+ 간편팩스 인쇄 가능 | PDF에서 Ctrl+P 후 `LGUplusBizWebFax` 선택 | U+ 전송 절차 진행 가능 | 스크린샷 |
| PDF 실패시 HTML 폴백 | Cloudflare 오류 유도(토큰 오류/429 시뮬) | HTML 인쇄 창으로 폴백 | 스크린샷 |
| 수동확정 시 SENT 반영 | Confirm에서 전송완료처리 클릭 | 상태 `SENT_TO_VENDOR` 반영 | DB/화면 캡처 |

## 수동 시나리오

1. 정상 경로
   - 공장 선택 -> 전송 처리
   - PDF 오픈 확인
   - U+ 전송 후 전송완료처리

2. 실패 폴백 경로
   - `/api/fax-pdf` 실패 상황 유도
   - HTML 인쇄 폴백 토스트 확인
   - 수동확정 완료

3. 재열기/추적
   - Confirm 카드에서 `PDF 다시 열기` 버튼 동작 확인
   - DB에 `fax_payload_url` 기록 확인
