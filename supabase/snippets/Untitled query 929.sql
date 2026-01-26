select
  n.nspname as schema,
  p.proname as fn,
  length(pg_get_functiondef(p.oid)) as def_len,
  left(pg_get_functiondef(p.oid), 200) as head_200
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and p.proname='cms_fn_confirm_shipment';
