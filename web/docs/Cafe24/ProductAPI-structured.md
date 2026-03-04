# Cafe24 Front API (Product) 정리본

원문 덤프: `web/docs/Cafe24/ProductAPI.md`

이 문서는 원문을 한 번에 보기 쉽게 재구성한 색인/요약본입니다.
"더보기" 섹션 아래의 엔드포인트/기본스펙/요청사양 헤더를 기준으로 정리했습니다.

---

## 1) 핵심 식별자 규칙 (중요)

- `product_no` (상품번호)
  - 문서 설명: "해당 쇼핑몰 내에서 상품 번호는 중복되지 않음"
- `product_code` (상품코드)
  - 문서 설명: "해당 쇼핑몰 내에서 상품코드는 중복되지 않음"
- `variant_code` (품목코드)
  - 문서 설명: "해당 쇼핑몰 내에서 품목 코드는 중복되지 않음"

실무 매핑 권장:
- 내부 저장시 상품 식별자는 `product_no`로 표준화
- `product_code`는 보조 식별자
- 옵션(품목)은 `variant_code`를 기본 키로 사용

---

## 2) 공통 규격

- 베이스 URL 예시: `https://{mallid}.cafe24api.com/api/v2/...`
- 인증: Front API는 Basic 인증(`client_id:front_api_key` Base64)
- 응답 포맷: JSON
- 주요 상태코드: 200/201/400/401/403/404/409/422/429/5xx
- 제한:
  - `X-Api-Call-Limit`
  - `X-Cafe24-Call-Usage`, `X-Cafe24-Call-Remain`
  - `X-Cafe24-Time-Usage`, `X-Cafe24-Time-Remain`

---

## 3) Product 영역 엔드포인트 맵

### 3.1 Categories products

- `GET /api/v2/categories/{category_no}/products`
- `GET /api/v2/categories/{category_no}/products/count`

주요 파라미터:
- `shop_no` (default 1)
- `category_no` (required)
- `display_group` (required, 1~3)
- `limit`, `offset`

### 3.2 Mains products

- `GET /api/v2/mains/{display_group}/products`

주요 파라미터:
- `shop_no`
- `display_group` (required)
- `limit`, `offset`

### 3.3 Products

- `GET /api/v2/products`
- `GET /api/v2/products/count`
- `GET /api/v2/products/{product_no}`

주요 포인트:
- `embed=options,variants,...` 지원
- 대량 조회시 `since_product_no` 고려
- `fields`로 부분 필드 조회 가능

### 3.4 Products decorationimages

- `GET /api/v2/products/{product_no}/decorationimages`

### 3.5 Products discountprice

- `GET /api/v2/products/{product_no}/discountprice`

### 3.6 Products hits

- `GET /api/v2/products/{product_no}/hits/count`

### 3.7 Products icons

- `GET /api/v2/products/{product_no}/icons`

### 3.8 Products options

- `GET /api/v2/products/{product_no}/options`

### 3.9 Products variants

- `GET /api/v2/products/{product_no}/variants`
- `GET /api/v2/products/{product_no}/variants/{variant_code}`

핵심 필드:
- `variant_code` (12자리, A-Z0-9)
- `additional_amount` (품목 추가금)
- `display`, `selling`

### 3.10 Products variants inventories

- `GET /api/v2/products/{product_no}/variants/{variant_code}/inventories`

### 3.11 Productsdetail

- `GET /api/v2/productsdetail/{product_no}`

---

## 4) Category/Personal 영역 엔드포인트

### Category

- `GET /api/v2/categories`
- `GET /api/v2/categories/count`
- `GET /api/v2/categories/{category_no}`

### Personal

- `POST /api/v2/carts`
- `GET /api/v2/products/{product_no}/carts/count`

---

## 5) 우리 시스템 적용 체크리스트

- 상품 키 표준화
  - [ ] `external_product_no`는 `product_no`로만 저장
  - [ ] `product_code`는 보조 컬럼으로 분리 저장
- 품목 키 강제
  - [ ] `external_variant_code` = `variant_code` 고정
  - [ ] 내부 유니크: `(channel_id, master_item_id, external_variant_code)` active only
- API 호출 안정화
  - [ ] 모든 products/variants 조회에 `shop_no` 명시
  - [ ] 429 대응(재시도 + 헤더 기반 지연)

---

## 6) 원문 빠른 이동 가이드

아래 섹션은 원문 파일에서 바로 확인 가능:

- Introduction: `web/docs/Cafe24/ProductAPI.md` (약 97행)
- Products: `web/docs/Cafe24/ProductAPI.md` (약 1134행)
- Products options: `web/docs/Cafe24/ProductAPI.md` (약 3259행)
- Products variants: `web/docs/Cafe24/ProductAPI.md` (약 3418행)
- Products variants inventories: `web/docs/Cafe24/ProductAPI.md` (약 3650행)
- Productsdetail: `web/docs/Cafe24/ProductAPI.md` (약 3761행)

---

## 7) 참고

- 원문은 탭/언어 예시(JS/cURL 등)까지 포함되어 길이가 큽니다.
- 이 정리본은 "설계/매핑/검증"에 필요한 항목 중심으로 재배치했습니다.

---

## 8) 조회 가능 범위 vs 수정 반영 경로

아래는 `ProductAPI.md` 기준으로, 어떤 것은 "조회"이고 어떤 것은 우리 시스템에서 "수정/반영"하는지 구분한 표입니다.

| 구분 | 용도 | 주요 엔드포인트/경로 | 비고 |
|---|---|---|---|
| Cafe24 Front API | 상품/옵션/품목 정보 조회 | `GET /api/v2/products`, `GET /api/v2/products/{product_no}`, `GET /api/v2/products/{product_no}/options`, `GET /api/v2/products/{product_no}/variants` | 문서상 조회 중심 |
| Cafe24 Front API | 품목 재고/부가정보 조회 | `GET /api/v2/products/{product_no}/variants/{variant_code}/inventories`, `GET /api/v2/products/{product_no}/discountprice`, `GET /api/v2/productsdetail/{product_no}` | 운영 참고 데이터 |
| 우리 시스템 API | 가격 반영(push) | `/api/channel-prices/push` | 수동 반영 |
| 우리 시스템 API | 자동 반영(run 생성/실행) | `/api/price-sync-runs-v2`, `/api/price-sync-runs-v2/{run_id}/execute`, `/api/cron/shop-sync-v2` | 5/10분 자동화 |
| 우리 시스템 UI | 바닥가/자동화 운영 | `/settings/shopping/auto-price` | 신규 운영 화면 |

핵심 정리:
- Front 문서는 "읽기" 기준 이해용
- 실제 "가격/옵션 반영"은 우리 시스템 파이프라인(재계산 + push)으로 관리

---

## 9) 내가 할 수 있는 것 (운영자 체크리스트)

### A. 지금 바로 할 수 있는 것

1. `/settings/shopping/auto-price` 접속
2. 채널 선택
3. 마스터별 바닥가 저장
4. Run 생성 (5분/10분, 전체 또는 특정 master)
5. Run 실행
6. Intent 상세에서 product_no/variant_code/desired/floor/clamp/state 확인

### B. 상태 해석

- `clamp = Y`: 바닥가 때문에 목표가를 올려서 반영
- `state = SUCCEEDED`: 반영/검증 성공
- `state = SKIPPED`: 정책/옵션타입 조건으로 자동 제외
- `state = FAILED`: 매핑/검증/API 오류로 실패

### C. 안 될 때 먼저 볼 것

1. 연동 상태(가시화) 카드: 미연동 마스터 수
2. 바닥가 미설정 여부 (미설정이면 run 생성 실패)
3. 동기화 로그: `/settings/shopping/sync-jobs`

### D. 자동화 운영

- 수동 점검 시: Run 생성/실행 버튼 사용
- 완전 자동 운영 시: `/api/cron/shop-sync-v2`를 스케줄러(5/10분)로 호출
- 보안: `SHOP_SYNC_CRON_SECRET` 필수
