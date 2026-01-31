set search_path = public, pg_temp;

-- Add MANUAL to pricing mode enum (latest timestamp migration)
alter type public.cms_e_pricing_mode add value if not exists 'MANUAL';
