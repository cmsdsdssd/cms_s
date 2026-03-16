import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGeneratedColorBucketSeeds } from '../src/lib/shop/color-bucket-generation.ts';

test('buildGeneratedColorBucketSeeds creates one deterministic bucket per distinct delta', () => {
  const rows = buildGeneratedColorBucketSeeds({
    channelId: 'ch-1',
    deltas: [0, 4000, 8000, 4000],
  });

  assert.deepEqual(
    rows.map((row) => [row.bucket_code, row.sell_delta_krw]),
    [
      ['AUTO_0', 0],
      ['AUTO_4000', 4000],
      ['AUTO_8000', 8000],
    ],
  );
});
