import test from 'node:test';
import assert from 'node:assert/strict';

import { planMissingActiveBaseRows } from '../src/lib/shop/channel-product-base-row.js';

test('planMissingActiveBaseRows seeds a canonical base row for first-save variant-only writes', () => {
  const result = planMissingActiveBaseRows({
    existingRows: [],
    incomingRows: [
      {
        channel_id: 'channel-1',
        master_item_id: 'master-1',
        external_product_no: 'P0001',
        external_variant_code: 'V1',
        sync_rule_set_id: 'ruleset-1',
        option_price_mode: 'SYNC',
        current_product_sync_profile: 'MARKET_LINKED',
        is_active: true,
      },
    ],
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('expected plan to succeed');
  assert.equal(result.rows.length, 1);
  assert.deepEqual(result.rows[0], {
    channel_id: 'channel-1',
    master_item_id: 'master-1',
    external_product_no: 'P0001',
    external_variant_code: '',
    sync_rule_set_id: 'ruleset-1',
    option_material_code: null,
    option_color_code: null,
    option_decoration_code: null,
    option_size_value: null,
    material_multiplier_override: null,
    size_weight_delta_g: null,
    size_price_override_enabled: false,
    size_price_override_krw: null,
    option_price_delta_krw: null,
    option_price_mode: 'SYNC',
    option_manual_target_krw: null,
    include_master_plating_labor: true,
    sync_rule_material_enabled: true,
    sync_rule_weight_enabled: true,
    sync_rule_plating_enabled: true,
    sync_rule_decoration_enabled: true,
    sync_rule_margin_rounding_enabled: true,
    current_product_sync_profile: 'MARKET_LINKED',
    mapping_source: 'AUTO',
    is_active: true,
  });
});
