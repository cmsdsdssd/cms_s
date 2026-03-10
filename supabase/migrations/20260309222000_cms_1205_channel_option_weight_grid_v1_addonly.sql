set search_path = public, pg_temp;

create table if not exists public.channel_option_weight_grid_v1 (
  grid_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  master_item_id uuid not null references public.cms_master_item(master_item_id) on delete cascade,
  external_product_no text not null,
  material_code text not null,
  weight_g numeric(6,2) not null,
  computed_delta_krw integer not null default 0,
  computed_formula_mode text,
  computed_source_rule_id uuid references public.channel_option_labor_rule_v1(rule_id) on delete set null,
  price_basis_resolved text,
  effective_tick_krw_g integer,
  purity_rate_resolved numeric(12,6),
  adjust_factor_resolved numeric(12,6),
  factor_multiplier_applied numeric(12,6),
  formula_multiplier_applied numeric(12,6),
  formula_offset_krw_applied integer,
  rounding_unit_krw_applied integer,
  rounding_mode_applied text,
  tick_snapshot_at timestamptz,
  computed_at timestamptz not null default now(),
  computation_version text,
  invalidated_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_channel_option_weight_grid_v1_scope
  on public.channel_option_weight_grid_v1(channel_id, master_item_id, external_product_no, material_code, weight_g);

create index if not exists idx_channel_option_weight_grid_v1_lookup
  on public.channel_option_weight_grid_v1(channel_id, external_product_no, material_code, computed_at desc);
