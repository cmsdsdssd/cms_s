# PRD: 쇼핑몰(카페24) 가격관리 및 DB 연동 시스템 (통합 대시보드 + 스냅샷 기반)

- 문서 버전: v3.0 (conversation 통합 정리본)
- 작성일: 2026-02-27
- 기준 범위: Cafe24 자사몰 v1, 멀티 채널 확장 고려
- 핵심 기준키: `cms_master_item.master_item_id` <-> `sales_channel_product.external_product_no`
- 핵심 설계 결론: 쇼핑몰별 개별 뷰 다수 생성이 아닌, `채널 컬럼 포함 단일 통합 뷰 + 스냅샷 테이블` 구조

---

## 1. 문제 정의 및 배경

현재 운영 요구는 다음 4가지를 동시에 만족해야 한다.

1. 마스터 데이터(중량/공임/소재)와 시세를 기준으로 권장가를 자동 계산한다.
2. 카페24 현재 판매가를 가져와 차이를 즉시 비교한다.
3. 선택한 상품만 골라 카페24 가격을 반영(push)한다.
4. 왜 이 가격이 되었는지 계산 근거와 변경 이력을 추적한다.

기존 운영 Pain Point:

- 시세/공임/정책이 바뀔 때 쇼핑몰 가격을 일괄 검증하기 어렵다.
- 계산 근거(브레이크다운)와 반영 이력이 분리되어 원인 추적이 어렵다.
- 상품별 예외 대응(수동 가감, 오버라이드)이 체계화되지 않았다.

따라서 본 PRD는 "분석/관리/반영"을 한 플로우로 통합하고, 추후 멀티 채널/상세페이지(bucket)까지 확장 가능한 구조를 정의한다.

---

## 2. 목표(Goals) / 비목표(Non-Goals)

## 2.1 Goals

- 단일 화면에서 `권장 목표가 vs 카페24 현재가` 차이를 확인한다.
- 선택 상품 일괄 push를 수행하고, 성공/실패를 item 단위로 기록한다.
- 가격 계산 결과를 스냅샷으로 남겨 "재현 가능성"을 확보한다.
- 소재 Factor를 `글로벌/채널별`로 운영하고 계산 시 선택 적용한다.
- 상품별 Adjustment(+/-)를 `공임 또는 총가격`, `마진 전/후`로 분기 적용한다.
- 향후 상세 페이지에서 bucket 연동이 가능하도록 데이터 모델 자리를 확보한다.

## 2.2 Non-Goals (이번 단계 제외)

- 네이버/쿠팡 등 타 채널 실연동 구현
- 옵션(variant)별 가격 동기화 고도화
- 쿠폰/프로모션/실결제가 최적화 엔진
- 완전 자동 동기화(초기에는 수동 중심 + 선택적 스케줄)

---

## 3. 성공 지표(Success Metrics)

- 매핑된 카페24 상품의 95% 이상에서 `권장가/현재가/차액`이 대시보드에 정상 표시된다.
- 운영자가 1회 작업으로 다건 push 수행 가능(선택 반영).
- push 결과 로그에 `응답코드/메시지/실패원인`이 100% 기록된다.
- 시세/정책 변경 후 재계산 시 snapshot 비교(전/후)가 가능하다.
- 재계산 결과와 대시보드 표기값 불일치 0건(동일 엔진 사용 보장).

---

## 4. 용어 정의

- Master Item: 내부 상품 마스터(`cms_master_item`)
- Channel: 판매 채널(카페24)
- Channel Product: 채널 상품(`external_product_no`, 카페24 `product_no`)
- Current Price: 카페24 API에서 pull한 현재 판매가
- Target Price: 산식으로 계산된 권장 목표가
- Final Target Price: `override`까지 반영한 최종 반영가
- Snapshot: 특정 시점의 시세/정책/조정값/산식 결과 저장본
- Factor Set: 소재가격 계산 multiplier 집합(글로벌/채널 스코프)
- Adjustment: 상품 단위 +/-(KRW) 조정 규칙

---

## 5. 사용자/권한

- 관리자(Admin): 채널 계정 관리, 정책 변경, push 실행 가능
- 운영자(Operator): 매핑/조회/재계산/시뮬레이션 가능, push는 제한 가능
- 조회자(Viewer): 대시보드/로그 조회만 가능

권한 원칙:

- `push`, `override`, `factor/policy` 수정은 관리자 권한만 허용
- 모든 변경작업은 감사 로그(audit trail) 필수

---

## 6. 범위 및 릴리즈 단계

## 6.1 v1 (필수)

- 채널/계정(카페24 OAuth) 등록
- 마스터 <-> 카페24 상품 매핑 CRUD
- 재계산 엔진(소재 + 총공임 + 마진 + 라운딩 + 오버라이드)
- 현재가 pull, 권장가/현재가 비교 대시보드
- 선택 반영(push) + 잡/아이템 로그

## 6.2 v1.5 (대화 반영 확장)

- Factor Set 운영: Global/Channel
- Adjustment 운영: LABOR/TOTAL x PRE/POST_MARGIN
- 대시보드 내 시뮬레이션(임시 factor set 선택)

## 6.3 v2 준비(데이터 자리만)

- 상세 페이지에서 bucket 연결
- 멀티 채널 확장

---

## 7. 가격 산식 요구사항(최종)

## 7.1 입력 데이터 소스

### 7.1.1 마스터/공임(내부 DB)

- `cms_master_item`
  - `master_item_id`(generated), `master_id`
  - `material_code_default`
  - `weight_default_g`, `deduction_weight_default_g`
  - `labor_base_sell`, `labor_center_sell`, `labor_sub1_sell`, `labor_sub2_sell`
  - `center_qty_default`, `sub1_qty_default`, `sub2_qty_default`
  - `plating_price_sell_default`
  - `center_stone_source_default`, `sub1_stone_source_default`, `sub2_stone_source_default`
- `cms_master_absorb_labor_item_v1`
  - `bucket`, `amount_krw`, `is_per_piece`, `priority`, `vendor_party_id`
- BOM 뷰
  - `cms_v_bom_recipe_worklist_v1`
  - `cms_v_bom_recipe_lines_enriched_v1` (`LINE_KIND:DECOR` 노트 기반 필터)

### 7.1.2 시세(내부/외부)

- 기본: `cms_v_market_tick_latest_by_symbol_ops_v1`
- 확장: 외부 provider 연동 가능(`tick_source` 추상화)

### 7.1.3 정책/예외(신규)

- 채널 정책(`margin_multiplier`, `rounding`)
- Factor Set(글로벌/채널)
- Adjustment(+/-)
- Override(강제 최종가)

## 7.2 계산 순서

1) 순중량

```text
net_weight_g = weight_default_g - deduction_weight_default_g
```

2) 소재 원가(raw)

```text
material_raw_krw = f(material_code, net_weight_g, tick_price_krw_per_g)
```

3) 소재 Factor 적용

```text
material_factor_multiplier = lookup(factor_set, material_code) default 1.0
material_final_krw = material_raw_krw * material_factor_multiplier
```

4) 총공임(raw)

```text
labor_raw_krw = compute_total_labor_sell(master + absorb + decor)
```

5) LABOR PRE_MARGIN Adjustment

```text
labor_pre_margin_adj_krw = sum(adj where apply_to=LABOR and stage=PRE_MARGIN)
labor_pre_margin_krw = labor_raw_krw + labor_pre_margin_adj_krw
```

6) TOTAL PRE_MARGIN Adjustment 포함하여 마진 전 총액 구성

```text
total_pre_margin_adj_krw = sum(adj where apply_to=TOTAL and stage=PRE_MARGIN)
base_total_pre_margin_krw = material_final_krw + labor_pre_margin_krw + total_pre_margin_adj_krw
```

7) 마진 적용

```text
total_after_margin_krw = base_total_pre_margin_krw * margin_multiplier
```

8) POST_MARGIN Adjustment

```text
labor_post_margin_adj_krw = sum(adj where apply_to=LABOR and stage=POST_MARGIN)
total_post_margin_adj_krw = sum(adj where apply_to=TOTAL and stage=POST_MARGIN)
target_price_raw_krw = total_after_margin_krw + labor_post_margin_adj_krw + total_post_margin_adj_krw
```

9) 라운딩

```text
rounded_target_price_krw = round(target_price_raw_krw, rounding_rule)
```

10) 오버라이드

```text
final_target_price_krw = override_price_krw ?? rounded_target_price_krw
```

## 7.3 라운딩 정책

- 지원 단위: 10/100/1000원
- 모드: CEIL/ROUND/FLOOR
- v1 기본: `1000원 올림(CEIL)`

## 7.4 Adjustment 적용 규칙

- 다건 허용, 합산 적용
- `is_active=true` + 유효기간(`valid_from/valid_to`) 내 항목만 적용
- 기본 스코프: `channel_product_id` 단위
- 확장 스코프: `master_item_id` 단위 허용(옵션)

---

## 8. 기능 요구사항 (Functional Requirements)

## FR-001 채널 설정

- 채널 생성/조회/비활성화
- `channel_type=CAFE24` 고정 지원(v1)
- 채널명 예: 자사몰
- 계정 정보:
  - `mall_id`, `shop_no`
  - `access_token`, `refresh_token`, 만료시각
  - `api_version` (`X-Cafe24-Api-Version`)

수용 기준:

- OAuth 연결 상태(CONNECTED/EXPIRED/ERROR) 표시
- 만료 토큰 자동 갱신(가능 시) 또는 오류 표기

## FR-002 상품 매핑

- 매핑 CRUD: `master_item_id` <-> `external_product_no(product_no)`
- CSV 업로드/다운로드
- 자동 추천(코드 매칭) 옵션

검증 규칙:

- 동일 채널에서 `(channel_id, external_product_no)` 유니크
- 기본 정책 1:1, 예외로 1:N 확장 가능 플래그 제공

## FR-003 가격 정책 관리

- 채널 기본 마진/라운딩 설정
- 정책 우선순위 규칙(소재/카테고리/태그 등) 선택 적용
- 정책별 factor set 선택 가능

## FR-004 Factor 관리(신규)

- Factor Set 생성/수정/비활성화
- 스코프: `GLOBAL`, `CHANNEL`
- 채널 정책에서 사용 set 지정
- 글로벌 기본 set 1개 지정 가능

## FR-005 Adjustment 관리(신규)

- 대시보드 상세 Drawer에서 상품별 CRUD
- 필드: `apply_to`, `stage`, `amount`, `reason`, `valid_from`, `valid_to`, `is_active`
- 음수값 허용(차감)

## FR-006 재계산(Recompute)

- 대상: 전체/선택 master item
- 입력: `channel_id`, optional `master_item_ids`, optional `factor_set override`
- 출력: `pricing_snapshot` 저장

수용 기준:

- 동일 입력이면 같은 결과 재현 가능(시세 시점 포함)
- 계산 근거가 `breakdown_json`으로 저장됨

## FR-007 현재가 Pull

- 카페24에서 현재 판매가 조회
- `channel_price_snapshot` 저장
- 실패코드(401/429/5xx)별 메시지 저장

## FR-008 가격 Push

- 선택 상품/필터 결과 일괄 반영
- 실행 전 preview 리스트 제공
- 실행 후 `price_sync_job`, `price_sync_job_item` 저장

수용 기준:

- item 단위 상태(SUCCESS/FAILED/SKIPPED) 확인 가능
- before/after 가격, 오류 메시지 기록

## FR-009 통합 대시보드

- 핵심 컬럼:
  - master_item_id, 상품명
  - 소재코드, 순중량
  - 시세(as_of)
  - 소재(raw/factor/final)
  - 공임(raw + adjustment)
  - 마진/라운딩/factor set
  - 권장가(final_target_price)
  - 현재가(current_price)
  - 차액(원, %), 상태
- 필터:
  - 차액 임계값, 소재, 중량 범위
  - 에러만, 오버라이드만, adjustment 존재만
- 정렬:
  - 차액 큰 순, 최신 동기화 순

## FR-010 동기화 로그

- job 목록/상세
- 실행자, 실행 타입(MANUAL/AUTO), 성공/실패 건수
- 응답코드 및 오류 전문 확인

## FR-011 향후 상세페이지 및 Bucket 고려

- 이번 버전은 미구현
- ERD에 `bucket`, `bucket_master_item` 자리 확보

---

## 9. 외부 연동 요구사항 (Cafe24)

- 인증: OAuth2
- 토큰:
  - access token 유효기간(단기)
  - refresh token 갱신 시 신규 토큰 교체 로직 필요
- API 버전: `X-Cafe24-Api-Version` 헤더 고정 지원
- 레이트리밋:
  - `429` 처리
  - usage 헤더 기반 backoff/retry

---

## 10. 백엔드 구현 계획

## 10.1 모듈 구성

1. Pricing Engine (TS)
   - `computeMaterialAmount(...)`
   - `computeTotalLaborSell(...)`
   - `applyFactorSet(...)`
   - `applyAdjustments(...)`
   - `computeFinalTargetPrice(...)`

2. Channel Connector Interface
   - `pullCurrentPrices(productNos[])`
   - `pushPrices(items[])`
   - `ensureValidAccessToken()`

3. Cafe24 Connector
   - OAuth refresh
   - rate-limit backoff
   - API version header 주입

4. Snapshot Service
   - recompute 결과 저장
   - latest snapshot 조회

5. Sync Job Service
   - push job 생성
   - item별 결과 집계

## 10.2 API 초안

- `GET /api/channels`
- `POST /api/channels`
- `GET /api/channels/:id/account`
- `POST /api/channels/:id/account`
- `GET /api/channel-products?channel_id=...`
- `POST /api/channel-products` (upsert)
- `DELETE /api/channel-products/:id`
- `GET /api/pricing-policies?channel_id=...`
- `PUT /api/pricing-policies/:id`
- `GET /api/material-factor-sets`
- `POST /api/material-factor-sets`
- `PUT /api/material-factor-sets/:id`
- `GET /api/pricing-adjustments?channel_product_id=...`
- `POST /api/pricing-adjustments`
- `PUT /api/pricing-adjustments/:id`
- `DELETE /api/pricing-adjustments/:id`
- `POST /api/pricing/recompute`
- `POST /api/channel-prices/pull`
- `POST /api/channel-prices/push`
- `GET /api/price-sync-jobs?channel_id=...`
- `GET /api/price-sync-jobs/:job_id`

## 10.3 트랜잭션 및 멱등성

- push job 단위 트랜잭션 + item 단위 실패 분리(부분 성공 허용)
- 멱등성 키(`idempotency_key`) 적용 권장
- 동일 payload 재전송 시 중복 반영 방지

## 10.4 오류 처리 표준

- 401: 토큰 만료/권한 문제
- 409: 매핑 충돌
- 422: 정책/계산 입력 오류
- 429: rate limit(재시도 안내)
- 5xx: 외부 API/내부 장애

모든 오류는 사용자 메시지 + 디버그 상세(로그)로 분리 표시한다.

---

## 11. 프론트엔드 구현 계획

## 11.1 IA

- 쇼핑몰 관리
  - 채널 설정
  - 상품 매핑
  - 가격 대시보드(핵심)
  - 동기화 로그
  - 소재 Factor 관리

## 11.2 화면 상세

### (1) 채널 설정

- 연결 상태 배지
- 토큰 만료 시각, API 버전 표시
- v1 MVP: 수동 토큰 입력 허용

### (2) 상품 매핑

- 마스터 검색 + 카페24 product_no 검색
- CSV 업로드/다운로드
- 중복/누락 상태 표시

### (3) 가격 대시보드 (핵심)

상단 컨트롤:

- 현재가 불러오기
- 재계산
- 선택 반영(push)
- 기본 정책 quick edit
- (선택) factor set 시뮬레이션

테이블:

- diff 중심 정렬/필터
- 멀티 선택 bulk push

상세 Drawer:

- 소재 raw/factor/final breakdown
- 총공임 breakdown(기본/센터/서브/도금/흡수/장식)
- adjustment 리스트
- 적용 정책/오버라이드
- 마지막 동기화 결과

### (4) 동기화 로그

- job 목록(수행자/유형/성공률)
- job 상세(item 결과/오류 메시지)

### (5) 소재 Factor 관리

- factor set 목록(scope, active, default)
- 소재코드별 multiplier 편집

---

## 12. 비기능 요구사항 (NFR)

## 12.1 성능

- 대시보드 초기 로딩 2초 이내(기본 페이지 기준)
- 대량 push 시 비동기 job 처리
- 최신 스냅샷 조회 인덱스 필수

## 12.2 안정성

- pull/push 재시도(backoff)
- 부분 실패 허용 + 실패 항목 재실행
- 외부 API 장애 시 graceful degradation

## 12.3 보안

- 카페24 토큰 암호화 저장
- 관리자 전용 엔드포인트 분리
- 모든 변경작업 audit log 저장

## 12.4 관측성

- 요청 ID/잡 ID 추적
- API latency, 실패율, 429 비율 지표화

---

## 13. 운영 시나리오 (요구사항 대응 예시)

1) 자사몰만 소재 factor 1.03 적용

- 채널 전용 factor set 생성 -> 자사몰 정책에 지정

2) 전체 쇼핑몰 공통 factor 변경

- global default factor set 변경 또는 교체

3) 특정 상품 공임 -5000

- adjustment: `apply_to=LABOR`, `stage=PRE_MARGIN`, `amount=-5000`

4) 특정 상품 최종가 +9900

- adjustment: `apply_to=TOTAL`, `stage=POST_MARGIN`, `amount=9900`

5) 강제 최종가 적용

- override 등록 -> `final_target_price_krw` 우선 사용

---

## 14. 수용 기준(Acceptance Criteria)

## AC-01 계산 정합

- 동일 입력 조건 재계산 시 결과가 동일해야 한다.
- 대시보드 값과 snapshot 저장값이 일치해야 한다.

## AC-02 동기화 정합

- push 성공 항목은 카페24 현재가 pull 시 반영값과 일치해야 한다.
- 실패 항목은 원인 코드/메시지가 저장되어야 한다.

## AC-03 정책 반영

- factor set 변경 후 재계산 시 소재금액 변화가 반영되어야 한다.
- adjustment 적용 대상/단계가 올바르게 반영되어야 한다.

## AC-04 운영 추적

- 특정 상품에 대해 "어떤 정책/시세/조정으로 계산되었는지" 1회 조회로 확인 가능해야 한다.

---

## 15. 테스트 시나리오 (요약)

- T1: 매핑 없는 상품 -> 대시보드 상태 경고
- T2: 토큰 만료 -> 자동 refresh 또는 오류 표시
- T3: factor set 전환 전/후 재계산 비교
- T4: LABOR PRE_MARGIN 음수 조정 반영 확인
- T5: TOTAL POST_MARGIN 양수 조정 반영 확인
- T6: override 적용 시 최종가 우선 확인
- T7: 429 발생 시 retry/backoff 및 로그 기록
- T8: push 부분 실패 시 나머지 항목 성공 보장

---

## 16. 최종 설계 결론

- 단일 통합 뷰 + snapshot 구조가 분석/관리/동기화를 동시에 만족하는 최적안이다.
- Factor(글로벌/채널), Adjustment(공임/총액 + 마진 전/후), Override를 분리 모델링하면 운영 대응력이 높다.
- bucket은 지금 즉시 구현하지 않더라도 ERD 자리 선확보가 맞다.
