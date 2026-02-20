set search_path = public, pg_temp;

with decor_source as (
  select
    r.product_master_id as master_id,
    l.bom_line_id,
    concat('BOM_DECOR_LINE:', l.bom_line_id::text, ';QTY_PER_UNIT:', greatest(coalesce(l.qty_per_unit, 0), 0)::text) as decor_note,
    concat('장식:', coalesce(nullif(trim(cm.model_name), ''), '장식')) as decor_reason,
    greatest(
      (
        coalesce(cm.labor_base_sell, 0)
        + coalesce(cm.labor_center_sell, 0) * greatest(coalesce(cm.center_qty_default, 0), 0)
        + coalesce(cm.labor_sub1_sell, 0) * greatest(coalesce(cm.sub1_qty_default, 0), 0)
        + coalesce(cm.labor_sub2_sell, 0) * greatest(coalesce(cm.sub2_qty_default, 0), 0)
      ) * greatest(coalesce(l.qty_per_unit, 0), 0),
      0
    ) as decor_amount_krw
  from public.cms_bom_recipe r
  join public.cms_bom_recipe_line l
    on l.bom_id = r.bom_id
   and coalesce(l.is_void, false) = false
   and upper(coalesce(l.note, '')) like 'LINE_KIND:DECOR%'
   and l.component_master_id is not null
  join public.cms_master_item cm
    on cm.master_id = l.component_master_id
  where r.is_active = true
), updated as (
  update public.cms_master_absorb_labor_item_v1 a
  set
    bucket = 'ETC',
    label = s.decor_reason,
    reason = s.decor_reason,
    amount_krw = s.decor_amount_krw,
    is_per_piece = true,
    is_active = true,
    labor_class = 'GENERAL',
    material_qty_per_unit = 1,
    material_cost_krw = 0,
    updated_at = now()
  from decor_source s
  where a.master_id = s.master_id
    and coalesce(a.note, '') = s.decor_note
    and a.vendor_party_id is null
  returning a.absorb_id
), inserted as (
  insert into public.cms_master_absorb_labor_item_v1 (
    absorb_id,
    absorb_item_id,
    master_id,
    bucket,
    label,
    reason,
    amount_krw,
    is_per_piece,
    priority,
    is_active,
    note,
    labor_class,
    material_qty_per_unit,
    material_cost_krw,
    created_at,
    updated_at
  )
  select
    gen_random_uuid(),
    gen_random_uuid(),
    s.master_id,
    'ETC',
    s.decor_reason,
    s.decor_reason,
    s.decor_amount_krw,
    true,
    100,
    true,
    s.decor_note,
    'GENERAL',
    1,
    0,
    now(),
    now()
  from decor_source s
  where not exists (
    select 1
    from public.cms_master_absorb_labor_item_v1 a
    where a.master_id = s.master_id
      and coalesce(a.note, '') = s.decor_note
      and a.vendor_party_id is null
  )
  returning absorb_id
), deactivated as (
  update public.cms_master_absorb_labor_item_v1 a
  set
    is_active = false,
    updated_at = now()
  where a.vendor_party_id is null
    and coalesce(a.note, '') like 'BOM_DECOR_LINE:%'
    and not exists (
      select 1
      from decor_source s
      where s.master_id = a.master_id
        and s.decor_note = coalesce(a.note, '')
    )
  returning a.absorb_id
)
select
  (select count(*) from updated) as updated_count,
  (select count(*) from inserted) as inserted_count,
  (select count(*) from deactivated) as deactivated_count;
