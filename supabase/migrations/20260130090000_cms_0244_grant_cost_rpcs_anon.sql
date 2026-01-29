-- 20260130090000_cms_0244_grant_cost_rpcs_anon.sql

grant execute on function public.cms_fn_apply_purchase_cost_to_shipment_v1(uuid,text,uuid,jsonb,uuid,text,uuid,boolean) to anon, authenticated, service_role;
grant execute on function public.cms_fn_confirm_shipment_v3_cost_v1(uuid,uuid,text,boolean,uuid,text,uuid,jsonb,boolean) to anon, authenticated, service_role;
