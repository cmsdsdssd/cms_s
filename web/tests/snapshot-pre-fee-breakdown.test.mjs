import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSnapshotPreFeeBreakdownRows } from '../src/lib/shop/snapshot-pre-fee-breakdown.js';

test('snapshot pre-fee breakdown rows use dedicated pre-fee keys and preserve amounts', () => {
  assert.deepEqual(
    buildSnapshotPreFeeBreakdownRows({
      laborPreFee: 247125,
      materialPreFee: 2023324,
      totalPreFee: 2272671,
    }).map((row) => ({ key: row.key, valueText: row.valueText })),
    [
      { key: 'labor-pre-fee', valueText: '247,125won' },
      { key: 'material-pre-fee', valueText: '2,023,324won' },
      { key: 'total-pre-fee', valueText: '2,272,671won' },
    ],
  );
});
