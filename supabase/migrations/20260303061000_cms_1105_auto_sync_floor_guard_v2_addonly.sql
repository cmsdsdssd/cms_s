set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1105_auto_sync_floor_guard_v2_addonly
-- 1) Floor guard SoT table
-- 2) Deterministic auto-sync run/intent/task tables
-- 3) pricing_snapshot floor columns + invariants
-- 4) Prevent active duplicate variant rows per master
-- -----------------------------------------------------------------------------

create table if not exists public.product_price_guard_v2 (
  guard_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  master_item_id uuid not null references public.cms_master_item(master_item_id),
  floor_price_krw integer not null,
  floor_source text not null default 'MANUAL',
  is_active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text
);

do $$
begin
  alter table public.product_price_guard_v2
    add constraint product_price_guard_v2_floor_non_negative
    check (floor_price_krw >= 0);
exception when duplicate_object then
  null;
end $$;

create unique index if not exists uq_product_price_guard_v2_active
  on public.product_price_guard_v2(channel_id, master_item_id)
  where is_active = true;

create index if not exists idx_product_price_guard_v2_channel_master
  on public.product_price_guard_v2(channel_id, master_item_id, updated_at desc);

create table if not exists public.price_sync_run_v2 (
  run_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  pinned_compute_request_id uuid,
  interval_minutes integer not null default 10,
  trigger_type public.shop_e_run_type not null default 'AUTO',
  status public.shop_e_sync_job_status not null default 'RUNNING',
  requested_by uuid references public.cms_person(person_id),
  request_payload jsonb not null default '{}'::jsonb,
  total_count integer not null default 0,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.price_sync_run_v2
    add constraint price_sync_run_v2_interval_positive
    check (interval_minutes > 0 and interval_minutes <= 60);
exception when duplicate_object then
  null;
end $$;

create index if not exists idx_price_sync_run_v2_channel_started
  on public.price_sync_run_v2(channel_id, started_at desc);

create table if not exists public.price_sync_intent_v2 (
  intent_id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.price_sync_run_v2(run_id) on delete cascade,
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  channel_product_id uuid references public.sales_channel_product(channel_product_id) on delete set null,
  master_item_id uuid references public.cms_master_item(master_item_id),
  external_product_no text not null,
  external_variant_code text,
  compute_request_id uuid not null,
  desired_price_krw integer not null,
  floor_price_krw integer not null default 0,
  floor_applied boolean not null default false,
  intent_version bigint not null default 1,
  inputs_hash text,
  state text not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.price_sync_intent_v2
    add constraint price_sync_intent_v2_desired_positive
    check (desired_price_krw > 0);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.price_sync_intent_v2
    add constraint price_sync_intent_v2_floor_non_negative
    check (floor_price_krw >= 0);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.price_sync_intent_v2
    add constraint price_sync_intent_v2_state_enum
    check (state in ('PENDING', 'PUSHING', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'SUPERSEDED'));
exception when duplicate_object then
  null;
end $$;

create unique index if not exists uq_price_sync_intent_v2_run_channel_product
  on public.price_sync_intent_v2(run_id, channel_product_id)
  where channel_product_id is not null;

create index if not exists idx_price_sync_intent_v2_channel_state
  on public.price_sync_intent_v2(channel_id, state, created_at desc);

create table if not exists public.price_sync_push_task_v2 (
  task_id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references public.price_sync_intent_v2(intent_id) on delete cascade,
  idempotency_key text not null,
  state text not null default 'PENDING',
  attempt_count integer not null default 0,
  next_retry_at timestamptz,
  http_status integer,
  remote_price_krw integer,
  last_error text,
  raw_response_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.price_sync_push_task_v2
    add constraint price_sync_push_task_v2_state_enum
    check (state in ('PENDING', 'PUSHING', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'SUPERSEDED'));
exception when duplicate_object then
  null;
end $$;

create unique index if not exists uq_price_sync_push_task_v2_idempotency_key
  on public.price_sync_push_task_v2(idempotency_key);

create index if not exists idx_price_sync_push_task_v2_state_retry
  on public.price_sync_push_task_v2(state, next_retry_at nulls first, updated_at desc);

alter table public.pricing_snapshot
  add column if not exists floor_price_krw integer not null default 0,
  add column if not exists final_target_before_floor_krw integer not null default 0,
  add column if not exists floor_clamped boolean not null default false;

do $$
begin
  alter table public.pricing_snapshot
    add constraint pricing_snapshot_floor_non_negative
    check (floor_price_krw >= 0);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.pricing_snapshot
    add constraint pricing_snapshot_final_above_floor
    check (final_target_price_krw >= floor_price_krw);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.pricing_snapshot
    add constraint pricing_snapshot_delta_total_consistent
    check (
      delta_total_krw = (
        coalesce(delta_material_krw, 0)
        + coalesce(delta_size_krw, 0)
        + coalesce(delta_color_krw, 0)
        + coalesce(delta_decor_krw, 0)
        + coalesce(delta_other_krw, 0)
      )
    );
exception when duplicate_object then
  null;
end $$;

with ranked as (
  select
    channel_product_id,
    row_number() over (
      partition by channel_id, master_item_id, external_variant_code
      order by updated_at desc, created_at desc, channel_product_id desc
    ) as rn
  from public.sales_channel_product
  where is_active = true
    and coalesce(btrim(external_variant_code), '') <> ''
)
update public.sales_channel_product scp
set is_active = false,
    updated_at = now()
from ranked r
where scp.channel_product_id = r.channel_product_id
  and r.rn > 1;

create unique index if not exists uq_sales_channel_product_active_variant_per_master
  on public.sales_channel_product(channel_id, master_item_id, external_variant_code)
  where is_active = true
    and coalesce(btrim(external_variant_code), '') <> '';

do $$
begin
  if to_regprocedure('public.cms_fn_set_updated_at()') is not null then
    begin
      create trigger trg_product_price_guard_v2_updated_at
      before update on public.product_price_guard_v2
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;

    begin
      create trigger trg_price_sync_run_v2_updated_at
      before update on public.price_sync_run_v2
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;

    begin
      create trigger trg_price_sync_intent_v2_updated_at
      before update on public.price_sync_intent_v2
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;

    begin
      create trigger trg_price_sync_push_task_v2_updated_at
      before update on public.price_sync_push_task_v2
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;
