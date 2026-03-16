import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAuthoritativeSharedSizeSeedRows } from '../src/lib/shop/shared-size-grid-seed.ts';

test('buildAuthoritativeSharedSizeSeedRows expands authored weight map into shared grid rows', () => {
  const rows = buildAuthoritativeSharedSizeSeedRows({
    channelId: 'ch-1',
    masterItemId: 'm-1',
    externalProductNo: '33',
    materialCode: '14',
    sizeMap: [
      { weight_g: 1, delta_krw: 0 },
      { weight_g: 2, delta_krw: 100 },
      { weight_g: 3, delta_krw: 200 },
    ],
  });

  assert.deepEqual(rows.map((row) => [row.material_code, row.weight_g, row.computed_delta_krw, row.computation_version]), [
    ['14', 1, 0, 'sot-authored-shared-grid-v1'],
    ['14', 2, 100, 'sot-authored-shared-grid-v1'],
    ['14', 3, 200, 'sot-authored-shared-grid-v1'],
  ]);
});
