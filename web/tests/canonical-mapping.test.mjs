import test from 'node:test';
import assert2 from 'node:assert/strict';
import assert from 'node:assert/strict';

import {
  looksCanonicalProductNo,
  isBaseVariantCode,
  shouldPreferCanonicalProductNo,
  resolveCanonicalProductNo,
  buildCanonicalBaseProductByMaster,
} from '../src/lib/shop/canonical-mapping.js';

test('canonical mapping helpers prefer canonical product numbers and blank variant as base', () => {
  assert.equal(looksCanonicalProductNo('P0001'), true);
  assert.equal(looksCanonicalProductNo('A0001'), false);
  assert.equal(isBaseVariantCode(''), true);
  assert.equal(isBaseVariantCode('V001'), false);
  assert.equal(shouldPreferCanonicalProductNo('', 'P0002'), true);
  assert.equal(shouldPreferCanonicalProductNo('A0002', 'P0002'), true);
  assert.equal(shouldPreferCanonicalProductNo('P0003', 'A0003'), false);
  assert.equal(resolveCanonicalProductNo(['A0002', 'P0002', 'A0001']), 'P0002');
});

test('buildCanonicalBaseProductByMaster selects one canonical base product per master', () => {
  const result = buildCanonicalBaseProductByMaster([
    { master_item_id: 'm1', external_product_no: 'A0002', external_variant_code: '' },
    { master_item_id: 'm1', external_product_no: 'P0002', external_variant_code: '' },
    { master_item_id: 'm1', external_product_no: 'P0002', external_variant_code: 'V1' },
    { master_item_id: 'm2', external_product_no: 'B0003', external_variant_code: '' },
    { master_item_id: 'm2', external_product_no: 'A0003', external_variant_code: '' },
  ]);

  assert.equal(result.get('m1'), 'P0002');
  assert.equal(result.get('m2'), 'A0003');
  assert.equal(result.has('m3'), false);
});
