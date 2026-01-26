-- 0005: reference data (must exist in every env)

-- 기본 도금 variant (P/W/G)
insert into cms_plating_variant(plating_type, display_name, is_active)
values
  ('P','P (Phase1)', true),
  ('W','W (Phase1)', true),
  ('G','G (Phase1)', true)
on conflict do nothing;
