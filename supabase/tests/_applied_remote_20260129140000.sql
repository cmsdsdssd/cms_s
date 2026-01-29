set search_path = public, pg_temp;

-- 1) add master_id to shipment_line
alter table public.cms_shipment_line
  add column if not exists master_id uuid;

-- 2) backfill from order_line when matched_master_id exists
update public.cms_shipment_line sl
set master_id = o.matched_master_id
from public.cms_order_line o
where sl.order_line_id = o.order_line_id
  and sl.master_id is null
  and o.matched_master_id is not null;

-- 3) FK + index (ADD-ONLY)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_cms_shipment_line_master_item'
  ) then
    alter table public.cms_shipment_line
      add constraint fk_cms_shipment_line_master_item
      foreign key (master_id) references public.cms_master_item(master_id);
  end if;
end $$;

create index if not exists ix_cms_shipment_line_master_id
  on public.cms_shipment_line(master_id);
