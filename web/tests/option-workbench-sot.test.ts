import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGeneratedMaterialRegistrySeeds,
  inferUniqueMaterialCode,
  inferUniqueWeightForMaterialContext,
} from '../src/lib/shop/option-workbench-sot.ts';

test('buildGeneratedMaterialRegistrySeeds produces the default material registry set', () => {
  const rows = buildGeneratedMaterialRegistrySeeds('ch-1');
  assert.deepEqual(rows.map((row) => row.material_code), ['14', '18', '24', '925', '999']);
});

test('inferUniqueMaterialCode resolves 925실버 to 925 when unique', () => {
  const code = inferUniqueMaterialCode('925실버', [
    { material_code: '14', material_label: '14K' },
    { material_code: '925', material_label: '925실버' },
  ]);
  assert.equal(code, '925');
});

test('inferUniqueWeightForMaterialContext resolves exact numeric match in active material context', () => {
  const weight = inferUniqueWeightForMaterialContext('2호', '14', {
    '14': [
      { value: '1.00', label: '1.00g', delta_krw: 0 },
      { value: '2.00', label: '2.00g', delta_krw: 100 },
    ],
  });
  assert.equal(weight, 2);
});

test('inferUniqueWeightForMaterialContext returns null when no active material context exists', () => {
  const weight = inferUniqueWeightForMaterialContext('2호', null, {
    '14': [{ value: '2.00', label: '2.00g', delta_krw: 100 }],
    '925': [{ value: '2.00', label: '2.00g', delta_krw: 500 }],
  });
  assert.equal(weight, null);
});
