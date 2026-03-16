import test from 'node:test';
import assert from 'node:assert/strict';

import {
  toChannelProductIdentityInsertRow,
  toChannelProductIdentityPatch,
} from '../src/lib/shop/channel-product-identity.ts';

test('toChannelProductIdentityInsertRow nulls pricing-truth option fields', () => {
  const row = toChannelProductIdentityInsertRow({
    channel_id: 'ch-1',
    master_item_id: 'm-1',
    external_product_no: '33',
    external_variant_code: 'V1',
    option_material_code: '925',
    option_color_code: 'P',
    option_decoration_code: 'DECOR1',
    option_size_value: 1,
    current_product_sync_profile: 'GENERAL',
    mapping_source: 'MANUAL',
    is_active: true,
  });

  assert.equal(row.option_material_code, null);
  assert.equal(row.option_color_code, null);
  assert.equal(row.option_decoration_code, null);
  assert.equal(row.option_size_value, null);
  assert.equal(row.sync_rule_set_id, null);
  assert.equal(row.option_price_mode, 'SYNC');
  assert.equal(row.mapping_source, 'MANUAL');
});

test('toChannelProductIdentityPatch keeps identity fields and removes pricing patch fields', () => {
  const patch = toChannelProductIdentityPatch({
    master_item_id: 'm-2',
    external_product_no: '44',
    external_variant_code: 'V2',
    mapping_source: 'CSV',
    current_product_sync_profile: 'MARKET_LINKED',
    option_material_code: '18',
    option_size_value: 2,
    option_price_delta_krw: 5000,
  });

  assert.equal(patch.master_item_id, 'm-2');
  assert.equal(patch.external_product_no, '44');
  assert.equal(patch.external_variant_code, 'V2');
  assert.equal(patch.mapping_source, 'CSV');
  assert.equal(patch.current_product_sync_profile, 'MARKET_LINKED');
  assert.ok(!('option_material_code' in patch));
  assert.ok(!('option_size_value' in patch));
  assert.ok(!('option_price_delta_krw' in patch));
});
