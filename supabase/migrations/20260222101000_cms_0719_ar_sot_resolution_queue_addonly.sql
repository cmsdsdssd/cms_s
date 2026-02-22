-- cms_0719: AR SOT resolution queue and seed RPC (add-only)

begin;

create table if not exists public.cms_ar_sot_resolution_queue (
  queue_id uuid primary key default gen_random_uuid(),
  issue_key text not null,
  issue_type text not null,
  severity text not null default 'HIGH',
  shipment_id uuid null references public.cms_shipment_header(shipment_id) on delete set null,
  shipment_line_id uuid null references public.cms_shipment_line(shipment_line_id) on delete set null,
  ar_id uuid null references public.cms_ar_invoice(ar_id) on delete set null,
  ar_ledger_id uuid null references public.cms_ar_ledger(ar_ledger_id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'OPEN',
  resolution_note text,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_ar_sot_resolution_queue_issue_type_ck check (
    issue_type in (
      'DUP_INVOICE_LINE',
      'DUP_SHIPMENT_LEDGER',
      'PARTIAL_INVOICE',
      'INVOICE_LEDGER_MISMATCH',
      'LOCKED_MISMATCH'
    )
  ),
  constraint cms_ar_sot_resolution_queue_severity_ck check (severity in ('CRITICAL','HIGH','MEDIUM','LOW')),
  constraint cms_ar_sot_resolution_queue_status_ck check (status in ('OPEN','IN_PROGRESS','RESOLVED','IGNORED'))
);

create unique index if not exists idx_cms_ar_sot_resolution_queue_issue_key
  on public.cms_ar_sot_resolution_queue(issue_key);

create index if not exists idx_cms_ar_sot_resolution_queue_status_detected
  on public.cms_ar_sot_resolution_queue(status, detected_at desc);

create index if not exists idx_cms_ar_sot_resolution_queue_shipment
  on public.cms_ar_sot_resolution_queue(shipment_id)
  where shipment_id is not null;

create or replace function public.cms_fn_ar_sot_seed_resolution_queue_v1(
  p_limit int default 1000
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted int := 0;
begin
  with rows as (
    select *
    from public.v_cms_ar_sot_preflight_v1
    order by confirmed_at desc
    limit greatest(coalesce(p_limit, 1000), 1)
  ),
  issues as (
    select
      'DUP_INVOICE_LINE:' || r.shipment_id::text as issue_key,
      'DUP_INVOICE_LINE'::text as issue_type,
      'HIGH'::text as severity,
      r.shipment_id,
      null::uuid as shipment_line_id,
      null::uuid as ar_id,
      null::uuid as ar_ledger_id,
      jsonb_build_object('invoice_duplicate_line_count', r.invoice_duplicate_line_count) as details
    from rows r
    where r.has_duplicate_invoice_line

    union all

    select
      'DUP_SHIPMENT_LEDGER:' || r.shipment_id::text as issue_key,
      'DUP_SHIPMENT_LEDGER'::text as issue_type,
      'CRITICAL'::text as severity,
      r.shipment_id,
      null::uuid as shipment_line_id,
      null::uuid as ar_id,
      null::uuid as ar_ledger_id,
      jsonb_build_object('ledger_row_count', r.ledger_row_count) as details
    from rows r
    where r.has_duplicate_shipment_ledger

    union all

    select
      'PARTIAL_INVOICE:' || r.shipment_id::text as issue_key,
      'PARTIAL_INVOICE'::text as issue_type,
      'HIGH'::text as severity,
      r.shipment_id,
      null::uuid as shipment_line_id,
      null::uuid as ar_id,
      null::uuid as ar_ledger_id,
      jsonb_build_object('line_count', r.line_count, 'invoice_count', r.invoice_count) as details
    from rows r
    where r.has_partial_invoice

    union all

    select
      'INVOICE_LEDGER_MISMATCH:' || r.shipment_id::text as issue_key,
      'INVOICE_LEDGER_MISMATCH'::text as issue_type,
      'HIGH'::text as severity,
      r.shipment_id,
      null::uuid as shipment_line_id,
      null::uuid as ar_id,
      null::uuid as ar_ledger_id,
      jsonb_build_object(
        'invoice_total', r.invoice_total,
        'ledger_total', r.ledger_total,
        'delta', r.invoice_total - r.ledger_total
      ) as details
    from rows r
    where r.has_invoice_ledger_mismatch

    union all

    select
      'LOCKED_MISMATCH:' || r.shipment_id::text as issue_key,
      'LOCKED_MISMATCH'::text as issue_type,
      'CRITICAL'::text as severity,
      r.shipment_id,
      null::uuid as shipment_line_id,
      null::uuid as ar_id,
      null::uuid as ar_ledger_id,
      jsonb_build_object(
        'ar_principal_locked_at', r.ar_principal_locked_at,
        'invoice_total', r.invoice_total,
        'ledger_total', r.ledger_total,
        'delta', r.invoice_total - r.ledger_total
      ) as details
    from rows r
    where r.ar_principal_locked_at is not null
      and r.has_invoice_ledger_mismatch
  )
  insert into public.cms_ar_sot_resolution_queue (
    issue_key,
    issue_type,
    severity,
    shipment_id,
    shipment_line_id,
    ar_id,
    ar_ledger_id,
    details
  )
  select
    i.issue_key,
    i.issue_type,
    i.severity,
    i.shipment_id,
    i.shipment_line_id,
    i.ar_id,
    i.ar_ledger_id,
    i.details
  from issues i
  on conflict (issue_key) do nothing;

  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'ok', true,
    'inserted', v_inserted,
    'open_count', (
      select count(*)
      from public.cms_ar_sot_resolution_queue q
      where q.status = 'OPEN'
    )
  );
end;
$$;

grant select on public.cms_ar_sot_resolution_queue to authenticated, service_role;
grant execute on function public.cms_fn_ar_sot_seed_resolution_queue_v1(int) to authenticated, service_role;

commit;
