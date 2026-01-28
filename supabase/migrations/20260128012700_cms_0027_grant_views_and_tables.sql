-- Grant SELECT on views to anon role for client-side access
set search_path = public, pg_temp;

-- Grant access to repair enriched view for both anon and authenticated
grant select on public.cms_v_repair_line_enriched_v1 to anon;
grant select on public.cms_v_repair_line_enriched_v1 to authenticated;

-- Grant access to party table for dropdown
grant select on public.cms_party to anon;
grant select on public.cms_party to authenticated;

-- Grant access to plating variant table for dropdown
grant select on public.cms_plating_variant to anon;
grant select on public.cms_plating_variant to authenticated;

-- Grant access to shipment tables for model lookup
grant select on public.cms_shipment_line to anon;
grant select on public.cms_shipment_line to authenticated;
grant select on public.cms_shipment_header to anon;
grant select on public.cms_shipment_header to authenticated;
