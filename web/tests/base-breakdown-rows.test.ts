import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBaseBreakdownRows, buildDetailedBaseBreakdown } from '../src/lib/shop/base-breakdown-rows.ts';

test('buildBaseBreakdownRows emits concise operator-facing rows from snapshot values', () => {
  const rows = buildBaseBreakdownRows({
    publishedBasePriceKrw: 3481000,
    snapshot: {
      material_final_krw: 1000000,
      labor_cost_applied_krw: 420000,
      labor_sell_total_plus_absorb_krw: 500000,
      fixed_pre_fee_krw: 10000,
      candidate_price_krw: 2000000,
      guardrail_price_krw: 2300000,
      guardrail_reason_code: 'MIN_MARGIN',
      rounded_target_price_krw: 3481000,
      material_code_effective: '14',
      computed_at: '2026-03-15T00:00:00Z',
    },
  });

  assert.deepEqual(rows.map((row) => row.label), [
    '소재 구성',
    '공임 구성',
    '고정 구성',
    '후보 기준가',
    '가드레일',
    '반올림',
    '게시 기준가',
  ]);
  assert.equal(rows[0]?.amountKrw, 1000000);
  assert.equal(rows[1]?.amountKrw, 420000);
  assert.notEqual(rows[1]?.amountKrw, 500000);
  assert.equal(rows.at(-1)?.amountKrw, 3481000);
});

test('buildDetailedBaseBreakdown derives detailed snapshot facts for the drawer', () => {
  const detailed = buildDetailedBaseBreakdown({
    publishedBasePriceKrw: 3481000,
    snapshot: {
      material_basis_resolved: 'GOLD',
      effective_tick_krw_g: 120000,
      tick_as_of: '2026-03-15T09:00:00Z',
      material_code_effective: '14',
      net_weight_g: 2,
      material_purity_rate_resolved: 0.585,
      material_adjust_factor_resolved: 1.1,
      material_final_krw: 154440,
      material_pre_fee_krw: 200000,
      labor_sell_total_krw: 300000,
      labor_sell_total_plus_absorb_krw: 340000,
      labor_cost_applied_krw: 280000,
      absorb_total_raw_krw: 50000,
      absorb_total_applied_krw: 40000,
      labor_pre_fee_krw: 400000,
      shop_margin_multiplier: 1.25,
      fixed_pre_fee_krw: 10000,
      candidate_pre_fee_krw: 610000,
      fee_rate: 0.12,
      candidate_price_krw: 683200,
      min_margin_rate_total: 0.18,
      guardrail_price_krw: 700000,
      guardrail_reason_code: 'MIN_MARGIN',
      rounded_target_price_krw: 700000,
      rounding_unit_used: 100,
      rounding_mode_used: 'UP',
      final_target_price_v2_krw: 700000,
      current_channel_price_krw: 700000,
      diff_krw: 0,
      diff_pct: 0,
      labor_component_json: {
        BASE_LABOR: {
          labor_cost_krw: 100000,
          labor_sell_krw: 120000,
          labor_absorb_raw_krw: 10000,
          labor_absorb_applied_krw: 8000,
          labor_cost_plus_absorb_krw: 108000,
          labor_sell_plus_absorb_krw: 128000,
        },
      },
    },
  });

  assert.ok(detailed);
  assert.equal(detailed?.marketTickKrwPerG, 120000);
  assert.equal(detailed?.effectiveFactor, 0.6435);
  assert.equal(detailed?.convertedWeightG, 1.287);
  assert.equal(detailed?.laborTotalExcludingAbsorbKrw, 240000);
  assert.equal(detailed?.laborTotalIncludingAbsorbKrw, 280000);
  assert.equal(detailed?.laborMarginAmountKrw, 120000);
  assert.ok(Math.abs((detailed?.laborMarginRate ?? 0) - (120000 / 280000)) < 0.000001);
  assert.equal(detailed?.selectedPriceBasis, 'guardrail');
  assert.equal(detailed?.storefrontSyncPass, true);
  assert.equal(detailed?.laborComponents[0]?.costExcludingAbsorbKrw, 100000);
  assert.equal(detailed?.laborComponents[0]?.costIncludingAbsorbKrw, 108000);
  assert.equal(detailed?.laborComponents[0]?.sellExcludingAbsorbKrw, 120000);
  assert.equal(detailed?.laborComponents[0]?.sellIncludingAbsorbKrw, 128000);
});


test('buildDetailedBaseBreakdown derives fallback rates when snapshot rate fields are absent', () => {
  const detailed = buildDetailedBaseBreakdown({
    publishedBasePriceKrw: 3481000,
    snapshot: {
      material_basis_resolved: 'GOLD',
      effective_tick_krw_g: 120000,
      tick_as_of: '2026-03-15T09:00:00Z',
      material_code_effective: '14',
      net_weight_g: 2,
      material_purity_rate_resolved: 0.585,
      material_adjust_factor_resolved: 1.1,
      material_final_krw: 154440,
      material_pre_fee_krw: 200000,
      labor_sell_total_krw: 300000,
      labor_sell_total_plus_absorb_krw: 340000,
      labor_cost_applied_krw: 280000,
      absorb_total_raw_krw: 50000,
      absorb_total_applied_krw: 40000,
      labor_pre_fee_krw: 400000,
      shop_margin_multiplier: 1.25,
      fixed_pre_fee_krw: 10000,
      candidate_pre_fee_krw: 610000,
      candidate_price_krw: 683200,
      cost_sum_krw: 444440,
      guardrail_price_krw: 700000,
      guardrail_reason_code: 'MIN_MARGIN',
      rounded_target_price_krw: 700000,
      rounding_unit_used: 100,
      rounding_mode_used: 'UP',
      final_target_price_v2_krw: 700000,
      current_channel_price_krw: 700000,
      diff_krw: 0,
      diff_pct: 0,
      labor_component_json: {
        BASE_LABOR: {
          labor_cost_krw: 100000,
          labor_sell_krw: 120000,
          labor_absorb_raw_krw: 10000,
          labor_absorb_applied_krw: 8000,
          labor_cost_plus_absorb_krw: 108000,
          labor_sell_plus_absorb_krw: 128000,
        },
      },
    },
  });

  assert.ok(detailed);
  assert.ok(Math.abs((detailed?.feeRate ?? 0) - (1 - (610000 / 683200))) < 0.000001);
  assert.ok(Math.abs((detailed?.materialMarginRate ?? 0) - ((200000 - 154440) / 154440)) < 0.000001);
  assert.ok(Math.abs((detailed?.laborMarginRate ?? 0) - ((400000 - 280000) / 280000)) < 0.000001);
  assert.ok(Math.abs((detailed?.guardrailRate ?? 0) - (1 - (1 - (610000 / 683200)) - (444440 / 700000))) < 0.000001);
});
