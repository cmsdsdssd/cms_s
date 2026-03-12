import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveCentralOptionMapping,
  collectAllowedColors,
} from '../src/lib/shop/channel-option-central-control.js';
import { computeOptionLaborBuckets } from '../src/lib/shop/option-labor-rules.js';
import { createPersistedSizeGridLookup } from '../src/lib/shop/weight-grid-store.js';

test('material_autofill_from_master resolves material context without additive delta', () => {
  const result = resolveCentralOptionMapping({
    category: 'MATERIAL',
    masterMaterialCode: '18',
    masterMaterialLabel: '18K',
    rules: [],
    persisted: null,
  });
  assert.equal(result.material_code_resolved, '18');
  assert.equal(result.resolved_delta_krw, 0);
  assert.equal(result.legacy_status, 'VALID');
});

test('size resolution uses persisted size grid cell', () => {
  const persistedSizeLookup = createPersistedSizeGridLookup([
    { material_code: '18', weight_g: 0.08, computed_delta_krw: 3500, computed_source_rule_id: 'size-grid-18-008', invalidated_reason: null },
  ]);
  const result = resolveCentralOptionMapping({
    category: 'SIZE',
    masterMaterialCode: '18',
    rules: [],
    persisted: { size_weight_g_selected: 0.08, resolved_delta_krw: 0 },
    persistedSizeLookup,
  });
  assert.equal(result.resolved_delta_krw, 3500);
  assert.deepEqual(result.source_rule_entry_ids, ['size-grid-18-008']);
  assert.equal(result.legacy_status, 'VALID');
});

test('size resolution fails closed without persisted grid', () => {
  const result = resolveCentralOptionMapping({
    category: 'SIZE',
    masterMaterialCode: '925',
    rules: [
      { rule_id: 'size-market', category_key: 'SIZE', scope_material_code: '925', additional_weight_min_g: 0.01, additional_weight_max_g: 0.05, size_price_mode: 'MARKET_LINKED', rounding_unit_krw: 100, rounding_mode: 'UP', is_active: true },
    ],
    persisted: { size_weight_g_selected: 0.02, material_code_resolved: '925' },
    sizeMarketContext: {
      goldTickKrwPerG: 150000,
      silverTickKrwPerG: 1200,
      materialFactors: { '925': { material_code: '925', purity_rate: 0.925, material_adjust_factor: 1, price_basis: 'SILVER' } },
    },
  });
  assert.equal(result.resolved_delta_krw, 0);
  assert.equal(result.legacy_status, 'UNRESOLVED');
  assert.ok(result.warnings.some((warning) => warning.includes('중앙 그리드')));
});

test('color resolution is deterministic from central rules', () => {
  const rules = [
    { rule_id: 'color-a', rule_type: 'COLOR', material_code: '18', color_code: '[도] G', delta_krw: 1100, is_active: true },
  ];
  const result = resolveCentralOptionMapping({
    category: 'COLOR',
    masterMaterialCode: '18',
    rules,
    persisted: { color_code_selected: '[도] G', resolved_delta_krw: 0 },
    colorBaseDeltaByCode: { '[도] G': 4000 },
  });
  assert.equal(result.resolved_delta_krw, 5100);
  assert.deepEqual(result.source_rule_entry_ids, ['color-a']);
  assert.deepEqual(collectAllowedColors(rules, '18'), ['[도] G']);
});

test('decor resolution uses snapshot labor plus additive delta', () => {
  const result = resolveCentralOptionMapping({
    category: 'DECOR',
    masterMaterialCode: '18',
    rules: [
      { rule_id: 'decor-a', rule_type: 'DECOR', decor_master_item_id: 'decor-master-1', decor_model_name_snapshot: 'D-100', decor_material_code_snapshot: '925', decor_weight_g_snapshot: 1.23, decor_total_labor_cost_snapshot: 22000, delta_krw: 3000, is_active: true },
    ],
    persisted: { decor_master_item_id_selected: 'decor-master-1', resolved_delta_krw: 0 },
  });
  assert.equal(result.resolved_delta_krw, 25000);
  assert.deepEqual(result.source_rule_entry_ids, ['decor-a']);
});

test('runtime market-linked buckets still work when context is provided', () => {
  const result = computeOptionLaborBuckets([
    { rule_id: 'size-market', master_item_id: 'master-1', external_product_no: 'P100', category_key: 'SIZE', scope_material_code: '925', additional_weight_min_g: 0.01, additional_weight_max_g: 0.05, size_price_mode: 'MARKET_LINKED', rounding_unit_krw: 100, rounding_mode: 'UP', is_active: true },
  ], {
    materialCode: '925',
    additionalWeightG: 0.02,
    platingEnabled: false,
    colorCode: null,
    decorationCode: null,
  }, {
    masterItemId: 'master-1',
    externalProductNo: 'P100',
    marketContext: {
      goldTickKrwPerG: 150000,
      silverTickKrwPerG: 1200,
      materialFactors: { '925': { material_code: '925', purity_rate: 0.925, material_adjust_factor: 1, price_basis: 'SILVER' } },
    },
  });
  assert.equal(result.size, 100);
  assert.equal(result.total, 100);
});
