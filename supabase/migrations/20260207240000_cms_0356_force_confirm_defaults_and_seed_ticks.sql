set search_path = public, pg_temp;
-- Fallback defaults to unblock confirmation when data is incomplete
update public.cms_shipment_line
set category_code = 'ETC'::public.cms_e_category_code
where category_code is null;
update public.cms_shipment_line
set material_code = '00'::public.cms_e_material_code
where material_code is null;
update public.cms_shipment_line
set measured_weight_g = 0
where measured_weight_g is null
  and material_code <> '00'::public.cms_e_material_code;
-- Seed market ticks if missing (required by confirm for gold/silver)
insert into public.cms_market_tick(symbol, price, observed_at, source, meta)
select 'GOLD_KRW_PER_G'::public.cms_e_market_symbol, 0, now(), 'seed', '{}'::jsonb
where not exists (
  select 1 from public.cms_market_tick where symbol = 'GOLD_KRW_PER_G'::public.cms_e_market_symbol
);
insert into public.cms_market_tick(symbol, price, observed_at, source, meta)
select 'SILVER_KRW_PER_G'::public.cms_e_market_symbol, 0, now(), 'seed', '{}'::jsonb
where not exists (
  select 1 from public.cms_market_tick where symbol = 'SILVER_KRW_PER_G'::public.cms_e_market_symbol
);
