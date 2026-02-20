-- add-only: mutable current-row table for RAW CN cost entries
-- 목적: 편집 화면에서 행 삭제/수정 결과를 현재 상태로 정확히 반영
-- 주의: 분석 이력(append-only)은 cms_master_item_cn_raw_cost_snapshot에 별도 보존

create table if not exists public.cms_master_item_cn_raw_cost_entry (
  master_id uuid not null references public.cms_master_item(master_id) on delete cascade,
  entry_id uuid not null,

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

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,

  primary key (master_id, entry_id)
);
comment on table public.cms_master_item_cn_raw_cost_entry
  is 'Current RAW CN cost rows per master (editable set)';
comment on column public.cms_master_item_cn_raw_cost_entry.deleted_at
  is 'Soft-delete marker for removed rows from current set';
do $$
begin
  alter table public.cms_master_item_cn_raw_cost_entry
    add constraint cms_master_item_cn_raw_cost_entry_labor_basis_valid
    check (labor_basis in ('PER_G', 'PER_PIECE'));
exception
  when duplicate_object then null;
end $$;
do $$
begin
  alter table public.cms_master_item_cn_raw_cost_entry
    add constraint cms_master_item_cn_raw_cost_entry_formula_version_positive
    check (formula_version > 0);
exception
  when duplicate_object then null;
end $$;
do $$
begin
  alter table public.cms_master_item_cn_raw_cost_entry
    add constraint cms_master_item_cn_raw_cost_entry_total_price_nonneg
    check (total_price_cny >= 0);
exception
  when duplicate_object then null;
end $$;
do $$
begin
  alter table public.cms_master_item_cn_raw_cost_entry
    add constraint cms_master_item_cn_raw_cost_entry_silver_price_nonneg
    check (silver_price_cny_per_g >= 0);
exception
  when duplicate_object then null;
end $$;
do $$
begin
  alter table public.cms_master_item_cn_raw_cost_entry
    add constraint cms_master_item_cn_raw_cost_entry_net_weight_nonneg
    check (net_weight_g_snapshot >= 0);
exception
  when duplicate_object then null;
end $$;
do $$
begin
  alter table public.cms_master_item_cn_raw_cost_entry
    add constraint cms_master_item_cn_raw_cost_entry_rate_nonneg
    check (cny_krw_rate_snapshot >= 0);
exception
  when duplicate_object then null;
end $$;
do $$
begin
  alter table public.cms_master_item_cn_raw_cost_entry
    add constraint cms_master_item_cn_raw_cost_entry_total_cost_nonneg
    check (total_cost_krw_snapshot >= 0);
exception
  when duplicate_object then null;
end $$;
create index if not exists idx_cms_master_item_cn_raw_cost_entry_master_active_date
  on public.cms_master_item_cn_raw_cost_entry(master_id, analysis_date asc, created_at asc)
  where deleted_at is null;
create index if not exists idx_cms_master_item_cn_raw_cost_entry_master_deleted_at
  on public.cms_master_item_cn_raw_cost_entry(master_id, deleted_at);
create or replace function public.cms_fn_touch_master_cn_raw_cost_entry_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
do $$
begin
  create trigger trg_cms_master_item_cn_raw_cost_entry_touch_updated_at
  before update on public.cms_master_item_cn_raw_cost_entry
  for each row execute function public.cms_fn_touch_master_cn_raw_cost_entry_updated_at();
exception
  when duplicate_object then null;
end $$;
grant select on public.cms_master_item_cn_raw_cost_entry to authenticated, service_role;
grant insert, update on public.cms_master_item_cn_raw_cost_entry to service_role;
