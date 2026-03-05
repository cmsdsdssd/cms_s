# Pricing V2 Implementation Checklist

- Date: 2026-03-05
- Scope: Material-code + Component GM + Reverse-Fee + Min-Margin (No Floor)

## 1) Schema Migration

- [ ] Apply `supabase/migrations/20260305093000_cms_1201_pricing_v2_reverse_fee_no_floor_addonly.sql`
- [ ] Verify new `pricing_policy` columns exist and default values are set
- [ ] Verify new `pricing_snapshot` V2 columns exist
- [ ] Verify new V2 tables exist:
  - `pricing_snapshot_labor_component_v2`
  - `pricing_snapshot_material_resolution_v2`
  - `pricing_snapshot_margin_stage_v2`
  - `pricing_snapshot_guardrail_trace_v2`
- [ ] Verify `v_price_composition_flat_v2` view compiles and returns rows

## 2) Recompute API (`POST /api/pricing/recompute`)

- [ ] Resolve `material_code_effective` deterministically
- [ ] Persist material resolution metadata
- [ ] Persist bucket component rows with:
  - `labor_cost_plus_absorb_krw`
  - `labor_sell_plus_absorb_krw`
- [ ] Compute V2 stages in order:
  1. material cost
  2. labor applied totals
  3. component pre-fee
  4. reverse-fee candidate
  5. min-margin guardrail
  6. final rounding
- [ ] Persist `guardrail_reason_code`
- [ ] Ensure V2 does not apply any floor clamp

## 3) Explain API (`GET /api/channel-price-snapshot-explain`)

- [ ] Keep legacy response fields unchanged
- [ ] Add optional V2 extension fields from snapshot
- [ ] Return raw/applied absorb as separate values
- [ ] Prefer snapshot values only (no live recompute)

## 4) Sync Path

- [ ] Intent generation can choose `final_target_price_v2_krw`
- [ ] Threshold/downsync rules remain explicit and unchanged unless policy says otherwise
- [ ] Verify idempotent push behavior with pinned `compute_request_id`

## 5) Validation / Replay

- [ ] Validate `fee_rate + min_margin_rate_total < 1`
- [ ] Validate stage reconciliation against component sums
- [ ] Replay same snapshot twice, confirm identical V2 target
- [ ] Compare V1 vs V2 divergence in shadow mode

## 6) Rollout

- [ ] Feature flag for V2 write path
- [ ] Feature flag for V2 read path
- [ ] Canary channels first
- [ ] Rollback by flag only (no destructive rollback)
