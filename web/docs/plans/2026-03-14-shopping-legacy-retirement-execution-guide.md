# Shopping Legacy Retirement Execution Guide

> For Claude: REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

Goal: Remove shopping pricing legacy objects in controlled batches until shopping option authoring, validation, recompute, preview, explain, and storefront all run from the new Rule-only SOT only.

Architecture: The final system keeps a single authored pricing boundary: explicit option-entry mappings, central registries, master/tick/factor context, and a unified rule core. Legacy authoring tables, legacy validation paths, product-scoped size state, old snapshot/current-state views, and old pricing RPCs are retired only after callers are cut over.

Tech Stack: Next.js route handlers, Supabase/Postgres migrations and RPCs, publish-state tables, TanStack Query admin pages, Playwright/manual API verification.

---

## Final Truth Model

### Authored SOT
- `channel_product_option_entry_mapping_v1`
- `channel_option_material_registry_v1`
- `channel_option_color_bucket_v1`
- `channel_option_addon_master_v1`
- `channel_option_notice_code_v1`
- `channel_option_other_reason_code_v1`
- `channel_color_combo_catalog_v1`
- unified option rule table (new; replaces old labor/sync rule split)
- `sales_channel_product` as identity/linkage only

### Derived Truth
- `product_price_publish_base_v1`
- `product_price_publish_option_entry_v1`
- `product_price_publish_variant_v1`
- `product_price_live_state_v1`
- `pricing_snapshot`
- `pricing_snapshot_latest`
- `channel_price_snapshot_latest`
- `price_sync_job`
- `price_sync_job_item`

### Must Disappear
- `channel_option_category_v2`
- `channel_option_value_policy`
- `channel_option_value_policy_log`
- `sales_channel_product.option_material_code`
- `sales_channel_product.option_color_code`
- `sales_channel_product.option_decoration_code`
- `sales_channel_product.option_size_value`
- old pricing override/manual/sync rule columns on `sales_channel_product`
- product-scoped persisted size-grid runtime truth
- `channel_option_current_state_v1`
- `v_price_composition_flat_v2`
- old sync-rule tables and old labor-rule table once unified rule core is live

---

## Safe Drop Rules

Apply these rules in every batch.

- Use a 2-step retirement: cut callers over first, drop the old DB object in a later migration.
- Use `DROP ... RESTRICT` first. Never default to `CASCADE`.
- If a `DROP ... RESTRICT` fails, inspect dependencies before retrying.
- Check `pg_depend`, `information_schema.view_table_usage`, and `information_schema.view_routine_usage` before every destructive migration.
- Do not trust function dependency metadata alone; supplement with repo grep because PostgreSQL routine dependency tracking is incomplete for many function bodies.
- Rehearse the migration in a reset/branch environment before applying broadly.
- Treat `CREATE OR REPLACE FUNCTION/VIEW` as a transition tool only when contract-compatible.
- For RPC signature or result-shape changes, create a new versioned RPC, cut callers over, then drop the old one.

Reference guidance used:
- PostgreSQL `DROP TABLE`, `DROP VIEW`, `DROP FUNCTION`, `Dependency Tracking`, `pg_depend`
- PostgreSQL `CREATE VIEW`, `CREATE FUNCTION`
- Supabase database migrations, testing, branching, database functions

---

## Batch 1 - Drop Legacy Authoring Model

### Goal
Remove the old category/value-policy authoring model so only explicit option-entry mappings remain as option authoring truth.

### Files To Modify
- `supabase/migrations/<new>_drop_legacy_option_authoring.sql`
- `web/src/app/api/channel-option-categories/route.ts`
- `web/src/app/api/channel-option-categories/rebuild/route.ts`
- `web/src/app/api/channel-option-category-deltas/route.ts`
- `web/src/app/api/channel-option-value-policies/route.ts`
- `web/src/app/api/channel-product-option-mappings-v2/route.ts`
- `web/src/app/api/channel-product-option-mappings-v2-backfill/route.ts`
- `web/src/app/api/channel-product-option-mappings-v2-logs/route.ts`
- `web/src/app/(app)/settings/shopping/auto-price/page.tsx`

### DB Objects To Drop In This Batch
- `channel_option_category_v2`
- `channel_option_value_policy`
- `channel_option_value_policy_log`
- any old category/value-policy RPCs still attached only to the above routes

### What Must Already Be True Before Drop
- no live UI save flow calls the above routes
- explicit option-entry mapping APIs are already used for authoring saves
- deprecated routes are not part of any critical runtime path

### Verification Commands
```bash
npm run build
```

```bash
python - <<'PY'
from pathlib import Path
import re
root = Path('web/src')
patterns = [
    'channel_option_category_v2',
    'channel_option_value_policy',
    'channel_option_value_policy_log',
]
for pattern in patterns:
    hits = []
    for path in root.rglob('*'):
        if path.suffix.lower() not in {'.ts', '.tsx', '.js'}:
            continue
        text = path.read_text(encoding='utf-8', errors='ignore')
        if pattern in text:
            hits.append(str(path))
    print(pattern, len(hits), hits)
PY
```

### Runtime QA
- open `shopping/mappings`
- open `shopping/auto-price`
- confirm no request goes to deprecated category/value-policy/v2 authoring routes

### Drop Checklist
- `web/src` references to `channel_option_category_v2` are zero
- `web/src` references to `channel_option_value_policy*` are zero
- no browser network call hits the deprecated authoring endpoints
- `DROP ... RESTRICT` succeeds for each object without unexpected dependents

---

## Batch 2 - Demote `sales_channel_product` To Identity Only And Unify Size

### Goal
Stop treating `sales_channel_product.option_*` and product-scoped size grids as pricing truth.

### Files To Modify
- `supabase/migrations/<new>_demote_sales_channel_product_to_identity_only.sql`
- `supabase/migrations/<new>_shared_size_grid.sql`
- `web/src/app/api/channel-products/route.ts`
- `web/src/app/api/channel-products/bulk/route.ts`
- `web/src/app/api/channel-products/[id]/route.ts`
- `web/src/app/api/channel-products/variants/route.ts`
- `web/src/app/api/channel-products/editor/route.ts`
- `web/src/lib/shop/mapping-option-details.ts`
- `web/src/lib/shop/weight-grid-store.js`
- `web/src/lib/shop/persisted-size-grid-rebuild.js`
- `web/src/app/(app)/settings/shopping/mappings/page.tsx`
- `web/src/app/(app)/settings/shopping/auto-price/page.tsx`

### DB Objects To Replace Or Drop After Cutover
- `cms_fn_upsert_sales_channel_product_mappings_v1`
- `sales_channel_product.option_material_code`
- `sales_channel_product.option_color_code`
- `sales_channel_product.option_decoration_code`
- `sales_channel_product.option_size_value`
- old pricing override/manual/sync columns on `sales_channel_product`
- product-scoped size-grid semantics (`channel_option_weight_grid_v1` as pricing truth)

### Required Architectural Changes
- `/api/channel-products*` becomes identity-only
- pricing validation moves to explicit entry mappings/registries only
- size allowlist and size validation become channel-wide shared `material + weight`
- no save path may reject because of old product-scoped size-grid mismatch

### Verification Commands
```bash
npm run build
```

```bash
node --test tests/option-entry-mapping.test.ts tests/explicit-option-entry-canonical-inputs.test.ts
```

```bash
python - <<'PY'
import urllib.request, json
url = 'http://127.0.0.1:3001/api/channel-products/variants?channel_id=<CHANNEL_ID>&master_item_id=4551f046-607f-4bf0-85db-9eafab542cd0&external_product_no=33'
print(urllib.request.urlopen(url).read().decode())
PY
```

### Runtime QA
- `shopping/mappings` loads product `33`
- size dropdown for material `925` shows actual values
- saving a row no longer fails with `OPTION_DETAIL_NOT_ALLOWED`
- color bucket select is populated when registry rows exist

### Drop Checklist
- `/api/channel-products` no longer validates pricing fields against old allowlists
- `sales_channel_product.option_*` is not read as pricing truth anywhere
- size dropdown source is shared grid only, not per-product fallback
- browser save flow succeeds without old size-grid 
- `DROP FUNCTION public.cms_fn_upsert_sales_channel_product_mappings_v1(...) RESTRICT` is now possible after caller cutover

---

## Batch 3 - Replace Runtime And Explain With Publish Lineage Only

### Goal
Make recompute, preview, explain, dashboard, and storefront read only the new canonical/publish lineage.

### Files To Modify
- `web/src/app/api/pricing/recompute/route.ts`
- `web/src/app/api/channel-price-snapshot-explain/route.ts`
- `web/src/app/api/channel-price-summary/route.ts`
- `web/src/app/api/channel-price-dashboard/route.ts`
- `web/src/app/api/public/storefront-option-breakdown/route.ts`
- `web/src/lib/shop/single-sot-pricing.js`
- `web/src/lib/shop/preview-option-sot.js`
- `web/src/lib/shop/channel-option-central-control.js`
- `web/src/lib/shop/explicit-option-entry-canonical-inputs.ts`
- `web/src/app/api/channel-prices/push/route.ts` (only if lineage assumptions change)

### DB Objects To Drop After Cutover
- `v_price_composition_flat_v2`
- `channel_option_current_state_v1`

### DB Objects To Keep
- `pricing_snapshot`
- `pricing_snapshot_latest`
- `channel_price_snapshot_latest`
- `product_price_publish_*`
- `product_price_live_state_v1`
- `price_sync_job`
- `price_sync_job_item`

### Required Architectural Changes
- recompute trusts explicit entry mappings plus registries only
- preview/explain/dashboard do not read V2 snapshot view
- current-state does not decide option meaning or price meaning
- storefront remains publish-only and fail-closed

### Verification Commands
```bash
npm run build
```

```bash
node --test tests/single-sot-pricing.test.ts tests/preview-option-sot.test.ts tests/explicit-option-entry-canonical-inputs.test.ts
```

```bash
python - <<'PY'
import urllib.request
url = 'http://127.0.0.1:3001/api/channel-price-snapshot-explain?channel_id=<CHANNEL_ID>&master_item_id=4551f046-607f-4bf0-85db-9eafab542cd0&external_product_no=33'
print(urllib.request.urlopen(url).read().decode())
PY
```

### Runtime QA
- `shopping/auto-price` detail panel loads without `Failed to read V2 snapshot view`
- `storefront-option-breakdown` returns publish-derived results only
- no stale/canonical fallback appears in preview source
- unresolved products still fail closed

### Drop Checklist
- `web/src` references to `v_price_composition_flat_v2` are zero
- `web/src` pricing/explain/storefront references to `channel_option_current_state_v1` as truth are zero
- snapshot explain no longer 500s on product `33`
- dashboard and summary render from publish lineage
- `DROP VIEW public.v_price_composition_flat_v2 RESTRICT` succeeds
- `DROP TABLE public.channel_option_current_state_v1 RESTRICT` succeeds

---

## Batch 4 - Replace Old Rule Core And Final Purge

### Goal
Replace the old labor/sync-rule operating model with a unified rule core and remove the remaining old rule tables and rule-shaped UI.

### Files To Modify
- `supabase/migrations/<new>_channel_option_rule_entry_v1.sql`
- `web/src/app/api/option-labor-rules/route.ts`
- `web/src/app/api/option-labor-rule-pools/route.ts`
- `web/src/app/api/master-rule-pools/route.ts`
- `web/src/app/(app)/settings/shopping/rules/page.tsx`
- `web/src/lib/shop/option-labor-rules.js`
- `web/src/lib/shop/option-labor-rules-impl.js`
- `web/src/app/api/channel-option-rule-catalogs/route.ts`
- `web/src/app/api/channel-products/[id]/route.ts`

### DB Objects To Drop After Cutover
- `channel_option_labor_rule_v1`
- `sync_rule_r1_material_delta`
- `sync_rule_r2_size_weight`
- `sync_rule_r3_color_margin`
- `sync_rule_r4_decoration`
- old sync-rule-set tables and old sync-rule RPCs

### Required Architectural Changes
- one unified rule table supports `MATERIAL/SIZE/COLOR_PLATING/DECOR/ADDON/OTHER/NOTICE`
- no runtime path depends on old sync-rule or labor-rule split
- rules UI no longer exposes old rule semantics or old categories

### Verification Commands
```bash
npm run build
```

```bash
python - <<'PY'
from pathlib import Path
root = Path('web/src')
patterns = [
    'channel_option_labor_rule_v1',
    'sync_rule_r1_material_delta',
    'sync_rule_r2_size_weight',
    'sync_rule_r3_color_margin',
    'sync_rule_r4_decoration',
]
for pattern in patterns:
    hits = []
    for path in root.rglob('*'):
        if path.suffix.lower() not in {'.ts', '.tsx', '.js'}:
            continue
        text = path.read_text(encoding='utf-8', errors='ignore')
        if pattern in text:
            hits.append(str(path))
    print(pattern, len(hits), hits)
PY
```

### Runtime QA
- `shopping/rules` works using the new unified rule core only
- rule save triggers recompute queue and publish updates correctly
- no old sync-rule concepts are visible in UI or network payloads

### Drop Checklist
- `web/src` references to `channel_option_labor_rule_v1` are zero in live runtime paths
- `web/src` references to `sync_rule_r*` are zero
- rules page no longer depends on old rule routes or pools
- runtime pricing works without old rule tables
- `DROP ... RESTRICT` succeeds for the old rule tables/functions

---

## Preserve List

These are not legacy by default and should survive the retirement.

- `sales_channel_product` (identity/linkage only)
- `channel_product_option_entry_mapping_v1`
- `channel_option_material_registry_v1`
- `channel_option_color_bucket_v1`
- `channel_option_addon_master_v1`
- `channel_option_notice_code_v1`
- `channel_option_other_reason_code_v1`
- `channel_color_combo_catalog_v1`
- unified option rule table
- `product_price_publish_base_v1`
- `product_price_publish_option_entry_v1`
- `product_price_publish_variant_v1`
- `product_price_live_state_v1`
- `pricing_snapshot`
- `pricing_snapshot_latest`
- `channel_price_snapshot_latest`
- `price_sync_job`
- `price_sync_job_item`
- `pricing_override`
- `pricing_adjustment`

---

## Recommended Migration Names

1. `cms_1216_drop_legacy_option_authoring.sql`
2. `cms_1217_demote_sales_channel_product_to_identity_only.sql`
3. `cms_1218_introduce_shared_size_grid_v1.sql`
4. `cms_1219_replace_runtime_with_publish_lineage.sql`
5. `cms_1220_replace_option_labor_rule_with_unified_rule_entry.sql`
6. `cms_1221_drop_remaining_runtime_legacy_price_objects.sql`

---

## One-Line Execution Order

1. Drop old category/value-policy authoring.
2. Demote `sales_channel_product` to identity-only.
3. Replace product-scoped size truth with one shared channel-wide size grid.
4. Move recompute/preview/explain/dashboard/storefront to publish lineage only.
5. Drop current-state and V2 snapshot view.
6. Replace old labor/sync rule core with one unified rule core.
7. Drop the remaining runtime legacy tables, views, functions, and columns.
