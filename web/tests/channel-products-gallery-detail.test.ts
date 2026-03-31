import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGalleryDetailSummary } from '../src/lib/shop/channel-products-gallery-detail.ts';

test('buildGalleryDetailSummary combines published option and variant information', () => {
  const detail = buildGalleryDetailSummary({
    basePriceKrw: 10000,
    baseBreakdown: null,
    masterMaterialCode: '14',
    explicitMappingCount: 5,
    optionEntries: [
      { option_axis_index: 1, option_name: '색상', option_value: '화이트', published_delta_krw: 0 },
      { option_axis_index: 1, option_name: '색상', option_value: '옐로', published_delta_krw: 4000 },
    ],
    editorRows: [],
    variants: [
      { variantCode: 'V1', finalPriceKrw: 10000, optionLabel: '화이트' },
      { variantCode: 'V2', finalPriceKrw: 14000, optionLabel: '옐로' },
    ],
    unresolvedReasons: ['missing SIZE'],
  });

  assert.equal(detail.base_price_krw, 10000);
  assert.equal(detail.master_material_code, '14');
  assert.equal(detail.mapping_count, 5);
  assert.equal(detail.option_rows.length, 2);
  assert.equal(detail.base_breakdown, null);
  assert.equal(detail.editor_rows.length, 0);
  assert.equal(detail.editor_groups.length, 0);
  assert.equal(detail.variant_rows.length, 2);
  assert.equal(detail.unresolved, true);
});
