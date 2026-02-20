-- 20260128300250_cms_0209b_inventory_move_line_part_id_backfill.sql
set search_path = public, pg_temp;
-- 원격에 cms_inventory_move_line이 이미 존재하지만 part_id가 없는 케이스 보정
alter table public.cms_inventory_move_line
  add column if not exists part_id uuid;
create index if not exists idx_cms_inventory_move_line_part_id
  on public.cms_inventory_move_line(part_id);
