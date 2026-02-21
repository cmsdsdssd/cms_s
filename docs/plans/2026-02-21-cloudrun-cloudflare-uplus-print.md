# Cloud Run + Cloudflare PDF + Uplus Print Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `uplus_print` 발주 전송을 "HTML 직접 인쇄"에서 "Cloudflare `/pdf` 생성 후 인쇄" 중심으로 전환하고, 실패 시 HTML 폴백 및 수동 전송확정까지 안정적으로 운영한다.

**Architecture:** Next.js(App Router) API가 Cloudflare Browser Rendering REST `/pdf`를 호출해 PDF를 생성한다. 생성 PDF는 Supabase Storage에 저장하고 signed URL(10분)로 사용자 탭에서 오픈한다. 사용자는 `LGUplusBizWebFax` 프린터로 전송하고, CMS는 수동확정 RPC로 최종 상태를 기록한다.

**Tech Stack:** Next.js 16(App Router), React 19, Supabase(Storage/RPC), Cloudflare Browser Rendering REST API, Cloud Run(asia-northeast3), Node runtime.

---

## Task 1: 현재 플로우 고정점 점검 (회귀 기준선 확보)

**Files:**
- Modify: 없음 (읽기/검증만)
- Reference: `web/src/components/factory-order/factory-order-wizard.tsx`, `web/src/app/api/fax-send/route.ts`, `docs/260221/PRD_CloudRun_CloudflarePDF_UplusPrint.md`

**Step 1: 기존 동작/제약 확인**
- `uplus_print`가 현재 `handleSendFax`에서 `pendingManualConfirm`만 남기고 서버 전송을 건너뛰는 점 확인
- `/api/fax-send`가 `uplus_print` 요청을 `400`으로 차단하는 점 확인

**Step 2: 기준선 빌드 확인**
- Run: `npm run build`
- Workdir: `web`
- Expected: `next build` 성공 (0 exit)

**Step 3: 기준선 기록**
- `FACTORY_ORDER_TEST_CHECKLIST.md`에 "변경 전 동작" 체크 항목 추가 (옵션)

---

## Task 2: Cloudflare PDF 클라이언트 모듈 구현

**Files:**
- Create: `web/src/lib/pdf/cloudflare-pdf.ts`
- Optional Create: `web/src/lib/pdf/cloudflare-pdf.types.ts`

**Step 1: 실패 테스트(스펙) 먼저 작성**
- Create: `web/src/lib/pdf/cloudflare-pdf.spec.md` (실행 테스트가 아닌 명시 스펙)
- 포함 케이스:
  - 200 + `application/pdf` => Buffer 반환
  - 429 => 즉시 `CF_429` 에러(재시도 금지)
  - 5xx/네트워크 => 1회 재시도 후 실패
  - 타임아웃(60s) => `CF_TIMEOUT`

**Step 2: 최소 구현 작성**
- 함수 시그니처:
  - `renderPdfFromHtml(html: string, opts?: { requestId?: string }): Promise<{ pdf: Buffer; cfRay?: string }>`
- 필수 동작:
  - `POST https://api.cloudflare.com/client/v4/accounts/<accountId>/browser-rendering/pdf`
  - 헤더: `Authorization: Bearer <token>`, `Content-Type: application/json`
  - body: `html`, `gotoOptions`, `pdfOptions` (PRD 권장값)
  - `AbortController` 기반 타임아웃
  - 429 재시도 금지, 5xx/네트워크만 단 1회 재시도
  - `cf-ray` 응답헤더 추출

**Step 3: 에러 모델 정형화**
- 에러코드 enum 제안:
  - `CF_429`, `CF_5XX`, `CF_TIMEOUT`, `CF_NETWORK`, `CF_BAD_RESPONSE`
- API 라우트가 분기하기 쉽도록 구조화된 `PdfRenderError` 사용

**Step 4: 정적 점검**
- Run: `npx tsc --noEmit`
- Workdir: `web`
- Expected: 타입 에러 0

---

## Task 3: `/api/fax-pdf` 신규 라우트 구현

**Files:**
- Create: `web/src/app/api/fax-pdf/route.ts`
- Reference: `web/src/app/api/fax-send/route.ts`

**Step 1: 요청 검증 구현**
- 필수 입력: `po_id`, `html_content`, `mode === "uplus_print"`
- 선택 입력: `vendor_prefix`, `vendor_name`, `line_count`
- 잘못된 요청은 `400` + 명시적 오류코드 반환

**Step 2: PDF 생성 + 저장 구현**
- `renderPdfFromHtml` 호출
- Supabase Storage 업로드:
  - 버킷 우선순위: `factory-orders` -> 실패 시 `receipts`
  - path: `factory-pos/<po_id>/fax-uplus-<YYYYMMDD-HHmmss>.pdf`
  - contentType: `application/pdf`

**Step 3: Signed URL 발급 구현**
- 만료: 600초
- 응답 형식:
  - `success`, `po_id`, `pdf.path`, `pdf.signed_url`, `pdf.sha256`, `pdf.expires_in`

**Step 4: 오류/폴백 신호 표준화**
- 429: HTTP 429 + `{ error_code: "CF_429", action: "fallback_print_html" }`
- 5xx/timeout/network: HTTP 502 또는 504 + 동일 `action`
- 로그 메타: `po_id`, `vendor_prefix`, `cf_ray`, `error_code`, `latency_ms`
- 금지: `html_content` 원문 로깅

**Step 5: API 스모크 검증**
- Run: `npm run dev`
- Workdir: `web`
- curl/Postman으로 정상/오류 케이스 수동 검증

---

## Task 4: `factory-order-wizard`의 `uplus_print` 주 경로 전환

**Files:**
- Modify: `web/src/components/factory-order/factory-order-wizard.tsx`

**Step 1: 전송 분기 재구성**
- `handleSendFax` 내 `uplus_print` 분기에서:
  - 기존: `pendingManualConfirm`만 등록
  - 변경: PO 생성 직후 `/api/fax-pdf` 호출 -> 성공 시 `window.open(signed_url)`

**Step 2: 폴백 경로 연결**
- `/api/fax-pdf` 실패(429/5xx/timeout/JSON parse 실패) 시:
  - 즉시 `handleUplusPrint(group)` 호출
  - 토스트: "PDF 생성 실패 -> HTML 인쇄 폴백 진행"

**Step 3: 안내 문구 정합화**
- 프린터명 안내를 `LGUplusBizWebFax`로 통일
- 확인 단계(`confirm`)에 "PDF 다시 열기" 버튼 자리 확보 (P1 선반영 가능)

**Step 4: 수동확정 payload 개선**
- `handleManualConfirm`의 `payload_url`에 저장된 `pdf_path` 또는 URL 반영
- `provider_message_id`는 기존처럼 옵션 입력 유지

---

## Task 5: `/api/fax-send` 역할 축소 및 안전장치 정리

**Files:**
- Modify: `web/src/app/api/fax-send/route.ts`

**Step 1: 정책 고정**
- `uplus_print`는 계속 400으로 차단 유지
- 에러 메시지에 "`/api/fax-pdf` 사용" 명시

**Step 2: 불필요 결합 제거**
- `uplus_print` 경로에서 사용되지 않는 로직/문구 정리
- 가능하면 PDF 렌더링 책임은 `fax-pdf`로 단일화

**Step 3: 회귀 리스크 최소화**
- 기존 provider(`mock`, `apiplex`) 동작은 변경하지 않음

---

## Task 6: 환경변수/시크릿/런타임 구성

**Files:**
- Create: `web/.env.example` (없다면)
- Create: `web/src/lib/pdf/cloudflare-env.ts` (선택)
- Modify: `docs/260221/PRD_CloudRun_CloudflarePDF_UplusPrint.md` (실제값 제외, 키 목록만)

**Step 1: 필수 키 정의**
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `TZ=Asia/Seoul`

**Step 2: 시크릿 주입 원칙 고정**
- 클라이언트 번들 노출 금지 (`NEXT_PUBLIC_` 금지)
- Cloud Run에 Secret Manager 연동으로 주입

**Step 3: 운영 문서화**
- 키 누락 시 앱이 반환할 에러 형식과 운영 대응 절차 기록

---

## Task 7: Cloud Run 배포 파이프라인 구축 (서울 리전)

**Files:**
- Create: `web/Dockerfile`
- Create: `web/.dockerignore`
- Create: `docs/runbooks/cloud-run-fax-pdf.md`
- Optional Create: `scripts/deploy-cloud-run-fax-pdf.sh`

**Step 1: 컨테이너 이미지 정의**
- Next.js production build + `next start` 실행 이미지 작성
- Node 버전은 현재 프로젝트 호환 버전으로 고정

**Step 2: 서비스 배포 스펙 정의**
- 리전: `asia-northeast3`
- 요청 타임아웃: `600s` (PDF 라우트 반영)
- 동시성/메모리/CPU 초기값 문서화

**Step 3: 배포 검증**
- 헬스체크 및 `/api/fax-pdf` 실호출 smoke 테스트
- Expected: 정상 응답 + Cloud Logging 이벤트 확인

---

## Task 8: 관측성(로그/에러코드/알람) 도입

**Files:**
- Modify: `web/src/app/api/fax-pdf/route.ts`
- Create: `docs/runbooks/fax-pdf-alerts.md`

**Step 1: 구조화 로그 도입**
- 공통 필드: `event`, `po_id`, `vendor_prefix`, `error_code`, `cf_ray`, `duration_ms`
- 민감 데이터 제외: `html_content`, 토큰, 전체 signed URL query

**Step 2: 경보 조건 정의**
- `CF_429` 급증
- `CF_5XX` 5분 에러율 임계치 초과
- signed URL 발급 실패

**Step 3: 운영 대응 플레이북**
- 429 발생 시: 즉시 폴백 허용 + 업무 지속
- 장기 장애 시: HTML 폴백 기본 모드로 임시 전환 절차

---

## Task 9: QA 시나리오 및 수용 기준 매핑

**Files:**
- Create: `docs/qa/2026-02-21-uplus-print-pdf-qa-checklist.md`

**Step 1: PRD 수용 기준 1:1 매핑**
- 각 Acceptance 항목에 "검증 절차 / 기대 결과 / 증적 스크린샷" 칼럼 생성

**Step 2: 핵심 시나리오 실행**
- 정상: PO 생성 -> PDF 탭 오픈 -> U+ 인쇄 -> 수동확정 -> SENT 상태
- 장애: Cloudflare 429 모의 -> HTML 폴백 -> 수동확정

**Step 3: OS/폰트 검증**
- Windows 사내PC에서 A4/한글 폰트/줄바꿈 확인
- 프린터 목록 `LGUplusBizWebFax` 노출 확인

---

## Task 10: 최종 검증 게이트 (머지 전 필수)

**Files:**
- Modify: 없음

**Step 1: 정적/타입/빌드 검증**
- Run: `npm run lint`
- Run: `npx tsc --noEmit`
- Run: `npm run build`
- Workdir: `web`
- Expected: 모두 0 exit

**Step 2: 수동 E2E 확인**
- 공장 1개 `uplus_print` 선택 시 PDF 탭 자동 오픈
- 실패 강제 시 HTML 폴백 즉시 동작
- 수동확정 후 주문 상태 반영

**Step 3: 릴리즈 체크리스트 완료**
- 시크릿 주입 확인
- Cloud Run 리전/타임아웃 확인
- 알람 Rule 활성화 확인

---

## 구현 순서 (권장)

1. Task 2 -> Task 3 (서버 PDF 파이프라인 완성)
2. Task 4 -> Task 5 (UI/기존 라우트 정합)
3. Task 6 -> Task 7 (운영 배포)
4. Task 8 -> Task 9 -> Task 10 (관측성/QA/릴리즈)

---

## 리스크와 완화

- Cloudflare 429/5xx: 재시도 정책 + HTML 폴백 강제
- 대용량 HTML/응답 시간: Cloud Run timeout 600s + 문서 경량화
- 사용자 미확정 누락: Confirm 화면에서 대기건 강조/잔여건 경고
- 민감정보 노출: 원문 HTML 비로그 + signed URL 단기 만료(600s)

---

## 완료 정의 (Definition of Done)

- `uplus_print` 선택 시 PO 생성 이후 PDF가 새 탭으로 열리고 인쇄 가능
- Cloudflare 실패 시 자동 HTML 폴백으로 업무 중단 없음
- 수동확정 시 `cms_fn_factory_po_mark_sent`로 상태 `SENT_TO_VENDOR` 반영
- Cloud Run `asia-northeast3` 배포 및 운영 문서/알람 세트 완료
- lint/typecheck/build/QA 체크리스트 모두 통과
