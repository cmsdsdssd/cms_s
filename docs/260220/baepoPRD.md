너는 시니어 풀스택/DevOps 엔지니어다. 아래 레포를 “Cloudflare Workers + OpenNext(@opennextjs/cloudflare)”로 배포 가능하게 만들고, 현재 배포 불가능한 Playwright 기반 HTML→PDF 생성을 “Cloudflare Browser Rendering REST API(/pdf)”로 완전히 대체해라. 목표는 배포 환경(Cloudflare)에서 실제로 팩스 전송까지 동작하는 것이다.

[레포/현황]
- Next.js 앱은 /web 폴더에 있다.
- /web/src/app/api/fax-send/route.ts 에서 playwright로 HTML→PDF를 만들고, 그 PDF를 ApiPlex에 multipart/form-data로 전송한다.
- Cloudflare Workers에서는 로컬 Playwright(Chromium 포함) 실행이 불가능/비현실적이므로 제거해야 한다.
- 대신 Cloudflare Browser Rendering REST API의 /pdf endpoint를 사용해 HTML→PDF를 생성한다.
- Supabase RPC(서비스 롤 키 사용)도 계속 동작해야 한다.

[최종 산출물 요구사항]
1) Cloudflare Workers 배포 구성(OpenNext) 완료
2) Playwright 의존성 제거 후에도 /api/fax-send가 “apiplex” provider로 PDF 생성→전송까지 동작
3) 필요한 Cloudflare/Browser Rendering 토큰/Account ID는 env로 주입(로컬/배포 둘 다)
4) 로컬에서 Workers 환경으로 프리뷰(=wrangler dev) 가능해야 함
5) 문서(PDF)가 민감할 수 있으니 Browser Rendering REST API 호출은 cacheTTL=0 적용
6) 실패 시 에러 로그/응답 메시지가 충분히 나오도록 정리

------------------------------------------------------------
A. Cloudflare OpenNext 배포 세팅 (/web 기준)
------------------------------------------------------------
A-1) 의존성/스크립트 추가
- /web/package.json 수정:
  - devDependencies에 wrangler@latest 추가 (OpenNext 문서 기준 특정 버전 이상 필요)
  - dependencies 또는 devDependencies에 @opennextjs/cloudflare@latest 추가
  - scripts에 아래 추가/수정(프로젝트 상황에 맞게 조정):
    - "preview": "opennextjs-cloudflare build && wrangler dev"
    - "deploy":  "opennextjs-cloudflare build && wrangler deploy"
  - Playwright 삭제:
    - dependencies에서 "playwright" 제거
    - 프로젝트 코드에서 playwright import 제거
    - package-lock 갱신

A-2) wrangler 설정 파일 추가
- /web/wrangler.jsonc 생성(또는 wrangler.toml로 동일 구성):
  - main: ".open-next/worker.js"
  - name: 적절한 워커 이름 (예: "cms-s")
  - compatibility_date: 최신 날짜로 설정
  - compatibility_flags:
      - "nodejs_compat"
      - (process.env 사용 보장 위해) "nodejs_compat_populate_process_env" (가능하면 추가)
  - 필요하면 "assets" 섹션을 OpenNext 권장대로 추가
- /web/open-next.config.ts 생성(최소 구성) 또는 migrate 명령이 만든 파일을 사용

A-3) 환경변수 로딩 구성
- 로컬 개발:
  - /web/.dev.vars 생성하고 NEXTJS_ENV=development 넣기
  - /web/.env.development.local 또는 /web/.env.local에 필요한 값들을 넣어 로컬에서 next dev도 동작하게 유지
- 배포:
  - Cloudflare Dashboard 또는 wrangler secret로 아래를 설정:
    - SUPABASE_SERVICE_ROLE_KEY (secret)
    - NEXT_PUBLIC_SUPABASE_URL (plain var)
    - API_PLEX_* (secret/var)
    - (신규) CLOUDFLARE_ACCOUNT_ID (plain var)
    - (신규) CLOUDFLARE_BROWSER_RENDERING_TOKEN (secret)

A-4) .gitignore
- /web/.gitignore에 ".open-next" 추가

A-5) 빌드/프리뷰/배포 동작 확인
- /web에서:
  - npm install
  - npm run preview 로 로컬 Workers 실행 확인
  - npm run deploy 로 실제 Workers 배포 가능 상태 확인

------------------------------------------------------------
B. 선택지 A 적용: Browser Rendering /pdf REST API로 HTML→PDF 생성
------------------------------------------------------------
B-1) /web/src/app/api/fax-send/route.ts 수정
- playwright import 및 renderHtmlToPdf() 구현을 완전히 제거한다.
- 다음 함수로 대체 구현:

  async function renderHtmlToPdfViaCloudflare(html: string): Promise<Uint8Array> {
    - env에서 CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_BROWSER_RENDERING_TOKEN 읽기
    - 아래 endpoint로 POST:
      https://api.cloudflare.com/client/v4/accounts/{accountId}/browser-rendering/pdf?cacheTTL=0
    - Headers:
      - Authorization: Bearer {token}
      - Content-Type: application/json
    - Body JSON 예시:
      {
        "html": "<!doctype html>....</html>",
        "gotoOptions": { "waitUntil": "networkidle2", "timeout": 45000 },
        "pdfOptions": {
          "format": "a4",
          "printBackground": true,
          "preferCSSPageSize": true
        }
        // 필요 시 addStyleTag로 폰트/스타일 주입 가능
      }
    - 응답이 ok가 아니면 status + body text를 로그에 남기고 에러 throw
    - ok면 response.arrayBuffer()를 읽어 Uint8Array로 반환

- 기존 코드에서 ApiPlex 전송부는 유지하되,
  - pdfBuffer(Buffer) 대신 위 함수에서 받은 Uint8Array를 Blob로 감싸서 FormData에 첨부:
    const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
    formData.append("file", pdfBlob, `${poId}.pdf`);

B-2) 비용/모니터링 로그 추가
- Browser Rendering 응답 헤더 "X-Browser-Ms-Used"를 읽어서 server log에 남겨라.
  (나중에 비용 추적에 필수)

B-3) 보안/안정성
- /api/fax-send는 내부 기능이므로, 최소한의 보호장치(예: 관리자 세션/토큰/서명 헤더 등) 검토 주석을 남겨라.
- Browser Rendering 실패(429/5xx) 시 1~2회 짧은 재시도(지수 백오프)를 넣어라.

------------------------------------------------------------
C. 검증 시나리오(에이전트가 반드시 수행)
------------------------------------------------------------
1) TypeScript 빌드 성공
   - npm run build 또는 opennextjs-cloudflare build 성공
2) 로컬 preview에서 /api/fax-send 호출 테스트
   - provider=apiplex로 POST
   - mock credentials일 경우에도 “PDF 생성까지는 성공” 여부를 분리 확인할 수 있게 로그/에러 메시지 정리
3) 실제 배포(worker)에서 동작 확인을 위한 문서 업데이트
   - README에 Cloudflare 설정 방법, env 목록, wrangler 명령, Browser Rendering 토큰 만드는 법을 정리

[추가 참고]
- Next.js 버전은 현재 레포 설정(Next 16.x)을 유지하되, OpenNext Cloudflare가 지원하는 범위에서 동작하도록 한다.
- 가능하면 번들 크기를 줄여 Workers Free(3MB)에서도 배포가 되도록(Playwright 제거가 핵심) 최적화하라.

최종적으로: 코드 변경 PR 형태로 정리하고, 변경 파일 목록/적용 방법/테스트 결과를 요약 보고해라.