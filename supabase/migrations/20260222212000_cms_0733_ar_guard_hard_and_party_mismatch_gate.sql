-- cms_0733: force AR legacy guard HARD + add party-level mismatch to release gate

begin;

insert into public.cms_ar_legacy_function_registry(
  function_name,
  deprecated_tier,
  block_in_warn,
  block_in_hard,
  reason,
  enabled
)
values
  ('cms_fn_record_payment_v2', 2, true, true, 'legacy payment path; block in WARN/HARD', true)
on conflict (function_name) do update
set
  deprecated_tier = excluded.deprecated_tier,
  block_in_warn = excluded.block_in_warn,
  block_in_hard = excluded.block_in_hard,
  reason = excluded.reason,
  enabled = excluded.enabled,
  updated_at = now();

update public.cms_ar_legacy_function_registry
set
  block_in_warn = true,
  block_in_hard = true,
  updated_at = now()
where function_name in (
  'create_ar_from_shipment',
  'cms_fn_ar_create_from_shipment_confirm_v1',
  'cms_fn_ar_apply_payment_fifo_v2',
  'cms_fn_record_payment_v2'
);

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
  party_invoice as (
    select
      party_id,
      coalesce(sum(total_cash_outstanding_krw), 0) as invoice_outstanding_krw
    from public.cms_v_ar_invoice_position_v1
    group by party_id
  ),
  party_ledger as (
    select
      party_id,
      coalesce(sum(amount_krw), 0) as ledger_outstanding_krw
    from public.cms_ar_ledger
    group by party_id
  ),
  party_mismatch as (
    select
      coalesce(i.party_id, l.party_id) as party_id,
      coalesce(i.invoice_outstanding_krw, 0) as invoice_outstanding_krw,
      coalesce(l.ledger_outstanding_krw, 0) as ledger_outstanding_krw,
      coalesce(i.invoice_outstanding_krw, 0) - coalesce(l.ledger_outstanding_krw, 0) as diff_krw
    from party_invoice i
    full outer join party_ledger l on l.party_id = i.party_id
    where abs(coalesce(i.invoice_outstanding_krw, 0) - coalesce(l.ledger_outstanding_krw, 0)) > 0.5
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
    'party_level_mismatch_count', (select count(*) from party_mismatch),
    'queue_open_count', (select queue_open_count from q),
    'queue_in_progress_count', (select queue_in_progress_count from q),
    'queue_resolved_count', (select queue_resolved_count from q),
    'release_gate_green', (
      (select count(*) from preflight where has_partial_invoice) = 0
      and (select count(*) from preflight where has_duplicate_shipment_ledger) = 0
      and (select count(*) from preflight where has_duplicate_invoice_line) = 0
      and (select count(*) from preflight where has_invoice_ledger_mismatch) = 0
      and (select count(*) from party_mismatch) = 0
      and coalesce((select queue_open_count from q), 0) = 0
    )
  );
$$;

grant execute on function public.cms_fn_ar_sot_monitoring_snapshot_v1(int) to authenticated, service_role;

select public.cms_fn_ar_apply_legacy_guard_phase('hard', 'cms_0733_migration');

commit;
