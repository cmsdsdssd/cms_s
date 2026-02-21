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

## 5) Per-material independence check (925 vs 999)

```sql
-- 925만 보정계수 변경
select public.cms_fn_upsert_material_factor_config_v2(
  jsonb_build_array(
    jsonb_build_object('material_code','925','purity_rate',0.925,'material_adjust_factor',1.15,'price_basis','SILVER')
  ),
  null,
  null,
  'verification: 925 independent update'
);

-- 저장 결과 확인: 925만 변경되고 999는 유지되어야 함
select material_code, purity_rate, material_adjust_factor, price_basis, updated_at
from cms_material_factor_config
where material_code in ('925','999')
order by material_code;
```

Expected: 925 row only changed; 999 row unchanged.

## 6) Reconfirm formula check

```sql
select
  sl.shipment_line_id,
  sl.material_code,
  sl.net_weight_g,
  sl.purity_rate_snapshot,
  sl.material_adjust_factor_snapshot,
  sl.market_adjust_factor_snapshot,
  sl.effective_factor_snapshot,
  round(
    coalesce(sl.net_weight_g, 0)
    * coalesce(
        case
          when sl.price_basis_snapshot = 'GOLD' then sl.gold_tick_krw_per_g
          when sl.price_basis_snapshot = 'SILVER' then sl.silver_tick_krw_per_g
          else 0
        end,
        0
      )
    * coalesce(sl.effective_factor_snapshot, 0),
    0
  ) as expected_material_sell,
  sl.material_amount_sell_krw,
  sl.material_amount_sell_krw
    - round(
        coalesce(sl.net_weight_g, 0)
        * coalesce(
            case
              when sl.price_basis_snapshot = 'GOLD' then sl.gold_tick_krw_per_g
              when sl.price_basis_snapshot = 'SILVER' then sl.silver_tick_krw_per_g
              else 0
            end,
            0
          )
        * coalesce(sl.effective_factor_snapshot, 0),
        0
      ) as diff
from cms_shipment_line sl
where sl.shipment_id = :shipment_id
order by sl.created_at;
```

Expected: `diff = 0` per line.
