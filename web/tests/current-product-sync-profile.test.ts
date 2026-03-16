import test from 'node:test';
import assert from 'node:assert/strict';

import {
  describeCurrentProductSyncProfile,
  formatCurrentProductSyncProfileLabel,
  resolveCurrentProductSyncProfile,
} from '../src/lib/shop/current-product-sync-profile.ts';

test('formatCurrentProductSyncProfileLabel returns the expected Korean labels', () => {
  assert.equal(formatCurrentProductSyncProfileLabel('GENERAL'), '일반형');
  assert.equal(formatCurrentProductSyncProfileLabel('MARKET_LINKED'), '시장연동형');
});

test('describeCurrentProductSyncProfile explains market-linked behavior', () => {
  assert.match(describeCurrentProductSyncProfile('GENERAL'), /기본/);
  assert.match(describeCurrentProductSyncProfile('MARKET_LINKED'), /시세/);
});

test('resolveCurrentProductSyncProfile falls back to GENERAL when rows are mixed', () => {
  assert.equal(resolveCurrentProductSyncProfile([
    { current_product_sync_profile: 'GENERAL' },
    { current_product_sync_profile: 'MARKET_LINKED' },
  ]), 'GENERAL');
});
