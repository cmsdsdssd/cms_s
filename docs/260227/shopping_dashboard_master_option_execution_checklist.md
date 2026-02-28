# Shopping Dashboard Master/Option Execution Checklist

## Scope
- Dashboard shows one row per `master_item_id` by default.
- Detail panel shows all mapped option variants for selected master.
- Pull current price uses product base price only (not variant-by-variant lookup).
- Recompute/Push can execute for all options under selected master(s) in one action.
- Base-price adjustment supports `+/-` delta, reason, and immutable logs.
- Per-master plating labor include checkbox affects recompute base labor.

## Detailed Tasks
- [x] Create execution checklist document and start progress tracking
- [x] Audit current dashboard/pull/recompute/push data flow and lock required change list
- [x] Add DB migration: `sales_channel_product.include_master_plating_labor` (default true)
- [x] Add DB migration: `channel_base_price_adjustment_log` table for +/− base price logs
- [x] Update channel-product APIs to read/write `include_master_plating_labor`
- [x] Add API to bulk-update `include_master_plating_labor` for a master+channel
- [x] Add API to create base-price delta log rows (`+/-`, reason)
- [x] Add API to read base-price delta logs by channel/master
- [x] Update recompute route select fields to include plating toggle + master plating value
- [x] Update recompute formula to include/exclude master plating labor by toggle
- [x] Update recompute formula to apply base-price delta sum at master level before option delta
- [x] Keep existing option deltas (`material_multiplier_override`, `size_weight_delta_g`, `option_price_delta_krw`) compatible
- [x] Refactor pull route to fetch base product price once per product_no and fan out to mapped variants
- [x] Ensure pull response still returns failure examples and robust insert fallback behavior
- [x] Refactor dashboard page state to master-group model (one master row + detail panel)
- [x] Add master-row selection model and action fan-out to all mapped option rows
- [x] Add master detail panel: option rows table + computed/observed fields
- [x] Add base-price +/- controls with reason input and log list in detail panel
- [x] Add per-master plating include checkbox in dashboard row/detail and persist toggle
- [x] Ensure push/recompute/pull actions work for selected masters and for whole channel when none selected
- [x] Update operator copy in UI for simplified workflow (base row first, detail options second)
- [x] Apply pending shopping migrations to remote DB via `npx supabase db push --yes`
- [x] Add option label auto-sync in push flow (`option_text` suffix like `(+3,000원)`)
- [x] Run LSP diagnostics on all modified files
- [x] Run `npm run build` verification
- [x] Update this checklist with final completion marks and final review notes

## Tracking Notes
- 2026-02-27: Checklist created.
- 2026-02-27: Implemented master-first dashboard with detail options, base-only pull fan-out, and per-master push/recompute selection fan-out.
- 2026-02-27: Added base price +/- adjustment logging API and UI integration with reason-required audit trail.
- 2026-02-27: Added per-master plating include toggle persistence and recompute integration.
- 2026-02-27: Applied migrations `1012/1013/1014` to remote Supabase successfully.
- 2026-02-27: Added Cafe24 option label sync (via product options API) after successful variant push.
- 2026-02-27: Verified modified files with LSP diagnostics and `web` build success.
- 2026-02-27: Hardened push failure classification for option products with explicit `option_type=C` immutable codes/messages (`BASE_PRICE_IMMUTABLE_OPTION_TYPE_C`, `VARIANT_ADDITIONAL_IMMUTABLE_OPTION_TYPE_C`) and expanded variant additional_amount payload compatibility attempts.
- 2026-02-27: Applied migration `1015` to fix dashboard target-price binding (`pricing_snapshot_latest` and `v_channel_price_dashboard` now channel_product-aware), resolving wrong target pickup for `P000000N`.
- 2026-02-27: Executed single-product real run for `MS-553유색-R / P000000N` (`pull -> recompute -> push`) and confirmed target price is `2,880,000` while push is explicitly `SKIPPED` (not FAILED) with `BASE_PRICE_IMMUTABLE_OPTION_TYPE_C` due Cafe24 `option_type=C` base-price immutability.
