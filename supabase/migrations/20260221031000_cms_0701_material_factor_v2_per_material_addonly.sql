begin;
set search_path = public, pg_temp;

alter table public.cms_material_factor_config
  add column if not exists material_adjust_factor numeric(12,6) not null default 1.0 check (material_adjust_factor >= 0.5 and material_adjust_factor <= 2.0),
  add column if not exists price_basis text not null default 'GOLD' check (price_basis in ('GOLD', 'SILVER', 'NONE')),
  add column if not exists is_active boolean not null default true;

update public.cms_material_factor_config
set
  material_adjust_factor = coalesce(material_adjust_factor, gold_adjust_factor, 1),
  price_basis = case
    when material_code in ('925'::public.cms_e_material_code, '999'::public.cms_e_material_code) then 'SILVER'
    when material_code = '00'::public.cms_e_material_code then 'NONE'
    else 'GOLD'
  end,
  updated_at = now()
where true;

create or replace function public.cms_fn_get_material_factor_v2(
  p_material_code public.cms_e_material_code
)
returns table(purity_rate numeric, material_adjust_factor numeric, price_basis text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    c.purity_rate,
    coalesce(c.material_adjust_factor, c.gold_adjust_factor, 1) as material_adjust_factor,
    coalesce(c.price_basis, case
      when c.material_code in ('925'::public.cms_e_material_code, '999'::public.cms_e_material_code) then 'SILVER'
      when c.material_code = '00'::public.cms_e_material_code then 'NONE'
      else 'GOLD'
    end) as price_basis
  from public.cms_material_factor_config c
  where c.material_code = p_material_code
  union all
  select
    case p_material_code
      when '14'::public.cms_e_material_code then 0.585
      when '18'::public.cms_e_material_code then 0.750
      when '24'::public.cms_e_material_code then 1.000
      when '925'::public.cms_e_material_code then 0.925
      when '999'::public.cms_e_material_code then 1.000
      else 0.000
    end,
    case p_material_code
      when '14'::public.cms_e_material_code then 1.100
      when '18'::public.cms_e_material_code then 1.100
      else 1.000
    end,
    case p_material_code
      when '925'::public.cms_e_material_code then 'SILVER'
      when '999'::public.cms_e_material_code then 'SILVER'
      when '00'::public.cms_e_material_code then 'NONE'
      else 'GOLD'
    end
  where not exists (
    select 1 from public.cms_material_factor_config c where c.material_code = p_material_code
  )
  limit 1;
$$;

create or replace function public.cms_fn_upsert_material_factor_config_v2(
  p_rows jsonb,
  p_actor_person_id uuid default null,
  p_session_id uuid default null,
  p_memo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_code public.cms_e_material_code;
  v_purity numeric;
  v_adjust numeric;
  v_price_basis text;
  v_upserted int := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  for r in
    select * from jsonb_array_elements(p_rows)
  loop
    begin
      v_code := (r.value->>'material_code')::public.cms_e_material_code;
    exception when others then
      raise exception 'invalid material_code: %', r.value->>'material_code';
    end;

    v_purity := coalesce((r.value->>'purity_rate')::numeric, 0);
    v_adjust := coalesce((r.value->>'material_adjust_factor')::numeric, (r.value->>'gold_adjust_factor')::numeric, 1);
    v_price_basis := upper(coalesce(r.value->>'price_basis', case
      when v_code in ('925'::public.cms_e_material_code, '999'::public.cms_e_material_code) then 'SILVER'
      when v_code = '00'::public.cms_e_material_code then 'NONE'
      else 'GOLD'
    end));

    if v_purity < 0 or v_purity > 1 then
      raise exception 'purity_rate out of range (0~1): %', v_purity;
    end if;
    if v_adjust < 0.5 or v_adjust > 2.0 then
      raise exception 'material_adjust_factor out of range (0.5~2.0): %', v_adjust;
    end if;
    if v_price_basis not in ('GOLD', 'SILVER', 'NONE') then
      raise exception 'price_basis must be GOLD/SILVER/NONE: %', v_price_basis;
    end if;

    insert into public.cms_material_factor_config(
      material_code,
      purity_rate,
      material_adjust_factor,
      gold_adjust_factor,
      price_basis,
      is_active,
      updated_at,
      note
    )
    values (
      v_code,
      v_purity,
      v_adjust,
      v_adjust,
      v_price_basis,
      true,
      now(),
      p_memo
    )
    on conflict (material_code) do update
    set purity_rate = excluded.purity_rate,
        material_adjust_factor = excluded.material_adjust_factor,
        gold_adjust_factor = excluded.material_adjust_factor,
        price_basis = excluded.price_basis,
        is_active = excluded.is_active,
        updated_at = now(),
        note = coalesce(excluded.note, public.cms_material_factor_config.note);

    v_upserted := v_upserted + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'upserted', v_upserted,
    'actor_person_id', p_actor_person_id,
    'session_id', p_session_id
  );
end;
$$;

grant execute on function public.cms_fn_upsert_material_factor_config_v2(jsonb,uuid,uuid,text)
  to authenticated, service_role;

alter table public.cms_shipment_line
  add column if not exists material_adjust_factor_snapshot numeric(12,6),
  add column if not exists market_adjust_factor_snapshot numeric(12,6),
  add column if not exists price_basis_snapshot text;

with factor_backfill as (
  select
    sl.shipment_line_id,
    coalesce(mf.purity_rate, 0) as purity_rate,
    coalesce(mf.material_adjust_factor, 1) as material_adjust_factor,
    coalesce(mf.price_basis, 'NONE') as price_basis,
    case
      when coalesce(mf.price_basis, 'NONE') = 'SILVER' then
        case when coalesce(sl.silver_adjust_factor, 0) > 0 then sl.silver_adjust_factor else 1 end
      else 1
    end as market_adjust_factor
  from public.cms_shipment_line sl
  left join lateral public.cms_fn_get_material_factor_v2(sl.material_code) mf on true
)
update public.cms_shipment_line sl
set
  purity_rate_snapshot = coalesce(sl.purity_rate_snapshot, fb.purity_rate),
  material_adjust_factor_snapshot = coalesce(sl.material_adjust_factor_snapshot, fb.material_adjust_factor),
  market_adjust_factor_snapshot = coalesce(sl.market_adjust_factor_snapshot, fb.market_adjust_factor),
  gold_adjust_factor_snapshot = coalesce(sl.gold_adjust_factor_snapshot, fb.material_adjust_factor),
  price_basis_snapshot = coalesce(sl.price_basis_snapshot, fb.price_basis),
  effective_factor_snapshot = coalesce(sl.effective_factor_snapshot, fb.purity_rate * fb.material_adjust_factor * fb.market_adjust_factor)
from factor_backfill fb
where fb.shipment_line_id = sl.shipment_line_id;

create or replace function public.cms_fn_apply_material_factor_snapshot_v1(
  p_shipment_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_valuation public.cms_shipment_valuation%rowtype;
  v_total_sell numeric := 0;
  v_changed int := 0;
begin
  select * into v_valuation
  from public.cms_shipment_valuation
  where shipment_id = p_shipment_id;

  with calc as (
    select
      sl.shipment_line_id,
      sl.material_code,
      coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g,0) - coalesce(sl.deduction_weight_g,0), 0)) as net_w,
      coalesce(mf.purity_rate, 0) as purity_rate,
      coalesce(mf.material_adjust_factor, 1) as material_adjust_factor,
      coalesce(mf.price_basis, 'NONE') as price_basis,
      case
        when coalesce(mf.price_basis, 'NONE') = 'SILVER' then
          case
            when coalesce(sl.silver_adjust_factor, 0) > 0 then sl.silver_adjust_factor
            when coalesce(v_valuation.silver_adjust_factor_snapshot, 0) > 0 then v_valuation.silver_adjust_factor_snapshot
            else 1
          end
        else 1
      end as market_adjust_factor,
      case
        when coalesce(mf.price_basis, 'NONE') = 'GOLD' then coalesce(sl.gold_tick_krw_per_g, v_valuation.gold_krw_per_g_snapshot, 0)
        when coalesce(mf.price_basis, 'NONE') = 'SILVER' then coalesce(sl.silver_tick_krw_per_g, v_valuation.silver_krw_per_g_snapshot, 0)
        else 0
      end as tick_price,
      coalesce(sl.labor_total_sell_krw, 0) as labor_sell,
      coalesce(sl.labor_total_cost_krw, 0) as labor_cost,
      coalesce(sl.plating_amount_sell_krw, 0) as plating_sell,
      coalesce(sl.plating_amount_cost_krw, 0) as plating_cost,
      coalesce(sl.repair_fee_krw, 0) as repair_fee
    from public.cms_shipment_line sl
    left join lateral public.cms_fn_get_material_factor_v2(sl.material_code) mf on true
    where sl.shipment_id = p_shipment_id
  ),
  upd as (
    update public.cms_shipment_line sl
    set
      purity_rate_snapshot = c.purity_rate,
      material_adjust_factor_snapshot = c.material_adjust_factor,
      market_adjust_factor_snapshot = c.market_adjust_factor,
      gold_adjust_factor_snapshot = c.material_adjust_factor,
      price_basis_snapshot = c.price_basis,
      effective_factor_snapshot = (c.purity_rate * c.material_adjust_factor * c.market_adjust_factor),
      material_amount_sell_krw = round(c.net_w * c.tick_price * (c.purity_rate * c.material_adjust_factor * c.market_adjust_factor), 0),
      material_amount_cost_krw = round(c.net_w * c.tick_price * (c.purity_rate * c.material_adjust_factor * c.market_adjust_factor), 0),
      total_amount_sell_krw = round(c.net_w * c.tick_price * (c.purity_rate * c.material_adjust_factor * c.market_adjust_factor), 0)
        + c.labor_sell + c.plating_sell + c.repair_fee,
      total_amount_cost_krw = round(c.net_w * c.tick_price * (c.purity_rate * c.material_adjust_factor * c.market_adjust_factor), 0)
        + c.labor_cost + c.plating_cost,
      price_calc_trace = coalesce(sl.price_calc_trace, '{}'::jsonb) || jsonb_build_object(
        'material_factor_snapshot_applied_at', now(),
        'material_factor_snapshot_note', p_note,
        'material_factor_price_basis', c.price_basis
      )
    from calc c
    where sl.shipment_line_id = c.shipment_line_id
    returning sl.total_amount_sell_krw
  )
  select coalesce(sum(total_amount_sell_krw), 0), count(*)
  into v_total_sell, v_changed
  from upd;

  update public.cms_shipment_valuation
  set
    material_value_krw = (select coalesce(sum(material_amount_sell_krw), 0) from public.cms_shipment_line where shipment_id = p_shipment_id),
    labor_value_krw = (select coalesce(sum(labor_total_sell_krw), 0) from public.cms_shipment_line where shipment_id = p_shipment_id),
    total_value_krw = (select coalesce(sum(total_amount_sell_krw), 0) from public.cms_shipment_line where shipment_id = p_shipment_id),
    breakdown = coalesce(breakdown, '{}'::jsonb) || jsonb_build_object('material_factor_snapshot_applied', true)
  where shipment_id = p_shipment_id;

  perform public.cms_fn_sync_ar_ledger_from_shipment_v1(p_shipment_id, p_note);

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'changed_lines', v_changed,
    'total_sell_krw', (select coalesce(sum(total_amount_sell_krw), 0) from public.cms_shipment_line where shipment_id = p_shipment_id)
  );
end;
$$;

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
  v_factor_cfg numeric;
  v_factor_applied numeric;
begin
  if p_shipment_id is null then
    raise exception 'shipment_id required';
  end if;

  select silver_tick_id into v_silver_tick_id
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

  update public.cms_shipment_line sl
  set silver_adjust_factor = v_factor_applied
  from public.cms_material_factor_config c
  where sl.shipment_id = p_shipment_id
    and sl.material_code = c.material_code
    and coalesce(c.price_basis, 'NONE') = 'SILVER'
    and (sl.silver_adjust_factor is null or sl.silver_adjust_factor <= 0);

  update public.cms_shipment_valuation
  set silver_adjust_factor_snapshot = coalesce(silver_adjust_factor_snapshot, v_factor_applied)
  where shipment_id = p_shipment_id;

  perform public.cms_fn_apply_material_factor_snapshot_v1(p_shipment_id, 'apply_silver_factor_fix_v2');

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'silver_factor_applied', v_factor_applied
  );
end;
$$;

create or replace function public.cms_fn_sync_repair_line_sell_totals_v1(
  p_shipment_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.cms_fn_apply_material_factor_snapshot_v1(p_shipment_id, coalesce(p_note, 'sync_repair_line_sell_totals'));
end;
$$;

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

  select * into v_valuation
  from public.cms_shipment_valuation
  where shipment_id = p_shipment_id;

  if not found then
    raise exception 'shipment valuation not found: %', p_shipment_id;
  end if;

  with line_base as (
    select
      v_hdr.customer_party_id as party_id,
      p_shipment_id as shipment_id,
      sl.shipment_line_id,
      sl.repair_line_id,
      v_hdr.confirmed_at as occurred_at,
      coalesce(mi1.is_unit_pricing, mi2.is_unit_pricing, false) as is_unit_pricing,
      greatest(coalesce(sl.total_amount_sell_krw, 0), 0) as total_sell_krw,
      greatest(coalesce(sl.material_amount_sell_krw, 0), 0) as material_amount_sell_krw,
      greatest(coalesce(sl.repair_fee_krw, 0), 0) as repair_fee_sell_krw,
      sl.material_code,
      coalesce(
        sl.net_weight_g,
        greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)
      ) as net_w,
      coalesce(sl.price_basis_snapshot,
        case
          when sl.material_code in ('14','18','24') then 'GOLD'
          when sl.material_code in ('925','999') then 'SILVER'
          else 'NONE'
        end
      ) as price_basis,
      coalesce(
        sl.effective_factor_snapshot,
        coalesce(sl.purity_rate_snapshot, 0)
          * coalesce(sl.material_adjust_factor_snapshot, sl.gold_adjust_factor_snapshot, 1)
          * coalesce(sl.market_adjust_factor_snapshot, case when coalesce(sl.price_basis_snapshot, 'NONE') = 'SILVER' then nullif(sl.silver_adjust_factor, 0) else 1 end, 1)
      ) as effective_factor
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
      repair_line_id,
      is_unit_pricing,
      total_sell_krw,
      case
        when repair_line_id is not null then repair_fee_sell_krw
        when is_unit_pricing then total_sell_krw
        else greatest(total_sell_krw - material_amount_sell_krw, 0)
      end as labor_cash_due_krw,
      case
        when is_unit_pricing then null
        when price_basis = 'GOLD' then 'gold'::cms_e_commodity_type
        when price_basis = 'SILVER' then 'silver'::cms_e_commodity_type
        else null
      end as commodity_type,
      case
        when is_unit_pricing then 0
        else net_w * coalesce(effective_factor, 0)
      end as commodity_due_g,
      case
        when is_unit_pricing then 0
        when price_basis = 'GOLD' then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
        when price_basis = 'SILVER' then coalesce(v_valuation.silver_krw_per_g_snapshot, 0)
        else 0
      end as commodity_price_snapshot_krw_per_g
    from line_base
  ),
  calc2 as (
    select
      c.*, 
      case
        when c.is_unit_pricing then 0
        else c.commodity_due_g * c.commodity_price_snapshot_krw_per_g
      end as material_cash_due_krw,
      case
        when c.repair_line_id is not null then c.labor_cash_due_krw + (case when c.is_unit_pricing then 0 else c.commodity_due_g * c.commodity_price_snapshot_krw_per_g end)
        when c.is_unit_pricing then c.total_sell_krw
        else c.labor_cash_due_krw + (c.commodity_due_g * c.commodity_price_snapshot_krw_per_g)
      end as total_cash_due_krw
    from calc c
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
    from calc2 c
    where ai.shipment_line_id = c.shipment_line_id
    returning 1
  ),
  ins as (
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
    from calc2 c
    where not exists (
      select 1 from public.cms_ar_invoice ai
      where ai.shipment_line_id = c.shipment_line_id
    )
    returning 1
  )
  select (select count(*) from upd), (select count(*) from ins)
  into v_updated, v_inserted;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'updated', v_updated,
    'inserted', v_inserted
  );
end $$;

commit;
