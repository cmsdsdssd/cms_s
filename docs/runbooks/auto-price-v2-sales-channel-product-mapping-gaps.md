# Auto-Price v2 매핑 누락 런북 (`sales_channel_product`)

## 1) 개요

- 증상: 자동동기화 run 생성 직후 `total_count=0` 또는 기대보다 작음
- 대표 사유: `reason=NO_ACTIVE_MAPPING_FOR_SNAPSHOT_ROWS`
- 원인: `pricing_snapshot.channel_product_id`에 대응되는 활성 매핑(`sales_channel_product.is_active=true` + `external_product_no`)이 없음

## 2) 우선 확인 지표

- Run 생성 응답 또는 `price_sync_run_v2.request_payload.summary`에서 다음 필드 확인
  - `snapshot_rows_with_channel_product_count`
  - `missing_active_mapping_row_count`
  - `missing_active_mapping_product_count`
  - `missing_active_mapping_master_count`
  - `missing_active_mapping_samples`
- `missing_active_mapping_product_count > 0`이면 데이터 매핑 이슈로 간주

## 3) 진단 절차

1. 최신 run의 요약 확인
   - 대상: `price_sync_run_v2.request_payload.summary`
   - 기대: 누락 시 샘플(`channel_product_id`, `master_item_id`, `compute_request_id`)이 존재
2. 누락 샘플 기반 활성 매핑 조회
   - `sales_channel_product`에서 동일 `channel_id + channel_product_id` 행 존재/활성 여부 확인
3. 외부 상품번호 검증
   - 활성 행의 `external_product_no`가 비어있지 않은지 확인
4. 변형 상품 매핑 검증
   - variant의 경우 `external_variant_code`가 원천 채널 구조와 일치하는지 확인

## 4) SQL 점검 템플릿

```sql
-- A. run summary 확인
select run_id, status, started_at, request_payload
from price_sync_run_v2
where channel_id = :channel_id
order by started_at desc
limit 5;

-- B. 누락 channel_product_id 활성 매핑 확인
select channel_product_id, is_active, external_product_no, external_variant_code, updated_at
from sales_channel_product
where channel_id = :channel_id
  and channel_product_id = any(:channel_product_ids)
order by channel_product_id, updated_at desc;

-- C. 스냅샷 기준 실제 대상 확인
select channel_product_id, master_item_id, compute_request_id
from pricing_snapshot
where channel_id = :channel_id
  and compute_request_id = :compute_request_id
  and channel_product_id = any(:channel_product_ids);
```

## 5) 대응 절차

1. 누락 `channel_product_id`에 대해 `sales_channel_product` 활성 매핑 생성 또는 복구
2. `external_product_no` 공란이면 유효 값으로 보정
3. base/variant 관계가 깨진 경우 `external_variant_code`를 함께 정합화
4. 수정 후 `force_full_sync=1`로 run 재생성

## 6) 복구 검증 체크리스트

- run 생성 응답에서 `missing_active_mapping_product_count=0` 또는 감소 확인
- `total_count > 0` 확인
- execute/push 후 `price_sync_intent_v2`, `price_sync_push_task_v2` 생성 확인
- UI(자동가격 페이지) 경고 카드에서 누락 샘플이 사라졌는지 확인

## 7) 주의사항

- 코드 이슈로 오인하기 쉬우나, 대부분 데이터 매핑 상태 이슈
- `is_active=false` 행이 남아있어도 활성 행이 없으면 누락으로 집계됨
- 동일 `channel_product_id`에 중복 매핑이 있으면 최신/활성 기준을 먼저 정리

## 8) 런타임 검증 스크립트 (`verify:auto-price-v2`)

로컬/스테이징에서 run 생성 + execute + 결과/누락 요약을 한 번에 확인할 때 사용합니다.

사전 조건:
- `web/.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 설정
- `/api/*` 호출이 막히면 `CMS_E2E_BYPASS_AUTH=1`(또는 로그인 세션) 필요

```bash
# run 생성 + execute (기본 12회 루프, 1초 폴링)
CMS_E2E_BYPASS_AUTH=1 pnpm -C web verify:auto-price-v2 -- --channel-id <channel_id> --force-full-sync

# run 생성만 (execute 생략)
CMS_E2E_BYPASS_AUTH=1 pnpm -C web verify:auto-price-v2 -- --channel-id <channel_id> --execute-loops 0

# (옵션) storefront 옵션 breakdown까지 함께 확인
CMS_E2E_BYPASS_AUTH=1 pnpm -C web verify:auto-price-v2 -- --channel-id <channel_id> --mall-id <mall_id> --product-no <product_no> --token <optional_token>
```

주요 플래그:
- `--base-url http://localhost:3000` (기본값)
- `--compute-request-id <id>` (compute_request_id 고정)
- `--min-change-krw <n>`, `--poll-ms <n>`, `--execute-loops <n>`

## 9) API 인증 없이 DB 기준 매핑 누락 점검 (`inspect:auto-price-v2-mapping-gaps`)

API 호출(런 생성/execute)이 인증으로 막히는 환경에서도, `pricing_snapshot` + `sales_channel_product` 조인 기준으로 누락 매핑을 바로 확인할 수 있습니다.

```bash
# 최신 compute_request_id(스냅샷 다빈도) 기준 누락 점검
npm --prefix web run inspect:auto-price-v2-mapping-gaps -- --channel-id <channel_id>

# 특정 compute_request_id 고정 점검
npm --prefix web run inspect:auto-price-v2-mapping-gaps -- --channel-id <channel_id> --compute-request-id <id>
```

출력 포인트:
- `missing_active_mapping_row_count`
- `missing_active_mapping_product_count`
- `missing_active_mapping_master_count`
- `missing_sample` / `missing_mapping_detail`
- `repair_command_hint` (즉시 실행 가능한 복구 명령)

## 10) compute scope 해석 가이드 (최신 vs 과거)

`inspect-price-sync-mapping-gaps.js`는 `--compute-request-id` 미지정 시 다음 우선순위로 scope를 선택합니다.

1. 최신 `pricing_snapshot` 행의 `compute_request_id` (`compute_request_source=snapshot_latest`)
2. `pricing_compute_cursor` 최신값 중 snapshot window와 교집합이 있는 `compute_request_id`
3. snapshot window 내 최빈 `compute_request_id`

운영 해석 원칙:
- 기본 실행(미지정)은 현재 기준 상태 확인으로 간주합니다.
- `--compute-request-id` 지정 실행은 특정 시점 재현 또는 감사 용도입니다.
- 기본 실행에서 `missing_active_mapping_product_count=0`이면 현재 매핑은 정상입니다.
- 과거 compute에서만 `LEGACY_13_*` 누락이 보이면 현재 장애가 아니라 과거 snapshot 기준 불일치로 해석합니다.

## 11) product_no=13 canonical 정책

현재 운영 정책(권장):
- `channel_product_id=13`을 canonical 활성 매핑으로 유지
- 과거 compute scope에서 보이는 `LEGACY_13_*` 누락은 historical artifact로 분류
- run 생성/execute 성공과 최신 scope 누락 0을 우선 SLO 판단 기준으로 사용

정책 확인 절차:
```bash
# 1) 최신 기준(현재 상태) 확인
npm --prefix web run inspect:auto-price-v2-mapping-gaps -- --channel-id <channel_id>

# 2) 과거 compute 기준(재현) 확인
npm --prefix web run inspect:auto-price-v2-mapping-gaps -- --channel-id <channel_id> --compute-request-id <historical_compute_id>

# 3) run 생성 + execute 종단 확인
CMS_E2E_BYPASS_AUTH=1 pnpm -C web verify:auto-price-v2 -- --channel-id <channel_id> --force-full-sync
```

판정 기준:
- 1)에서 누락 0 + 3) 성공이면 현재 운영 관점 정상
- 2)에서 legacy 누락이 보여도 1)와 3)이 정상이라면 별도 장애로 분류하지 않음

