import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSharedSizeGridSeedsFromLegacySources } from '../src/lib/shop/shared-size-grid-bootstrap.ts';

test('buildSharedSizeGridSeedsFromLegacySources pairs sorted weights with sorted deltas using master material', () => {
  const rows = buildSharedSizeGridSeedsFromLegacySources({
    channelId: 'ch-1',
    masterItemId: 'm-1',
    externalProductNo: '33',
    materialCode: '14',
    weights: [5, 1, 3.07, 2, 4],
    deltas: [23300, 0, 12100, 5800, 17500],
  });

  assert.deepEqual(
    rows.map((row) => [row.material_code, row.weight_g, row.computed_delta_krw]),
    [
      ['14', 1, 0],
      ['14', 2, 5800],
      ['14', 3.07, 12100],
      ['14', 4, 17500],
      ['14', 5, 23300],
    ],
  );
});
