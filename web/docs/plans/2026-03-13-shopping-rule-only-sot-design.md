# Shopping Rule-Only SOT Design

Goal: Rebuild shopping around a single Rule-only source of truth so authored pricing comes only from option rules and color catalog data, all published/storefront numbers come only from publish tables, and all legacy compatibility paths are removed.

Architecture: Split shopping into three layers only. Authored inputs are rules and catalogs. Identity/scope is channel-product mapping only. Derived outputs are recompute, publish, push, and live verification tables. Any path that reconstructs pricing from live data, legacy categories, saved policy deltas, or variant residuals is forbidden.

Tech Stack: Next.js route handlers, Supabase tables and migrations, shared pricing helpers in src/lib/shop, Playwright/browser QA.

---

## 1. Survivor Contract

### 1.1 Authored Truth

These are the only shopping pricing inputs that remain authoritative:

- channel_option_labor_rule_v1
- channel_color_combo_catalog_v1
- cms_master_item
- material factor config
- effective market ticks

Rules:

- MATERIAL is classification only.
- SIZE is authored only through SIZE rules and their derived persisted grid.
- COLOR_PLATING is authored only through color combo catalog and color-plating rules.
- DECOR is authored only through decor rules and master labor context.
- OTHER is an explicit manual rule category, not a compatibility bucket.

### 1.2 Identity and Scope

This survives, but only as identity, never as pricing truth:

- sales_channel_product

Allowed responsibility:

- channel/master/product/variant linkage
- canonical variant selection identity
- selected option identity fields needed to match variant structure

Forbidden responsibility:

- storing option price deltas
- storing sync/manual pricing modes
- storing rule-engine toggles
- storing multiplier/override pricing knobs

### 1.3 Derived Truth

These survive as outputs only:

- pricing_snapshot
- product_price_publish_base_v1
- product_price_publish_option_entry_v1
- product_price_publish_variant_v1
- product_price_live_state_v1
- channel_option_current_state_v1 as operational sync state only

Core invariant:

rules + catalog + market context + identity
-> canonical option rows
-> publish option entries
-> publish variants
-> push
-> live verify

Forbidden:

- live Cafe24 as pricing truth
- current_state as pricing truth
- category/policy tables as pricing truth
- variant-total residual decomposition as pricing truth

## 2. Required Numeric Invariant

If canonical option rows are:

- 925실버 = 0
- 1호 = 7000
- 골드 = 3000
- 붕어장식 = 2000

Then all outputs must agree:

- publish option entries = 0 / 7000 / 3000 / 2000
- derived variant total = 12000
- storefront axis values = same numbers
- live verify checks only equality against those numbers

Forbidden examples:

- 925실버 = 12000
- 1호 = 0 but variant total = 12000
- admin UI shows 7000, other admin UI shows 5900, storefront shows 0

## 3. Keep / Replace / Remove

### 3.1 Keep

- src/app/api/option-labor-rules/route.ts
- src/app/(app)/settings/shopping/rules/page.tsx
- src/lib/shop/weight-grid-store.js
- src/lib/shop/market-linked-size-grid.js only as grid compiler, not runtime truth
- src/app/api/pricing/recompute/route.ts
- src/app/api/channel-prices/push/route.ts
- src/app/api/price-sync-runs-v2/route.ts
- src/app/api/public/storefront-option-breakdown/route.ts
- src/lib/shop/publish-price-state.ts

### 3.2 Replace First, Then Remove

- src/app/api/channel-products/route.ts
- src/app/api/channel-products/bulk/route.ts
- src/app/api/channel-products/variants/route.ts
- src/app/api/channel-products/editor/route.ts
- src/app/(app)/settings/shopping/mappings/page.tsx
- src/app/(app)/settings/shopping/auto-price/page.tsx

These still contain identity plus old pricing semantics and must be cut over before schema deletion.

### 3.3 Remove Entirely

Old ruleset engine:

- sync_rule_set
- sync_rule_r1_material_delta
- sync_rule_r2_size_weight
- sync_rule_r3_color_margin
- sync_rule_r4_decoration
- /api/sync-rules/r1
- /api/sync-rules/r2
- /api/sync-rules/r3
- /api/sync-rules/r4
- /api/sync-rules/preview
- src/lib/shop/active-sync-rule-set.ts

Old category/value-policy authoring:

- channel_option_category_v2
- channel_option_category_delta_v1
- channel_option_value_policy
- /api/channel-option-categories
- /api/channel-option-categories/rebuild
- /api/channel-option-category-deltas
- /api/channel-option-value-policies

Old UI/compat:

- /settings/shopping/dashboard
- /api/channel-product-option-mappings-v2
- /api/channel-product-option-mappings-v2-backfill
- old shopping verification and backfill scripts
- mappings legacy option injection and legacy labels
- storefront or preview canonical/admin fallback

## 4. Legacy Fields To Remove From sales_channel_product

Remove after writer cutover:

- sync_rule_set_id
- material_multiplier_override
- size_weight_delta_g
- size_price_override_enabled
- size_price_override_krw
- option_price_delta_krw
- option_price_mode
- option_manual_target_krw
- include_master_plating_labor
- sync_rule_material_enabled
- sync_rule_weight_enabled
- sync_rule_plating_enabled
- sync_rule_decoration_enabled
- sync_rule_margin_rounding_enabled

Retain only identity/selective variant option identity fields.

## 5. Special Case: channel_option_value_policy_log

Do not drop it blindly.

Current reality:

- the policy table itself is legacy authoring and should be removed
- the log table is still reused as behavior/selection log in some flows

Required action:

- move axis selection / other reason / category override behavior to a new explicit rule-log contract
- then remove channel_option_value_policy_log

## 6. Rollout Order

### Phase 1 - Contract Freeze

- Update docs so all shopping code targets the same Rule-only contract.
- No schema deletion yet.

### Phase 2 - Read-Side Cutover

- Storefront reads publish tables only.
- Push/run status reads publish/current/live only.
- Variants route builds canonical rows from rules, grid, mapping identity only.
- Mappings and auto-price UI remove legacy/saved/compat labels and fallback displays.

### Phase 3 - Writer-Side Cutover

- Recompute stops reading category/value-policy legacy authoring.
- Recompute builds canonical rows only from rules, catalogs, factors, ticks, and mapping identity.
- Editor becomes recompute -> publish -> push orchestration only.

### Phase 4 - Mapping Model Shrink

- sales_channel_product becomes identity-only.
- Mapping save APIs stop writing any price-authoring semantics.

### Phase 5 - Schema/API Purge

- Drop sync-rule family.
- Drop category/value-policy authoring tables and APIs.
- Drop alias/backfill routes and old scripts.

### Phase 6 - Operational Cleanup

- Keep only operational state and verification tables that still serve publish/push/live monitoring.
- Remove dashboard/debug-only surfaces not needed for day-to-day operation.

## 7. Acceptance Criteria

- The only authored pricing inputs are option labor rules and color combo catalog.
- sales_channel_product no longer contains price-authoring knobs.
- Recompute never reads legacy category or policy authoring tables.
- Storefront never falls back to admin/canonical reconstruction.
- Push never recomputes from live values.
- Missing rule/grid data fails closed instead of synthesizing prices.
- The same product shows the same option delta everywhere: admin, publish, storefront, and live verify.
