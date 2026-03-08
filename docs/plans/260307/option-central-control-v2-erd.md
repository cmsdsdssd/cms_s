# Option Central Control v2 ERD (No Migration, 2026-03-07)

## 1) Data Principles
- No new tables are introduced; existing option rule, category, log, mapping, and current-state tables remain the storage model.
- Quick-edit axis values are UI projections; canonical pricing is always reconstructed from central rules plus saved axis selections.
- Save blocking is driven by current compact-row evaluation before persistence and sync.

## 2) Existing Tables
- `channel_option_labor_rule_v1`
  - Central source of truth for SIZE, COLOR_PLATING, DECOR, OTHER behavior.
- `channel_option_category_v2`
  - Stores per option value category and saved sync delta.
- `channel_option_value_policy_log`
  - Stores axis selections and overlays by `entry_key`.
- `sales_channel_product`
  - Stores variant mappings consumed by recompute/push.
- `channel_option_current_state_v1`
  - Stores post-apply state snapshots and operational status.

## 3) Overlay Payload Contracts

### 3.1 OPTION_CATEGORY
- `entry_key`
- `category_key`

### 3.2 OTHER_REASON
- `entry_key`
- `other_reason`
- `resolved_delta_krw`
- `category_key = OTHER`

### 3.3 OPTION_AXIS_SELECTION
- `entry_key`
- `category_key`
- `axis1_value`
- `axis2_value`
- `axis3_value`
- `decor_master_item_id`
- `decor_extra_delta_krw`
- `decor_final_amount_krw`

## 4) Canonical Read Model Fields
- `category_key` / `resolved_category_key`
- `legacy_status` / `warnings`
- `resolved_delta_krw`
- `source_rule_entry_ids`
- `material_code_resolved` / `material_label_resolved`
- `size_weight_g_selected`
- `color_code_selected`
- `decor_master_item_id_selected`
- `decor_model_name_selected`
- `decor_material_code_snapshot`
- `decor_weight_g_snapshot`
- `decor_total_labor_cost_snapshot`
- `decor_extra_delta_krw`
- `decor_final_amount_krw`
- `other_reason`
- `notice_value_selected`

## 5) Resolution Rules
- SIZE: resolve by material + selected weight against active SIZE rules.
- COLOR_PLATING: resolve by material + color + selected axis3 amount; `resolved_delta_krw` equals the selected axis3 amount, not the sum of all matched rules.
- COLOR_PLATING allowed amounts are the unique `delta_krw` values from matched rules only; generic fallback choices are not generated.
- If persisted COLOR `resolved_delta_krw` is outside the allowed rule-defined amount set, keep the row as legacy with warning.
- DECOR axis contract is `axis1=material`, `axis2=model`, `axis3=reference summary`, `price=final stored amount`.

## 6) Operational Flow
1. Build current compact rows from saved categories, rule rows, and in-memory axis selections.
2. Block save/sync when any compact row has `legacy_status != VALID` or warnings.
3. Persist category rows and axis-selection overlays.
4. Update variant mappings in `sales_channel_product`.
5. Run recompute, then push.
6. Report save success and sync failure separately when push does not complete.

## 7) UI Constraints Reflected in Data
- Fixed UI headers stay `1차분류`, `2차분류`, `3차분류`.
- Preview/edit warning counts are derived from current compact-row blocking rows.
- COLOR rows without rule-defined amounts stay blocked via legacy/unresolved state and disabled amount control.
