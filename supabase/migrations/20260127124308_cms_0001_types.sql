set search_path = public, pg_temp;
-- 0001: extensions + enums
create extension if not exists pgcrypto;
-- party
do $$ begin
  create type cms_e_party_type as enum ('customer','vendor');
exception when duplicate_object then null; end $$;
-- category
do $$ begin
  create type cms_e_category_code as enum (
    'BRACELET','NECKLACE','EARRING','RING','PIERCING','PENDANT','WATCH','KEYRING','SYMBOL','ETC'
  );
exception when duplicate_object then null; end $$;
-- material
do $$ begin
  create type cms_e_material_code as enum ('14','18','24','925','00');
exception when duplicate_object then null; end $$;
-- plating type (phase1)
do $$ begin
  create type cms_e_plating_type as enum ('P','W','G');
exception when duplicate_object then null; end $$;
-- order/repair/shipment status
do $$ begin
  create type cms_e_order_status as enum ('ORDER_PENDING','SENT_TO_VENDOR','WAITING_INBOUND','READY_TO_SHIP','SHIPPED','CLOSED','CANCELLED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type cms_e_repair_status as enum ('RECEIVED','IN_PROGRESS','READY_TO_SHIP','SHIPPED','CLOSED','CANCELLED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type cms_e_shipment_status as enum ('DRAFT','CONFIRMED','CANCELLED');
exception when duplicate_object then null; end $$;
-- pricing
do $$ begin
  create type cms_e_pricing_mode as enum ('RULE','UNIT','AMOUNT_ONLY');
exception when duplicate_object then null; end $$;
-- payment
do $$ begin
  create type cms_e_payment_method as enum ('BANK','CASH','GOLD','SILVER','OFFSET');
exception when duplicate_object then null; end $$;
-- AR ledger
do $$ begin
  create type cms_e_ar_entry_type as enum ('SHIPMENT','PAYMENT','RETURN','OFFSET','ADJUST');
exception when duplicate_object then null; end $$;
-- matching
do $$ begin
  create type cms_e_match_state as enum ('UNMATCHED','AUTO_MATCHED','HUMAN_CONFIRMED','HUMAN_OVERRIDDEN');
exception when duplicate_object then null; end $$;
-- priority / due
do $$ begin
  create type cms_e_priority_code as enum ('NORMAL','URGENT','VVIP');
exception when duplicate_object then null; end $$;
-- market tick
do $$ begin
  create type cms_e_market_symbol as enum ('GOLD_KRW_PER_G','SILVER_KRW_PER_G');
exception when duplicate_object then null; end $$;
-- event entity types
do $$ begin
  create type cms_e_entity_type as enum ('ORDER_LINE','REPAIR_LINE','SHIPMENT_HEADER');
exception when duplicate_object then null; end $$;
