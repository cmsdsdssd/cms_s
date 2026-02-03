do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'cms_e_material_code'
      and e.enumlabel = '999'
  ) then
    alter type public.cms_e_material_code add value '999';
  end if;
end $$;
