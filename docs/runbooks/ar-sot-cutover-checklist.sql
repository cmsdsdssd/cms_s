-- AR Ledger SOT Cutover Checklist (Execution SQL)
-- Purpose:
-- 1) Detect and resolve drift/duplicates
-- 2) Disable legacy multi-write paths
-- 3) Enforce uniqueness and keep ledger as strict SOT
--
-- IMPORTANT:
-- - Run in order.
-- - Keep a DB backup/snapshot before Step 3+.
-- - Execute destructive statements only after preview queries are clean.

-- =====================================================
-- Step 0: Snapshot + maintenance window (manual)
-- =====================================================
-- Manual actions (outside SQL):
-- - Create DB snapshot/backup
-- - Announce short maintenance window for AR writes


-- =====================================================
-- Step 1: Preflight (read-only)
-- =====================================================
select public.cms_fn_ar_sot_preflight_summary_v1(2000) as preflight_summary;

select public.cms_fn_ar_sot_enforce_uniqueness_v1(false) as uniqueness_readiness;


-- =====================================================
-- Step 2: Queue issues for remediation
-- =====================================================
select public.cms_fn_ar_sot_seed_resolution_queue_v1(2000) as queued;

-- Review queue status (if table exists)
select
  status,
  severity,
  count(*) as cnt
from public.cms_ar_sot_resolution_queue
group by status, severity
order by
  case severity when 'CRITICAL' then 1 when 'HIGH' then 2 when 'MEDIUM' then 3 else 4 end,
  status;


-- =====================================================
-- Step 3: Legacy trigger/path inspection (preview)
-- =====================================================
-- 3.1: Find shipment-related triggers that may write AR/ledger outside the new path
select
  n.nspname as schema_name,
  c.relname as table_name,
  t.tgname as trigger_name,
  pg_get_triggerdef(t.oid) as trigger_def
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal
  and (
    t.tgname ilike '%shipment%'
    or pg_get_triggerdef(t.oid) ilike '%create_ar%'
    or pg_get_triggerdef(t.oid) ilike '%cms_ar_ledger%'
  )
order by 1,2,3;

-- 3.2: Find legacy AR functions that are still executable
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'create_ar_from_shipment',
    'cms_fn_ar_create_from_shipment_confirm_v1',
    'cms_fn_ar_apply_payment_fifo_v1',
    'cms_fn_ar_apply_payment_fifo_v2',
    'cms_fn_ar_apply_payment_fifo_v3'
  )
order by 2,3;


-- =====================================================
-- Step 4: Disable known legacy trigger path (APPLY CAREFULLY)
-- =====================================================
-- NOTE:
-- Execute only the generated statements after confirming target triggers are legacy.
-- This block generates DISABLE commands; copy+run reviewed output.
select format(
  'alter table %I.%I disable trigger %I;',
  n.nspname,
  c.relname,
  t.tgname
) as disable_sql
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal
  and (
    t.tgname ilike '%after_shipment_confirm%'
    or t.tgname ilike '%create_ar%'
  )
order by 1;


-- =====================================================
-- Step 5: Enforce uniqueness (APPLY)
-- =====================================================
-- Fails if duplicates still exist. If fail, remediate queue first.
select public.cms_fn_ar_sot_enforce_uniqueness_v1(true) as uniqueness_apply;


-- =====================================================
-- Step 6: Post-enforcement verification
-- =====================================================
select public.cms_fn_ar_sot_preflight_summary_v1(2000) as post_preflight_summary;

-- Check recent party-level delta (ledger vs invoice outstanding)
with parties as (
  select distinct party_id
  from public.cms_ar_ledger
  where occurred_at >= now() - interval '7 days'
),
ledger as (
  select party_id, round(coalesce(sum(amount_krw), 0), 6) as ledger_sum
  from public.cms_ar_ledger
  where party_id in (select party_id from parties)
  group by party_id
),
invoice as (
  select party_id, round(coalesce(sum(total_cash_outstanding_krw), 0), 6) as invoice_sum
  from public.cms_v_ar_invoice_position_v1
  where party_id in (select party_id from parties)
  group by party_id
)
select
  p.party_id,
  coalesce(l.ledger_sum, 0) as ledger_sum,
  coalesce(i.invoice_sum, 0) as invoice_sum,
  round(coalesce(l.ledger_sum, 0) - coalesce(i.invoice_sum, 0), 6) as delta
from parties p
left join ledger l on l.party_id = p.party_id
left join invoice i on i.party_id = p.party_id
where abs(coalesce(l.ledger_sum, 0) - coalesce(i.invoice_sum, 0)) > 0.5
order by abs(coalesce(l.ledger_sum, 0) - coalesce(i.invoice_sum, 0)) desc;


-- =====================================================
-- Step 7: Optional guard mode switch (if settings table exists)
-- =====================================================
-- This is optional and safe-checked. It does nothing if table is absent.
do $$
begin
  if to_regclass('public.cms_ar_sot_settings') is not null then
    -- Recommended sequence: OFF -> WARN (1-3 days) -> HARD
    -- update public.cms_ar_sot_settings set guard_mode = 'WARN', updated_at = now();
    -- update public.cms_ar_sot_settings set guard_mode = 'HARD', updated_at = now();
    raise notice 'cms_ar_sot_settings exists. Apply guard_mode transition manually.';
  else
    raise notice 'cms_ar_sot_settings not found. Skip guard_mode transition.';
  end if;
end $$;


-- =====================================================
-- Step 8: Smoke test queries (read-only)
-- =====================================================
-- Replace :party_id manually in SQL editor before running.
-- Example:
-- select
--   (select coalesce(sum(amount_krw),0) from public.cms_ar_ledger where party_id = 'YOUR_PARTY_ID') as ledger_sum,
--   (select coalesce(sum(total_cash_outstanding_krw),0) from public.cms_v_ar_invoice_position_v1 where party_id = 'YOUR_PARTY_ID') as invoice_sum;
