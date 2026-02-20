set search_path = public, pg_temp;
grant execute on function public.cms_fn_set_shipment_store_pickup_v1(uuid, boolean, uuid, text)
  to anon, authenticated, service_role;
