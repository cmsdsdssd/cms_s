set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1020_shop_sync_r2_linked_r1_addonly
-- Add relational linkage from R2 to R1 for R1-first material context.
-- -----------------------------------------------------------------------------

alter table if exists public.sync_rule_r2_size_weight
  add column if not exists linked_r1_rule_id uuid;

do $$
begin
  alter table public.sync_rule_r2_size_weight
    add constraint fk_sync_rule_r2_linked_r1
    foreign key (linked_r1_rule_id)
    references public.sync_rule_r1_material_delta(rule_id)
    on delete set null;
exception when duplicate_object then
  null;
end $$;

create index if not exists idx_sync_rule_r2_linked_r1
  on public.sync_rule_r2_size_weight(linked_r1_rule_id)
  where linked_r1_rule_id is not null;
