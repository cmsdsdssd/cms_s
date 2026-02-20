set search_path = public, pg_temp;
-- 0005: reference data (must exist in every env)

-- 湲곕낯 ?꾧툑 variant (P/W/G)
insert into cms_plating_variant(plating_type, display_name, is_active)
values
  ('P','P (Phase1)', true),
  ('W','W (Phase1)', true),
  ('G','G (Phase1)', true)
on conflict do nothing;
