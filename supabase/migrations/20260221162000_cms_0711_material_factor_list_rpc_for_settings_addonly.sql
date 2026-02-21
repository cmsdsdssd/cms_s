begin;
set search_path = public, pg_temp;

create or replace function public.cms_fn_list_material_factor_config_v1()
returns table(
  material_code public.cms_e_material_code,
  purity_rate numeric,
  material_adjust_factor numeric,
  price_basis text,
  updated_at timestamptz,
  note text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    c.material_code,
    c.purity_rate,
    coalesce(c.material_adjust_factor, c.gold_adjust_factor, 1) as material_adjust_factor,
    coalesce(c.price_basis,
      case
        when c.material_code in ('925'::public.cms_e_material_code, '999'::public.cms_e_material_code) then 'SILVER'
        when c.material_code = '00'::public.cms_e_material_code then 'NONE'
        else 'GOLD'
      end
    ) as price_basis,
    c.updated_at,
    c.note
  from public.cms_material_factor_config c
  order by c.material_code::text;
$$;

grant execute on function public.cms_fn_list_material_factor_config_v1()
  to anon, authenticated, service_role;

commit;
