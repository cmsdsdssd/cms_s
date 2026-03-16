import test from 'node:test';
import assert from 'node:assert/strict';

import { collapseSharedSizeGridRows, createPersistedSizeGridLookup } from '../src/lib/shop/weight-grid-store.js';

test('collapseSharedSizeGridRows deduplicates by material and weight across products', () => {
  const rows = collapseSharedSizeGridRows([
    { channel_id: 'ch-1', external_product_no: '33', material_code: '925', weight_g: 1, computed_delta_krw: 100, invalidated_reason: null },
    { channel_id: 'ch-1', external_product_no: '44', material_code: '925', weight_g: 1, computed_delta_krw: 100, invalidated_reason: null },
    { channel_id: 'ch-1', external_product_no: '55', material_code: '925', weight_g: 2, computed_delta_krw: 200, invalidated_reason: null },
  ]);

  assert.equal(rows.length, 2);
});

test('createPersistedSizeGridLookup exposes shared size choices after collapsing rows', () => {
  const lookup = createPersistedSizeGridLookup(collapseSharedSizeGridRows([
    { channel_id: 'ch-1', external_product_no: '33', material_code: '925', weight_g: 1, computed_delta_krw: 100, invalidated_reason: null },
    { channel_id: 'ch-1', external_product_no: '55', material_code: '925', weight_g: 2, computed_delta_krw: 200, invalidated_reason: null },
  ]));

  assert.deepEqual(
    lookup.choicesByMaterial.get('925')?.map((row: { value: string; delta_krw: number }) => [row.value, row.delta_krw]),
    [['1.00', 100], ['2.00', 200]],
  );
});
