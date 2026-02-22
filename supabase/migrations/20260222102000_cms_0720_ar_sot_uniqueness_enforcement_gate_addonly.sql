-- cms_0720: AR SOT uniqueness enforcement gate (add-only)

begin;

create or replace function public.cms_fn_ar_sot_enforce_uniqueness_v1(
  p_apply boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice_dup_count int := 0;
  v_ledger_dup_count int := 0;
begin
  select count(*)
  into v_invoice_dup_count
  from (
    select ai.shipment_line_id
    from public.cms_ar_invoice ai
    where ai.shipment_line_id is not null
    group by ai.shipment_line_id
    having count(*) > 1
  ) d;

  select count(*)
  into v_ledger_dup_count
  from (
    select l.shipment_id
    from public.cms_ar_ledger l
    where l.entry_type = 'SHIPMENT'
      and l.shipment_id is not null
    group by l.shipment_id
    having count(*) > 1
  ) d;

  if coalesce(p_apply, false) then
    if v_invoice_dup_count > 0 or v_ledger_dup_count > 0 then
      raise exception
        'cannot enforce AR SOT uniqueness (invoice_dup=%, ledger_dup=%). resolve queue first.',
        v_invoice_dup_count,
        v_ledger_dup_count;
    end if;

    execute $sql$
      create unique index if not exists idx_cms_ar_invoice_unique_shipment_line
      on public.cms_ar_invoice (shipment_line_id)
      where shipment_line_id is not null
    $sql$;

    execute $sql$
      create unique index if not exists idx_cms_ar_ledger_unique_shipment_entry
      on public.cms_ar_ledger (shipment_id)
      where entry_type = 'SHIPMENT' and shipment_id is not null
    $sql$;
  end if;

  return jsonb_build_object(
    'ok', true,
    'apply_requested', coalesce(p_apply, false),
    'invoice_duplicate_shipment_line_count', v_invoice_dup_count,
    'ledger_duplicate_shipment_count', v_ledger_dup_count,
    'ready_to_enforce', (v_invoice_dup_count = 0 and v_ledger_dup_count = 0)
  );
end;
$$;

grant execute on function public.cms_fn_ar_sot_enforce_uniqueness_v1(boolean) to authenticated, service_role;

commit;
