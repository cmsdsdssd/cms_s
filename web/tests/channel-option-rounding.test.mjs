import test from 'node:test';
import assert from 'node:assert/strict';

const { resolveCentralOptionMapping } = await import('../src/lib/shop/channel-option-central-control.js');

test('option rounding ceilings OTHER deltas to 500 KRW units', () => {
  const result = resolveCentralOptionMapping({
    category: 'OTHER',
    masterMaterialCode: '14',
    rules: [],
    persisted: { other_delta_krw: 9200, other_reason: 'ETC' },
    optionRoundingUnit: 500,
    optionRoundingMode: 'CEIL',
  });

  assert.equal(result.resolved_delta_krw, 9500);
});

test('option rounding ceilings DECOR final amounts to 500 KRW units', () => {
  const result = resolveCentralOptionMapping({
    category: 'DECOR',
    masterMaterialCode: '14',
    rules: [{ rule_type: 'DECOR', category_key: 'DECOR', decoration_master_id: 'decor-1', decoration_model_name: '붕어장식', base_labor_cost_krw: 164700, additive_delta_krw: 0, is_active: true }],
    persisted: { decor_master_item_id_selected: 'decor-1', decor_final_amount_krw: 164700 },
    optionRoundingUnit: 500,
    optionRoundingMode: 'CEIL',
  });

  assert.equal(result.resolved_delta_krw, 165000);
});

test('option rounding leaves aligned COLOR deltas unchanged', () => {
  const result = resolveCentralOptionMapping({
    category: 'COLOR',
    masterMaterialCode: '14',
    rules: [],
    persisted: { color_code_selected: 'P', resolved_delta_krw: 4000 },
    colorBaseDeltaByCode: { P: 0 },
    optionRoundingUnit: 500,
    optionRoundingMode: 'CEIL',
  });

  assert.equal(result.resolved_delta_krw, 4000);
});
