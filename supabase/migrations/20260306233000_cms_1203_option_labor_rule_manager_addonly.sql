set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1203_option_labor_rule_manager_addonly
-- Category-specific option labor rule manager.
-- -----------------------------------------------------------------------------

create table if not exists public.channel_option_labor_rule_v1 (
  rule_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  master_item_id uuid not null references public.cms_master_item(master_item_id) on delete cascade,
  external_product_no text not null,
  category_key text not null,
  scope_material_code text,
  additional_weight_g numeric(6,2),
  plating_enabled boolean,
  color_code text,
  decoration_master_id uuid references public.cms_master_item(master_item_id) on delete set null,
  decoration_model_name text,
  base_labor_cost_krw integer not null default 0,
  additive_delta_krw integer not null default 0,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text
);

do $$
begin
  alter table public.channel_option_labor_rule_v1
    add constraint channel_option_labor_rule_v1_category_enum
    check (category_key in ('MATERIAL', 'SIZE', 'COLOR_PLATING', 'DECOR', 'OTHER'));
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_labor_rule_v1
    add constraint channel_option_labor_rule_v1_external_product_no_not_blank
    check (btrim(external_product_no) <> '');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_labor_rule_v1
    add constraint channel_option_labor_rule_v1_scope_material_code_not_blank
    check (scope_material_code is null or btrim(scope_material_code) <> '');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_labor_rule_v1
    add constraint channel_option_labor_rule_v1_color_code_not_blank
    check (color_code is null or btrim(color_code) <> '');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_labor_rule_v1
    add constraint channel_option_labor_rule_v1_decoration_model_name_not_blank
    check (decoration_model_name is null or btrim(decoration_model_name) <> '');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_labor_rule_v1
    add constraint channel_option_labor_rule_v1_weight_range
    check (
      additional_weight_g is null
      or (
        additional_weight_g >= 0.01
        and additional_weight_g <= 100.00
        and additional_weight_g = round(additional_weight_g::numeric, 2)
      )
    );
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_labor_rule_v1
    add constraint channel_option_labor_rule_v1_material_zero_delta
    check (
      category_key <> 'MATERIAL'
      or (
        base_labor_cost_krw = 0
        and additive_delta_krw = 0
        and scope_material_code is null
        and additional_weight_g is null
        and plating_enabled is null
        and color_code is null
        and decoration_master_id is null
        and decoration_model_name is null
      )
    );
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_labor_rule_v1
    add constraint channel_option_labor_rule_v1_size_shape
    check (
      category_key <> 'SIZE'
      or (
        scope_material_code is not null
        and additional_weight_g is not null
        and plating_enabled is null
        and color_code is null
        and decoration_master_id is null
        and decoration_model_name is null
        and base_labor_cost_krw = 0
      )
    );
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_labor_rule_v1
    add constraint channel_option_labor_rule_v1_color_shape
    check (
      category_key <> 'COLOR_PLATING'
      or (
        plating_enabled is not null
        and scope_material_code is null
        and additional_weight_g is null
        and decoration_master_id is null
        and decoration_model_name is null
        and base_labor_cost_krw = 0
      )
    );
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_labor_rule_v1
    add constraint channel_option_labor_rule_v1_decor_shape
    check (
      category_key <> 'DECOR'
      or (
        (decoration_master_id is not null or decoration_model_name is not null)
        and scope_material_code is null
        and additional_weight_g is null
        and plating_enabled is null
        and color_code is null
        and base_labor_cost_krw >= 0
      )
    );
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_labor_rule_v1
    add constraint channel_option_labor_rule_v1_other_shape
    check (
      category_key <> 'OTHER'
      or (
        scope_material_code is null
        and additional_weight_g is null
        and plating_enabled is null
        and color_code is null
        and decoration_master_id is null
        and decoration_model_name is null
        and base_labor_cost_krw = 0
      )
    );
exception when duplicate_object then
  null;
end $$;

create unique index if not exists uq_channel_option_labor_rule_v1_material
  on public.channel_option_labor_rule_v1(channel_id, master_item_id, external_product_no, category_key)
  where category_key = 'MATERIAL';

create unique index if not exists uq_channel_option_labor_rule_v1_size
  on public.channel_option_labor_rule_v1(channel_id, master_item_id, external_product_no, category_key, scope_material_code, additional_weight_g)
  where category_key = 'SIZE';

create unique index if not exists uq_channel_option_labor_rule_v1_color
  on public.channel_option_labor_rule_v1(channel_id, master_item_id, external_product_no, category_key, plating_enabled, coalesce(color_code, ''))
  where category_key = 'COLOR_PLATING';

create unique index if not exists uq_channel_option_labor_rule_v1_decor_id
  on public.channel_option_labor_rule_v1(channel_id, master_item_id, external_product_no, category_key, decoration_master_id)
  where category_key = 'DECOR' and decoration_master_id is not null;

create unique index if not exists uq_channel_option_labor_rule_v1_decor_name
  on public.channel_option_labor_rule_v1(channel_id, master_item_id, external_product_no, category_key, lower(decoration_model_name))
  where category_key = 'DECOR' and decoration_master_id is null and decoration_model_name is not null;

create unique index if not exists uq_channel_option_labor_rule_v1_other
  on public.channel_option_labor_rule_v1(channel_id, master_item_id, external_product_no, category_key)
  where category_key = 'OTHER';

create index if not exists idx_channel_option_labor_rule_v1_lookup
  on public.channel_option_labor_rule_v1(channel_id, master_item_id, external_product_no, category_key, updated_at desc);

do $$
begin
  if to_regprocedure('public.cms_fn_set_updated_at()') is not null then
    begin
      create trigger trg_channel_option_labor_rule_v1_updated_at
      before update on public.channel_option_labor_rule_v1
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on public.channel_option_labor_rule_v1 to authenticated';
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on public.channel_option_labor_rule_v1 to service_role';
  end if;
end $$;
