import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PRICE_SYNC_POLICY,
  normalizePriceSyncPolicy,
  resolveEffectiveMinChangeKrw,
  resolveRateDerivedThresholdKrw,
  shouldSyncPriceChange,
} from '../src/lib/shop/price-sync-policy.js';

test('normalizePriceSyncPolicy applies stable defaults', () => {
  assert.deepEqual(normalizePriceSyncPolicy(), DEFAULT_PRICE_SYNC_POLICY);
  assert.deepEqual(normalizePriceSyncPolicy({}), DEFAULT_PRICE_SYNC_POLICY);
  assert.deepEqual(
    normalizePriceSyncPolicy({ always_sync: 'true', min_change_krw: 4200.4, min_change_rate: '0.025' }),
    {
      always_sync: true,
      min_change_krw: 4200,
      min_change_rate: 0.025,
    },
  );
});

test('resolveEffectiveMinChangeKrw uses the larger flat or rate-derived threshold', () => {
  assert.equal(
    resolveRateDerivedThresholdKrw({
      currentPriceKrw: 49123.8,
      policy: { min_change_rate: 0.1 },
    }),
    4912,
  );

  assert.equal(
    resolveEffectiveMinChangeKrw({
      currentPriceKrw: 49123.8,
      policy: { min_change_krw: 5000, min_change_rate: 0.1 },
    }),
    5000,
  );

  assert.equal(
    resolveEffectiveMinChangeKrw({
      currentPriceKrw: 50999.6,
      policy: { min_change_krw: 5000, min_change_rate: 0.1 },
    }),
    5100,
  );
});

test('shouldSyncPriceChange bypasses threshold when always_sync is enabled', () => {
  assert.deepEqual(
    shouldSyncPriceChange({
      currentPriceKrw: 50000,
      nextPriceKrw: 50001,
      policy: { always_sync: true, min_change_krw: 5000, min_change_rate: 0.2 },
    }),
    {
      should_sync: true,
      threshold_bypassed: true,
      price_delta_krw: 1,
      effective_min_change_krw: 10000,
      policy: {
        always_sync: true,
        min_change_krw: 5000,
        min_change_rate: 0.2,
      },
    },
  );

  assert.deepEqual(
    shouldSyncPriceChange({
      currentPriceKrw: 50000,
      nextPriceKrw: 50000,
      policy: { always_sync: true },
    }),
    {
      should_sync: true,
      threshold_bypassed: true,
      price_delta_krw: 0,
      effective_min_change_krw: 5000,
      policy: {
        always_sync: true,
        min_change_krw: 5000,
        min_change_rate: 0.02,
      },
    },
  );
});

test('invalid values fall back to normalized defaults', () => {
  assert.deepEqual(
    normalizePriceSyncPolicy(
      {
        always_sync: 'maybe',
        min_change_krw: Number.NaN,
        min_change_rate: -0.25,
      },
      {
        always_sync: true,
        min_change_krw: 7000,
        min_change_rate: 0.03,
      },
    ),
    {
      always_sync: true,
      min_change_krw: 7000,
      min_change_rate: 0.03,
    },
  );

  assert.deepEqual(
    shouldSyncPriceChange({
      currentPriceKrw: 'bad',
      nextPriceKrw: 6999,
      policy: {
        always_sync: 'bad',
        min_change_krw: 'bad',
        min_change_rate: 'bad',
      },
      defaults: {
        always_sync: false,
        min_change_krw: 7000,
        min_change_rate: 0.03,
      },
    }),
    {
      should_sync: false,
      threshold_bypassed: false,
      price_delta_krw: 6999,
      effective_min_change_krw: 7000,
      policy: {
        always_sync: false,
        min_change_krw: 7000,
        min_change_rate: 0.03,
      },
    },
  );
});
