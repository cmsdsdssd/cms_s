-- 0004: triggers (fixed)

-- updated_at helper
create or replace function cms_fn_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- updated_at triggers (idempotent)
do $$ begin
  create trigger trg_cms_person_updated_at
  before update on cms_person
  for each row execute function cms_fn_set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_cms_party_updated_at
  before update on cms_party
  for each row execute function cms_fn_set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_cms_address_updated_at
  before update on cms_party_address
  for each row execute function cms_fn_set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_cms_master_updated_at
  before update on cms_master_item
  for each row execute function cms_fn_set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_cms_order_updated_at
  before update on cms_order_line
  for each row execute function cms_fn_set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_cms_repair_updated_at
  before update on cms_repair_line
  for each row execute function cms_fn_set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_cms_ship_updated_at
  before update on cms_shipment_header
  for each row execute function cms_fn_set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_cms_shipline_updated_at
  before update on cms_shipment_line
  for each row execute function cms_fn_set_updated_at();
exception when duplicate_object then null; end $$;


-- ============================================================
-- status_event logging: table별 "전용" 트리거 함수 3개
-- ============================================================

create or replace function cms_fn_log_order_status_change()
returns trigger language plpgsql as $$
begin
  if old.status is distinct from new.status then
    insert into cms_status_event(entity_type, entity_id, from_status, to_status, occurred_at)
    values ('ORDER_LINE', new.order_line_id, old.status::text, new.status::text, now());
  end if;
  return new;
end $$;

create or replace function cms_fn_log_repair_status_change()
returns trigger language plpgsql as $$
begin
  if old.status is distinct from new.status then
    insert into cms_status_event(entity_type, entity_id, from_status, to_status, occurred_at)
    values ('REPAIR_LINE', new.repair_line_id, old.status::text, new.status::text, now());
  end if;
  return new;
end $$;

create or replace function cms_fn_log_shipment_status_change()
returns trigger language plpgsql as $$
begin
  if old.status is distinct from new.status then
    insert into cms_status_event(entity_type, entity_id, from_status, to_status, occurred_at)
    values ('SHIPMENT_HEADER', new.shipment_id, old.status::text, new.status::text, now());
  end if;
  return new;
end $$;

-- 트리거 3개 생성(중복 안전)
do $$ begin
  create trigger trg_cms_order_status_event
  after update of status on cms_order_line
  for each row execute function cms_fn_log_order_status_change();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_cms_repair_status_event
  after update of status on cms_repair_line
  for each row execute function cms_fn_log_repair_status_change();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_cms_shipment_status_event
  after update of status on cms_shipment_header
  for each row execute function cms_fn_log_shipment_status_change();
exception when duplicate_object then null; end $$;
