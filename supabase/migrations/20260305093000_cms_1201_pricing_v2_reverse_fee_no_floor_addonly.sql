set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1201_pricing_v2_reverse_fee_no_floor_addonly
-- Pricing V2: material-code resolution + component GM + reverse-fee + min-margin
-- NOTE: V2 has no floor clamp stage in final target decision
-- -----------------------------------------------------------------------------

alter table public.pricing_policy
  add column if not exists gm_material numeric(12,6) not null default 0,
  add column if not exists gm_labor numeric(12,6) not null default 0,
  add column if not exists gm_fixed numeric(12,6) not null default 0,
  add column if not exists fee_rate numeric(12,6) not null default 0,
  add column if not exists min_margin_rate_total numeric(12,6) not null default 0,
  add column if not exists fixed_cost_krw integer not null default 0,
  add column if not exists pricing_algo_default text not null default 'LEGACY_V1';

do $$
begin
  alter table public.pricing_policy
    add constraint pricing_policy_v2_rate_guard
    check (
      gm_material >= 0 and gm_material < 1
      and gm_labor >= 0 and gm_labor < 1
      and gm_fixed >= 0 and gm_fixed < 1
      and fee_rate >= 0 and fee_rate < 1
      and min_margin_rate_total >= 0 and min_margin_rate_total < 1
      and fee_rate + min_margin_rate_total < 1
    );
exception when duplicate_object then null;
end $$;

alter table public.pricing_snapshot
  add column if not exists pricing_algo_version text not null default 'LEGACY_V1',
  add column if not exists calc_version text,
  add column if not exists resolution_input_hash text,
  add column if not exists material_code_effective text,
  add column if not exists material_basis_resolved text,
  add column if not exists material_purity_rate_resolved numeric(12,6),
  add column if not exists material_adjust_factor_resolved numeric(12,6),
  add column if not exists effective_tick_krw_g numeric(18,4),
  add column if not exists labor_cost_applied_krw integer,
  add column if not exists labor_sell_total_plus_absorb_krw integer,
  add column if not exists cost_sum_krw integer,
  add column if not exists material_pre_fee_krw integer,
  add column if not exists labor_pre_fee_krw integer,
  add column if not exists fixed_pre_fee_krw integer,
  add column if not exists candidate_pre_fee_krw integer,
  add column if not exists candidate_price_krw integer,
  add column if not exists min_margin_price_krw integer,
  add column if not exists guardrail_price_krw integer,
  add column if not exists guardrail_reason_code text,
  add column if not exists final_target_price_v2_krw integer;

do $$
begin
  alter table public.pricing_snapshot
    add constraint pricing_snapshot_v2_required_when_enabled
    check (
      pricing_algo_version <> 'REVERSE_FEE_V2'
      or (
        final_target_price_v2_krw is not null
        and candidate_price_krw is not null
        and min_margin_price_krw is not null
        and guardrail_price_krw is not null
        and guardrail_reason_code in ('COMPONENT_CANDIDATE_WIN','MIN_MARGIN_WIN','INVALID_PARAM_CLAMPED')
      )
    );
exception when duplicate_object then null;
end $$;

create table if not exists public.pricing_snapshot_labor_component_v2 (
  snapshot_id uuid not null references public.pricing_snapshot(snapshot_id) on delete cascade,
  component_key text not null,
  labor_class text not null default 'GENERAL',
  labor_cost_krw integer not null default 0,
  labor_absorb_applied_krw integer not null default 0,
  labor_absorb_raw_krw integer not null default 0,
  labor_cost_plus_absorb_krw integer not null default 0,
  labor_sell_krw integer not null default 0,
  labor_sell_plus_absorb_krw integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (snapshot_id, component_key)
);

do $$
begin
  alter table public.pricing_snapshot_labor_component_v2
    add constraint pricing_snapshot_labor_component_v2_contract
    check (
      component_key in ('BASE_LABOR','STONE_LABOR','PLATING','ETC','DECOR')
      and labor_class in ('GENERAL','MATERIAL')
      and labor_cost_plus_absorb_krw = labor_cost_krw + labor_absorb_applied_krw
      and labor_sell_plus_absorb_krw = labor_sell_krw + labor_absorb_applied_krw
      and labor_absorb_applied_krw <= labor_absorb_raw_krw
    );
exception when duplicate_object then null;
end $$;

create index if not exists idx_pricing_snapshot_labor_component_v2_snapshot
  on public.pricing_snapshot_labor_component_v2(snapshot_id, component_key);

create table if not exists public.pricing_snapshot_material_resolution_v2 (
  snapshot_id uuid primary key references public.pricing_snapshot(snapshot_id) on delete cascade,
  material_code_default text,
  option_material_code text,
  material_code_effective text not null,
  material_ruleset_version text not null,
  material_resolution_source_id text not null,
  material_resolution_effective_at timestamptz not null,
  material_resolution_status text not null,
  created_at timestamptz not null default now(),
  check (material_resolution_status in ('OK','FALLBACK','MISSING','CONFLICT'))
);

create table if not exists public.pricing_snapshot_margin_stage_v2 (
  snapshot_id uuid primary key references public.pricing_snapshot(snapshot_id) on delete cascade,
  gm_material numeric(12,6) not null,
  gm_labor numeric(12,6) not null,
  gm_fixed numeric(12,6) not null,
  fee_rate numeric(12,6) not null,
  min_margin_rate_total numeric(12,6) not null,
  fixed_cost_krw integer not null default 0,
  rounding_unit integer not null,
  rounding_mode text not null,
  created_at timestamptz not null default now(),
  check (
    gm_material >= 0 and gm_material < 1
    and gm_labor >= 0 and gm_labor < 1
    and gm_fixed >= 0 and gm_fixed < 1
    and fee_rate >= 0 and fee_rate < 1
    and min_margin_rate_total >= 0 and min_margin_rate_total < 1
    and fee_rate + min_margin_rate_total < 1
  ),
  check (rounding_mode in ('CEIL','ROUND','FLOOR'))
);

create table if not exists public.pricing_snapshot_guardrail_trace_v2 (
  snapshot_id uuid primary key references public.pricing_snapshot(snapshot_id) on delete cascade,
  candidate_price_krw integer not null,
  min_margin_price_krw integer not null,
  guardrail_price_krw integer not null,
  guardrail_reason_code text not null,
  final_target_price_v2_krw integer not null,
  created_at timestamptz not null default now(),
  check (guardrail_reason_code in ('COMPONENT_CANDIDATE_WIN','MIN_MARGIN_WIN','INVALID_PARAM_CLAMPED'))
);

create index if not exists idx_pricing_snapshot_material_resolution_v2_snapshot
  on public.pricing_snapshot_material_resolution_v2(snapshot_id);
create index if not exists idx_pricing_snapshot_margin_stage_v2_snapshot
  on public.pricing_snapshot_margin_stage_v2(snapshot_id);
create index if not exists idx_pricing_snapshot_guardrail_trace_v2_snapshot
  on public.pricing_snapshot_guardrail_trace_v2(snapshot_id);

drop view if exists public.v_price_composition_flat_v2;

create view public.v_price_composition_flat_v2
with (security_invoker = true)
as
with map as (
  select
    scp.channel_product_id,
    scp.channel_id,
    scp.master_item_id,
    scp.external_product_no,
    coalesce(nullif(btrim(scp.external_variant_code), ''), '') as external_variant_code
  from public.sales_channel_product scp
  where scp.is_active = true
),
ps as (
  select distinct on (s.channel_id, s.channel_product_id)
    s.*
  from public.pricing_snapshot s
  where s.pricing_algo_version = 'REVERSE_FEE_V2'
  order by s.channel_id, s.channel_product_id, s.computed_at desc, s.snapshot_id desc
),
cp as (
  select * from public.channel_price_snapshot_latest
),
comp as (
  select
    c.snapshot_id,
    sum(c.labor_absorb_applied_krw)::integer as absorb_total_applied_krw,
    sum(c.labor_absorb_raw_krw)::integer as absorb_total_raw_krw,
    sum(c.labor_cost_plus_absorb_krw)::integer as labor_cost_applied_krw_components,
    sum(c.labor_sell_plus_absorb_krw)::integer as labor_sell_total_plus_absorb_krw_components,
    jsonb_object_agg(
      c.component_key,
      jsonb_build_object(
        'labor_cost_krw', c.labor_cost_krw,
        'labor_absorb_applied_krw', c.labor_absorb_applied_krw,
        'labor_absorb_raw_krw', c.labor_absorb_raw_krw,
        'labor_cost_plus_absorb_krw', c.labor_cost_plus_absorb_krw,
        'labor_sell_krw', c.labor_sell_krw,
        'labor_sell_plus_absorb_krw', c.labor_sell_plus_absorb_krw,
        'labor_class', c.labor_class
      )
    ) as labor_component_json
  from public.pricing_snapshot_labor_component_v2 c
  group by c.snapshot_id
)
select
  ps.channel_id,
  m.channel_product_id,
  m.external_product_no,
  m.external_variant_code,
  ps.master_item_id,
  ps.compute_request_id,
  ps.computed_at,
  ps.pricing_algo_version,
  ps.calc_version,

  ps.material_code_effective,
  ps.material_basis_resolved,
  ps.material_purity_rate_resolved,
  ps.material_adjust_factor_resolved,
  ps.effective_tick_krw_g,
  ps.net_weight_g,
  ps.material_raw_krw,
  ps.material_final_krw,

  comp.labor_component_json,
  comp.absorb_total_applied_krw,
  comp.absorb_total_raw_krw,
  comp.labor_cost_applied_krw_components,
  comp.labor_sell_total_plus_absorb_krw_components,

  ps.cost_sum_krw,
  ps.material_pre_fee_krw,
  ps.labor_pre_fee_krw,
  ps.fixed_pre_fee_krw,
  ps.candidate_pre_fee_krw,
  ps.candidate_price_krw,
  ps.min_margin_price_krw,
  ps.guardrail_price_krw,
  ps.guardrail_reason_code,
  ps.final_target_price_v2_krw,

  cp.current_price_krw as current_channel_price_krw,
  case
    when ps.final_target_price_v2_krw is null or cp.current_price_krw is null then null
    else ps.final_target_price_v2_krw - cp.current_price_krw
  end as diff_krw,
  case
    when ps.final_target_price_v2_krw is null or cp.current_price_krw is null or cp.current_price_krw = 0 then null
    else (ps.final_target_price_v2_krw - cp.current_price_krw) / cp.current_price_krw::numeric
  end as diff_pct
from ps
join map m
  on m.channel_product_id = ps.channel_product_id
left join cp
  on cp.channel_id = m.channel_id
 and cp.external_product_no = m.external_product_no
 and cp.external_variant_code = m.external_variant_code
left join comp
  on comp.snapshot_id = ps.snapshot_id;
