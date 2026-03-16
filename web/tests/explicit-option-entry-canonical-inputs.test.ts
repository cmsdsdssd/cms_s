import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCanonicalInputsFromExplicitOptionEntries } from '../src/lib/shop/explicit-option-entry-canonical-inputs.ts';

test('buildCanonicalInputsFromExplicitOptionEntries maps SIZE, COLOR, DECOR, OTHER, and NOTICE rows into canonical inputs', () => {
  const result = buildCanonicalInputsFromExplicitOptionEntries({
    rows: [
      {
        option_name: '사이즈',
        option_value: '0.01g',
        category_key: 'SIZE',
        weight_g: 0.01,
      },
      {
        option_name: '색상',
        option_value: '[도] P',
        category_key: 'COLOR_PLATING',
        combo_code: 'P',
        color_bucket_id: 'bucket-5000',
      },
      {
        option_name: '장식',
        option_value: '곰',
        category_key: 'DECOR',
        decor_master_id: 'decor-1',
      },
      {
        option_name: '부가옵션',
        option_value: '곰돌이 선물상자',
        category_key: 'ADDON',
        addon_master_id: 'addon-1',
      },
      {
        option_name: '기타',
        option_value: '특수요청',
        category_key: 'OTHER',
        other_reason_code: 'GIFT_SPECIAL',
        explicit_delta_krw: 3000,
      },
      {
        option_name: '안내',
        option_value: '주문제작 상품',
        category_key: 'NOTICE',
        notice_code: 'MADE_TO_ORDER',
      },
    ],
    colorBucketDeltaById: { 'bucket-5000': 9000 },
    addonAmountById: { 'addon-1': 4000 },
  });

  const sizeKey = '사이즈::0.01g';
  const colorKey = '색상::[도] P';
  const decorKey = '장식::곰';
  const addonKey = '부가옵션::곰돌이 선물상자';
  const otherKey = '기타::특수요청';
  const noticeKey = '안내::주문제작 상품';

  assert.equal(result.categoryOverrideByEntryKey[sizeKey], 'SIZE');
  assert.equal(result.axisSelectionByEntryKey[sizeKey]?.axis2_value, '0.01');

  assert.equal(result.categoryOverrideByEntryKey[colorKey], 'COLOR_PLATING');
  assert.equal(result.axisSelectionByEntryKey[colorKey]?.axis2_value, 'P');
  assert.equal(result.axisSelectionByEntryKey[colorKey]?.axis3_value, '9000');

  assert.equal(result.categoryOverrideByEntryKey[decorKey], 'DECOR');
  assert.equal(result.axisSelectionByEntryKey[decorKey]?.decor_master_item_id, 'decor-1');

  assert.equal(result.categoryOverrideByEntryKey[addonKey], 'ADDON');
  assert.equal(result.axisSelectionByEntryKey[addonKey]?.axis1_value, 'addon-1');
  assert.equal(result.axisSelectionByEntryKey[addonKey]?.axis3_value, '4000');

  assert.equal(result.categoryOverrideByEntryKey[otherKey], 'OTHER');
  assert.equal(result.otherReasonByEntryKey[otherKey], 'GIFT_SPECIAL');
  assert.equal(result.savedOptionCategories.find((row) => row.option_name === '기타')?.sync_delta_krw, 3000);

  assert.equal(result.categoryOverrideByEntryKey[noticeKey], 'NOTICE');
  assert.equal(result.axisSelectionByEntryKey[noticeKey]?.axis1_value, 'MADE_TO_ORDER');
});
