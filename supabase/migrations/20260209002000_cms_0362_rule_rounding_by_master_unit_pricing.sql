-- supabase/migrations/20260209002000_cms_0362_rule_rounding_by_master_unit_pricing.sql
-- ADD-ONLY / idempotent.
-- 목적:
-- 1) cms_master_item에 "단가제 체크" 컬럼 추가 (is_unit_pricing)
-- 2) RULE(중량*시세+공임) 라인 중, master.is_unit_pricing=true 인 라인만
--    확정 시점에 "올림 단위"로 판매가(total_amount_sell_krw)를 올림 처리
-- 3) 올림 단위는 cms_market_tick_config(DEFAULT)에서 글로벌로 설정 가능
-- 4) 총액 덮어쓰기(AMOUNT_ONLY 또는 manual_total_amount_krw 존재) 라인은 올림 미적용
-- 5) confirm 체인(cms_fn_confirm_shipment_v3_cost_v1)에 훅 추가: AR 생성 직전에 적용

begin;
set search_path = public, pg_temp;
----------------------------------------------------------------------
-- (A) Master flag: 단가제 체크 (RULE 올림 적용 대상)
----------------------------------------------------------------------
alter table public.cms_master_item
  add column if not exists is_unit_pricing boolean not null default false;
comment on column public.cms_master_item.is_unit_pricing is
  'When true, RULE pricing lines linked to this master will be rounded up at confirm time using configured rounding unit.';
----------------------------------------------------------------------
-- (B) Global rounding unit config (DEFAULT row)
----------------------------------------------------------------------
alter table public.cms_market_tick_config
  add column if not exists rule_rounding_unit_krw integer;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cms_market_tick_config_rule_rounding_unit_range') then
    alter table public.cms_market_tick_config
      add constraint cms_market_tick_config_rule_rounding_unit_range
      check (rule_rounding_unit_krw is null or (rule_rounding_unit_krw >= 0 and rule_rounding_unit_krw <= 1000000));
  end if;
end $$;
-- Seed DEFAULT row if missing (idempotent)
insert into public.cms_market_tick_config(
  config_key,
  fx_markup,
  cs_correction_factor,
  silver_kr_correction_factor,
  unit_pricing_min_margin_rate,
  unit_pricing_rounding_unit_krw,
  rule_rounding_unit_krw,
  updated_at
)
select
  'DEFAULT',
  1.030000,
  1.000000,
  1.200000,
  0.200000,
  5000,
  5000,
  now()
where not exists (select 1 from public.cms_market_tick_config where config_key = 'DEFAULT');
update public.cms_market_tick_config
set rule_rounding_unit_krw = coalesce(rule_rounding_unit_krw, 5000)
where config_key = 'DEFAULT';
comment on column public.cms_market_tick_config.rule_rounding_unit_krw is
  'Rounding unit (KRW) applied to RULE lines at confirm time for masters with is_unit_pricing=true. 0 means disabled.';
----------------------------------------------------------------------
-- (C) RPC: set global RULE rounding unit
----------------------------------------------------------------------
create or replace function public.cms_fn_set_rule_rounding_unit_v1(
  p_rounding_unit_krw integer,
  p_actor_person_id uuid default null,
  p_session_id uuid default null,
  p_memo text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unit integer;
begin
  v_unit := coalesce(p_rounding_unit_krw, 0);

  if v_unit < 0 or v_unit > 1000000 then
    raise exception 'rule_rounding_unit_krw out of range (0..1000000): %', v_unit;
  end if;

  insert into public.cms_market_tick_config(
    config_key,
    rule_rounding_unit_krw,
    updated_at
  )
  values ('DEFAULT', v_unit, now())
  on conflict (config_key) do update set
    rule_rounding_unit_krw = excluded.rule_rounding_unit_krw,
    updated_at = now();

  -- best-effort audit log (ignore if table absent)
  begin
    insert into public.cms_audit_log(event, actor_person_id, session_id, memo, payload)
    values (
      'rule_rounding_unit_upsert',
      p_actor_person_id,
      p_session_id,
      p_memo,
      jsonb_build_object('config_key','DEFAULT','rule_rounding_unit_krw', v_unit)
    );
  exception when others then
    null;
  end;

  return jsonb_build_object('ok', true, 'config_key', 'DEFAULT', 'rule_rounding_unit_krw', v_unit);
end $$;
grant execute on function public.cms_fn_set_rule_rounding_unit_v1(integer, uuid, uuid, text)
  to authenticated, service_role;
----------------------------------------------------------------------
-- (D) RPC: toggle master is_unit_pricing flag (no direct update from client)
----------------------------------------------------------------------
create or replace function public.cms_fn_set_master_item_unit_pricing_v1(
  p_master_id uuid,
  p_is_unit_pricing boolean,
  p_actor_person_id uuid default null,
  p_session_id uuid default null,
  p_memo text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_master_id is null then
    raise exception 'master_id required';
  end if;

  update public.cms_master_item
  set is_unit_pricing = coalesce(p_is_unit_pricing, false),
      updated_at = now()
  where master_id = p_master_id;

  if not found then
    raise exception 'master_item not found: %', p_master_id;
  end if;

  begin
    insert into public.cms_audit_log(event, actor_person_id, session_id, memo, payload)
    values (
      'master_item_set_unit_pricing',
      p_actor_person_id,
      p_session_id,
      p_memo,
      jsonb_build_object('master_id', p_master_id, 'is_unit_pricing', coalesce(p_is_unit_pricing,false))
    );
  exception when others then
    null;
  end;

  return jsonb_build_object('ok', true, 'master_id', p_master_id, 'is_unit_pricing', coalesce(p_is_unit_pricing,false));
end $$;
grant execute on function public.cms_fn_set_master_item_unit_pricing_v1(uuid, boolean, uuid, uuid, text)
  to authenticated, service_role;
----------------------------------------------------------------------
-- (E) Apply RULE rounding for masters with is_unit_pricing=true
--     - 대상: pricing_mode='RULE' AND master.is_unit_pricing=true
--     - 제외: AMOUNT_ONLY/총액덮어쓰기(=manual_total_amount_krw not null) 라인
--     - 올림 단위: cms_market_tick_config(DEFAULT).rule_rounding_unit_krw
--     - delta는 labor_total_sell_krw(+ labor_base_sell_krw)로 흡수
----------------------------------------------------------------------
create or replace function public.cms_fn_apply_rule_rounding_by_master_unit_pricing_v1(
  p_shipment_id uuid,
  p_actor_person_id uuid default null,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unit integer := 0;
  v_updated_lines integer := 0;

  v_total_sell numeric := 0;
  v_total_cost numeric := 0;
  v_total_weight numeric := 0;
  v_total_labor numeric := 0;
begin
  if p_shipment_id is null then
    raise exception 'shipment_id required';
  end if;

  select coalesce(rule_rounding_unit_krw, 0)
    into v_unit
  from public.cms_market_tick_config
  where config_key = 'DEFAULT'
  limit 1;

  if v_unit is null or v_unit <= 0 then
    return jsonb_build_object('ok', true, 'shipment_id', p_shipment_id, 'rule_rounding_unit_krw', coalesce(v_unit,0), 'updated_lines', 0);
  end if;

  with cand as (
    select
      sl.shipment_line_id,
      coalesce(sl.total_amount_sell_krw,0) as old_total,
      -- new_total = ceil(old_total / unit) * unit
      (ceil(coalesce(sl.total_amount_sell_krw,0) / (v_unit::numeric)) * (v_unit::numeric)) as new_total
    from public.cms_shipment_line sl
    join public.cms_master_item mi
      on mi.master_id = sl.master_id
    where sl.shipment_id = p_shipment_id
      and sl.pricing_mode::text = 'RULE'
      and mi.is_unit_pricing = true
      and sl.master_id is not null
      and sl.manual_total_amount_krw is null
      and coalesce(sl.total_amount_sell_krw,0) > 0
  ),
  cand2 as (
    select
      c.*,
      (c.new_total - c.old_total) as delta
    from cand c
    where c.new_total > c.old_total
  ),
  upd as (
    update public.cms_shipment_line sl
    set
      total_amount_sell_krw = c.new_total,
      labor_base_sell_krw = coalesce(sl.labor_base_sell_krw,0) + c.delta,
      labor_total_sell_krw = coalesce(sl.labor_total_sell_krw,0) + c.delta,
      price_calc_trace = coalesce(sl.price_calc_trace,'{}'::jsonb)
        || jsonb_build_object(
          'rule_rounding_applied', true,
          'rule_rounding_applied_at', now(),
          'rule_rounding_unit_krw', v_unit,
          'rule_rounding_before_total_sell_krw', c.old_total,
          'rule_rounding_after_total_sell_krw', c.new_total,
          'rule_rounding_delta_krw', c.delta
        ),
      updated_at = now()
    from cand2 c
    where sl.shipment_line_id = c.shipment_line_id
    returning 1
  )
  select count(*) into v_updated_lines from upd;

  -- Recompute totals for valuation + AR ledger (keep consistent even before AR upsert)
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
    breakdown = coalesce(breakdown, '{}'::jsonb)
      || jsonb_build_object(
        'rule_rounding', jsonb_build_object(
          'unit_krw', v_unit,
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
    'rule_rounding_unit_krw', v_unit,
    'updated_lines', v_updated_lines,
    'total_sell_krw', v_total_sell,
    'total_cost_krw', v_total_cost
  );
end $$;
grant execute on function public.cms_fn_apply_rule_rounding_by_master_unit_pricing_v1(uuid, uuid, text)
  to authenticated, service_role;
----------------------------------------------------------------------
-- (F) Hook into confirm chain (v3_cost): apply RULE rounding before AR upsert
-- NOTE: This preserves existing chain (repair_fee -> purchase_cost -> silver_fix -> unit_floor -> RULE rounding -> AR create -> inventory emit)
----------------------------------------------------------------------
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

  -- If UNIT/MANUAL pricing floor exists (0361), apply it here (safe no-op for RULE lines)
  begin
    perform public.cms_fn_apply_unit_pricing_floor_v1(p_shipment_id, p_actor_person_id, p_note);
  exception when undefined_function then
    null;
  end;

  -- NEW: apply RULE rounding only for masters flagged is_unit_pricing=true
  perform public.cms_fn_apply_rule_rounding_by_master_unit_pricing_v1(p_shipment_id, p_actor_person_id, p_note);

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
