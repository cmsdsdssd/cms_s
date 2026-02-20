-- cms_0414: hotfix receipt match confirm weight validation
-- goal: when selected material is '00', allow selected_weight_g = 0
-- add-only migration: patch function body using plain-text replace (no regex escapes)

do $$
declare
  v_sig text;
  v_proc regprocedure;
  v_def text;
  v_new_def text;
  v_from text := $q$if v_selected_weight is null or v_selected_weight <= 0 then
    raise exception 'selected_weight_g required and must be > 0';
  end if;$q$;
  v_to text := $q$if v_selected_material <> '00'::public.cms_e_material_code and (v_selected_weight is null or v_selected_weight <= 0) then
    raise exception 'selected_weight_g required and must be > 0';
  end if;$q$;
begin
  -- patch v2 (active in several environments)
  v_sig := 'public.cms_fn_receipt_line_match_confirm_v2(uuid,uuid,uuid,numeric,public.cms_e_material_code,numeric,numeric,numeric,uuid,text)';
  v_proc := to_regprocedure(v_sig);
  if v_proc is not null then
    select pg_get_functiondef(v_proc) into v_def;
    v_new_def := replace(v_def, v_from, v_to);
    if v_new_def = v_def then
      raise exception 'cms_0414 patch failed for %, target validation block not found', v_sig;
    end if;
    execute v_new_def;
  end if;

  -- optional patch for v3 if it exists in this environment
  v_sig := 'public.cms_fn_receipt_line_match_confirm_v3(uuid,uuid,uuid,numeric,public.cms_e_material_code,numeric,numeric,numeric,uuid,text)';
  v_proc := to_regprocedure(v_sig);
  if v_proc is not null then
    select pg_get_functiondef(v_proc) into v_def;
    v_new_def := replace(v_def, v_from, v_to);
    if v_new_def <> v_def then
      execute v_new_def;
    end if;
  end if;
end$$;
