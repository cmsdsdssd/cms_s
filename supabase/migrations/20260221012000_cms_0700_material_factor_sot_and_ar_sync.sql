begin;
set search_path = public, pg_temp;

create table if not exists public.cms_material_factor_config (
  material_code public.cms_e_material_code primary key,
  purity_rate numeric(12,6) not null check (purity_rate >= 0 and purity_rate <= 1),
  gold_adjust_factor numeric(12,6) not null default 1.0 check (gold_adjust_factor >= 0.5 and gold_adjust_factor <= 2.0),
  updated_at timestamptz not null default now(),
  note text
);

insert into public.cms_material_factor_config (material_code, purity_rate, gold_adjust_factor, note)
values
  ('14', 0.585000, 1.100000, 'seed'),
  ('18', 0.750000, 1.100000, 'seed'),
  ('24', 1.000000, 1.000000, 'seed'),
  ('925', 0.925000, 1.000000, 'seed'),
  ('999', 1.000000, 1.000000, 'seed'),
  ('00', 0.000000, 1.000000, 'seed')
on conflict (material_code) do update
set purity_rate = excluded.purity_rate,
    gold_adjust_factor = excluded.gold_adjust_factor,
    updated_at = now();

grant select on public.cms_material_factor_config to authenticated;
grant select on public.cms_material_factor_config to service_role;

create or replace function public.cms_fn_get_material_factor_v1(
  p_material_code public.cms_e_material_code
)
returns table(purity_rate numeric, gold_adjust_factor numeric)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.purity_rate, c.gold_adjust_factor
  from public.cms_material_factor_config c
  where c.material_code = p_material_code
  union all
  select
    case p_material_code
      when '14'::public.cms_e_material_code then 0.585
      when '18'::public.cms_e_material_code then 0.750
      when '24'::public.cms_e_material_code then 1.000
      when '925'::public.cms_e_material_code then 925::numeric / 1000::numeric
      when '999'::public.cms_e_material_code then 1.000
      else 0.000
    end,
    case p_material_code
      when '14'::public.cms_e_material_code then 1.100
      when '18'::public.cms_e_material_code then 1.100
      else 1.000
    end
  where not exists (
    select 1 from public.cms_material_factor_config c where c.material_code = p_material_code
  )
  limit 1;
$$;

create or replace function public.cms_fn_upsert_material_factor_config_v1(
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
  v_gold_adjust numeric;
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
    v_gold_adjust := coalesce((r.value->>'gold_adjust_factor')::numeric, 1);

    if v_purity < 0 or v_purity > 1 then
      raise exception 'purity_rate out of range (0~1): %', v_purity;
    end if;
    if v_gold_adjust < 0.5 or v_gold_adjust > 2.0 then
      raise exception 'gold_adjust_factor out of range (0.5~2.0): %', v_gold_adjust;
    end if;

    insert into public.cms_material_factor_config(material_code, purity_rate, gold_adjust_factor, updated_at, note)
    values (v_code, v_purity, v_gold_adjust, now(), p_memo)
    on conflict (material_code) do update
    set purity_rate = excluded.purity_rate,
        gold_adjust_factor = excluded.gold_adjust_factor,
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

grant execute on function public.cms_fn_upsert_material_factor_config_v1(jsonb,uuid,uuid,text)
  to authenticated, service_role;

alter table public.cms_shipment_line
  add column if not exists purity_rate_snapshot numeric(12,6),
  add column if not exists gold_adjust_factor_snapshot numeric(12,6),
  add column if not exists effective_factor_snapshot numeric(12,6);

with factor_backfill as (
  select
    sl.shipment_line_id,
    sl.material_code,
    coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) as net_w,
    coalesce(mf.purity_rate, 0) as purity_rate,
    coalesce(mf.gold_adjust_factor, 1) as gold_adjust_factor,
    case
      when sl.material_code in ('925'::public.cms_e_material_code,'999'::public.cms_e_material_code)
        then case when coalesce(sl.silver_adjust_factor, 0) > 0 then sl.silver_adjust_factor else 1 end
      when sl.material_code in ('14'::public.cms_e_material_code,'18'::public.cms_e_material_code,'24'::public.cms_e_material_code)
        then coalesce(mf.gold_adjust_factor, 1)
      else 1
    end as adjust_applied
  from public.cms_shipment_line sl
  left join lateral public.cms_fn_get_material_factor_v1(sl.material_code) mf on true
)
update public.cms_shipment_line sl
set
  purity_rate_snapshot = coalesce(sl.purity_rate_snapshot, fb.purity_rate),
  gold_adjust_factor_snapshot = coalesce(sl.gold_adjust_factor_snapshot, fb.gold_adjust_factor),
  effective_factor_snapshot = coalesce(sl.effective_factor_snapshot, fb.purity_rate * fb.adjust_applied)
from factor_backfill fb
where fb.shipment_line_id = sl.shipment_line_id
  and (sl.purity_rate_snapshot is null or sl.gold_adjust_factor_snapshot is null or sl.effective_factor_snapshot is null);

create or replace function public.cms_fn_sync_ar_ledger_from_shipment_v1(
  p_shipment_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hdr public.cms_shipment_header%rowtype;
  v_total_sell numeric := 0;
  v_total_weight numeric := 0;
  v_total_labor numeric := 0;
  v_affected int := 0;
begin
  select * into v_hdr
  from public.cms_shipment_header
  where shipment_id = p_shipment_id;

  if not found then
    raise exception 'shipment not found: %', p_shipment_id;
  end if;

  select
    coalesce(sum(total_amount_sell_krw), 0),
    coalesce(sum(net_weight_g), 0),
    coalesce(sum(labor_total_sell_krw), 0)
  into v_total_sell, v_total_weight, v_total_labor
  from public.cms_shipment_line
  where shipment_id = p_shipment_id;

  update public.cms_ar_ledger
  set
    amount_krw = v_total_sell,
    total_weight_g = v_total_weight,
    total_labor_krw = v_total_labor,
    memo = coalesce(p_note, memo)
  where entry_type = 'SHIPMENT'
    and shipment_id = p_shipment_id;

  get diagnostics v_affected = row_count;

  if v_affected = 0 then
    insert into public.cms_ar_ledger(
      party_id,
      occurred_at,
      entry_type,
      amount_krw,
      shipment_id,
      memo,
      total_weight_g,
      total_labor_krw
    )
    values (
      v_hdr.customer_party_id,
      coalesce(v_hdr.confirmed_at, now()),
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
    'ledger_total_krw', v_total_sell
  );
end;
$$;

create or replace function public.cms_fn_verify_shipment_ar_consistency_v1(
  p_shipment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ship_total numeric := 0;
  v_ar_total numeric := 0;
  v_diff numeric := 0;
begin
  select coalesce(sum(sl.total_amount_sell_krw), 0)
  into v_ship_total
  from public.cms_shipment_line sl
  where sl.shipment_id = p_shipment_id;

  select coalesce(sum(l.amount_krw), 0)
  into v_ar_total
  from public.cms_ar_ledger l
  where l.entry_type = 'SHIPMENT'
    and l.shipment_id = p_shipment_id;

  v_diff := v_ship_total - v_ar_total;

  if v_diff <> 0 then
    perform public.cms_fn_sync_ar_ledger_from_shipment_v1(p_shipment_id, 'auto-sync from verify');

    select coalesce(sum(l.amount_krw), 0)
    into v_ar_total
    from public.cms_ar_ledger l
    where l.entry_type = 'SHIPMENT'
      and l.shipment_id = p_shipment_id;

    v_diff := v_ship_total - v_ar_total;
  end if;

  if v_diff <> 0 then
    raise exception 'shipment/ar mismatch remains after sync (shipment_id=%, diff=%)', p_shipment_id, v_diff;
  end if;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'ship_total', v_ship_total,
    'ar_total', v_ar_total,
    'diff', v_diff
  );
end;
$$;

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
      coalesce(mf.gold_adjust_factor, 1) as gold_adjust_factor,
      case
        when sl.material_code in ('925'::public.cms_e_material_code,'999'::public.cms_e_material_code)
          then case
            when coalesce(sl.silver_adjust_factor, 0) > 0 then sl.silver_adjust_factor
            when coalesce(v_valuation.silver_adjust_factor_snapshot, 0) > 0 then v_valuation.silver_adjust_factor_snapshot
            else 1
          end
        when sl.material_code in ('14'::public.cms_e_material_code,'18'::public.cms_e_material_code,'24'::public.cms_e_material_code)
          then coalesce(mf.gold_adjust_factor, 1)
        else 1
      end as adjust_applied,
      case
        when sl.material_code in ('14'::public.cms_e_material_code,'18'::public.cms_e_material_code,'24'::public.cms_e_material_code)
          then coalesce(sl.gold_tick_krw_per_g, v_valuation.gold_krw_per_g_snapshot, 0)
        when sl.material_code in ('925'::public.cms_e_material_code,'999'::public.cms_e_material_code)
          then coalesce(sl.silver_tick_krw_per_g, v_valuation.silver_krw_per_g_snapshot, 0)
        else 0
      end as tick_price,
      coalesce(sl.labor_total_sell_krw, 0) as labor_sell,
      coalesce(sl.labor_total_cost_krw, 0) as labor_cost,
      coalesce(sl.plating_amount_sell_krw, 0) as plating_sell,
      coalesce(sl.plating_amount_cost_krw, 0) as plating_cost,
      coalesce(sl.repair_fee_krw, 0) as repair_fee
    from public.cms_shipment_line sl
    left join lateral public.cms_fn_get_material_factor_v1(sl.material_code) mf on true
    where sl.shipment_id = p_shipment_id
  ),
  upd as (
    update public.cms_shipment_line sl
    set
      purity_rate_snapshot = c.purity_rate,
      gold_adjust_factor_snapshot = c.gold_adjust_factor,
      effective_factor_snapshot = (c.purity_rate * c.adjust_applied),
      material_amount_sell_krw = round(c.net_w * c.tick_price * (c.purity_rate * c.adjust_applied), 0),
      material_amount_cost_krw = round(c.net_w * c.tick_price * (c.purity_rate * c.adjust_applied), 0),
      total_amount_sell_krw = round(c.net_w * c.tick_price * (c.purity_rate * c.adjust_applied), 0)
        + c.labor_sell + c.plating_sell + c.repair_fee,
      total_amount_cost_krw = round(c.net_w * c.tick_price * (c.purity_rate * c.adjust_applied), 0)
        + c.labor_cost + c.plating_cost,
      price_calc_trace = coalesce(sl.price_calc_trace, '{}'::jsonb) || jsonb_build_object(
        'material_factor_snapshot_applied_at', now(),
        'material_factor_snapshot_note', p_note
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

  update public.cms_shipment_line
  set silver_adjust_factor = v_factor_applied
  where shipment_id = p_shipment_id
    and material_code in ('925'::public.cms_e_material_code, '999'::public.cms_e_material_code);

  update public.cms_shipment_valuation
  set silver_adjust_factor_snapshot = v_factor_applied
  where shipment_id = p_shipment_id;

  perform public.cms_fn_apply_material_factor_snapshot_v1(p_shipment_id, 'apply_silver_factor_fix');

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
      coalesce(
        sl.effective_factor_snapshot,
        case
          when sl.material_code in ('925'::public.cms_e_material_code,'999'::public.cms_e_material_code)
            then coalesce(sl.purity_rate_snapshot, 0) * case when coalesce(sl.silver_adjust_factor, 0) > 0 then sl.silver_adjust_factor else 1 end
          else coalesce(sl.purity_rate_snapshot, 0) * coalesce(sl.gold_adjust_factor_snapshot, 1)
        end
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
      case
        when repair_line_id is not null then repair_fee_sell_krw
        when is_unit_pricing then total_sell_krw
        else greatest(total_sell_krw - material_amount_sell_krw, 0)
      end as labor_cash_due_krw,
      case
        when is_unit_pricing then null
        when material_code in ('14','18','24') then 'gold'::cms_e_commodity_type
        when material_code in ('925','999') then 'silver'::cms_e_commodity_type
        else null
      end as commodity_type,
      case
        when is_unit_pricing then 0
        else net_w * coalesce(effective_factor, 0)
      end as commodity_due_g,
      case
        when is_unit_pricing then 0
        when material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
        when material_code in ('925','999') then coalesce(v_valuation.silver_krw_per_g_snapshot, 0)
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
    from (
      select c.*, lb.repair_line_id, lb.is_unit_pricing, lb.total_sell_krw
      from calc c
      join line_base lb on lb.shipment_line_id = c.shipment_line_id
    ) c
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

  begin
    perform public.cms_fn_apply_unit_pricing_floor_v1(p_shipment_id, p_actor_person_id, p_note);
  exception when undefined_function then
    null;
  end;

  perform public.cms_fn_apply_rule_rounding_by_master_unit_pricing_v1(p_shipment_id, p_actor_person_id, p_note);
  perform public.cms_fn_sync_repair_line_sell_totals_v1(p_shipment_id, p_note);
  perform public.cms_fn_sync_ar_ledger_from_shipment_v1(p_shipment_id, p_note);
  perform public.cms_fn_verify_shipment_ar_consistency_v1(p_shipment_id);
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
    return v_confirm || jsonb_build_object('purchase_cost', v_cost, 'correlation_id', v_corr);
  end if;

  return v_confirm || jsonb_build_object('correlation_id', v_corr);
end $$;

commit;
