-- cms_0800: analysis mode v1 (add-only)
-- 목적: /analysis/* 읽기 전용 지표를 위한 view/function/index 추가

begin;
set search_path = public, pg_temp;

create index if not exists idx_cms_shipment_header_status_ship_date
  on public.cms_shipment_header(status, ship_date);

create index if not exists idx_cms_shipment_line_shipment_id
  on public.cms_shipment_line(shipment_id);

create index if not exists idx_cms_shipment_line_master_id
  on public.cms_shipment_line(master_id);

create index if not exists idx_cms_shipment_header_customer_ship_date
  on public.cms_shipment_header(customer_party_id, ship_date);

create or replace view public.cms_v_an_leakage_lines_v1
with (security_invoker = true)
as
with cfg as (
  select
    coalesce(c.unit_pricing_min_margin_rate, 0.2) as min_margin_rate,
    coalesce(c.unit_pricing_rounding_unit_krw, 5000) as rounding_unit_krw
  from public.cms_market_tick_config c
  where c.config_key = 'DEFAULT'
  limit 1
), base as (
  select
    sh.shipment_id,
    sl.shipment_line_id,
    sh.ship_date,
    sh.status::text as status,
    sh.customer_party_id,
    p.name as customer_name,
    coalesce(sl.model_name, mi.model_name, '-') as model_name,
    coalesce(sl.material_code::text, '') as material_code,
    coalesce(sl.qty, 0) as qty,
    sl.net_weight_g,
    coalesce(sl.total_amount_sell_krw, 0) as sell_total_krw,
    coalesce(sl.pricing_mode::text, 'RULE') as pricing_mode,
    coalesce(sl.purchase_cost_status::text, 'PROVISIONAL') as purchase_cost_status,
    coalesce(sl.purchase_total_cost_krw, coalesce(sl.material_amount_cost_krw, 0) + coalesce(sl.labor_total_cost_krw, 0))
      + coalesce(sl.plating_amount_cost_krw, 0) as cost_basis_krw,
    coalesce(sl.material_amount_sell_krw, 0) as material_floor_krw,
    coalesce(sl.price_calc_trace, '{}'::jsonb) as price_calc_trace
  from public.cms_shipment_line sl
  join public.cms_shipment_header sh on sh.shipment_id = sl.shipment_id
  left join public.cms_party p on p.party_id = sh.customer_party_id
  left join public.cms_master_item mi on mi.master_id = sl.master_id
), calc as (
  select
    b.*,
    b.sell_total_krw - b.cost_basis_krw as margin_krw,
    case when b.sell_total_krw = 0 then null else (b.sell_total_krw - b.cost_basis_krw) / nullif(b.sell_total_krw, 0) end as margin_rate,
    ceil((b.cost_basis_krw * (1 + coalesce(cfg.min_margin_rate, 0.2))) / greatest(coalesce(cfg.rounding_unit_krw, 5000), 1)::numeric)
      * greatest(coalesce(cfg.rounding_unit_krw, 5000), 1)::numeric as floor_rounded_krw,
    greatest(
      ceil((b.cost_basis_krw * (1 + coalesce(cfg.min_margin_rate, 0.2))) / greatest(coalesce(cfg.rounding_unit_krw, 5000), 1)::numeric)
        * greatest(coalesce(cfg.rounding_unit_krw, 5000), 1)::numeric,
      b.material_floor_krw
    ) as final_floor_sell_krw,
    greatest(
      greatest(
        ceil((b.cost_basis_krw * (1 + coalesce(cfg.min_margin_rate, 0.2))) / greatest(coalesce(cfg.rounding_unit_krw, 5000), 1)::numeric)
          * greatest(coalesce(cfg.rounding_unit_krw, 5000), 1)::numeric,
        b.material_floor_krw
      ) - b.sell_total_krw,
      0
    ) as floor_delta_krw,
    coalesce((b.price_calc_trace ->> 'silver_factor_source') = 'CONFIG', false) as stale_tick_suspected
  from base b
  cross join cfg
), typed as (
  select
    c.*,
    case
      when c.margin_krw < 0 then 'NEG_MARGIN'
      when c.floor_delta_krw > 0 then 'BELOW_FLOOR'
      when c.purchase_cost_status = 'PROVISIONAL' then 'PROVISIONAL_COST'
      when c.stale_tick_suspected then 'STALE_TICK'
      else 'OK'
    end as leak_type,
    abs(c.margin_krw) + c.floor_delta_krw as abs_impact_krw
  from calc c
)
select
  t.shipment_id,
  t.shipment_line_id,
  t.ship_date,
  t.status,
  t.customer_party_id,
  t.customer_name,
  t.model_name,
  t.material_code,
  t.qty,
  t.net_weight_g,
  t.sell_total_krw,
  t.cost_basis_krw,
  t.margin_krw,
  t.margin_rate,
  t.pricing_mode,
  t.purchase_cost_status,
  t.floor_rounded_krw,
  t.final_floor_sell_krw,
  t.floor_delta_krw,
  t.stale_tick_suspected,
  t.leak_type,
  t.abs_impact_krw,
  jsonb_build_object(
    'cost_basis_krw', t.cost_basis_krw,
    'sell_total_krw', t.sell_total_krw,
    'margin_krw', t.margin_krw,
    'margin_rate', t.margin_rate,
    'floor_rounded_krw', t.floor_rounded_krw,
    'final_floor_sell_krw', t.final_floor_sell_krw,
    'floor_delta_krw', t.floor_delta_krw,
    'purchase_cost_status', t.purchase_cost_status
  ) as evidence,
  ('/shipments_main?shipment_id=' || t.shipment_id::text) as app_link
from typed t;

create or replace function public.cms_fn_an_leakage_summary_v1(
  p_from date,
  p_to date,
  p_party_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with rows as (
    select *
    from public.cms_v_an_leakage_lines_v1
    where ship_date between least(p_from, p_to) and greatest(p_from, p_to)
      and (p_party_id is null or customer_party_id = p_party_id)
  )
  select jsonb_build_object(
    'total_sell_krw', coalesce(sum(sell_total_krw), 0),
    'total_cost_krw', coalesce(sum(cost_basis_krw), 0),
    'total_margin_krw', coalesce(sum(margin_krw), 0),
    'neg_margin_count', count(*) filter (where leak_type = 'NEG_MARGIN'),
    'below_floor_count', count(*) filter (where leak_type = 'BELOW_FLOOR'),
    'provisional_count', count(*) filter (where leak_type = 'PROVISIONAL_COST'),
    'stale_tick_count', count(*) filter (where leak_type = 'STALE_TICK')
  )
  from rows;
$$;

create or replace view public.cms_v_an_sales_rfm_v1
with (security_invoker = true)
as
with shipped as (
  select
    sh.customer_party_id,
    sh.ship_date,
    sh.status::text as status,
    coalesce(sl.total_amount_sell_krw, 0) as sell_krw,
    coalesce(sl.purchase_total_cost_krw, coalesce(sl.material_amount_cost_krw, 0) + coalesce(sl.labor_total_cost_krw, 0))
      + coalesce(sl.plating_amount_cost_krw, 0) as cost_krw
  from public.cms_shipment_header sh
  join public.cms_shipment_line sl on sl.shipment_id = sh.shipment_id
  where sh.ship_date is not null
), base as (
  select
    s.customer_party_id,
    current_date as as_of_date,
    (current_date - max(s.ship_date))::int as recency_days,
    count(*) filter (where s.ship_date >= current_date - interval '90 days') as frequency_90d,
    coalesce(sum(s.sell_krw) filter (where s.ship_date >= current_date - interval '90 days'), 0) as monetary_90d_krw,
    coalesce(sum(s.sell_krw - s.cost_krw) filter (where s.ship_date >= current_date - interval '90 days'), 0) as margin_90d_krw,
    coalesce(sum(s.sell_krw) filter (where s.ship_date >= current_date - interval '90 days'), 0) as sell_90d_krw
  from shipped s
  where s.status = 'CONFIRMED'
  group by s.customer_party_id
)
select
  b.customer_party_id,
  p.name as customer_name,
  b.as_of_date,
  b.recency_days,
  b.frequency_90d,
  b.monetary_90d_krw,
  b.margin_90d_krw,
  case when b.sell_90d_krw = 0 then null else b.margin_90d_krw / nullif(b.sell_90d_krw, 0) end as margin_rate_90d,
  greatest(coalesce(ab.balance_krw, 0), 0) as ar_outstanding_krw,
  case when coalesce(ab.balance_krw, 0) > 0 then 1 else 0 end as overdue_count,
  least(100, greatest(0,
    round(
      (100 - least(coalesce(b.recency_days, 999), 120)) * 0.35
      + least(coalesce(b.frequency_90d, 0), 30) * 1.2
      + least(coalesce(b.monetary_90d_krw, 0) / 1000000, 40) * 1.0
      + greatest(coalesce((case when b.sell_90d_krw = 0 then 0 else b.margin_90d_krw / nullif(b.sell_90d_krw, 0) end), 0), 0) * 100 * 0.4
    )
  ))::int as growth_score,
  least(100, greatest(0,
    round(
      greatest(coalesce(ab.balance_krw, 0), 0) / 1000000 * 4
      + case when coalesce(ab.balance_krw, 0) > 0 then 25 else 0 end
      + least(coalesce(b.recency_days, 0), 120) * 0.2
      + case when coalesce((case when b.sell_90d_krw = 0 then 0 else b.margin_90d_krw / nullif(b.sell_90d_krw, 0) end), 0) < 0.1 then 12 else 0 end
    )
  ))::int as risk_score,
  (
    'R' || coalesce(b.recency_days::text, '-')
    || ' F' || coalesce(b.frequency_90d::text, '0')
    || ' M' || coalesce(round(b.monetary_90d_krw)::text, '0')
    || ' AR ' || coalesce(round(greatest(coalesce(ab.balance_krw, 0), 0))::text, '0')
  ) as reason_text,
  ('/workbench/' || b.customer_party_id::text) as app_link
from base b
join public.cms_party p on p.party_id = b.customer_party_id
left join public.cms_v_ar_balance_by_party ab on ab.party_id = b.customer_party_id;

create or replace function public.cms_fn_an_party_reco_preview_v1(
  p_party_id uuid,
  p_from date default current_date - interval '180 days',
  p_to date default current_date,
  p_limit int default 10
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with owned as (
    select distinct coalesce(sl.model_name, '') as model_name
    from public.cms_shipment_header sh
    join public.cms_shipment_line sl on sl.shipment_id = sh.shipment_id
    where sh.customer_party_id = p_party_id
      and sh.status = 'CONFIRMED'
      and sh.ship_date between least(p_from, p_to) and greatest(p_from, p_to)
      and coalesce(sl.model_name, '') <> ''
  ), peers as (
    select distinct sh.customer_party_id
    from public.cms_shipment_header sh
    join public.cms_shipment_line sl on sl.shipment_id = sh.shipment_id
    join owned o on o.model_name = coalesce(sl.model_name, '')
    where sh.status = 'CONFIRMED'
      and sh.ship_date between least(p_from, p_to) and greatest(p_from, p_to)
      and sh.customer_party_id <> p_party_id
  ), candidates as (
    select
      coalesce(sl.model_name, '') as model_name,
      count(*) as co_count,
      count(distinct sh.customer_party_id) as peer_party_count
    from public.cms_shipment_header sh
    join public.cms_shipment_line sl on sl.shipment_id = sh.shipment_id
    join peers p on p.customer_party_id = sh.customer_party_id
    where sh.status = 'CONFIRMED'
      and sh.ship_date between least(p_from, p_to) and greatest(p_from, p_to)
      and coalesce(sl.model_name, '') <> ''
      and coalesce(sl.model_name, '') not in (select model_name from owned)
    group by coalesce(sl.model_name, '')
  ), ranked as (
    select
      c.model_name,
      round((c.co_count * 0.7 + c.peer_party_count * 2.5)::numeric, 2) as score,
      ('최근 180일 동시 구매 ' || c.co_count::text || '회 · 유사고객 ' || c.peer_party_count::text || '곳') as reason_text,
      jsonb_build_object('co_count', c.co_count, 'peer_party_count', c.peer_party_count) as evidence,
      ('/catalog?model=' || c.model_name) as app_link
    from candidates c
    order by score desc, c.model_name asc
    limit least(greatest(coalesce(p_limit, 10), 1), 100)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'model_name', r.model_name,
        'score', r.score,
        'reason_text', r.reason_text,
        'evidence', r.evidence,
        'app_link', r.app_link
      )
      order by r.score desc
    ),
    '[]'::jsonb
  )
  from ranked r;
$$;

create or replace function public.cms_fn_an_overview_summary_v1(
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_leak jsonb;
  v_ar jsonb;
  v_labor jsonb;
  v_stale_count int := 0;
  v_inventory_count int := 0;
  v_sales_count int := 0;
  v_reco_sample_count int := 0;
begin
  v_leak := public.cms_fn_an_leakage_summary_v1(p_from, p_to, null);
  v_ar := public.cms_fn_ar_sot_monitoring_snapshot_v1(1000);
  v_labor := public.cms_fn_shipment_labor_integrity_summary_v1();

  select count(*) into v_stale_count
  from public.cms_v_market_tick_health_v1
  where is_stale = true;

  select count(*) into v_inventory_count
  from public.cms_v_inventory_exceptions_v1;

  select count(*) into v_sales_count
  from public.cms_v_an_sales_rfm_v1;

  select count(*) into v_reco_sample_count
  from (
    select customer_party_id
    from public.cms_v_an_sales_rfm_v1
    order by growth_score desc
    limit 5
  ) s;

  return jsonb_build_object(
    'leakage', jsonb_build_object(
      'neg_margin_count', coalesce((v_leak ->> 'neg_margin_count')::int, 0),
      'below_floor_count', coalesce((v_leak ->> 'below_floor_count')::int, 0),
      'provisional_cost_count', coalesce((v_leak ->> 'provisional_count')::int, 0),
      'stale_tick_count', coalesce((v_leak ->> 'stale_tick_count')::int, 0)
    ),
    'integrity', jsonb_build_object(
      'ar_mismatch_count', coalesce((v_ar ->> 'invoice_ledger_mismatch_count')::int, 0),
      'labor_mismatch_count', coalesce((v_labor ->> 'mismatch_lines')::int, 0),
      'cost_missing_count', 0,
      'inventory_exception_count', v_inventory_count
    ),
    'market', jsonb_build_object(
      'stale_symbol_count', v_stale_count,
      'avg_age_minutes', (
        select coalesce(avg(age_minutes), 0)
        from public.cms_v_market_tick_health_v1
      )
    ),
    'sales', jsonb_build_object(
      'active_customers', v_sales_count,
      'top_growth_count', least(v_sales_count, 5)
    ),
    'recommendations', jsonb_build_object(
      'sampled_parties', v_reco_sample_count
    ),
    'top_issues', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'title', issue_title,
            'severity', severity,
            'impact_krw', impact_krw,
            'href', href
          )
          order by severity_rank asc, impact_krw desc
        ),
        '[]'::jsonb
      )
      from (
        select
          'NEG_MARGIN lines' as issue_title,
          'HIGH' as severity,
          1 as severity_rank,
          coalesce(sum(abs(margin_krw)) filter (where leak_type = 'NEG_MARGIN'), 0) as impact_krw,
          '/analysis/leakage' as href
        from public.cms_v_an_leakage_lines_v1
        where ship_date between least(p_from, p_to) and greatest(p_from, p_to)

        union all

        select
          'BELOW_FLOOR lines',
          'HIGH',
          1,
          coalesce(sum(floor_delta_krw) filter (where leak_type = 'BELOW_FLOOR'), 0),
          '/analysis/leakage'
        from public.cms_v_an_leakage_lines_v1
        where ship_date between least(p_from, p_to) and greatest(p_from, p_to)

        union all

        select
          'AR invoice/ledger mismatch',
          'HIGH',
          1,
          coalesce((v_ar ->> 'invoice_ledger_mismatch_count')::numeric, 0),
          '/analysis/integrity'

        union all

        select
          'Labor mismatch lines',
          'MEDIUM',
          2,
          coalesce((v_labor ->> 'mismatch_lines')::numeric, 0),
          '/analysis/integrity'

        union all

        select
          'Stale market symbols',
          'MEDIUM',
          2,
          coalesce(v_stale_count::numeric, 0),
          '/analysis/market'
      ) ranked
      limit 10
    )
  );
end;
$$;

create or replace function public.cms_fn_an_market_health_summary_v1()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'stale_count', count(*) filter (where is_stale),
    'avg_age_minutes', coalesce(avg(age_minutes), 0),
    'max_age_minutes', coalesce(max(age_minutes), 0)
  )
  from public.cms_v_market_tick_health_v1;
$$;

create or replace function public.cms_fn_an_integrity_snapshot_v1(
  p_limit int default 1000
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'ar', public.cms_fn_ar_sot_monitoring_snapshot_v1(least(greatest(coalesce(p_limit, 1000), 1), 5000)),
    'labor', public.cms_fn_shipment_labor_integrity_summary_v1(),
    'inventory_exception_count', (select count(*) from public.cms_v_inventory_exceptions_v1),
    'cost_missing_count', (select count(*) from public.cms_v_purchase_cost_worklist_v1)
  );
$$;

grant select on public.cms_v_an_leakage_lines_v1 to authenticated, service_role;
grant select on public.cms_v_an_sales_rfm_v1 to authenticated, service_role;

grant execute on function public.cms_fn_an_leakage_summary_v1(date, date, uuid) to authenticated, service_role;
grant execute on function public.cms_fn_an_party_reco_preview_v1(uuid, date, date, int) to authenticated, service_role;
grant execute on function public.cms_fn_an_overview_summary_v1(date, date) to authenticated, service_role;
grant execute on function public.cms_fn_an_market_health_summary_v1() to authenticated, service_role;
grant execute on function public.cms_fn_an_integrity_snapshot_v1(int) to authenticated, service_role;

commit;
