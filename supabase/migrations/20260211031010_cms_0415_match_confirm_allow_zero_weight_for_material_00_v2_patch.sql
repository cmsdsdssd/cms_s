-- cms_0415: hotfix receipt match confirm weight validation
-- add-only patch: allow selected_weight_g = 0 when selected material is '00'

do $$
declare
  v_proc oid;
  v_def text;
  v_new_def text;
begin
  for v_proc in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('cms_fn_receipt_line_match_confirm_v2', 'cms_fn_receipt_line_match_confirm_v3')
  loop
    select pg_get_functiondef(v_proc) into v_def;

    v_new_def := regexp_replace(
      v_def,
      'if[[:space:]]+v_selected_weight[[:space:]]+is[[:space:]]+null[[:space:]]+or[[:space:]]+v_selected_weight[[:space:]]*<=[[:space:]]*0[[:space:]]+then',
      'if v_selected_material <> ''00''::public.cms_e_material_code and (v_selected_weight is null or v_selected_weight <= 0) then',
      'i'
    );

    if v_new_def <> v_def then
      execute v_new_def;
    end if;
  end loop;
end$$;
