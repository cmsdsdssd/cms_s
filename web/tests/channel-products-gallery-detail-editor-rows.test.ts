import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGalleryDetailSummary } from '../src/lib/shop/channel-products-gallery-detail.ts';

test('buildGalleryDetailSummary exposes grouped editor rows by option entry instead of variant combinations', () => {
  const detail = buildGalleryDetailSummary({
    basePriceKrw: 10000,
    masterMaterialCode: '14',
    explicitMappingCount: 4,
    optionEntries: [
      { option_axis_index: 1, option_name: '소재', option_value: '14K', published_delta_krw: 0 },
      { option_axis_index: 1, option_name: '소재', option_value: '18K', published_delta_krw: 100 },
      { option_axis_index: 2, option_name: '사이즈', option_value: '1호', published_delta_krw: 0 },
      { option_axis_index: 2, option_name: '사이즈', option_value: '2호', published_delta_krw: 200 },
    ],
    editorRows: [
      { entry_key: '소재::14K', axis_index: 1, option_name: '소재', option_value: '14K', category_key: 'MATERIAL', published_delta_krw: 0, resolved_delta_krw: 0, status: 'READY', unresolved_reason: null },
      { entry_key: '소재::18K', axis_index: 1, option_name: '소재', option_value: '18K', category_key: 'MATERIAL', published_delta_krw: 100, resolved_delta_krw: 100, status: 'READY', unresolved_reason: null },
      { entry_key: '사이즈::1호', axis_index: 2, option_name: '사이즈', option_value: '1호', category_key: 'SIZE', published_delta_krw: 0, resolved_delta_krw: 0, status: 'READY', unresolved_reason: null },
      { entry_key: '사이즈::2호', axis_index: 2, option_name: '사이즈', option_value: '2호', category_key: 'SIZE', published_delta_krw: 200, resolved_delta_krw: 200, status: 'READY', unresolved_reason: null },
    ],
    variants: [
      { variantCode: 'V1', finalPriceKrw: 10000, optionLabel: '14K / 1호' },
      { variantCode: 'V2', finalPriceKrw: 10300, optionLabel: '18K / 2호' },
    ],
    unresolvedReasons: [],
  });

  assert.equal(detail.editor_rows.length, 4);
  assert.equal(detail.editor_rows[0]?.entry_key, '소재::14K');
  assert.equal(detail.editor_groups.length, 2);
  assert.equal(detail.editor_groups[0]?.rows.length, 2);
  assert.equal(detail.editor_groups[1]?.rows.length, 2);
});
