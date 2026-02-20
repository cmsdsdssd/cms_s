set search_path = public, pg_temp;
-- 1) enums
do $$ begin
  create type public.cms_e_receipt_status as enum ('UPLOADED','LINKED','ARCHIVED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.cms_e_cost_status as enum ('PROVISIONAL','ACTUAL');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.cms_e_cost_source as enum ('NONE','MASTER','RECEIPT','MANUAL');
exception when duplicate_object then null; end $$;
-- 2) receipt inbox
create table if not exists public.cms_receipt_inbox (
  receipt_id uuid primary key default gen_random_uuid(),

  received_at timestamptz not null default now(),
  source text not null default 'SCANNER',  -- SCANNER | UPLOAD | N8N | ETC

  file_bucket text not null default 'receipt_inbox',
  file_path text not null,
  file_sha256 text,
  file_size_bytes bigint,
  mime_type text,

  vendor_party_id uuid references public.cms_party(party_id),
  issued_at date,
  total_amount_krw numeric,
  currency_code text not null default 'KRW',

  status public.cms_e_receipt_status not null default 'UPLOADED',
  memo text,
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- unique: (bucket, path)
do $$ begin
  alter table public.cms_receipt_inbox
    add constraint uq_cms_receipt_inbox_bucket_path unique (file_bucket, file_path);
exception when duplicate_object then null; end $$;
-- optional dedupe: sha256 unique (when provided)
create unique index if not exists uq_cms_receipt_inbox_sha256
  on public.cms_receipt_inbox(file_sha256)
  where file_sha256 is not null;
create index if not exists idx_cms_receipt_inbox_status on public.cms_receipt_inbox(status);
create index if not exists idx_cms_receipt_inbox_vendor on public.cms_receipt_inbox(vendor_party_id);
create index if not exists idx_cms_receipt_inbox_received_at on public.cms_receipt_inbox(received_at desc);
-- updated_at trigger
do $$ begin
  create trigger trg_cms_receipt_inbox_updated_at
  before update on public.cms_receipt_inbox
  for each row execute function public.cms_fn_set_updated_at();
exception when duplicate_object then null; end $$;
-- 3) receipt usage link (어떤 엔티티에 이 영수증을 연결했는지)
create table if not exists public.cms_receipt_usage (
  receipt_id uuid not null references public.cms_receipt_inbox(receipt_id) on delete cascade,
  entity_type text not null,     -- SHIPMENT_HEADER | SHIPMENT_LINE | INVENTORY_MOVE_HEADER | INVENTORY_MOVE_LINE | ...
  entity_id uuid not null,
  note text,
  used_at timestamptz not null default now(),
  actor_person_id uuid references public.cms_person(person_id),
  correlation_id uuid,

  primary key (receipt_id, entity_type, entity_id)
);
create index if not exists idx_cms_receipt_usage_entity on public.cms_receipt_usage(entity_type, entity_id);
create index if not exists idx_cms_receipt_usage_used_at on public.cms_receipt_usage(used_at desc);
