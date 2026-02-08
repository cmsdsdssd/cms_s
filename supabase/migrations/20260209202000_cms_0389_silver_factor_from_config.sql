-- =====================================================================
-- ADD-ONLY: silver adjust factor default from cms_market_tick_config
-- - 1.2 하드코딩 제거
-- - cms_market_tick_config.silver_kr_correction_factor를 기본으로 사용
-- =====================================================================

-- 1) config에서 silver factor 읽기 (정렬컬럼(updated_at/created_at) 자동 탐색)
create or replace function public.cms_fn_market_tick_config_get_silver_kr_correction_factor_v1()
returns numeric
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_has_table boolean;
  v_has_col boolean;
  v_order_col text;
  v_factor numeric;
  v_sql text;
begin
  select exists(
    select 1
    from information_schema.tables
    where table_schema='public' and table_name='cms_market_tick_config'
  ) into v_has_table;

  if not v_has_table then
    raise exception 'cms_market_tick_config table not found';
  end if;

  select exists(
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='cms_market_tick_config'
      and column_name='silver_kr_correction_factor'
  ) into v_has_col;

  if not v_has_col then
    raise exception 'cms_market_tick_config.silver_kr_correction_factor column not found';
  end if;

  -- 정렬 기준: updated_at 우선, 없으면 created_at
  select c.column_name into v_order_col
  from information_schema.columns c
  where c.table_schema='public'
    and c.table_name='cms_market_tick_config'
    and c.column_name in ('updated_at','created_at')
  order by case when c.column_name='updated_at' then 1 else 2 end
  limit 1;

  if v_order_col is not null then
    v_sql := format(
      'select silver_kr_correction_factor::numeric
       from public.cms_market_tick_config
       order by %I desc nulls last
       limit 1',
      v_order_col
    );
    execute v_sql into v_factor;
  else
    select silver_kr_correction_factor::numeric
      into v_factor
    from public.cms_market_tick_config
    limit 1;
  end if;

  if v_factor is null then
    raise exception 'silver_kr_correction_factor is null in cms_market_tick_config';
  end if;

  return v_factor;
end;
$$;

-- 2) valuation ensure(v2): p_silver_adjust_factor가 NULL이면 config 값 사용
create or replace function public.cms_fn_shipment_valuation_ensure_v2(
  p_shipment_id uuid,
  p_pricing_source text default 'BACKFILL_AR_V2',
  p_force boolean default false,
  p_silver_adjust_factor numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_hdr public.cms_shipment_header%rowtype;
  v_has boolean;
  v_gold_tick_id uuid;
  v_silver_tick_id uuid;
  v_gold_krw_per_g numeric;
  v_silver_krw_per_g numeric;

  v_silver_adjust_factor numeric;

  v_material_value numeric := 0;
  v_labor_value numeric := 0;
  v_total_value numeric := 0;
  v_breakdown jsonb := '{}'::jsonb;
begin
  select * into v_hdr
  from public.cms_shipment_header
  where shipment_id = p_shipment_id;

  if not found then
    raise exception 'shipment not found: %', p_shipment_id;
  end if;

  if v_hdr.confirmed_at is null then
    raise exception 'shipment not confirmed: %', p_shipment_id;
  end if;

  select exists(select 1 from public.cms_shipment_valuation v where v.shipment_id=p_shipment_id)
    into v_has;

  if v_has and not p_force then
    return jsonb_build_object('ok', true, 'shipment_id', p_shipment_id, 'action', 'skip_exists');
  end if;

  -- ✅ 핵심: default factor = config
  v_silver_adjust_factor := coalesce(
    p_silver_adjust_factor,
    public.cms_fn_market_tick_config_get_silver_kr_correction_factor_v1()
  );

  -- confirmed_at 기준 tick 스냅샷
  select t.tick_id, t.price into v_gold_tick_id, v_gold_krw_per_g
  from public.cms_fn_market_tick_pick_v2('GOLD_KRW_PER_G', v_hdr.confirmed_at) t;

  select t.tick_id, t.price into v_silver_tick_id, v_silver_krw_per_g
  from public.cms_fn_market_tick_pick_v2('SILVER_KRW_PER_G', v_hdr.confirmed_at) t;

  if v_gold_krw_per_g is null or v_silver_krw_per_g is null then
    raise exception 'tick snapshot missing (gold=%, silver=%) for shipment=%',
      v_gold_krw_per_g, v_silver_krw_per_g, p_shipment_id;
  end if;

  with line_base as (
    select
      sl.shipment_line_id,
      coalesce(mi1.is_unit_pricing, mi2.is_unit_pricing, false) as is_unit_pricing,
      greatest(coalesce(sl.total_amount_sell_krw, 0), 0) as total_sell_krw,
      greatest(coalesce(sl.material_amount_sell_krw, 0), 0) as material_amount_sell_krw,
      sl.material_code,
      coalesce(
        sl.net_weight_g,
        greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)
      ) as net_w
    from public.cms_shipment_line sl
    left join public.cms_master_item mi1
      on mi1.master_id = sl.master_id
    left join public.cms_master_item mi2
      on sl.master_id is null
     and sl.model_name is not null
     and trim(sl.model_name) = mi2.model_name
    where sl.shipment_id = p_shipment_id
  ),
  calc as (
    select
      shipment_line_id,
      case
        when is_unit_pricing then total_sell_krw
        else greatest(total_sell_krw - material_amount_sell_krw, 0)
      end as labor_cash_due_krw,
      case
        when is_unit_pricing then 0
        when material_code = '14'  then net_w * 0.6435
        when material_code = '18'  then net_w * 0.825
        when material_code = '24'  then net_w
        when material_code = '925' then net_w * 0.925 * v_silver_adjust_factor * v_silver_adjust_factor
        when material_code = '999' then net_w * v_silver_adjust_factor * v_silver_adjust_factor
        else 0
      end as commodity_due_g,
      case
        when is_unit_pricing then 0
        when material_code in ('14','18','24') then v_gold_krw_per_g
        when material_code in ('925','999')    then v_silver_krw_per_g
        else 0
      end as commodity_price_krw_per_g
    from line_base
  ),
  calc2 as (
    select
      shipment_line_id,
      labor_cash_due_krw,
      (commodity_due_g * commodity_price_krw_per_g) as material_cash_due_krw
    from calc
  ),
  agg as (
    select
      coalesce(sum(labor_cash_due_krw),0) as labor_value,
      coalesce(sum(material_cash_due_krw),0) as material_value,
      jsonb_build_object(
        'version', 2,
        'pricing_locked_at', v_hdr.confirmed_at,
        'pricing_source', p_pricing_source,
        'gold', jsonb_build_object('tick_id', v_gold_tick_id, 'krw_per_g', v_gold_krw_per_g),
        'silver', jsonb_build_object(
          'tick_id', v_silver_tick_id,
          'krw_per_g', v_silver_krw_per_g,
          'adjust_factor', v_silver_adjust_factor
        ),
        'lines', coalesce(
          jsonb_agg(
            jsonb_build_object(
              'shipment_line_id', shipment_line_id,
              'labor_cash_due_krw', labor_cash_due_krw,
              'material_cash_due_krw', material_cash_due_krw
            )
          ),
          '[]'::jsonb
        )
      ) as breakdown
    from calc2
  )
  select labor_value, material_value, (labor_value+material_value), breakdown
    into v_labor_value, v_material_value, v_total_value, v_breakdown
  from agg;

  insert into public.cms_shipment_valuation (
    shipment_id,
    pricing_locked_at,
    pricing_source,
    gold_tick_id,
    silver_tick_id,
    gold_krw_per_g_snapshot,
    silver_krw_per_g_snapshot,
    silver_adjust_factor_snapshot,
    material_value_krw,
    labor_value_krw,
    total_value_krw,
    breakdown
  ) values (
    p_shipment_id,
    v_hdr.confirmed_at,
    p_pricing_source,
    v_gold_tick_id,
    v_silver_tick_id,
    v_gold_krw_per_g,
    v_silver_krw_per_g,
    v_silver_adjust_factor,
    v_material_value,
    v_labor_value,
    v_total_value,
    v_breakdown
  )
  on conflict (shipment_id) do update set
    pricing_locked_at = excluded.pricing_locked_at,
    pricing_source = excluded.pricing_source,
    gold_tick_id = excluded.gold_tick_id,
    silver_tick_id = excluded.silver_tick_id,
    gold_krw_per_g_snapshot = excluded.gold_krw_per_g_snapshot,
    silver_krw_per_g_snapshot = excluded.silver_krw_per_g_snapshot,
    silver_adjust_factor_snapshot = excluded.silver_adjust_factor_snapshot,
    material_value_krw = excluded.material_value_krw,
    labor_value_krw = excluded.labor_value_krw,
    total_value_krw = excluded.total_value_krw,
    breakdown = excluded.breakdown,
    created_at = now();

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'action', case when v_has then 'updated' else 'inserted' end,
    'gold_krw_per_g_snapshot', v_gold_krw_per_g,
    'silver_krw_per_g_snapshot', v_silver_krw_per_g,
    'silver_adjust_factor_snapshot', v_silver_adjust_factor,
    'labor_value_krw', v_labor_value,
    'material_value_krw', v_material_value,
    'total_value_krw', v_total_value
  );
end;
$$;

-- 3) wrapper(v2): 더 이상 1.2를 넘기지 않음 (config가 기본)
create or replace function public.cms_fn_ar_create_from_shipment_confirm_v2(
  p_shipment_id uuid,
  p_pricing_source text default 'AUTO_CONFIRM_V2'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_val jsonb;
  v_ar jsonb;
begin
  -- ✅ factor는 config 기본을 쓰도록 (4번째 인자 전달 안 함)
  v_val := public.cms_fn_shipment_valuation_ensure_v2(p_shipment_id, p_pricing_source);
  v_ar  := public.cms_fn_ar_create_from_shipment_confirm_v1(p_shipment_id);

  return jsonb_build_object('ok', true, 'shipment_id', p_shipment_id, 'valuation', v_val, 'ar', v_ar);
end;
$$;

-- -----------------------------------------------------------------------------
-- Patch: make AR commodity grams use silver correction factor on WEIGHT (not price)
-- and ensure valuation exists for legacy call sites (only when missing)
-- -----------------------------------------------------------------------------

create or replace function public.cms_fn_ar_create_from_shipment_confirm_v1(p_shipment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_hdr public.cms_shipment_header%rowtype;
  v_valuation public.cms_shipment_valuation%rowtype;
  v_inserted int := 0;
  v_updated int := 0;
begin
  select * into v_hdr
  from public.cms_shipment_header
  where shipment_id = p_shipment_id;

  if not found then
    raise exception 'shipment not found: %', p_shipment_id;
  end if;

  if v_hdr.confirmed_at is null then
    raise exception 'shipment not confirmed: %', p_shipment_id;
  end if;
  -- ensure valuation exists if legacy flows skipped pricing lock
  if not exists (
    select 1 from public.cms_shipment_valuation v where v.shipment_id = p_shipment_id
  ) then
    perform public.cms_fn_shipment_valuation_ensure_v2(p_shipment_id, 'AUTO', null, false);
  end if;

select * into v_valuation
  from public.cms_shipment_valuation
  where shipment_id = p_shipment_id;

  if not found then
    raise exception 'shipment valuation not found: %', p_shipment_id;
  end if;

  -- 1) UPDATE existing invoices (idempotent upsert)
  with line_base as (
    select
      v_hdr.customer_party_id as party_id,
      p_shipment_id as shipment_id,
      sl.shipment_line_id,
      v_hdr.confirmed_at as occurred_at,

      coalesce(mi1.is_unit_pricing, mi2.is_unit_pricing, false) as is_unit_pricing,

      greatest(coalesce(sl.total_amount_sell_krw, 0), 0) as total_sell_krw,
      greatest(coalesce(sl.material_amount_sell_krw, 0), 0) as material_amount_sell_krw,

      sl.material_code,
      coalesce(
        sl.net_weight_g,
        greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)
      ) as net_w
    from public.cms_shipment_line sl
    left join public.cms_master_item mi1
      on mi1.master_id = sl.master_id
    left join public.cms_master_item mi2
      on sl.master_id is null
     and sl.model_name is not null
     and trim(sl.model_name) = mi2.model_name
    where sl.shipment_id = p_shipment_id
  ),
  calc as (
    select
      party_id,
      shipment_id,
      shipment_line_id,
      occurred_at,

      -- 단가제면 total을 전부 현금으로
      case
        when is_unit_pricing then total_sell_krw
        else greatest(total_sell_krw - material_amount_sell_krw, 0)
      end as labor_cash_due_krw,

      case
        when is_unit_pricing then null
        when material_code in ('14','18','24') then 'gold'::cms_e_commodity_type
        when material_code in ('925','999')    then 'silver'::cms_e_commodity_type
        else null
      end as commodity_type,

      case
        when is_unit_pricing then 0
        when material_code = '14'  then net_w * 0.6435
        when material_code = '18'  then net_w * 0.825
        when material_code = '24'  then net_w
        when material_code = '925' then net_w * 0.925 * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
        when material_code = '999' then net_w * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
        else 0
      end as commodity_due_g,

      case
        when is_unit_pricing then 0
        when material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
        when material_code in ('925','999')    then coalesce(v_valuation.silver_krw_per_g_snapshot, 0)
        else 0
      end as commodity_price_snapshot_krw_per_g,

      case
        when is_unit_pricing then 0
        else
          (
            case
              when material_code = '14'  then net_w * 0.6435
              when material_code = '18'  then net_w * 0.825
              when material_code = '24'  then net_w
              when material_code = '925' then net_w * 0.925 * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
              when material_code = '999' then net_w * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
              else 0
            end
          )
          *
          (
            case
              when material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
              when material_code in ('925','999')    then coalesce(v_valuation.silver_krw_per_g_snapshot, 0)
              else 0
            end
          )
      end as material_cash_due_krw,

      case
        when is_unit_pricing then total_sell_krw
        else
          (
            greatest(total_sell_krw - material_amount_sell_krw, 0)
            +
            (
              (
                case
                  when material_code = '14'  then net_w * 0.6435
                  when material_code = '18'  then net_w * 0.825
                  when material_code = '24'  then net_w
                  when material_code = '925' then net_w * 0.925 * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
                  when material_code = '999' then net_w * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
                  else 0
                end
              )
              *
              (
                case
                  when material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
                  when material_code in ('925','999')    then coalesce(v_valuation.silver_krw_per_g_snapshot, 0)
                  else 0
                end
              )
            )
          )
      end as total_cash_due_krw
    from line_base
  ),
  upd as (
    update public.cms_ar_invoice ai
    set
      party_id = c.party_id,
      shipment_id = c.shipment_id,
      occurred_at = c.occurred_at,
      labor_cash_due_krw = c.labor_cash_due_krw,
      commodity_type = c.commodity_type,
      commodity_due_g = c.commodity_due_g,
      commodity_price_snapshot_krw_per_g = c.commodity_price_snapshot_krw_per_g,
      material_cash_due_krw = c.material_cash_due_krw,
      total_cash_due_krw = c.total_cash_due_krw
    from calc c
    where ai.shipment_line_id = c.shipment_line_id
    returning 1
  )
  select count(*) into v_updated from upd;

  -- 2) INSERT missing invoices
  with line_base as (
    select
      v_hdr.customer_party_id as party_id,
      p_shipment_id as shipment_id,
      sl.shipment_line_id,
      v_hdr.confirmed_at as occurred_at,

      coalesce(mi1.is_unit_pricing, mi2.is_unit_pricing, false) as is_unit_pricing,

      greatest(coalesce(sl.total_amount_sell_krw, 0), 0) as total_sell_krw,
      greatest(coalesce(sl.material_amount_sell_krw, 0), 0) as material_amount_sell_krw,

      sl.material_code,
      coalesce(
        sl.net_weight_g,
        greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)
      ) as net_w
    from public.cms_shipment_line sl
    left join public.cms_master_item mi1
      on mi1.master_id = sl.master_id
    left join public.cms_master_item mi2
      on sl.master_id is null
     and sl.model_name is not null
     and trim(sl.model_name) = mi2.model_name
    where sl.shipment_id = p_shipment_id
  ),
  calc as (
    select
      party_id,
      shipment_id,
      shipment_line_id,
      occurred_at,

      case
        when is_unit_pricing then total_sell_krw
        else greatest(total_sell_krw - material_amount_sell_krw, 0)
      end as labor_cash_due_krw,

      case
        when is_unit_pricing then null
        when material_code in ('14','18','24') then 'gold'::cms_e_commodity_type
        when material_code in ('925','999')    then 'silver'::cms_e_commodity_type
        else null
      end as commodity_type,

      case
        when is_unit_pricing then 0
        when material_code = '14'  then net_w * 0.6435
        when material_code = '18'  then net_w * 0.825
        when material_code = '24'  then net_w
        when material_code = '925' then net_w * 0.925 * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
        when material_code = '999' then net_w * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
        else 0
      end as commodity_due_g,

      case
        when is_unit_pricing then 0
        when material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
        when material_code in ('925','999')    then coalesce(v_valuation.silver_krw_per_g_snapshot, 0)
        else 0
      end as commodity_price_snapshot_krw_per_g,

      case
        when is_unit_pricing then 0
        else
          (
            case
              when material_code = '14'  then net_w * 0.6435
              when material_code = '18'  then net_w * 0.825
              when material_code = '24'  then net_w
              when material_code = '925' then net_w * 0.925 * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
              when material_code = '999' then net_w * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
              else 0
            end
          )
          *
          (
            case
              when material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
              when material_code in ('925','999')    then coalesce(v_valuation.silver_krw_per_g_snapshot, 0)
              else 0
            end
          )
      end as material_cash_due_krw,

      case
        when is_unit_pricing then total_sell_krw
        else
          (
            greatest(total_sell_krw - material_amount_sell_krw, 0)
            +
            (
              (
                case
                  when material_code = '14'  then net_w * 0.6435
                  when material_code = '18'  then net_w * 0.825
                  when material_code = '24'  then net_w
                  when material_code = '925' then net_w * 0.925 * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
                  when material_code = '999' then net_w * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
                  else 0
                end
              )
              *
              (
                case
                  when material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
                  when material_code in ('925','999')    then coalesce(v_valuation.silver_krw_per_g_snapshot, 0)
                  else 0
                end
              )
            )
          )
      end as total_cash_due_krw
    from line_base
  )
  insert into public.cms_ar_invoice (
    party_id,
    shipment_id,
    shipment_line_id,
    occurred_at,
    labor_cash_due_krw,
    commodity_type,
    commodity_due_g,
    commodity_price_snapshot_krw_per_g,
    material_cash_due_krw,
    total_cash_due_krw
  )
  select
    c.party_id,
    c.shipment_id,
    c.shipment_line_id,
    c.occurred_at,
    c.labor_cash_due_krw,
    c.commodity_type,
    c.commodity_due_g,
    c.commodity_price_snapshot_krw_per_g,
    c.material_cash_due_krw,
    c.total_cash_due_krw
  from calc c
  where not exists (
    select 1 from public.cms_ar_invoice ai
    where ai.shipment_line_id = c.shipment_line_id
  );

  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'updated', v_updated,
    'inserted', v_inserted
  );
end $$;

-- permissions (match existing RPC patterns)
revoke all on function public.cms_fn_ar_create_from_shipment_confirm_v2(uuid, text) from public;
grant execute on function public.cms_fn_ar_create_from_shipment_confirm_v2(uuid, text) to authenticated;
grant execute on function public.cms_fn_ar_create_from_shipment_confirm_v2(uuid, text) to service_role;
