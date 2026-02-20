set search_path = public, pg_temp;
alter function public.cms_fn_confirm_shipment(uuid, uuid, text)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_confirm_shipment(uuid, uuid, text) to authenticated;
