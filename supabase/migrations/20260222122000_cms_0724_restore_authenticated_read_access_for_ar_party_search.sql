set search_path = public, pg_temp;
begin;

do $$
declare
  t text;
  core_tables text[] := array[
    'cms_master_item',
    'cms_payment_header',
    'cms_shipment_valuation',
    'cms_order_line',
    'cms_vendor_prefix_map',
    'cms_factory_po',
    'cms_factory_po_line',
    'cms_receipt_inbox'
  ];
begin
  execute 'grant usage on schema public to authenticated';

  foreach t in array core_tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    execute format('grant select on table public.%I to authenticated', t);
    execute format('alter table public.%I enable row level security', t);

    if t = 'cms_master_item' then
      execute 'drop policy if exists cms_auth_select_master_item on public.cms_master_item';
      execute 'create policy cms_auth_select_master_item on public.cms_master_item for select to authenticated using (true)';
    elsif t = 'cms_payment_header' then
      execute 'drop policy if exists cms_auth_select_payment_header on public.cms_payment_header';
      execute 'create policy cms_auth_select_payment_header on public.cms_payment_header for select to authenticated using (true)';
    elsif t = 'cms_shipment_valuation' then
      execute 'drop policy if exists cms_auth_select_shipment_valuation on public.cms_shipment_valuation';
      execute 'create policy cms_auth_select_shipment_valuation on public.cms_shipment_valuation for select to authenticated using (true)';
    elsif t = 'cms_order_line' then
      execute 'drop policy if exists cms_auth_select_order_line on public.cms_order_line';
      execute 'create policy cms_auth_select_order_line on public.cms_order_line for select to authenticated using (true)';
    elsif t = 'cms_vendor_prefix_map' then
      execute 'drop policy if exists cms_auth_select_vendor_prefix_map on public.cms_vendor_prefix_map';
      execute 'create policy cms_auth_select_vendor_prefix_map on public.cms_vendor_prefix_map for select to authenticated using (true)';
    elsif t = 'cms_factory_po' then
      execute 'drop policy if exists cms_auth_select_factory_po on public.cms_factory_po';
      execute 'create policy cms_auth_select_factory_po on public.cms_factory_po for select to authenticated using (true)';
    elsif t = 'cms_factory_po_line' then
      execute 'drop policy if exists cms_auth_select_factory_po_line on public.cms_factory_po_line';
      execute 'create policy cms_auth_select_factory_po_line on public.cms_factory_po_line for select to authenticated using (true)';
    elsif t = 'cms_receipt_inbox' then
      execute 'drop policy if exists cms_auth_select_receipt_inbox on public.cms_receipt_inbox';
      execute 'create policy cms_auth_select_receipt_inbox on public.cms_receipt_inbox for select to authenticated using (true)';
    end if;
  end loop;

  -- AR read-only views used by receivable pages
  if to_regclass('public.cms_v_ar_balance_by_party') is not null then
    execute 'grant select on public.cms_v_ar_balance_by_party to authenticated';
  end if;
  if to_regclass('public.cms_v_ar_position_by_party_v2') is not null then
    execute 'grant select on public.cms_v_ar_position_by_party_v2 to authenticated';
  end if;
  if to_regclass('public.cms_v_ar_invoice_position_v1') is not null then
    execute 'grant select on public.cms_v_ar_invoice_position_v1 to authenticated';
  end if;
  if to_regclass('public.cms_v_ar_payment_alloc_detail_v1') is not null then
    execute 'grant select on public.cms_v_ar_payment_alloc_detail_v1 to authenticated';
  end if;
end $$;

commit;
