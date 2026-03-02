# 2026-03-01 R2 Size Rule Finalization Plan

## Confirmed Decisions

1. Base reference is the user-selected `BASE` value.
2. R2 matching requires `match_material_code + match_category_code + weight range`.
3. Option value parse failure blocks save/apply with explicit error.
4. Single margin band (`margin_min == margin_max`) uses margin value when `delta_krw` is empty/0.
5. R2 match failure blocks save/apply.
6. UI must show both option delta and final delta vs BASE.
7. Restore priority is persisted `selected_rule_id` first.
8. Acceptance case uses 3-size values (for example 12/14/16).

## Implementation Scope

- Dashboard apply validation:
  - For `R2 + SYNC`, enforce exactly one `BASE` value.
  - Parse size value strictly; if parse fails, block with value-level error.
- Recompute + preview engine:
  - Require non-empty `match_material_code` and `match_category_code` in R2 rule match.
  - Keep single-margin fallback semantics for `delta_krw`.
- R2 table readability:
  - Show `rule_id / delta / material->category->weight / option_range` in classification text.

## Done Criteria

1. Reopen restores saved `selected_rule_id` per size value.
2. Invalid size token fails apply with explicit error.
3. R2 rule missing material/category no longer matches.
4. Build passes.
