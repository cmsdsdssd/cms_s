import test from 'node:test';
import assert from 'node:assert/strict';

import { canonicalizeBulkRowsByActiveProductNos } from '../src/app/api/channel-products/bulk/route';

test('canonicalizeBulkRowsByActiveProductNos rewrites alias product numbers to the active canonical product number', () => {
  const rows = [
    {
      channel_id: 'channel-1',
      master_item_id: 'master-1',
      external_product_no: 'A0002',
      external_variant_code: 'V1',
    },
    {
      channel_id: 'channel-1',
      master_item_id: 'master-1',
      external_product_no: 'A0002',
      external_variant_code: 'V2',
    },
    {
      channel_id: 'channel-2',
      master_item_id: 'master-2',
      external_product_no: 'B0009',
      external_variant_code: 'V1',
    },
  ];

  const result = canonicalizeBulkRowsByActiveProductNos(rows, new Map([
    ['channel-1::master-1', ['P0002']],
  ]));

  assert.equal(result[0]?.external_product_no, 'P0002');
  assert.equal(result[1]?.external_product_no, 'P0002');
  assert.equal(result[2]?.external_product_no, 'B0009');
});

test('canonicalizeBulkRowsByActiveProductNos keeps incoming product number when there is no active canonical mapping yet', () => {
  const rows = [
    {
      channel_id: 'channel-1',
      master_item_id: 'master-1',
      external_product_no: 'A0002',
      external_variant_code: 'V1',
    },
  ];

  const result = canonicalizeBulkRowsByActiveProductNos(rows, new Map());

  assert.equal(result[0]?.external_product_no, 'A0002');
});
