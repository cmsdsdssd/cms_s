-- allow FK cascade delete from cms_master_item while keeping append-only guard for direct mutations
create or replace function public.cms_fn_block_cn_raw_cost_snapshot_mutation()
returns trigger
language plpgsql
as $$
begin
  -- parent(master) hard delete triggers FK cascade; allow only this path
  if TG_OP = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  raise exception 'cms_master_item_cn_raw_cost_snapshot is append-only';
end;
$$;
