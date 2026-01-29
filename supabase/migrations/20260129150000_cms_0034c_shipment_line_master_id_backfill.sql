set search_path = public, pg_temp;

-- 1) column (idempotent)
alter table public.cms_shipment_line
  add column if not exists master_id uuid;

-- 2) backfill from order_line (match_state 보지 말고 matched_master_id 존재로만)
update public.cms_shipment_line sl
set master_id = o.matched_master_id
from public.cms_order_line o
where sl.order_line_id = o.order_line_id
  and sl.master_id is null
  and o.matched_master_id is not null;

-- 3) backfill from model_name exact match (마스터 “완전일치”만)
update public.cms_shipment_line sl
set master_id = m.master_id
from public.cms_master_item m
where sl.master_id is null
  and sl.model_name is not null
  and trim(sl.model_name) = m.model_name;

-- 4) FK (없으면 추가)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_cms_shipment_line_master_id'
      and conrelid = 'public.cms_shipment_line'::regclass
  ) then
    alter table public.cms_shipment_line
      add constraint fk_cms_shipment_line_master_id
      foreign key (master_id) references public.cms_master_item(master_id);
  end if;
end $$;
