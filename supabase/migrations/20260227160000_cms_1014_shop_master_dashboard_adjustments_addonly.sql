set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1014_shop_master_dashboard_adjustments_addonly
-- Master-level dashboard controls: plating include toggle + base price delta logs.
-- -----------------------------------------------------------------------------

alter table if exists public.sales_channel_product
  add column if not exists include_master_plating_labor boolean not null default true;

create table if not exists public.channel_base_price_adjustment_log (
  adjustment_log_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  master_item_id uuid not null references public.cms_master_item(master_item_id) on delete cascade,
  delta_krw numeric(18,0) not null,
  reason text not null,
  created_by uuid references public.cms_person(person_id),
  created_at timestamptz not null default now()
);

do $$
begin
  alter table public.channel_base_price_adjustment_log
    add constraint channel_base_price_adjustment_log_reason_not_blank
    check (btrim(reason) <> '');
exception when duplicate_object then
  null;
end $$;

create index if not exists idx_channel_base_price_adjustment_log_lookup
  on public.channel_base_price_adjustment_log(channel_id, master_item_id, created_at desc);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on public.channel_base_price_adjustment_log to authenticated';
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert on public.channel_base_price_adjustment_log to service_role';
  end if;
end $$;
