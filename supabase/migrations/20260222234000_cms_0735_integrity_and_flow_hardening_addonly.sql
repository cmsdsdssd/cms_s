-- cms_0735: integrity and flow hardening (add-only)

begin;

-- 1) Enforce PO-order_line 1:1 (with deterministic dedupe + backfill)
with ranked as (
  select
    pol.po_line_id,
    pol.po_id,
    pol.order_line_id,
    pol.created_at,
    row_number() over (
      partition by pol.order_line_id
      order by pol.created_at desc nulls last, pol.po_line_id desc
    ) as rn
  from public.cms_factory_po_line pol
), keepers as (
  select po_id, order_line_id
  from ranked
  where rn = 1
)
update public.cms_order_line ol
set
  factory_po_id = k.po_id,
  updated_at = now()
from keepers k
where k.order_line_id = ol.order_line_id
  and ol.factory_po_id is distinct from k.po_id;

with ranked as (
  select
    pol.po_line_id,
    row_number() over (
      partition by pol.order_line_id
      order by pol.created_at desc nulls last, pol.po_line_id desc
    ) as rn
  from public.cms_factory_po_line pol
)
delete from public.cms_factory_po_line pol
using ranked r
where pol.po_line_id = r.po_line_id
  and r.rn > 1;

create unique index if not exists uq_cms_factory_po_line_order_line_id
  on public.cms_factory_po_line(order_line_id);

-- 2) Prevent mark_sent from rolling back progressed statuses
create or replace function public.cms_fn_factory_po_mark_sent(
  p_po_id uuid,
  p_fax_result jsonb default '{}'::jsonb,
  p_actor_person_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po record;
  v_fax_payload_url text;
  v_provider_message_id text;
  v_provider text;
  v_affected_lines int := 0;
  v_now timestamptz := now();
begin
  select * into v_po
  from public.cms_factory_po
  where po_id = p_po_id
  for update;

  if not found then
    raise exception 'Factory PO not found: %', p_po_id;
  end if;

  if v_po.status = 'SENT_TO_VENDOR' then
    return jsonb_build_object(
      'ok', true,
      'already_sent', true,
      'po_id', p_po_id,
      'sent_at', v_po.fax_sent_at
    );
  end if;

  v_fax_payload_url := p_fax_result->>'payload_url';
  v_provider_message_id := p_fax_result->>'provider_message_id';
  v_provider := coalesce(p_fax_result->>'provider', v_po.fax_provider, 'mock');

  update public.cms_factory_po
  set
    status = 'SENT_TO_VENDOR',
    fax_sent_at = v_now,
    fax_payload_url = coalesce(v_fax_payload_url, fax_payload_url),
    fax_provider_message_id = v_provider_message_id,
    fax_provider = v_provider,
    updated_at = v_now
  where po_id = p_po_id;

  insert into public.cms_fax_log (
    po_id,
    provider,
    request_meta,
    response_meta,
    success,
    provider_message_id,
    created_by
  )
  values (
    p_po_id,
    v_provider,
    coalesce(p_fax_result->'request', '{}'::jsonb),
    coalesce(p_fax_result->'response', '{}'::jsonb),
    coalesce((p_fax_result->>'success')::boolean, true),
    v_provider_message_id,
    p_actor_person_id
  );

  update public.cms_order_line ol
  set
    status = 'SENT_TO_VENDOR',
    sent_to_vendor_at = coalesce(ol.sent_to_vendor_at, v_now),
    updated_at = v_now
  from public.cms_factory_po_line pol
  where pol.po_id = p_po_id
    and pol.order_line_id = ol.order_line_id
    and ol.status = 'ORDER_PENDING';

  get diagnostics v_affected_lines = row_count;

  insert into public.cms_decision_log (
    entity_type,
    entity_id,
    decision_kind,
    before,
    after,
    actor_person_id,
    note
  )
  values (
    'FACTORY_PO',
    p_po_id,
    'MARK_SENT',
    jsonb_build_object('status', v_po.status),
    jsonb_build_object('status', 'SENT_TO_VENDOR', 'sent_at', v_now, 'provider', v_provider),
    p_actor_person_id,
    'Factory order sent via fax'
  );

  return jsonb_build_object(
    'ok', true,
    'po_id', p_po_id,
    'sent_at', v_now,
    'affected_lines', v_affected_lines,
    'provider', v_provider
  );
end;
$$;

grant execute on function public.cms_fn_factory_po_mark_sent(uuid, jsonb, uuid) to authenticated;
grant execute on function public.cms_fn_factory_po_mark_sent(uuid, jsonb, uuid) to service_role;

-- 3) Confirm chain: sync order_line -> SHIPPED/shipped_at
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
  v_already_confirmed_at timestamptz;
  v_ship_confirmed_at timestamptz;
begin
  select confirmed_at
    into v_already_confirmed_at
  from public.cms_shipment_header
  where shipment_id = p_shipment_id;

  if v_already_confirmed_at is not null and not coalesce(p_force, false) then
    raise exception using
      errcode = 'P0001',
      message = format('shipment already confirmed: %s (forward-only guard; use p_force=true to override)', p_shipment_id);
  end if;

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

  begin
    perform public.cms_fn_apply_unit_pricing_floor_v1(p_shipment_id, p_actor_person_id, p_note);
  exception when undefined_function then
    null;
  end;

  perform public.cms_fn_apply_rule_rounding_by_master_unit_pricing_v1(p_shipment_id, p_actor_person_id, p_note);
  perform public.cms_fn_sync_repair_line_sell_totals_v1(p_shipment_id, p_note);

  perform public.cms_fn_ar_create_from_shipment_confirm_v1(p_shipment_id);
  perform public.cms_fn_sync_ar_ledger_from_shipment_v1(p_shipment_id, p_note);
  perform public.cms_fn_verify_shipment_ar_consistency_v1(p_shipment_id);

  update public.cms_shipment_header
  set ar_principal_locked_at = coalesce(ar_principal_locked_at, now())
  where shipment_id = p_shipment_id;

  select confirmed_at
    into v_ship_confirmed_at
  from public.cms_shipment_header
  where shipment_id = p_shipment_id;

  update public.cms_order_line ol
  set
    status = 'SHIPPED'::public.cms_e_order_status,
    shipped_at = coalesce(ol.shipped_at, v_ship_confirmed_at, now()),
    updated_at = now()
  from public.cms_shipment_line sl
  where sl.shipment_id = p_shipment_id
    and sl.order_line_id = ol.order_line_id
    and ol.status not in (
      'SHIPPED'::public.cms_e_order_status,
      'CLOSED'::public.cms_e_order_status,
      'CANCELLED'::public.cms_e_order_status
    );

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
    return v_confirm || jsonb_build_object('purchase_cost', v_cost, 'correlation_id', v_corr, 'ar_principal_locked', true);
  end if;

  return v_confirm || jsonb_build_object('correlation_id', v_corr, 'ar_principal_locked', true);
end $$;

alter function public.cms_fn_confirm_shipment_v3_cost_v1(uuid,uuid,text,boolean,uuid,text,uuid,jsonb,boolean)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_confirm_shipment_v3_cost_v1(uuid,uuid,text,boolean,uuid,text,uuid,jsonb,boolean)
  to authenticated, service_role;

-- 4) Freeze receipt line_items after LINKED/CONFIRMED
create or replace function public.cms_fn_upsert_receipt_pricing_snapshot_v2(
  p_receipt_id uuid,
  p_currency_code text default null,
  p_total_amount numeric default null,
  p_weight_g numeric default null,
  p_labor_basic numeric default null,
  p_labor_other numeric default null,
  p_line_items jsonb default null,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_currency text;
  v_total_krw numeric;
  v_fx_rate numeric;
  v_fx_tick_id uuid;
  v_fx_observed_at timestamptz;
  v_fx_field text;
  v_meta jsonb := '{}'::jsonb;
  v_exists int;
  v_receipt_status public.cms_e_receipt_status;
  v_has_confirmed_match boolean := false;
begin
  if p_receipt_id is null then
    raise exception using errcode='P0001', message='receipt_id required';
  end if;

  select 1 into v_exists from public.cms_receipt_inbox r where r.receipt_id = p_receipt_id;
  if v_exists is null then
    raise exception using errcode='P0001', message='receipt not found';
  end if;

  select r.status
    into v_receipt_status
  from public.cms_receipt_inbox r
  where r.receipt_id = p_receipt_id;

  select exists (
    select 1
    from public.cms_receipt_line_match m
    where m.receipt_id = p_receipt_id
      and m.status = 'CONFIRMED'::public.cms_e_receipt_line_match_status
    limit 1
  ) into v_has_confirmed_match;

  if p_line_items is not null and (
    v_receipt_status = 'LINKED'::public.cms_e_receipt_status
    or v_has_confirmed_match
  ) then
    raise exception using
      errcode='P0001',
      message='line_items locked after receipt LINKED/CONFIRMED; use match clear/unlink workflow first';
  end if;

  select upper(coalesce(nullif(trim(p_currency_code),''), r.currency_code, 'KRW'))
    into v_currency
  from public.cms_receipt_inbox r
  where r.receipt_id = p_receipt_id;

  if v_currency not in ('KRW','CNY') then
    raise exception using errcode='P0001', message='currency_code must be KRW or CNY';
  end if;

  if p_total_amount is not null and p_total_amount < 0 then
    raise exception using errcode='P0001', message='total_amount must be >= 0';
  end if;

  if v_currency = 'KRW' then
    v_total_krw := p_total_amount;
    v_fx_rate := null;
    v_fx_tick_id := null;
    v_fx_observed_at := null;
    v_fx_field := null;
  else
    select t.tick_id,
           nullif((t.meta->>'krw_per_1_adj')::text,'')::numeric,
           t.observed_at
      into v_fx_tick_id, v_fx_rate, v_fx_observed_at
    from public.cms_market_tick t
    where t.symbol = 'SILVER_CN_KRW_PER_G'::public.cms_e_market_symbol
    order by t.observed_at desc
    limit 1;

    v_fx_field := 'krw_per_1_adj';

    if v_fx_rate is null then
      select nullif((t.meta->>'krw_per_1_raw')::text,'')::numeric
        into v_fx_rate
      from public.cms_market_tick t
      where t.tick_id = v_fx_tick_id;
      v_fx_field := 'krw_per_1_raw';
    end if;

    if v_fx_rate is null then
      raise exception using errcode='P0001', message='FX not available: market tick SILVER_CN_KRW_PER_G missing krw_per_1_adj/raw';
    end if;

    v_total_krw := case when p_total_amount is null then null else round(p_total_amount * v_fx_rate, 0) end;

    v_meta := jsonb_strip_nulls(jsonb_build_object(
      'fx_symbol', 'SILVER_CN_KRW_PER_G',
      'fx_tick_id', v_fx_tick_id,
      'fx_observed_at', v_fx_observed_at,
      'fx_field', v_fx_field,
      'fx_rate_krw_per_1', v_fx_rate,
      'correlation_id', p_correlation_id,
      'note', p_note
    ));
  end if;

  insert into public.cms_receipt_pricing_snapshot(
    receipt_id, currency_code, total_amount, weight_g, labor_basic, labor_other,
    total_amount_krw, fx_rate_krw_per_unit, fx_tick_id, meta, line_items
  ) values (
    p_receipt_id, v_currency, p_total_amount, p_weight_g, p_labor_basic, p_labor_other,
    v_total_krw, v_fx_rate, v_fx_tick_id, coalesce(v_meta,'{}'::jsonb), p_line_items
  )
  on conflict (receipt_id) do update set
    currency_code = excluded.currency_code,
    total_amount = excluded.total_amount,
    weight_g = excluded.weight_g,
    labor_basic = excluded.labor_basic,
    labor_other = excluded.labor_other,
    total_amount_krw = excluded.total_amount_krw,
    fx_rate_krw_per_unit = excluded.fx_rate_krw_per_unit,
    fx_tick_id = excluded.fx_tick_id,
    meta = coalesce(public.cms_receipt_pricing_snapshot.meta,'{}'::jsonb) || coalesce(excluded.meta,'{}'::jsonb),
    line_items = coalesce(excluded.line_items, public.cms_receipt_pricing_snapshot.line_items),
    updated_at = now();

  return jsonb_strip_nulls(jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'currency_code', v_currency,
    'total_amount', p_total_amount,
    'total_amount_krw', v_total_krw,
    'fx_tick_id', v_fx_tick_id,
    'fx_rate_krw_per_unit', v_fx_rate
  ));
end $$;

grant execute on function public.cms_fn_upsert_receipt_pricing_snapshot_v2(uuid,text,numeric,numeric,numeric,numeric,jsonb,uuid,text,uuid)
  to anon, authenticated, service_role;

-- 5) Harden direct base confirm entrypoint (force standard v3 path)
revoke execute on function public.cms_fn_confirm_shipment(uuid, uuid, text) from public;
revoke execute on function public.cms_fn_confirm_shipment(uuid, uuid, text) from anon;
revoke execute on function public.cms_fn_confirm_shipment(uuid, uuid, text) from authenticated;
revoke execute on function public.cms_fn_confirm_shipment(uuid, uuid, text) from service_role;

commit;
