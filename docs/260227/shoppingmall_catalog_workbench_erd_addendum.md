# ERD Addendum: Catalog-Style 워크벤치 확장 모델

- 문서 버전: v1.0
- 작성일: 2026-02-27
- 기준 문서: `docs/260227/shoppingmall_erd_final.md`
- 목적: Summary/Batch Preview/Fallback Source 가시성을 위한 최소 확장

---

## 1. 설계 원칙

1. 기존 테이블을 파괴하지 않는다(add-only).
2. 기존 `pricing_snapshot`, `channel_price_snapshot`, `price_sync_job*`를 중심으로 확장한다.
3. fallback 출처(global/channel/item)를 조회 시점에 추론 가능하도록 명시 필드를 추가한다.

---

## 2. 신규 ENUM

```sql
create type shop_e_factor_source as enum (
  'ITEM_OVERRIDE',
  'CHANNEL_SET',
  'GLOBAL_DEFAULT',
  'SYSTEM_DEFAULT'
);

create type shop_e_batch_preview_status as enum (
  'READY',
  'EXCLUDED'
);
```

---

## 3. 기존 테이블 확장 (ALTER)

## 3.1 `pricing_snapshot`

추가 컬럼:

- `factor_source shop_e_factor_source not null default 'SYSTEM_DEFAULT'`
- `policy_id_used uuid null` (FK -> `pricing_policy.policy_id`)
- `is_auto_run boolean not null default false`

의도:

- 각 row의 최종 factor 출처를 대시보드에서 즉시 표시
- 어떤 정책으로 계산됐는지 추적 가능
- 자동/수동 실행 구분

## 3.2 `price_sync_job`

추가 컬럼:

- `change_set_id text null` (운영자 공유용 참조번호)
- `preview_excluded_count int not null default 0`

의도:

- 일괄 반영 결과를 운영 증적(reference id)으로 남김
- preview 단계 제외건과 실제 실행건 분리

---

## 4. 신규 테이블

## 4.1 `price_sync_preview`

일괄 반영 전 "적용 예정/제외" 스냅샷 저장.

| 컬럼 | 타입 | Null | 기본값 | 설명 |
|---|---|---|---|---|
| preview_id | uuid | N | gen_random_uuid() | PK |
| channel_id | uuid | N |  | FK -> sales_channel |
| requested_by | uuid | Y |  | 사용자 |
| created_at | timestamptz | N | now() | 생성시각 |
| request_payload | jsonb | Y |  | 필터/선택조건 |
| row_count | int | N | 0 | 전체 row |
| ready_count | int | N | 0 | READY 건수 |
| excluded_count | int | N | 0 | EXCLUDED 건수 |

인덱스:

- `idx_price_sync_preview_channel_created(channel_id, created_at desc)`

## 4.2 `price_sync_preview_item`

preview row detail.

| 컬럼 | 타입 | Null | 기본값 | 설명 |
|---|---|---|---|---|
| preview_item_id | uuid | N | gen_random_uuid() | PK |
| preview_id | uuid | N |  | FK -> price_sync_preview |
| channel_id | uuid | N |  | FK -> sales_channel |
| channel_product_id | uuid | Y |  | FK -> sales_channel_product |
| master_item_id | uuid | Y |  | FK -> cms_master_item.master_item_id |
| external_product_no | text | N |  | 상품번호 |
| before_price_krw | numeric(18,0) | Y |  | 현재가 |
| target_price_krw | numeric(18,0) | Y |  | 반영 예정가 |
| diff_krw | numeric(18,0) | Y |  | 차액 |
| status | shop_e_batch_preview_status | N | 'READY' | READY/EXCLUDED |
| exclusion_code | text | Y |  | 예: MISSING_TARGET |
| exclusion_message | text | Y |  | 제외 사유 |
| factor_source | shop_e_factor_source | N | 'SYSTEM_DEFAULT' | 출처 |
| snapshot_id | uuid | Y |  | FK -> pricing_snapshot |
| created_at | timestamptz | N | now() | 생성시각 |

인덱스:

- `idx_price_sync_preview_item_preview(preview_id)`
- `idx_price_sync_preview_item_status(preview_id, status)`
- `idx_price_sync_preview_item_master(channel_id, master_item_id, created_at desc)`

---

## 5. 신규 뷰

## 5.1 `v_channel_price_summary`

목적: 상단 Summary Bar 집계.

핵심 컬럼:

- `channel_id`
- `latest_tick_as_of`
- `latest_pull_at`
- `latest_recompute_at`
- `latest_push_at`
- `active_policy_id`
- `active_factor_set_id`
- `active_factor_scope` (`GLOBAL`/`CHANNEL`)
- `row_total`, `row_error`, `row_out_of_sync`, `row_override`, `row_adjustment`

## 5.2 `v_channel_price_dashboard_workbench`

기존 `v_channel_price_dashboard` 확장뷰.

추가 컬럼:

- `material_code`
- `net_weight_g`
- `factor_source`
- `tick_as_of`
- `last_sync_status`
- `last_sync_http_status`

---

## 6. 정합성 규칙

1. preview 단계에서 `EXCLUDED` row는 push 입력에서 자동 제외한다.
2. push job 생성 시 원본 preview_id를 `request_payload`에 보존한다.
3. `factor_source`는 계산 시점 결과를 저장하고 조회 중 재추론하지 않는다.
4. default fallback은 항상 `ITEM_OVERRIDE -> CHANNEL_SET -> GLOBAL_DEFAULT -> SYSTEM_DEFAULT` 순으로 판정한다.

---

## 7. 마이그레이션 권장 순서

1. enum 추가 (`shop_e_factor_source`, `shop_e_batch_preview_status`)
2. `pricing_snapshot`, `price_sync_job` alter
3. `price_sync_preview`, `price_sync_preview_item` 생성
4. summary/workbench view 추가
5. 인덱스 보강 및 explain 검증
