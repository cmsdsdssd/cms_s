-- 20260204091501_cms_0346_receipt_ap_reconcile_queue.sql
-- 목적:
-- 1) 공장 영수증 팩트 스냅샷(라인 + 하단 4행) 버전관리 저장
-- 2) AP 원장(Invoice/Payment/Alloc) 멀티자산(금/은/공임현금) legs 구조
-- 3) 저장은 막지 않고, 정합 이슈를 큐로 쌓는 Reconcile Run/Issue 구조
--
-- 주의:
-- - FK는 기존 테이블/컬럼이 다를 수 있어 이 파일에서는 "조건부로" 추가합니다.
-- - asset_code는 확장 대비 enum으로 두되, 필요 시 type 확장 가능합니다.

begin;
-- ================
-- 0) ENUM TYPES
-- ================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'cms_asset_code') then
    create type cms_asset_code as enum (
      'XAU_G',        -- 순금환산 g
      'XAG_G',        -- 순은환산 g
      'KRW_LABOR',    -- 공임+기타공임 현금(원)
      'KRW_MATERIAL'  -- 소재 현금대체(미래 대비)
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'cms_statement_row_code') then
    create type cms_statement_row_code as enum (
      'RECENT_PAYMENT',
      'PRE_BALANCE',
      'SALE',
      'POST_BALANCE'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'cms_ap_movement_code') then
    create type cms_ap_movement_code as enum (
      'SALE',
      'ADJUSTMENT',
      'RETURN',
      'OTHER'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'cms_reconcile_issue_type') then
    create type cms_reconcile_issue_type as enum (
      'PRE_NEQ_PREV_POST',
      'PRE_PLUS_SALE_NEQ_POST',
      'FACTORY_SALE_NEQ_INTERNAL_CALC',
      'RECENT_PAYMENT_INCONSISTENT'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'cms_reconcile_issue_severity') then
    create type cms_reconcile_issue_severity as enum ('INFO','WARN','ERROR');
  end if;

  if not exists (select 1 from pg_type where typname = 'cms_reconcile_issue_status') then
    create type cms_reconcile_issue_status as enum ('OPEN','ACKED','RESOLVED','IGNORED');
  end if;
end $$;
-- =========================
-- 1) FACTORY RECEIPT SNAPSHOT
-- =========================
create table if not exists cms_factory_receipt_snapshot (
  receipt_id uuid not null,
  snapshot_version int not null,
  vendor_party_id uuid not null,
  issued_at date not null,

  -- "현재 버전" 표시 (receipt_id당 하나만 true)
  is_current boolean not null default true,

  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,

  primary key (receipt_id, snapshot_version)
);
-- receipt_id별 current 1개 강제
create unique index if not exists cms_factory_receipt_snapshot_one_current_per_receipt
  on cms_factory_receipt_snapshot (receipt_id)
  where is_current = true;
create index if not exists cms_factory_receipt_snapshot_vendor_issued_at_idx
  on cms_factory_receipt_snapshot (vendor_party_id, issued_at desc);
-- 하단 4행 row
create table if not exists cms_factory_receipt_statement_row (
  receipt_id uuid not null,
  snapshot_version int not null,
  row_code cms_statement_row_code not null,
  row_order int not null default 0,

  -- 최근결제의 기준일 등
  ref_date date,
  note text,

  created_at timestamptz not null default now(),
  created_by uuid,

  primary key (receipt_id, snapshot_version, row_code)
);
-- 하단 4행 legs(자산별 값)
create table if not exists cms_factory_receipt_statement_leg (
  receipt_id uuid not null,
  snapshot_version int not null,
  row_code cms_statement_row_code not null,

  asset_code cms_asset_code not null,

  -- 정규화 값(금/은은 g, 현금은 원)
  qty numeric(18,6) not null default 0,

  -- "영수증 그대로" 입력 보존 (돈/그람/원 등)
  input_unit text,
  input_qty numeric(18,6),

  primary key (receipt_id, snapshot_version, row_code, asset_code)
);
-- 공장 본문 라인(환산 전: 제품중량)
create table if not exists cms_factory_receipt_item_line (
  receipt_id uuid not null,
  snapshot_version int not null,

  line_no int not null,
  line_uuid uuid,             -- 프론트 생성 키(매칭/우리라인/공장라인 연결)

  qty int,
  product_weight_g numeric(18,6),  -- 환산 전 제품중량
  labor_sum_krw numeric(18,2),

  model_text text,
  spec_text text,
  raw jsonb,

  created_at timestamptz not null default now(),
  created_by uuid,

  primary key (receipt_id, snapshot_version, line_no)
);
create index if not exists cms_factory_receipt_item_line_uuid_idx
  on cms_factory_receipt_item_line (line_uuid);
-- ==================================
-- 2) INTERNAL CALC SNAPSHOT (검증용)
-- ==================================
create table if not exists cms_ap_internal_calc_snapshot (
  receipt_id uuid not null,
  calc_version int not null,
  is_current boolean not null default true,

  calc_gold_g numeric(18,6) not null default 0,
  calc_silver_g numeric(18,6) not null default 0,
  calc_labor_cash_krw numeric(18,2) not null default 0,

  detail_json jsonb,

  created_at timestamptz not null default now(),
  created_by uuid,

  primary key (receipt_id, calc_version)
);
create unique index if not exists cms_ap_internal_calc_one_current_per_receipt
  on cms_ap_internal_calc_snapshot (receipt_id)
  where is_current = true;
-- =========================
-- 3) AP LEDGER (AR-like SoT)
-- =========================
create table if not exists cms_ap_invoice (
  ap_id uuid primary key default gen_random_uuid(),
  vendor_party_id uuid not null,
  receipt_id uuid not null,

  occurred_at timestamptz not null,
  movement_code cms_ap_movement_code not null default 'SALE',

  source_receipt_snapshot_version int,
  source_calc_version int,

  memo text,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists cms_ap_invoice_vendor_time_idx
  on cms_ap_invoice (vendor_party_id, occurred_at asc);
create index if not exists cms_ap_invoice_receipt_idx
  on cms_ap_invoice (receipt_id);
create table if not exists cms_ap_invoice_leg (
  ap_id uuid not null,
  asset_code cms_asset_code not null,
  due_qty numeric(18,6) not null default 0,  -- +/- 허용(조정/반품)

  primary key (ap_id, asset_code)
);
create table if not exists cms_ap_payment (
  payment_id uuid primary key default gen_random_uuid(),
  vendor_party_id uuid not null,
  paid_at timestamptz not null,

  note text,
  idempotency_key text,

  created_at timestamptz not null default now(),
  created_by uuid
);
create unique index if not exists cms_ap_payment_idem_unique
  on cms_ap_payment (vendor_party_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists cms_ap_payment_vendor_paid_at_idx
  on cms_ap_payment (vendor_party_id, paid_at desc);
create table if not exists cms_ap_payment_leg (
  payment_id uuid not null,
  asset_code cms_asset_code not null,
  qty numeric(18,6) not null default 0,

  primary key (payment_id, asset_code)
);
create table if not exists cms_ap_alloc (
  alloc_id uuid primary key default gen_random_uuid(),
  payment_id uuid not null,
  ap_id uuid not null,

  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists cms_ap_alloc_payment_idx
  on cms_ap_alloc (payment_id);
create index if not exists cms_ap_alloc_ap_idx
  on cms_ap_alloc (ap_id);
create table if not exists cms_ap_alloc_leg (
  alloc_id uuid not null,
  asset_code cms_asset_code not null,
  qty numeric(18,6) not null default 0,

  primary key (alloc_id, asset_code)
);
-- =========================
-- 4) RECONCILE RUN / ISSUE QUEUE
-- =========================
create table if not exists cms_ap_reconcile_run (
  run_id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null,
  vendor_party_id uuid not null,

  snapshot_version int,
  calc_version int,

  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists cms_ap_reconcile_run_vendor_created_idx
  on cms_ap_reconcile_run (vendor_party_id, created_at desc);
create table if not exists cms_ap_reconcile_issue (
  issue_id uuid primary key default gen_random_uuid(),
  run_id uuid not null,

  receipt_id uuid not null,
  vendor_party_id uuid not null,

  issue_type cms_reconcile_issue_type not null,
  severity cms_reconcile_issue_severity not null default 'WARN',
  status cms_reconcile_issue_status not null default 'OPEN',

  summary text,

  created_at timestamptz not null default now(),
  created_by uuid,

  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text
);
create index if not exists cms_ap_reconcile_issue_vendor_status_idx
  on cms_ap_reconcile_issue (vendor_party_id, status, severity, created_at desc);
create index if not exists cms_ap_reconcile_issue_receipt_idx
  on cms_ap_reconcile_issue (receipt_id);
create table if not exists cms_ap_reconcile_issue_leg (
  issue_id uuid not null,
  asset_code cms_asset_code not null,

  expected_qty numeric(18,6) not null default 0,
  actual_qty numeric(18,6) not null default 0,
  diff_qty numeric(18,6) not null default 0, -- actual - expected

  primary key (issue_id, asset_code)
);
-- 이슈 해결(조정 invoice) 연결
create table if not exists cms_ap_adjustment_link (
  issue_id uuid not null,
  ap_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  primary key (issue_id, ap_id)
);
-- =========================
-- 5) CONDITIONAL FKs (존재할 때만 붙이기)
-- =========================
do $$
begin
  -- receipt inbox FK (있으면)
  if to_regclass('public.cms_receipt_inbox') is not null then
    begin
      alter table cms_factory_receipt_snapshot
        add constraint cms_factory_receipt_snapshot_receipt_fk
        foreign key (receipt_id) references cms_receipt_inbox(receipt_id)
        on delete cascade;
    exception when duplicate_object then null;
    end;

    begin
      alter table cms_ap_invoice
        add constraint cms_ap_invoice_receipt_fk
        foreign key (receipt_id) references cms_receipt_inbox(receipt_id)
        on delete restrict;
    exception when duplicate_object then null;
    end;

    begin
      alter table cms_ap_reconcile_run
        add constraint cms_ap_reconcile_run_receipt_fk
        foreign key (receipt_id) references cms_receipt_inbox(receipt_id)
        on delete cascade;
    exception when duplicate_object then null;
    end;
  end if;

  -- snapshot children FK
  begin
    alter table cms_factory_receipt_statement_row
      add constraint cms_factory_receipt_statement_row_snapshot_fk
      foreign key (receipt_id, snapshot_version)
      references cms_factory_receipt_snapshot(receipt_id, snapshot_version)
      on delete cascade;
  exception when duplicate_object then null;
  end;

  begin
    alter table cms_factory_receipt_statement_leg
      add constraint cms_factory_receipt_statement_leg_row_fk
      foreign key (receipt_id, snapshot_version, row_code)
      references cms_factory_receipt_statement_row(receipt_id, snapshot_version, row_code)
      on delete cascade;
  exception when duplicate_object then null;
  end;

  begin
    alter table cms_factory_receipt_item_line
      add constraint cms_factory_receipt_item_line_snapshot_fk
      foreign key (receipt_id, snapshot_version)
      references cms_factory_receipt_snapshot(receipt_id, snapshot_version)
      on delete cascade;
  exception when duplicate_object then null;
  end;

  -- AP legs / alloc links
  begin
    alter table cms_ap_invoice_leg
      add constraint cms_ap_invoice_leg_invoice_fk
      foreign key (ap_id) references cms_ap_invoice(ap_id)
      on delete cascade;
  exception when duplicate_object then null;
  end;

  begin
    alter table cms_ap_payment_leg
      add constraint cms_ap_payment_leg_payment_fk
      foreign key (payment_id) references cms_ap_payment(payment_id)
      on delete cascade;
  exception when duplicate_object then null;
  end;

  begin
    alter table cms_ap_alloc
      add constraint cms_ap_alloc_payment_fk
      foreign key (payment_id) references cms_ap_payment(payment_id)
      on delete cascade;
  exception when duplicate_object then null;
  end;

  begin
    alter table cms_ap_alloc
      add constraint cms_ap_alloc_invoice_fk
      foreign key (ap_id) references cms_ap_invoice(ap_id)
      on delete cascade;
  exception when duplicate_object then null;
  end;

  begin
    alter table cms_ap_alloc_leg
      add constraint cms_ap_alloc_leg_alloc_fk
      foreign key (alloc_id) references cms_ap_alloc(alloc_id)
      on delete cascade;
  exception when duplicate_object then null;
  end;

  begin
    alter table cms_ap_reconcile_issue
      add constraint cms_ap_reconcile_issue_run_fk
      foreign key (run_id) references cms_ap_reconcile_run(run_id)
      on delete cascade;
  exception when duplicate_object then null;
  end;

  begin
    alter table cms_ap_reconcile_issue_leg
      add constraint cms_ap_reconcile_issue_leg_issue_fk
      foreign key (issue_id) references cms_ap_reconcile_issue(issue_id)
      on delete cascade;
  exception when duplicate_object then null;
  end;

  begin
    alter table cms_ap_adjustment_link
      add constraint cms_ap_adjustment_link_issue_fk
      foreign key (issue_id) references cms_ap_reconcile_issue(issue_id)
      on delete cascade;
  exception when duplicate_object then null;
  end;

  begin
    alter table cms_ap_adjustment_link
      add constraint cms_ap_adjustment_link_invoice_fk
      foreign key (ap_id) references cms_ap_invoice(ap_id)
      on delete cascade;
  exception when duplicate_object then null;
  end;
end $$;
-- =========================
-- 6) VIEWS FOR QUEUE/UX
-- =========================

-- (A) 오픈 이슈 vendor별 카운트 (정합 큐 좌측 리스트)
create or replace view cms_v_ap_reconcile_open_by_vendor_v1 as
select
  vendor_party_id,
  count(*) filter (where status in ('OPEN','ACKED')) as open_count,
  count(*) filter (where status in ('OPEN','ACKED') and severity='ERROR') as error_count,
  count(*) filter (where status in ('OPEN','ACKED') and severity='WARN') as warn_count,
  max(created_at) filter (where status in ('OPEN','ACKED')) as last_open_at
from cms_ap_reconcile_issue
group by vendor_party_id;
-- (B) 오픈 이슈 리스트(테이블)
create or replace view cms_v_ap_reconcile_issue_list_v1 as
select
  i.issue_id,
  i.run_id,
  i.vendor_party_id,
  i.receipt_id,
  i.issue_type,
  i.severity,
  i.status,
  i.summary,
  i.created_at,
  r.snapshot_version,
  r.calc_version
from cms_ap_reconcile_issue i
join cms_ap_reconcile_run r on r.run_id = i.run_id;
commit;
