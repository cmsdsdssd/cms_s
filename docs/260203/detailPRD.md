# 프로젝트 구현 명세서: API PLEX 팩스 연동 및 공장 발주 시스템 고도화

### 0) 절대 규칙 (프로젝트 헌법)
* **DB SoT:** `public.cms_*` 오브젝트만 사용. `ms_s` 사용 금지.
* **직접 INSERT/UPDATE 금지:** 모든 쓰기 작업은 반드시 **RPC(Function)**로만 수행.
* **마이그레이션 정책:** **ADD-ONLY** (기존 migration 파일 수정/재작성 절대 금지).
* **타임스탬프 규칙:** 새 migration 파일명은 repo 내 가장 큰 타임스탬프보다 더 뒤(미래)로 설정.
    * 현재 repo 최대값이 `20260203180000`인 경우, 새 파일은 `20260203190000_...` 이상으로 명명.

---

### 1) 목표 / UX 플로우 (사용자 시나리오)
#### 목표
`orders_main` 페이지에서 '공장발주' 버튼을 눌렀을 때의 프로세스 완성:
1.  **공장 선택:** 팩스 설정 및 번호 확인.
2.  **미리보기:** 실제 전송 내용과 1:1로 동일한 내용(이미지 포함) 확인.
3.  **전송:** 클릭 시 API PLEX를 통해 팩스 전송.
4.  **피드백:** 성공/실패 결과를 UI 토스트 및 요약으로 제공.

#### 완료 조건 (Acceptance Criteria)
* 미리보기 화면과 실제 전송되는 문서가 동일한 소스(HTML)를 사용함 ("미리보기 = 전송" 보장).
* 팩스 문서 내에 제품 이미지(썸네일)가 정상적으로 표시됨.
* **팩스 전송 성공 시:**
    * PO 상태가 `SENT_TO_VENDOR`로 변경.
    * 관련 `order_line`들도 `SENT_TO_VENDOR`로 업데이트.
    * `cms_fax_log`에 `provider_message_id` (jobId) 포함하여 기록.
* **팩스 전송 실패 시:**
    * PO는 `cancel` RPC로 처리 (또는 DRAFT 유지 + 실패 로그 기록 정책 중 택1, 단 "직접 update 금지" 준수).
    * 실패 로그를 RPC를 통해 기록.
* **API PLEX Webhook 수신 시:**
    * `jobId` 기준으로 `cms_fax_log`에 최종 성공/실패 결과 및 payload 저장 (RPC 필수).

---

### 2) 현재 코드 베이스에서 건드릴 파일 (이미 뼈대 있음)
이미 존재하는 파일들을 기반으로 "apiplex 연동 + 미리보기/이미지 정확화 + RPC 준수"를 구현한다.

* **FE (진입):** `web/src/app/(app)/orders_main/page.tsx`
* **Wizard (UI/미리보기/전송 루프):** `web/src/components/factory-order/factory-order-wizard.tsx`
* **팩스 전송 API (서버):** `web/src/app/api/fax-send/route.ts`
* **공장 팩스 설정 UI:** `web/src/app/(app)/settings/page.tsx`
* **DB 스키마/기존 RPC:**
    * `supabase/migrations/20260202110000_cms_0300_factory_po_system.sql`
    * `supabase/migrations/20260202110100_cms_0301_factory_po_rpc.sql`
    * 기타 `factory_po` 관련 migrations

---

### 3) API PLEX Fax API 요구사항 (필수 스펙)
#### 전송 엔드포인트 / 인증 / 폼 구조
* **Method/URL:** `POST /fax/v1/send`
* **Content-Type:** `multipart/form-data`
* **Host 예시:** `https://571bv9t3z5.apigw.ntruss.com`
* **인증 헤더:** `Authorization: {userId};{secret_key}`
* **멀티파트 구성:**
    * `form` 파트: JSON (요청 필드 포함, Content-Type: `application/json` 권장).
    * `file` 파트: 첨부파일 (최대 3개, 각 7MB 제한).
* **성공 응답:** `HTTP 201 CREATED`, Body에 `jobId`, `code`, `desc` 포함.

#### form JSON 주요 필드 (문서 기준)
* `cid` (발신번호, 필수)
* `coverType` (팩스 커버 타입, 필수 - 고정값 안내됨)
* `desFax` (수신 팩스 번호, 필수)
* `callback` (선택 사항: 웹훅 URL)

#### Webhook (전송 결과 콜백)
* API PLEX가 설정된 `callback` URL로 `POST` (JSON) 전송.
* **Payload 예시:** `jobId`, `sendStatus`, `pageCnt`, `result` 등.
* **고객 응답 Body:** `{"code":"100","desc":"Success"}` 형식 필수.

---

### 4) 구현 요구사항 (핵심 설계)

#### 4.1 Provider 확장: apiplex
* **DB 제약 사항:** `cms_vendor_fax_config.fax_provider` 체크 제약에 `apiplex` 추가 필요.
    * 현재 허용값: `mock`, `twilio`, `sendpulse`, `custom`.
    * **신규 Migration (ADD-ONLY):** 기존 체크 제약을 드롭 후 `apiplex`를 포함하여 재생성.
* **FE 타입/옵션:** `settings/page.tsx`의 타입 union 및 select 옵션에 `apiplex` ("API PLEX (국내 팩스)") 추가.

#### 4.2 전송 서버 API: `/api/fax-send` 구현
`route.ts`의 provider 분기에 실제 로직 구현:

* **(A) HTML → PDF 변환:** Playwright 또는 Puppeteer를 사용하여 `html_content`를 A4 PDF로 변환.
    * `export const runtime = "nodejs";` 설정 필수.
    * `waitUntil: 'networkidle'` 등으로 이미지(`<img>`) 로딩 보장.
* **(B) multipart/form-data 구성:**
    * `form` 파트: `new Blob([JSON.stringify(formPayload)], { type: 'application/json' })`
    * `file` 파트: `new Blob([pdfBuffer], { type: 'application/pdf' })`, 파일명: `factory-po-{vendor_prefix}-{po_id}.pdf`
* **(C) Request Payload 매핑:**
    * `cid`: ENV 또는 설정에서 로드.
    * `desFax`: 요청 바디의 `fax_number`.
    * `callback`: `/api/fax-webhook/apiplex` 엔드포인트 지정.
    * `subject/coverContent`: 공장명/발주일/라인수 등 기본 정보 포함.
* **(D) 성공/실패 처리 (RPC-only):**
    * 성공 시: `cms_fn_factory_po_mark_sent` 호출 (`provider_message_id`에 `jobId` 저장).
    * 실패 시: 직접 업데이트 금지. 실패 로그 전용 RPC 호출 또는 기존 cancel 흐름 RPC 사용.

#### 4.3 Webhook 엔드포인트 추가: `/api/fax-webhook/apiplex`
* **위치:** `web/src/app/api/fax-webhook/apiplex/route.ts`
* **동작:**
    1.  POST JSON payload 파싱.
    2.  `jobId`로 매칭되는 PO 검색 (`fax_provider_message_id` 매칭).
    3.  Webhook payload를 `cms_fax_log.response_meta`에 저장하고 성공 여부 업데이트 (RPC 사용).
    4.  응답: `{"code":"100","desc":"Success"}`
* **보안:** ENV를 통한 shared secret 검증(쿼리스트링 또는 헤더) 추가 권장.

---

### 5) FactoryOrderWizard 고도화
* **공장 선택 UX:** 공급처 이름, 접두어, 팩스 번호, 제공자(provider) 표시. 번호 부재 시 선택 불가 처리.
* **미리보기 Fidelity:** `generateFaxHtmlForGroup(group)` 함수를 일원화하여 미리보기와 실제 전송 HTML이 100% 일치하도록 보장.
* **이미지 포함:** 팩스 HTML 테이블에 제품 썸네일 컬럼 추가. 모델명 기준 이미지를 사전 조회하여 맵핑 후 렌더링. CSS로 크기 고정 (`object-fit: cover`).

---

### 6) 설정(Settings) 페이지: RPC 전환
* `settings/page.tsx`에서 `cms_vendor_fax_config`에 대한 직접 클라이언트 upsert를 중단하고 RPC로 교체.
* **신규 RPC:** `cms_fn_vendor_fax_config_upsert_v1(p_vendor_party_id uuid, p_fax_number text, p_fax_provider text, p_is_active bool, p_actor_person_id uuid)`
* `useRpcMutation`을 사용하여 위 RPC 호출.

---

### 7) ENV / 운영 파라미터 (서버)
* `API_PLEX_USER_ID`
* `API_PLEX_SECRET_KEY`
* `API_PLEX_CID` (발신 번호)
* `API_PLEX_BASE_URL` (기본값: 문서 제공 Host)
* `API_PLEX_WEBHOOK_SECRET` (웹훅 검증용)

---

### 8) 테스트 체크리스트
* [ ] **기존 기능 유지:** Mock provider 작동 확인.
* [ ] **API PLEX 전송:** 성공 시 `mark_sent` RPC 호출 및 `fax_log` 기록 확인. 실패 시 에러 처리 및 로그 확인.
* [ ] **Webhook 연동:** `jobId` 기반 PO 매칭, 결과 저장, `code=100` 응답 확인.
* [ ] **이미지/PDF:** 미리보기 및 PDF 변환 결과물에서 제품 이미지가 정상 출력되는지 확인.

---

### 9) 구현 산출물 (커밋 단위 권장)
1.  **Migration:** DB 제약 조건 변경 및 신규 RPC 추가.
2.  **Server API:** `/api/fax-send` 내 apiplex 로직 및 PDF 변환 기능 구현.
3.  **Webhook:** `/api/fax-webhook/apiplex` 경로 및 처리 RPC 연동.
4.  **Settings UI:** 팩스 설정 저장을 RPC 방식으로 교체 및 `apiplex` 옵션 추가.
5.  **Wizard UI:** 미리보기/전송 소스 통합, 이미지 렌더링 추가, UX 강화.