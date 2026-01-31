set search_path = public, pg_temp;

-- cms_0259: fix enum mismatch in cms_fn_confirm_shipment
-- symptom:
--   22P02 invalid input value for enum cms_e_pricing_mode: "MANUAL"
-- root cause:
--   cms_e_pricing_mode enum labels (repo): RULE, UNIT, AMOUNT_ONLY
--   but cms_fn_confirm_shipment contains 'MANUAL'::cms_e_pricing_mode casts.
--
-- fix:
--   replace 'MANUAL'::cms_e_pricing_mode -> 'UNIT'::cms_e_pricing_mode
--   without changing function signature / return type.

do $$
declare
  v_def text;
begin
  if to_regprocedure('public.cms_fn_confirm_shipment(uuid,uuid,text)') is null then
    raise exception 'missing function: public.cms_fn_confirm_shipment(uuid,uuid,text)';
  end if;

  v_def := pg_get_functiondef('public.cms_fn_confirm_shipment(uuid,uuid,text)'::regprocedure);

  -- replace both qualified and unqualified enum casts
  v_def := regexp_replace(
    v_def,
    '''MANUAL''::public\.cms_e_pricing_mode',
    '''UNIT''::public.cms_e_pricing_mode',
    'g'
  );

  v_def := regexp_replace(
    v_def,
    '''MANUAL''::cms_e_pricing_mode',
    '''UNIT''::cms_e_pricing_mode',
    'g'
  );

  execute v_def;
end $$;

-- (옵션) 실행권한 보강: 로그인 없이 쓰는 동안 막히지 않게
grant execute on function public.cms_fn_confirm_shipment(uuid,uuid,text) to anon, authenticated;
