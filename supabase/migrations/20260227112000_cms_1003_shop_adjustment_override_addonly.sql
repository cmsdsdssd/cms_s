set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1003_shop_adjustment_override_addonly
-- Wave1: product-level adjustment and override
-- -----------------------------------------------------------------------------

do $$
begin
  create type public.shop_e_adjust_apply_to as enum ('LABOR', 'TOTAL');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create type public.shop_e_adjust_stage as enum ('PRE_MARGIN', 'POST_MARGIN');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create type public.shop_e_adjust_amount_type as enum ('ABSOLUTE_KRW', 'PERCENT');
exception when duplicate_object then
  null;
end $$;

create table if not exists public.pricing_adjustment (
  adjustment_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  channel_product_id uuid references public.sales_channel_product(channel_product_id) on delete cascade,
  master_item_id uuid references public.cms_master_item(master_item_id),

  apply_to public.shop_e_adjust_apply_to not null,
  stage public.shop_e_adjust_stage not null,
  amount_type public.shop_e_adjust_amount_type not null default 'ABSOLUTE_KRW',
  amount_value numeric(18,4) not null default 0,

  priority int not null default 100,
  reason text,
  valid_from timestamptz,
  valid_to timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.cms_person(person_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.pricing_adjustment
    add constraint pricing_adjustment_target_required
    check (channel_product_id is not null or master_item_id is not null);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.pricing_adjustment
    add constraint pricing_adjustment_valid_range
    check (valid_to is null or valid_from is null or valid_to >= valid_from);
exception when duplicate_object then
  null;
end $$;

create index if not exists idx_pricing_adjustment_channel_active
  on public.pricing_adjustment(channel_id, is_active, priority, updated_at desc);

create index if not exists idx_pricing_adjustment_channel_product
  on public.pricing_adjustment(channel_product_id, is_active, valid_from, valid_to);

create index if not exists idx_pricing_adjustment_master
  on public.pricing_adjustment(master_item_id, is_active, valid_from, valid_to);

create or replace function public.shop_fn_validate_pricing_adjustment_channel_v1()
returns trigger
language plpgsql
as $$
declare
  v_channel uuid;
begin
  if new.channel_product_id is not null then
    select channel_id
      into v_channel
    from public.sales_channel_product
    where channel_product_id = new.channel_product_id;

    if v_channel is null then
      raise exception 'channel_product_id not found: %', new.channel_product_id;
    end if;

    if new.channel_id <> v_channel then
      raise exception 'channel_id mismatch. expected=%, got=%', v_channel, new.channel_id;
    end if;
  end if;

  return new;
end;
$$;

do $$
begin
  create trigger trg_pricing_adjustment_validate_channel
  before insert or update on public.pricing_adjustment
  for each row execute function public.shop_fn_validate_pricing_adjustment_channel_v1();
exception when duplicate_object then
  null;
end $$;

create table if not exists public.pricing_override (
  override_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  master_item_id uuid not null references public.cms_master_item(master_item_id),
  override_price_krw numeric(18,0) not null,
  reason text,
  valid_from timestamptz,
  valid_to timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.cms_person(person_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.pricing_override
    add constraint pricing_override_nonneg
    check (override_price_krw >= 0);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.pricing_override
    add constraint pricing_override_valid_range
    check (valid_to is null or valid_from is null or valid_to >= valid_from);
exception when duplicate_object then
  null;
end $$;

create index if not exists idx_pricing_override_active
  on public.pricing_override(channel_id, master_item_id, is_active, updated_at desc);

do $$
begin
  if to_regprocedure('public.cms_fn_set_updated_at()') is not null then
    begin
      create trigger trg_pricing_adjustment_updated_at
      before update on public.pricing_adjustment
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;

    begin
      create trigger trg_pricing_override_updated_at
      before update on public.pricing_override
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on public.pricing_adjustment to authenticated';
    execute 'grant select on public.pricing_override to authenticated';
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on public.pricing_adjustment to service_role';
    execute 'grant select, insert, update, delete on public.pricing_override to service_role';
    execute 'grant execute on function public.shop_fn_validate_pricing_adjustment_channel_v1() to service_role';
  end if;
end $$;
