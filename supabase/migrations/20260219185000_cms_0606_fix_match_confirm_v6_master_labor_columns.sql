set search_path = public, pg_temp;

do $$
declare
  v_sig text :=
    'public.cms_fn_receipt_line_match_confirm_v6_policy_v2(uuid,uuid,uuid,numeric,public.cms_e_material_code,numeric,numeric,numeric,uuid,text,public.cms_e_factory_billing_shape)';
  v_oid regprocedure;
  v_def text;
begin
  v_oid := to_regprocedure(v_sig);
  if v_oid is null then
    raise notice 'skip: function not found: %', v_sig;
    return;
  end if;

  select pg_get_functiondef(v_oid) into v_def;

  v_def := replace(v_def, 'm.labor_center,', 'm.labor_center_sell,');
  v_def := replace(v_def, 'm.labor_side1,', 'm.labor_sub1_sell,');
  v_def := replace(v_def, 'm.labor_side2,', 'm.labor_sub2_sell,');

  v_def := replace(v_def, 'v_master.labor_center', 'v_master.labor_center_sell');
  v_def := replace(v_def, 'v_master.labor_side1', 'v_master.labor_sub1_sell');
  v_def := replace(v_def, 'v_master.labor_side2', 'v_master.labor_sub2_sell');

  execute v_def;
end $$;
