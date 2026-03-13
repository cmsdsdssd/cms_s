import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const helperPath = ['..', 'src', 'lib', 'shop', 'preview-option-sot.js'].join(String.fromCharCode(47));
const { composePreviewOptionSotDeltas } = require(helperPath) as {
  composePreviewOptionSotDeltas: (args: {
    optionLaborRows: Array<Record<string, unknown>>;
    context: Record<string, unknown>;
    colorBaseDeltaByCode?: Record<string, number> | null;
  }) => {
    bucketSource: string;
    color_base_delta_krw: number;
    color_exception_delta_krw: number;
    color_resolved_delta_krw: number | null;
    color_delta_krw: number;
    total_delta_krw: number;
    sot_status: string | null;
    sot_warnings: string[];
  };
};

test('composePreviewOptionSotDeltas uses central color base only', () => {
  const result = composePreviewOptionSotDeltas({
    optionLaborRows: [
      {
        rule_id: 'color-18-gold',
        channel_id: 'channel-1',
        master_item_id: 'master-1',
        external_product_no: 'P100',
        category_key: 'COLOR_PLATING',
        scope_material_code: '18',
        additional_weight_g: null,
        additional_weight_min_g: null,
        additional_weight_max_g: null,
        plating_enabled: true,
        color_code: '[도] G',
        decoration_master_id: null,
        decoration_model_name: null,
        base_labor_cost_krw: 0,
        additive_delta_krw: 1200,
        is_active: true,
      },
    ],
    context: {
      materialCode: '18',
      additionalWeightG: 0,
      platingEnabled: true,
      colorCode: '[도] G',
      decorationCode: null,
      decorationMasterId: null,
    },
    colorBaseDeltaByCode: {
      '[도] G': 4000,
    },
  });

  assert.equal(result.bucketSource, 'OPTION_LABOR_RULES');
  assert.equal(result.color_base_delta_krw, 4000);
  assert.equal(result.color_exception_delta_krw, 0);
  assert.equal(result.color_resolved_delta_krw, 4000);
  assert.equal(result.color_delta_krw, 4000);
  assert.equal(result.total_delta_krw, 4000);
  assert.equal(result.sot_status, 'VALID');
  assert.deepEqual(result.sot_warnings, []);
});

test('composePreviewOptionSotDeltas ignores color exception rows and keeps central color base', () => {
  const result = composePreviewOptionSotDeltas({
    optionLaborRows: [
      {
        rule_id: 'color-18-gold-a',
        channel_id: 'channel-1',
        master_item_id: 'master-1',
        external_product_no: 'P100',
        category_key: 'COLOR_PLATING',
        scope_material_code: '18',
        additional_weight_g: null,
        additional_weight_min_g: null,
        additional_weight_max_g: null,
        plating_enabled: true,
        color_code: '[도] G',
        decoration_master_id: null,
        decoration_model_name: null,
        base_labor_cost_krw: 0,
        additive_delta_krw: 1100,
        is_active: true,
      },
      {
        rule_id: 'color-18-gold-b',
        channel_id: 'channel-1',
        master_item_id: 'master-1',
        external_product_no: 'P100',
        category_key: 'COLOR_PLATING',
        scope_material_code: '925',
        additional_weight_g: null,
        additional_weight_min_g: null,
        additional_weight_max_g: null,
        plating_enabled: true,
        color_code: '[도] G',
        decoration_master_id: null,
        decoration_model_name: null,
        base_labor_cost_krw: 0,
        additive_delta_krw: 1400,
        is_active: true,
      },
    ],
    context: {
      materialCode: '18',
      additionalWeightG: 0,
      platingEnabled: true,
      colorCode: '[도] G',
      decorationCode: null,
      decorationMasterId: null,
    },
    colorBaseDeltaByCode: {
      '[도] G': 4000,
    },
  });

  assert.equal(result.sot_status, 'VALID');
  assert.equal(result.color_exception_delta_krw, 0);
  assert.equal(result.color_resolved_delta_krw, 4000);
  assert.equal(result.color_delta_krw, 4000);
  assert.deepEqual(result.sot_warnings, []);
});
