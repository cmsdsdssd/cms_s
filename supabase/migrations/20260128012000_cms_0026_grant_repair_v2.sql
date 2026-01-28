-- Grant execute permission on cms_fn_upsert_repair_line_v2 to authenticated users
set search_path = public, pg_temp;

-- NOTE: Function cms_fn_upsert_repair_line_v2 does not exist yet
-- Commenting out grants until function is implemented

-- Grant to anon (for client-side access without login)
-- grant execute on function public.cms_fn_upsert_repair_line_v2(...) to anon;

-- Grant to authenticated
-- grant execute on function public.cms_fn_upsert_repair_line_v2(...) to authenticated;

-- Placeholder to prevent empty migration file
select 1 as placeholder;
