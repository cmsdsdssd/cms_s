# Cafe24 OAuth 파이프라인 완성 체크리스트 (Cloud Run + n8n + CMS)

## 0) 목표 / 범위
- 목표: `채널 설정 -> OAuth 승인 -> 토큰 자동 저장 -> Pull/Recompute/Push -> 로그/모니터링`까지 운영 가능한 파이프라인 완성
- 범위 포함:
  - Cloud Run 시크릿/환경변수
  - n8n webhook 브리지
  - CMS OAuth authorize/callback API
  - 채널 계정 저장/토큰 갱신/가격 동기화
  - 스모크/E2E/장애 대응
- 범위 제외:
  - 앱스토어 공개 심사 통과 자체

## 1) 현재 고정값 (이번 구현 기준)
- n8n redirect URL: `https://zn8n.cmsmujogunsunggong.com/webhook/30db7bba-8a1c-48c1-b50f-356b9b098013`
- CMS callback URL: `https://<CMS_DOMAIN>/api/shop-oauth/cafe24/callback`
- OAuth 시작 API: `POST /api/shop-oauth/cafe24/authorize`
- 채널 계정 API: `POST /api/channels/{id}/account`

## 2) 실행 규칙
- [ ] `RULE-001` 모든 작업은 본 체크리스트 ID 단위로 진행
- [ ] `RULE-002` 완료 즉시 `[x]` + 증적(스크린샷/로그/응답) 기록
- [ ] `RULE-003` 실패 항목은 원인/재시도 계획을 바로 하단에 기록
- [ ] `RULE-004` 비밀값은 문서/채팅에 평문 노출 금지

---

## A. 사전 준비 (프로젝트/도메인/권한)
- [ ] `PRE-001` Cloud Run 서비스명 확정 (`cms-web` 등)
- [ ] `PRE-002` Cloud Run 리전 확인 (`asia-northeast3`)
- [ ] `PRE-003` 운영 도메인(`CMS_DOMAIN`) 확정
- [ ] `PRE-004` Cafe24 앱에 등록된 Redirect URI 목록 확인
- [ ] `PRE-005` n8n webhook URL가 Cafe24 Redirect URI에 등록되어 있는지 확인
- [ ] `PRE-006` Cloud Run Runtime SA 확인
- [ ] `PRE-007` Runtime SA에 Secret Accessor 권한 있는지 확인
- [ ] `PRE-008` GitHub Actions 배포 사용 여부 확정(수동 배포면 스크립트 경로 확정)

## B. Secret Manager / Cloud Run 설정
- [ ] `ENV-001` Secret 생성: `CAFE24_OAUTH_STATE_SECRET`
- [ ] `ENV-002` Secret 생성: `SUPABASE_SERVICE_ROLE_KEY`(없으면)
- [ ] `ENV-003` Runtime SA에 `CAFE24_OAUTH_STATE_SECRET` 접근권한 부여
- [ ] `ENV-004` Runtime SA에 `SUPABASE_SERVICE_ROLE_KEY` 접근권한 확인
- [ ] `ENV-005` Cloud Run env 설정: `CAFE24_OAUTH_REDIRECT_URI=<n8n webhook URL>`
- [ ] `ENV-006` Cloud Run secret 매핑: `CAFE24_OAUTH_STATE_SECRET=...:latest`
- [ ] `ENV-007` Cloud Run secret 매핑: `SUPABASE_SERVICE_ROLE_KEY=...:latest`
- [ ] `ENV-008` `NEXT_PUBLIC_SUPABASE_URL` 값 유효성 확인
- [ ] `ENV-009` `NEXT_PUBLIC_SUPABASE_ANON_KEY` 값 유효성 확인
- [ ] `ENV-010` 설정 반영 후 새 Revision 생성 확인
- [ ] `ENV-011` 트래픽이 최신 Revision 100%인지 확인
- [ ] `ENV-012` 롤백용 이전 Revision ID 기록

## C. n8n OAuth 브리지 구성
- [ ] `N8N-001` Webhook Trigger 노드 생성(GET)
- [ ] `N8N-002` Query에서 `code`, `state`, `error`, `error_description` 파싱
- [ ] `N8N-003` `error` 존재 시 실패 리다이렉트 URL 구성
- [ ] `N8N-004` `code/state` 존재 시 성공 리다이렉트 URL 구성
- [ ] `N8N-005` 성공 시 302 Location=`https://<CMS_DOMAIN>/api/shop-oauth/cafe24/callback?...`
- [ ] `N8N-006` 실패 시 302 Location=`https://<CMS_DOMAIN>/settings/shopping/channels?oauth=error...`
- [ ] `N8N-007` `state` 값 무변형 전달 확인
- [ ] `N8N-008` n8n 실행 로그에서 민감정보 마스킹 설정
- [ ] `N8N-009` webhook 응답 시간 3초 이내 확인
- [ ] `N8N-010` n8n 워크플로우 활성화/버전 태깅

## D. CMS 채널 계정 초기입력
- [ ] `ACC-001` 채널 생성(`channel_type=CAFE24`, `channel_code`, `channel_name`)
- [ ] `ACC-002` `mall_id` 저장
- [ ] `ACC-003` `shop_no` 저장(기본 1)
- [ ] `ACC-004` `api_version` 저장
- [ ] `ACC-005` `client_id` 저장
- [ ] `ACC-006` `client_secret` 저장
- [ ] `ACC-007` `access_token` 빈값 허용 동작 확인
- [ ] `ACC-008` `refresh_token` 빈값 허용 동작 확인
- [ ] `ACC-009` 저장 후 `status` 표시 확인
- [ ] `ACC-010` DB `sales_channel_account` row upsert 확인

## E. OAuth 승인/콜백/토큰저장
- [ ] `OAU-001` 채널 설정 화면의 "OAuth 승인 페이지로 이동" 버튼 노출 확인
- [ ] `OAU-002` `POST /api/shop-oauth/cafe24/authorize` 200 응답 확인
- [ ] `OAU-003` authorize URL에 `client_id`, `state`, `redirect_uri` 포함 확인
- [ ] `OAU-004` Cafe24 승인 화면 진입 확인
- [ ] `OAU-005` 승인 후 n8n webhook 도착 확인
- [ ] `OAU-006` n8n -> CMS callback 302 리다이렉트 확인
- [ ] `OAU-007` callback에서 state 검증 성공 확인
- [ ] `OAU-008` callback에서 code->token 교환 성공 확인
- [ ] `OAU-009` `access_token_enc` 저장 확인
- [ ] `OAU-010` `refresh_token_enc` 저장 확인
- [ ] `OAU-011` `access_token_expires_at` 저장 확인
- [ ] `OAU-012` `refresh_token_expires_at` 저장 확인
- [ ] `OAU-013` `status=CONNECTED` 전환 확인
- [ ] `OAU-014` UI 성공 토스트 확인
- [ ] `OAU-015` 실패 시 `last_error_code`, `last_error_message` 기록 확인

## F. 토큰 갱신/재시도 로직 검증
- [ ] `TOK-001` 유효한 access token으로 API 호출 성공 확인
- [ ] `TOK-002` access token 만료 시 refresh 호출 트리거 확인
- [ ] `TOK-003` refresh 성공 후 신규 access token 저장 확인
- [ ] `TOK-004` refresh_token rotate 시 DB 갱신 확인
- [ ] `TOK-005` refresh 실패 시 status=ERROR 전환 확인
- [ ] `TOK-006` Pull API에서 401 1회 재시도 동작 확인
- [ ] `TOK-007` Push API에서 401 1회 재시도 동작 확인
- [ ] `TOK-008` 429 응답 시 backoff 재시도 확인

## G. 가격 동기화 파이프라인 E2E
- [ ] `PIP-001` 매핑 데이터(`channel_product_map`) 1건 이상 준비
- [ ] `PIP-002` `POST /api/channel-prices/pull` 성공 확인
- [ ] `PIP-003` pull 결과 snapshot row 저장 확인
- [ ] `PIP-004` `POST /api/pricing/recompute` 성공 확인
- [ ] `PIP-005` 권장가 계산 결과 snapshot 저장 확인
- [ ] `PIP-006` 대시보드에서 current/recommended/diff 표시 확인
- [ ] `PIP-007` `POST /api/channel-prices/push` dry-run 성공 확인
- [ ] `PIP-008` dry-run item 상태/메시지 기록 확인
- [ ] `PIP-009` 실 push 실행 성공 확인
- [ ] `PIP-010` push item별 before/after/raw_json 저장 확인
- [ ] `PIP-011` push job aggregate(success/failed/skipped) 확인
- [ ] `PIP-012` 실패 item 존재 시 전체 중단되지 않음 확인

## H. 운영 보안 하드닝 (필수)
- [ ] `SEC-001` `sales_channel_account` 민감컬럼 접근권한(service_role only) 재검증
- [ ] `SEC-002` API 응답에 토큰 평문 미노출 확인
- [ ] `SEC-003` 서버 로그에 토큰/secret 미노출 확인
- [ ] `SEC-004` `CAFE24_OAUTH_STATE_SECRET` 주기적 교체 절차 문서화
- [ ] `SEC-005` Secret version pinning 전략 확정(`latest` vs 고정 버전)
- [ ] `SEC-006` 토큰 암호화 저장(실암호화) 로드맵 확정 및 작업 티켓화

## I. 장애/예외 시나리오
- [ ] `ERR-001` Cafe24 승인 거절 시 UI 에러표시 확인
- [ ] `ERR-002` 앱 심사/권한 미충족으로 token 교환 실패 시 메시지 확인
- [ ] `ERR-003` state 변조 공격 시 callback 차단 확인
- [ ] `ERR-004` n8n 다운 시 사용자 안내 문구/운영 대응 절차 확인
- [ ] `ERR-005` Cloud Run secret 권한 누락 시 장애탐지(에러율/로그) 확인
- [ ] `ERR-006` refresh token 만료 시 재승인 재진입 플로우 검증

## J. 관측성 / 운영 대시보드
- [ ] `OBS-001` OAuth 시작/성공/실패 이벤트 로깅 포맷 확정
- [ ] `OBS-002` pull/push 실패율 모니터링 쿼리 작성
- [ ] `OBS-003` 401/429 급증 알림 규칙 설정
- [ ] `OBS-004` n8n webhook 실패 알림 설정
- [ ] `OBS-005` 장애 대응 런북 문서화(담당자/연락체계 포함)

## K. 릴리즈 게이트 (완료 정의)
- [ ] `GATE-001` LSP diagnostics: 변경 파일 0 error
- [ ] `GATE-002` `npm run build` 성공
- [ ] `GATE-003` OAuth 승인->토큰 저장 E2E 시연 캡처 확보
- [ ] `GATE-004` pull/recompute/push E2E 시연 캡처 확보
- [ ] `GATE-005` 보안/권한 점검 항목(`SEC-*`) 완료
- [ ] `GATE-006` 장애 시나리오(`ERR-*`) 3개 이상 리허설 완료
- [ ] `GATE-007` 운영자 인수인계 완료(실행 매뉴얼 + 롤백 매뉴얼)
- [ ] `GATE-008` 최종 go-live 승인 기록

---

## 3) 빠른 실행 순서 (오늘 바로)
1. `ENV-*` 완료 (Cloud Run 반영)
2. `N8N-*` 완료 (302 브리지 확정)
3. `ACC-*` 완료 (채널 계정 기본값)
4. `OAU-*` 완료 (OAuth 승인/토큰 저장)
5. `PIP-*` 완료 (동기화 E2E)
6. `SEC-*`, `ERR-*`, `GATE-*` 순차 마감

## 4) 증적 기록 템플릿 (복붙용)
```text
[ID] OAU-008
- 일시: 2026-02-27 14:30 KST
- 결과: PASS
- 증적: callback 응답 URL, DB row 캡처, Cloud Logging trace ID
- 비고: refresh_token_expires_at 정상 저장
```
