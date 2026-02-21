set search_path = public, pg_temp;
begin;

do $$
declare
  sensitive_tables text[] := array[
    'cms_party',
    'cms_order_line',
    'cms_factory_po',
    'cms_factory_po_line',
    'cms_vendor_prefix_map',
    'cms_receipt_inbox',
    'cms_shipment_header',
    'cms_shipment_line',
    'cms_ar_ledger',
    'cms_ar_invoice',
    'cms_ar_payment',
    'cms_ar_payment_alloc',
    'cms_return_line',
    'cms_vendor_fax_config'
  ];
  sensitive_views text[] := array[
    'cms_v_ar_balance_by_party',
    'cms_v_ar_position_by_party',
    'cms_v_ar_position_by_party_v2',
    'cms_v_ar_invoice_position_v1',
    'cms_v_ar_payment_alloc_detail_v1',
    'cms_v_ap_position_by_vendor_v1',
    'cms_v_ap_invoice_position_v1',
    'cms_v_ap_payment_alloc_detail_v1',
    'cms_v_ap_payment_unallocated_v1',
    'cms_v_ap_reconcile_open_by_vendor_v1',
    'cms_v_ap_reconcile_issue_list_v1',
    'cms_v_ap_position_by_vendor_named_v1',
    'cms_v_ap_reconcile_open_by_vendor_named_v1',
    'cms_v_ap_reconcile_issue_list_named_v1'
  ];
  mutating_functions text[] := array[
    'cms_fn_upsert_order_line_v3',
    'cms_fn_upsert_order_line_v5',
    'cms_fn_upsert_order_line_v6',
    'cms_fn_confirm_shipment',
    'cms_fn_confirm_shipment_v3_cost_v1',
    'cms_fn_confirm_store_pickup_v1',
    'cms_fn_shipment_upsert_from_order_line',
    'cms_fn_shipment_upsert_from_order_line_v2',
    'cms_fn_factory_po_create_from_order_lines',
    'cms_fn_factory_po_mark_sent',
    'cms_fn_factory_po_cancel',
    'cms_fn_mark_shipped',
    'cms_fn_receipt_attach_to_order_lines',
    'cms_fn_apply_purchase_cost_to_shipment_v1',
    'cms_fn_set_store_pickup_v1',
    'cms_fn_create_vendor_bill_v1',
    'cms_fn_apply_vendor_bill_to_shipments_v1'
  ];
  obj text;
  p record;
begin
  foreach obj in array sensitive_tables loop
    if to_regclass('public.' || obj) is not null then
      execute format('revoke all on table public.%I from anon', obj);
    end if;
  end loop;

  foreach obj in array sensitive_views loop
    if to_regclass('public.' || obj) is not null then
      execute format('revoke all on table public.%I from anon', obj);
    end if;
  end loop;

  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(sensitive_tables)
      and 'anon' = any(roles)
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;

  for p in
    select n.nspname as schema_name, x.proname as function_name, oidvectortypes(x.proargtypes) as args
    from pg_proc x
    join pg_namespace n on n.oid = x.pronamespace
    where n.nspname = 'public'
      and x.proname = any(mutating_functions)
  loop
    execute format('revoke execute on function %I.%I(%s) from anon', p.schema_name, p.function_name, p.args);
  end loop;
end $$;

commit;
