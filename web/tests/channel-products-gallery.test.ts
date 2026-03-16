import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGalleryCards } from '../src/lib/shop/channel-products-gallery.ts';

test('buildGalleryCards groups mapping identities into product cards with publish summary', () => {
  const cards = buildGalleryCards({
    mappings: [
      { channel_product_id: 'cp-base', master_item_id: 'm1', external_product_no: '33', external_variant_code: '', mapping_source: 'MANUAL', is_active: true, updated_at: '2026-03-14T00:00:00Z' },
      { channel_product_id: 'cp-v1', master_item_id: 'm1', external_product_no: '33', external_variant_code: 'V1', mapping_source: 'MANUAL', is_active: true, updated_at: '2026-03-14T00:00:00Z' },
    ],
    masterMetaById: {
      m1: { model_name: 'MS-553유색-R', image_url: 'https://example.com/a.jpg' },
    },
    publishedByChannelProductId: {
      'cp-base': { publishedBasePriceKrw: 10000, publishedAdditionalAmountKrw: 0, publishedTotalPriceKrw: 10000 },
      'cp-v1': { publishedBasePriceKrw: 10000, publishedAdditionalAmountKrw: 3000, publishedTotalPriceKrw: 13000 },
    },
    mappingCountByProductNo: {
      '33': 2,
    },
    unresolvedProductNos: new Set<string>(['44']),
  });

  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.external_product_no, '33');
  assert.equal(cards[0]?.model_name, 'MS-553유색-R');
  assert.equal(cards[0]?.thumbnail_url, 'https://example.com/a.jpg');
  assert.equal(cards[0]?.published_base_price_krw, 10000);
  assert.equal(cards[0]?.published_min_price_krw, 10000);
  assert.equal(cards[0]?.published_max_price_krw, 13000);
  assert.equal(cards[0]?.variant_count, 1);
  assert.equal(cards[0]?.mapping_count, 2);
  assert.equal(cards[0]?.has_unresolved, false);
});
