set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1106_price_sync_change_event_retention_addonly
-- 1) durable change-event history for meaningful price sync outcomes
-- 2) retention cleanup function for short-lived operational logs
-- 3) missing supporting indexes for v2 run/intent/task hot paths
-- -----------------------------------------------------------------------------

create table if not exists public.price_sync_change_event (
  event_id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  run_id uuid references public.price_sync_run_v2(run_id) on delete set null,
  job_id uuid references public.price_sync_job(job_id) on delete set null,
  job_item_id uuid references public.price_sync_job_item(job_item_id) on delete set null,
  channel_product_id uuid not null references public.sales_channel_product(channel_product_id) on delete cascade,
  master_item_id uuid references public.cms_master_item(master_item_id) on delete set null,
  external_product_no text,
  external_variant_code text,
  compute_request_id uuid,
  trigger_type public.shop_e_run_type,
  event_type text not null,
  before_price_krw integer,
  target_price_krw integer,
  after_price_krw integer,
  diff_krw integer,
  http_status integer,
  reason_code text,
  reason_detail jsonb not null default '{}'::jsonb
);

do $$
begin
  alter table public.price_sync_change_event
    add constraint price_sync_change_event_event_type_chk
    check (event_type in ('PRICE_CHANGED', 'PUSH_FAILED', 'FORCE_SYNC_APPLIED'));
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.price_sync_change_event
    add constraint price_sync_change_event_reason_detail_object_chk
    check (jsonb_typeof(reason_detail) = 'object');
exception when duplicate_object then
  null;
end $$;

create unique index if not exists uq_price_sync_change_event_job_item_id
  on public.price_sync_change_event(job_item_id)
  where job_item_id is not null;

create index if not exists idx_price_sync_change_event_channel_created
  on public.price_sync_change_event(channel_id, created_at desc);

create index if not exists idx_price_sync_change_event_channel_product_created
  on public.price_sync_change_event(channel_product_id, created_at desc);

create index if not exists idx_price_sync_change_event_run_created
  on public.price_sync_change_event(run_id, created_at desc)
  where run_id is not null;

create index if not exists idx_price_sync_change_event_job_created
  on public.price_sync_change_event(job_id, created_at desc)
  where job_id is not null;

create index if not exists idx_price_sync_change_event_compute_created
  on public.price_sync_change_event(compute_request_id, created_at desc)
  where compute_request_id is not null;

create index if not exists idx_price_sync_change_event_event_type_created
  on public.price_sync_change_event(event_type, created_at desc);

create index if not exists idx_price_sync_intent_v2_run_state_created
  on public.price_sync_intent_v2(run_id, state, created_at desc);

create index if not exists idx_price_sync_push_task_v2_intent_updated
  on public.price_sync_push_task_v2(intent_id, updated_at desc);

comment on table public.price_sync_change_event is '장기 보관용 가격 동기화 의미 이벤트 이력';
comment on column public.price_sync_change_event.event_type is 'PRICE_CHANGED | PUSH_FAILED | FORCE_SYNC_APPLIED';
comment on column public.price_sync_change_event.reason_detail is '보조 설명용 JSON. 검색/집계 키는 별도 컬럼 우선';

create or replace function public.cleanup_price_sync_history_v1(
  p_intent_retention_days integer default 30,
  p_task_retention_days integer default 30,
  p_job_item_retention_days integer default 30,
  p_job_retention_days integer default 90,
  p_run_retention_days integer default 730,
  p_change_event_retention_days integer default 730
)
returns jsonb
language plpgsql
as $$
declare
  v_intent_deleted integer := 0;
  v_task_deleted integer := 0;
  v_job_item_deleted integer := 0;
  v_job_deleted integer := 0;
  v_run_deleted integer := 0;
  v_change_event_deleted integer := 0;
begin
  with deleted as (
    delete from public.price_sync_push_task_v2 t
    using public.price_sync_intent_v2 i, public.price_sync_run_v2 r
    where t.intent_id = i.intent_id
      and i.run_id = r.run_id
      and coalesce(r.finished_at, r.started_at, r.created_at) < now() - make_interval(days => greatest(p_task_retention_days, 1))
    returning 1
  )
  select count(*) into v_task_deleted from deleted;

  with deleted as (
    delete from public.price_sync_intent_v2 i
    using public.price_sync_run_v2 r
    where i.run_id = r.run_id
      and coalesce(r.finished_at, r.started_at, r.created_at) < now() - make_interval(days => greatest(p_intent_retention_days, 1))
    returning 1
  )
  select count(*) into v_intent_deleted from deleted;

  with deleted as (
    delete from public.price_sync_job_item
    where coalesce(updated_at, created_at) < now() - make_interval(days => greatest(p_job_item_retention_days, 1))
    returning 1
  )
  select count(*) into v_job_item_deleted from deleted;

  with deleted as (
    delete from public.price_sync_job
    where coalesce(finished_at, started_at, created_at) < now() - make_interval(days => greatest(p_job_retention_days, 1))
    returning 1
  )
  select count(*) into v_job_deleted from deleted;

  with deleted as (
    delete from public.price_sync_change_event
    where created_at < now() - make_interval(days => greatest(p_change_event_retention_days, 1))
    returning 1
  )
  select count(*) into v_change_event_deleted from deleted;

  with deleted as (
    delete from public.price_sync_run_v2 r
    where coalesce(r.finished_at, r.started_at, r.created_at) < now() - make_interval(days => greatest(p_run_retention_days, 1))
      and not exists (
        select 1
        from public.price_sync_change_event e
        where e.run_id = r.run_id
      )
    returning 1
  )
  select count(*) into v_run_deleted from deleted;

  return jsonb_build_object(
    'ok', true,
    'deleted', jsonb_build_object(
      'price_sync_push_task_v2', v_task_deleted,
      'price_sync_intent_v2', v_intent_deleted,
      'price_sync_job_item', v_job_item_deleted,
      'price_sync_job', v_job_deleted,
      'price_sync_change_event', v_change_event_deleted,
      'price_sync_run_v2', v_run_deleted
    ),
    'retention_days', jsonb_build_object(
      'price_sync_push_task_v2', p_task_retention_days,
      'price_sync_intent_v2', p_intent_retention_days,
      'price_sync_job_item', p_job_item_retention_days,
      'price_sync_job', p_job_retention_days,
      'price_sync_change_event', p_change_event_retention_days,
      'price_sync_run_v2', p_run_retention_days
    )
  );
end;
$$;

comment on function public.cleanup_price_sync_history_v1(integer, integer, integer, integer, integer, integer)
  is '가격 동기화 운영 상세 로그 TTL 정리 + 장기 change_event / run 보존 정책';
