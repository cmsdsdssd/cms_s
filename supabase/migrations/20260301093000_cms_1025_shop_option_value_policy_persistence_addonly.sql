set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1025_shop_option_value_policy_persistence_addonly
-- Persist per-option-value policy/rule-item selections for shopping dashboard.
-- -----------------------------------------------------------------------------

create table if not exists public.channel_option_value_policy (
  policy_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  master_item_id uuid not null references public.cms_master_item(master_item_id) on delete cascade,
  axis_key text not null,
  axis_value text not null,
  axis_mode text not null default 'SYNC',
  rule_type text not null default 'R2',
  value_mode text not null default 'BASE',
  sync_rule_set_id uuid references public.sync_rule_set(rule_set_id) on delete set null,
  selected_rule_id uuid,
  manual_delta_krw numeric(18,0) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.channel_option_value_policy
    add constraint channel_option_value_policy_axis_key_not_blank
    check (btrim(axis_key) <> '');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_value_policy
    add constraint channel_option_value_policy_axis_value_not_blank
    check (btrim(axis_value) <> '');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_value_policy
    add constraint channel_option_value_policy_axis_mode_valid
    check (axis_mode in ('SYNC', 'OVERRIDE'));
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_value_policy
    add constraint channel_option_value_policy_rule_type_valid
    check (rule_type in ('R1', 'R2', 'R3', 'R4'));
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_value_policy
    add constraint channel_option_value_policy_value_mode_valid
    check (value_mode in ('BASE', 'SYNC'));
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_value_policy
    add constraint channel_option_value_policy_manual_delta_range
    check (manual_delta_krw >= -100000000 and manual_delta_krw <= 100000000);
exception when duplicate_object then
  null;
end $$;

create unique index if not exists uq_channel_option_value_policy_key
  on public.channel_option_value_policy(channel_id, master_item_id, axis_key, axis_value);

create index if not exists idx_channel_option_value_policy_lookup
  on public.channel_option_value_policy(channel_id, master_item_id, axis_key, updated_at desc);

do $$
begin
  if to_regprocedure('public.cms_fn_set_updated_at()') is not null then
    begin
      create trigger trg_channel_option_value_policy_updated_at
      before update on public.channel_option_value_policy
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on public.channel_option_value_policy to authenticated';
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on public.channel_option_value_policy to service_role';
  end if;
end $$;
