set search_path = public, pg_temp;
-- 1) master에 임시원가(마스터 기준) 컬럼
alter table public.cms_master_item
  add column if not exists provisional_unit_cost_krw numeric;
-- 2) shipment_line에 "구매원가" 트래킹 컬럼(= 마진 분석 핵심)
alter table public.cms_shipment_line
  add column if not exists purchase_unit_cost_krw numeric,
  add column if not exists purchase_total_cost_krw numeric,
  add column if not exists purchase_cost_status public.cms_e_cost_status not null default 'PROVISIONAL',
  add column if not exists purchase_cost_source public.cms_e_cost_source not null default 'NONE',
  add column if not exists purchase_receipt_id uuid references public.cms_receipt_inbox(receipt_id),
  add column if not exists purchase_cost_trace jsonb not null default '{}'::jsonb,
  add column if not exists purchase_cost_finalized_at timestamptz,
  add column if not exists purchase_cost_finalized_by uuid references public.cms_person(person_id);
create index if not exists idx_cms_shipment_line_purchase_cost_status
  on public.cms_shipment_line(purchase_cost_status);
-- 3) inventory_move_line에 cost 상태/출처/영수증 연결(재고원가 추적)
alter table public.cms_inventory_move_line
  add column if not exists cost_status public.cms_e_cost_status not null default 'PROVISIONAL',
  add column if not exists cost_source public.cms_e_cost_source not null default 'NONE',
  add column if not exists cost_receipt_id uuid references public.cms_receipt_inbox(receipt_id),
  add column if not exists cost_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists cost_finalized_at timestamptz,
  add column if not exists cost_finalized_by uuid references public.cms_person(person_id);
create index if not exists idx_cms_inventory_move_line_cost_status
  on public.cms_inventory_move_line(cost_status);
-- 4) inventory_move_line 자동 보정 트리거
create or replace function public.cms_fn_inventory_move_line_cost_autofill_v1()
returns trigger
language plpgsql
as $$
begin
  -- amount 자동 계산 (없고 unit_cost와 qty가 있으면)
  if new.amount_krw is null and new.unit_cost_krw is not null and new.qty is not null then
    new.amount_krw := round(new.unit_cost_krw * new.qty, 0);
  end if;

  -- IN(입고)인데 단가가 있고 source가 NONE이면 -> RECEIPT로 자동
  if new.direction = 'IN'::public.cms_e_inventory_direction
     and new.unit_cost_krw is not null
     and new.cost_source = 'NONE'::public.cms_e_cost_source then
    new.cost_source := 'RECEIPT'::public.cms_e_cost_source;
  end if;

  -- IN(입고)인데 단가가 있고 status가 PROVISIONAL이면 -> ACTUAL로 자동
  if new.direction = 'IN'::public.cms_e_inventory_direction
     and new.unit_cost_krw is not null
     and new.cost_status = 'PROVISIONAL'::public.cms_e_cost_status then
    new.cost_status := 'ACTUAL'::public.cms_e_cost_status;
  end if;

  return new;
end $$;
drop trigger if exists trg_cms_inventory_move_line_cost_autofill on public.cms_inventory_move_line;
create trigger trg_cms_inventory_move_line_cost_autofill
before insert or update on public.cms_inventory_move_line
for each row execute function public.cms_fn_inventory_move_line_cost_autofill_v1();
