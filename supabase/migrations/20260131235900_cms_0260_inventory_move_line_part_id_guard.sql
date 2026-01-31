-- Ensure cms_inventory_move_line has part_id in older DBs
alter table public.cms_inventory_move_line
  add column if not exists part_id uuid;

create index if not exists idx_cms_inventory_move_line_part_id
  on public.cms_inventory_move_line(part_id);
