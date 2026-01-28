-- 20260128130000_cms_0200_market_tick_schema.sql
-- MARKET TICK schema hardening (KRW per g / 원-그램 고정)
-- ADD-ONLY. public.cms_* only.

set search_path = public;

-- (Supabase usually has pgcrypto; keep idempotent)
create extension if not exists pgcrypto;

-- 1) Normalize legacy rows for stable keying (source NULL -> 'MANUAL')
update public.cms_market_tick
set source = 'MANUAL'
where source is null;

-- 2) Add columns (ADD-ONLY)
alter table public.cms_market_tick
  add column if not exists is_void boolean not null default false;

alter table public.cms_market_tick
  add column if not exists void_reason text null;

alter table public.cms_market_tick
  add column if not exists voided_at timestamptz null;

alter table public.cms_market_tick
  add column if not exists voided_by_person_id uuid null;

alter table public.cms_market_tick
  add column if not exists correlation_id uuid null;

-- updated_at: add -> backfill -> default -> not null
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public' and table_name='cms_market_tick' and column_name='updated_at'
  ) then
    alter table public.cms_market_tick add column updated_at timestamptz null;
  end if;
end$$;

update public.cms_market_tick
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

alter table public.cms_market_tick
  alter column updated_at set default now();

alter table public.cms_market_tick
  alter column updated_at set not null;

-- 3) FK (optional but useful)
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints tc
    where tc.table_schema='public'
      and tc.table_name='cms_market_tick'
      and tc.constraint_type='FOREIGN KEY'
      and tc.constraint_name='fk_cms_market_tick_voided_by_person'
  ) then
    alter table public.cms_market_tick
      add constraint fk_cms_market_tick_voided_by_person
      foreign key (voided_by_person_id) references public.cms_person(person_id);
  end if;
end$$;

-- 4) Comments (unit lock)
comment on column public.cms_market_tick.price is 'KRW per gram (원/그램)';

-- 5) Indexes / constraints
-- Active unique key: one active tick per (symbol, observed_at, source)
create unique index if not exists uq_cms_market_tick_active_key
on public.cms_market_tick(symbol, observed_at, source)
where is_void = false;

-- Latest lookup speed
create index if not exists idx_cms_market_tick_latest
on public.cms_market_tick(symbol, observed_at desc, created_at desc)
where is_void = false;

create index if not exists idx_cms_market_tick_observed_at
on public.cms_market_tick(observed_at desc);

create index if not exists idx_cms_market_tick_correlation_id
on public.cms_market_tick(correlation_id);

-- 6) updated_at trigger (if cms_fn_set_updated_at() exists)
do $$
begin
  if to_regprocedure('public.cms_fn_set_updated_at()') is not null then
    if not exists (
      select 1 from pg_trigger
      where tgname = 'trg_cms_market_tick_updated_at'
    ) then
      execute $SQL$
        create trigger trg_cms_market_tick_updated_at
        before update on public.cms_market_tick
        for each row
        execute function public.cms_fn_set_updated_at();
      $SQL$;
    end if;
  end if;
end$$;
