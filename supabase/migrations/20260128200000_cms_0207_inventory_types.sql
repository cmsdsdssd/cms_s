-- 20260128100000_cms_0026_inventory_types.sql
-- cms_0026: inventory enums + entity_type 확장 + sequence

set search_path = public, pg_temp;

-- inventory move type
do $$ begin
  create type public.cms_e_inventory_move_type as enum ('RECEIPT','ISSUE','ADJUST');
exception when duplicate_object then null; end $$;

-- inventory header status
do $$ begin
  create type public.cms_e_inventory_move_status as enum ('DRAFT','POSTED','VOID');
exception when duplicate_object then null; end $$;

-- line direction
do $$ begin
  create type public.cms_e_inventory_direction as enum ('IN','OUT');
exception when duplicate_object then null; end $$;

-- item ref type (마스터/부속/미연결)
do $$ begin
  create type public.cms_e_inventory_item_ref_type as enum ('MASTER','PART','UNLINKED');
exception when duplicate_object then null; end $$;

-- status_event에 INVENTORY_MOVE 추가 (ADD-ONLY)
do $$ begin
  alter type public.cms_e_entity_type add value 'INVENTORY_MOVE';
exception when duplicate_object then null; end $$;

-- document no
create sequence if not exists public.cms_inventory_move_no_seq
  start 100000
  increment 1;
