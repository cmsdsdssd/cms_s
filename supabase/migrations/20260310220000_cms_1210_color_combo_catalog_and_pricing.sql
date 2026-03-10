set search_path = public, pg_temp;

create table if not exists public.channel_color_code_catalog_v1 (
  color_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  color_code text not null,
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text
);

create unique index if not exists uq_channel_color_code_catalog_v1
  on public.channel_color_code_catalog_v1(channel_id, color_code);

create table if not exists public.channel_color_combo_catalog_v1 (
  combo_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  combo_key text not null,
  component_codes jsonb not null default '[]'::jsonb,
  plating_enabled boolean not null default true,
  display_name text not null,
  base_delta_krw integer not null default 0,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  check (jsonb_typeof(component_codes) = 'array'),
  check (base_delta_krw >= 0 and base_delta_krw <= 200000)
);

create unique index if not exists uq_channel_color_combo_catalog_v1
  on public.channel_color_combo_catalog_v1(channel_id, combo_key);

do $$
begin
  if to_regprocedure('public.cms_fn_set_updated_at()') is not null then
    begin
      create trigger trg_channel_color_code_catalog_v1_updated_at
      before update on public.channel_color_code_catalog_v1
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then null;
    end;

    begin
      create trigger trg_channel_color_combo_catalog_v1_updated_at
      before update on public.channel_color_combo_catalog_v1
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then null;
    end;
  end if;
end $$;

with channels as (
  select channel_id
  from public.sales_channel
),
codes as (
  select * from (
    values
      ('P', 'P', 10),
      ('G', 'G', 20),
      ('W', 'W', 30),
      ('B', 'B', 40)
  ) as t(color_code, label, sort_order)
)
insert into public.channel_color_code_catalog_v1 (
  channel_id,
  color_code,
  label,
  sort_order,
  is_active,
  created_by,
  updated_by
)
select
  c.channel_id,
  codes.color_code,
  codes.label,
  codes.sort_order,
  true,
  'MIGRATION_CMS_1210',
  'MIGRATION_CMS_1210'
from channels c
cross join codes
on conflict (channel_id, color_code) do update
set
  label = excluded.label,
  sort_order = excluded.sort_order,
  updated_by = excluded.updated_by;

with channels as (
  select channel_id
  from public.sales_channel
),
combos as (
  select * from (
    values
      ('P', '["P"]'::jsonb, 10),
      ('G', '["G"]'::jsonb, 20),
      ('W', '["W"]'::jsonb, 30),
      ('B', '["B"]'::jsonb, 40),
      ('P+G', '["P","G"]'::jsonb, 50),
      ('P+W', '["P","W"]'::jsonb, 60),
      ('P+B', '["P","B"]'::jsonb, 70),
      ('G+W', '["G","W"]'::jsonb, 80),
      ('G+B', '["G","B"]'::jsonb, 90),
      ('W+B', '["W","B"]'::jsonb, 100),
      ('P+G+W', '["P","G","W"]'::jsonb, 110),
      ('P+G+B', '["P","G","B"]'::jsonb, 120),
      ('P+W+B', '["P","W","B"]'::jsonb, 130),
      ('G+W+B', '["G","W","B"]'::jsonb, 140),
      ('P+G+W+B', '["P","G","W","B"]'::jsonb, 150)
  ) as t(combo_base, component_codes, sort_order)
),
variants as (
  select
    channels.channel_id,
    combos.combo_base,
    combos.component_codes,
    combos.sort_order,
    false as plating_enabled,
    combos.combo_base as display_name,
    combos.combo_base as combo_key
  from channels
  cross join combos
  union all
  select
    channels.channel_id,
    combos.combo_base,
    combos.component_codes,
    combos.sort_order + 1000,
    true as plating_enabled,
    '[도] ' || combos.combo_base as display_name,
    '[도] ' || combos.combo_base as combo_key
  from channels
  cross join combos
)
insert into public.channel_color_combo_catalog_v1 (
  channel_id,
  combo_key,
  component_codes,
  plating_enabled,
  display_name,
  base_delta_krw,
  sort_order,
  is_active,
  created_by,
  updated_by
)
select
  v.channel_id,
  v.combo_key,
  v.component_codes,
  v.plating_enabled,
  v.display_name,
  0,
  v.sort_order,
  true,
  'MIGRATION_CMS_1210',
  'MIGRATION_CMS_1210'
from variants v
on conflict (channel_id, combo_key) do update
set
  component_codes = excluded.component_codes,
  plating_enabled = excluded.plating_enabled,
  display_name = excluded.display_name,
  sort_order = excluded.sort_order,
  updated_by = excluded.updated_by;
