# Material Factor SoT Verification

## 1) Runtime hardcoding residue check

```sql
select n.nspname, p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    pg_get_functiondef(p.oid) like '%0.6435%'
    or pg_get_functiondef(p.oid) like '%0.825%'
    or pg_get_functiondef(p.oid) like '%0.925%'
  );
```

Expected: zero rows for active runtime functions.

## 2) Shipment total vs AR ledger total

```sql
with ship as (
  select shipment_id, sum(total_amount_sell_krw) as ship_total
  from cms_shipment_line
  where shipment_id = :shipment_id
  group by shipment_id
),
ar as (
  select shipment_id, sum(amount_krw) as ar_total
  from cms_ar_ledger
  where entry_type = 'SHIPMENT'
    and shipment_id = :shipment_id
  group by shipment_id
)
select ship.ship_total, ar.ar_total, (ship.ship_total - ar.ar_total) as diff
from ship left join ar using (shipment_id);
```

Expected: `diff = 0`.

## 3) AR invoice commodity due validation

```sql
select
  sl.shipment_line_id,
  sl.net_weight_g,
  sl.effective_factor_snapshot,
  round(coalesce(sl.net_weight_g, 0) * coalesce(sl.effective_factor_snapshot, 0), 6) as expected_due_g,
  ai.commodity_due_g,
  round(coalesce(ai.commodity_due_g, 0) - (coalesce(sl.net_weight_g, 0) * coalesce(sl.effective_factor_snapshot, 0)), 6) as diff
from cms_shipment_line sl
join cms_ar_invoice ai on ai.shipment_line_id = sl.shipment_line_id
where sl.shipment_id = :shipment_id
order by sl.created_at;
```

Expected: `diff = 0` per line.

## 4) Snapshot immutability check

1. Confirm shipment A.
2. Update `cms_material_factor_config` values.
3. Re-run checks #2 and #3 for shipment A.

Expected: shipment A values remain unchanged because snapshot columns are used.
