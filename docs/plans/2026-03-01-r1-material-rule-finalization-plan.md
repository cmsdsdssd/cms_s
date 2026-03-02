# 2026-03-01 R1 Material Rule Finalization Plan

## Fixed Decisions (User-confirmed)

1. Base reference for R1 is the user-selected `BASE` value in option category.
2. R1 matching is strict `source_material_code + target_material_code`.
3. R1 weight basis uses `baseNetWeight` (no R2 weight effect).
4. R1 multiplier uses `option_weight_multiplier * option_18k_weight_multiplier` (18K case).
5. R1 match failure blocks apply/save with explicit error.
6. UI must show both option delta and final price delta vs BASE.
7. Acceptance scenario uses `14K/18K` pair.

## Implementation Scope

### A. Dashboard Apply/Restore
- Auto-resolve R1 rule IDs using strict source+target mapping.
- Persist resolved `selected_rule_id` into `channel_option_value_policy`.
- On drawer open/rule type switch, prefill sync rows with strict-resolved R1 rule IDs.
- If unresolved, block apply with clear row-level error.

### B. Recompute Engine
- Load `channel_option_value_policy` for `rule_type=R1` + `value_mode=BASE`.
- Build per-master R1 source material baseline from policy `axis_value`.
- In R1 loop, require:
  - `source_material_code` present and equals baseline source material.
  - `target_material_code` equals option material code.
- Use source material purity/adjust/tick derived from the baseline source material.

### C. Display Contract
- In option table rows:
  - Expected option amount: absolute and delta vs BASE.
  - Expected final amount: absolute and delta vs BASE.
  - Rule labels show delta (`Δ +/-`) to avoid ambiguity.

## Acceptance Criteria

1. `14K` marked BASE shows `기본값 대비 0`.
2. `18K` sync row with matched R1 rule shows non-zero delta when rule defines difference.
3. If source+target strict match is absent, apply is blocked with explicit value-level error.
4. After save/reopen, R1 rule selections are restored from policy persistence.
5. Build and typecheck pass.
