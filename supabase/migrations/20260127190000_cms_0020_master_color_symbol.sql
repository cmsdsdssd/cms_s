set search_path = public, pg_temp;

alter table if exists public.cms_master_item
  add column if not exists color text,
  add column if not exists symbol text;

drop view if exists public.v_cms_master_item_lookup;

create view public.v_cms_master_item_lookup
with (security_invoker = true)
as
with ticks as (
  select
    (select price from public.cms_fn_latest_tick('GOLD_KRW_PER_G')) as gold_price,
    (select price from public.cms_fn_latest_tick('SILVER_KRW_PER_G')) as silver_price
)
select
  m.master_id as master_item_id,
  m.model_name,
  m.image_path as photo_url,
  m.material_code_default,
  m.category_code,
  m.symbol,
  m.color,
  m.weight_default_g,
  m.deduction_weight_default_g,
  m.center_qty_default,
  m.sub1_qty_default,
  m.sub2_qty_default,
  p.name as vendor_name,
  case
    when m.weight_default_g is null then null
    when m.material_code_default in ('14','18','24') then
      round(
        m.weight_default_g * case m.material_code_default
          when '14' then coalesce(t.gold_price, 0) * 0.6435
          when '18' then coalesce(t.gold_price, 0) * 0.8250
          when '24' then coalesce(t.gold_price, 0)
          else 0
        end,
        0
      )
    when m.material_code_default = '925' then
      round(m.weight_default_g * coalesce(t.silver_price, 0) * 0.925, 0)
    else null
  end as material_price,
  m.labor_base_sell as labor_basic,
  m.labor_center_sell as labor_center,
  m.labor_sub1_sell as labor_side1,
  m.labor_sub2_sell as labor_side2,
  m.labor_base_cost,
  m.labor_center_cost,
  m.labor_sub1_cost,
  m.labor_sub2_cost
from public.cms_master_item m
left join public.cms_party p on p.party_id = m.vendor_party_id
cross join ticks t;

grant select on public.v_cms_master_item_lookup to anon, authenticated;
