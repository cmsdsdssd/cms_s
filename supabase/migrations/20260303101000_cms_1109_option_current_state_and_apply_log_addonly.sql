set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1109_option_current_state_and_apply_log_addonly
-- Reliable SoT tables for option additional amount apply flow
-- -----------------------------------------------------------------------------

create table if not exists public.channel_option_current_state_v1 (
  state_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  channel_product_id uuid references public.sales_channel_product(channel_product_id) on delete set null,
  master_item_id uuid not null references public.cms_master_item(master_item_id),
  external_product_no text not null,
  external_variant_code text not null,
  product_name text,
  option_path jsonb not null default '[]'::jsonb,
  material_code text,
  weight_g numeric(12,3),
  deduction_weight_g numeric(12,3),
  net_weight_g numeric(12,3),
  material_price_krw integer,
  tick_gold_krw_per_g integer,
  tick_silver_krw_per_g integer,
  base_price_krw integer not null default 0,
  retail_price_krw integer,
  floor_price_krw integer not null default 0,
  exclude_plating_labor boolean not null default false,
  plating_labor_sell_krw integer not null default 0,
  total_labor_sell_krw integer not null default 0,
  option_sync_delta_krw integer not null default 0,
  final_target_additional_amount_krw integer not null default 0,
  last_pushed_additional_amount_krw integer,
  last_push_status text not null default 'PENDING',
  last_push_http_status integer,
  last_push_error text,
  source_snapshot_hash text,
  version bigint not null default 1,
  last_pushed_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text
);

do $$
begin
  alter table public.channel_option_current_state_v1
    add constraint channel_option_current_state_v1_non_blank_keys
    check (btrim(external_product_no) <> '' and btrim(external_variant_code) <> '');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_current_state_v1
    add constraint channel_option_current_state_v1_non_negative
    check (
      floor_price_krw >= 0
      and base_price_krw >= 0
      and coalesce(weight_g, 0) >= 0
      and coalesce(deduction_weight_g, 0) >= 0
      and coalesce(net_weight_g, 0) >= 0
      and coalesce(plating_labor_sell_krw, 0) >= 0
      and coalesce(total_labor_sell_krw, 0) >= 0
    );
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_current_state_v1
    add constraint channel_option_current_state_v1_status_enum
    check (last_push_status in ('PENDING', 'SUCCEEDED', 'FAILED', 'VERIFY_FAILED'));
exception when duplicate_object then
  null;
end $$;

create unique index if not exists uq_channel_option_current_state_v1_variant
  on public.channel_option_current_state_v1(channel_id, external_product_no, external_variant_code);

create index if not exists idx_channel_option_current_state_v1_channel_product
  on public.channel_option_current_state_v1(channel_id, external_product_no, updated_at desc);

create index if not exists idx_channel_option_current_state_v1_master
  on public.channel_option_current_state_v1(channel_id, master_item_id, updated_at desc);

create index if not exists idx_channel_option_current_state_v1_status
  on public.channel_option_current_state_v1(channel_id, last_push_status, updated_at desc);


create table if not exists public.channel_option_apply_log_v1 (
  log_id uuid primary key default gen_random_uuid(),
  state_id uuid references public.channel_option_current_state_v1(state_id) on delete set null,
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  channel_product_id uuid references public.sales_channel_product(channel_product_id) on delete set null,
  master_item_id uuid references public.cms_master_item(master_item_id),
  external_product_no text not null,
  external_variant_code text,
  action_type text not null,
  result_status text not null default 'PENDING',
  expected_additional_amount_krw integer,
  actual_additional_amount_krw integer,
  http_status integer,
  error_message text,
  request_payload jsonb,
  response_payload jsonb,
  verify_payload jsonb,
  source_snapshot_hash text,
  triggered_by text,
  created_at timestamptz not null default now()
);

do $$
begin
  alter table public.channel_option_apply_log_v1
    add constraint channel_option_apply_log_v1_action_type_enum
    check (action_type in ('REQUESTED', 'PRODUCT_UPDATED', 'VARIANT_PUSHED', 'VERIFIED', 'FAILED'));
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_apply_log_v1
    add constraint channel_option_apply_log_v1_result_status_enum
    check (result_status in ('PENDING', 'SUCCEEDED', 'FAILED', 'VERIFY_FAILED'));
exception when duplicate_object then
  null;
end $$;

create index if not exists idx_channel_option_apply_log_v1_channel_created
  on public.channel_option_apply_log_v1(channel_id, created_at desc);

create index if not exists idx_channel_option_apply_log_v1_product_created
  on public.channel_option_apply_log_v1(channel_id, external_product_no, created_at desc);

create index if not exists idx_channel_option_apply_log_v1_state_created
  on public.channel_option_apply_log_v1(state_id, created_at desc);

do $$
begin
  if to_regprocedure('public.cms_fn_set_updated_at()') is not null then
    begin
      create trigger trg_channel_option_current_state_v1_updated_at
      before update on public.channel_option_current_state_v1
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;
