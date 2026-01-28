-- 20260128100100_cms_0027_inventory_tables.sql
-- cms_0027: inventory_move header/line tables + indexes + updated_at triggers

set search_path = public, pg_temp;

-- 1) header
create table if not exists public.cms_inventory_move_header (
  move_id uuid primary key default gen_random_uuid(),
  move_no bigint not null default nextval('public.cms_inventory_move_no_seq'),
  move_type public.cms_e_inventory_move_type not null,
  status public.cms_e_inventory_move_status not null default 'DRAFT',

  occurred_at timestamptz not null default now(),

  -- 관련 party(거래처/고객/공장 등) - 선택
  party_id uuid references public.cms_party(party_id),

  -- v2 대비(지금은 optional)
  location_code text,

  -- 외부 이벤트 연결(자동 트래킹용)
  ref_doc_type text,
  ref_doc_id uuid,

  memo text,
  source text not null default 'MANUAL',
  meta jsonb not null default '{}'::jsonb,

  -- 자동화/재시도 멱등키
  idempotency_key text unique,

  posted_at timestamptz,
  voided_at timestamptz,
  void_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_cms_inventory_move_no
  on public.cms_inventory_move_header(move_no);

create index if not exists idx_cms_inventory_move_status_time
  on public.cms_inventory_move_header(status, occurred_at desc);

create index if not exists idx_cms_inventory_move_party_time
  on public.cms_inventory_move_header(party_id, occurred_at desc);

create index if not exists idx_cms_inventory_move_ref_doc
  on public.cms_inventory_move_header(ref_doc_type, ref_doc_id);

create index if not exists idx_cms_inventory_move_idempo
  on public.cms_inventory_move_header(idempotency_key);

-- 2) line
create table if not exists public.cms_inventory_move_line (
  move_line_id uuid primary key default gen_random_uuid(),
  move_id uuid not null references public.cms_inventory_move_header(move_id) on delete cascade,
  line_no int not null,

  direction public.cms_e_inventory_direction not null,
  qty numeric not null check (qty > 0),
  unit text not null default 'EA',

  item_ref_type public.cms_e_inventory_item_ref_type not null default 'UNLINKED',

  -- MASTER 연결(존재하면 분석/집계가 쉬워짐)
  master_id uuid references public.cms_master_item(master_id),

  -- PART 연결(v2에서 FK 연결 예정, v1은 컬럼만 둠)
  part_id uuid,

  -- 연결이 없어도 "기록은 반드시 남긴다"
  item_name text not null check (length(trim(item_name)) > 0),
  variant_hint text,

  note text,
  meta jsonb not null default '{}'::jsonb,

  -- 라인 삭제 금지 → void로만 처리(감사/분석용)
  is_void boolean not null default false,
  void_reason text,

  -- 자동 트래킹용(예: shipment_line_id 등)
  ref_entity_type text,
  ref_entity_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- ref type별 최소 무결성(운영 불편 줄이기 위해 "정확 매칭" 강제는 안 함)
  constraint ck_cms_inventory_line_ref
    check (
      (item_ref_type = 'MASTER' and master_id is not null and part_id is null)
      or (item_ref_type = 'PART' and part_id is not null and master_id is null)
      or (item_ref_type = 'UNLINKED' and master_id is null and part_id is null)
    )
);

create unique index if not exists ux_cms_inventory_line_move_line_no_alive
  on public.cms_inventory_move_line(move_id, line_no)
  where is_void = false;

create index if not exists idx_cms_inventory_line_move
  on public.cms_inventory_move_line(move_id, line_no);

create index if not exists idx_cms_inventory_line_master
  on public.cms_inventory_move_line(master_id)
  where master_id is not null;

create index if not exists idx_cms_inventory_line_item_name
  on public.cms_inventory_move_line(item_name);

create index if not exists idx_cms_inventory_line_ref_entity
  on public.cms_inventory_move_line(ref_entity_type, ref_entity_id);

-- updated_at triggers(기존 helper 사용)
do $$ begin
  create trigger trg_cms_inventory_move_header_updated_at
  before update on public.cms_inventory_move_header
  for each row execute function public.cms_fn_set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_cms_inventory_move_line_updated_at
  before update on public.cms_inventory_move_line
  for each row execute function public.cms_fn_set_updated_at();
exception when duplicate_object then null; end $$;
