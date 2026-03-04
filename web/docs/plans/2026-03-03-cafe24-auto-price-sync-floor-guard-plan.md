# Cafe24 자동 가격 동기화 실행계획 (5/10분 Cron, Floor Guard, SoT 불변)

## 1) 목적 (지금 목표)

- 사용자가 설정한 가격 정책이 **자동으로** Cafe24에 반영되도록 한다.
- 반영 주기: **5분 또는 10분 Cron**.
- 어떤 상황에서도 SoT가 깨지지 않게 한다.
- 모든 상품에 대해 `floor_price_krw`(바닥가) 미만으로는 절대 반영하지 않는다.

본 문서는 다음을 기준으로 작성됨:
- Cafe24 문서 원문: `web/docs/Cafe24/ProductAPI.md`
- v2 PRD/ERD: `web/docs/plans/2026-03-03-pricing-v2-reset-prd-erd-ui-ko.md`
- 현재 구현 파이프라인: `web/src/app/api/cron/shop-sync/route.ts`, `web/src/app/api/channel-prices/push/route.ts`

---

## 2) 외부 API 사실(계획 근거)

Cafe24 문서에서 동기화 설계에 중요한 사실:

- `product_no`: 쇼핑몰 내 유일
- `product_code`: 쇼핑몰 내 유일
- `variant_code`: 쇼핑몰 내 유일
- `additional_amount`: 품목 추가금 필드
- Front 문서 기준 Product/Variant는 조회 중심(GET), 호출 제한 40, 429 제한 존재

실행 정책:
- 내부 식별 표준은 `product_no` + `variant_code`로 고정
- `product_code`는 보조 정보로만 저장
- 자동 동기화는 레이트리밋(429) 대비 backoff 필수

---

## 3) 현재 파이프라인 요약(이미 있는 것)

`/api/cron/shop-sync`는 이미 다음 순서로 동작:

1. pull
2. recompute (`compute_request_id` 생성)
3. push (`compute_request_id` 전달)

장점:
- push에 `compute_request_id`를 강제해 결정론 강화됨

남은 공백:
- floor guard가 cron 파이프라인에서 "강제 불변식"으로 명시되지 않음
- 제품별 intent/outbox가 없어 대규모 재시도 시 운영 추적성/멱등성 강화 여지 있음
- `external_product_no` 혼용(숫자/코드)로 중복 매핑 재발 가능

---

## 4) 최종 아키텍처 (SoT 절대 불변)

핵심 원칙 4개:

1. **Compute-then-Push 2단계 고정**
   - Cron 실행마다 단 하나의 pinned `compute_request_id`를 사용
   - 재시도는 recompute 금지, 저장된 intent만 재전송

2. **Floor Guard 전역 강제**
   - 계산식: `final_target_price_krw = max(final_target_before_floor_krw, floor_price_krw)`
   - floor 미설정 상품은 저장/재계산 차단 (기존 합의사항)

3. **신규 intent/outbox 레이어 추가**
   - push 전송 대상과 값을 내구적으로 저장
   - 작업 재시도/중복호출에도 같은 결과 보장

4. **식별자 정규화 + 유니크 제약**
   - `external_product_no`는 `product_no`로 통일
   - active 중복 차단: `(channel_id, master_item_id, external_variant_code)` partial unique

---

## 5) 데이터 설계 추가 (자동화 전용)

기존 v2 테이블 위에 아래 3개를 추가한다.

### 5.1 `price_sync_run_v2`
- 목적: Cron 1회 실행 헤더
- 주요 컬럼:
  - `run_id` (pk)
  - `channel_id`
  - `pinned_compute_request_id`
  - `interval_minutes` (5/10)
  - `status` (RUNNING/SUCCESS/PARTIAL/FAILED)
  - `started_at`, `finished_at`
  - `trigger_type` (AUTO/MANUAL)

### 5.2 `price_sync_intent_v2`
- 목적: "이번 run에서 이 상품을 이 가격으로 보낸다"를 내구 저장
- 주요 컬럼:
  - `intent_id` (pk)
  - `run_id`, `channel_id`, `channel_product_id`
  - `external_product_no`, `external_variant_code`
  - `compute_request_id`
  - `desired_price_krw`
  - `floor_price_krw`, `floor_applied` (bool)
  - `intent_version` (단조 증가)
  - `inputs_hash` (멱등 확인)
  - `state` (PENDING/PUSHING/SUCCEEDED/FAILED/SUPERSEDED)

### 5.3 `price_sync_push_task_v2`
- 목적: outbox 큐 + 재시도 관리
- 주요 컬럼:
  - `task_id` (pk)
  - `intent_id` (fk)
  - `idempotency_key` (`channel:product:variant:compute:desired_price`)
  - `attempt_count`, `next_retry_at`, `last_error`
  - `http_status`, `remote_price_krw`
  - `created_at`, `updated_at`

---

## 6) Cron 동작 시나리오 (5/10분 공통)

### Phase A: Snapshot Pin + Intent 생성

1. Cron 시작 -> `price_sync_run_v2` RUNNING 생성
2. `pricing_compute_cursor_v2`에서 채널/마스터별 최신 pinned compute 조회
3. 해당 compute의 `pricing_snapshot_v2`만 읽어 후보 생성
4. 각 후보에 floor guard 적용 여부 계산/기록
5. `price_sync_intent_v2` + `price_sync_push_task_v2` 적재

### Phase B: Push 실행

1. pending task를 배치로 가져옴
2. Cafe24 반영 (제품가/품목 additional_amount)
3. verify(read-after-write) 수행
4. 성공/실패 상태 저장
5. run 집계 상태 업데이트(SUCCESS/PARTIAL/FAILED)

중요:
- 재시도는 Phase A 재계산 없이 동일 intent 재사용
- 더 최신 intent가 있으면 이전 task는 `SUPERSEDED` 처리

---

## 7) 주기 정책 (5분 vs 10분)

권장 기본안:

- 기본: **10분**
- 피크 시간대(예: 10:00~19:00): **5분**
- 야간/저부하: 10분

이유:
- 5분 고정은 429/외부 변동/중첩 실행 리스크 증가
- 10분 기본 + 피크 5분이 안정성과 반영속도 균형이 가장 좋음

필수 환경값:
- `SHOP_SYNC_CRON_SECRET`
- `SHOP_SYNC_CHANNEL_ID` (멀티채널이면 런처에서 채널별 호출)
- `SHOP_SYNC_BATCH_LIMIT` (초기 20~50 권장)

---

## 8) SoT 불변식 (깨지면 실패 처리)

1. push는 반드시 `compute_request_id`가 있어야 한다
2. push 대상 가격은 반드시 pinned snapshot에서 왔어야 한다
3. `final_target_price_krw >= floor_price_krw` 항상 참
4. `delta_total_krw = 축별 delta 합` 항상 참
5. 같은 active variant 중복 0건
6. newer intent를 older run이 덮어쓰지 못함

DB/애플리케이션에서 모두 강제한다.

---

## 9) 운영 안전장치

- Kill switch: 자동 cron 즉시 중단
- Canary: 일부 master만 자동 동기화 허용
- Retry budget: task별 최대 재시도 횟수
- DLQ 성격 실패큐: 재시도 초과건 수동 처리
- 알림: PARTIAL/FAILED 비율, floor_applied 급증, 429 급증

---

## 10) 롤아웃 단계

### 단계 1: 준비
- 식별 정규화(`product_no` 통일)
- 중복 variant 정리 + 유니크 제약 적용

### 단계 2: 데이터/큐 추가
- `price_sync_run_v2`, `price_sync_intent_v2`, `price_sync_push_task_v2` 생성

### 단계 3: 파이프라인 전환
- cron이 직접 push하지 않고 intent/outbox를 통해 push

### 단계 4: 베타 병행
- 신규 자동화 탭(or 설정 UI)로 run 상태 모니터링
- 기존 수동 push와 동시 운영

### 단계 5: 전면 전환
- 자동화 run 성공률/불일치율 기준 통과 시 전면 전환

---

## 11) 수용 기준 (완료 판정)

- 7일 동안 SoT 위반 0건
- floor 미만 반영 0건
- 중복 active variant 0건 유지
- push 후 verify mismatch 비율 < 0.1%
- PARTIAL/FAILED run 즉시 알림 + 재처리 가능

---

## 12) 바로 실행할 다음 작업

1. SQL: 자동화 3개 테이블 + 유니크/체크 제약 migration 작성
2. API: cron -> intent 생성/소비 구조로 분리
3. 검증: 마스터 2개 canary로 5분 주기 시험
4. 운영: 경보 대시보드(성공률/429/floor_applied) 추가
