-- supabase/migrations/20260209000000_cms_0361_unit_pricing_policy_min_margin_round_5000.sql
-- ADD-ONLY. Purpose:
-- 1) Global UNIT pricing floor policy (min margin + KRW rounding) via cms_market_tick_config(DEFAULT)
-- 2) Fix cms_fn_apply_silver_factor_fix_v1 so it does NOT clobber UNIT/MANUAL totals and does not double-count repair_fee
-- 3) Apply UNIT pricing floor for ANY material_code (incl '00') after silver factor fix and before AR invoice upsert
--    final_sell = greatest(unit_total_sell, round_up(cost_basis*(1+min_margin_rate), rounding_unit), material_floor)
--    where:
--      unit_total_sell = (unit_price_krw*qty OR manual_total_amount_krw) + (plating if unit_price_includes_plating=false) + repair_fee_krw
--      cost_basis = coalesce(purchase_total_cost_krw, material_amount_cost_krw + labor_total_cost_krw) + plating_amount_cost_krw
--      material_floor = material_amount_sell_krw  (prevents negative labor cash due)

begin;
set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- (A) Global policy config (DEFAULT row in cms_market_tick_config)
-- ---------------------------------------------------------------------
alter table public.cms_market_tick_config
  add column if not exists unit_pricing_min_margin_rate numeric(12,6),
  add column if not exists unit_pricing_rounding_unit_krw integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cms_market_tick_config_unit_pricing_min_margin_rate_range') then
    alter table public.cms_market_tick_config
      add constraint cms_market_tick_config_unit_pricing_min_margin_rate_range
      check (unit_pricing_min_margin_rate is null or (unit_pricing_min_margin_rate >= 0.000000 and unit_pricing_min_margin_rate <= 3.000000));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cms_market_tick_config_unit_pricing_rounding_unit_range') then
    alter table public.cms_market_tick_config
      add constraint cms_market_tick_config_unit_pricing_rounding_unit_range
      check (unit_pricing_rounding_unit_krw is null or (unit_pricing_rounding_unit_krw > 0 and unit_pricing_rounding_unit_krw <= 1000000));
  end if;
end $$;

-- Seed defaults if missing (idempotent)
insert into public.cms_market_tick_config(
  config_key,
  fx_markup,
  cs_correction_factor,
  silver_kr_correction_factor,
  unit_pricing_min_margin_rate,
  unit_pricing_rounding_unit_krw,
  updated_at
)
select
  'DEFAULT',
  1.030000,
  1.000000,
  1.200000,
  0.200000,
  5000,
  now()
where not exists (select 1 from public.cms_market_tick_config where config_key = 'DEFAULT');

update public.cms_market_tick_config
set
  unit_pricing_min_margin_rate = coalesce(unit_pricing_min_margin_rate, 0.200000),
  unit_pricing_rounding_unit_krw = coalesce(unit_pricing_rounding_unit_krw, 5000)
where config_key = 'DEFAULT';

comment on column public.cms_market_tick_config.unit_pricing_min_margin_rate is
  'Minimum margin rate used as floor for UNIT/MANUAL pricing: floor = cost_basis*(1+rate).';
comment on column public.cms_market_tick_config.unit_pricing_rounding_unit_krw is
  'Rounding unit (KRW) for UNIT/MANUAL floor. Floor is rounded UP to nearest unit (e.g., 5000).';

-- ---------------------------------------------------------------------
-- (B) Helper: round UP to KRW unit
-- ---------------------------------------------------------------------
create or replace function public.cms_fn_round_up_krw_v1(
  p_amount numeric,
  p_unit_krw integer default 5000
) returns numeric
language sql
immutable
as $$
  select
    case
      when p_amount is null then null
      when p_unit_krw is null or p_unit_krw <= 0 then ceil(p_amount)
      else ceil(p_amount / (p_unit_krw::numeric)) * (p_unit_krw::numeric)
    end;
$$;

grant execute on function public.cms_fn_round_up_krw_v1(numeric, integer)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- (C) RPC: set global policy on DEFAULT row
-- ---------------------------------------------------------------------
create or replace function public.cms_fn_set_unit_pricing_policy_v1(
  p_min_margin_rate numeric,
  p_rounding_unit_krw integer default 5000,
  p_actor_person_id uuid default null,
  p_session_id uuid default null,
  p_memo text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_min numeric(12,6);
  v_unit integer;
begin
  v_min := round(coalesce(p_min_margin_rate, 0)::numeric, 6);
  v_unit := coalesce(p_rounding_unit_krw, 5000);

  if v_min < 0.000000 or v_min > 3.000000 then
    raise exception 'unit_pricing_min_margin_rate out of range (0..3): %', v_min;
  end if;
  if v_unit <= 0 or v_unit > 1000000 then
    raise exception 'unit_pricing_rounding_unit_krw out of range (1..1000000): %', v_unit;
  end if;

  insert into public.cms_market_tick_config(
    config_key,
    unit_pricing_min_margin_rate,
    unit_pricing_rounding_unit_krw,
    updated_at
  )
  values ('DEFAULT', v_min, v_unit, now())
  on conflict (config_key) do update set
    unit_pricing_min_margin_rate = excluded.unit_pricing_min_margin_rate,
    unit_pricing_rounding_unit_krw = excluded.unit_pricing_rounding_unit_krw,
    updated_at = now();

  -- best-effort audit log
  begin
    insert into public.cms_audit_log(event, actor_person_id, session_id, memo, payload)
    values (
      'unit_pricing_policy_upsert',
      p_actor_person_id,
      p_session_id,
      p_memo,
      jsonb_build_object(
        'config_key','DEFAULT',
        'unit_pricing_min_margin_rate', v_min,
        'unit_pricing_rounding_unit_krw', v_unit
      )
    );
  exception when others then
    null;
  end;

  return jsonb_build_object(
    'ok', true,
    'config_key', 'DEFAULT',
    'unit_pricing_min_margin_rate', v_min,
    'unit_pricing_rounding_unit_krw', v_unit
  );
end $$;

grant execute on function public.cms_fn_set_unit_pricing_policy_v1(numeric, integer, uuid, uuid, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- (D) Patch: silver factor fix must NOT clobber UNIT/MANUAL totals,
--            and must NOT double-count repair_fee.
-- ---------------------------------------------------------------------
create or replace function public.cms_fn_apply_silver_factor_fix_v1(
  p_shipment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_silver_tick_id uuid;
  v_silver_symbol public.cms_e_market_symbol;
  v_silver_price numeric;
  v_factor_cfg numeric;
  v_factor_applied numeric;

  v_total_sell numeric := 0;
  v_total_cost numeric := 0;
  v_total_weight numeric := 0;
  v_total_labor numeric := 0;
begin
  if p_shipment_id is null then
    raise exception 'shipment_id required';
  end if;

  select silver_tick_id, silver_krw_per_g_snapshot
    into v_silver_tick_id, v_silver_price
  from public.cms_shipment_valuation
  where shipment_id = p_shipment_id;

  if v_silver_tick_id is not null then
    select symbol into v_silver_symbol
    from public.cms_market_tick
    where tick_id = v_silver_tick_id;
  end if;

  select coalesce(c.silver_kr_correction_factor, c.cs_correction_factor, 1.2)
    into v_factor_cfg
  from public.cms_market_tick_config c
  where c.config_key = 'DEFAULT'
  limit 1;

  if v_silver_symbol = 'SILVER_CN_KRW_PER_G'::public.cms_e_market_symbol then
    v_factor_applied := 1.0;
  else
    v_factor_applied := coalesce(v_factor_cfg, 1.2);
  end if;

  -- Update only silver lines. Keep total_amount_sell_krw for UNIT/MANUAL/AMOUNT_ONLY.
  update public.cms_shipment_line sl
  set
    silver_adjust_factor = v_factor_applied,

    material_amount_sell_krw = round(
      coalesce(sl.silver_tick_krw_per_g, v_silver_price, 0)
      * (case when sl.material_code = '925'::public.cms_e_material_code then 0.925 else 1.0 end)
      * v_factor_applied
      * coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g,0) - coalesce(sl.deduction_weight_g,0),0))
    , 0),

    material_amount_cost_krw = round(
      coalesce(sl.silver_tick_krw_per_g, v_silver_price, 0)
      * (case when sl.material_code = '925'::public.cms_e_material_code then 0.925 else 1.0 end)
      * v_factor_applied
      * coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g,0) - coalesce(sl.deduction_weight_g,0),0))
    , 0),

    total_amount_cost_krw =
      coalesce(sl.labor_total_cost_krw,0)
      + coalesce(sl.plating_amount_cost_krw,0)
      + round(
          coalesce(sl.silver_tick_krw_per_g, v_silver_price, 0)
          * (case when sl.material_code = '925'::public.cms_e_material_code then 0.925 else 1.0 end)
          * v_factor_applied
          * coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g,0) - coalesce(sl.deduction_weight_g,0),0))
        , 0),

    total_amount_sell_krw =
      case
        when sl.pricing_mode::text in ('UNIT','MANUAL','AMOUNT_ONLY') then sl.total_amount_sell_krw
        else
          (
            coalesce(sl.labor_total_sell_krw,0)
            + coalesce(sl.plating_amount_sell_krw,0)
            + round(
                coalesce(sl.silver_tick_krw_per_g, v_silver_price, 0)
                * (case when sl.material_code = '925'::public.cms_e_material_code then 0.925 else 1.0 end)
                * v_factor_applied
                * coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g,0) - coalesce(sl.deduction_weight_g,0),0))
              , 0)
            + case
                when coalesce((sl.price_calc_trace->>'repair_fee_included')::boolean, false) then 0
                else coalesce(sl.repair_fee_krw,0)
              end
          )
      end,

    price_calc_trace = coalesce(sl.price_calc_trace,'{}'::jsonb)
      || jsonb_build_object(
        'silver_factor_applied_override', v_factor_applied,
        'silver_factor_source', case when v_silver_symbol = 'SILVER_CN_KRW_PER_G'::public.cms_e_market_symbol then 'CN_TICK' else 'CONFIG' end,
        'silver_factor_applied_at', now()
      )
  where sl.shipment_id = p_shipment_id
    and sl.material_code in ('925'::public.cms_e_material_code, '999'::public.cms_e_material_code);

  select
    coalesce(sum(total_amount_sell_krw),0),
    coalesce(sum(total_amount_cost_krw),0),
    coalesce(sum(net_weight_g),0),
    coalesce(sum(labor_total_sell_krw),0)
  into v_total_sell, v_total_cost, v_total_weight, v_total_labor
  from public.cms_shipment_line
  where shipment_id = p_shipment_id;

  update public.cms_shipment_valuation
  set
    silver_adjust_factor_snapshot = v_factor_applied,
    material_value_krw = (select coalesce(sum(material_amount_sell_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id),
    labor_value_krw = (select coalesce(sum(labor_total_sell_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id),
    total_value_krw = v_total_sell,
    breakdown = coalesce(breakdown, '{}'::jsonb) || jsonb_build_object(
      'silver_factor_applied_override', v_factor_applied,
      'silver_factor_source', case when v_silver_symbol = 'SILVER_CN_KRW_PER_G'::public.cms_e_market_symbol then 'CN_TICK' else 'CONFIG' end
    )
  where shipment_id = p_shipment_id;

  update public.cms_ar_ledger
  set
    amount_krw = v_total_sell,
    total_weight_g = v_total_weight,
    total_labor_krw = v_total_labor
  where entry_type = 'SHIPMENT'
    and shipment_id = p_shipment_id;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'silver_factor_applied', v_factor_applied,
    'total_sell_krw', v_total_sell,
    'total_cost_krw', v_total_cost
  );
end $$;

-- ---------------------------------------------------------------------
-- (E) Apply UNIT/MANUAL pricing floor AFTER silver fix (so silver is correct),
--     and BEFORE AR invoice upsert (so AR reflects final total).
-- ---------------------------------------------------------------------
create or replace function public.cms_fn_apply_unit_pricing_floor_v1(
  p_shipment_id uuid,
  p_actor_person_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_min_margin numeric := 0.200000;
  v_round_unit integer := 5000;

  v_updated_lines int := 0;

  v_total_sell numeric := 0;
  v_total_cost numeric := 0;
  v_total_weight numeric := 0;
  v_total_labor numeric := 0;
begin
  if p_shipment_id is null then
    raise exception 'shipment_id required';
  end if;

  select
    coalesce(unit_pricing_min_margin_rate, 0.200000),
    coalesce(unit_pricing_rounding_unit_krw, 5000)
  into v_min_margin, v_round_unit
  from public.cms_market_tick_config
  where config_key = 'DEFAULT'
  limit 1;

  with cfg as (
    select v_min_margin::numeric as min_margin, v_round_unit::integer as round_unit
  ),
  calc as (
    select
      sl.shipment_line_id,
      sl.total_amount_sell_krw as before_total_sell,

      -- unit_base: unit_price*qty else manual_total_amount
      (
        case
          when sl.unit_price_krw is not null then round(sl.unit_price_krw * sl.qty, 0)
          else round(coalesce(sl.manual_total_amount_krw, 0), 0)
        end
        +
        case
          when coalesce(sl.unit_price_includes_plating, true) = false then coalesce(sl.plating_amount_sell_krw,0)
          else 0
        end
      ) as unit_base_sell,

      -- unit_total includes repair fee always (repair fee is explicit on the line)
      (
        (
          case
            when sl.unit_price_krw is not null then round(sl.unit_price_krw * sl.qty, 0)
            else round(coalesce(sl.manual_total_amount_krw, 0), 0)
          end
          +
          case
            when coalesce(sl.unit_price_includes_plating, true) = false then coalesce(sl.plating_amount_sell_krw,0)
            else 0
          end
        )
        + coalesce(sl.repair_fee_krw,0)
      ) as unit_total_sell,

      -- cost basis for margin floor
      (
        coalesce(
          sl.purchase_total_cost_krw,
          coalesce(sl.material_amount_cost_krw,0) + coalesce(sl.labor_total_cost_krw,0)
        )
        + coalesce(sl.plating_amount_cost_krw,0)
      ) as cost_basis_krw,

      coalesce(sl.material_amount_sell_krw,0) as material_floor_krw,
      coalesce(sl.material_amount_sell_krw,0) as material_amount_sell_krw,
      coalesce(sl.plating_amount_sell_krw,0) as plating_amount_sell_krw,
      coalesce(sl.labor_total_sell_krw,0) as labor_total_sell_before,
      coalesce(sl.labor_base_sell_krw,0) as labor_base_sell_before,

      cfg.min_margin,
      cfg.round_unit
    from public.cms_shipment_line sl
    cross join cfg
    where sl.shipment_id = p_shipment_id
      and sl.pricing_mode::text in ('UNIT','MANUAL') -- robust across enum variants
  ),
  calc2 as (
    select
      c.*,
      (c.cost_basis_krw * (1 + c.min_margin)) as floor_raw_krw,
      public.cms_fn_round_up_krw_v1((c.cost_basis_krw * (1 + c.min_margin)), c.round_unit) as floor_rounded_krw,
      greatest(c.unit_total_sell, public.cms_fn_round_up_krw_v1((c.cost_basis_krw * (1 + c.min_margin)), c.round_unit), c.material_floor_krw) as final_sell_krw,
      greatest(greatest(c.unit_total_sell, public.cms_fn_round_up_krw_v1((c.cost_basis_krw * (1 + c.min_margin)), c.round_unit), c.material_floor_krw)
               - c.material_amount_sell_krw - c.plating_amount_sell_krw, 0) as labor_total_sell_new
    from calc c
  ),
  upd as (
    update public.cms_shipment_line sl
    set
      total_amount_sell_krw = c.final_sell_krw,

      -- keep component sums sane by pushing delta into labor_base_sell_krw
      labor_base_sell_krw = sl.labor_base_sell_krw + (c.labor_total_sell_new - coalesce(sl.labor_total_sell_krw,0)),
      labor_total_sell_krw = c.labor_total_sell_new,

      price_calc_trace = coalesce(sl.price_calc_trace,'{}'::jsonb)
        || jsonb_build_object(
          'unit_pricing_floor_applied', true,
          'unit_pricing_floor_applied_at', now(),
          'unit_pricing_min_margin_rate', c.min_margin,
          'unit_pricing_rounding_unit_krw', c.round_unit,
          'unit_pricing_unit_total_sell_krw', c.unit_total_sell,
          'unit_pricing_floor_raw_krw', c.floor_raw_krw,
          'unit_pricing_floor_rounded_krw', c.floor_rounded_krw,
          'unit_pricing_before_total_sell_krw', c.before_total_sell,
          'unit_pricing_after_total_sell_krw', c.final_sell_krw
        ),

      priced_at = coalesce(sl.priced_at, now()),
      is_priced_final = true,

      updated_at = now()
    from calc2 c
    where sl.shipment_line_id = c.shipment_line_id
      and (
      coalesce(sl.total_amount_sell_krw,0) <> coalesce(c.final_sell_krw,0)
      or coalesce(sl.labor_total_sell_krw,0) <> coalesce(c.labor_total_sell_new,0)
    )
    returning 1
  )
  select count(*) into v_updated_lines from upd;

  -- Update totals for valuation + AR ledger
  select
    coalesce(sum(total_amount_sell_krw),0),
    coalesce(sum(total_amount_cost_krw),0),
    coalesce(sum(net_weight_g),0),
    coalesce(sum(labor_total_sell_krw),0)
  into v_total_sell, v_total_cost, v_total_weight, v_total_labor
  from public.cms_shipment_line
  where shipment_id = p_shipment_id;

  update public.cms_shipment_valuation
  set
    material_value_krw = (select coalesce(sum(material_amount_sell_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id),
    labor_value_krw = (select coalesce(sum(labor_total_sell_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id),
    total_value_krw = v_total_sell,
    breakdown = coalesce(breakdown, '{}'::jsonb) || jsonb_build_object(
      'unit_pricing_floor', jsonb_build_object(
        'min_margin_rate', v_min_margin,
        'rounding_unit_krw', v_round_unit,
        'updated_lines', v_updated_lines
      )
    )
  where shipment_id = p_shipment_id;

  update public.cms_ar_ledger
  set
    amount_krw = v_total_sell,
    total_weight_g = v_total_weight,
    total_labor_krw = v_total_labor,
    memo = coalesce(memo, p_note)
  where entry_type = 'SHIPMENT'
    and shipment_id = p_shipment_id;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'updated_lines', v_updated_lines,
    'unit_pricing_min_margin_rate', v_min_margin,
    'unit_pricing_rounding_unit_krw', v_round_unit,
    'total_sell_krw', v_total_sell,
    'total_cost_krw', v_total_cost
  );
end $$;

grant execute on function public.cms_fn_apply_unit_pricing_floor_v1(uuid, uuid, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- (F) Hook into confirm_shipment_v3_cost_v1 (single entrypoint)
-- ---------------------------------------------------------------------
create or replace function public.cms_fn_confirm_shipment_v3_cost_v1(
  p_shipment_id uuid,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_emit_inventory boolean default true,
  p_correlation_id uuid default null,
  p_cost_mode text default 'PROVISIONAL',
  p_receipt_id uuid default null,
  p_cost_lines jsonb default '[]'::jsonb,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_corr uuid := coalesce(p_correlation_id, gen_random_uuid());
  v_confirm jsonb;
  v_cost jsonb;
  v_mode text := upper(coalesce(p_cost_mode,'PROVISIONAL'));
  v_emit uuid;
begin
  v_confirm := public.cms_fn_confirm_shipment(p_shipment_id, p_actor_person_id, p_note);

  perform public.cms_fn_apply_repair_fee_to_shipment_v1(p_shipment_id, p_note);

  if v_mode <> 'SKIP' then
    v_cost := public.cms_fn_apply_purchase_cost_to_shipment_v1(
      p_shipment_id,
      v_mode,
      p_receipt_id,
      coalesce(p_cost_lines,'[]'::jsonb),
      p_actor_person_id,
      p_note,
      v_corr,
      p_force
    );
  end if;

  perform public.cms_fn_apply_silver_factor_fix_v1(p_shipment_id);

  -- NEW: apply UNIT/MANUAL floor after silver fix and before AR invoice upsert
  perform public.cms_fn_apply_unit_pricing_floor_v1(p_shipment_id, p_actor_person_id, p_note);

  perform public.cms_fn_ar_create_from_shipment_confirm_v1(p_shipment_id);

  if p_emit_inventory then
    v_emit := public.cms_fn_emit_inventory_issue_from_shipment_confirmed_v2(
      p_shipment_id,
      p_actor_person_id,
      p_note,
      v_corr
    );

    v_confirm := v_confirm
      || jsonb_build_object(
        'inventory_emit', v_emit,
        'inventory_correlation_id', v_corr
      );
  end if;

  if v_mode <> 'SKIP' then
    return v_confirm
      || jsonb_build_object('purchase_cost', v_cost, 'correlation_id', v_corr);
  end if;

  return v_confirm
    || jsonb_build_object('correlation_id', v_corr);
end $$;

alter function public.cms_fn_confirm_shipment_v3_cost_v1(uuid,uuid,text,boolean,uuid,text,uuid,jsonb,boolean)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_confirm_shipment_v3_cost_v1(uuid,uuid,text,boolean,uuid,text,uuid,jsonb,boolean)
  to authenticated, service_role;

commit;
