import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE,
  resolveCurrentProductSyncProfile,
  buildCurrentProductSyncProfileByMaster,
  resolveCurrentProductSyncProfileForWrite,
  buildCurrentProductSyncProfileIndex,
  resolveEffectiveCurrentProductSyncProfile,
} from '../src/lib/shop/current-product-sync-profile.js';

test('resolveCurrentProductSyncProfile falls back to GENERAL for missing or inconsistent values', () => {
  assert.equal(DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE, 'GENERAL');
  assert.equal(resolveCurrentProductSyncProfile([]), 'GENERAL');
  assert.equal(
    resolveCurrentProductSyncProfile([
      { current_product_sync_profile: 'market_linked' },
      { current_product_sync_profile: 'MARKET_LINKED' },
    ]),
    'MARKET_LINKED',
  );
  assert.equal(
    resolveCurrentProductSyncProfile([
      { current_product_sync_profile: 'GENERAL' },
      { current_product_sync_profile: 'MARKET_LINKED' },
    ]),
    'GENERAL',
  );
});

test('buildCurrentProductSyncProfileByMaster aggregates active mapping rows by master with GENERAL fallback', () => {
  const profileByMaster = buildCurrentProductSyncProfileByMaster([
    { master_item_id: 'm1', current_product_sync_profile: 'MARKET_LINKED' },
    { master_item_id: 'm1', current_product_sync_profile: 'market_linked' },
    { master_item_id: 'm2', current_product_sync_profile: 'GENERAL' },
    { master_item_id: 'm2', current_product_sync_profile: 'MARKET_LINKED' },
    { master_item_id: '', current_product_sync_profile: 'MARKET_LINKED' },
  ]);

  assert.equal(profileByMaster.get('m1'), 'MARKET_LINKED');
  assert.equal(profileByMaster.get('m2'), 'GENERAL');
  assert.equal(profileByMaster.has(''), false);
});

test('resolveEffectiveCurrentProductSyncProfile lets current-product profile override channel profile', () => {
  assert.equal(
    resolveEffectiveCurrentProductSyncProfile({
      channelProfile: 'MARKET_LINKED',
      currentProductProfile: null,
    }),
    'MARKET_LINKED',
  );
  assert.equal(
    resolveEffectiveCurrentProductSyncProfile({
      channelProfile: 'GENERAL',
      currentProductProfile: 'MARKET_LINKED',
    }),
    'MARKET_LINKED',
  );
  assert.equal(
    resolveEffectiveCurrentProductSyncProfile({
      channelProfile: 'MARKET_LINKED',
      currentProductProfile: 'invalid',
    }),
    'MARKET_LINKED',
  );
});

test('resolveCurrentProductSyncProfileForWrite preserves saved profile when payload omits it', () => {
  assert.equal(
    resolveCurrentProductSyncProfileForWrite({
      hasIncomingProfile: false,
      existingRows: [{ current_product_sync_profile: 'MARKET_LINKED' }],
    }),
    'MARKET_LINKED',
  );

  assert.equal(
    resolveCurrentProductSyncProfileForWrite({
      hasIncomingProfile: true,
      incomingProfile: 'GENERAL',
      existingRows: [{ current_product_sync_profile: 'MARKET_LINKED' }],
    }),
    'GENERAL',
  );

  assert.equal(
    resolveCurrentProductSyncProfileForWrite({
      hasIncomingProfile: false,
      existingRows: [
        { current_product_sync_profile: 'invalid' },
        { current_product_sync_profile: 'MARKET_LINKED' },
        { current_product_sync_profile: 'GENERAL' },
      ],
    }),
    'MARKET_LINKED',
  );
});

test('buildCurrentProductSyncProfileIndex resolves profiles per composite scope key', () => {
  const profileByScope = buildCurrentProductSyncProfileIndex(
    [
      { channel_id: 'c1', master_item_id: 'm1', current_product_sync_profile: 'MARKET_LINKED' },
      { channel_id: 'c1', master_item_id: 'm1', current_product_sync_profile: 'market_linked' },
      { channel_id: 'c2', master_item_id: 'm1', current_product_sync_profile: 'GENERAL' },
      { channel_id: 'c2', master_item_id: 'm1', current_product_sync_profile: 'MARKET_LINKED' },
    ],
    (row) => `${row.channel_id}::${row.master_item_id}`,
  );

  assert.equal(profileByScope.get('c1::m1'), 'MARKET_LINKED');
  assert.equal(profileByScope.get('c2::m1'), 'GENERAL');
});
