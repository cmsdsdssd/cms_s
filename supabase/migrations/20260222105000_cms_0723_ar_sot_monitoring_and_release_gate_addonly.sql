-- cms_0723: AR SOT monitoring and release gate (add-only)

begin;

create or replace function public.cms_fn_ar_sot_monitoring_snapshot_v1(
  p_limit int default 1000
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with p as (
    select greatest(coalesce(p_limit, 1000), 1) as lim
  ),
  preflight as (
    select *
    from public.v_cms_ar_sot_preflight_v1
    order by confirmed_at desc
    limit (select lim from p)
  ),
  q as (
    select
      count(*) filter (where status = 'OPEN') as queue_open_count,
      count(*) filter (where status = 'IN_PROGRESS') as queue_in_progress_count,
      count(*) filter (where status = 'RESOLVED') as queue_resolved_count
    from public.cms_ar_sot_resolution_queue
  )
  select jsonb_build_object(
    'ok', true,
    'sample_count', (select count(*) from preflight),
    'partial_invoice_count', (select count(*) from preflight where has_partial_invoice),
    'duplicate_shipment_ledger_count', (select count(*) from preflight where has_duplicate_shipment_ledger),
    'duplicate_invoice_line_count', (select count(*) from preflight where has_duplicate_invoice_line),
    'invoice_ledger_mismatch_count', (select count(*) from preflight where has_invoice_ledger_mismatch),
    'ship_invoice_mismatch_count', (select count(*) from preflight where has_ship_invoice_mismatch),
    'queue_open_count', (select queue_open_count from q),
    'queue_in_progress_count', (select queue_in_progress_count from q),
    'queue_resolved_count', (select queue_resolved_count from q),
    'release_gate_green', (
      (select count(*) from preflight where has_partial_invoice) = 0
      and (select count(*) from preflight where has_duplicate_shipment_ledger) = 0
      and (select count(*) from preflight where has_duplicate_invoice_line) = 0
      and (select count(*) from preflight where has_invoice_ledger_mismatch) = 0
      and coalesce((select queue_open_count from q), 0) = 0
    )
  );
$$;

create or replace function public.cms_fn_ar_sot_release_gate_v1(
  p_limit int default 1000
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_snapshot jsonb;
begin
  v_snapshot := public.cms_fn_ar_sot_monitoring_snapshot_v1(p_limit);

  if not coalesce((v_snapshot ->> 'release_gate_green')::boolean, false) then
    raise exception 'AR SOT release gate failed: %', v_snapshot::text;
  end if;

  return jsonb_build_object('ok', true, 'snapshot', v_snapshot);
end;
$$;

grant execute on function public.cms_fn_ar_sot_monitoring_snapshot_v1(int) to authenticated, service_role;
grant execute on function public.cms_fn_ar_sot_release_gate_v1(int) to authenticated, service_role;

commit;
