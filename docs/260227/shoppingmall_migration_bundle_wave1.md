# 쇼핑몰 가격관리 1차 마이그레이션 번들 (파일명/순서/검증)

## 0) 문서 메타
- 기준 문서:
  - `docs/260227/shoppingmall_prd_final.md`
  - `docs/260227/shoppingmall_erd_final.md`
  - `docs/260227/shoppingmall_implementation_master_checklist.md`
- 목적: 체크리스트 기반 구현을 위한 1차 DB 마이그레이션 묶음을 파일 단위로 고정
- 적용 환경: local -> staging -> production 순차 적용
- 원칙: add-only, 기존 `cms_*` 핵심 흐름 비파괴

---

## 1) 번들 개요

Wave1 대상:
- ENUM/핵심 테이블/인덱스
- 정책/Factor/Adjustment/Override
- Snapshot/Pull/Push Job
- Latest 보조뷰 + 통합 Dashboard View
- 권한/그랜트 + 스모크 시드

총 파일 수: 8개

---

## 2) 파일 목록 (실행 순서 고정)

1. `supabase/migrations/20260227110000_cms_1001_shop_channel_core_addonly.sql`
2. `supabase/migrations/20260227111000_cms_1002_shop_policy_factor_addonly.sql`
3. `supabase/migrations/20260227112000_cms_1003_shop_adjustment_override_addonly.sql`
4. `supabase/migrations/20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`
5. `supabase/migrations/20260227114000_cms_1005_shop_latest_views_addonly.sql`
6. `supabase/migrations/20260227115000_cms_1006_shop_dashboard_view_addonly.sql`
7. `supabase/migrations/20260227116000_cms_1007_shop_security_grants_addonly.sql`
8. `supabase/migrations/20260227117000_cms_1008_shop_seed_and_smoke_addonly.sql`

주의:
- 현재 리포의 최신 마이그레이션 타임스탬프(`20260225162000_*`) 이후 값으로 지정됨
- 파일명/순서를 변경하면 의존성이 깨질 수 있으므로 고정한다

---

## 3) 파일별 상세 스펙

## 3.1 `20260227110000_cms_1001_shop_channel_core_addonly.sql`

목표:
- 채널/계정/매핑 코어 객체 생성

포함 객체:
- ENUM
  - `shop_e_channel_type`
  - `shop_e_account_status`
- TABLE
  - `sales_channel`
  - `sales_channel_account`
  - `sales_channel_product`
- INDEX/CONSTRAINT
  - `uq_sales_channel_code`
  - `uq_sales_channel_account_channel`
  - `uq_sales_channel_product_ext(channel_id, external_product_no)`
  - `idx_sales_channel_product_master(channel_id, master_item_id)`
- TRIGGER
  - `updated_at` 자동 갱신 트리거

검증 쿼리:

```sql
select to_regclass('public.sales_channel');
select to_regclass('public.sales_channel_account');
select to_regclass('public.sales_channel_product');

select indexname
from pg_indexes
where schemaname='public'
  and tablename in ('sales_channel','sales_channel_account','sales_channel_product');
```

체크리스트 매핑:
- `DB-ENUM-001`, `DB-ENUM-002`
- `DB-CH-001`~`DB-CH-013`

---

## 3.2 `20260227111000_cms_1002_shop_policy_factor_addonly.sql`

목표:
- 정책/Factor 구조 생성

포함 객체:
- ENUM
  - `shop_e_rounding_mode`
  - `shop_e_factor_scope`
- TABLE
  - `pricing_policy`
  - `pricing_policy_rule`
  - `material_factor_set`
  - `material_factor`
- CONSTRAINT
  - `margin_multiplier >= 0`
  - `rounding_unit > 0`
  - factor scope/channel check
  - factor multiplier > 0
- INDEX
  - `uq_pricing_policy_channel_active` (partial)
  - `uq_material_factor_set_global_default` (partial)
  - `uq_material_factor_set_code(factor_set_id, material_code)`

검증 쿼리:

```sql
select to_regclass('public.pricing_policy');
select to_regclass('public.material_factor_set');
select to_regclass('public.material_factor');

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid in (
  'public.pricing_policy'::regclass,
  'public.material_factor_set'::regclass,
  'public.material_factor'::regclass
);
```

체크리스트 매핑:
- `DB-ENUM-003`, `DB-ENUM-004`
- `DB-POL-001`~`DB-POL-008`
- `DB-FAC-001`~`DB-FAC-008`

---

## 3.3 `20260227112000_cms_1003_shop_adjustment_override_addonly.sql`

목표:
- Adjustment/Override 구조 생성

포함 객체:
- ENUM
  - `shop_e_adjust_apply_to`
  - `shop_e_adjust_stage`
  - `shop_e_adjust_amount_type`
- TABLE
  - `pricing_adjustment`
  - `pricing_override`
- TRIGGER
  - `pricing_adjustment`의 `channel_id` 정합성 체크
- INDEX
  - adjustment 활성/유효기간 조회 인덱스
  - override 활성 조회 인덱스

검증 쿼리:

```sql
select to_regclass('public.pricing_adjustment');
select to_regclass('public.pricing_override');

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid in (
  'public.pricing_adjustment'::regclass,
  'public.pricing_override'::regclass
);
```

체크리스트 매핑:
- `DB-ENUM-005`~`DB-ENUM-007`
- `DB-ADJ-001`~`DB-ADJ-008`
- `DB-OVR-001`~`DB-OVR-004`

---

## 3.4 `20260227113000_cms_1004_shop_snapshot_sync_tables_addonly.sql`

목표:
- 가격 계산/동기화 이력 테이블 생성

포함 객체:
- ENUM
  - `shop_e_sync_job_status`
  - `shop_e_sync_item_status`
  - `shop_e_run_type`
- TABLE
  - `pricing_snapshot`
  - `channel_price_snapshot`
  - `price_sync_job`
  - `price_sync_job_item`
- INDEX
  - snapshot latest 인덱스
  - channel price latest 인덱스
  - job status/started_at 인덱스
  - job_item job_id 인덱스

검증 쿼리:

```sql
select to_regclass('public.pricing_snapshot');
select to_regclass('public.channel_price_snapshot');
select to_regclass('public.price_sync_job');
select to_regclass('public.price_sync_job_item');

select indexname
from pg_indexes
where schemaname='public'
  and tablename in ('pricing_snapshot','channel_price_snapshot','price_sync_job','price_sync_job_item');
```

체크리스트 매핑:
- `DB-ENUM-008`~`DB-ENUM-010`
- `DB-SNP-001`~`DB-SNP-008`
- `DB-CPR-001`~`DB-CPR-005`
- `DB-JOB-001`~`DB-JOB-009`

---

## 3.5 `20260227114000_cms_1005_shop_latest_views_addonly.sql`

목표:
- 최신 조회 성능을 위한 보조뷰 생성

포함 객체:
- VIEW
  - `pricing_snapshot_latest`
  - `channel_price_snapshot_latest`

권장 구현 방식:
- `row_number() over(partition by ... order by ... desc)=1` 또는 `distinct on`

검증 쿼리:

```sql
select to_regclass('public.pricing_snapshot_latest');
select to_regclass('public.channel_price_snapshot_latest');

select * from public.pricing_snapshot_latest limit 5;
select * from public.channel_price_snapshot_latest limit 5;
```

체크리스트 매핑:
- `DB-VIEW-001`, `DB-VIEW-002`

---

## 3.6 `20260227115000_cms_1006_shop_dashboard_view_addonly.sql`

목표:
- 통합 대시보드 뷰 생성

포함 객체:
- ENUM
  - `shop_e_price_state`
- VIEW
  - `v_channel_price_dashboard`

필수 컬럼:
- 채널/매핑/마스터 식별자
- 소재/공임/마진/라운딩/factor
- `final_target_price_krw`, `current_channel_price_krw`
- `diff_krw`, `diff_pct`
- 상태값(`OK`, `OUT_OF_SYNC`, `ERROR`, `UNMAPPED`)

검증 쿼리:

```sql
select to_regclass('public.v_channel_price_dashboard');

select
  channel_id,
  master_item_id,
  final_target_price_krw,
  current_channel_price_krw,
  diff_krw,
  diff_pct,
  price_state
from public.v_channel_price_dashboard
limit 20;
```

체크리스트 매핑:
- `DB-ENUM-011`
- `DB-VIEW-003`~`DB-VIEW-007`

---

## 3.7 `20260227116000_cms_1007_shop_security_grants_addonly.sql`

목표:
- 권한/보안 최소선 반영

포함 객체:
- RLS policy (필요 시)
- grant/revoke
  - 조회 권한
  - 관리자 쓰기 권한
  - 토큰 컬럼 제한
- 감사로그 트리거/함수 연결(선택)

검증 쿼리:

```sql
-- role별 접근 테스트는 앱/psql role switch로 별도 수행
select schemaname, tablename, policyname
from pg_policies
where schemaname='public'
  and tablename like 'sales_%' or tablename like 'pricing_%' or tablename like 'price_sync_%';
```

체크리스트 매핑:
- `SEC-001`~`SEC-010`

---

## 3.8 `20260227117000_cms_1008_shop_seed_and_smoke_addonly.sql`

목표:
- 스모크 테스트 가능한 최소 seed 삽입 + 검증 함수/쿼리

포함 객체:
- seed 데이터
  - `sales_channel` 1건(자사몰)
  - 기본 `pricing_policy` 1건
  - `material_factor_set` global default 1건
  - `material_factor` 최소 소재 2~3건
- 스모크 검증 쿼리 주석

검증 쿼리:

```sql
select * from public.sales_channel where channel_code='CAFE24_MAIN';
select * from public.pricing_policy where is_active=true;
select * from public.material_factor_set where is_global_default=true;
```

체크리스트 매핑:
- `REL-001`, `REL-002` 사전 검증 보조

---

## 4) 버전관리/실행 절차

1. 파일 생성 후 정적 점검
- SQL 문법 검사
- 객체명 충돌 검사(`to_regclass`, `pg_type`)

2. local 실행
- `supabase db reset` 또는 프로젝트 표준 명령으로 전체 적용

3. smoke query 실행
- 본 문서의 각 파일 검증 쿼리 실행

4. staging 실행
- 운영과 동일 순서로 1~8 파일 적용
- 오류 발생 시 해당 파일 즉시 중단 및 롤백

5. 체크리스트 업데이트
- 완료된 항목에 [x] + 날짜 + 담당자 + 마이그레이션 파일명 기입

---

## 5) 롤백 전략

원칙:
- add-only이므로 물리 rollback보다 "보정 마이그레이션" 우선

실패 유형별 대응:

1) ENUM/테이블 생성 실패
- 원인 수정 후 동일 파일 재실행 가능하도록 idempotent 작성

2) 제약/인덱스 충돌
- 충돌 객체 식별 후 `if not exists` 보강한 보정 마이그레이션 추가

3) View 계산 오류
- 후속 파일(`*_fix_...sql`)로 `create or replace view` 보정

4) 권한 정책 오류
- 접근 차단 이슈는 최우선 hotfix로 grant 보정

---

## 6) PRD/ERD 역검증 체크 (Wave1 종료 시)
- [ ] PRD의 FR-001/002/003/004/005/009 데이터 구조를 Wave1에서 수용했는지 확인
- [ ] ERD의 핵심 엔터티(sales_channel~price_sync_job_item)가 실제 생성되었는지 확인
- [ ] `v_channel_price_dashboard` 컬럼이 PRD 대시보드 요구 컬럼을 충족하는지 확인
- [ ] 체크리스트 `DB-*`, `SEC-*` 항목 최신화 완료 확인

---

## 7) 산출물 체크
- [x] 파일명까지 고정된 1차 마이그레이션 번들 정의
- [x] 파일별 객체/검증 쿼리/체크리스트 매핑 제공
- [x] 실행 순서/롤백/역검증 절차 포함
