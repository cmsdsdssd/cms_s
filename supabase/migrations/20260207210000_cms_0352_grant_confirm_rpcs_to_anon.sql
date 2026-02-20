set search_path = public, pg_temp;
grant execute on function public.cms_fn_confirm_shipment_v3_cost_v1(
  uuid,
  uuid,
  text,
  boolean,
  uuid,
  text,
  uuid,
  jsonb,
  boolean
) to anon;
grant execute on function public.cms_fn_confirm_store_pickup_v1(
  uuid,
  uuid,
  text,
  boolean,
  uuid,
  text,
  uuid,
  jsonb,
  boolean
) to anon;
grant execute on function public.cms_fn_confirm_shipment(
  uuid,
  uuid,
  text
) to anon;
