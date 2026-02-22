set search_path = public, pg_temp;
begin;

do $$
declare
  target_tables text[] := array[
    'cms_party',
    'cms_shipment_header',
    'cms_shipment_line',
    'cms_ar_ledger',
    'cms_ar_invoice',
    'cms_ar_payment',
    'cms_ar_payment_alloc',
    'cms_return_line'
  ];
  t text;
begin
  -- Ensure schema usage for authenticated clients.
  execute 'grant usage on schema public to authenticated';

  foreach t in array target_tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    -- Table-level read privilege for authenticated role.
    execute format('grant select on table public.%I to authenticated', t);

    -- Keep RLS enabled and add explicit authenticated read policy.
    execute format('alter table public.%I enable row level security', t);

    if t = 'cms_party' then
      execute 'drop policy if exists cms_auth_select_party on public.cms_party';
      execute 'create policy cms_auth_select_party on public.cms_party for select to authenticated using (true)';
    elsif t = 'cms_shipment_header' then
      execute 'drop policy if exists cms_auth_select_shipment_header on public.cms_shipment_header';
      execute 'create policy cms_auth_select_shipment_header on public.cms_shipment_header for select to authenticated using (true)';
    elsif t = 'cms_shipment_line' then
      execute 'drop policy if exists cms_auth_select_shipment_line on public.cms_shipment_line';
      execute 'create policy cms_auth_select_shipment_line on public.cms_shipment_line for select to authenticated using (true)';
    elsif t = 'cms_ar_ledger' then
      execute 'drop policy if exists cms_auth_select_ar_ledger on public.cms_ar_ledger';
      execute 'create policy cms_auth_select_ar_ledger on public.cms_ar_ledger for select to authenticated using (true)';
    elsif t = 'cms_ar_invoice' then
      execute 'drop policy if exists cms_auth_select_ar_invoice on public.cms_ar_invoice';
      execute 'create policy cms_auth_select_ar_invoice on public.cms_ar_invoice for select to authenticated using (true)';
    elsif t = 'cms_ar_payment' then
      execute 'drop policy if exists cms_auth_select_ar_payment on public.cms_ar_payment';
      execute 'create policy cms_auth_select_ar_payment on public.cms_ar_payment for select to authenticated using (true)';
    elsif t = 'cms_ar_payment_alloc' then
      execute 'drop policy if exists cms_auth_select_ar_payment_alloc on public.cms_ar_payment_alloc';
      execute 'create policy cms_auth_select_ar_payment_alloc on public.cms_ar_payment_alloc for select to authenticated using (true)';
    elsif t = 'cms_return_line' then
      execute 'drop policy if exists cms_auth_select_return_line on public.cms_return_line';
      execute 'create policy cms_auth_select_return_line on public.cms_return_line for select to authenticated using (true)';
    end if;
  end loop;
end $$;

commit;
