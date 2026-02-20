set search_path = public, pg_temp;
-- Remove old 6-arg overloads that collide with newer 8-arg signatures
-- (8-arg functions keep defaults for the last two params, so 6-arg calls still work)
drop function if exists public.cms_fn_shipment_update_line_v1(uuid, numeric, numeric, numeric, numeric, jsonb);
drop function if exists public.cms_fn_update_shipment_line_v1(uuid, numeric, numeric, numeric, numeric, jsonb);
grant execute on function public.cms_fn_shipment_update_line_v1(
  uuid,
  numeric,
  numeric,
  numeric,
  numeric,
  jsonb,
  cms_e_pricing_mode,
  numeric
) to authenticated;
grant execute on function public.cms_fn_update_shipment_line_v1(
  uuid,
  numeric,
  numeric,
  numeric,
  numeric,
  jsonb,
  cms_e_pricing_mode,
  numeric
) to authenticated;
