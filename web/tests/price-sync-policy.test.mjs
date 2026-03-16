import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PRICE_SYNC_THRESHOLD_PROFILE,
  DEFAULT_PRICE_SYNC_POLICY,
  PRICE_SYNC_THRESHOLD_PROFILE,
  PRICE_SYNC_THRESHOLD_PROFILE_PRESETS,
  normalizePriceSyncPolicy,
  normalizePriceSyncThresholdProfile,
  resolveEffectiveMinChangeKrw,
  resolvePriceSyncThresholdProfilePolicy,
  resolveRateDerivedThresholdKrw,
  shouldSyncPriceChange,
  DEFAULT_OPTION_ADDITIONAL_SYNC_POLICY,
  normalizeOptionAdditionalSyncPolicy,
  shouldSyncOptionAdditionalChange,
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

test('threshold profile presets expose the expected general and market-linked defaults', () => {
  assert.equal(DEFAULT_PRICE_SYNC_THRESHOLD_PROFILE, PRICE_SYNC_THRESHOLD_PROFILE.GENERAL);
  assert.deepEqual(
    PRICE_SYNC_THRESHOLD_PROFILE_PRESETS[PRICE_SYNC_THRESHOLD_PROFILE.GENERAL],
    DEFAULT_PRICE_SYNC_POLICY,
  );
  assert.deepEqual(
    resolvePriceSyncThresholdProfilePolicy(PRICE_SYNC_THRESHOLD_PROFILE.MARKET_LINKED),
    {
      always_sync: false,
      min_change_krw: 500,
      min_change_rate: 0.005,
    },
  );
});

test('normalizePriceSyncThresholdProfile falls back to the configured default profile', () => {
  assert.equal(
    normalizePriceSyncThresholdProfile('market_linked'),
    PRICE_SYNC_THRESHOLD_PROFILE.MARKET_LINKED,
  );
  assert.equal(
    normalizePriceSyncThresholdProfile('not-a-profile'),
    DEFAULT_PRICE_SYNC_THRESHOLD_PROFILE,
  );
  assert.equal(
    normalizePriceSyncThresholdProfile('still-not-valid', PRICE_SYNC_THRESHOLD_PROFILE.MARKET_LINKED),
    PRICE_SYNC_THRESHOLD_PROFILE.MARKET_LINKED,
  );
});

test('selected threshold profile presets act as defaults while explicit overrides still win', () => {
  const selectedProfilePolicy = resolvePriceSyncThresholdProfilePolicy(PRICE_SYNC_THRESHOLD_PROFILE.MARKET_LINKED);

  assert.deepEqual(
    normalizePriceSyncPolicy(undefined, selectedProfilePolicy),
    selectedProfilePolicy,
  );
  assert.deepEqual(
    normalizePriceSyncPolicy(
      {
        min_change_krw: 750,
        always_sync: true,
      },
      selectedProfilePolicy,
    ),
    {
      always_sync: true,
      min_change_krw: 750,
      min_change_rate: 0.005,
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


test('option additional sync policy uses dedicated defaults', () => {
  assert.deepEqual(normalizeOptionAdditionalSyncPolicy(), DEFAULT_OPTION_ADDITIONAL_SYNC_POLICY);
  assert.deepEqual(DEFAULT_OPTION_ADDITIONAL_SYNC_POLICY, {
    always_sync: false,
    min_change_krw: 2000,
    min_change_rate: 0.02,
  });
  assert.deepEqual(normalizeOptionAdditionalSyncPolicy({ min_change_krw: 1500.2, min_change_rate: '0.02' }), {
    always_sync: false,
    min_change_krw: 1500,
    min_change_rate: 0.02,
  });
});

test('option additional sync uses MAX semantics and ignores rate threshold when current amount is zero', () => {
  assert.deepEqual(
    shouldSyncOptionAdditionalChange({
      currentAdditionalKrw: 100000,
      nextAdditionalKrw: 100700,
      policy: { min_change_krw: 1000, min_change_rate: 0.005 },
    }),
    {
      should_sync: false,
      threshold_bypassed: false,
      additional_delta_krw: 700,
      flat_min_change_krw: 1000,
      rate_min_change_krw: 500,
      effective_min_change_krw: 1000,
      effective_mode: 'MAX',
      policy: {
        always_sync: false,
        min_change_krw: 1000,
        min_change_rate: 0.005,
      },
    },
  );

  assert.deepEqual(
    shouldSyncOptionAdditionalChange({
      currentAdditionalKrw: 0,
      nextAdditionalKrw: 900,
      policy: { min_change_krw: 1000, min_change_rate: 0.01 },
    }),
    {
      should_sync: false,
      threshold_bypassed: false,
      additional_delta_krw: 900,
      flat_min_change_krw: 1000,
      rate_min_change_krw: null,
      effective_min_change_krw: 1000,
      effective_mode: 'FLAT_ONLY',
      policy: {
        always_sync: false,
        min_change_krw: 1000,
        min_change_rate: 0.01,
      },
    },
  );
});
