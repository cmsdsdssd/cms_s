# Shopping Rule-Only SOT Execution Checklist

Goal: Execute the shopping Rule-only SOT migration in a stable order so authored pricing truth comes only from option rules and color catalog data, while publish/storefront/live verification remain derived outputs.

Date: 2026-03-14

---

## Phase 0 - Contract Freeze

- [ ] Treat `web/docs/plans/2026-03-14-shopping-rule-only-sot-final-contract.md` as the governing contract.
- [ ] Mark `docs/shopping-option-sot-contract.md` as stale/replaced.
- [ ] Enforce the three-layer model everywhere:
  - authored truth
  - identity truth
  - derived truth
- [ ] Forbid backflow from live/current/publish into authored truth.

## Phase 1 - Read-Side Cutover

### Storefront
- [ ] Keep `web/src/app/api/public/storefront-option-breakdown/route.ts` publish-only.
- [ ] Remove any canonical/admin fallback.
- [ ] Return 422 when published option entries are missing.

### Variants / Admin Preview
- [ ] Make `web/src/app/api/channel-products/variants/route.ts` build canonical rows only from:
  - rules
  - color catalog
  - mapping identity
  - persisted size grid
  - master/factor/tick context
- [ ] Remove `channel_option_category_v2` as canonical truth.
- [ ] Remove `channel_option_value_policy_log` as canonical truth.

### Admin UI
- [ ] Remove legacy/saved/compat labels from `web/src/app/(app)/settings/shopping/mappings/page.tsx`.
- [ ] Remove legacy/saved/compat labels from `web/src/app/(app)/settings/shopping/auto-price/page.tsx`.
- [ ] Show only current allowlist/canonical/published/unresolved states.

## Phase 2 - Writer-Side Cutover

### Mapping Save
- [ ] Make `web/src/app/api/channel-products/route.ts` identity-only.
- [ ] Make `web/src/app/api/channel-products/bulk/route.ts` identity-only.
- [ ] Ignore/nullify all old pricing authoring fields.

### Recompute
- [ ] Make `web/src/app/api/pricing/recompute/route.ts` read only Rule-only inputs.
- [ ] Remove legacy category/category-delta/value-policy authoring reads.
- [ ] Remove old sync-rule engine semantics from pricing authoring.
- [ ] Keep `canonical rows -> publish rows` only.
- [ ] Fail closed on unresolved canonical rows.

### Editor / Push
- [ ] Make `web/src/app/api/channel-products/editor/route.ts` orchestration-only.
- [ ] Keep `web/src/app/api/channel-prices/push/route.ts` publish-version-pinned.
- [ ] Prevent live/current state from acting as pricing truth.

## Phase 3 - Mapping Model Shrink

- [ ] Treat `sales_channel_product` as identity-only.
- [ ] Keep only linkage and selected option identity fields.
- [ ] Stop using these as pricing truth:
  - `sync_rule_set_id`
  - `material_multiplier_override`
  - `size_weight_delta_g`
  - `size_price_override_enabled`
  - `size_price_override_krw`
  - `option_price_delta_krw`
  - `option_price_mode`
  - `option_manual_target_krw`
  - `include_master_plating_labor`
  - `sync_rule_material_enabled`
  - `sync_rule_weight_enabled`
  - `sync_rule_plating_enabled`
  - `sync_rule_decoration_enabled`
  - `sync_rule_margin_rounding_enabled`

## Phase 4 - Legacy Surface Removal

### Remove Old Ruleset Engine
- [ ] Remove `sync_rule_set`.
- [ ] Remove `sync_rule_r1_material_delta`.
- [ ] Remove `sync_rule_r2_size_weight`.
- [ ] Remove `sync_rule_r3_color_margin`.
- [ ] Remove `sync_rule_r4_decoration`.
- [ ] Remove old sync-rule APIs.
- [ ] Remove old sync-rule helpers.

### Remove Old Category/Policy Authoring
- [ ] Remove `channel_option_category_v2`.
- [ ] Remove `channel_option_category_delta_v1`.
- [ ] Remove `channel_option_value_policy`.
- [ ] Replace `channel_option_value_policy_log` with a dedicated selection/reason log contract, then remove it.

### Remove Old UI/Debug Surfaces
- [ ] Remove `/settings/shopping/dashboard` if no longer needed.
- [ ] Remove `/api/channel-product-option-mappings-v2`.
- [ ] Remove `/api/channel-product-option-mappings-v2-backfill`.
- [ ] Remove old shopping verification/backfill/debug scripts.

## Phase 5 - Database Contract Migration

- [ ] Apply Rule-only rewrite for `cms_fn_upsert_sales_channel_product_mappings_v1`.
- [ ] Drop sync-ruleset guard constraints for Rule-only mappings.
- [ ] Drop old pricing columns from `sales_channel_product`.
- [ ] Drop old ruleset and category/value-policy tables after code references reach zero.

## Phase 6 - Operational Cleanup

- [ ] Keep `pricing_snapshot` as compute trace only.
- [ ] Keep `product_price_live_state_v1` as live verification only.
- [ ] Keep `channel_option_current_state_v1` only if strictly operational; never pricing truth.
- [ ] Remove any route/helper that reads operational state as price source.

## Mandatory Verification After Every Batch

- [ ] `npm run build`
- [ ] Run diagnostics on modified files.
- [ ] Route QA:
  - [ ] `qa-storefront-rule-only.mts`
  - [ ] `qa-variants-rule-only.mts`
  - [ ] `qa-recompute.mts`
  - [ ] `qa-channel-products-post.mts`
- [ ] Browser QA:
  - [ ] `qa-mappings-identity-only-3000.mjs`

## Product-Specific Data Coverage Checklist

These are not architecture tasks, but they block successful recompute for incomplete products such as product `33`.

- [ ] SIZE rules exist for the product scope.
- [ ] Persisted size grid rows exist for the product scope.
- [ ] DECOR rules and decor master mapping exist.
- [ ] OTHER reason data exists where required.
- [ ] Recompute returns 200 instead of `PUBLISH_CANONICAL_ROWS_UNRESOLVED`.
- [ ] Storefront returns 200 with published entries.

## Completion Criteria

- [ ] Authored pricing truth is only rule/catalog/master/factor/tick based.
- [ ] `sales_channel_product` is identity-only.
- [ ] Canonical rows derive only from Rule-only inputs.
- [ ] Publish rows derive only from canonical rows.
- [ ] Storefront reads publish rows only.
- [ ] Live/current state is verification/operational only.
- [ ] Legacy ruleset/category/value-policy surfaces are removed from live code paths.
