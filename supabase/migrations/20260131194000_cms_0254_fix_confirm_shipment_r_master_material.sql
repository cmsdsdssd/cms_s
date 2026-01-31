set search_path = public, pg_temp;

-- cms_0254: fix confirm function referencing non-existent field r_master.material
-- symptom: 400 (Bad Request) / code 42703 / message: record "r_master" has no field "material"
-- This patch rewrites the existing function definition in-place by replacing r_master.material -> v_material
-- (word-boundary safe: does not touch r_master.material_code_default).

do $$
declare
  v_def text;
begin
  v_def := pg_get_functiondef('public.cms_fn_confirm_shipment(uuid,uuid,text)'::regprocedure);

  v_def := regexp_replace(
    v_def,
    'r_master\.material\b',
    'v_material',
    'g'
  );

  execute v_def;
end $$;
