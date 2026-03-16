import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDefaultSizeRuleSeeds } from '../src/lib/shop/shared-size-grid-seed.ts';

test('default size rule seeds create one MARKET_LINKED rule per material for the full 0~100 range', () => {
  const rows = buildDefaultSizeRuleSeeds({
    channelId: 'ch-1',
    masterItemId: 'm-1',
    externalProductNo: '33',
    materials: ['14', '18', '925'],
  });

  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => [row.scope_material_code, row.additional_weight_min_g, row.additional_weight_max_g, row.size_price_mode, row.rounding_unit_krw]), [
    ['14', 0, 100, 'MARKET_LINKED', 100],
    ['18', 0, 100, 'MARKET_LINKED', 100],
    ['925', 0, 100, 'MARKET_LINKED', 100],
  ]);
});
