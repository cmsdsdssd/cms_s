set search_path = public, pg_temp;

create table if not exists public.price_sync_master_schedule_v1 (
  schedule_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  master_item_id uuid not null references public.cms_master_item(master_item_id),
  effective_sync_profile text not null,
  cadence_minutes integer not null,
  next_due_at timestamptz not null,
  last_evaluated_at timestamptz,
  last_evaluated_run_id uuid references public.price_sync_run_v2(run_id) on delete set null,
  last_evaluated_compute_request_id uuid,
  last_evaluated_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_price_sync_master_schedule_v1_channel_master unique (channel_id, master_item_id),
  constraint price_sync_master_schedule_v1_profile_chk check (effective_sync_profile in ('GENERAL', 'MARKET_LINKED')),
  constraint price_sync_master_schedule_v1_cadence_chk check (cadence_minutes > 0 and cadence_minutes <= 1440),
  constraint price_sync_master_schedule_v1_reason_chk check (last_evaluated_reason is null or last_evaluated_reason in ('DUE', 'DAILY_FULL_SYNC', 'MANUAL'))
);

create index if not exists idx_price_sync_master_schedule_v1_channel_due
  on public.price_sync_master_schedule_v1(channel_id, next_due_at asc);

create index if not exists idx_price_sync_master_schedule_v1_channel_profile_due
  on public.price_sync_master_schedule_v1(channel_id, effective_sync_profile, next_due_at asc);

create table if not exists public.price_sync_scheduler_lease_v1 (
  channel_id uuid primary key references public.sales_channel(channel_id) on delete cascade,
  owner_token text not null,
  lease_expires_at timestamptz not null,
  last_tick_started_at timestamptz not null default now(),
  last_tick_finished_at timestamptz,
  last_tick_status text,
  last_tick_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_sync_scheduler_lease_v1_status_chk check (last_tick_status is null or last_tick_status in ('RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED'))
);

create or replace function public.claim_price_sync_scheduler_lease_v1(
  p_channel_id uuid,
  p_owner_token text,
  p_lease_seconds integer default 1200
)
returns jsonb
language plpgsql
as $$
declare
  v_now timestamptz := now();
  v_expires_at timestamptz := v_now + make_interval(secs => greatest(p_lease_seconds, 30));
  v_row public.price_sync_scheduler_lease_v1%rowtype;
begin
  insert into public.price_sync_scheduler_lease_v1 (
    channel_id,
    owner_token,
    lease_expires_at,
    last_tick_started_at,
    last_tick_finished_at,
    last_tick_status,
    last_tick_error,
    updated_at
  ) values (
    p_channel_id,
    p_owner_token,
    v_expires_at,
    v_now,
    null,
    'RUNNING',
    null,
    v_now
  )
  on conflict (channel_id) do update
  set owner_token = excluded.owner_token,
      lease_expires_at = excluded.lease_expires_at,
      last_tick_started_at = excluded.last_tick_started_at,
      last_tick_finished_at = excluded.last_tick_finished_at,
      last_tick_status = excluded.last_tick_status,
      last_tick_error = excluded.last_tick_error,
      updated_at = excluded.updated_at
  where public.price_sync_scheduler_lease_v1.lease_expires_at <= v_now
     or public.price_sync_scheduler_lease_v1.owner_token = p_owner_token
  returning * into v_row;

  if v_row.channel_id is null then
    return jsonb_build_object('ok', false, 'reason', 'LEASE_HELD');
  end if;

  return jsonb_build_object(
    'ok', true,
    'channel_id', v_row.channel_id,
    'owner_token', v_row.owner_token,
    'lease_expires_at', v_row.lease_expires_at
  );
end;
$$;

create or replace function public.release_price_sync_scheduler_lease_v1(
  p_channel_id uuid,
  p_owner_token text,
  p_status text default 'SUCCESS',
  p_error text default null
)
returns jsonb
language plpgsql
as $$
declare
  v_now timestamptz := now();
  v_updated integer := 0;
begin
  update public.price_sync_scheduler_lease_v1
  set lease_expires_at = v_now,
      last_tick_finished_at = v_now,
      last_tick_status = case when p_status in ('RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED') then p_status else 'FAILED' end,
      last_tick_error = p_error,
      updated_at = v_now
  where channel_id = p_channel_id
    and owner_token = p_owner_token;

  get diagnostics v_updated = row_count;

  return jsonb_build_object('ok', v_updated > 0, 'released', v_updated > 0);
end;
$$;

do $$
begin
  if to_regprocedure('public.cms_fn_set_updated_at()') is not null then
    begin
      create trigger trg_price_sync_master_schedule_v1_updated_at
      before update on public.price_sync_master_schedule_v1
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then null;
    end;

    begin
      create trigger trg_price_sync_scheduler_lease_v1_updated_at
      before update on public.price_sync_scheduler_lease_v1
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then null;
    end;
  end if;
end $$;
