set search_path = public, pg_temp;

-- 1) part kind enum
do $$ begin
  create type public.cms_e_part_kind as enum ('PART','STONE');
exception when duplicate_object then null; end $$;

-- 2) part master
create table if not exists public.cms_part_item (
  part_id uuid primary key default gen_random_uuid(),

  -- 이름 중심 운영: 일단 이름이 곧 기준키
  part_name text not null unique,

  part_kind public.cms_e_part_kind not null default 'PART',
  family_name text,                -- 분석용 그룹(예: 볼/체인/큐빅)
  spec_text text,                  -- 예: 3mm, 40cm, 0.8mm 등

  unit_default text not null default 'EA', -- 'EA'|'G'|'M'
  is_reusable boolean not null default false,

  -- v2(재주문 알림/상한하한) 대비
  reorder_min_qty numeric,
  reorder_max_qty numeric,

  -- 단가 자동채움용(최근단가 캐시)
  last_unit_cost_krw numeric,

  -- v2(QR) 대비
  qr_code text unique,

  note text,
  is_active boolean not null default true,
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_cms_part_unit_default
    check (unit_default in ('EA','G','M'))
);

create index if not exists idx_cms_part_kind on public.cms_part_item(part_kind);
create index if not exists idx_cms_part_family on public.cms_part_item(family_name);
create index if not exists idx_cms_part_active on public.cms_part_item(is_active);

-- 3) part alias (입력 편의/향후 QR 확장)
create table if not exists public.cms_part_alias (
  alias_id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.cms_part_item(part_id) on delete cascade,
  alias_name text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_cms_part_alias_part on public.cms_part_alias(part_id);

-- 4) updated_at trigger
do $$ begin
  create trigger trg_cms_part_updated_at
  before update on public.cms_part_item
  for each row execute function public.cms_fn_set_updated_at();
exception when duplicate_object then null; end $$;

-- 5) inventory_move_line에 단가 컬럼(없으면 추가)
do $$ begin
  alter table public.cms_inventory_move_line add column unit_cost_krw numeric;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.cms_inventory_move_line add column amount_krw numeric;
exception when duplicate_column then null; end $$;

-- 6) inventory_move_line.part_id FK 보강(있어도 안전)
do $$ begin
  alter table public.cms_inventory_move_line
    add constraint fk_inventory_move_line_part
    foreign key (part_id) references public.cms_part_item(part_id) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cms_inventory_move_line validate constraint fk_inventory_move_line_part;
exception when others then
  -- 기존 데이터에 part_id가 있되 master가 없으면 validate가 실패할 수 있음.
  -- 이 경우 운영을 막지 않기 위해 validate는 스킵.
  null;
end $$;
