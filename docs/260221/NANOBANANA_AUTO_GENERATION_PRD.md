# NanoBanana 자동 생성 연동 PRD

## 1) 문서 목적
이 문서는 코딩 에이전트에게 전달할 구현 명세서입니다. 목표는 제품 이미지를 업로드하면 NanoBanana API로 자동 생성을 수행하고, 포즈(`눕혀서`/`세워서`)와 배경색 선택에 따라 프롬프트를 자동 적용하는 기능을 구축하는 것입니다.

## 2) 범위
- 포함
  - 제품 이미지 업로드
  - 기본 설정값 자동 적용
  - 포즈/배경색 선택값에 따른 프롬프트 자동 조합
  - NanoBanana API 호출
  - 생성 이미지 반환/저장/다운로드
  - 좌측 상단 파일명 오버레이
  - 에러 처리 및 재시도 UX
- 제외
  - 결제/과금 시스템
  - 멀티테넌트 권한 체계
  - 고급 편집 기능(마스킹, 배치 합성)

## 3) 사용자 시나리오
1. 사용자는 제품 이미지를 업로드한다.
2. 기본값은 그대로 두고 `생성하기`를 누른다.
3. 시스템은 기본 프롬프트(포즈: 눕혀서, 배경: 순백)를 사용해 NanoBanana API를 호출한다.
4. 사용자가 포즈를 `세워서`로 바꾸면 해당 프롬프트로 동일 프로세스를 수행한다.
5. 필요 시 배경색을 바꿔서 같은 흐름으로 생성한다.
6. 생성 결과 좌측 상단에 파일명이 표시되고, 결과 이미지를 미리보기/다운로드한다.

## 4) 기본 설정값(필수)
- promptVersion: `optimized`
- lightDirection: `1` (Rembrandt)
- lightQuality: `1` (Natural)
- backgroundStyle: `0` (순백)
- customPrompt: `''` (빈 문자열)
- productPose 기본값: `0` (눕혀서)
- showModelNameOverlay: `true`
- textColor: `black`

## 5) 프롬프트 규격

### 5.1 조명/배경/포즈 매핑 규격

#### A) 조명 방향 (`light_direction`)
- `1` (기본)
  - `Rembrandt lighting pattern: key light at 45-degree angle from front-right and above, creating the signature triangle of light, dimensional and artistic look`

#### B) 조명 품질 (`light_quality`)
- `1` (기본)
  - `Natural studio lighting: balanced key-to-fill ratio 1:3, soft shadows with smooth falloff, professional product photography standard`

#### C) 배경색 (`background_style`)
- `0` 순백
  - `BACKGROUND: pure white solid background, seamless matte studio backdrop, #FFFFFF white, clean bright e-commerce style, no shadows on backdrop, high-key lighting compatible`
- `1` 아이보리
  - `BACKGROUND: soft ivory cream solid background, warm off-white seamless backdrop, subtle warm undertone, elegant and sophisticated, matte smooth finish`
- `2` 라이트그레이
  - `BACKGROUND: soft light gray solid background, neutral pale gray seamless backdrop, subtle sophisticated tone, professional studio aesthetic, matte finish`
- `3` 스카이블루
  - `BACKGROUND: soft pastel sky blue solid background, light baby blue seamless backdrop, gentle cool tone, airy and fresh feel, matte smooth studio finish`
- `4` 소프트핑크
  - `BACKGROUND: soft blush pink solid background, gentle pastel rose seamless backdrop, warm feminine tone, delicate and elegant, matte studio finish`
- `5` 검정
  - `BACKGROUND: pure black solid background, seamless matte black studio backdrop, #000000 black, dramatic dark e-commerce style, clean dark backdrop, low-key lighting compatible`

#### D) 제품 포즈 (`product_pose`)
- `0` 눕혀서
  - `CAMERA: Shoot from DIRECTLY ABOVE (bird's eye view). Product must lie FLAT on the surface, displayed horizontally. Top-down overhead photography angle.`
- `1` 세워서
  - `CAMERA: Shoot at EYE-LEVEL, front-facing. Product must stand UPRIGHT vertically on the surface. Show the product standing on its base with front facade visible.`
- `2` 걸어서 (옵션)
  - `CAMERA: Shoot at SLIGHT ANGLE. Product must be HANGING/SUSPENDED in mid-air or from a hook/chain. Display product as if worn or hung on jewelry display stand.`

### 5.2 최종 조합 프롬프트 템플릿
```text
Professional product photography for e-commerce.

MOST IMPORTANT - Camera Position:
{POSE_PROMPT}

Product Setup:
- {BACKGROUND_PROMPT}
- {LIGHT_DIRECTION_PROMPT}
- {LIGHT_QUALITY_PROMPT}
- Center the product in frame, 75% of image area

Style: Hyper-realistic, sharp focus, magazine-quality finish, 4:3 landscape format.

{OPTIONAL_CUSTOM_PROMPT_LINE}
```

`OPTIONAL_CUSTOM_PROMPT_LINE` 규칙:
- customPrompt가 비어있으면 빈 줄
- 값이 있으면 `Additional: {customPrompt}`

### 5.3 실제 적용 프롬프트 2종

#### A. 기본값 + 포즈 `눕혀서`
```text
Professional product photography for e-commerce.

MOST IMPORTANT - Camera Position:
CAMERA: Shoot from DIRECTLY ABOVE (bird's eye view). Product must lie FLAT on the surface, displayed horizontally. Top-down overhead photography angle.

Product Setup:
- BACKGROUND: pure white solid background, seamless matte studio backdrop, #FFFFFF white, clean bright e-commerce style, no shadows on backdrop, high-key lighting compatible
- Rembrandt lighting pattern: key light at 45-degree angle from front-right and above, creating the signature triangle of light, dimensional and artistic look
- Natural studio lighting: balanced key-to-fill ratio 1:3, soft shadows with smooth falloff, professional product photography standard
- Center the product in frame, 75% of image area

Style: Hyper-realistic, sharp focus, magazine-quality finish, 4:3 landscape format.
```

#### B. 기본값 + 포즈 `세워서`
```text
Professional product photography for e-commerce.

MOST IMPORTANT - Camera Position:
CAMERA: Shoot at EYE-LEVEL, front-facing. Product must stand UPRIGHT vertically on the surface. Show the product standing on its base with front facade visible.

Product Setup:
- BACKGROUND: pure white solid background, seamless matte studio backdrop, #FFFFFF white, clean bright e-commerce style, no shadows on backdrop, high-key lighting compatible
- Rembrandt lighting pattern: key light at 45-degree angle from front-right and above, creating the signature triangle of light, dimensional and artistic look
- Natural studio lighting: balanced key-to-fill ratio 1:3, soft shadows with smooth falloff, professional product photography standard
- Center the product in frame, 75% of image area

Style: Hyper-realistic, sharp focus, magazine-quality finish, 4:3 landscape format.
```

## 6) API 요구사항

### 6.1 서버 API 인터페이스
- Endpoint: `POST /api/product-auto-generate`
- Content-Type: `multipart/form-data`

요청 필드:
- `product_image` (File, 필수)
- `product_pose` (number, optional, default `0`, 허용값 `0|1|2`)
- `background_style` (number, optional, default `0`, 허용값 `0|1|2|3|4|5`)
- `custom_prompt` (string, optional)
- `show_model_name_overlay` (boolean, optional, default `true`)
- `text_color` (string, optional, default `black`)
- `display_name` (string, optional, 오버레이용 표시명)

내부 기본 필드(클라이언트에서 생략 가능):
- `prompt_version='optimized'`
- `light_direction=1`
- `light_quality=1`

응답(JSON):
- 성공
  - `{ "success": true, "image": "<base64_png>" }`
- 실패
  - `{ "success": false, "error": "메시지", "code": "ENUM_CODE" }`

### 6.2 NanoBanana 연동
- 환경변수
  - `NANOBANANA_API_KEY`
  - `NANOBANANA_BASE_URL`
- 서버에서만 API 키 사용
- 타임아웃: 120초
- 재시도: 최대 2회(네트워크/5xx만)
- 로깅: request id, latency, status code, prompt hash

## 7) 처리 플로우
1. 업로드 파일 유효성 검사(이미지 mime, 용량 제한).
2. `product_pose`로 카메라 문구 선택.
3. `background_style`로 배경 문구 선택.
4. 기본 조명 문구와 합쳐 최종 프롬프트 생성.
5. NanoBanana API 호출(payload: 이미지 + 프롬프트).
6. base64 이미지 응답 수신.
7. `show_model_name_overlay=true`이면 좌측 상단 파일명 오버레이 렌더링.
8. 클라이언트로 반환 후 미리보기 렌더.
9. 다운로드 버튼으로 jpg/png 저장.

## 8) 좌측 상단 파일명 오버레이 구현 명세
아래 값은 기존 구현 패턴(`addTextOverlay`)을 기준으로 고정 명세로 사용한다.

### 8.1 좌표/타이포
- 텍스트 기준점: `textX=70`, `textY=70`
- 폰트: `300 40px Arial, sans-serif`
- 텍스트 색상: `textColor`(기본 `black`)

### 8.2 기존 텍스트 가림 박스(오버페인트)
1. 텍스트 폭 측정: `textWidth = ctx.measureText(text).width`
2. 고정 텍스트 높이: `textHeight=40`
3. 패딩: `padding=12`
4. 박스 계산:
   - `boxX = textX - padding`
   - `boxY = textY - textHeight - padding + 8`
   - `boxWidth = textWidth + padding * 2`
   - `boxHeight = textHeight + padding * 2`

### 8.3 배경색 샘플링
- 샘플 크기: `sampleSize=20`
- 샘플 좌표:
  - `sampleX = min(5, img.width - sampleSize - 5)`
  - `sampleY = min(120, img.height - sampleSize - 5)`
- 샘플 영역 평균 RGB 계산
- 박스 배경색: `rgba(r, g, b, 1)` (불투명)

### 8.4 렌더링 순서
1. 원본 이미지 draw
2. 평균색 박스 `fillRect(boxX, boxY, boxWidth, boxHeight)`
3. 텍스트색 설정 후 `fillText(displayName, textX, textY)`
4. `canvas.toDataURL('image/png')` 반환

### 8.5 파일명/표시명 규칙
- 오버레이 표시명(`display_name`) 우선순위:
  1) 사용자 지정 `display_name`
  2) 업로드 파일명(확장자 제거)
  3) 기본값 `product`
- 다운로드 파일명(`original_name`):
  - 업로드 원본 파일명에서 확장자 제거 후 `.jpg`

### 8.6 오버레이 비활성화
- `show_model_name_overlay=false`이면 오버레이 단계를 건너뛴다.

## 9) 유효성/보안
- 파일 형식: `image/jpeg`, `image/png`, `image/webp`
- 파일 크기: 최대 15MB
- 프롬프트 길이 제한: 2,000자
- 서버에서 prompt sanitize(제어문자 제거)
- API 키는 절대 클라이언트 전달 금지

## 10) 에러 코드 정의
- `INVALID_FILE_TYPE`
- `FILE_TOO_LARGE`
- `INVALID_POSE_VALUE`
- `INVALID_BACKGROUND_STYLE`
- `NANOBANANA_TIMEOUT`
- `NANOBANANA_UPSTREAM_ERROR`
- `INTERNAL_ERROR`

## 11) 성공 기준(DoD)
- 제품 이미지 1장 업로드 후 기본값으로 생성 시 결과가 정상 반환된다.
- 포즈를 `세워서`로 변경하면 프롬프트의 카메라 문구가 `세워서` 버전으로 바뀐다.
- 배경색 변경 시 `background_style`에 해당하는 문구가 프롬프트에 반영된다.
- 파일명이 좌측 상단에 지정 좌표/폰트로 렌더링된다.
- 응답시간 120초 내 성공 또는 명확한 에러를 반환한다.
- 서버 로그에서 프롬프트 원문 대신 hash만 저장한다.

## 12) 테스트 케이스
- TC-01: 기본값(눕혀서, 순백) 생성 성공
- TC-02: 세워서 생성 성공
- TC-03: 배경색 `3`(스카이블루) 생성 성공
- TC-04: 이미지 미첨부 시 400
- TC-05: 지원하지 않는 파일 포맷 업로드 시 400
- TC-06: NanoBanana 타임아웃 시 504 + `NANOBANANA_TIMEOUT`
- TC-07: customPrompt 입력 시 템플릿 하단 `Additional:`로 병합 확인
- TC-08: show_model_name_overlay=true일 때 좌측 상단 텍스트 생성 확인
- TC-09: show_model_name_overlay=false일 때 오버레이 미적용 확인
- TC-10: display_name 미입력 시 fallback 규칙 적용 확인

## 13) 코딩 에이전트 구현 체크리스트
- [ ] `POST /api/product-auto-generate` 추가
- [ ] 포즈별 프롬프트 매핑 함수 구현
- [ ] 배경색별 프롬프트 매핑 함수 구현
- [ ] 기본값 자동 주입 로직 구현
- [ ] NanoBanana SDK/HTTP 클라이언트 연동
- [ ] timeout/retry/error mapping 구현
- [ ] 파일명 좌측 상단 오버레이 렌더러 구현(Canvas)
- [ ] 파일명 파싱/다운로드명 규칙 구현
- [ ] 클라이언트 업로드-생성-미리보기-다운로드 연결
- [ ] 단위테스트(프롬프트 조합 함수), 통합테스트(API)

## 14) 근거 코드 위치(현재 시스템)
- UI/기본값/생성 파라미터: `src/app/(dashboard)/product-studio/page.tsx`
- 프롬프트 매핑/조합: `src/app/api/product-studio/route.ts`
- 오버레이 함수 기준 구현: `src/app/(dashboard)/product-studio/page.tsx`의 `addTextOverlay`
