-- cms_0014: pricing policy defaults (labor/plating fallback) + repair cost policy trigger
begin;
-- 1) LABOR RULE PICKER: band_code null/empty => DEFAULT, 없으면 category 내 best fallback
create or replace function public.cms_fn_pick_labor_band_rule(
  p_category_code cms_e_category_code,
  p_band_code text,
  p_on_date date
)
returns table(
  band_id uuid,
  labor_base_sell numeric,
  labor_center_sell numeric,
  labor_sub1_sell numeric,
  labor_sub2_sell numeric,
  labor_bead_sell numeric,
  labor_base_cost numeric,
  labor_center_cost numeric,
  labor_sub1_cost numeric,
  labor_sub2_cost numeric,
  labor_bead_cost numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_band_code text;
begin
  if p_category_code is null then
    return;
  end if;

  v_band_code := nullif(trim(coalesce(p_band_code,'')),'');
  if v_band_code is null then v_band_code := 'DEFAULT'; end if;

  -- exact match
  return query
  select
    r.band_id,
    r.labor_base_sell, r.labor_center_sell, r.labor_sub1_sell, r.labor_sub2_sell, r.labor_bead_sell,
    r.labor_base_cost, r.labor_center_cost, r.labor_sub1_cost, r.labor_sub2_cost, r.labor_bead_cost
  from public.cms_labor_band_rule r
  where r.is_active = true
    and r.category_code = p_category_code
    and r.band_code = v_band_code
    and r.effective_from <= coalesce(p_on_date, current_date)
  order by r.band_rank asc, r.effective_from desc, r.created_at desc
  limit 1;

  if found then return; end if;

  -- fallback best in category
  return query
  select
    r.band_id,
    r.labor_base_sell, r.labor_center_sell, r.labor_sub1_sell, r.labor_sub2_sell, r.labor_bead_sell,
    r.labor_base_cost, r.labor_center_cost, r.labor_sub1_cost, r.labor_sub2_cost, r.labor_bead_cost
  from public.cms_labor_band_rule r
  where r.is_active = true
    and r.category_code = p_category_code
    and r.effective_from <= coalesce(p_on_date, current_date)
  order by r.band_rank asc, r.effective_from desc, r.created_at desc
  limit 1;

  return;
end
$$;
-- 2) PLATING RULE PICKER:
--    - input material_code=00이면 material 무시(variant+category)
--    - 그 외 exact material 우선 -> material=00 룰 fallback
create or replace function public.cms_fn_pick_plating_rule(
  p_plating_variant_id uuid,
  p_category_code cms_e_category_code,
  p_material_code cms_e_material_code,
  p_on_date date
)
returns table(
  rule_id uuid,
  sell_fixed_krw numeric,
  sell_per_g_krw numeric,
  cost_fixed_krw numeric,
  cost_per_g_krw numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_mat text;
begin
  if p_plating_variant_id is null or p_category_code is null then
    return;
  end if;

  v_mat := coalesce(p_material_code::text,'00');

  -- CASE A) input material='00' => ignore material
  if v_mat = '00' then
    return query
    select r.rule_id, r.sell_fixed_krw, r.sell_per_g_krw, r.cost_fixed_krw, r.cost_per_g_krw
    from public.cms_plating_price_rule r
    where r.is_active = true
      and r.plating_variant_id = p_plating_variant_id
      and r.category_code = p_category_code
      and r.effective_from <= coalesce(p_on_date, current_date)
    order by r.priority desc, r.effective_from desc, r.created_at desc
    limit 1;
    return;
  end if;

  -- CASE B) exact material
  return query
  select r.rule_id, r.sell_fixed_krw, r.sell_per_g_krw, r.cost_fixed_krw, r.cost_per_g_krw
  from public.cms_plating_price_rule r
  where r.is_active = true
    and r.plating_variant_id = p_plating_variant_id
    and r.category_code = p_category_code
    and r.material_code::text = v_mat
    and r.effective_from <= coalesce(p_on_date, current_date)
  order by r.priority desc, r.effective_from desc, r.created_at desc
  limit 1;

  if found then return; end if;

  -- CASE C) fallback material='00'
  return query
  select r.rule_id, r.sell_fixed_krw, r.sell_per_g_krw, r.cost_fixed_krw, r.cost_per_g_krw
  from public.cms_plating_price_rule r
  where r.is_active = true
    and r.plating_variant_id = p_plating_variant_id
    and r.category_code = p_category_code
    and r.material_code::text = '00'
    and r.effective_from <= coalesce(p_on_date, current_date)
  order by r.priority desc, r.effective_from desc, r.created_at desc
  limit 1;

  return;
end
$$;
-- 3) REPAIR COST POLICY (BEFORE trigger로 재귀 업데이트 방지)
create or replace function public.cms_fn__repair_cost_policy_trg()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new_cost numeric;
begin
  if coalesce(old.is_priced_final,false) = false and coalesce(new.is_priced_final,false) = true then
    if new.repair_line_id is not null
       and coalesce(new.total_amount_cost_krw,0) = 0
       and coalesce(new.repair_fee_krw,0) > 0
    then
      v_new_cost := greatest(5000, round(coalesce(new.repair_fee_krw,0) * 0.15));
      new.total_amount_cost_krw := v_new_cost;
    end if;
  end if;

  return new;
end
$$;
drop trigger if exists cms_trg_repair_cost_policy on public.cms_shipment_line;
create trigger cms_trg_repair_cost_policy
before update of is_priced_final on public.cms_shipment_line
for each row
execute function public.cms_fn__repair_cost_policy_trg();
commit;
