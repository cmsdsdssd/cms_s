# PRD: Cloud Run(서울) + Cloudflare Browser Rendering `/pdf` + U+웹팩스(간편팩스) **인쇄 발송** 워크플로

문서 버전: v1.1 (U+ 인쇄 기반으로 개정)

작성일: 2026-02-20 (Asia/Seoul)

대상 독자: 코딩 에이전트(구현), 서비스 오너(검수/운영)

레포 기준 루트: `cms_s-main/web` (Next.js App Router)

---

## 0) 한 줄 요약

- **웹/API는 Cloud Run(서울, `asia-northeast3`)에서 운영**한다. (Cloud Run Locations: https://docs.cloud.google.com/run/docs/locations)
- **팩스 발송은 ‘U+웹팩스 간편팩스’의 프린터 드라이버로 인쇄해서 전송**한다. (간편팩스 안내: https://webfax.uplus.co.kr/customer-service/detailOfSimpleFax)
  - 문서에서 ‘인쇄’ 버튼을 누르고, 프린터 드라이버명을 **`LGUplusBizWebFax`**로 선택
- **인쇄 품질/일관성을 위해 HTML→PDF는 Cloudflare Browser Rendering `/pdf`로 생성**하고, 사용자는 생성된 PDF를 열어 ‘인쇄’로 U+ 팩스 전송을 수행한다.
  - `/pdf` 엔드포인트: https://developers.cloudflare.com/browser-rendering/rest-api/pdf-endpoint/
  - PDF 생성 가이드(REST API vs Bindings): https://developers.cloudflare.com/browser-rendering/how-to/pdf-generation/

---

## 1) 배경

현재 프로젝트에는 팩스 발송 라우트가 존재하며(`web/src/app/api/fax-send/route.ts`), provider가 `uplus_print`인 경우 “서버에서 발송”이 아니라 “사용자 인쇄 기반 전송”으로 처리하는 흐름이 UI에 일부 존재한다.

사용자는 실제로 **U+팩스(간편팩스)**를 사용 중이며, **인쇄(프린트)에서 팩스를 전송**한다.

U+웹팩스의 간편팩스는 PC 문서(워드/한글/PDF 등)에서 **인쇄 버튼만 클릭하면 팩스로 발송**하는 방식이며, 프린터 설정 화면에서 프린터 드라이버명을 **`LGUplusBizWebFax`로 선택**하도록 안내한다.
- 참고: https://webfax.uplus.co.kr/customer-service/detailOfSimpleFax

따라서 본 PRD는 “팩스 자동발송 API”가 아니라, **‘팩스용 문서(PDF) 생성 + 인쇄 전송 + 수동 전송완료 확정’**을 안정적으로 구현하는 것을 목표로 한다.

---

## 2) 목표(Goals)

### 2.1 P0(필수)

1. **Cloud Run(서울, `asia-northeast3`)**에 Next.js 웹/API를 컨테이너로 배포하고 운영한다.
2. `uplus_print` 워크플로에서 **HTML을 바로 print()하는 방식 대신, Cloudflare `/pdf`로 PDF를 생성해 인쇄 품질을 표준화**한다.
3. 생성된 PDF는 사용자가 **브라우저에서 열고 인쇄(프린트)하여 U+ 간편팩스로 발송**할 수 있어야 한다.
4. U+ 인쇄전송은 서버가 “발송 성공 여부”를 알 수 없으므로, UI에서 **전송 완료 수동확정 버튼**을 제공하고, 확정 시 기존 RPC(예: `cms_fn_factory_po_mark_sent`)로 상태를 업데이트한다.
5. PDF 생성 실패 시에도 업무가 멈추지 않도록 **폴백(HTML 인쇄 뷰)**를 제공한다.

### 2.2 P1(권장)

- PDF 생성 결과를 Supabase Storage에 저장하여 **감사/재인쇄/재전송**이 가능하도록 한다.
- 동시 클릭/중복 생성 방지를 위한 **idempotency 키** 및 “동일 PO에 대한 최신 PDF 재사용” 정책을 도입한다.
- 운영 관측성(로깅/에러 코드/경보)을 표준화한다.

---

## 3) 비목표(Non-goals)

- U+웹팩스의 “기업연동(호스트) API/웹 API”를 통한 완전 자동 발송 구현은 이번 범위에서 제외한다.
  - 단, U+웹팩스는 ERP/그룹웨어 등 내부 시스템 연동을 위한 “클라이언트 API(호스트형)” 제공을 안내하고 있어, 향후 확장 가능하다.
  - 참고:
    - https://webfax.uplus.co.kr/tips/html/tip/services_link_tab.html
    - https://webfax.uplus.co.kr/join/joinGuide

---

## 4) 사용자 스토리(User Stories)

1. (발주 담당자) 공장을 선택하고 “발주 생성 + 전송 처리”를 누르면, `uplus_print` 공장은 **PO 생성 후 PDF가 자동 생성되어 새 탭으로 열린다**.
2. (발주 담당자) PDF 탭에서 **인쇄(Ctrl+P)**를 눌러 프린터를 **`LGUplusBizWebFax`**로 선택해 팩스를 보낸다.
3. (발주 담당자) U+ 전송이 완료되면 CMS에서 “전송 완료 처리” 버튼을 눌러 **주문 상태를 SENT로 확정**한다.
4. (운영자) Cloudflare `/pdf` 장애(429/5xx) 시에도 HTML 폴백 인쇄로 업무를 계속 진행할 수 있다.

---

## 5) 아키텍처

### 5.1 런타임/플랫폼

- **Cloud Run**: Next.js 서버(SSR+API) 운영
  - 리전: `asia-northeast3` (Seoul)
  - HTTP/1 서버일 경우 요청/응답 크기 제한: **32MiB**
    - 참고: https://docs.cloud.google.com/run/quotas
  - 요청 타임아웃: 기본 5분, 최대 60분까지 설정 가능
    - 참고: https://docs.cloud.google.com/run/docs/configuring/request-timeout

- **Cloudflare Browser Rendering**: `/pdf` REST API로 HTML → PDF 생성
  - 참고: https://developers.cloudflare.com/browser-rendering/rest-api/pdf-endpoint/

- **Supabase**: DB/RPC/Storage 유지

### 5.2 핵심 설계 원칙

- **PDF 생성은 서버에서 크롬(Playwright)을 띄우지 않는다.** → Cloudflare `/pdf`로 위임
- “U+ 발송 성공”은 서버가 검증 불가 → **사용자 확인(수동확정) 기반**
- PDF 생성 실패 시에도 “발송 업무”를 막지 않도록 **HTML 인쇄 폴백** 제공

---

## 6) UX/플로우 상세

### 6.1 기존 UI 파일

- 팩스/발주 위저드: `web/src/components/factory-order/factory-order-wizard.tsx`
  - 현재 `uplus_print`일 때 `window.open()` + HTML `document.write()` + `print()`가 존재
  - 본 PRD에서는 “HTML 직접 print”를 **폴백으로 강등**하고, 기본은 **PDF 생성 → PDF 열기**로 변경

### 6.2 새 플로우(권장)

#### Step A) PO 생성
- 기존처럼 RPC `factoryPoCreate`를 호출하여 PO 생성

#### Step B) PDF 생성
- 새 API 호출: `POST /api/fax-pdf` (또는 기존 `/api/fax-send`를 확장)
- 입력: `{ po_id, vendor_prefix, vendor_name, line_count, html_content, mode: "uplus_print" }`
- 출력:
  - 옵션 1(권장): `{ pdf_signed_url, pdf_path, sha256, created_at }`
  - 옵션 2: `application/pdf` 바이너리

#### Step C) PDF 오픈 및 인쇄
- 브라우저는 `pdf_signed_url`을 새 탭으로 열고, 사용자는 Ctrl+P
- 프린터 선택에서 `LGUplusBizWebFax` 선택하여 U+ 간편팩스로 발송

#### Step D) 전송 완료 수동확정
- 기존처럼 `factoryPoMarkSent` RPC를 호출하되, provider는 `uplus_print`로 기록
- `provider_message_id`는 선택(사용자가 U+ 발송번호를 입력할 경우만 저장)

#### Step E) 폴백
- Cloudflare PDF 생성 실패 시:
  - 기존 `handleUplusPrint(group)`(HTML print)를 실행
  - 화면에 “PDF 생성 실패 → HTML 인쇄로 진행” 안내

---

## 7) API 설계

### 7.1 `POST /api/fax-pdf` (신규 권장)

**목적**: U+ 인쇄전송을 위한 “팩스용 PDF” 생성

- Path: `web/src/app/api/fax-pdf/route.ts`
- Auth: 내부 사용자(기존 미들웨어) 전제. (외부 공개 필요 없음)

#### Request
```json
{
  "po_id": "uuid",
  "vendor_prefix": "ULW",
  "vendor_name": "...",
  "line_count": 12,
  "html_content": "<html>...",
  "mode": "uplus_print"
}
```

#### Response (권장)
```json
{
  "success": true,
  "po_id": "uuid",
  "pdf": {
    "path": "factory-pos/<po_id>/fax-uplus-<timestamp>.pdf",
    "signed_url": "https://...",
    "sha256": "...",
    "expires_in": 600
  }
}
```

#### 실패 응답
- `429`(Cloudflare 사용량/한도):
  - `error_code: "CF_429"`
  - `action: "fallback_print_html"`
- `5xx`/네트워크 오류: 1회 재시도 후 실패


### 7.2 `POST /api/fax-send` (기존 유지, 단 기능 축소 권장)

현재 `web/src/app/api/fax-send/route.ts`는 다양한 provider를 지원하며 `uplus_print`는 400으로 막혀있다.

본 PRD 적용 후 정책:
- `uplus_print`는 `/api/fax-send`를 사용하지 않고, **반드시 `/api/fax-pdf`**로만 문서 생성
- `/api/fax-send`는 향후 자동 발송 provider(apiplex 등)를 유지할지 여부를 선택

---

## 8) Cloudflare `/pdf` 통합 스펙

### 8.1 엔드포인트
- `https://api.cloudflare.com/client/v4/accounts/<accountId>/browser-rendering/pdf`

### 8.2 입력
- `html` 또는 `url` 중 하나 필수

### 8.3 권장 옵션
- `gotoOptions.waitUntil = "networkidle2"`
- `gotoOptions.timeout = 60000`
- `pdfOptions.format = "A4"`
- `pdfOptions.printBackground = true`
- `pdfOptions.preferCSSPageSize = true`

### 8.4 선택 이유
Cloudflare 문서에서도 PDF 생성은 REST API `/pdf`로 가능하며, 추가 커스터마이징이 필요하면 Workers Bindings 기반(Puppeteer/Playwright) 방식을 제시한다.

본 PRD는 **REST API 방식**을 기본으로 채택한다(설치/번들/런타임 리스크 최소화).

---

## 9) 구현 상세(코딩 에이전트용)

### 9.1 신규 모듈

#### `web/src/lib/pdf/cloudflare-pdf.ts`
- `renderPdfFromHtml(html: string, opts): Promise<Buffer>`
- 책임:
  - Cloudflare `/pdf` 호출
  - (필수) 타임아웃 + 1회 재시도(네트워크/5xx만)
  - (필수) 429는 재시도 금지
  - (필수) 응답 헤더의 `cf-ray`를 로그 메타에 포함

### 9.2 신규 API 라우트

#### `web/src/app/api/fax-pdf/route.ts`
- 입력 검증: `po_id`, `html_content` 필수
- PDF 생성:
  - `Buffer pdf = await renderPdfFromHtml(html_content)`
- (P1) Supabase Storage 업로드:
  - bucket 후보: 기존 `factory-orders` 또는 `receipts`
  - path 규칙: `factory-pos/<po_id>/fax-uplus-<YYYYMMDD-HHmmss>.pdf`
  - contentType: `application/pdf`
- signed URL 생성:
  - 만료: 10분(600s)

### 9.3 UI 변경

파일: `web/src/components/factory-order/factory-order-wizard.tsx`

#### 변경 포인트
1) `handleSendFax`에서 `uplus_print` 그룹 처리
- 현재: pendingManualConfirm만 추가하고 끝
- 변경: PO 생성 후 `POST /api/fax-pdf` 호출 → URL 반환 → `window.open(url)`
- 실패 시: 기존 `handleUplusPrint(group)` 호출(HTML 인쇄 폴백)

2) `handleUplusPrint`
- 역할 변경: “폴백 전용(HTML 인쇄)”
- 안내 문구 업데이트:
  - 프린터 선택: `LGUplusBizWebFax`

3) Confirm 단계의 수동확정(`handleManualConfirm`)
- 그대로 유지
- 단, `payload_url`에 **PDF 저장 경로/URL**을 포함하도록 개선(P1)

---

## 10) 배포(Cloud Run) 스펙

### 10.1 Cloud Run 리전
- `asia-northeast3` (Seoul)

### 10.2 제한/설정
- HTTP/1 요청 크기 제한: 32MiB (업로드 20MB는 통과)
  - https://docs.cloud.google.com/run/quotas
- 타임아웃: 기본 5분 → PDF 생성 포함 라우트는 10분 권장(최대 60분 가능)
  - https://docs.cloud.google.com/run/docs/configuring/request-timeout

### 10.3 환경변수
- `TZ=Asia/Seoul` (날짜 표기 일관성)

### 10.4 시크릿
- Cloudflare API Token은 Secret Manager로 주입

---

## 11) 보안/컴플라이언스

- Cloudflare API Token은 서버 전용(클라이언트 노출 금지)
- HTML 내용(발주서)은 로그에 원문 저장 금지(PII/거래정보 가능)
- signed URL은 짧게(10분) + 필요 시 재발급

---

## 12) 테스트 계획

### 12.1 유닛 테스트
- `renderPdfFromHtml`:
  - 정상 PDF Buffer 반환
  - 429/5xx/timeout 분기

### 12.2 통합 테스트(스테이징)
- `uplus_print` 공장 1개 선택 → PO 생성 → PDF 생성 → URL 오픈 확인
- Cloudflare 토큰/계정 오류 시: 폴백 HTML 인쇄로 이어지는지 확인

### 12.3 수동 QA 체크리스트
- Windows/사내 PC에 U+ 간편팩스 설치
- 인쇄 시 프린터 목록에 `LGUplusBizWebFax`가 보이는지
- PDF 인쇄 레이아웃(A4, 줄바꿈, 한글 폰트) 깨짐 여부

---

## 13) 수용 기준(Acceptance Criteria)

- [ ] Cloud Run(서울)에서 웹/API가 정상 동작
- [ ] `uplus_print` 선택 시 PO 생성 후 PDF가 생성되어 새 탭에서 열림
- [ ] PDF를 인쇄하여 U+ 간편팩스로 발송 가능(프린터 `LGUplusBizWebFax`)
- [ ] PDF 생성 실패 시 HTML 인쇄 폴백으로 업무가 중단되지 않음
- [ ] 수동확정 시 PO 상태가 `SENT_TO_VENDOR`로 업데이트

---

## 14) 향후 확장(선택)

### 14.1 U+웹팩스 API 연동(완전자동)
U+웹팩스는 내부 시스템 연동을 위한 “클라이언트 API(호스트형, JAVA 기반)” 제공을 안내한다.

- 참고:
  - https://webfax.uplus.co.kr/tips/html/tip/services_link_tab.html
  - https://webfax.uplus.co.kr/join/joinGuide

도입 시 장점: 사용자 인쇄/수동확정 없이 시스템에서 자동 발송 가능

---

## 15) 구현 티켓(P0/P1)

### P0
1. [BE] `cloudflare-pdf.ts` 구현(타임아웃/재시도/에러코드)
2. [BE] `POST /api/fax-pdf` 구현(PDF 생성 + signed url 반환)
3. [FE] `factory-order-wizard.tsx`에서 `uplus_print` → `/api/fax-pdf` 호출 + 새 탭 오픈
4. [FE] 폴백: PDF 실패 시 기존 HTML print 실행
5. [DevOps] Cloud Run Dockerfile/배포 파이프라인 구축

### P1
1. [BE] PDF를 Supabase Storage에 저장 + 경로를 `payload_url`로 남김
2. [FE] Confirm 화면에 “PDF 다시 열기/재인쇄” 버튼 제공
3. [Ops] Cloud Run 로그 기반 알람(Cloudflare 429, PDF fail)

