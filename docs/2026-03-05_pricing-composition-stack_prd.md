# PRD: Pricing V2 (Material-Code + Component GM + Reverse-Fee + Min-Margin)

- Document version: v3.0
- Date: 2026-03-05
- Status: Implementable
- Scope: pricing policy, recompute, snapshot, explain, sync intent generation
- Legacy compatibility: V1 remains readable; V2 is additive and opt-in

---

## 1. Problem and Goal

Current production path is centered on a single `margin_multiplier` and optional floor handling.
Business now requires an explicit component-based model with deterministic replay:

1. Material pricing from `material_code_effective` and metal ticks.
2. Separate target gross margins by component (material/labor/fixed).
3. Reverse fee applied once at the final price stage.
4. Minimum margin guardrail as the only lower bound in V2.
5. No general floor clamp in V2.

This PRD defines a contract engineers can implement without interpretation gaps.

---

## 2. Non-Negotiable Rules

1. V2 has no floor concept in pricing decision.
2. V2 final price is determined only by component candidate vs min-margin guardrail.
3. All V2 explain values come from snapshot, never live recomputation.
4. Rule resolution must be deterministic and replayable.
5. All money values are integer KRW in persisted outputs.

---

## 3. Glossary

- `GM` (gross margin rate): `(price - cost) / price`
- `fee_rate` (`f`): marketplace/payment fee rate on charged final price
- `min_margin_rate_total` (`m`): minimum net margin rate after fees
- `cost_sum_krw` (`C`): material + labor + fixed cost sum
- `candidate_price_krw`: component GM model final candidate price
- `min_margin_price_krw`: minimum price needed to satisfy `m` with fee `f`

Constraint: `0 <= f < 1`, `0 <= m < 1`, and `f + m < 1`

---

## 4. Inputs (Required)

### 4.1 Identity
- `channel_id`
- `master_item_id`
- `channel_product_id`
- `external_product_no`
- `external_variant_code` (nullable)

### 4.2 Material resolution inputs
- `material_code_default`
- `option_material_code` (nullable)
- `material_code_effective` (resolved)
- `master_weight_default_g`
- `master_deduction_weight_default_g`
- `size_weight_delta_g_applied`
- `tick_gold_krw_g`
- `tick_silver_krw_g`
- `material_purity_rate_resolved`
- `material_adjust_factor_resolved`

### 4.3 Labor and absorb inputs
- labor component costs (`base/stone/plating/etc/decor`)
- labor component sells (`base/stone/plating/etc/decor`)
- absorb applied totals by bucket
- absorb raw totals for debug only

### 4.4 Policy inputs
- `gm_material`
- `gm_labor`
- `gm_fixed`
- `fee_rate`
- `min_margin_rate_total`
- `fixed_cost_krw`
- `rounding_unit`
- `rounding_mode`
- `pricing_algo_version = REVERSE_FEE_V2`

---

## 5. Deterministic Resolution Contract

### 5.1 material_code precedence
1. `option_material_code` if valid and present
2. fallback `material_code_default`
3. if neither valid, set `material_resolution_status = MISSING` and block compute

### 5.2 basis/tick mapping
- `material_basis_resolved = GOLD` for gold family material codes
- `material_basis_resolved = SILVER` for silver family material codes
- `material_basis_resolved = NONE` for non-metal material codes

`effective_tick_krw_g` mapping:
- GOLD -> `tick_gold_krw_g`
- SILVER -> `tick_silver_krw_g`
- NONE -> `0`

### 5.3 tie-break and replay metadata
Snapshot must persist:
- `material_ruleset_version`
- `material_resolution_source_id`
- `material_resolution_effective_at`
- `resolution_input_hash`
- `calc_version`

---

## 6. Canonical Formula Order (Normative)

### Stage A: Material cost
1. `net_weight_g = max(master_weight_default_g - master_deduction_weight_default_g + size_weight_delta_g_applied, 0)`
2. `material_raw_krw = net_weight_g * effective_tick_krw_g`
3. `material_final_krw = material_raw_krw * material_purity_rate_resolved * material_adjust_factor_resolved`

### Stage B: Labor cost and explain columns
For each bucket `x in {base, stone, plating, etc, decor}`:
- `x_labor_cost_plus_absorb_krw = x_labor_cost_krw + x_labor_absorb_krw`
- `x_labor_sell_plus_absorb_krw = x_labor_sell_krw + x_labor_absorb_krw`

Totals:
- `labor_cost_applied_krw = sum(x_labor_cost_plus_absorb_krw)`
- `labor_sell_total_plus_absorb_krw = sum(x_labor_sell_plus_absorb_krw)`

### Stage C: Component pre-fee targets (GM space)
- `material_pre_fee_krw = material_final_krw / (1 - gm_material)`
- `labor_pre_fee_krw = labor_cost_applied_krw / (1 - gm_labor)`
- `fixed_pre_fee_krw = fixed_cost_krw / (1 - gm_fixed)`
- `candidate_pre_fee_krw = material_pre_fee_krw + labor_pre_fee_krw + fixed_pre_fee_krw`

### Stage D: Reverse fee candidate
- `candidate_price_krw = candidate_pre_fee_krw / (1 - fee_rate)`

### Stage E: Min-margin guardrail (post-fee net margin)
- `cost_sum_krw = material_final_krw + labor_cost_applied_krw + fixed_cost_krw`
- `min_margin_price_krw = cost_sum_krw / (1 - fee_rate - min_margin_rate_total)`
- `guardrail_price_krw = max(candidate_price_krw, min_margin_price_krw)`

Reason code:
- `COMPONENT_CANDIDATE_WIN`
- `MIN_MARGIN_WIN`
- `INVALID_PARAM_CLAMPED`

### Stage F: Final rounding
- `final_target_price_v2_krw = round_by_policy(guardrail_price_krw, rounding_unit, rounding_mode)`

No floor stage in V2.

---

## 7. Validation Rules

1. `delta_total_krw = delta_material_krw + delta_size_krw + delta_color_krw + delta_decor_krw + delta_other_krw`
2. `absorb_total_applied_krw = absorb_base_labor_krw + absorb_stone_labor_krw + absorb_plating_krw + absorb_etc_krw`
3. `labor_cost_applied_krw = sum(component cost_plus_absorb)`
4. `labor_sell_total_plus_absorb_krw = sum(component sell_plus_absorb)`
5. `f + m < 1` must hold
6. all GM and fee parameters must be in `[0,1)`

---

## 8. API Contract Changes

### 8.1 `POST /api/pricing/recompute`
Must persist V2 fields in snapshot:
- `pricing_algo_version`
- all V2 stage outputs (`material_pre_fee_krw`, `candidate_price_krw`, `min_margin_price_krw`, etc.)
- guardrail reason
- component `*_labor_sell_plus_absorb_krw` fields

### 8.2 `GET /api/channel-price-snapshot-explain`
Must return snapshot-first values and include:
- current view fields
- V2 extension fields
- raw vs applied absorb clearly separated

---

## 9. Sync Decision Contract

Given current price `current_channel_price_krw` and V2 target `final_target_price_v2_krw`:
- `diff_krw = final_target_price_v2_krw - current_channel_price_krw`
- run intent includes row when:
  - absolute diff is above policy threshold
  - row is not blocked by missing mapping/rules
  - row is not suppressed by explicit downsync policy

V2 no-floor must not reintroduce hidden max clamps.

---

## 10. Migration and Rollout

1. Additive schema only (no destructive changes).
2. Dual compute mode: V1 + V2 shadow.
3. Compare `v1_final` vs `v2_final`, track divergence metrics.
4. Canary channels with rollback by feature flag.
5. Cutover only after acceptance criteria pass.

---

## 11. Acceptance Criteria

1. Recompute replay with same `compute_request_id` yields identical V2 outputs.
2. All formula stages reconcile exactly at KRW integer outputs.
3. No floor columns used in V2 final decision path.
4. Guardrail reason code is always present when V2 enabled.
5. `*_labor_sell_plus_absorb_krw` equals sell + applied absorb for all buckets.
6. Explain/API/UI show identical V2 numbers from snapshot.

---

## 12. Anti-Patterns (Forbidden)

1. Using `cost * (1 + margin)` while labeling margin as GM.
2. Applying reverse-fee twice (directly or implicitly).
3. Mixing live-table recomputation into explain response.
4. Applying hidden floor/max clamp in V2.
5. Persisting only final price without stage breakdown and reason code.

---

## 13. Example (One-row deterministic)

- `material_final_krw=478500`, `labor_cost_applied_krw=249700`, `fixed_cost_krw=15000`
- `gm_material=0.18`, `gm_labor=0.22`, `gm_fixed=0`, `fee_rate=0.12`, `min_margin_rate_total=0.20`

Compute:
- `material_pre_fee_krw=583537`
- `labor_pre_fee_krw=320128`
- `candidate_pre_fee_krw=918665`
- `candidate_price_krw=1043938`
- `cost_sum_krw=743200`
- `min_margin_price_krw=1092941`
- `guardrail_price_krw=1092941` (`MIN_MARGIN_WIN`)
- final (1000 CEIL): `1093000`
