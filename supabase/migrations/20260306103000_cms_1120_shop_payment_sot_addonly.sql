set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1120_shop_payment_sot_addonly
-- Cafe24 order/payment SOT pipeline
-- 1) webhook inbox
-- 2) polling run/cursor
-- 3) append-only observations (order + payment timeline)
-- 4) materialized payment SOT + resolution queue
-- 5) helper RPCs for ingestion and recompute
-- -----------------------------------------------------------------------------

do $$
begin
  create type public.shop_e_poll_run_status as enum ('RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create type public.shop_e_reconciliation_status as enum ('GREEN', 'RED');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create type public.shop_e_resolution_status as enum ('OPEN', 'RESOLVED', 'IGNORED');
exception when duplicate_object then
  null;
end $$;

create table if not exists public.shop_webhook_inbox (
  inbox_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  mall_id text,
  shop_no integer,
  event_no text,
  event_type text,
  order_id text,
  idempotency_key text not null,
  payload_hash text not null,
  headers_json jsonb not null default '{}'::jsonb,
  raw_json jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists uq_shop_webhook_inbox_idempotency
  on public.shop_webhook_inbox(idempotency_key);

create unique index if not exists uq_shop_webhook_inbox_channel_payload
  on public.shop_webhook_inbox(channel_id, payload_hash);

create index if not exists idx_shop_webhook_inbox_channel_received
  on public.shop_webhook_inbox(channel_id, received_at desc);

create table if not exists public.shop_poll_run (
  poll_run_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  status public.shop_e_poll_run_status not null default 'RUNNING',
  cursor_from_ts timestamptz not null,
  cursor_to_ts timestamptz not null,
  orders_seen integer not null default 0,
  orders_processed integer not null default 0,
  errors_count integer not null default 0,
  error_message text,
  detail jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.shop_poll_run
    add constraint shop_poll_run_non_negative_counts
    check (orders_seen >= 0 and orders_processed >= 0 and errors_count >= 0);
exception when duplicate_object then
  null;
end $$;

create unique index if not exists uq_shop_poll_run_running_per_channel
  on public.shop_poll_run(channel_id)
  where status = 'RUNNING';

create index if not exists idx_shop_poll_run_channel_started
  on public.shop_poll_run(channel_id, started_at desc);

create table if not exists public.shop_poll_cursor (
  channel_id uuid primary key references public.sales_channel(channel_id) on delete cascade,
  last_seen_updated_at timestamptz,
  last_seen_order_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_order_observation (
  observation_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  order_id text not null,
  order_status text,
  payment_status text,
  order_updated_at timestamptz,
  payload_hash text not null,
  raw_json jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists uq_shop_order_observation_payload
  on public.shop_order_observation(channel_id, order_id, payload_hash);

create index if not exists idx_shop_order_observation_latest
  on public.shop_order_observation(channel_id, order_id, observed_at desc, created_at desc);

create table if not exists public.shop_paymenttimeline_item_observation (
  timeline_observation_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  order_id text not null,
  payment_no text not null,
  payment_settle_type text,
  payment_method text,
  currency text not null default 'KRW',
  amount_krw numeric(18,0) not null default 0,
  paid_at timestamptz,
  parse_error boolean not null default false,
  payload_hash text not null,
  raw_json jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists uq_shop_timeline_observation_payload
  on public.shop_paymenttimeline_item_observation(channel_id, order_id, payment_no, payload_hash);

create index if not exists idx_shop_timeline_observation_latest
  on public.shop_paymenttimeline_item_observation(channel_id, order_id, payment_no, observed_at desc, created_at desc);

create table if not exists public.shop_order_payment_sot (
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  order_id text not null,
  gross_paid_krw numeric(18,0) not null default 0,
  refund_total_krw numeric(18,0) not null default 0,
  net_paid_krw numeric(18,0) not null default 0,
  currency text,
  payment_status text,
  reconciliation_status public.shop_e_reconciliation_status not null default 'RED',
  reconciliation_details jsonb not null default '{}'::jsonb,
  as_of_observed_at timestamptz,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (channel_id, order_id)
);

create index if not exists idx_shop_order_payment_sot_recon
  on public.shop_order_payment_sot(channel_id, reconciliation_status, computed_at desc);

create table if not exists public.shop_payment_sot_resolution_queue (
  queue_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  order_id text not null,
  issue_type text not null,
  issue_key text not null,
  status public.shop_e_resolution_status not null default 'OPEN',
  priority text not null default 'NORMAL',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists uq_shop_payment_sot_resolution_issue_key
  on public.shop_payment_sot_resolution_queue(issue_key);

do $$
begin
  alter table public.shop_payment_sot_resolution_queue
    add constraint shop_payment_sot_resolution_priority_enum
    check (priority in ('LOW', 'NORMAL', 'HIGH', 'CRITICAL'));
exception when duplicate_object then
  null;
end $$;

create index if not exists idx_shop_payment_sot_resolution_status
  on public.shop_payment_sot_resolution_queue(channel_id, status, created_at desc);

create or replace function public.shop_fn_safe_timestamptz_v1(
  p_value text
) returns timestamptz
language plpgsql
immutable
as $$
declare
  v_ts timestamptz;
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;

  begin
    v_ts := p_value::timestamptz;
    return v_ts;
  exception when others then
    return null;
  end;
end;
$$;

create or replace function public.shop_fn_safe_numeric_v1(
  p_value text
) returns numeric
language plpgsql
immutable
as $$
declare
  v_num numeric;
  v_clean text;
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;

  v_clean := regexp_replace(p_value, '[^0-9+\-.]', '', 'g');
  if v_clean is null or btrim(v_clean) = '' then
    return null;
  end if;

  begin
    v_num := v_clean::numeric;
    return v_num;
  exception when others then
    return null;
  end;
end;
$$;

create or replace function public.shop_fn_try_start_poll_run_v1(
  p_channel_id uuid,
  p_cursor_from_ts timestamptz,
  p_cursor_to_ts timestamptz,
  p_detail jsonb default '{}'::jsonb
) returns table(
  poll_run_id uuid,
  started boolean,
  reason text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_poll_run_id uuid;
begin
  if p_channel_id is null then
    raise exception 'channel_id is required';
  end if;
  if p_cursor_from_ts is null or p_cursor_to_ts is null then
    raise exception 'cursor range is required';
  end if;

  begin
    insert into public.shop_poll_run(
      channel_id,
      status,
      cursor_from_ts,
      cursor_to_ts,
      detail,
      started_at
    ) values (
      p_channel_id,
      'RUNNING',
      p_cursor_from_ts,
      p_cursor_to_ts,
      coalesce(p_detail, '{}'::jsonb),
      now()
    )
    returning shop_poll_run.poll_run_id into v_poll_run_id;

    return query
    select v_poll_run_id, true, 'STARTED'::text;
  exception when unique_violation then
    select r.poll_run_id
      into v_poll_run_id
    from public.shop_poll_run r
    where r.channel_id = p_channel_id
      and r.status = 'RUNNING'
    order by r.started_at desc
    limit 1;

    return query
    select v_poll_run_id, false, 'RUNNING_EXISTS'::text;
  end;
end;
$$;

create or replace function public.shop_fn_upsert_poll_cursor_v1(
  p_channel_id uuid,
  p_last_seen_updated_at timestamptz,
  p_last_seen_order_id text
) returns public.shop_poll_cursor
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.shop_poll_cursor;
begin
  if p_channel_id is null then
    raise exception 'channel_id is required';
  end if;

  insert into public.shop_poll_cursor(
    channel_id,
    last_seen_updated_at,
    last_seen_order_id,
    created_at,
    updated_at
  ) values (
    p_channel_id,
    p_last_seen_updated_at,
    nullif(btrim(coalesce(p_last_seen_order_id, '')), ''),
    now(),
    now()
  )
  on conflict (channel_id)
  do update
  set
    last_seen_updated_at = excluded.last_seen_updated_at,
    last_seen_order_id = excluded.last_seen_order_id,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.shop_fn_record_payment_observations_v1(
  p_channel_id uuid,
  p_order_json jsonb,
  p_paymenttimeline_json jsonb,
  p_observed_at timestamptz default now()
) returns table(
  order_id text,
  order_observation_id uuid,
  timeline_inserted_count integer,
  parse_error_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id text;
  v_order_status text;
  v_payment_status text;
  v_order_updated_at timestamptz;
  v_order_hash text;
  v_order_observation_id uuid;
  v_item jsonb;
  v_idx bigint;
  v_payment_no text;
  v_settle_type text;
  v_payment_method text;
  v_currency text;
  v_amount numeric;
  v_paid_at timestamptz;
  v_parse_error boolean;
  v_item_hash text;
  v_timeline jsonb;
  v_inserted integer := 0;
  v_parse_errors integer := 0;
  v_row_count integer := 0;
begin
  if p_channel_id is null then
    raise exception 'channel_id is required';
  end if;

  if p_order_json is null then
    raise exception 'order_json is required';
  end if;

  v_order_id := coalesce(
    nullif(btrim(p_order_json ->> 'order_id'), ''),
    nullif(btrim(p_order_json #>> '{order,order_id}'), ''),
    nullif(btrim(p_order_json ->> 'orderId'), '')
  );

  if v_order_id is null then
    raise exception 'order_id is required in order_json';
  end if;

  v_order_status := coalesce(
    nullif(btrim(p_order_json ->> 'order_status'), ''),
    nullif(btrim(p_order_json #>> '{order,order_status}'), ''),
    nullif(btrim(p_order_json #>> '{order,status}'), '')
  );

  v_payment_status := coalesce(
    nullif(btrim(p_order_json ->> 'payment_status'), ''),
    nullif(btrim(p_order_json #>> '{order,payment_status}'), '')
  );

  v_order_updated_at := coalesce(
    public.shop_fn_safe_timestamptz_v1(p_order_json ->> 'updated_date'),
    public.shop_fn_safe_timestamptz_v1(p_order_json ->> 'modified_date'),
    public.shop_fn_safe_timestamptz_v1(p_order_json #>> '{order,updated_date}'),
    public.shop_fn_safe_timestamptz_v1(p_order_json #>> '{order,modified_date}')
  );

  v_order_hash := encode(digest(coalesce(p_order_json, '{}'::jsonb)::text, 'sha256'), 'hex');

  insert into public.shop_order_observation(
    channel_id,
    order_id,
    order_status,
    payment_status,
    order_updated_at,
    payload_hash,
    raw_json,
    observed_at,
    created_at
  ) values (
    p_channel_id,
    v_order_id,
    v_order_status,
    v_payment_status,
    v_order_updated_at,
    v_order_hash,
    p_order_json,
    coalesce(p_observed_at, now()),
    now()
  )
  on conflict (channel_id, order_id, payload_hash)
  do update set
    observed_at = excluded.observed_at
  returning observation_id into v_order_observation_id;

  v_timeline := coalesce(
    p_paymenttimeline_json -> 'paymenttimeline',
    p_paymenttimeline_json -> 'payment_timeline',
    p_paymenttimeline_json -> 'payments',
    p_paymenttimeline_json #> '{order,paymenttimeline}',
    '[]'::jsonb
  );

  if jsonb_typeof(v_timeline) <> 'array' then
    v_timeline := '[]'::jsonb;
  end if;

  for v_item, v_idx in
    select e.value, e.ordinality
    from jsonb_array_elements(v_timeline) with ordinality as e(value, ordinality)
  loop
    v_payment_no := coalesce(
      nullif(btrim(v_item ->> 'payment_no'), ''),
      nullif(btrim(v_item ->> 'paymentNo'), ''),
      nullif(btrim(v_item ->> 'no'), ''),
      'idx:' || v_idx::text
    );

    v_settle_type := upper(coalesce(
      nullif(btrim(v_item ->> 'payment_settle_type'), ''),
      nullif(btrim(v_item ->> 'paymentSettleType'), '')
    ));

    v_payment_method := coalesce(
      nullif(btrim(v_item ->> 'payment_method'), ''),
      nullif(btrim(v_item ->> 'paymentMethod'), '')
    );

    v_currency := upper(coalesce(
      nullif(btrim(v_item ->> 'currency'), ''),
      nullif(btrim(v_item ->> 'currency_code'), ''),
      'KRW'
    ));

    v_amount := coalesce(
      public.shop_fn_safe_numeric_v1(v_item ->> 'paid_amount'),
      public.shop_fn_safe_numeric_v1(v_item ->> 'payment_amount'),
      public.shop_fn_safe_numeric_v1(v_item ->> 'amount'),
      public.shop_fn_safe_numeric_v1(v_item ->> 'price')
    );

    v_paid_at := coalesce(
      public.shop_fn_safe_timestamptz_v1(v_item ->> 'payment_date'),
      public.shop_fn_safe_timestamptz_v1(v_item ->> 'paid_at'),
      public.shop_fn_safe_timestamptz_v1(v_item ->> 'processed_at')
    );

    v_parse_error := false;
    if v_settle_type is null or v_settle_type not in ('O', 'R', 'P') then
      v_parse_error := true;
    end if;
    if v_amount is null then
      v_amount := 0;
      v_parse_error := true;
    end if;

    v_item_hash := encode(digest(coalesce(v_item, '{}'::jsonb)::text, 'sha256'), 'hex');

    insert into public.shop_paymenttimeline_item_observation(
      channel_id,
      order_id,
      payment_no,
      payment_settle_type,
      payment_method,
      currency,
      amount_krw,
      paid_at,
      parse_error,
      payload_hash,
      raw_json,
      observed_at,
      created_at
    ) values (
      p_channel_id,
      v_order_id,
      v_payment_no,
      v_settle_type,
      v_payment_method,
      v_currency,
      round(v_amount)::numeric(18,0),
      v_paid_at,
      v_parse_error,
      v_item_hash,
      v_item,
      coalesce(p_observed_at, now()),
      now()
    )
    on conflict (channel_id, order_id, payment_no, payload_hash)
    do update set
      observed_at = excluded.observed_at;

    get diagnostics v_row_count = row_count;
    if v_row_count > 0 then
      v_inserted := v_inserted + 1;
    end if;
    if v_parse_error then
      v_parse_errors := v_parse_errors + 1;
    end if;
  end loop;

  return query
  select v_order_id, v_order_observation_id, v_inserted, v_parse_errors;
end;
$$;

create or replace function public.shop_fn_recompute_order_payment_sot_v1(
  p_channel_id uuid,
  p_order_id text
) returns table(
  order_id text,
  reconciliation_status public.shop_e_reconciliation_status,
  net_paid_krw numeric,
  gross_paid_krw numeric,
  refund_total_krw numeric,
  currency text,
  issue_key text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_row public.shop_order_observation;
  v_item_count integer := 0;
  v_parse_error_count integer := 0;
  v_currency_count integer := 0;
  v_currency text := 'KRW';
  v_gross numeric := 0;
  v_refund numeric := 0;
  v_net numeric := 0;
  v_as_of_observed_at timestamptz;
  v_recon_status public.shop_e_reconciliation_status := 'RED';
  v_issue_type text;
  v_issue_key text;
  v_details jsonb;
begin
  if p_channel_id is null then
    raise exception 'channel_id is required';
  end if;
  if p_order_id is null or btrim(p_order_id) = '' then
    raise exception 'order_id is required';
  end if;

  perform pg_advisory_xact_lock(hashtext('shop_payment_sot:' || p_channel_id::text || ':' || p_order_id));

  select o.*
    into v_order_row
  from public.shop_order_observation o
  where o.channel_id = p_channel_id
    and o.order_id = p_order_id
  order by o.observed_at desc, o.created_at desc
  limit 1;

  with latest_timeline as (
    select distinct on (t.payment_no)
      t.payment_no,
      upper(coalesce(t.payment_settle_type, '')) as payment_settle_type,
      upper(coalesce(t.currency, '')) as currency,
      coalesce(t.amount_krw, 0) as amount_krw,
      t.parse_error,
      t.observed_at
    from public.shop_paymenttimeline_item_observation t
    where t.channel_id = p_channel_id
      and t.order_id = p_order_id
    order by t.payment_no, t.observed_at desc, t.created_at desc
  )
  select
    count(*)::int as item_count,
    count(*) filter (where parse_error)::int as parse_error_count,
    count(distinct case when currency <> '' then currency end)::int as currency_count,
    max(case when currency <> '' then currency end) as any_currency,
    coalesce(sum(case when payment_settle_type in ('O', 'R') then amount_krw else 0 end), 0) as gross_total,
    coalesce(sum(case when payment_settle_type = 'P' then amount_krw else 0 end), 0) as refund_total,
    max(observed_at) as as_of_observed_at
  into
    v_item_count,
    v_parse_error_count,
    v_currency_count,
    v_currency,
    v_gross,
    v_refund,
    v_as_of_observed_at
  from latest_timeline;

  if v_currency is null or btrim(v_currency) = '' then
    v_currency := 'KRW';
  end if;

  v_net := coalesce(v_gross, 0) - coalesce(v_refund, 0);

  if v_item_count > 0
     and v_parse_error_count = 0
     and v_currency_count <= 1
     and v_currency = 'KRW'
     and v_net >= 0
  then
    v_recon_status := 'GREEN';
  else
    v_recon_status := 'RED';
  end if;

  if v_recon_status = 'RED' then
    if v_item_count = 0 then
      v_issue_type := 'MISSING_TIMELINE';
    elsif v_parse_error_count > 0 then
      v_issue_type := 'PARSE_ERROR';
    elsif v_currency_count > 1 or v_currency <> 'KRW' then
      v_issue_type := 'CURRENCY_MISMATCH';
    elsif v_net < 0 then
      v_issue_type := 'NEGATIVE_NET';
    else
      v_issue_type := 'UNKNOWN';
    end if;
  else
    v_issue_type := null;
  end if;

  v_issue_key := 'PAYMENT_SOT:' || p_channel_id::text || ':' || p_order_id;

  v_details := jsonb_build_object(
    'item_count', v_item_count,
    'parse_error_count', v_parse_error_count,
    'currency_count', v_currency_count,
    'currency', v_currency,
    'gross_paid_krw', v_gross,
    'refund_total_krw', v_refund,
    'net_paid_krw', v_net,
    'issue_type', v_issue_type,
    'as_of_observed_at', v_as_of_observed_at,
    'source_observation_id', coalesce(v_order_row.observation_id::text, '')
  );

  insert into public.shop_order_payment_sot(
    channel_id,
    order_id,
    gross_paid_krw,
    refund_total_krw,
    net_paid_krw,
    currency,
    payment_status,
    reconciliation_status,
    reconciliation_details,
    as_of_observed_at,
    computed_at,
    created_at,
    updated_at
  ) values (
    p_channel_id,
    p_order_id,
    coalesce(v_gross, 0),
    coalesce(v_refund, 0),
    coalesce(v_net, 0),
    v_currency,
    coalesce(v_order_row.payment_status, null),
    v_recon_status,
    v_details,
    v_as_of_observed_at,
    now(),
    now(),
    now()
  )
  on conflict (channel_id, order_id)
  do update set
    gross_paid_krw = excluded.gross_paid_krw,
    refund_total_krw = excluded.refund_total_krw,
    net_paid_krw = excluded.net_paid_krw,
    currency = excluded.currency,
    payment_status = excluded.payment_status,
    reconciliation_status = excluded.reconciliation_status,
    reconciliation_details = excluded.reconciliation_details,
    as_of_observed_at = excluded.as_of_observed_at,
    computed_at = excluded.computed_at,
    updated_at = now();

  if v_recon_status = 'RED' then
    insert into public.shop_payment_sot_resolution_queue(
      channel_id,
      order_id,
      issue_type,
      issue_key,
      status,
      priority,
      detail,
      created_at,
      updated_at,
      resolved_at
    ) values (
      p_channel_id,
      p_order_id,
      coalesce(v_issue_type, 'UNKNOWN'),
      v_issue_key,
      'OPEN',
      case
        when v_issue_type in ('MISSING_TIMELINE', 'PARSE_ERROR') then 'HIGH'
        when v_issue_type in ('CURRENCY_MISMATCH', 'NEGATIVE_NET') then 'CRITICAL'
        else 'NORMAL'
      end,
      v_details,
      now(),
      now(),
      null
    )
    on conflict (issue_key)
    do update set
      issue_type = excluded.issue_type,
      status = 'OPEN',
      priority = excluded.priority,
      detail = excluded.detail,
      updated_at = now(),
      resolved_at = null;
  else
    update public.shop_payment_sot_resolution_queue
    set
      status = 'RESOLVED',
      detail = v_details,
      updated_at = now(),
      resolved_at = now()
    where issue_key = v_issue_key
      and status = 'OPEN';
  end if;

  return query
  select p_order_id, v_recon_status, v_net, v_gross, v_refund, v_currency, v_issue_key;
end;
$$;

do $$
begin
  if to_regprocedure('public.cms_fn_set_updated_at()') is not null then
    begin
      create trigger trg_shop_poll_run_updated_at
      before update on public.shop_poll_run
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;

    begin
      create trigger trg_shop_poll_cursor_updated_at
      before update on public.shop_poll_cursor
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;

    begin
      create trigger trg_shop_order_payment_sot_updated_at
      before update on public.shop_order_payment_sot
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;

    begin
      create trigger trg_shop_payment_sot_resolution_queue_updated_at
      before update on public.shop_payment_sot_resolution_queue
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on public.shop_order_payment_sot to authenticated';
    execute 'grant select on public.shop_payment_sot_resolution_queue to authenticated';
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on public.shop_webhook_inbox to service_role';
    execute 'grant select, insert, update, delete on public.shop_poll_run to service_role';
    execute 'grant select, insert, update, delete on public.shop_poll_cursor to service_role';
    execute 'grant select, insert, update, delete on public.shop_order_observation to service_role';
    execute 'grant select, insert, update, delete on public.shop_paymenttimeline_item_observation to service_role';
    execute 'grant select, insert, update, delete on public.shop_order_payment_sot to service_role';
    execute 'grant select, insert, update, delete on public.shop_payment_sot_resolution_queue to service_role';

    execute 'grant execute on function public.shop_fn_safe_timestamptz_v1(text) to service_role';
    execute 'grant execute on function public.shop_fn_safe_numeric_v1(text) to service_role';
    execute 'grant execute on function public.shop_fn_try_start_poll_run_v1(uuid, timestamptz, timestamptz, jsonb) to service_role';
    execute 'grant execute on function public.shop_fn_upsert_poll_cursor_v1(uuid, timestamptz, text) to service_role';
    execute 'grant execute on function public.shop_fn_record_payment_observations_v1(uuid, jsonb, jsonb, timestamptz) to service_role';
    execute 'grant execute on function public.shop_fn_recompute_order_payment_sot_v1(uuid, text) to service_role';
  end if;
end $$;
