# Price Single SoT Final Hardening Plan

## Goal

Raise the pricing pipeline from strong publish-first behavior to near-complete publish-only, fail-closed behavior for newly managed products.

## Remaining gaps

1. `channel-prices/push` still seeds candidate rows from `v_channel_price_dashboard` and rehydrates target/current fields from snapshot/live comparison rows.
2. `price-sync-runs-v2` still creates intents from `pricing_snapshot` rows and only filters them by publish presence.
3. `price-sync-runs-v2/[run_id]/execute` still sends `desired_target_price_by_channel_product`, keeping a second runtime target path alive.
4. mapping writes still silently canonicalize `external_product_no` instead of failing closed.

## Planned implementation

### A. Push becomes publish-only
- Stop reading `v_channel_price_dashboard` as the pricing source.
- Build push candidates from active `sales_channel_product` rows joined with publish base/variant rows for one `publish_version`.
- Keep `channel_price_snapshot_latest.current_price_krw` only for before-price logging, not target derivation.
- Compute variant target totals as `published_base_price_krw + published_additional_amount_krw`.

### B. Run creation becomes publish-driven
- Keep `pricing_snapshot` only for explanation/context fields.
- Derive target totals from publish base/variant rows, not `snapshot.final_target_price_krw`.
- Persist `publish_version` in responses as the primary operator-visible version key.

### C. Run execution stops injecting shadow targets
- Remove `desired_target_price_by_channel_product` from push requests.
- Pass only `publish_version` + `channel_product_ids`.

### D. Mapping writes fail on canonical drift
- Reject writes where `external_product_no` differs from the canonical active product number for the same `(channel_id, master_item_id)`.
- Keep alias history for reporting only; never rewrite the requested product number in-place.

## Verification

1. LSP diagnostics clean on touched files.
2. `node --test tests/price-sync-policy.test.mjs tests/single-sot-pricing.test.mjs` passes.
3. `npm run build` passes.
4. Real recompute for one product creates publish rows.
5. Real push using `publish_version` succeeds without any dashboard-derived price target.
6. Mapping write with a drifted `external_product_no` fails closed.
