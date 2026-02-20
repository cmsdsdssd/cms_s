begin;
set search_path = public, pg_temp;
-- ============================================================
-- CMS 0601 BOM/BUNDLE Hotfix (db push 전용)
--
-- 포함 내용:
--  - variant_key 정규화 함수 추가 + resolve 로직 보강(구분자 불일치 흡수)
--  - BUNDLE rollup breakdown에 UI-friendly key(component_*)를 추가(레거시 키도 유지)
--  - cms_fn_emit_inventory_issue_from_shipment_confirmed_v2 컴파일 에러 수정
--
-- 주의:
--  - 기존 데이터/인덱스/테이블 구조는 변경하지 않음(충돌 최소화)
--  - 함수는 create or replace로만 패치(시그니처 유지)
-- ============================================================

-- ============================================================
-- 1) Variant key normalization helper
--    - 목적: 'A / GOLD / S' , 'A|GOLD|S' , 'A | GOLD | S' 등을 모두 'A|GOLD|S'로 정규화
--    - 주의: BOM variant 매칭에서만 사용(기존 데이터 rewrite는 하지 않음: 충돌/유니크 리스크 방지)
-- ============================================================
create or replace function public.cms_fn_normalize_variant_key_v1(p_variant_key text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select
    nullif(
      regexp_replace(
        regexp_replace(
          regexp_replace(trim(coalesce(p_variant_key,'')), '[[:space:]]*[|/][[:space:]]*', '|', 'g'),
          '[|]+', '|', 'g'
        ),
        '^[|]+|[|]+$', '', 'g'
      ),
      ''
    );
$$;
-- ============================================================
-- 2) BOM recipe resolve patch
--    - 우선순위: EXACT(raw) > EXACT(normalized) > DEFAULT
--    - 기존과 호환: match_kind는 EXACT/DEFAULT만 사용(하위 로직 가정 깨지지 않게)
-- ============================================================
create or replace function public.cms_fn_resolve_bom_recipe_v1(
  p_product_master_id uuid,
  p_variant_key text default null
)
returns table (
  bom_id uuid,
  match_kind text,
  matched_variant_key text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with norm as (
    select
      p_product_master_id as product_master_id,
      nullif(trim(coalesce(p_variant_key,'')), '') as raw_variant_key,
      public.cms_fn_normalize_variant_key_v1(p_variant_key) as norm_variant_key
  ),
  exact_raw as (
    select
      r.bom_id,
      'EXACT'::text as match_kind,
      r.variant_key as matched_variant_key,
      1 as pri
    from public.cms_bom_recipe r
    join norm n on n.product_master_id = r.product_master_id
    where r.is_active = true
      and n.raw_variant_key is not null
      and r.variant_key = n.raw_variant_key
    order by r.updated_at desc
    limit 1
  ),
  exact_norm as (
    select
      r.bom_id,
      'EXACT'::text as match_kind,
      r.variant_key as matched_variant_key,
      2 as pri
    from public.cms_bom_recipe r
    join norm n on n.product_master_id = r.product_master_id
    where r.is_active = true
      and n.norm_variant_key is not null
      and r.variant_key is not null
      and public.cms_fn_normalize_variant_key_v1(r.variant_key) = n.norm_variant_key
    order by
      case when r.variant_key = n.norm_variant_key then 0 else 1 end,
      r.updated_at desc
    limit 1
  ),
  def_match as (
    select
      r.bom_id,
      'DEFAULT'::text as match_kind,
      r.variant_key as matched_variant_key,
      3 as pri
    from public.cms_bom_recipe r
    join norm n on n.product_master_id = r.product_master_id
    where r.is_active = true
      and r.variant_key is null
    order by r.updated_at desc
    limit 1
  )
  select q.bom_id, q.match_kind, q.matched_variant_key
  from (
    select * from exact_raw
    union all
    select * from exact_norm
    union all
    select * from def_match
  ) q
  order by q.pri
  limit 1;
$$;
alter function public.cms_fn_resolve_bom_recipe_v1(uuid,text)
  security definer
  set search_path = public, pg_temp;
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
          'unit_net_weight_g', p.unit_net_weight_g,

          -- ui-friendly aliases (non-breaking; keeps legacy keys above)
          'component_ref_type', p.leaf_ref_type,
          'component_master_model_name', p.master_model_name,
          'component_part_name', p.part_name,
          'qty_per_product_unit', p.qty_per_bundle,
          'unit', 'EA',
          'unit_sell_krw', (p.unit_material_sell + p.unit_labor_sell),
          'unit_cost_krw', (p.unit_material_cost + p.unit_labor_cost),
          'total_sell_krw', (p.qty_per_bundle * (p.unit_material_sell + p.unit_labor_sell)),
          'total_cost_krw', (p.qty_per_bundle * (p.unit_material_cost + p.unit_labor_cost))
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
      p_move_line_id := null,
      p_actor_person_id := p_actor_person_id,
      p_note2 := p_note,
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
-- 3) Safe grants (roles may not exist in local dev)
-- ============================================================
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.cms_fn_normalize_variant_key_v1(text) to authenticated';
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.cms_fn_normalize_variant_key_v1(text) to service_role';
  end if;
end $$;
commit;
