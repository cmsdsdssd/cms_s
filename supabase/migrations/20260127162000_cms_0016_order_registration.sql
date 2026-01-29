set search_path = public, pg_temp;

-- 0016: order registration support objects

alter table if exists public.cms_master_item
  add column if not exists image_path text;

create table if not exists public.cms_stone_catalog (
  stone_id uuid primary key default gen_random_uuid(),
  stone_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
drop view if exists public.v_cms_stone_catalog;
create view public.v_cms_stone_catalog
with (security_invoker = true)
as
select stone_id, stone_name
from public.cms_stone_catalog
where is_active = true;
drop view if exists public.v_cms_plating_color;
create view public.v_cms_plating_color
with (security_invoker = true)
as
select distinct color_code
from public.cms_plating_variant
where is_active = true
  and color_code is not null
order by color_code;
drop view if exists public.v_cms_ar_client_summary;
create view public.v_cms_ar_client_summary
with (security_invoker = true)
as
select
  p.party_id as client_id,
  p.name as client_name,
  coalesce(sum(l.amount_krw), 0) as balance_krw,
  max(l.occurred_at) as last_tx_at,
  null::int as open_invoices_count,
  null::numeric as credit_limit_krw,
  null::text as risk_flag
from public.cms_party p
left join public.cms_ar_ledger l on l.party_id = p.party_id
where p.party_type = 'customer'
  and p.is_active = true
group by p.party_id, p.name;

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
  m.weight_default_g,
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
  m.labor_sub2_sell as labor_side2
from public.cms_master_item m
cross join ticks t;

alter table if exists public.cms_order_line
  add column if not exists center_stone_name text,
  add column if not exists center_stone_qty int,
  add column if not exists sub1_stone_name text,
  add column if not exists sub1_stone_qty int,
  add column if not exists sub2_stone_name text,
  add column if not exists sub2_stone_qty int,
  add column if not exists plating_color_code text;

drop function if exists public.cms_fn_upsert_order_line_v2(
  uuid, text, text, text, int, text, boolean, uuid, date, cms_e_priority_code, text, text, text, uuid
);

create or replace function public.cms_fn_upsert_order_line_v2(
  p_customer_party_id uuid,
  p_model_name text,
  p_suffix text,
  p_color text,
  p_qty int default 1,
  p_size text default null,
  p_is_plated boolean default false,
  p_plating_variant_id uuid default null,
  p_requested_due_date date default null,
  p_priority_code cms_e_priority_code default 'NORMAL',
  p_source_channel text default null,
  p_model_name_raw text default null,
  p_memo text default null,
  p_order_line_id uuid default null,
  p_center_stone_name text default null,
  p_center_stone_qty int default null,
  p_sub1_stone_name text default null,
  p_sub1_stone_qty int default null,
  p_sub2_stone_name text default null,
  p_sub2_stone_qty int default null,
  p_plating_color_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_model_name text;
  v_suffix text;
  v_color text;
begin
  if p_customer_party_id is null then raise exception 'customer_party_id required'; end if;
  v_model_name := trim(coalesce(p_model_name, ''));
  v_suffix := trim(coalesce(p_suffix, ''));
  v_color := trim(coalesce(p_color, ''));
  if length(v_model_name) = 0 then raise exception 'model_name required'; end if;
  if length(v_suffix) = 0 then raise exception 'suffix required'; end if;
  if length(v_color) = 0 then raise exception 'color required'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'qty must be > 0'; end if;

  if coalesce(p_is_plated, false) is true and (p_plating_color_code is null or length(trim(p_plating_color_code)) = 0) then
    raise exception 'plating_color_code required when is_plated=true';
  end if;

  if (p_center_stone_name is null and coalesce(p_center_stone_qty, 0) > 0) then
    raise exception 'center_stone_name required when center_stone_qty > 0';
  end if;
  if (p_center_stone_name is not null and coalesce(p_center_stone_qty, 0) <= 0) then
    raise exception 'center_stone_qty must be > 0 when center_stone_name provided';
  end if;
  if (p_sub1_stone_name is null and coalesce(p_sub1_stone_qty, 0) > 0) then
    raise exception 'sub1_stone_name required when sub1_stone_qty > 0';
  end if;
  if (p_sub1_stone_name is not null and coalesce(p_sub1_stone_qty, 0) <= 0) then
    raise exception 'sub1_stone_qty must be > 0 when sub1_stone_name provided';
  end if;
  if (p_sub2_stone_name is null and coalesce(p_sub2_stone_qty, 0) > 0) then
    raise exception 'sub2_stone_name required when sub2_stone_qty > 0';
  end if;
  if (p_sub2_stone_name is not null and coalesce(p_sub2_stone_qty, 0) <= 0) then
    raise exception 'sub2_stone_qty must be > 0 when sub2_stone_name provided';
  end if;

  v_id := coalesce(p_order_line_id, gen_random_uuid());

  insert into public.cms_order_line(
    order_line_id,
    customer_party_id,
    model_name,
    model_name_raw,
    suffix,
    color,
    size,
    qty,
    is_plated,
    plating_variant_id,
    plating_color_code,
    requested_due_date,
    priority_code,
    source_channel,
    memo,
    center_stone_name,
    center_stone_qty,
    sub1_stone_name,
    sub1_stone_qty,
    sub2_stone_name,
    sub2_stone_qty
  )
  values(
    v_id,
    p_customer_party_id,
    v_model_name,
    nullif(coalesce(p_model_name_raw, ''), ''),
    v_suffix,
    v_color,
    nullif(trim(coalesce(p_size,'')), ''),
    p_qty,
    coalesce(p_is_plated,false),
    p_plating_variant_id,
    nullif(trim(coalesce(p_plating_color_code,'')), ''),
    p_requested_due_date,
    coalesce(p_priority_code, 'NORMAL'::cms_e_priority_code),
    nullif(trim(coalesce(p_source_channel,'')), ''),
    p_memo,
    nullif(trim(coalesce(p_center_stone_name,'')), ''),
    p_center_stone_qty,
    nullif(trim(coalesce(p_sub1_stone_name,'')), ''),
    p_sub1_stone_qty,
    nullif(trim(coalesce(p_sub2_stone_name,'')), ''),
    p_sub2_stone_qty
  )
  on conflict (order_line_id) do update set
    customer_party_id  = excluded.customer_party_id,
    model_name         = excluded.model_name,
    model_name_raw     = excluded.model_name_raw,
    suffix             = excluded.suffix,
    color              = excluded.color,
    size               = excluded.size,
    qty                = excluded.qty,
    is_plated          = excluded.is_plated,
    plating_variant_id = excluded.plating_variant_id,
    plating_color_code = excluded.plating_color_code,
    requested_due_date = excluded.requested_due_date,
    priority_code      = excluded.priority_code,
    source_channel     = excluded.source_channel,
    memo               = excluded.memo,
    center_stone_name  = excluded.center_stone_name,
    center_stone_qty   = excluded.center_stone_qty,
    sub1_stone_name    = excluded.sub1_stone_name,
    sub1_stone_qty     = excluded.sub1_stone_qty,
    sub2_stone_name    = excluded.sub2_stone_name,
    sub2_stone_qty     = excluded.sub2_stone_qty;

  return v_id;
end $$;

do $$
declare r record;
begin
  for r in
    select
      n.nspname as schema_name,
      p.proname as fn_name,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'cms\_fn\_%' escape '\'
  loop
    execute format('grant execute on function public.%I(%s) to authenticated;', r.fn_name, r.args);
  end loop;
end $$;

grant select on public.v_cms_ar_client_summary to authenticated;
grant select on public.v_cms_master_item_lookup to authenticated;
grant select on public.v_cms_stone_catalog to authenticated;
grant select on public.v_cms_plating_color to authenticated;
