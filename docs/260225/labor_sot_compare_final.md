# Shipment Labor SoT Compare-Only Final

## Scope Lock

- Do not change existing write/confirm/unconfirm logic.
- Do not switch API/FE consumers immediately.
- Add compare-only read views and validate deltas first.

## Deliverable

- SQL file: `docs/260225/labor_sot_compare_final.sql`
- New views:
  - `public.v_cms_shipment_labor_sot_v1`
  - `public.v_cms_shipment_labor_sot_audit_v1`

## Why This Is Low Risk

- Uses persisted columns from `cms_shipment_line` and status from `cms_shipment_header`.
- Reuses existing integrity diagnostics (`v_cms_shipment_labor_integrity_v1`) instead of inventing new parsing logic.
- No triggers/functions/procedures are modified.
- No API/FE contract is changed by default.

## Phase Plan (No Downtime)

1. Apply compare-only SQL.
2. Run validation queries and capture baseline.
3. Add shadow-read logging in one API route (optional), no response change.
4. If delta remains acceptable, migrate one low-risk consumer at a time.

## Mandatory Validation Queries

```sql
select public.cms_fn_shipment_labor_integrity_summary_v1();

select
  count(*) as mismatch_rows
from public.v_cms_shipment_labor_sot_audit_v1
where has_mismatch;

select
  count(*) as non_100_unit_rows
from public.v_cms_shipment_labor_sot_audit_v1
where abs(base_mod_100) > 0.0001
   or abs(extra_mod_100) > 0.0001
   or abs(sot_mod_100) > 0.0001;

select public.cms_fn_ar_sot_preflight_summary_v1(500);
```

## Rollback

```sql
begin;
drop view if exists public.v_cms_shipment_labor_sot_audit_v1;
drop view if exists public.v_cms_shipment_labor_sot_v1;
commit;
```

## Non-Goals

- Not replacing `shipment-receipt-prefill` computation now.
- Not changing FE hydration/remainder behavior now.
- Not redefining AR/reporting SoT now.
