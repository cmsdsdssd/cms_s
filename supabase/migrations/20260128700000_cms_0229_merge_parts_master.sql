set search_path = public, pg_temp;
-- 1) Type updates: master_kind
do $$ begin
  create type public.cms_e_master_kind as enum ('MODEL', 'PART', 'STONE');
exception when duplicate_object then null; end $$;
-- 2) Alter cms_master_item to support parts
alter table public.cms_master_item
  add column if not exists master_kind public.cms_e_master_kind not null default 'MODEL',
  add column if not exists family_name text,
  add column if not exists spec_text text,
  add column if not exists unit text not null default 'EA',
  add column if not exists is_reusable boolean not null default false,
  add column if not exists reorder_min_qty numeric,
  add column if not exists reorder_max_qty numeric,
  add column if not exists qr_code text unique,
  add column if not exists is_active boolean not null default true;
alter table public.cms_master_item alter column category_code drop not null;
-- 3) Migrate data (only if source tables exist)
do $$ 
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='cms_part_item') then
    insert into public.cms_master_item (
      master_id, model_name, master_kind, family_name, spec_text, unit, is_reusable, 
      reorder_min_qty, reorder_max_qty, qr_code, note, is_active, created_at, updated_at
    )
    select
      part_id,
      part_name,
      case when part_kind='STONE' then 'STONE'::public.cms_e_master_kind else 'PART'::public.cms_e_master_kind end,
      family_name,
      spec_text,
      unit_default,
      is_reusable,
      reorder_min_qty,
      reorder_max_qty,
      qr_code,
      note,
      is_active,
      created_at,
      updated_at
    from public.cms_part_item
    on conflict (model_name) do nothing;
  end if;
end $$;
-- 4) Create cms_master_alias (replacing cms_part_alias)
create table if not exists public.cms_master_alias (
  alias_id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.cms_master_item(master_id) on delete cascade,
  alias_name text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists idx_cms_master_alias_master on public.cms_master_alias(master_id);
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='cms_part_alias') then
    insert into public.cms_master_alias (master_id, alias_name, created_at)
    select part_id, alias_name, created_at
    from public.cms_part_alias
    where exists (select 1 from public.cms_master_item where master_id = cms_part_alias.part_id)
    on conflict do nothing;
  end if;
end $$;
-- 5) DROP DEPENDENT VIEWS EARLY
drop view if exists public.cms_v_inventory_move_lines_enriched_v1 cascade;
drop view if exists public.cms_v_part_master_with_position_v1 cascade;
drop view if exists public.cms_v_part_move_lines_v1 cascade;
drop view if exists public.cms_v_part_unlinked_worklist_v1 cascade;
drop view if exists public.cms_v_part_usage_daily_v1 cascade;
-- 6) Update Inventory Lines
alter table public.cms_inventory_move_line drop constraint if exists ck_cms_inventory_line_ref;
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema='public' 
    and table_name='cms_inventory_move_line' 
    and column_name='part_id'
  ) then
    update public.cms_inventory_move_line
    set master_id = part_id,
        item_ref_type = 'MASTER'
    where item_ref_type = 'PART' and part_id is not null;
    
    alter table public.cms_inventory_move_line drop column part_id;
  end if;
end $$;
alter table public.cms_inventory_move_line add constraint ck_cms_inventory_line_ref 
    check (
      (item_ref_type = 'MASTER' and master_id is not null)
      or (item_ref_type = 'UNLINKED' and master_id is null)
    );
-- 7) Drop old objects
drop table if exists public.cms_part_alias cascade;
drop table if exists public.cms_part_item cascade;
drop type if exists public.cms_e_part_kind cascade;
-- 8) Recreate Views

-- ENRICHED VIEW (Updated)
drop view if exists public.cms_v_inventory_move_lines_enriched_v1;
create view public.cms_v_inventory_move_lines_enriched_v1
with (security_invoker = true)
as
select
  h.move_id,
  h.move_no,
  h.move_type,
  h.status as move_status,
  h.occurred_at,
  h.party_id,
  p.name as party_name,
  h.location_code,
  h.ref_doc_type,
  h.ref_doc_id,
  h.memo as move_memo,
  h.source as move_source,

  l.move_line_id,
  l.line_no,
  l.direction,
  l.qty,
  l.unit,

  l.item_ref_type,
  l.master_id,
  m.model_name as master_model_name,
  -- removed part_id
  l.item_name,
  l.variant_hint,
  l.note as line_note,
  l.meta as line_meta,
  l.is_void,
  l.void_reason,
  l.ref_entity_type,
  l.ref_entity_id,

  case when l.direction='IN' then l.qty else -l.qty end as signed_qty,

  l.created_at as line_created_at,
  l.updated_at as line_updated_at
from public.cms_inventory_move_header h
join public.cms_inventory_move_line l on l.move_id = h.move_id
left join public.cms_party p on p.party_id = h.party_id
left join public.cms_master_item m on m.master_id = l.master_id;
-- VIEW 1: Master List
drop view if exists public.cms_v_part_master_with_position_v1;
create view public.cms_v_part_master_with_position_v1 as
with ledger as (
  select
    l.master_id,
    sum(case when l.direction='IN' then l.qty else -l.qty end) as on_hand_qty,
    max(h.occurred_at) as last_move_at,
    max(case when h.move_type='RECEIPT' then h.occurred_at end) as last_receipt_at,
    max(case when h.move_type='ISSUE' then h.occurred_at end) as last_issue_at
  from public.cms_inventory_move_line l
  join public.cms_inventory_move_header h on h.move_id=l.move_id
  where h.status='POSTED'
    and l.is_void=false
    and l.item_ref_type='MASTER'
    and l.master_id is not null
  group by l.master_id
),
avg_cost as (
  select
    l.master_id,
    sum(l.qty * l.unit_cost_krw) filter (where h.move_type='RECEIPT' and l.direction='IN' and l.unit_cost_krw is not null)
    / nullif(sum(l.qty) filter (where h.move_type='RECEIPT' and l.direction='IN' and l.unit_cost_krw is not null), 0)
    as weighted_avg_unit_cost_krw
  from public.cms_inventory_move_line l
  join public.cms_inventory_move_header h on h.move_id=l.move_id
  where h.status='POSTED'
    and l.is_void=false
    and l.item_ref_type='MASTER'
    and l.master_id is not null
  group by l.master_id
)
select
  m.master_id as part_id,
  m.model_name as part_name,
  case when m.master_kind='STONE' then 'STONE' else 'PART' end as part_kind,
  m.family_name,
  m.spec_text,
  m.unit as unit_default,
  m.is_reusable,
  m.reorder_min_qty as reorder_min,
  m.reorder_max_qty as reorder_max,
  m.qr_code,
  m.is_active,
  coalesce(g.on_hand_qty,0) as on_hand_qty,
  g.last_move_at,
  g.last_receipt_at,
  g.last_issue_at,
  a.weighted_avg_unit_cost_krw as last_unit_cost_krw
from public.cms_master_item m
left join ledger g on g.master_id=m.master_id
left join avg_cost a on a.master_id=m.master_id
where m.master_kind in ('PART', 'STONE');
-- VIEW 2: Move Lines
drop view if exists public.cms_v_part_move_lines_v1;
create view public.cms_v_part_move_lines_v1 as
select
  h.move_id,
  h.move_type,
  h.occurred_at,
  h.status,
  h.location_code,
  h.memo as move_memo,
  h.source,
  h.ref_doc_type,
  h.ref_doc_id,
  h.meta as header_meta,
  
  l.line_no,
  l.direction,
  l.qty,
  l.unit,
  l.item_ref_type,
  l.master_id as part_id,
  m.model_name as part_name,
  case when m.master_kind='STONE' then 'STONE' else 'PART' end as part_kind,
  m.family_name,
  l.item_name as entered_name,
  l.unit_cost_krw,
  l.amount_krw,
  l.meta as line_meta,
  l.is_void,
  l.void_reason
from public.cms_inventory_move_header h
join public.cms_inventory_move_line l on l.move_id=h.move_id
left join public.cms_master_item m on m.master_id=l.master_id
where h.status='POSTED'
  and l.is_void=false
  and (
    (l.item_ref_type='MASTER' and m.master_kind in ('PART','STONE'))
    or (l.item_ref_type='UNLINKED' and (h.meta->>'module')='PARTS')
  );
-- VIEW 3: Unlinked
drop view if exists public.cms_v_part_unlinked_worklist_v1;
create view public.cms_v_part_unlinked_worklist_v1 as
select *
from public.cms_v_part_move_lines_v1
where item_ref_type='UNLINKED';
-- VIEW 4: Daily Usage
drop view if exists public.cms_v_part_usage_daily_v1;
create view public.cms_v_part_usage_daily_v1 as
select
  date_trunc('day', h.occurred_at) as day,
  coalesce(case when m.master_kind='STONE' then 'STONE' else 'PART' end, 'PART') as part_kind,
  coalesce(m.family_name, '(no_family)') as family_name,
  coalesce(m.master_id, null) as part_id,
  coalesce(m.model_name, l.item_name) as part_name,
  sum(l.qty) as used_qty,
  max(l.unit) as unit,
  sum(coalesce(l.amount_krw,0)) as used_amount_krw
from public.cms_inventory_move_header h
join public.cms_inventory_move_line l on l.move_id=h.move_id
left join public.cms_master_item m on m.master_id=l.master_id
where h.status='POSTED'
  and l.is_void=false
  and h.move_type='ISSUE'
  and (
    (l.item_ref_type='MASTER' and m.master_kind in ('PART','STONE'))
    or (l.item_ref_type='UNLINKED' and (h.meta->>'module')='PARTS')
  )
group by 1,2,3,4,5;
-- 9) Recreate Functions

-- Drop old signatures (Critical to avoid overload ambiguity)
drop function if exists public.cms_fn_record_part_receipt_v1(jsonb, timestamptz, text, uuid, text, text, text, uuid, uuid);
drop function if exists public.cms_fn_record_part_usage_v1(jsonb, timestamptz, text, text, text, uuid, text, text, text, uuid, uuid);
-- Upsert Part
create or replace function public.cms_fn_upsert_part_item_v1(
  p_part_id uuid,
  p_part_name text,
  p_part_kind text, 
  p_family_name text default null,
  p_spec_text text default null,
  p_unit_default text default 'EA',
  p_is_reusable boolean default false,
  p_reorder_min_qty numeric default null,
  p_reorder_max_qty numeric default null,
  p_qr_code text default null,
  p_note text default null,
  p_meta jsonb default '{}',
  p_actor_person_id uuid default null,
  p_correlation_id uuid default null
) returns uuid as $$
declare
  v_master_id uuid;
  v_kind public.cms_e_master_kind;
begin
  v_kind := case when p_part_kind='STONE' then 'STONE'::public.cms_e_master_kind else 'PART'::public.cms_e_master_kind end;

  insert into public.cms_master_item (
    master_id, model_name, master_kind, family_name, spec_text, unit, is_reusable,
    reorder_min_qty, reorder_max_qty, qr_code, note, is_active
  ) values (
    coalesce(p_part_id, gen_random_uuid()),
    p_part_name,
    v_kind,
    p_family_name,
    p_spec_text,
    p_unit_default,
    p_is_reusable,
    p_reorder_min_qty,
    p_reorder_max_qty,
    p_qr_code,
    p_note,
    true
  )
  on conflict (master_id) do update set
    model_name = excluded.model_name,
    master_kind = excluded.master_kind,
    family_name = excluded.family_name,
    spec_text = excluded.spec_text,
    unit = excluded.unit,
    is_reusable = excluded.is_reusable,
    reorder_min_qty = excluded.reorder_min_qty,
    reorder_max_qty = excluded.reorder_max_qty,
    qr_code = excluded.qr_code,
    note = excluded.note
  returning master_id into v_master_id;

  return v_master_id;
end;
$$ language plpgsql security definer;
-- Record Receipt
create or replace function public.cms_fn_record_part_receipt_v1(
  p_lines jsonb,
  p_occurred_at timestamptz,
  p_location_code text default 'MAIN',
  p_vendor_party_id uuid default null,
  p_memo text default null,
  p_source text default 'MANUAL',
  p_idempotency_key text default null,
  p_actor_person_id uuid default null,
  p_correlation_id uuid default null,
  p_note text default null
) returns uuid as $$
declare
  v_move_id uuid;
  v_line jsonb;
  v_master_id uuid;
begin
  if p_idempotency_key is not null then
    select move_id into v_move_id from public.cms_inventory_move_header where idempotency_key = p_idempotency_key;
    if v_move_id is not null then return v_move_id; end if;
  end if;

  insert into public.cms_inventory_move_header (
    move_type, occurred_at, status, location_code, memo, source, idempotency_key, meta
  ) values (
    'RECEIPT', p_occurred_at, 'POSTED', p_location_code, p_memo, p_source, p_idempotency_key, jsonb_build_object('module', 'PARTS')
  ) returning move_id into v_move_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_master_id := (v_line->>'part_id')::uuid;

    insert into public.cms_inventory_move_line (
      move_id, direction, item_ref_type, master_id, item_name, qty, unit, unit_cost_krw, amount_krw
    ) values (
      v_move_id,
      'IN',
      case when v_master_id is not null then 'MASTER'::public.cms_e_inventory_item_ref_type else 'UNLINKED'::public.cms_e_inventory_item_ref_type end,
      v_master_id,
      v_line->>'item_name',
      (v_line->>'qty')::numeric,
      v_line->>'unit',
      (v_line->>'unit_cost_krw')::numeric,
      ((v_line->>'qty')::numeric * coalesce((v_line->>'unit_cost_krw')::numeric, 0))
    );
  end loop;

  return v_move_id;
end;
$$ language plpgsql security definer;
-- Record Usage
create or replace function public.cms_fn_record_part_usage_v1(
  p_lines jsonb,
  p_occurred_at timestamptz,
  p_location_code text default 'MAIN',
  p_use_kind text default null,
  p_ref_doc_type text default null,
  p_ref_doc_id uuid default null,
  p_memo text default null,
  p_source text default 'MANUAL',
  p_idempotency_key text default null,
  p_actor_person_id uuid default null,
  p_correlation_id uuid default null,
  p_note text default null
) returns uuid as $$
declare
  v_move_id uuid;
  v_line jsonb;
  v_master_id uuid;
begin
  if p_idempotency_key is not null then
    select move_id into v_move_id from public.cms_inventory_move_header where idempotency_key = p_idempotency_key;
    if v_move_id is not null then return v_move_id; end if;
  end if;

  insert into public.cms_inventory_move_header (
    move_type, occurred_at, status, location_code, memo, source, ref_doc_type, ref_doc_id, idempotency_key, meta
  ) values (
    'ISSUE', p_occurred_at, 'POSTED', p_location_code, p_memo, p_source, p_ref_doc_type, p_ref_doc_id, p_idempotency_key,
    jsonb_build_object('module', 'PARTS', 'use_kind', p_use_kind)
  ) returning move_id into v_move_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_master_id := (v_line->>'part_id')::uuid;

    insert into public.cms_inventory_move_line (
      move_id, direction, item_ref_type, master_id, item_name, qty, unit, unit_cost_krw, amount_krw
    ) values (
      v_move_id,
      'OUT',
      case when v_master_id is not null then 'MASTER'::public.cms_e_inventory_item_ref_type else 'UNLINKED'::public.cms_e_inventory_item_ref_type end,
      v_master_id,
      v_line->>'item_name',
      (v_line->>'qty')::numeric,
      v_line->>'unit',
      (v_line->>'unit_cost_krw')::numeric,
      null
    );
  end loop;

  return v_move_id;
end;
$$ language plpgsql security definer;
-- Grants
grant select on public.cms_v_part_master_with_position_v1 to anon, authenticated, service_role;
grant select on public.cms_v_part_move_lines_v1 to anon, authenticated, service_role;
grant select on public.cms_v_part_unlinked_worklist_v1 to anon, authenticated, service_role;
grant select on public.cms_v_part_usage_daily_v1 to anon, authenticated, service_role;
grant select on public.cms_v_inventory_move_lines_enriched_v1 to anon, authenticated, service_role;
grant execute on function public.cms_fn_upsert_part_item_v1 to anon, authenticated, service_role;
grant execute on function public.cms_fn_record_part_receipt_v1 to anon, authenticated, service_role;
grant execute on function public.cms_fn_record_part_usage_v1 to anon, authenticated, service_role;
