-- 20260128302000_cms_0213_inventory_stocktake_tables.sql
set search_path = public, pg_temp;
-- ---------------------------------------------------------------------
-- 0) ENUM: stocktake session status (ADD-ONLY)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname='public' and t.typname='cms_e_inventory_count_status'
  ) then
    create type public.cms_e_inventory_count_status as enum ('DRAFT','FINALIZED','VOID');
  end if;
end $$;
-- ---------------------------------------------------------------------
-- 1) SEQUENCE: session_no (human-friendly)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='cms_inventory_count_session_no_seq'
  ) then
    create sequence public.cms_inventory_count_session_no_seq
      as bigint
      start with 200000
      increment by 1
      minvalue 1;
  end if;
end $$;
-- ---------------------------------------------------------------------
-- 2) updated_at touch trigger helper (local, safe)
-- ---------------------------------------------------------------------
create or replace function public.cms_fn__touch_updated_at_v1()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;
-- ---------------------------------------------------------------------
-- 3) TABLE: inventory_count_session
-- ---------------------------------------------------------------------
create table if not exists public.cms_inventory_count_session (
  session_id uuid primary key default gen_random_uuid(),
  session_no bigint not null default nextval('public.cms_inventory_count_session_no_seq'),
  session_code text null,                              -- optional, human readable
  snapshot_at timestamptz not null default now(),       -- as-of 기준
  location_code text null,
  status public.cms_e_inventory_count_status not null default 'DRAFT',
  memo text null,
  meta jsonb not null default '{}'::jsonb,

  generated_move_id uuid null,                          -- FINALIZE 시 생성된 ADJUST move_id (없을 수도 있음)
  idempotency_key text null,                            -- 중복 생성 방지

  finalized_at timestamptz null,
  voided_at timestamptz null,
  void_reason text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- uniqueness
create unique index if not exists cms_inventory_count_session_session_no_uq
  on public.cms_inventory_count_session(session_no);
create unique index if not exists cms_inventory_count_session_session_code_uq
  on public.cms_inventory_count_session(session_code)
  where session_code is not null and length(trim(session_code))>0;
create unique index if not exists cms_inventory_count_session_idempo_uq
  on public.cms_inventory_count_session(idempotency_key)
  where idempotency_key is not null and length(trim(idempotency_key))>0;
create index if not exists cms_inventory_count_session_status_idx
  on public.cms_inventory_count_session(status, snapshot_at desc);
create index if not exists cms_inventory_count_session_generated_move_idx
  on public.cms_inventory_count_session(generated_move_id);
-- trigger
drop trigger if exists trg_cms_inventory_count_session_touch on public.cms_inventory_count_session;
create trigger trg_cms_inventory_count_session_touch
before update on public.cms_inventory_count_session
for each row execute function public.cms_fn__touch_updated_at_v1();
-- ---------------------------------------------------------------------
-- 4) TABLE: inventory_count_line
-- ---------------------------------------------------------------------
create table if not exists public.cms_inventory_count_line (
  count_line_id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.cms_inventory_count_session(session_id),

  line_no int not null,
  item_ref_type public.cms_e_inventory_item_ref_type not null default 'UNLINKED',
  master_id uuid null references public.cms_master_item(master_id),
  part_id uuid null,                                   -- parts 모듈과 연결될 수 있으나 FK는 v1.1에서 강제하지 않음

  item_name text not null,                              -- 사람이 입력/확인 가능한 라벨
  variant_hint text null,

  counted_qty numeric not null,                         -- 실사 수량(관측값)
  system_qty_asof numeric null,                         -- snapshot_at 기준 시스템 수량(확정 시 기록)
  delta_qty numeric null,                               -- counted - system (확정 시 기록)

  note text null,
  meta jsonb not null default '{}'::jsonb,

  is_void boolean not null default false,
  void_reason text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cms_inventory_count_line_qty_chk check (counted_qty >= 0),
  constraint cms_inventory_count_line_line_no_chk check (line_no > 0)
);
-- partial uniqueness: same (session_id, line_no) for active lines
create unique index if not exists cms_inventory_count_line_session_line_no_uq
  on public.cms_inventory_count_line(session_id, line_no)
  where is_void = false;
create index if not exists cms_inventory_count_line_session_idx
  on public.cms_inventory_count_line(session_id, is_void, line_no);
create index if not exists cms_inventory_count_line_master_idx
  on public.cms_inventory_count_line(master_id)
  where master_id is not null;
-- trigger
drop trigger if exists trg_cms_inventory_count_line_touch on public.cms_inventory_count_line;
create trigger trg_cms_inventory_count_line_touch
before update on public.cms_inventory_count_line
for each row execute function public.cms_fn__touch_updated_at_v1();
-- ---------------------------------------------------------------------
-- 5) RLS + grants (Read는 view 중심이지만, 테이블 select도 authenticated에 허용)
-- ---------------------------------------------------------------------
revoke all on public.cms_inventory_count_session from anon, authenticated;
revoke all on public.cms_inventory_count_line from anon, authenticated;
grant select on public.cms_inventory_count_session to authenticated;
grant select on public.cms_inventory_count_line to authenticated;
alter table public.cms_inventory_count_session enable row level security;
alter table public.cms_inventory_count_line enable row level security;
drop policy if exists cms_select_authenticated on public.cms_inventory_count_session;
create policy cms_select_authenticated on public.cms_inventory_count_session
for select to authenticated using (true);
drop policy if exists cms_select_authenticated on public.cms_inventory_count_line;
create policy cms_select_authenticated on public.cms_inventory_count_line
for select to authenticated using (true);
