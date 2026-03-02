set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1026_shop_option_value_policy_log_addonly
-- Append-only audit logs for option-value policy changes.
-- -----------------------------------------------------------------------------

create table if not exists public.channel_option_value_policy_log (
  policy_log_id uuid primary key default gen_random_uuid(),
  policy_id uuid references public.channel_option_value_policy(policy_id) on delete set null,
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  master_item_id uuid not null references public.cms_master_item(master_item_id) on delete cascade,
  axis_key text not null,
  axis_value text not null,
  action_type text not null,
  old_row jsonb,
  new_row jsonb,
  change_reason text,
  changed_by text,
  created_at timestamptz not null default now()
);

do $$
begin
  alter table public.channel_option_value_policy_log
    add constraint channel_option_value_policy_log_axis_key_not_blank
    check (btrim(axis_key) <> '');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_value_policy_log
    add constraint channel_option_value_policy_log_axis_value_not_blank
    check (btrim(axis_value) <> '');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_value_policy_log
    add constraint channel_option_value_policy_log_action_type_valid
    check (action_type in ('CREATE', 'UPDATE'));
exception when duplicate_object then
  null;
end $$;

create index if not exists idx_channel_option_value_policy_log_lookup
  on public.channel_option_value_policy_log(channel_id, master_item_id, axis_key, created_at desc);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on public.channel_option_value_policy_log to authenticated';
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert on public.channel_option_value_policy_log to service_role';
  end if;
end $$;
