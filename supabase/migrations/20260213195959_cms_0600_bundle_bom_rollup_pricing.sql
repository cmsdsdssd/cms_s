begin;
set search_path = public, pg_temp;
-- ============================================================
-- 0) Extend master_kind enum to include BUNDLE (idempotent)
-- ============================================================
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'cms_e_master_kind'
  ) then
    execute $sql$ create type public.cms_e_master_kind as enum ('MODEL','PART','STONE','BUNDLE') $sql$;
  else
    if not exists (
      select 1
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public'
        and t.typname = 'cms_e_master_kind'
        and e.enumlabel = 'BUNDLE'
    ) then
      execute $sql$ alter type public.cms_e_master_kind add value 'BUNDLE' $sql$;
    end if;
  end if;
end $$;

-- ============================================================
-- 1) Flatten active BOM for a product (recursively expands nested BUNDLE masters)
-- ============================================================
create or replace function public.cms_fn_bom_flatten_active_v1(
  p_product_master_id uuid,
  p_variant_key text default null,
  p_max_depth int default 8
)
returns table(
  leaf_ref_type public.cms_e_inventory_item_ref_type,
  leaf_master_id uuid,
  leaf_part_id uuid,
  qty_per_product_unit numeric,
  depth int,
  path uuid[]
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_missing_bom_cnt int;
  v_cycle_cnt int;
begin
  if p_max_depth is null or p_max_depth < 1 then
    p_max_depth := 8;
  end if;

  if not exists (select 1 from public.cms_master_item m where m.master_id = p_product_master_id) then
    raise exception 'master not found (master_id=%)', p_product_master_id;
  end if;

  -- cycle detection + "bundle must have bom" enforcement
  with recursive nodes as (
    select
      p_product_master_id as node_master_id,
      nullif(trim(coalesce(p_variant_key,'')), '') as node_variant_key,
      1::numeric as qty_mult,
      0::int as depth,
      array[p_product_master_id]::uuid[] as path
    union all
    select
      l.component_master_id as node_master_id,
      null::text as node_variant_key,
      n.qty_mult * l.qty_per_unit,
      n.depth + 1,
      n.path || l.component_master_id
    from nodes n
    join public.cms_fn_resolve_bom_recipe_v1(n.node_master_id, n.node_variant_key) rr on true
    join public.cms_bom_recipe_line l on l.bom_id = rr.bom_id and l.is_void = false
    join public.cms_master_item m2 on m2.master_id = l.component_master_id
    where l.component_ref_type = 'MASTER'::public.cms_e_inventory_item_ref_type
      and m2.master_kind = 'BUNDLE'::public.cms_e_master_kind
      and n.depth < p_max_depth
      and not (l.component_master_id = any(n.path))
  ),
  missing as (
    select n.node_master_id
    from nodes n
    join public.cms_master_item mm on mm.master_id = n.node_master_id
    left join public.cms_fn_resolve_bom_recipe_v1(n.node_master_id, n.node_variant_key) rr on true
    where mm.master_kind = 'BUNDLE'::public.cms_e_master_kind
      and rr.bom_id is null
  ),
  cycles as (
    select 1
    from nodes n
    join public.cms_fn_resolve_bom_recipe_v1(n.node_master_id, n.node_variant_key) rr on true
    join public.cms_bom_recipe_line l on l.bom_id = rr.bom_id and l.is_void = false
    where l.component_ref_type = 'MASTER'::public.cms_e_inventory_item_ref_type
      and l.component_master_id = any(n.path)
    limit 1
  )
  select (select count(*) from missing), (select count(*) from cycles)
  into v_missing_bom_cnt, v_cycle_cnt;

  if coalesce(v_cycle_cnt, 0) > 0 then
    raise exception 'BOM cycle detected while flattening (master_id=%)', p_product_master_id;
  end if;

  if coalesce(v_missing_bom_cnt, 0) > 0 then
    raise exception 'BUNDLE master has no active BOM recipe (master_id=%)', p_product_master_id;
  end if;

  return query
  with recursive nodes as (
    select
      p_product_master_id as node_master_id,
      nullif(trim(coalesce(p_variant_key,'')), '') as node_variant_key,
      1::numeric as qty_mult,
      0::int as depth,
      array[p_product_master_id]::uuid[] as path
    union all
    select
      l.component_master_id as node_master_id,
      null::text as node_variant_key,
      n.qty_mult * l.qty_per_unit,
      n.depth + 1,
      n.path || l.component_master_id
    from nodes n
    join public.cms_fn_resolve_bom_recipe_v1(n.node_master_id, n.node_variant_key) rr on true
    join public.cms_bom_recipe_line l on l.bom_id = rr.bom_id and l.is_void = false
    join public.cms_master_item m2 on m2.master_id = l.component_master_id
    where l.component_ref_type = 'MASTER'::public.cms_e_inventory_item_ref_type
      and m2.master_kind = 'BUNDLE'::public.cms_e_master_kind
      and n.depth < p_max_depth
      and not (l.component_master_id = any(n.path))
  ),
  expanded as (
    select
      n.depth + 1 as depth,
      n.path as path,
      n.qty_mult * l.qty_per_unit as qty_per_product_unit,
      l.component_ref_type,
      l.component_master_id,
      l.component_part_id
    from nodes n
    join public.cms_fn_resolve_bom_recipe_v1(n.node_master_id, n.node_variant_key) rr on true
    join public.cms_bom_recipe_line l on l.bom_id = rr.bom_id and l.is_void = false
  )
  select
    e.component_ref_type as leaf_ref_type,
    case when e.component_ref_type = 'MASTER'::public.cms_e_inventory_item_ref_type then e.component_master_id else null end as leaf_master_id,
    case when e.component_ref_type = 'PART'::public.cms_e_inventory_item_ref_type then e.component_part_id else null end as leaf_part_id,
    e.qty_per_product_unit,
    e.depth,
    e.path
  from expanded e
  left join public.cms_master_item mm on mm.master_id = e.component_master_id
  where e.component_ref_type = 'PART'::public.cms_e_inventory_item_ref_type
     or (
       e.component_ref_type = 'MASTER'::public.cms_e_inventory_item_ref_type
       and coalesce(mm.master_kind, 'MODEL'::public.cms_e_master_kind) <> 'BUNDLE'::public.cms_e_master_kind
     );
end;
$$;

-- ============================================================
-- 2) Master RULE pricing preview (uses master defaults, latest ticks)
-- ============================================================
create or replace function public.cms_fn_calc_master_rule_price_v1(
  p_master_id uuid,
  p_silver_adjust_factor numeric default null
)
returns table(
  master_id uuid,
  material_code public.cms_e_material_code,
  net_weight_g numeric,
  gold_tick_id uuid,
  silver_tick_id uuid,
  gold_price numeric,
  silver_price numeric,
  silver_adjust_factor_applied numeric,
  material_sell_krw numeric,
  material_cost_krw numeric,
  labor_sell_krw numeric,
  labor_cost_krw numeric,
  total_sell_krw numeric,
  total_cost_krw numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r_master public.cms_master_item%rowtype;

  v_gold_tick_id uuid;
  v_gold_symbol text;
  v_gold_price numeric;

  v_silver_tick_id uuid;
  v_silver_symbol text;
  v_silver_price numeric;

  v_cs_correction_factor_cfg numeric;
  v_silver_kr_correction_factor_cfg numeric;

  v_silver_purity constant numeric := 0.9250;
  v_silver_adjust_factor numeric;

  v_material public.cms_e_material_code;
  v_net numeric;

  v_labor_sell numeric;
  v_labor_cost numeric;

  v_material_sell numeric;
  v_material_cost numeric;
begin
  select * into r_master
  from public.cms_master_item m
  where m.master_id = p_master_id;

  if not found then
    raise exception 'master not found (master_id=%)', p_master_id;
  end if;

  -- latest ticks (same entrypoints as shipment confirm)
  select t.tick_id, t.symbol, t.price
  into v_gold_tick_id, v_gold_symbol, v_gold_price
  from public.cms_fn_latest_tick_by_role_v1('GOLD') t;

  select t.tick_id, t.symbol, t.price
  into v_silver_tick_id, v_silver_symbol, v_silver_price
  from public.cms_fn_latest_tick_by_role_v1('SILVER') t;

  -- config factors
  select c.cs_correction_factor, c.silver_kr_correction_factor
  into v_cs_correction_factor_cfg, v_silver_kr_correction_factor_cfg
  from public.cms_market_tick_config c
  where c.config_key = 'DEFAULT'
  limit 1;

  -- silver factor policy: CN tick already embeds factor, KR tick uses config/override
  if v_silver_symbol = 'SILVER_CN_KRW_PER_G' then
    v_silver_adjust_factor := 1;
  else
    v_silver_adjust_factor := coalesce(p_silver_adjust_factor, v_silver_kr_correction_factor_cfg, v_cs_correction_factor_cfg, 1);
  end if;

  v_material := coalesce(r_master.material_code_default, '00'::public.cms_e_material_code);
  v_net := greatest(coalesce(r_master.weight_default_g, 0) - coalesce(r_master.deduction_weight_default_g, 0), 0);

  v_labor_sell :=
    coalesce(r_master.labor_base_sell_default, 0)
    + coalesce(r_master.labor_center_sell_default, 0)
    + coalesce(r_master.labor_sub1_sell_default, 0)
    + coalesce(r_master.labor_sub2_sell_default, 0)
    + coalesce(r_master.labor_bead_sell_default, 0);

  v_labor_cost :=
    coalesce(r_master.labor_base_cost_default, 0)
    + coalesce(r_master.labor_center_cost_default, 0)
    + coalesce(r_master.labor_sub1_cost_default, 0)
    + coalesce(r_master.labor_sub2_cost_default, 0)
    + coalesce(r_master.labor_bead_cost_default, 0);

  if v_material in ('14'::public.cms_e_material_code,'18'::public.cms_e_material_code,'24'::public.cms_e_material_code) then
    if v_gold_tick_id is null then raise exception 'missing gold tick'; end if;

    v_material_sell :=
      case v_material
        when '14'::public.cms_e_material_code then round(v_gold_price * 0.6435 * v_net, 0)
        when '18'::public.cms_e_material_code then round(v_gold_price * 0.8250 * v_net, 0)
        when '24'::public.cms_e_material_code then round(v_gold_price * 1.0000 * v_net, 0)
      end;

    v_material_cost := v_material_sell;
  elsif v_material = '925'::public.cms_e_material_code then
    if v_silver_tick_id is null then raise exception 'missing silver tick'; end if;

    v_material_sell := round(v_silver_price * v_silver_purity * v_net * v_silver_adjust_factor, 0);
    v_material_cost := v_material_sell;
  else
    v_material_sell := 0;
    v_material_cost := 0;
  end if;

  return query
  select
    r_master.master_id,
    v_material,
    v_net,
    v_gold_tick_id,
    v_silver_tick_id,
    v_gold_price,
    v_silver_price,
    v_silver_adjust_factor,
    v_material_sell,
    v_material_cost,
    v_labor_sell,
    v_labor_cost,
    (v_material_sell + v_labor_sell) as total_sell_krw,
    (v_material_cost + v_labor_cost) as total_cost_krw;
end;
$$;

-- ============================================================
-- 3) Bundle rollup pricing (BUNDLE masters): sum leaf component RULE prices (uses latest ticks)
--    - Uses flattened BOM leaves (masters + parts)
--    - Supports shipment-line qty multiplier (p_qty)
-- ============================================================
create or replace function public.cms_fn_calc_bundle_rollup_price_v1(
  p_bundle_master_id uuid,
  p_variant_key text default null,
  p_qty numeric default 1
)
returns table(
  unit_net_weight_g numeric,
  total_net_weight_g numeric,

  unit_material_sell_krw numeric,
  unit_labor_sell_krw numeric,
  unit_total_sell_krw numeric,

  unit_material_cost_krw numeric,
  unit_labor_cost_krw numeric,
  unit_total_cost_krw numeric,

  total_material_sell_krw numeric,
  total_labor_sell_krw numeric,
  total_total_sell_krw numeric,

  total_material_cost_krw numeric,
  total_labor_cost_krw numeric,
  total_total_cost_krw numeric,

  breakdown jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r_bundle public.cms_master_item%rowtype;

  v_gold_tick_id uuid;
  v_gold_symbol text;
  v_gold_price numeric;

  v_silver_tick_id uuid;
  v_silver_symbol text;
  v_silver_price numeric;

  v_cs_correction_factor_cfg numeric;
  v_silver_kr_correction_factor_cfg numeric;

  v_silver_purity constant numeric := 0.9250;
  v_silver_adjust_factor numeric;

  v_round_unit_krw numeric;
  v_apply_unit_rounding boolean;

  v_sell_adjust_krw numeric;
  v_sell_adjust_rate numeric;

  v_unit_material_sell numeric := 0;
  v_unit_labor_sell numeric := 0;
  v_unit_material_cost numeric := 0;
  v_unit_labor_cost numeric := 0;
  v_unit_net numeric := 0;

  v_unit_total_sell numeric := 0;
  v_unit_total_cost numeric := 0;

  v_total_material_sell numeric := 0;
  v_total_labor_sell numeric := 0;
  v_total_material_cost numeric := 0;
  v_total_labor_cost numeric := 0;
  v_total_net numeric := 0;

  v_breakdown jsonb;
begin
  select * into r_bundle
  from public.cms_master_item m
  where m.master_id = p_bundle_master_id;

  if not found then
    raise exception 'master not found (master_id=%)', p_bundle_master_id;
  end if;

  if r_bundle.master_kind <> 'BUNDLE'::public.cms_e_master_kind then
    raise exception 'not a BUNDLE master (master_id=%)', p_bundle_master_id;
  end if;

  if p_qty is null or p_qty <= 0 then
    p_qty := 1;
  end if;

  -- latest ticks (same entrypoints as shipment confirm)
  select t.tick_id, t.symbol, t.price
  into v_gold_tick_id, v_gold_symbol, v_gold_price
  from public.cms_fn_latest_tick_by_role_v1('GOLD') t;

  select t.tick_id, t.symbol, t.price
  into v_silver_tick_id, v_silver_symbol, v_silver_price
  from public.cms_fn_latest_tick_by_role_v1('SILVER') t;

  -- config factors + rounding
  select
    c.cs_correction_factor,
    c.silver_kr_correction_factor,
    c.rule_rounding_unit_krw
  into
    v_cs_correction_factor_cfg,
    v_silver_kr_correction_factor_cfg,
    v_round_unit_krw
  from public.cms_market_tick_config c
  where c.config_key = 'DEFAULT'
  limit 1;

  if v_silver_symbol = 'SILVER_CN_KRW_PER_G' then
    v_silver_adjust_factor := 1;
  else
    v_silver_adjust_factor := coalesce(v_silver_kr_correction_factor_cfg, v_cs_correction_factor_cfg, 1);
  end if;

  -- optional bundle recipe meta adjustments (safe defaults)
  select
    coalesce((b.meta->>'sell_adjust_krw')::numeric, 0),
    nullif((b.meta->>'sell_adjust_rate')::numeric, 0),
    coalesce((b.meta->>'round_unit_krw')::numeric, v_round_unit_krw)
  into
    v_sell_adjust_krw,
    v_sell_adjust_rate,
    v_round_unit_krw
  from public.cms_fn_resolve_bom_recipe_v1(p_bundle_master_id, nullif(trim(coalesce(p_variant_key,'')),'') ) rr
  join public.cms_bom_recipe b on b.bom_id = rr.bom_id;

  if v_sell_adjust_rate is null then
    v_sell_adjust_rate := 1;
  end if;

  v_apply_unit_rounding := coalesce(r_bundle.is_unit_pricing, false);

  with leaf as (
    select *
    from public.cms_fn_bom_flatten_active_v1(p_bundle_master_id, nullif(trim(coalesce(p_variant_key,'')),''))
  ),
  comp as (
    select
      l.leaf_ref_type,
      l.leaf_master_id,
      l.leaf_part_id,
      l.qty_per_product_unit as qty_per_bundle,

      mi.model_name as master_model_name,
      mi.material_code_default,
      greatest(coalesce(mi.weight_default_g, 0) - coalesce(mi.deduction_weight_default_g, 0), 0) as master_net_weight_g,

      (coalesce(mi.labor_base_sell_default, 0)
       + coalesce(mi.labor_center_sell_default, 0)
       + coalesce(mi.labor_sub1_sell_default, 0)
       + coalesce(mi.labor_sub2_sell_default, 0)
       + coalesce(mi.labor_bead_sell_default, 0)) as master_labor_sell_krw,

      (coalesce(mi.labor_base_cost_default, 0)
       + coalesce(mi.labor_center_cost_default, 0)
       + coalesce(mi.labor_sub1_cost_default, 0)
       + coalesce(mi.labor_sub2_cost_default, 0)
       + coalesce(mi.labor_bead_cost_default, 0)) as master_labor_cost_krw,

      pi.part_name as part_name,
      coalesce(pi.last_unit_cost_krw, 0) as part_unit_cost_krw
    from leaf l
    left join public.cms_master_item mi on mi.master_id = l.leaf_master_id
    left join public.cms_part_item pi on pi.part_id = l.leaf_part_id
  ),
  priced as (
    select
      c.*,

      case
        when c.leaf_ref_type = 'MASTER'::public.cms_e_inventory_item_ref_type
         and c.material_code_default in ('14'::public.cms_e_material_code,'18'::public.cms_e_material_code,'24'::public.cms_e_material_code)
          then
            case c.material_code_default
              when '14'::public.cms_e_material_code then round(v_gold_price * 0.6435 * c.master_net_weight_g, 0)
              when '18'::public.cms_e_material_code then round(v_gold_price * 0.8250 * c.master_net_weight_g, 0)
              when '24'::public.cms_e_material_code then round(v_gold_price * 1.0000 * c.master_net_weight_g, 0)
            end
        when c.leaf_ref_type = 'MASTER'::public.cms_e_inventory_item_ref_type
         and c.material_code_default = '925'::public.cms_e_material_code
          then round(v_silver_price * v_silver_purity * c.master_net_weight_g * v_silver_adjust_factor, 0)
        else 0
      end as unit_material_sell,

      case
        when c.leaf_ref_type = 'MASTER'::public.cms_e_inventory_item_ref_type
          then c.master_labor_sell_krw
        else 0
      end as unit_labor_sell,

      case
        when c.leaf_ref_type = 'MASTER'::public.cms_e_inventory_item_ref_type
          then
            case
              when c.material_code_default in ('14'::public.cms_e_material_code,'18'::public.cms_e_material_code,'24'::public.cms_e_material_code,'925'::public.cms_e_material_code)
                then c.master_net_weight_g
              else 0
            end
        else 0
      end as unit_net_weight_g,

      -- costs: material cost follows sell policy; labor cost from master; parts contribute cost only
      case
        when c.leaf_ref_type = 'MASTER'::public.cms_e_inventory_item_ref_type
          then
            case
              when c.material_code_default in ('14'::public.cms_e_material_code,'18'::public.cms_e_material_code,'24'::public.cms_e_material_code)
                then
                  case c.material_code_default
                    when '14'::public.cms_e_material_code then round(v_gold_price * 0.6435 * c.master_net_weight_g, 0)
                    when '18'::public.cms_e_material_code then round(v_gold_price * 0.8250 * c.master_net_weight_g, 0)
                    when '24'::public.cms_e_material_code then round(v_gold_price * 1.0000 * c.master_net_weight_g, 0)
                  end
              when c.material_code_default = '925'::public.cms_e_material_code
                then round(v_silver_price * v_silver_purity * c.master_net_weight_g * v_silver_adjust_factor, 0)
              else 0
            end
        else 0
      end as unit_material_cost,

      case
        when c.leaf_ref_type = 'MASTER'::public.cms_e_inventory_item_ref_type
          then c.master_labor_cost_krw
        when c.leaf_ref_type = 'PART'::public.cms_e_inventory_item_ref_type
          then c.part_unit_cost_krw
        else 0
      end as unit_labor_cost
    from comp c
  ),
  summed as (
    select
      sum(p.qty_per_bundle * p.unit_net_weight_g) as unit_net_weight_g,
      sum(p.qty_per_bundle * p.unit_material_sell) as unit_material_sell,
      sum(p.qty_per_bundle * p.unit_labor_sell) as unit_labor_sell,
      sum(p.qty_per_bundle * p.unit_material_cost) as unit_material_cost,
      sum(p.qty_per_bundle * p.unit_labor_cost) as unit_labor_cost,
      jsonb_agg(
        jsonb_build_object(
          'ref_type', p.leaf_ref_type,
          'master_id', p.leaf_master_id,
          'part_id', p.leaf_part_id,
          'name', coalesce(p.master_model_name, p.part_name, 'UNKNOWN'),
          'qty_per_bundle', p.qty_per_bundle,
          'unit_material_sell_krw', p.unit_material_sell,
          'unit_labor_sell_krw', p.unit_labor_sell,
          'unit_total_sell_krw', (p.unit_material_sell + p.unit_labor_sell),
          'unit_material_cost_krw', p.unit_material_cost,
          'unit_labor_cost_krw', p.unit_labor_cost,
          'unit_total_cost_krw', (p.unit_material_cost + p.unit_labor_cost),
          'unit_net_weight_g', p.unit_net_weight_g
        )
      ) as breakdown
    from priced p
  )
  select
    coalesce(s.unit_net_weight_g, 0),
    coalesce(s.unit_material_sell, 0),
    coalesce(s.unit_labor_sell, 0),
    coalesce(s.unit_material_cost, 0),
    coalesce(s.unit_labor_cost, 0),
    coalesce(s.breakdown, '[]'::jsonb)
  into
    v_unit_net,
    v_unit_material_sell,
    v_unit_labor_sell,
    v_unit_material_cost,
    v_unit_labor_cost,
    v_breakdown
  from summed s;

  -- apply bundle meta adjustments: rate then krw (delta absorbed into labor)
  v_unit_material_sell := round(v_unit_material_sell * v_sell_adjust_rate, 0);
  v_unit_labor_sell := round(v_unit_labor_sell * v_sell_adjust_rate, 0);

  if coalesce(v_sell_adjust_krw, 0) <> 0 then
    v_unit_labor_sell := v_unit_labor_sell + v_sell_adjust_krw;
  end if;

  v_unit_total_sell := coalesce(v_unit_material_sell, 0) + coalesce(v_unit_labor_sell, 0);
  v_unit_total_cost := coalesce(v_unit_material_cost, 0) + coalesce(v_unit_labor_cost, 0);

  -- optional unit rounding (same style as shipment RULE rounding: delta goes to labor)
  if v_apply_unit_rounding and coalesce(v_round_unit_krw, 0) > 0 then
    declare
      v_rounded numeric;
      v_delta numeric;
    begin
      v_rounded := ceil(v_unit_total_sell / v_round_unit_krw) * v_round_unit_krw;
      v_delta := v_rounded - v_unit_total_sell;
      v_unit_total_sell := v_rounded;
      v_unit_labor_sell := v_unit_labor_sell + v_delta;
    end;
  end if;

  -- totals for p_qty
  v_total_net := v_unit_net * p_qty;
  v_total_material_sell := v_unit_material_sell * p_qty;
  v_total_labor_sell := v_unit_labor_sell * p_qty;
  v_total_material_cost := v_unit_material_cost * p_qty;
  v_total_labor_cost := v_unit_labor_cost * p_qty;

  return query
  select
    v_unit_net,
    v_total_net,

    v_unit_material_sell,
    v_unit_labor_sell,
    v_unit_total_sell,

    v_unit_material_cost,
    v_unit_labor_cost,
    v_unit_total_cost,

    v_total_material_sell,
    v_total_labor_sell,
    (v_total_material_sell + v_total_labor_sell),

    v_total_material_cost,
    v_total_labor_cost,
    (v_total_material_cost + v_total_labor_cost),

    v_breakdown;
end;
$$;

-- ============================================================
-- 4) Safe effective price API (MASTER_RULE vs BUNDLE_ROLLUP)
-- ============================================================
create or replace function public.cms_fn_get_master_effective_price_v1(
  p_master_id uuid,
  p_variant_key text default null,
  p_qty numeric default 1
)
returns table(
  pricing_method text,
  ok boolean,
  error_message text,
  unit_total_sell_krw numeric,
  unit_total_cost_krw numeric,
  total_total_sell_krw numeric,
  total_total_cost_krw numeric,
  breakdown jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kind public.cms_e_master_kind;
begin
  select m.master_kind into v_kind
  from public.cms_master_item m
  where m.master_id = p_master_id;

  if v_kind is null then
    return query select
      'UNKNOWN'::text, false, 'master not found', null::numeric, null::numeric, null::numeric, null::numeric, null::jsonb;
    return;
  end if;

  if v_kind = 'BUNDLE'::public.cms_e_master_kind then
    begin
      return query
      select
        'BUNDLE_ROLLUP'::text,
        true,
        null::text,
        r.unit_total_sell_krw,
        r.unit_total_cost_krw,
        r.total_total_sell_krw,
        r.total_total_cost_krw,
        r.breakdown
      from public.cms_fn_calc_bundle_rollup_price_v1(p_master_id, p_variant_key, p_qty) r;
      return;
    exception when others then
      return query select
        'BUNDLE_ROLLUP'::text, false, sqlerrm, null::numeric, null::numeric, null::numeric, null::numeric, null::jsonb;
      return;
    end;
  end if;

  begin
    return query
    select
      'MASTER_RULE'::text,
      true,
      null::text,
      p.total_sell_krw,
      p.total_cost_krw,
      (p.total_sell_krw * coalesce(p_qty,1)),
      (p.total_cost_krw * coalesce(p_qty,1)),
      null::jsonb
    from public.cms_fn_calc_master_rule_price_v1(p_master_id, null) p;
    return;
  exception when others then
    return query select
      'MASTER_RULE'::text, false, sqlerrm, null::numeric, null::numeric, null::numeric, null::numeric, null::jsonb;
    return;
  end;
end;
$$;

-- ============================================================
-- 5) Patch shipment confirm: support BUNDLE pricing via rollup
-- ============================================================
create or replace function public.cms_fn_confirm_shipment(
  p_shipment_id uuid,
  p_actor_person_id uuid default null::uuid,
  p_note text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_hdr public.cms_shipment_header%rowtype;
  v_ship_date date;
  v_now timestamptz := now();

  v_gold_tick_id uuid;
  v_gold_price numeric;
  v_gold_observed_at timestamptz;

  v_silver_tick_id uuid;
  v_silver_price numeric;
  v_silver_observed_at timestamptz;

  v_gold_symbol public.cms_e_market_symbol;
  v_silver_symbol public.cms_e_market_symbol;
  v_cs_correction_factor_cfg numeric;
  v_silver_adjust_factor_applied numeric;
  v_silver_kr_correction_factor_cfg numeric;
  v_silver_tick_meta jsonb;
  v_silver_factor_snapshot numeric;
  v_silver_factor_embedded_in_tick boolean;
  v_silver_purity numeric := 0.9250;

  v_total_sell numeric := 0;
  v_total_cost numeric := 0;
  v_total_weight numeric := 0;
  v_total_labor numeric := 0;

  r_line public.cms_shipment_line%rowtype;

  r_order public.cms_order_line%rowtype;
  r_repair public.cms_repair_line%rowtype;
  r_master public.cms_master_item%rowtype;

  v_category cms_e_category_code;
  v_material cms_e_material_code;
  v_variant text;

  v_measured numeric;
  v_deduct numeric;
  v_net numeric;

  v_labor_base_sell numeric := 0;
  v_labor_center_sell numeric := 0;
  v_labor_sub1_sell numeric := 0;
  v_labor_sub2_sell numeric := 0;
  v_labor_bead_sell numeric := 0;

  v_labor_base_cost numeric := 0;
  v_labor_center_cost numeric := 0;
  v_labor_sub1_cost numeric := 0;
  v_labor_sub2_cost numeric := 0;
  v_labor_bead_cost numeric := 0;

  v_labor_total_sell numeric := 0;
  v_labor_total_cost numeric := 0;

  v_material_amount_sell numeric := 0;
  v_material_amount_cost numeric := 0;

  v_is_plated boolean := false;
  v_plating_variant_id uuid;
  v_plating_rule_id uuid;
  v_plating_sell numeric := 0;
  v_plating_cost numeric := 0;

  v_repair_fee numeric := 0;

  v_rule_total_sell numeric := 0;
  v_rule_total_cost numeric := 0;

  v_final_sell numeric := 0;
  v_final_cost numeric := 0;

  v_band_id uuid;

  v_master_id uuid;

  v_line_cnt int := 0;
  v_is_store_pickup boolean := false;
  v_pricing_source text;
  v_pricing_locked_at timestamptz;
begin
  -- lock header
  select * into v_hdr
  from public.cms_shipment_header
  where shipment_id = p_shipment_id
  for update;

  if not found then
    raise exception 'shipment not found: %', p_shipment_id;
  end if;

  v_is_store_pickup := coalesce(v_hdr.is_store_pickup, false);
  v_pricing_source := case when v_is_store_pickup then 'STORE_PICKUP_CONFIRM' else 'CONFIRM_SHIPMENT' end;
  if v_hdr.pricing_source is not null then
    v_pricing_source := v_hdr.pricing_source;
  end if;

  -- idempotent / backfill
  -- - 이미 CONFIRMED 인데, 라인 정산(is_priced_final)이 끝난 경우: 재정산하지 않고 AR ledger만 보정(backfill) 후 반환
  -- - 라인 정산이 안 된 경우(레거시/깨진 confirm): 아래 로직으로 정산 + AR ledger 생성
  if v_hdr.status = 'CONFIRMED' then
    if not exists (
      select 1
      from public.cms_shipment_line
      where shipment_id = p_shipment_id
        and coalesce(is_priced_final,false) = false
    ) then
      -- ledger만 없으면 생성(중복 방지)
      if not exists (
        select 1
        from public.cms_ar_ledger
        where entry_type = 'SHIPMENT'
          and shipment_id = p_shipment_id
      ) then
        insert into public.cms_ar_ledger(
          party_id, occurred_at, entry_type, amount_krw,
          shipment_id, memo, total_weight_g, total_labor_krw
        )
        values (
          v_hdr.customer_party_id,
          coalesce(v_hdr.confirmed_at, v_now),
          'SHIPMENT',
          (select coalesce(sum(total_amount_sell_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id),
          p_shipment_id,
          p_note,
          (select coalesce(sum(net_weight_g),0) from public.cms_shipment_line where shipment_id = p_shipment_id),
          (select coalesce(sum(labor_total_sell_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id)
        );
      end if;

      return jsonb_build_object(
        'ok', true,
        'already_confirmed', true,
        'shipment_id', p_shipment_id,
        'confirmed_at', v_hdr.confirmed_at,
        'total_sell_krw', (select coalesce(sum(total_amount_sell_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id),
        'total_cost_krw', (select coalesce(sum(total_amount_cost_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id)
      );
    end if;

    -- confirmed_at은 유지(재정산/backfill 이더라도 timestamp를 새로 찍지 않음)
    v_now := coalesce(v_hdr.confirmed_at, v_now);
  end if;

  -- must have at least 1 line
  select count(*) into v_line_cnt
  from public.cms_shipment_line
  where shipment_id = p_shipment_id;

  if v_line_cnt <= 0 then
    raise exception 'cannot confirm shipment with no lines (shipment_id=%)', p_shipment_id;
  end if;

  v_ship_date := coalesce(v_hdr.ship_date, current_date);

  -- ticks (latest)
  select t.tick_id, t.price, t.observed_at, t.symbol
    into v_gold_tick_id, v_gold_price, v_gold_observed_at, v_gold_symbol
  from public.cms_fn_latest_tick_by_role_v1('GOLD') t;

  select t.tick_id, t.price, t.observed_at, t.symbol
    into v_silver_tick_id, v_silver_price, v_silver_observed_at, v_silver_symbol
  from public.cms_fn_latest_tick_by_role_v1('SILVER') t;

  -- Global correction factor (configurable). Note: if the SILVER role points to
  -- SILVER_CN_KRW_PER_G, the tick already includes this factor; we must NOT apply it twice.
  select
    coalesce(c.cs_correction_factor, 1.200000),
    coalesce(c.silver_kr_correction_factor, c.cs_correction_factor, 1.200000)
  into
    v_cs_correction_factor_cfg,
    v_silver_kr_correction_factor_cfg
  from public.cms_market_tick_config c
  where c.config_key = 'DEFAULT'
  limit 1;

  v_cs_correction_factor_cfg := coalesce(v_cs_correction_factor_cfg, 1.200000);
  v_silver_kr_correction_factor_cfg := coalesce(v_silver_kr_correction_factor_cfg, v_cs_correction_factor_cfg, 1.200000);

  -- Tick meta: used to (1) detect 'factor already applied in tick', and (2) snapshot the factor into shipment_line
  v_silver_tick_meta := null;
  if v_silver_tick_id is not null then
    select t.meta into v_silver_tick_meta
    from public.cms_market_tick t
    where t.tick_id = v_silver_tick_id;
  end if;

  -- Prefer factor from tick meta (producer responsibility: if meta includes a correction factor, it is assumed to be already applied to krw_per_g)
  v_silver_factor_snapshot := null;
  if v_silver_tick_meta is not null then
    begin
      if v_silver_tick_meta ? 'cs_correction_factor' then
        v_silver_factor_snapshot := (v_silver_tick_meta->>'cs_correction_factor')::numeric;
      elsif v_silver_tick_meta ? 'silver_kr_correction_factor' then
        v_silver_factor_snapshot := (v_silver_tick_meta->>'silver_kr_correction_factor')::numeric;
      elsif v_silver_tick_meta ? 'krx_correction_factor' then
        v_silver_factor_snapshot := (v_silver_tick_meta->>'krx_correction_factor')::numeric;
      end if;
    exception when others then
      v_silver_factor_snapshot := null;
    end;
  end if;

  -- CN tick: correction factor is already embedded in the tick value (CS formula). Snapshot factor separately.
  if v_silver_symbol = 'SILVER_CN_KRW_PER_G'::public.cms_e_market_symbol then
    v_silver_factor_embedded_in_tick := true;
    v_silver_factor_snapshot := coalesce(v_silver_factor_snapshot, v_cs_correction_factor_cfg, 1.200000);
  else
    -- KR tick: treat meta factor as embedded; if missing, apply fallback cfg at confirm time (backward compatible)
    v_silver_factor_embedded_in_tick := (v_silver_factor_snapshot is not null);
    v_silver_factor_snapshot := coalesce(v_silver_factor_snapshot, v_silver_kr_correction_factor_cfg, 1.200000);
  end if;

  -- factor actually multiplied at confirm time (1.0 if embedded in tick)
  v_silver_adjust_factor_applied := case when v_silver_factor_embedded_in_tick then 1.000000 else v_silver_factor_snapshot end;

  -- loop lines
  for r_line in
    select *
    from public.cms_shipment_line
    where shipment_id = p_shipment_id
    order by created_at asc
    for update
  loop
    -- reset per line
    r_order := null;
    r_repair := null;
    r_master := null;

    v_category := null;
    v_material := null;

    v_measured := null;
    v_deduct := 0;
    v_net := null;

    v_labor_base_sell := 0; v_labor_center_sell := 0; v_labor_sub1_sell := 0; v_labor_sub2_sell := 0; v_labor_bead_sell := 0;
    v_labor_base_cost := 0; v_labor_center_cost := 0; v_labor_sub1_cost := 0; v_labor_sub2_cost := 0; v_labor_bead_cost := 0;
    v_labor_total_sell := 0; v_labor_total_cost := 0;

    v_material_amount_sell := 0; v_material_amount_cost := 0;

    v_is_plated := false;
    v_plating_variant_id := null;
    v_plating_rule_id := null;
    v_plating_sell := 0;
    v_plating_cost := 0;

    v_repair_fee := 0;

    v_rule_total_sell := 0;
    v_rule_total_cost := 0;

    v_final_sell := 0;
    v_final_cost := 0;

    v_band_id := null;
    v_master_id := null;

    -- load refs
    if r_line.order_line_id is not null then
      select * into r_order from public.cms_order_line where order_line_id = r_line.order_line_id;
    end if;

    if r_line.repair_line_id is not null then
      select * into r_repair from public.cms_repair_line where repair_line_id = r_line.repair_line_id;
    end if;

    -- fill missing snapshot fields from order/repair
    if r_line.model_name is null then
      r_line.model_name := coalesce(r_order.model_name, r_repair.model_name);
    end if;

    if r_line.suffix is null then
      r_line.suffix := coalesce(r_order.suffix, r_repair.suffix);
    end if;

    if r_line.color is null then
      r_line.color := coalesce(r_order.color, r_repair.color);
    end if;

    if r_line.size is null then
      r_line.size := r_order.size;
    end if;

    if r_line.qty is null then
      r_line.qty := coalesce(r_order.qty, r_repair.qty);
    end if;

    -- master resolve
    if r_order.order_line_id is not null and r_order.matched_master_id is not null then
      v_master_id := r_order.matched_master_id;
    end if;

    if v_master_id is not null then
      select * into r_master from public.cms_master_item where master_id = v_master_id;
    elsif r_line.model_name is not null then
      select * into r_master
      from public.cms_master_item
      where model_name = trim(r_line.model_name)
      limit 1;

      if r_master.master_id is not null then
        v_master_id := r_master.master_id;
      end if;
    end if;

    if r_line.model_name is null and r_master.master_id is not null then
      r_line.model_name := r_master.model_name;
    end if;

    -- category/material resolve (NO r_order.category_code usage)
    v_category := coalesce(r_line.category_code, r_master.category_code, r_line.ad_hoc_category_code);
    if v_category is null then
      raise exception 'category_code required for shipment_line_id=%', r_line.shipment_line_id;
    end if;

    if r_master.master_kind = 'BUNDLE'::public.cms_e_master_kind then
  -- Bundle pricing: roll up active BOM components (including nested bundles)
  v_variant := concat_ws(' / ',
    nullif(trim(coalesce(r_line.suffix,'')), ''),
    nullif(trim(coalesce(r_line.color,'')), ''),
    nullif(trim(coalesce(r_line.size,'')), '')
  );

  select
    coalesce(x.total_net_weight_g, 0),
    coalesce(x.total_material_sell_krw, 0),
    coalesce(x.total_labor_sell_krw, 0),
    coalesce(x.total_material_cost_krw, 0),
    coalesce(x.total_labor_cost_krw, 0)
  into
    v_net,
    v_material_amount_sell,
    v_labor_total_sell,
    v_material_amount_cost,
    v_labor_total_cost
  from public.cms_fn_calc_bundle_rollup_price_v1(
    v_master_id,
    nullif(v_variant,''),
    r_line.qty::numeric
  ) x;

  -- Represent bundle lines as material '00' (amount-based) while keeping rolled-up weight for reporting.
  v_material := '00'::public.cms_e_material_code;
  v_deduct := 0;
  v_measured := case when v_net > 0 then v_net else null end;

  -- manual labor can override bundle labor sell (material remains rolled up)
  if coalesce(r_line.manual_labor_krw, 0) > 0 then
    v_labor_total_sell := r_line.manual_labor_krw;
  end if;

  v_labor_base_sell := v_labor_total_sell;
  v_labor_center_sell := 0;
  v_labor_sub1_sell := 0;
  v_labor_sub2_sell := 0;
  v_labor_bead_sell := 0;

  v_labor_base_cost := v_labor_total_cost;
  v_labor_center_cost := 0;
  v_labor_sub1_cost := 0;
  v_labor_sub2_cost := 0;
  v_labor_bead_cost := 0;

  v_total_weight := v_total_weight + coalesce(v_net, 0);
  v_total_labor := v_total_labor + coalesce(v_labor_total_sell, 0);
else
      v_material := coalesce(r_line.material_code, r_master.material_code_default, r_repair.material_code);
          if v_material is null then
            raise exception 'material_code required for shipment_line_id=%', r_line.shipment_line_id;
          end if;
      
          v_measured := r_line.measured_weight_g;
          v_deduct := coalesce(r_line.deduction_weight_g, r_master.deduction_weight_default_g, 0);
          v_net := case when v_measured is null then null else greatest(v_measured - v_deduct, 0) end;
      
          if v_material <> '00'::public.cms_e_material_code
            and r_line.pricing_mode <> 'AMOUNT_ONLY'::public.cms_e_pricing_mode
          then
            if v_measured is null then
              raise exception 'measured_weight_g required for shipment_line_id=%', r_line.shipment_line_id;
            end if;
          end if;
      
          v_total_weight := v_total_weight + coalesce(v_net, 0);
      
          -- plating snapshot
          v_is_plated := coalesce(r_line.is_plated, false);
          if r_order.order_line_id is not null then
            v_is_plated := coalesce(r_line.is_plated, r_order.is_plated, false);
          end if;
      
          -- manual labor first
          if coalesce(r_line.manual_labor_krw, 0) > 0 then
            v_labor_base_sell := 0;
            v_labor_center_sell := 0;
            v_labor_sub1_sell := 0;
            v_labor_sub2_sell := 0;
            v_labor_bead_sell := 0;
            v_labor_total_sell := r_line.manual_labor_krw;
          else
            v_labor_base_sell := coalesce(r_master.labor_base_sell, 0);
            v_labor_center_sell := coalesce(r_master.labor_center_sell, 0);
            v_labor_sub1_sell := coalesce(r_master.labor_sub1_sell, 0);
            v_labor_sub2_sell := coalesce(r_master.labor_sub2_sell, 0);
            v_labor_bead_sell := coalesce(r_master.labor_bead_sell, 0);
            v_labor_total_sell := v_labor_base_sell + v_labor_center_sell + v_labor_sub1_sell + v_labor_sub2_sell + v_labor_bead_sell;
          end if;
      
          v_labor_base_cost := coalesce(r_master.labor_base_cost, 0);
          v_labor_center_cost := coalesce(r_master.labor_center_cost, 0);
          v_labor_sub1_cost := coalesce(r_master.labor_sub1_cost, 0);
          v_labor_sub2_cost := coalesce(r_master.labor_sub2_cost, 0);
          v_labor_bead_cost := coalesce(r_master.labor_bead_cost, 0);
          v_labor_total_cost := v_labor_base_cost + v_labor_center_cost + v_labor_sub1_cost + v_labor_sub2_cost + v_labor_bead_cost;
      
          v_total_labor := v_total_labor + coalesce(v_labor_total_sell, 0);
      
          -- material sell/cost (same policy as repo)
          if v_material in ('14'::public.cms_e_material_code,'18'::public.cms_e_material_code,'24'::public.cms_e_material_code) then
            if v_gold_tick_id is null then raise exception 'missing gold tick'; end if;
      
            v_material_amount_sell :=
              case v_material
                when '14'::public.cms_e_material_code then round(v_gold_price * 0.6435 * v_net, 0)
                when '18'::public.cms_e_material_code then round(v_gold_price * 0.8250 * v_net, 0)
                when '24'::public.cms_e_material_code then round(v_gold_price * 1.0000 * v_net, 0)
              end;
      
            v_material_amount_cost := v_material_amount_sell;
          elsif v_material = '925'::public.cms_e_material_code then
            if v_silver_tick_id is null then raise exception 'missing silver tick'; end if;
      
            v_material_amount_sell := round(v_silver_price * v_silver_purity * v_net * v_silver_adjust_factor_applied, 0);
            v_material_amount_cost := v_material_amount_sell;
          else
            v_material_amount_sell := 0;
            v_material_amount_cost := 0;
          end if;
      
          
    end if;

    -- final amounts
    v_rule_total_sell := coalesce(v_material_amount_sell,0) + coalesce(v_labor_total_sell,0);
    v_rule_total_cost := coalesce(v_material_amount_cost,0) + coalesce(v_labor_total_cost,0);

    v_final_sell :=
      case
        when r_line.pricing_mode = 'MANUAL'::public.cms_e_pricing_mode then coalesce(r_line.manual_total_amount_krw,0)
        when r_line.pricing_mode = 'AMOUNT_ONLY'::public.cms_e_pricing_mode then coalesce(r_line.manual_total_amount_krw,0)
        else v_rule_total_sell
      end;

    v_final_cost := v_rule_total_cost;

    update public.cms_shipment_line
    set
      category_code = v_category,
      model_name = r_line.model_name,
      suffix = r_line.suffix,
      color = r_line.color,
      size = r_line.size,
      qty = r_line.qty,

      master_id = v_master_id,

      measured_weight_g = r_line.measured_weight_g,
      deduction_weight_g = v_deduct,
      net_weight_g = v_net,

      material_code = v_material,

      gold_tick_id = v_gold_tick_id,
      silver_tick_id = v_silver_tick_id,
      gold_tick_krw_per_g = v_gold_price,
      silver_tick_krw_per_g = v_silver_price,

      silver_adjust_factor = case when v_material in ('925') then v_silver_factor_snapshot else r_line.silver_adjust_factor end,

      material_amount_sell_krw = coalesce(v_material_amount_sell,0),
      material_amount_cost_krw = coalesce(v_material_amount_cost,0),

      labor_base_sell_krw = v_labor_base_sell,
      labor_center_sell_krw = v_labor_center_sell,
      labor_sub1_sell_krw = v_labor_sub1_sell,
      labor_sub2_sell_krw = v_labor_sub2_sell,
      labor_bead_sell_krw = v_labor_bead_sell,
      labor_total_sell_krw = v_labor_total_sell,

      labor_base_cost_krw = v_labor_base_cost,
      labor_center_cost_krw = v_labor_center_cost,
      labor_sub1_cost_krw = v_labor_sub1_cost,
      labor_sub2_cost_krw = v_labor_sub2_cost,
      labor_bead_cost_krw = v_labor_bead_cost,
      labor_total_cost_krw = v_labor_total_cost,

      total_amount_sell_krw = coalesce(v_final_sell,0),
      total_amount_cost_krw = coalesce(v_final_cost,0),

      is_priced_final = true,
      priced_at = v_now,
      updated_at = v_now
    where shipment_line_id = r_line.shipment_line_id;

    v_total_sell := v_total_sell + coalesce(v_final_sell,0);
    v_total_cost := v_total_cost + coalesce(v_final_cost,0);
  end loop;

  v_pricing_locked_at := coalesce(v_hdr.pricing_locked_at, v_now);

  update public.cms_shipment_header
  set status = 'CONFIRMED',
      confirmed_at = v_now,
      pricing_locked_at = coalesce(pricing_locked_at, v_pricing_locked_at),
      pricing_source = coalesce(pricing_source, v_pricing_source)
  where shipment_id = p_shipment_id;

  insert into public.cms_shipment_valuation(
    shipment_id, pricing_locked_at, pricing_source,
    gold_tick_id, silver_tick_id,
    gold_krw_per_g_snapshot, silver_krw_per_g_snapshot, silver_adjust_factor_snapshot,
    material_value_krw, labor_value_krw, total_value_krw, breakdown
  )
  values (
    p_shipment_id, v_pricing_locked_at, v_pricing_source,
    v_gold_tick_id, v_silver_tick_id,
    v_gold_price, v_silver_price, v_silver_adjust_factor_applied,
    (select coalesce(sum(material_amount_sell_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id),
    (select coalesce(sum(labor_total_sell_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id),
    v_total_sell,
    jsonb_build_object(
      'silver_factor_embedded_in_tick', v_silver_factor_embedded_in_tick,
      'silver_factor_snapshot', v_silver_factor_snapshot,
      'silver_factor_applied', v_silver_adjust_factor_applied
    )
  )
  on conflict (shipment_id) do update
    set pricing_locked_at = excluded.pricing_locked_at,
        pricing_source = excluded.pricing_source,
        gold_tick_id = excluded.gold_tick_id,
        silver_tick_id = excluded.silver_tick_id,
        gold_krw_per_g_snapshot = excluded.gold_krw_per_g_snapshot,
        silver_krw_per_g_snapshot = excluded.silver_krw_per_g_snapshot,
        silver_adjust_factor_snapshot = excluded.silver_adjust_factor_snapshot,
        material_value_krw = excluded.material_value_krw,
        labor_value_krw = excluded.labor_value_krw,
        total_value_krw = excluded.total_value_krw,
        breakdown = excluded.breakdown;

  if not exists (
    select 1
    from public.cms_ar_ledger
    where entry_type = 'SHIPMENT'
      and shipment_id = p_shipment_id
  ) then
    insert into public.cms_ar_ledger(
      party_id, occurred_at, entry_type, amount_krw,
      shipment_id, memo, total_weight_g, total_labor_krw
    )
    values (
      v_hdr.customer_party_id,
      v_now,
      'SHIPMENT',
      v_total_sell,
      p_shipment_id,
      p_note,
      v_total_weight,
      v_total_labor
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'confirmed_at', v_now,
    'total_sell_krw', v_total_sell,
    'total_cost_krw', v_total_cost
  );
end $function$;

-- ============================================================
-- 6) Patch inventory issue: BUNDLE emits flattened BOM leaf components only
-- ============================================================
create or replace function public.cms_fn_emit_inventory_issue_from_shipment_confirmed_v2(
  p_shipment_id uuid,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ship public.cms_shipment_header%rowtype;
  v_move_id uuid;
  v_key text;
  r public.cms_shipment_line%rowtype;
  v_line_no int := 0;
  v_item_name text;
  v_variant text;
  v_master_id uuid;
  v_master_kind public.cms_e_master_kind;
  v_source_location text;
  v_source_bin text;

  v_bom_id uuid;
  v_match_kind text;
  v_matched_variant_key text;
  c record;

  v_bom_applied_lines int := 0;
  v_bom_warnings jsonb := '[]'::jsonb;
begin
  if p_shipment_id is null then
    raise exception using errcode='P0001', message='shipment_id required';
  end if;

  select * into v_ship
  from public.cms_shipment_header
  where shipment_id = p_shipment_id
  for update;

  if not found then
    raise exception using errcode='P0001', message=format('shipment not found: %s', p_shipment_id);
  end if;

  if v_ship.status <> 'CONFIRMED'::public.cms_e_shipment_status then
    raise exception using errcode='P0001', message=format('shipment not CONFIRMED: %s (status=%s)', p_shipment_id, v_ship.status);
  end if;

  v_source_location := coalesce(nullif(trim(coalesce(v_ship.source_location_code,'')), ''), case when v_ship.is_store_pickup then 'STORE' else 'OFFICE' end);
  v_source_bin := nullif(trim(coalesce(v_ship.source_bin_code,'')), '');

  perform public.cms_fn_assert_location_active_v1(v_source_location, v_source_bin);

  v_key := 'SHIPMENT_CONFIRMED:' || p_shipment_id::text;

  v_move_id := public.cms_fn_upsert_inventory_move_header_v1(
    p_move_type := 'ISSUE'::public.cms_e_inventory_move_type,
    p_occurred_at := coalesce(v_ship.confirmed_at, now()),
    p_party_id := v_ship.customer_party_id,
    p_location_code := v_source_location,
    p_ref_doc_type := 'SHIPMENT',
    p_ref_doc_id := p_shipment_id,
    p_memo := coalesce(p_note, 'auto issue from shipment confirmed'),
    p_source := 'AUTO_SHIPMENT',
    p_meta := jsonb_build_object('shipment_id', p_shipment_id, 'source_location_code', v_source_location, 'source_bin_code', v_source_bin),
    p_move_id := null,
    p_idempotency_key := v_key,
    p_actor_person_id := p_actor_person_id,
    p_note := p_note,
    p_correlation_id := p_correlation_id
  );

  -- already posted: idempotent return
  if exists (
    select 1 from public.cms_inventory_move_header
    where move_id = v_move_id and status = 'POSTED'::public.cms_e_inventory_move_status
  ) then
    return v_move_id;
  end if;

  update public.cms_inventory_move_header
  set
    location_code = v_source_location,
    bin_code = v_source_bin,
    meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('source_location_code', v_source_location, 'source_bin_code', v_source_bin)
  where move_id = v_move_id;

  update public.cms_inventory_move_line
  set is_void = true, void_reason = 'rebuild_from_shipment'
  where move_id = v_move_id and is_void = false;

  for r in
    select * from public.cms_shipment_line
    where shipment_id = p_shipment_id
    order by created_at asc
  loop
    v_line_no := v_line_no + 1;

    v_item_name := coalesce(
      nullif(trim(coalesce(r.model_name,'')), ''),
      nullif(trim(coalesce(r.ad_hoc_name,'')), ''),
      'UNKNOWN_ITEM'
    );

    v_variant := concat_ws(' / ',
      nullif(trim(coalesce(r.suffix,'')), ''),
      nullif(trim(coalesce(r.color,'')), ''),
      nullif(trim(coalesce(r.size,'')), '')
    );

    v_master_id := null;
    if r.model_name is not null and length(trim(r.model_name)) > 0 then
      select m.master_id, m.master_kind into v_master_id, v_master_kind
      from public.cms_master_item m
      where m.model_name = trim(r.model_name)
      limit 1;
end if;

-- If the shipment line is a BUNDLE master, emit only flattened BOM leaf components (skip the bundle header line).
if v_master_id is not null and v_master_kind = 'BUNDLE'::public.cms_e_master_kind then
  for c in
    select
      f.leaf_ref_type,
      f.leaf_master_id,
      f.leaf_part_id,
      f.qty_per_product_unit,
      coalesce(mi.model_name, pi.part_name, 'UNKNOWN_COMPONENT') as component_name
    from public.cms_fn_bom_flatten_active_v1(v_master_id, nullif(v_variant,''), 8) f
    left join public.cms_master_item mi on mi.master_id = f.leaf_master_id
    left join public.cms_part_item pi on pi.part_id = f.leaf_part_id
    order by component_name asc
  loop
    v_line_no := v_line_no + 1;

    perform public.cms_fn_upsert_inventory_move_line_v1(
      p_move_id := v_move_id,
      p_line_no := v_line_no,
      p_direction := 'OUT'::public.cms_e_inventory_direction,
      p_qty := (c.qty_per_product_unit * r.qty),
      p_item_name := c.component_name,
      p_unit := 'EA'::text,
      p_item_ref_type := c.leaf_ref_type,
      p_master_id := c.leaf_master_id,
      p_part_id := c.leaf_part_id,
      p_variant_hint := nullif(v_variant,''),
      p_note := null,
      p_meta := jsonb_build_object(
        'shipment_line_id', r.shipment_line_id,
        'kind', 'BUNDLE_COMPONENT',
        'bundle_master_id', v_master_id
      ),
      p_ref_entity_type := 'SHIPMENT_LINE',
      p_ref_entity_id := r.shipment_line_id,
      p_move_line_id := v_dummy,
      p_actor_person_id := p_actor_person_id,
      p_note := p_note,
      p_correlation_id := p_correlation_id
    );
  end loop;

  continue;
end if;

perform public.cms_fn_upsert_inventory_move_line_v1(
      p_move_id := v_move_id,
      p_line_no := v_line_no,
      p_direction := 'OUT'::public.cms_e_inventory_direction,
      p_qty := r.qty,
      p_item_name := v_item_name,
      p_unit := 'EA'::text,
      p_item_ref_type := case
        when v_master_id is not null then 'MASTER'::public.cms_e_inventory_item_ref_type
        else 'UNLINKED'::public.cms_e_inventory_item_ref_type
      end,
      p_master_id := v_master_id,
      p_part_id := null,
      p_variant_hint := nullif(v_variant,''),
      p_note := null,
      p_meta := jsonb_build_object(
        'shipment_line_id', r.shipment_line_id,
        'kind', 'SHIPMENT_ITEM'
      ),
      p_ref_entity_type := 'SHIPMENT_LINE',
      p_ref_entity_id := r.shipment_line_id,
      p_move_line_id := null,
      p_actor_person_id := p_actor_person_id,
      p_note2 := p_note,
      p_correlation_id := p_correlation_id
    );

    if v_master_id is not null then
      select rr.bom_id, rr.match_kind, rr.matched_variant_key
      into v_bom_id, v_match_kind, v_matched_variant_key
      from public.cms_fn_resolve_bom_recipe_v1(v_master_id, nullif(v_variant,'')) rr;

      if v_bom_id is not null then
        for c in
          select
            l.bom_line_id,
            l.component_ref_type,
            l.component_master_id,
            cm.model_name as component_master_model_name,
            l.component_part_id,
            cp.part_name as component_part_name,
            l.qty_per_unit,
            l.unit
          from public.cms_bom_recipe_line l
          left join public.cms_master_item cm on cm.master_id = l.component_master_id
          left join public.cms_part_item cp on cp.part_id = l.component_part_id
          where l.bom_id = v_bom_id and l.is_void = false
          order by l.line_no asc
        loop
          begin
            v_line_no := v_line_no + 1;

            perform public.cms_fn_upsert_inventory_move_line_v1(
              p_move_id := v_move_id,
              p_line_no := v_line_no,
              p_direction := 'OUT'::public.cms_e_inventory_direction,
              p_qty := (c.qty_per_unit * r.qty),
              p_item_name := case
                when c.component_ref_type = 'PART'::public.cms_e_inventory_item_ref_type then coalesce(c.component_part_name, 'UNKNOWN_PART')
                else coalesce(c.component_master_model_name, 'UNKNOWN_MASTER')
              end,
              p_unit := coalesce(nullif(trim(coalesce(c.unit,'')),''), 'EA'),
              p_item_ref_type := c.component_ref_type,
              p_master_id := c.component_master_id,
              p_part_id := c.component_part_id,
              p_variant_hint := null,
              p_note := null,
              p_meta := jsonb_build_object(
                'shipment_line_id', r.shipment_line_id,
                'kind', 'BOM_COMPONENT',
                'bom_id', v_bom_id,
                'bom_line_id', c.bom_line_id,
                'bom_match_kind', v_match_kind,
                'bom_matched_variant_key', v_matched_variant_key,
                'shipped_master_id', v_master_id,
                'shipped_qty', r.qty
              ),
              p_ref_entity_type := 'SHIPMENT_LINE',
              p_ref_entity_id := r.shipment_line_id,
              p_move_line_id := null,
              p_actor_person_id := p_actor_person_id,
              p_note2 := p_note,
              p_correlation_id := p_correlation_id
            );

            v_bom_applied_lines := v_bom_applied_lines + 1;
          exception when others then
            v_bom_warnings := v_bom_warnings || jsonb_build_array(jsonb_build_object(
              'shipment_line_id', r.shipment_line_id,
              'bom_id', v_bom_id,
              'bom_line_id', c.bom_line_id,
              'error', sqlerrm
            ));
          end;
        end loop;
      end if;
    end if;
  end loop;

  update public.cms_inventory_move_header
  set meta = coalesce(meta,'{}'::jsonb) || jsonb_build_object(
    'bom_applied_lines', v_bom_applied_lines,
    'bom_warnings', v_bom_warnings,
    'source_location_code', v_source_location,
    'source_bin_code', v_source_bin
  )
  where move_id = v_move_id;

  perform public.cms_fn_post_inventory_move_v1(
    v_move_id,
    p_actor_person_id,
    'auto_post_from_shipment',
    p_note,
    p_correlation_id
  );

  return v_move_id;
end $$;

-- ============================================================
-- 7) Safe grants
-- ============================================================
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.cms_fn_bom_flatten_active_v1(uuid,text,int) to authenticated';
    execute 'grant execute on function public.cms_fn_calc_master_rule_price_v1(uuid,numeric) to authenticated';
    execute 'grant execute on function public.cms_fn_calc_bundle_rollup_price_v1(uuid,text,numeric) to authenticated';
    execute 'grant execute on function public.cms_fn_get_master_effective_price_v1(uuid,text,numeric) to authenticated';
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.cms_fn_bom_flatten_active_v1(uuid,text,int) to service_role';
    execute 'grant execute on function public.cms_fn_calc_master_rule_price_v1(uuid,numeric) to service_role';
    execute 'grant execute on function public.cms_fn_calc_bundle_rollup_price_v1(uuid,text,numeric) to service_role';
    execute 'grant execute on function public.cms_fn_get_master_effective_price_v1(uuid,text,numeric) to service_role';
  end if;
end $$;

commit;
