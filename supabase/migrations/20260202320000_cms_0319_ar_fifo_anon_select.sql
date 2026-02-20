set search_path = public, pg_temp;
alter table public.cms_ar_invoice enable row level security;
alter table public.cms_ar_payment enable row level security;
alter table public.cms_ar_payment_alloc enable row level security;
drop policy if exists cms_select_anon on public.cms_ar_invoice;
create policy cms_select_anon on public.cms_ar_invoice
  for select to anon using (true);
drop policy if exists cms_select_anon on public.cms_ar_payment;
create policy cms_select_anon on public.cms_ar_payment
  for select to anon using (true);
drop policy if exists cms_select_anon on public.cms_ar_payment_alloc;
create policy cms_select_anon on public.cms_ar_payment_alloc
  for select to anon using (true);
grant select on public.cms_ar_invoice to anon;
grant select on public.cms_ar_payment to anon;
grant select on public.cms_ar_payment_alloc to anon;
grant select on public.cms_v_ar_invoice_position_v1 to anon;
grant select on public.cms_v_ar_position_by_party_v2 to anon;
grant select on public.cms_v_ar_payment_alloc_detail_v1 to anon;
