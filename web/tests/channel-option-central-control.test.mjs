import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveCentralOptionMapping,
  collectAllowedSizeWeights,
  collectAllowedColors,
} from '../src/lib/shop/channel-option-central-control.js';
import { computeOptionLaborBuckets } from '../src/lib/shop/option-labor-rules.js';

test('material_autofill_from_master resolves material context without additive delta', () => {
  const result = resolveCentralOptionMapping({
    category: 'MATERIAL',
    masterMaterialCode: '18',
    masterMaterialLabel: '18K',
    rules: [],
    persisted: null,
  });

  assert.equal(result.category, 'MATERIAL');
  assert.equal(result.material_code_resolved, '18');
  assert.equal(result.material_label_resolved, '18K');
  assert.equal(result.resolved_delta_krw, 0);
  assert.equal(result.legacy_status, 'VALID');
});

test('size_price_by_material_and_weight accumulates overlapping additive rules', () => {
  const rules = [
    { rule_id: 'size-a', rule_type: 'SIZE', material_code: '18', weight_min_g: 0.01, weight_max_g: 0.1, delta_krw: 3000, is_active: true },
    { rule_id: 'size-b', rule_type: 'SIZE', material_code: '18', weight_min_g: 0.07, weight_max_g: 0.1, delta_krw: 500, is_active: true },
  ];

  const result = resolveCentralOptionMapping({
    category: 'SIZE',
    masterMaterialCode: '18',
    rules,
    persisted: {
      size_weight_g_selected: 0.08,
      resolved_delta_krw: 0,
    },
  });

  assert.equal(result.material_code_resolved, '18');
  assert.equal(result.size_weight_g_selected, 0.08);
  assert.equal(result.resolved_delta_krw, 3500);
  assert.deepEqual(result.source_rule_entry_ids, ['size-a', 'size-b']);
  assert.equal(result.legacy_status, 'VALID');
});

test('collectAllowedSizeWeights expands active ranges into unique sorted choices for one material', () => {
  const rules = [
    { rule_id: 'size-a', rule_type: 'SIZE', material_code: '18', weight_min_g: 0.01, weight_max_g: 0.03, delta_krw: 3000, is_active: true },
    { rule_id: 'size-b', rule_type: 'SIZE', material_code: '18', weight_min_g: 0.03, weight_max_g: 0.05, delta_krw: 500, is_active: true },
    { rule_id: 'size-c', rule_type: 'SIZE', material_code: '14', weight_min_g: 0.01, weight_max_g: 0.02, delta_krw: 1000, is_active: true },
  ];

  assert.deepEqual(collectAllowedSizeWeights(rules, '18'), ['0.01', '0.02', '0.03', '0.04', '0.05']);
});

test('color_price_by_material_and_color defaults to the first rule-defined amount when no persisted amount exists', () => {
  const rules = [
    { rule_id: 'color-a', rule_type: 'COLOR', material_code: '18', color_code: 'YG', delta_krw: 15000, is_active: true },
    { rule_id: 'color-b', rule_type: 'COLOR', material_code: '18', color_code: 'WG', delta_krw: 17000, is_active: true },
    { rule_id: 'color-c', rule_type: 'COLOR', material_code: '14', color_code: 'YG', delta_krw: 9000, is_active: true },
  ];

  const result = resolveCentralOptionMapping({
    category: 'COLOR',
    masterMaterialCode: '18',
    rules,
    persisted: {
      color_code_selected: 'YG',
    },
  });

  assert.equal(result.color_code_selected, 'YG');
  assert.equal(result.resolved_delta_krw, 15000);
  assert.deepEqual(result.source_rule_entry_ids, ['color-a']);
  assert.equal(result.legacy_status, 'VALID');
  assert.deepEqual(collectAllowedColors(rules, '18'), ['WG', 'YG']);
});

test('color_price_by_material_and_color refreshes stale persisted amount to the active rule-defined set', () => {
  const rules = [
    { rule_id: 'color-a', rule_type: 'COLOR', material_code: '18', color_code: 'YG', delta_krw: 1100, is_active: true },
  ];

  const result = resolveCentralOptionMapping({
    category: 'COLOR',
    masterMaterialCode: '18',
    rules,
    persisted: {
      color_code_selected: 'YG',
      resolved_delta_krw: 1000,
    },
  });

  assert.equal(result.resolved_delta_krw, 1100);
  assert.equal(result.legacy_status, 'VALID');
  assert.deepEqual(result.source_rule_entry_ids, ['color-a']);
});

test('decor_additive_price_with_snapshot_metadata returns snapshot total labor plus additive delta', () => {
  const rules = [
    {
      rule_id: 'decor-a',
      rule_type: 'DECOR',
      decor_master_item_id: 'decor-master-1',
      decor_model_name_snapshot: 'D-100',
      decor_material_code_snapshot: '925',
      decor_weight_g_snapshot: 1.23,
      decor_total_labor_cost_snapshot: 22000,
      delta_krw: 3000,
      is_active: true,
    },
  ];

  const result = resolveCentralOptionMapping({
    category: 'DECOR',
    masterMaterialCode: '18',
    rules,
    persisted: {
      decor_master_item_id_selected: 'decor-master-1',
      resolved_delta_krw: 0,
    },
  });

  assert.equal(result.decor_master_item_id_selected, 'decor-master-1');
  assert.equal(result.decor_model_name_selected, 'D-100');
  assert.equal(result.decor_material_code_snapshot, '925');
  assert.equal(result.decor_weight_g_snapshot, 1.23);
  assert.equal(result.decor_total_labor_cost_snapshot, 22000);
  assert.equal(result.resolved_delta_krw, 25000);
  assert.deepEqual(result.source_rule_entry_ids, ['decor-a']);
});

test('legacy_mapping_kept_with_warning_when_rule_removed preserves stored value and marks legacy', () => {
  const result = resolveCentralOptionMapping({
    category: 'SIZE',
    masterMaterialCode: '18',
    rules: [],
    persisted: {
      size_weight_g_selected: 0.09,
      resolved_delta_krw: 3500,
    },
  });

  assert.equal(result.size_weight_g_selected, 0.09);
  assert.equal(result.resolved_delta_krw, 3500);
  assert.equal(result.legacy_status, 'LEGACY_OUT_OF_RANGE');
  assert.ok(result.warnings.some((warning) => warning.includes('허용 범위')));
});

test('other_manual_delta_requires_reason_and_tracks_unresolved_when_missing', () => {
  const missingReason = resolveCentralOptionMapping({
    category: 'OTHER',
    masterMaterialCode: '18',
    rules: [],
    persisted: {
      other_delta_krw: 500,
      other_reason: '',
      resolved_delta_krw: 500,
    },
  });

  assert.equal(missingReason.legacy_status, 'UNRESOLVED');
  assert.ok(missingReason.warnings.some((warning) => warning.includes('사유')));

  const valid = resolveCentralOptionMapping({
    category: 'OTHER',
    masterMaterialCode: '18',
    rules: [],
    persisted: {
      other_delta_krw: 500,
      other_reason: '특별 케이스',
      resolved_delta_krw: 500,
    },
  });

  assert.equal(valid.resolved_delta_krw, 500);
  assert.equal(valid.legacy_status, 'VALID');
  assert.equal(valid.other_reason, '특별 케이스');
});

test('computeOptionLaborBuckets accumulates overlapping size rules in runtime path', () => {
  const result = computeOptionLaborBuckets([
    { rule_id: 'size-a', category_key: 'SIZE', scope_material_code: '18', additional_weight_min_g: 0.01, additional_weight_max_g: 0.10, additive_delta_krw: 3000, is_active: true },
    { rule_id: 'size-b', category_key: 'SIZE', scope_material_code: '18', additional_weight_min_g: 0.07, additional_weight_max_g: 0.10, additive_delta_krw: 500, is_active: true },
  ], {
    materialCode: '18',
    additionalWeightG: 0.08,
    platingEnabled: false,
    colorCode: null,
    decorationCode: null,
  });

  assert.equal(result.size, 3500);
  assert.equal(result.total, 3500);
});
