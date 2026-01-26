-- seed.sql (local testing)
-- 목적: 로컬에서 뷰/RPC가 실제로 굴러가는지 즉시 검증

-- 고정 UUID (테스트 편의)
-- customers
insert into cms_party(party_id, party_type, name, phone, region, note)
values
  ('11111111-1111-1111-1111-111111111111','customer','소매A','010-1111-1111','서울','seed'),
  ('11111111-1111-1111-1111-222222222222','customer','소매B','010-2222-2222','부산','seed')
on conflict do nothing;

-- vendor
insert into cms_party(party_id, party_type, name, phone, region, note)
values
  ('22222222-2222-2222-2222-222222222222','vendor','공장AB','010-9999-0000','중국','seed')
on conflict do nothing;

-- vendor prefix map: AB-
insert into cms_vendor_prefix_map(prefix, vendor_party_id, note)
values ('AB','22222222-2222-2222-2222-222222222222','seed')
on conflict do nothing;

-- master items
insert into cms_master_item(
  master_id, model_name, vendor_party_id, category_code,
  material_code_default, weight_default_g, deduction_weight_default_g,
  labor_base_sell, labor_center_sell, labor_sub1_sell, labor_sub2_sell, labor_bead_sell,
  labor_base_cost, labor_center_cost, labor_sub1_cost, labor_sub2_cost, labor_bead_cost,
  plating_price_sell_default, plating_price_cost_default,
  labor_profile_mode, labor_band_code,
  note
)
values
  ('aaaaaaaa-0000-0000-0000-000000000001','AB-1001','22222222-2222-2222-2222-222222222222','RING',
   '14', 2.2, 0.1,
   30000, 5000, 3000, 0, 0,
   18000, 3000, 2000, 0, 0,
   5000, 3000,
   'MANUAL', null,
   'seed ring 14k'
  ),
  ('aaaaaaaa-0000-0000-0000-000000000002','AB-2001','22222222-2222-2222-2222-222222222222','NECKLACE',
   '925', 4.0, 0.0,
   20000, 0, 0, 0, 0,
   12000, 0, 0, 0, 0,
   0, 0,
   'BAND', 'B3',
   'seed necklace 925 band'
  )
on conflict do nothing;

-- band rule for NECKLACE / B3
insert into cms_labor_band_rule(
  band_id, category_code, band_code, band_rank, effective_from, is_active,
  labor_base_sell, labor_center_sell, labor_sub1_sell, labor_sub2_sell, labor_bead_sell,
  labor_base_cost, labor_center_cost, labor_sub1_cost, labor_sub2_cost, labor_bead_cost,
  note
)
values
  ('bbbbbbbb-0000-0000-0000-000000000003','NECKLACE','B3',3,current_date,true,
   22000,0,0,0,0,
   14000,0,0,0,0,
   'seed band'
  )
on conflict do nothing;

-- market ticks
insert into cms_market_tick(tick_id, symbol, price, observed_at, source, meta)
values
  ('cccccccc-0000-0000-0000-000000000001','GOLD_KRW_PER_G', 100000, now() - interval '1 hour', 'seed', '{}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000002','SILVER_KRW_PER_G', 1200,  now() - interval '1 hour', 'seed', '{}'::jsonb)
on conflict do nothing;

-- plating price rules (example)
-- P: RING + 14 fixed 6,000 sell / 3,500 cost
insert into cms_plating_price_rule(
  rule_id, plating_variant_id, category_code, material_code, effective_from, is_active, priority,
  sell_fixed_krw, cost_fixed_krw, sell_per_g_krw, cost_per_g_krw, note
)
select
  'dddddddd-0000-0000-0000-000000000001',
  pv.plating_variant_id,
  'RING'::cms_e_category_code,
  '14'::cms_e_material_code,
  current_date, true, 10,
  6000, 3500, 0, 0,
  'seed P ring 14'
from cms_plating_variant pv
where pv.plating_type = 'P'
limit 1
on conflict do nothing;

-- G: general fixed 8,000 sell / 5,000 cost
insert into cms_plating_price_rule(
  rule_id, plating_variant_id, category_code, material_code, effective_from, is_active, priority,
  sell_fixed_krw, cost_fixed_krw, sell_per_g_krw, cost_per_g_krw, note
)
select
  'dddddddd-0000-0000-0000-000000000002',
  pv.plating_variant_id,
  null, null,
  current_date, true, 100,
  8000, 5000, 0, 0,
  'seed G general'
from cms_plating_variant pv
where pv.plating_type = 'G'
limit 1
on conflict do nothing;

-- order lines
insert into cms_order_line(
  order_line_id, customer_party_id, model_name, model_name_raw, suffix, color, size, qty,
  is_plated, plating_variant_id,
  requested_due_date, priority_code,
  memo, status, vendor_party_id_guess, matched_master_id, match_state
)
select
  'eeeeeeee-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'AB-1001', 'AB1001', 'R', 'Y', '14', 1,
  true, pv.plating_variant_id,
  current_date + 7, 'NORMAL',
  'seed order', 'ORDER_PENDING',
  '22222222-2222-2222-2222-222222222222',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'AUTO_MATCHED'
from cms_plating_variant pv
where pv.plating_type = 'P'
limit 1
on conflict do nothing;

-- repair line (00 material: 공임/도금만)
insert into cms_repair_line(
  repair_line_id, customer_party_id, received_at,
  model_name, model_name_raw, suffix, material_code, color, qty,
  is_paid, repair_fee_krw,
  is_plated, plating_variant_id,
  memo, status
)
select
  'ffffffff-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  current_date,
  null, '수리-원문', 'R', '00', 'Y', 1,
  true, 30000,
  true, pv.plating_variant_id,
  'seed repair', 'RECEIVED'
from cms_plating_variant pv
where pv.plating_type = 'G'
limit 1
on conflict do nothing;

-- shipment draft
insert into cms_shipment_header(shipment_id, customer_party_id, ship_date, memo, status)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111', current_date, 'seed shipment', 'DRAFT')
on conflict do nothing;

-- shipment lines: 1) order ref (RULE)
insert into cms_shipment_line(
  shipment_line_id, shipment_id, order_line_id,
  pricing_mode,
  measured_weight_g, deduction_weight_g,
  is_plated, plating_variant_id,
  silver_adjust_factor
)
select
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'eeeeeeee-0000-0000-0000-000000000001',
  'RULE',
  2.10, 0.10,
  true, pv.plating_variant_id,
  1.2
from cms_plating_variant pv
where pv.plating_type='P'
limit 1
on conflict do nothing;

-- shipment lines: 2) repair ref (RULE, material 00이라 weight 없어도 됨)
insert into cms_shipment_line(
  shipment_line_id, shipment_id, repair_line_id,
  pricing_mode,
  is_plated, plating_variant_id,
  material_code,
  repair_fee_krw
)
select
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'ffffffff-0000-0000-0000-000000000001',
  'RULE',
  true, pv.plating_variant_id,
  '00',
  30000
from cms_plating_variant pv
where pv.plating_type='G'
limit 1
on conflict do nothing;
