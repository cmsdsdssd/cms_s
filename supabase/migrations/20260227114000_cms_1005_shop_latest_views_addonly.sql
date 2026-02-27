set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1005_shop_latest_views_addonly
-- Wave1: latest helper views + helper functions
-- -----------------------------------------------------------------------------

drop view if exists public.pricing_snapshot_latest;
create view public.pricing_snapshot_latest
with (security_invoker = true)
as
with ranked as (
  select
    ps.*,
    row_number() over (
      partition by ps.channel_id, ps.master_item_id
      order by ps.computed_at desc, ps.created_at desc
    ) as rn
  from public.pricing_snapshot ps
)
select *
from ranked
where rn = 1;

drop view if exists public.channel_price_snapshot_latest;
create view public.channel_price_snapshot_latest
with (security_invoker = true)
as
with ranked as (
  select
    cps.*,
    row_number() over (
      partition by cps.channel_id, cps.external_product_no
      order by cps.fetched_at desc, cps.created_at desc
    ) as rn
  from public.channel_price_snapshot cps
)
select *
from ranked
where rn = 1;

create or replace function public.shop_fn_pick_effective_factor_set_v1(
  p_channel_id uuid
) returns uuid
language sql
stable
as $$
  with policy_pick as (
    select p.material_factor_set_id as factor_set_id
    from public.pricing_policy p
    where p.channel_id = p_channel_id
      and p.is_active = true
      and p.material_factor_set_id is not null
    order by p.updated_at desc
    limit 1
  ),
  global_pick as (
    select fs.factor_set_id
    from public.material_factor_set fs
    where fs.scope = 'GLOBAL'
      and fs.is_active = true
      and fs.is_global_default = true
    order by fs.updated_at desc
    limit 1
  )
  select coalesce((select factor_set_id from policy_pick), (select factor_set_id from global_pick));
$$;

create or replace function public.shop_fn_active_adjustments_v1(
  p_channel_id uuid,
  p_channel_product_id uuid default null,
  p_master_item_id uuid default null,
  p_at timestamptz default now()
) returns setof public.pricing_adjustment
language sql
stable
as $$
  select a.*
  from public.pricing_adjustment a
  where a.channel_id = p_channel_id
    and a.is_active = true
    and (a.valid_from is null or a.valid_from <= p_at)
    and (a.valid_to is null or a.valid_to >= p_at)
    and (
      (p_channel_product_id is not null and a.channel_product_id = p_channel_product_id)
      or
      (p_master_item_id is not null and a.master_item_id = p_master_item_id)
    )
  order by a.priority asc, a.created_at asc;
$$;

create or replace function public.shop_fn_active_override_v1(
  p_channel_id uuid,
  p_master_item_id uuid,
  p_at timestamptz default now()
) returns table(
  override_id uuid,
  override_price_krw numeric,
  reason text
)
language sql
stable
as $$
  select
    o.override_id,
    o.override_price_krw,
    o.reason
  from public.pricing_override o
  where o.channel_id = p_channel_id
    and o.master_item_id = p_master_item_id
    and o.is_active = true
    and (o.valid_from is null or o.valid_from <= p_at)
    and (o.valid_to is null or o.valid_to >= p_at)
  order by o.updated_at desc
  limit 1;
$$;
