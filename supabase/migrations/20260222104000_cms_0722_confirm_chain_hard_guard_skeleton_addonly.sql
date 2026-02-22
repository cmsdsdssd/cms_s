-- cms_0722: confirm-chain hard guard skeleton (add-only)

begin;

create or replace function public.cms_fn_ar_sot_confirm_prereq_v1(
  p_shipment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line_count int := 0;
  v_invoice_count int := 0;
  v_ledger_row_count int := 0;
  v_has_locked boolean := false;
  v_has_duplicate_invoice boolean := false;
  v_has_duplicate_ledger boolean := false;
begin
  if p_shipment_id is null then
    raise exception 'shipment_id required';
  end if;

  select count(*)
  into v_line_count
  from public.cms_shipment_line sl
  where sl.shipment_id = p_shipment_id;

  select count(*)
  into v_invoice_count
  from public.cms_ar_invoice ai
  where ai.shipment_id = p_shipment_id;

  select count(*)
  into v_ledger_row_count
  from public.cms_ar_ledger l
  where l.entry_type = 'SHIPMENT'
    and l.shipment_id = p_shipment_id;

  select (sh.ar_principal_locked_at is not null)
  into v_has_locked
  from public.cms_shipment_header sh
  where sh.shipment_id = p_shipment_id;

  select exists (
    select 1
    from public.cms_ar_invoice ai
    where ai.shipment_id = p_shipment_id
      and ai.shipment_line_id is not null
    group by ai.shipment_line_id
    having count(*) > 1
  )
  into v_has_duplicate_invoice;

  select exists (
    select 1
    from public.cms_ar_ledger l
    where l.entry_type = 'SHIPMENT'
      and l.shipment_id = p_shipment_id
    group by l.shipment_id
    having count(*) > 1
  )
  into v_has_duplicate_ledger;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'line_count', v_line_count,
    'invoice_count', v_invoice_count,
    'ledger_row_count', v_ledger_row_count,
    'has_locked', coalesce(v_has_locked, false),
    'has_duplicate_invoice', v_has_duplicate_invoice,
    'has_duplicate_ledger', v_has_duplicate_ledger,
    'has_partial_invoice', (v_invoice_count > 0 and v_invoice_count < v_line_count),
    'ready_for_hard_guard', (
      v_line_count > 0
      and v_invoice_count = v_line_count
      and v_ledger_row_count = 1
      and not v_has_duplicate_invoice
      and not v_has_duplicate_ledger
    )
  );
end;
$$;

create or replace function public.cms_fn_ar_sot_assert_confirm_prereq_v1(
  p_shipment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_check jsonb;
begin
  v_check := public.cms_fn_ar_sot_confirm_prereq_v1(p_shipment_id);

  if not coalesce((v_check ->> 'ready_for_hard_guard')::boolean, false) then
    raise exception 'confirm prereq failed for AR SOT hard guard (shipment_id=%) | %', p_shipment_id, v_check::text;
  end if;

  return jsonb_build_object('ok', true, 'shipment_id', p_shipment_id, 'check', v_check);
end;
$$;

grant execute on function public.cms_fn_ar_sot_confirm_prereq_v1(uuid) to authenticated, service_role;
grant execute on function public.cms_fn_ar_sot_assert_confirm_prereq_v1(uuid) to authenticated, service_role;

commit;
