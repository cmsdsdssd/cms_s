-- 20260209241000_cms_0391_ar_silver_due_g_weight_factor_and_valuation_ensure.sql
-- 목적:
-- 1) CONFIRMED인데 cms_shipment_valuation이 없으면, shipment_line 스냅샷(시세/보정계수)로 valuation을 "자동 생성"
-- 2) AR(invoice)의 silver는 "시세에 보정계수"가 아니라 "순은g(commodity_due_g)에 보정계수"가 반영되도록 강제
--    - 925: net_w * 0.925 * factor
--    - 999: net_w * 1.0   * factor

create or replace function public.cms_fn_ar_create_from_shipment_confirm_v1(p_shipment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_hdr public.cms_shipment_header%rowtype;
  v_valuation public.cms_shipment_valuation%rowtype;

  v_inserted int := 0;
  v_updated int := 0;

  v_cfg_factor numeric;
  v_gold_tick_id uuid;
  v_silver_tick_id uuid;
  v_gold_price numeric;
  v_silver_price numeric;
  v_silver_factor numeric;
  v_priced_at timestamptz;

  v_has_gold_material boolean;
  v_has_silver_material boolean;
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

  -- [A] valuation ensure (CONFIRMED인데 valuation이 없는 데이터가 실제로 존재함)
  select * into v_valuation
  from public.cms_shipment_valuation
  where shipment_id = p_shipment_id;

  if not found then
    -- config factor (하드코딩 1.2 금지. config 값을 그대로 snapshot)
    select c.silver_kr_correction_factor
      into v_cfg_factor
    from public.cms_market_tick_config c
    order by c.created_at desc
    limit 1;

    if v_cfg_factor is null then
      v_cfg_factor := 1; -- 최후 안전장치(하드코딩 1.2 금지)
    end if;

    -- shipment_line에 이미 "confirm 시점 스냅샷"이 들어있으므로 그걸 우선 사용
    select
      max(sl.gold_tick_id)               filter (where sl.gold_tick_id is not null),
      max(sl.silver_tick_id)             filter (where sl.silver_tick_id is not null),
      max(sl.gold_tick_krw_per_g)        filter (where sl.gold_tick_krw_per_g is not null),
      max(sl.silver_tick_krw_per_g)      filter (where sl.silver_tick_krw_per_g is not null),
      max(sl.silver_adjust_factor)       filter (where sl.silver_adjust_factor is not null),
      max(sl.priced_at)                  filter (where sl.priced_at is not null)
    into
      v_gold_tick_id,
      v_silver_tick_id,
      v_gold_price,
      v_silver_price,
      v_silver_factor,
      v_priced_at
    from public.cms_shipment_line sl
    where sl.shipment_id = p_shipment_id;

    if v_silver_factor is null then
      v_silver_factor := v_cfg_factor;
    end if;

    -- tick_id만 있고 price가 없으면 tick에서 보완
    if v_gold_price is null and v_gold_tick_id is not null then
      select t.price into v_gold_price
      from public.cms_market_tick t
      where t.tick_id = v_gold_tick_id;
    end if;

    if v_silver_price is null and v_silver_tick_id is not null then
      select t.price into v_silver_price
      from public.cms_market_tick t
      where t.tick_id = v_silver_tick_id;
    end if;

    select exists (
      select 1 from public.cms_shipment_line sl
      where sl.shipment_id = p_shipment_id
        and sl.material_code in ('14','18','24')
        and coalesce(sl.material_amount_sell_krw, 0) > 0
    ) into v_has_gold_material;

    select exists (
      select 1 from public.cms_shipment_line sl
      where sl.shipment_id = p_shipment_id
        and sl.material_code in ('925','999')
        and coalesce(sl.material_amount_sell_krw, 0) > 0
    ) into v_has_silver_material;

    if v_has_gold_material and v_gold_price is null then
      raise exception 'missing gold price snapshot for valuation (shipment_id=%)', p_shipment_id;
    end if;

    if v_has_silver_material and v_silver_price is null then
      raise exception 'missing silver price snapshot for valuation (shipment_id=%)', p_shipment_id;
    end if;

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
    )
    select
      p_shipment_id,
      coalesce(v_priced_at, v_hdr.confirmed_at, now()),
      'AUTO:AR_CREATE_V1',
      v_gold_tick_id,
      v_silver_tick_id,
      coalesce(v_gold_price, 0),
      coalesce(v_silver_price, 0),
      v_silver_factor,
      sum(greatest(coalesce(sl.material_amount_sell_krw, 0), 0)),
      sum(greatest(coalesce(sl.labor_total_sell_krw, 0), 0)),
      sum(greatest(coalesce(sl.total_amount_sell_krw, 0), 0)),
      jsonb_build_object(
        'source', 'AUTO:AR_CREATE_V1',
        'silver_factor_source', case when (select count(*) from public.cms_shipment_line s2 where s2.shipment_id=p_shipment_id and s2.silver_adjust_factor is not null) > 0 then 'LINE' else 'CONFIG' end,
        'silver_adjust_factor_snapshot', v_silver_factor
      )
    from public.cms_shipment_line sl
    where sl.shipment_id = p_shipment_id
    on conflict (shipment_id) do nothing;

    select * into v_valuation
    from public.cms_shipment_valuation
    where shipment_id = p_shipment_id;

    if not found then
      raise exception 'shipment valuation ensure failed: %', p_shipment_id;
    end if;
  end if;

  -- [B] UPDATE existing invoices (idempotent upsert)
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

      -- ★ 핵심: silver는 "중량"에 보정계수 반영 (시세에는 절대 곱하지 않음)
      case
        when is_unit_pricing then 0
        when material_code = '14'  then net_w * 0.6435
        when material_code = '18'  then net_w * 0.825
        when material_code = '24'  then net_w
        when material_code = '925' then net_w * 0.925 * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
        when material_code = '999' then net_w * 1.000 * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
        else 0
      end as commodity_due_g,

      -- ★ 핵심: snapshot 시세는 tick 그대로 (factor 미적용)
      case
        when is_unit_pricing then 0
        when material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
        when material_code in ('925','999')    then coalesce(v_valuation.silver_krw_per_g_snapshot, 0)
        else 0
      end as commodity_price_snapshot_krw_per_g,

      -- 소재 현금가치 = (보정 반영된 due_g) * (미보정 시세)
      case
        when is_unit_pricing then 0
        else
          (
            case
              when material_code = '14'  then net_w * 0.6435
              when material_code = '18'  then net_w * 0.825
              when material_code = '24'  then net_w
              when material_code = '925' then net_w * 0.925 * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
              when material_code = '999' then net_w * 1.000 * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
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
                  when material_code = '999' then net_w * 1.000 * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
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

  -- [C] INSERT missing invoices
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
        when material_code = '999' then net_w * 1.000 * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
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
              when material_code = '999' then net_w * 1.000 * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
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
                  when material_code = '999' then net_w * 1.000 * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
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
end $function$;
