import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDefaultSizeRuleSeeds } from '../src/lib/shop/shared-size-grid-seed.ts';

test('buildDefaultSizeRuleSeeds creates market-linked full-range rules for each material', () => {
  const rows = buildDefaultSizeRuleSeeds({
    channelId: 'ch-1',
    materials: ['14', '18', '925'],
  });

  assert.deepEqual(
    rows.map((row) => [row.scope_material_code, row.additional_weight_min_g, row.additional_weight_max_g, row.size_price_mode]),
    [
      ['14', 0, 100, 'MARKET_LINKED'],
      ['18', 0, 100, 'MARKET_LINKED'],
      ['925', 0, 100, 'MARKET_LINKED'],
    ],
  );
});
