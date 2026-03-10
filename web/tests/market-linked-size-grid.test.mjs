import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMarketLinkedSizeGrid,
  resolveMarketLinkedSizeCell,
} from '../src/lib/shop/market-linked-size-grid.js';
import { buildMaterialFactorMap } from '../src/lib/material-factors.ts';

const materialFactors = buildMaterialFactorMap([
  { material_code: '925', purity_rate: 0.925, material_adjust_factor: 1, price_basis: 'SILVER' },
  { material_code: '18', purity_rate: 0.75, material_adjust_factor: 1.1, price_basis: 'GOLD' },
]);

test('buildMarketLinkedSizeGrid computes rounded centigram cells for market-linked SIZE rows', () => {
  const grid = buildMarketLinkedSizeGrid({
    rows: [
      {
        rule_id: 'size-market-1',
        master_item_id: 'master-1',
        external_product_no: 'P100',
        category_key: 'SIZE',
        scope_material_code: '925',
        additional_weight_min_g: 0.01,
        additional_weight_max_g: 0.03,
        size_price_mode: 'MARKET_LINKED',
        rounding_unit_krw: 100,
        rounding_mode: 'UP',
        formula_multiplier: 1,
        formula_offset_krw: 0,
        is_active: true,
      },
    ],
    masterItemId: 'master-1',
    externalProductNo: 'P100',
    materialCode: '925',
    marketContext: {
      goldTickKrwPerG: 150000,
      silverTickKrwPerG: 1200,
      materialFactors,
    },
  });

  assert.equal(grid.cells.length, 3);
  assert.deepEqual(
    grid.cells.map((cell) => [cell.weight_g, cell.computed_delta_krw]),
    [
      [0.01, 100],
      [0.02, 100],
      [0.03, 100],
    ],
  );
});

test('resolveMarketLinkedSizeCell uses product-scoped rows first and falls back to master-shared rows', () => {
  const rows = [
    {
      rule_id: 'fallback-row',
      master_item_id: 'master-1',
      external_product_no: 'P200',
      category_key: 'SIZE',
      scope_material_code: '925',
      additional_weight_min_g: 0.01,
      additional_weight_max_g: 0.05,
      size_price_mode: 'FIXED_DELTA',
      fixed_delta_krw: 700,
      is_active: true,
    },
  ];

  const resolved = resolveMarketLinkedSizeCell({
    rows,
    masterItemId: 'master-1',
    externalProductNo: 'P999',
    materialCode: '925',
    additionalWeightG: 0.02,
    marketContext: { goldTickKrwPerG: 0, silverTickKrwPerG: 0, materialFactors },
  });

  assert.equal(resolved.computed_delta_krw, 700);
  assert.equal(resolved.source_rule_id, 'fallback-row');
  assert.equal(resolved.scope_source, 'MASTER_FALLBACK');
});

test('resolveMarketLinkedSizeCell keeps FIXED_DELTA as compatibility fallback', () => {
  const resolved = resolveMarketLinkedSizeCell({
    rows: [
      {
        rule_id: 'fixed-row',
        master_item_id: 'master-1',
        external_product_no: 'P100',
        category_key: 'SIZE',
        scope_material_code: '18',
        additional_weight_min_g: 0.01,
        additional_weight_max_g: 0.05,
        size_price_mode: 'FIXED_DELTA',
        fixed_delta_krw: 1300,
        is_active: true,
      },
    ],
    masterItemId: 'master-1',
    externalProductNo: 'P100',
    materialCode: '18',
    additionalWeightG: 0.03,
    marketContext: { goldTickKrwPerG: 150000, silverTickKrwPerG: 1200, materialFactors },
  });

  assert.equal(resolved.computed_delta_krw, 1300);
  assert.equal(resolved.mode, 'FIXED_DELTA');
});

test('resolveMarketLinkedSizeCell marks material-factor gaps invalid for market-linked rows', () => {
  const resolved = resolveMarketLinkedSizeCell({
    rows: [
      {
        rule_id: 'bad-row',
        master_item_id: 'master-1',
        external_product_no: 'P100',
        category_key: 'SIZE',
        scope_material_code: '00',
        additional_weight_min_g: 0.01,
        additional_weight_max_g: 0.05,
        size_price_mode: 'MARKET_LINKED',
        rounding_unit_krw: 100,
        rounding_mode: 'UP',
        is_active: true,
      },
    ],
    masterItemId: 'master-1',
    externalProductNo: 'P100',
    materialCode: '00',
    additionalWeightG: 0.02,
    marketContext: { goldTickKrwPerG: 150000, silverTickKrwPerG: 1200, materialFactors },
  });

  assert.equal(resolved.valid, false);
  assert.match(resolved.error_message ?? '', /price basis|factor/i);
});
