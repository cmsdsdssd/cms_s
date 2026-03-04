# Shopping Option SoT Contract

## Goal

Enforce deterministic pricing behavior with a single source of truth.

- SoT table: `sales_channel_product`
- Computation output: `pricing_snapshot`
- Dashboard view pin: `compute_request_id` from latest recompute action

## Category Contract

1. `소재` (Sync, classification only)
   - Always `manual_delta_krw = 0`
   - No rule engine usage
2. `사이즈` (Sync)
   - Manual dropdown delta in `[-1,000,000, 1,000,000]`, step `1,000`
   - No rule engine usage
3. `색상(도금포함)` (Sync)
   - Manual dropdown delta in `[-1,000,000, 1,000,000]`, step `1,000`
   - No rule engine usage
4. `장식` (Sync)
   - Supports explicit rule selection (R4) when provided
   - If no rule is selected, behaves as direct delta only
5. `기타` (Override)
   - Manual override delta path (outside category sync path)

## Persistence Rules

- `selected_rule_id`
  - Persist only when axis uses rule engine and an explicit rule is selected
  - Otherwise persist `null`
- `manual_delta_krw`
  - Persist category delta for Sync values
  - `소재` is always persisted as `0`
- `sync_rule_*_enabled`
  - `소재/사이즈/색상` => all false
  - `장식` => only `sync_rule_decoration_enabled` may be true when explicit rule exists

## Execution Policy

- Save action: `save -> recompute`
- Push action: explicit user action only (not auto on save)
- Dashboard reads should pin by `compute_request_id` when available

## Consistency Policy

- Batch save is all-or-nothing
- No partial success for category apply
- Recompute errors must block subsequent push

## Snapshot Drawer Explain Contract

- Drawer explain API source is only `pricing_snapshot` pinned by (`channel_id`, `master_item_id`, `compute_request_id`)
- Explain payload fields (canonical)
  - `master_base_price_krw`
  - `shop_margin_multiplier`
  - `price_after_margin_krw`
  - `base_adjust_krw`
  - `delta_material_krw`, `delta_size_krw`, `delta_color_krw`, `delta_decor_krw`, `delta_other_krw`, `delta_total_krw`
  - `final_target_price_krw`, `compute_request_id`, `computed_at`
- Invariant: `delta_total_krw = delta_material_krw + delta_size_krw + delta_color_krw + delta_decor_krw + delta_other_krw`
- If an older snapshot row violates the invariant due to legacy writes, API must normalize `delta_total_krw` to the summed value before returning.
