-- Add line_items column
alter table public.cms_receipt_pricing_snapshot
  add column if not exists line_items jsonb;
-- Create v2 function
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
begin
  if p_receipt_id is null then
    raise exception using errcode='P0001', message='receipt_id required';
  end if;

  select 1 into v_exists from public.cms_receipt_inbox r where r.receipt_id = p_receipt_id;
  if v_exists is null then
    raise exception using errcode='P0001', message='receipt not found';
  end if;

  -- currency: prefer explicit param, else receipt_inbox.currency_code, else KRW
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
    -- fx from latest SILVER_CN_KRW_PER_G meta: { krw_per_1_adj | krw_per_1_raw }
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
    line_items = excluded.line_items,
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
-- Recreate view
drop view if exists public.cms_v_receipt_inbox_open_v1 cascade;
create view public.cms_v_receipt_inbox_open_v1 as
with linked_sh as (
  select distinct
    u.receipt_id,
    case
      when u.entity_type='SHIPMENT_HEADER' then u.entity_id
      when u.entity_type='SHIPMENT_LINE' then sl.shipment_id
      else null
    end as shipment_id
  from public.cms_receipt_usage u
  left join public.cms_shipment_line sl
    on sl.shipment_line_id = u.entity_id
   and u.entity_type='SHIPMENT_LINE'
  where u.entity_type in ('SHIPMENT_HEADER','SHIPMENT_LINE')
),
ship_rows as (
  select
    l.receipt_id,
    h.shipment_id,
    h.ship_date,
    h.status as shipment_status,
    h.customer_party_id,
    cp.name as customer_name,
    (select coalesce(sum(sl.total_amount_cost_krw),0)
       from public.cms_shipment_line sl
      where sl.shipment_id=h.shipment_id) as basis_cost_krw,
    (select count(*)
       from public.cms_shipment_line sl
      where sl.shipment_id=h.shipment_id) as line_cnt
  from linked_sh l
  join public.cms_shipment_header h on h.shipment_id = l.shipment_id
  left join public.cms_party cp on cp.party_id = h.customer_party_id
  where l.shipment_id is not null
),
ship_agg as (
  select
    receipt_id,
    count(distinct shipment_id) as linked_shipment_cnt,
    coalesce(sum(basis_cost_krw),0) as linked_basis_cost_krw,
    coalesce(jsonb_agg(
      jsonb_build_object(
        'shipment_id', shipment_id,
        'ship_date', ship_date,
        'shipment_status', shipment_status,
        'customer_party_id', customer_party_id,
        'customer_name', customer_name,
        'basis_cost_krw', basis_cost_krw,
        'line_cnt', line_cnt
      )
      order by ship_date desc, shipment_id::text
    ), '[]'::jsonb) as linked_shipments
  from ship_rows
  group by receipt_id
)
select
  r.receipt_id,
  r.received_at,
  r.source,
  r.status,
  r.vendor_party_id,
  vp.name as vendor_name,
  r.issued_at,
  r.currency_code as inbox_currency_code,
  r.total_amount_krw as inbox_total_amount_krw,
  r.file_bucket,
  r.file_path,
  r.file_sha256,
  r.file_size_bytes,
  r.mime_type,
  r.memo,
  r.meta,

  s.currency_code as pricing_currency_code,
  s.total_amount as pricing_total_amount,
  s.weight_g,
  s.labor_basic,
  s.labor_other,
  s.total_amount_krw as pricing_total_amount_krw,
  s.fx_rate_krw_per_unit,
  s.fx_tick_id,
  s.applied_at,
  s.applied_by,
  s.allocation_json,
  s.line_items,

  coalesce(a.linked_shipment_cnt,0) as linked_shipment_cnt,
  coalesce(a.linked_basis_cost_krw,0) as linked_basis_cost_krw,
  coalesce(a.linked_shipments,'[]'::jsonb) as linked_shipments
from public.cms_receipt_inbox r
left join public.cms_party vp on vp.party_id = r.vendor_party_id
left join public.cms_receipt_pricing_snapshot s on s.receipt_id = r.receipt_id
left join ship_agg a on a.receipt_id = r.receipt_id
where r.status <> 'ARCHIVED'::public.cms_e_receipt_status;
grant select on public.cms_v_receipt_inbox_open_v1 to authenticated, service_role;
