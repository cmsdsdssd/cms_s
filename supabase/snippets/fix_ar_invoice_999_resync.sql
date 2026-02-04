do $$
declare
  r record;
begin
  for r in
    select distinct shipment_id
    from public.cms_v_ar_invoice_position_v1
    where material_code = '999'
      and material_cash_due_krw = 0
      and shipment_id is not null
  loop
    perform public.cms_fn_ar_create_from_shipment_confirm_v1(r.shipment_id);
  end loop;
end $$;
