-- 20260128302400_cms_0218_stocktake_entity_type.sql
set search_path = public, pg_temp;

alter type public.cms_e_entity_type add value if not exists 'STOCKTAKE_SESSION';
alter type public.cms_e_entity_type add value if not exists 'STOCKTAKE_LINE';
