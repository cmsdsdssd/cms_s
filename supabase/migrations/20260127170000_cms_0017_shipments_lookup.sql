set search_path = public, pg_temp;
-- 0017: shipment lookup + prefill + manual labor

alter table if exists public.cms_shipment_line
  add column if not exists manual_labor_krw numeric;
drop view if exists public.v_cms_order_lookup;
create view public.v_cms_order_lookup
with (security_invoker = true)
as
select
  o.order_line_id,
  o.order_line_id as order_id,
  left(o.order_line_id::text, 10) as order_no,
  o.created_at::date as order_date,
  o.customer_party_id as client_id,
  p.name as client_name,
  o.model_name as model_no,
  o.color,
  o.status,
  o.is_plated as plating_status,
  o.plating_color_code as plating_color
from public.cms_order_line o
join public.cms_party p on p.party_id = o.customer_party_id;
drop view if exists public.v_cms_shipment_prefill;
create view public.v_cms_shipment_prefill
with (security_invoker = true)
as
select
  o.order_line_id,
  o.order_line_id as order_id,
  left(o.order_line_id::text, 10) as order_no,
  o.created_at::date as order_date,
  o.customer_party_id as client_id,
  p.name as client_name,
  o.model_name as model_no,
  o.color,
  o.is_plated as plating_status,
  o.plating_color_code as plating_color,
  coalesce(m.category_code, null::cms_e_category_code) as category,
  coalesce(o.size, m.labor_band_code) as size,
  o.memo as note,
  m.image_path as photo_url
from public.cms_order_line o
join public.cms_party p on p.party_id = o.customer_party_id
left join public.cms_master_item m on m.model_name = o.model_name;
create or replace function public.cms_fn_shipment_upsert_from_order_line(
  p_order_line_id uuid,
  p_weight_g numeric,
  p_total_labor numeric,
  p_actor_person_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.cms_order_line%rowtype;
  v_shipment_id uuid;
  v_line_id uuid;
begin
  if p_order_line_id is null then raise exception 'order_line_id required'; end if;
  if p_weight_g is null or p_weight_g <= 0 then raise exception 'weight_g must be > 0'; end if;
  if p_total_labor is null or p_total_labor <= 0 then raise exception 'total_labor must be > 0'; end if;

  select * into v_order
  from public.cms_order_line
  where order_line_id = p_order_line_id;

  if not found then
    raise exception 'order_line not found: %', p_order_line_id;
  end if;

  select shipment_id into v_shipment_id
  from public.cms_shipment_header
  where customer_party_id = v_order.customer_party_id
    and status = 'DRAFT'
  order by created_at desc
  limit 1;

  if v_shipment_id is null then
    v_shipment_id := public.cms_fn_create_shipment_header_v1(
      v_order.customer_party_id,
      current_date,
      null
    );
  end if;

  v_line_id := public.cms_fn_add_shipment_line_from_order_v1(
    v_shipment_id,
    v_order.order_line_id,
    v_order.qty,
    'RULE'::cms_e_pricing_mode,
    null,
    null,
    v_order.is_plated,
    v_order.plating_variant_id,
    null,
    null,
    null
  );

  update public.cms_shipment_line
  set measured_weight_g = p_weight_g,
      manual_labor_krw = p_total_labor
  where shipment_line_id = v_line_id;

  return jsonb_build_object(
    'shipment_id', v_shipment_id,
    'shipment_line_id', v_line_id,
    'status', 'DRAFT'
  );
end $$;
grant select on public.v_cms_order_lookup to anon, authenticated;
grant select on public.v_cms_shipment_prefill to anon, authenticated;
grant execute on function public.cms_fn_shipment_upsert_from_order_line(uuid, numeric, numeric, uuid, uuid) to authenticated;
