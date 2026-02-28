set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1012_shop_variant_snapshot_view_fix_addonly
-- Make current-price snapshots and dashboard joins variant-aware.
-- -----------------------------------------------------------------------------

alter table if exists public.channel_price_snapshot
  add column if not exists external_variant_code text not null default '';

update public.channel_price_snapshot
set external_variant_code = coalesce(nullif(btrim(external_variant_code), ''), '')
where external_variant_code is null
   or external_variant_code <> coalesce(nullif(btrim(external_variant_code), ''), '');

create index if not exists idx_channel_price_snapshot_latest_variant
  on public.channel_price_snapshot(channel_id, external_product_no, external_variant_code, fetched_at desc);

alter table if exists public.price_sync_job_item
  add column if not exists external_variant_code text not null default '';

update public.price_sync_job_item
set external_variant_code = coalesce(nullif(btrim(external_variant_code), ''), '')
where external_variant_code is null
   or external_variant_code <> coalesce(nullif(btrim(external_variant_code), ''), '');

create index if not exists idx_price_sync_job_item_variant
  on public.price_sync_job_item(channel_id, external_product_no, external_variant_code, updated_at desc);

drop view if exists public.v_channel_price_dashboard;
drop view if exists public.channel_price_snapshot_latest;
create view public.channel_price_snapshot_latest
with (security_invoker = true)
as
with ranked as (
  select
    cps.*,
    row_number() over (
      partition by cps.channel_id, cps.external_product_no, cps.external_variant_code
      order by cps.fetched_at desc, cps.created_at desc
    ) as rn
  from public.channel_price_snapshot cps
)
select *
from ranked
where rn = 1;

create view public.v_channel_price_dashboard
with (security_invoker = true)
as
with map as (
  select
    scp.channel_product_id,
    scp.channel_id,
    scp.master_item_id,
    scp.external_product_no,
    coalesce(nullif(btrim(scp.external_variant_code), ''), '') as external_variant_code,
    scp.is_active as mapping_is_active
  from public.sales_channel_product scp
),
ps as (
  select * from public.pricing_snapshot_latest
),
cp as (
  select * from public.channel_price_snapshot_latest
),
ov as (
  select
    o.channel_id,
    o.master_item_id,
    o.override_id,
    o.override_price_krw,
    o.reason as override_reason,
    row_number() over (
      partition by o.channel_id, o.master_item_id
      order by o.updated_at desc
    ) as rn
  from public.pricing_override o
  where o.is_active = true
),
adj as (
  select
    a.channel_id,
    coalesce(a.channel_product_id, '00000000-0000-0000-0000-000000000000'::uuid) as channel_product_id,
    coalesce(a.master_item_id, '00000000-0000-0000-0000-000000000000'::uuid) as master_item_id,
    count(*) filter (where a.is_active = true) as active_adjustment_count
  from public.pricing_adjustment a
  group by a.channel_id,
           coalesce(a.channel_product_id, '00000000-0000-0000-0000-000000000000'::uuid),
           coalesce(a.master_item_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
select
  m.channel_id,
  c.channel_code,
  c.channel_name,
  m.channel_product_id,
  m.external_product_no,
  m.external_variant_code,
  m.master_item_id,
  mi.model_name,
  mi.category_code,
  coalesce(ps.tick_as_of, cp.fetched_at) as as_of_at,

  ps.tick_source,
  ps.tick_gold_krw_g,
  ps.tick_silver_krw_g,

  ps.net_weight_g,
  ps.material_raw_krw,
  ps.factor_set_id_used,
  ps.material_factor_multiplier_used,
  ps.material_final_krw,
  ps.labor_raw_krw,
  ps.labor_pre_margin_adj_krw,
  ps.labor_post_margin_adj_krw,
  ps.total_pre_margin_adj_krw,
  ps.total_post_margin_adj_krw,
  ps.base_total_pre_margin_krw,
  ps.margin_multiplier_used,
  ps.total_after_margin_krw,
  ps.target_price_raw_krw,
  ps.rounding_unit_used,
  ps.rounding_mode_used,
  ps.rounded_target_price_krw,
  ps.override_price_krw,
  ps.final_target_price_krw,
  ps.breakdown_json,
  ps.applied_adjustment_ids,
  ps.computed_at,

  cp.current_price_krw as current_channel_price_krw,
  cp.fetched_at as channel_price_fetched_at,
  cp.fetch_status,
  cp.http_status,
  cp.error_code,
  cp.error_message,

  ov.override_id as active_override_id,
  ov.override_price_krw as active_override_price_krw,
  ov.override_reason,

  coalesce(adj_cp.active_adjustment_count, 0) + coalesce(adj_mi.active_adjustment_count, 0) as active_adjustment_count,

  case
    when ps.final_target_price_krw is null or cp.current_price_krw is null then null
    else ps.final_target_price_krw - cp.current_price_krw
  end as diff_krw,

  case
    when ps.final_target_price_krw is null or cp.current_price_krw is null or cp.current_price_krw = 0 then null
    else (ps.final_target_price_krw - cp.current_price_krw) / cp.current_price_krw::numeric
  end as diff_pct,

  case
    when m.channel_product_id is null then 'UNMAPPED'::public.shop_e_price_state
    when cp.fetch_status = 'FAILED' then 'ERROR'::public.shop_e_price_state
    when ps.final_target_price_krw is null or cp.current_price_krw is null then 'ERROR'::public.shop_e_price_state
    when abs(ps.final_target_price_krw - cp.current_price_krw) >= 1 then 'OUT_OF_SYNC'::public.shop_e_price_state
    else 'OK'::public.shop_e_price_state
  end as price_state

from map m
join public.sales_channel c
  on c.channel_id = m.channel_id
left join public.cms_master_item mi
  on mi.master_item_id = m.master_item_id
left join ps
  on ps.channel_id = m.channel_id
 and ps.master_item_id = m.master_item_id
left join cp
  on cp.channel_id = m.channel_id
 and cp.external_product_no = m.external_product_no
 and cp.external_variant_code = m.external_variant_code
left join ov
  on ov.channel_id = m.channel_id
 and ov.master_item_id = m.master_item_id
 and ov.rn = 1
left join adj adj_cp
  on adj_cp.channel_id = m.channel_id
 and adj_cp.channel_product_id = m.channel_product_id
 and adj_cp.master_item_id = '00000000-0000-0000-0000-000000000000'::uuid
left join adj adj_mi
  on adj_mi.channel_id = m.channel_id
 and adj_mi.channel_product_id = '00000000-0000-0000-0000-000000000000'::uuid
 and adj_mi.master_item_id = m.master_item_id;
