set search_path = public, pg_temp;

-- =============================================================
-- 0265: Receipt pricing snapshot + allocation RPCs & Views (repo-aligned)
--
-- Depends on 0264:
-- - cms_receipt_inbox: total_amount_original, fx_rate_to_krw, fx_source, fx_observed_at
-- - cms_receipt_usage: allocated_amount_original, allocated_amount_krw, allocation_method, allocation_note,
--                      factory_weight_g, factory_labor_basic_amount_original, factory_labor_other_amount_original
--
-- Notes:
-- - cms_decision_log columns are: decision_kind, before, after (repo schema)
-- - cms_e_market_symbol has only (GOLD_KRW_PER_G, SILVER_KRW_PER_G) in this repo.
--   So FX suggestion reads from latest SILVER tick meta (often contains krw_per_1_adj/raw).
-- =============================================================

-- -------------------------------------------------------------
-- 1) Suggest FX rate (KRW per 1 unit of currency) - best effort
-- -------------------------------------------------------------
create or replace function public.cms_fn_suggest_fx_rate_to_krw_v1(
  p_currency_code text,
  p_asof_date date default current_date
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cc text := upper(coalesce(p_currency_code,'KRW'));
  v_meta jsonb;
  v_symbol public.cms_e_market_symbol;
  v_fx numeric;
  v_txt text;
begin
  if v_cc in ('KRW') then
    return null;
  end if;

  -- normalize common aliases
  if v_cc in ('RMB','CNH') then
    v_cc := 'CNY';
  end if;

  -- For now, only best-effort for CNY (factory receipts)
  if v_cc <> 'CNY' then
    return null;
  end if;

  begin
    v_symbol := public.cms_fn_get_market_symbol_by_role_v1('SILVER');
  exception when others then
    return null;
  end;

  select t.meta into v_meta
  from public.cms_v_market_tick_latest_by_symbol_ops_v1 t
  where t.symbol = v_symbol
  limit 1;

  if v_meta is null then
    return null;
  end if;

  -- Try typical keys from your n8n meta payload:
  -- - krw_per_1_adj (preferred)
  -- - krw_per_1_raw
  -- - fx_krw_per_1
  v_fx := null;

  v_txt := nullif(trim(coalesce(v_meta->>'krw_per_1_adj','')), '');
  if v_txt is not null then
    begin v_fx := v_txt::numeric; exception when others then v_fx := null; end;
    if v_fx is not null and v_fx > 0 then return v_fx; end if;
  end if;

  v_txt := nullif(trim(coalesce(v_meta->>'krw_per_1_raw','')), '');
  if v_txt is not null then
    begin v_fx := v_txt::numeric; exception when others then v_fx := null; end;
    if v_fx is not null and v_fx > 0 then return v_fx; end if;
  end if;

  v_txt := nullif(trim(coalesce(v_meta->>'fx_krw_per_1','')), '');
  if v_txt is not null then
    begin v_fx := v_txt::numeric; exception when others then v_fx := null; end;
    if v_fx is not null and v_fx > 0 then return v_fx; end if;
  end if;

  return null;
end $$;

alter function public.cms_fn_suggest_fx_rate_to_krw_v1(text, date)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_suggest_fx_rate_to_krw_v1(text, date)
  to anon, authenticated, service_role;

comment on function public.cms_fn_suggest_fx_rate_to_krw_v1(text, date)
is 'Best-effort: suggest FX rate (KRW per 1 currency unit). Uses latest SILVER tick meta keys like krw_per_1_adj/raw.';


-- -------------------------------------------------------------
-- 2) Patch receipt pricing snapshot (non-destructive patch semantics)
-- -------------------------------------------------------------
create or replace function public.cms_fn_patch_receipt_pricing_v1(
  p_receipt_id uuid,
  p_actor_person_id uuid default null,
  p_issued_at date default null,
  p_currency_code text default null,
  p_total_amount_original numeric default null,
  p_fx_rate_to_krw numeric default null,
  p_fx_source text default null,
  p_fx_observed_at date default null,
  p_total_amount_krw_override numeric default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.cms_receipt_inbox%rowtype;

  v_cc text;
  v_issued_at date;
  v_fx_observed_at date;

  v_fx_suggest numeric;
  v_fx_new numeric;

  v_before jsonb;
  v_after jsonb;

  v_total_orig_new numeric;
  v_total_krw_new numeric;
  v_fx_source_new text;

  v_input_touched boolean := false;
begin
  if p_receipt_id is null then
    raise exception using errcode='P0001', message='receipt_id required';
  end if;

  select * into r
  from public.cms_receipt_inbox
  where receipt_id = p_receipt_id
  for update;

  if not found then
    raise exception using errcode='P0001', message=format('receipt not found: %s', p_receipt_id);
  end if;

  v_before := to_jsonb(r);

  v_cc := upper(coalesce(p_currency_code, r.currency_code, 'KRW'));
  if v_cc in ('RMB','CNH') then v_cc := 'CNY'; end if;

  v_issued_at := coalesce(p_issued_at, r.issued_at);
  v_fx_observed_at := coalesce(p_fx_observed_at, r.fx_observed_at, v_issued_at);

  if p_currency_code is not null or p_total_amount_original is not null or p_fx_rate_to_krw is not null
     or p_fx_source is not null or p_fx_observed_at is not null or p_total_amount_krw_override is not null
     or p_issued_at is not null then
    v_input_touched := true;
  end if;

  -- total original snapshot (patch semantics)
  v_total_orig_new := coalesce(
    p_total_amount_original,
    r.total_amount_original,
    case when v_cc = 'KRW' then r.total_amount_krw else null end
  );

  -- FX
  v_fx_suggest := null;
  if v_cc <> 'KRW' then
    v_fx_suggest := public.cms_fn_suggest_fx_rate_to_krw_v1(v_cc, coalesce(v_fx_observed_at, current_date));
  end if;

  v_fx_new := case
    when v_cc = 'KRW' then null
    else coalesce(p_fx_rate_to_krw, r.fx_rate_to_krw, v_fx_suggest)
  end;

  -- FX source label
  v_fx_source_new := case
    when v_cc = 'KRW' then null
    else coalesce(
      p_fx_source,
      r.fx_source,
      case
        when p_fx_rate_to_krw is not null then 'MANUAL'
        when v_fx_suggest is not null then 'AUTO_TICK'
        else null
      end
    )
  end;

  -- total_krw snapshot:
  -- - if override provided -> use it
  -- - else compute only when user touched inputs (avoid rewriting silently)
  v_total_krw_new := null;
  if p_total_amount_krw_override is not null then
    v_total_krw_new := p_total_amount_krw_override;
  elsif v_input_touched then
    if v_cc = 'KRW' then
      -- If user provided total_original on KRW, reflect to KRW snapshot
      if p_total_amount_original is not null then
        v_total_krw_new := p_total_amount_original;
      end if;
    else
      if v_total_orig_new is not null and v_fx_new is not null then
        v_total_krw_new := v_total_orig_new * v_fx_new;
      end if;
    end if;
  end if;

  update public.cms_receipt_inbox
  set
    issued_at = coalesce(p_issued_at, issued_at),
    currency_code = coalesce(p_currency_code, currency_code),

    total_amount_original = coalesce(p_total_amount_original, total_amount_original),
    fx_rate_to_krw = coalesce(p_fx_rate_to_krw, fx_rate_to_krw, v_fx_suggest),
    fx_source = coalesce(p_fx_source, fx_source, v_fx_source_new),
    fx_observed_at = coalesce(p_fx_observed_at, fx_observed_at, v_fx_observed_at),

    total_amount_krw = coalesce(p_total_amount_krw_override, v_total_krw_new, total_amount_krw)
  where receipt_id = p_receipt_id;

  select to_jsonb(x) into v_after
  from public.cms_receipt_inbox x
  where x.receipt_id = p_receipt_id;

  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, "before", "after", actor_person_id, note)
  values ('RECEIPT_INBOX', p_receipt_id, 'PATCH_RECEIPT_PRICING', v_before, coalesce(v_after,'{}'::jsonb), p_actor_person_id, p_note);

  return jsonb_build_object('ok', true, 'receipt_id', p_receipt_id, 'receipt', coalesce(v_after,'{}'::jsonb));
end $$;

alter function public.cms_fn_patch_receipt_pricing_v1(uuid, uuid, date, text, numeric, numeric, text, date, numeric, text)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_patch_receipt_pricing_v1(uuid, uuid, date, text, numeric, numeric, text, date, numeric, text)
  to anon, authenticated, service_role;

comment on function public.cms_fn_patch_receipt_pricing_v1(uuid, uuid, date, text, numeric, numeric, text, date, numeric, text)
is 'Patch receipt pricing snapshot fields (original total + FX + KRW snapshot). Writes cms_decision_log.';


-- -------------------------------------------------------------
-- 3) Upsert receipt_usage allocation/breakdown (patch semantics)
-- -------------------------------------------------------------
create or replace function public.cms_fn_upsert_receipt_usage_alloc_v1(
  p_receipt_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid(),

  p_allocated_amount_original numeric default null,
  p_allocated_amount_krw numeric default null,
  p_allocation_method text default null,
  p_allocation_note text default null,

  p_factory_weight_g numeric default null,
  p_factory_labor_basic_amount_original numeric default null,
  p_factory_labor_other_amount_original numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entity_type text := upper(coalesce(p_entity_type,''));
  v_before jsonb;
  v_after jsonb;

  v_receipt public.cms_receipt_inbox%rowtype;
  v_alloc_krw numeric;
begin
  if p_receipt_id is null then
    raise exception using errcode='P0001', message='receipt_id required';
  end if;
  if v_entity_type = '' then
    raise exception using errcode='P0001', message='entity_type required';
  end if;
  if p_entity_id is null then
    raise exception using errcode='P0001', message='entity_id required';
  end if;

  select * into v_receipt
  from public.cms_receipt_inbox
  where receipt_id = p_receipt_id;

  -- Compute allocated_amount_krw if not provided but original exists and FX is available.
  v_alloc_krw := p_allocated_amount_krw;

  if v_alloc_krw is null and p_allocated_amount_original is not null then
    if upper(coalesce(v_receipt.currency_code,'KRW')) = 'KRW' then
      v_alloc_krw := p_allocated_amount_original;
    elsif v_receipt.fx_rate_to_krw is not null then
      v_alloc_krw := p_allocated_amount_original * v_receipt.fx_rate_to_krw;
    end if;
  end if;

  select to_jsonb(u) into v_before
  from public.cms_receipt_usage u
  where u.receipt_id = p_receipt_id
    and u.entity_type = v_entity_type
    and u.entity_id = p_entity_id;

  insert into public.cms_receipt_usage(
    receipt_id, entity_type, entity_id, note, actor_person_id, correlation_id,
    allocated_amount_original, allocated_amount_krw,
    allocation_method, allocation_note,
    factory_weight_g,
    factory_labor_basic_amount_original,
    factory_labor_other_amount_original
  )
  values (
    p_receipt_id, v_entity_type, p_entity_id, p_note, p_actor_person_id, p_correlation_id,
    p_allocated_amount_original, v_alloc_krw,
    p_allocation_method, p_allocation_note,
    p_factory_weight_g,
    p_factory_labor_basic_amount_original,
    p_factory_labor_other_amount_original
  )
  on conflict (receipt_id, entity_type, entity_id)
  do update set
    note = coalesce(excluded.note, public.cms_receipt_usage.note),
    actor_person_id = coalesce(excluded.actor_person_id, public.cms_receipt_usage.actor_person_id),
    correlation_id = coalesce(excluded.correlation_id, public.cms_receipt_usage.correlation_id),

    allocated_amount_original = coalesce(excluded.allocated_amount_original, public.cms_receipt_usage.allocated_amount_original),
    allocated_amount_krw = coalesce(excluded.allocated_amount_krw, public.cms_receipt_usage.allocated_amount_krw),
    allocation_method = coalesce(excluded.allocation_method, public.cms_receipt_usage.allocation_method),
    allocation_note = coalesce(excluded.allocation_note, public.cms_receipt_usage.allocation_note),

    factory_weight_g = coalesce(excluded.factory_weight_g, public.cms_receipt_usage.factory_weight_g),
    factory_labor_basic_amount_original = coalesce(excluded.factory_labor_basic_amount_original, public.cms_receipt_usage.factory_labor_basic_amount_original),
    factory_labor_other_amount_original = coalesce(excluded.factory_labor_other_amount_original, public.cms_receipt_usage.factory_labor_other_amount_original);

  select to_jsonb(u) into v_after
  from public.cms_receipt_usage u
  where u.receipt_id = p_receipt_id
    and u.entity_type = v_entity_type
    and u.entity_id = p_entity_id;

  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, "before", "after", actor_person_id, note)
  values ('RECEIPT_USAGE', p_entity_id, 'UPSERT_RECEIPT_USAGE_ALLOC', coalesce(v_before,'{}'::jsonb), coalesce(v_after,'{}'::jsonb), p_actor_person_id, p_note);

  return jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'entity_type', v_entity_type,
    'entity_id', p_entity_id,
    'usage', coalesce(v_after,'{}'::jsonb)
  );
end $$;

alter function public.cms_fn_upsert_receipt_usage_alloc_v1(uuid, text, uuid, uuid, text, uuid, numeric, numeric, text, text, numeric, numeric, numeric)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_upsert_receipt_usage_alloc_v1(uuid, text, uuid, uuid, text, uuid, numeric, numeric, text, text, numeric, numeric, numeric)
  to anon, authenticated, service_role;

comment on function public.cms_fn_upsert_receipt_usage_alloc_v1(uuid, text, uuid, uuid, text, uuid, numeric, numeric, text, text, numeric, numeric, numeric)
is 'Upsert allocation/breakdown fields on cms_receipt_usage (shipment-level allocation). Writes cms_decision_log.';


-- -------------------------------------------------------------
-- 4) Views
-- -------------------------------------------------------------

-- 4-1) Compare: receipt allocation vs shipment purchase cost
create or replace view public.cms_v_receipt_allocation_vs_shipment_cost_v1
as
with ship_cost as (
  select
    sl.purchase_receipt_id as receipt_id,
    sh.shipment_id,
    sh.customer_party_id,
    sh.confirmed_at,
    sum(coalesce(sl.purchase_total_cost_krw, 0)) as ship_purchase_cost_krw,
    sum(coalesce(sl.qty, 0)) as ship_qty
  from public.cms_shipment_line sl
  join public.cms_shipment_header sh on sh.shipment_id = sl.shipment_id
  where sl.purchase_receipt_id is not null
  group by 1,2,3,4
),
usage_ship as (
  select
    u.receipt_id,
    u.entity_id as shipment_id,
    u.allocated_amount_original,
    u.allocated_amount_krw,
    u.allocation_method,
    u.allocation_note,
    u.factory_weight_g,
    u.factory_labor_basic_amount_original,
    u.factory_labor_other_amount_original
  from public.cms_receipt_usage u
  where u.entity_type = 'SHIPMENT_HEADER'
),
ship_count as (
  select receipt_id, count(distinct shipment_id) as shipment_cnt
  from ship_cost
  group by 1
),
ship_cost_sum as (
  select receipt_id, sum(ship_purchase_cost_krw) as sum_ship_purchase_cost_krw
  from ship_cost
  group by 1
)
select
  r.receipt_id,
  r.status as receipt_status,
  r.received_at,
  r.issued_at,
  r.currency_code,
  r.total_amount_original as receipt_total_original,
  r.fx_rate_to_krw,
  r.fx_source,
  r.fx_observed_at,
  r.total_amount_krw as receipt_total_krw,

  sc.shipment_id,
  sc.customer_party_id,
  sc.confirmed_at,
  sc.ship_qty,
  sc.ship_purchase_cost_krw,

  us.allocated_amount_original,
  us.allocated_amount_krw,
  us.allocation_method,
  us.allocation_note,
  us.factory_weight_g,
  us.factory_labor_basic_amount_original,
  us.factory_labor_other_amount_original,

  -- Effective allocation logic (minimize manual work):
  -- 1) If usage has allocated_amount_krw -> use it.
  -- 2) If only one shipment for this receipt -> assume full receipt_total_krw.
  -- 3) If multiple shipments -> proportional by ship_purchase_cost_krw share.
  case
    when us.allocated_amount_krw is not null then us.allocated_amount_krw
    when coalesce(cnt.shipment_cnt,0) = 1 then r.total_amount_krw
    when r.total_amount_krw is not null
         and coalesce(sumc.sum_ship_purchase_cost_krw,0) > 0
      then r.total_amount_krw * sc.ship_purchase_cost_krw / sumc.sum_ship_purchase_cost_krw
    else null
  end as effective_allocated_krw,

  (sc.ship_purchase_cost_krw - (
    case
      when us.allocated_amount_krw is not null then us.allocated_amount_krw
      when coalesce(cnt.shipment_cnt,0) = 1 then r.total_amount_krw
      when r.total_amount_krw is not null
           and coalesce(sumc.sum_ship_purchase_cost_krw,0) > 0
        then r.total_amount_krw * sc.ship_purchase_cost_krw / sumc.sum_ship_purchase_cost_krw
      else null
    end
  )) as delta_purchase_cost_vs_alloc_krw

from ship_cost sc
join public.cms_receipt_inbox r on r.receipt_id = sc.receipt_id
left join usage_ship us on us.receipt_id = sc.receipt_id and us.shipment_id = sc.shipment_id
left join ship_count cnt on cnt.receipt_id = sc.receipt_id
left join ship_cost_sum sumc on sumc.receipt_id = sc.receipt_id;

grant select on public.cms_v_receipt_allocation_vs_shipment_cost_v1
  to anon, authenticated, service_role;


-- 4-2) Quality flags for ops (missing snapshot / allocation issues)
create or replace view public.cms_v_receipt_pricing_quality_v1
as
with linked_ship as (
  select
    sl.purchase_receipt_id as receipt_id,
    count(distinct sl.shipment_id) as linked_shipment_cnt
  from public.cms_shipment_line sl
  where sl.purchase_receipt_id is not null
  group by 1
),
usage_alloc as (
  select
    receipt_id,
    count(*) filter (where entity_type = 'SHIPMENT_HEADER') as usage_shipment_rows,
    sum(coalesce(allocated_amount_krw,0)) as sum_alloc_krw,
    sum(coalesce(allocated_amount_original,0)) as sum_alloc_original
  from public.cms_receipt_usage
  group by 1
)
select
  r.receipt_id,
  r.status,
  r.received_at,
  r.issued_at,
  r.currency_code,
  r.total_amount_original,
  r.fx_rate_to_krw,
  r.fx_source,
  r.fx_observed_at,
  r.total_amount_krw,

  coalesce(ls.linked_shipment_cnt, 0) as linked_shipment_cnt,
  coalesce(ua.usage_shipment_rows, 0) as usage_shipment_rows,
  coalesce(ua.sum_alloc_krw, 0) as sum_alloc_krw,
  coalesce(ua.sum_alloc_original, 0) as sum_alloc_original,

  -- Flags
  (r.issued_at is null) as missing_issued_at,
  (r.currency_code is null) as missing_currency,
  (r.total_amount_original is null and r.total_amount_krw is null) as missing_total,
  (upper(coalesce(r.currency_code,'KRW')) <> 'KRW' and r.fx_rate_to_krw is null) as missing_fx_for_non_krw,

  (coalesce(ls.linked_shipment_cnt,0) > 1 and coalesce(ua.usage_shipment_rows,0) = 0) as multi_ship_no_usage_rows,

  (
    r.total_amount_krw is not null
    and coalesce(ua.sum_alloc_krw,0) > 0
    and abs(ua.sum_alloc_krw - r.total_amount_krw) > (r.total_amount_krw * 0.05)
  ) as alloc_sum_mismatch_gt_5pct

from public.cms_receipt_inbox r
left join linked_ship ls on ls.receipt_id = r.receipt_id
left join usage_alloc ua on ua.receipt_id = r.receipt_id;

grant select on public.cms_v_receipt_pricing_quality_v1
  to anon, authenticated, service_role;
