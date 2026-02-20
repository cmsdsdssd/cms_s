-- add-only: append-only RAW CN cost analysis snapshot table
-- 목적: 마스터별 RAW 원가 분석 입력/계산 결과와 당시 시세 스냅샷을 이력으로 보존

create table if not exists public.cms_master_item_cn_raw_cost_snapshot (
  snapshot_id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.cms_master_item(master_id) on delete cascade,

  request_id uuid null,
  source text not null default 'catalog:web',
  formula_version integer not null default 1,

  analysis_date date null,
  labor_basis text not null default 'PER_G',

  total_price_cny numeric not null default 0,
  silver_price_cny_per_g numeric not null default 0,
  net_weight_g_snapshot numeric not null default 0,
  silver_amount_cny_snapshot numeric not null default 0,
  labor_base_cny_snapshot numeric not null default 0,
  labor_cny_snapshot numeric not null default 0,

  cny_krw_rate_snapshot numeric not null default 0,
  fx_asof timestamptz not null default now(),
  silver_price_krw_per_g_snapshot numeric not null default 0,
  labor_krw_snapshot numeric not null default 0,
  total_cost_krw_snapshot numeric not null default 0,

  raw_input jsonb not null default '{}'::jsonb,
  computed jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);
comment on table public.cms_master_item_cn_raw_cost_snapshot
  is 'Append-only RAW CN cost analysis snapshots per master item';
comment on column public.cms_master_item_cn_raw_cost_snapshot.fx_asof
  is 'FX/market as-of timestamp used at calculation time';
comment on column public.cms_master_item_cn_raw_cost_snapshot.request_id
  is 'Optional idempotency key from writer';
do $$
begin
  alter table public.cms_master_item_cn_raw_cost_snapshot
    add constraint cms_master_item_cn_raw_cost_snapshot_labor_basis_valid
    check (labor_basis in ('PER_G', 'PER_PIECE'));
exception
  when duplicate_object then null;
end $$;
do $$
begin
  alter table public.cms_master_item_cn_raw_cost_snapshot
    add constraint cms_master_item_cn_raw_cost_snapshot_formula_version_positive
    check (formula_version > 0);
exception
  when duplicate_object then null;
end $$;
do $$
begin
  alter table public.cms_master_item_cn_raw_cost_snapshot
    add constraint cms_master_item_cn_raw_cost_snapshot_total_price_nonneg
    check (total_price_cny >= 0);
exception
  when duplicate_object then null;
end $$;
do $$
begin
  alter table public.cms_master_item_cn_raw_cost_snapshot
    add constraint cms_master_item_cn_raw_cost_snapshot_silver_price_nonneg
    check (silver_price_cny_per_g >= 0);
exception
  when duplicate_object then null;
end $$;
do $$
begin
  alter table public.cms_master_item_cn_raw_cost_snapshot
    add constraint cms_master_item_cn_raw_cost_snapshot_net_weight_nonneg
    check (net_weight_g_snapshot >= 0);
exception
  when duplicate_object then null;
end $$;
do $$
begin
  alter table public.cms_master_item_cn_raw_cost_snapshot
    add constraint cms_master_item_cn_raw_cost_snapshot_rate_nonneg
    check (cny_krw_rate_snapshot >= 0);
exception
  when duplicate_object then null;
end $$;
do $$
begin
  alter table public.cms_master_item_cn_raw_cost_snapshot
    add constraint cms_master_item_cn_raw_cost_snapshot_total_cost_nonneg
    check (total_cost_krw_snapshot >= 0);
exception
  when duplicate_object then null;
end $$;
create index if not exists idx_cms_master_item_cn_raw_cost_snapshot_master_created_at
  on public.cms_master_item_cn_raw_cost_snapshot(master_id, created_at desc);
create index if not exists idx_cms_master_item_cn_raw_cost_snapshot_analysis_date
  on public.cms_master_item_cn_raw_cost_snapshot(analysis_date desc);
create unique index if not exists uq_cms_master_item_cn_raw_cost_snapshot_master_request
  on public.cms_master_item_cn_raw_cost_snapshot(master_id, request_id)
  where request_id is not null;
create or replace function public.cms_fn_block_cn_raw_cost_snapshot_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'cms_master_item_cn_raw_cost_snapshot is append-only';
end;
$$;
do $$
begin
  create trigger trg_cms_master_item_cn_raw_cost_snapshot_block_update
  before update on public.cms_master_item_cn_raw_cost_snapshot
  for each row execute function public.cms_fn_block_cn_raw_cost_snapshot_mutation();
exception
  when duplicate_object then null;
end $$;
do $$
begin
  create trigger trg_cms_master_item_cn_raw_cost_snapshot_block_delete
  before delete on public.cms_master_item_cn_raw_cost_snapshot
  for each row execute function public.cms_fn_block_cn_raw_cost_snapshot_mutation();
exception
  when duplicate_object then null;
end $$;
grant select on public.cms_master_item_cn_raw_cost_snapshot to authenticated, service_role;
grant insert on public.cms_master_item_cn_raw_cost_snapshot to service_role;
