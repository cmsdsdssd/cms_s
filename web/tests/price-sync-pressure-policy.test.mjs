import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAutoSyncPressureSuccessPatch,
  evaluateAutoSyncPressurePolicy,
} from '../src/lib/shop/price-sync-pressure-policy.js';

const FIXED_CONFIG = {
  mode: 'FULL',
  immediateDownUnits: 2,
  releaseUnits: 1.25,
  cooldownMinutes: 60,
  cooldownOverrideUnits: 1.5,
  stalenessHours: 12,
  pressureDecayFactor: 0.4,
  pressureClampAbs: 3,
  stalenessReleaseUnits: 0.75,
};

const BASE_EVALUATION = {
  currentPriceKrw: 100000,
  minChangeKrw: 5000,
  minChangeRate: 0.02,
  now: '2026-03-07T12:00:00.000Z',
  config: FIXED_CONFIG,
};

const evaluate = (overrides = {}) => evaluateAutoSyncPressurePolicy({
  ...BASE_EVALUATION,
  desiredPriceKrw: 100000,
  state: {},
  ...overrides,
});

test('evaluateAutoSyncPressurePolicy triggers immediate upsync and decays downward pressure', () => {
  const result = evaluate({
    desiredPriceKrw: 105000,
    state: { pressure_units: -2.5 },
  });

  assert.equal(result.thresholdUnitKrw, 5000);
  assert.equal(result.gapUnits, 1);
  assert.equal(result.releaseType, 'UPSYNC');
  assert.equal(result.shouldCreateIntent, true);
  assert.equal(result.shouldCreateUpsyncIntent, true);
  assert.equal(result.shouldCreateDownsyncIntent, false);
  assert.equal(result.pressureDecayApplied, true);
  assert.equal(result.nextState.pressureUnits, -1);
});

test('evaluateAutoSyncPressurePolicy releases immediately on a large downward move', () => {
  const result = evaluate({ desiredPriceKrw: 89000 });

  assert.equal(result.gapUnits, -2.2);
  assert.equal(result.releaseType, 'LARGE_DOWNSYNC');
  assert.equal(result.shouldCreateIntent, true);
  assert.equal(result.shouldCreateDownsyncIntent, true);
  assert.equal(result.largeDownsyncTriggered, true);
  assert.equal(result.nextState.pressureUnits, -1);
});

test('evaluateAutoSyncPressurePolicy accumulates intermittent downward pressure until release', () => {
  const first = evaluate({
    desiredPriceKrw: 96000,
    state: { last_downsync_at: '2026-03-07T11:30:00.000Z' },
  });
  const second = evaluate({
    desiredPriceKrw: 102500,
    state: {
      pressure_units: first.nextState.pressureUnits,
      last_gap_units: first.nextState.lastGapUnits,
      last_seen_target_krw: first.nextState.lastSeenTargetKrw,
      last_seen_current_krw: first.nextState.lastSeenCurrentKrw,
      last_downsync_at: '2026-03-07T11:30:00.000Z',
    },
  });
  const third = evaluate({
    desiredPriceKrw: 95000,
    state: {
      pressure_units: second.nextState.pressureUnits,
      last_gap_units: second.nextState.lastGapUnits,
      last_seen_target_krw: second.nextState.lastSeenTargetKrw,
      last_seen_current_krw: second.nextState.lastSeenCurrentKrw,
      last_downsync_at: '2026-03-07T11:30:00.000Z',
    },
  });
  const fourth = evaluate({
    desiredPriceKrw: 95000,
    state: {
      pressure_units: third.nextState.pressureUnits,
      last_gap_units: third.nextState.lastGapUnits,
      last_seen_target_krw: third.nextState.lastSeenTargetKrw,
      last_seen_current_krw: third.nextState.lastSeenCurrentKrw,
      last_downsync_at: '2026-03-07T11:30:00.000Z',
    },
  });

  assert.equal(first.releaseType, 'NONE');
  assert.equal(first.nextState.pressureUnits, -0.8);
  assert.equal(second.releaseType, 'NONE');
  assert.ok(Math.abs(second.nextState.pressureUnits - (-0.32)) < 1e-9);
  assert.equal(third.releaseType, 'NONE');
  assert.ok(Math.abs(third.nextState.pressureUnits - (-1.128)) < 1e-9);
  assert.equal(fourth.releaseType, 'PRESSURE_DOWNSYNC');
  assert.equal(fourth.shouldCreateDownsyncIntent, true);
  assert.equal(fourth.pressureReleaseTriggered, true);
  assert.ok(Math.abs(fourth.nextState.pressureUnits - (-1.4512)) < 1e-9);
});

test('evaluateAutoSyncPressurePolicy blocks downward release during cooldown', () => {
  const result = evaluate({
    desiredPriceKrw: 95000,
    state: {
      pressure_units: -1,
      cooldown_until: '2026-03-07T12:30:00.000Z',
      last_downsync_at: '2026-03-07T11:00:00.000Z',
    },
  });

  assert.equal(result.releaseType, 'COOLDOWN_BLOCKED');
  assert.equal(result.shouldCreateIntent, false);
  assert.equal(result.cooldownBlocked, true);
  assert.equal(result.pressureReleaseTriggered, false);
  assert.equal(result.nextState.pressureUnits, -1.4);
});

test('evaluateAutoSyncPressurePolicy allows cooldown override release', () => {
  const result = evaluate({
    desiredPriceKrw: 92000,
    state: {
      pressure_units: -0.5,
      cooldown_until: '2026-03-07T12:30:00.000Z',
      last_downsync_at: '2026-03-07T11:00:00.000Z',
    },
  });

  assert.equal(result.gapUnits, -1.6);
  assert.equal(result.releaseType, 'PRESSURE_DOWNSYNC');
  assert.equal(result.shouldCreateIntent, true);
  assert.equal(result.shouldCreateDownsyncIntent, true);
  assert.equal(result.pressureReleaseTriggered, true);
  assert.equal(result.cooldownBlocked, false);
});

test('evaluateAutoSyncPressurePolicy releases stale downward gaps even before pressure threshold', () => {
  const result = evaluate({
    desiredPriceKrw: 96000,
    state: {
      pressure_units: 0,
      last_downsync_at: '2026-03-06T23:59:59.000Z',
    },
  });

  assert.equal(result.gapUnits, -0.8);
  assert.equal(result.releaseType, 'STALE_DOWNSYNC');
  assert.equal(result.shouldCreateIntent, true);
  assert.equal(result.shouldCreateDownsyncIntent, true);
  assert.equal(result.stalenessReleaseTriggered, true);
  assert.equal(result.pressureReleaseTriggered, false);
  assert.equal(result.nextState.pressureUnits, -0.8);
});

test('evaluateAutoSyncPressurePolicy does not treat first downward gap as stale without history', () => {
  const result = evaluate({ desiredPriceKrw: 96000 });

  assert.equal(result.gapUnits, -0.8);
  assert.equal(result.releaseType, 'NONE');
  assert.equal(result.shouldCreateIntent, false);
  assert.equal(result.stalenessReleaseTriggered, false);
  assert.equal(result.nextState.pressureUnits, -0.8);
});

test('evaluateAutoSyncPressurePolicy respects OFF mode for downward gaps', () => {
  const result = evaluate({
    desiredPriceKrw: 89000,
    config: { ...FIXED_CONFIG, mode: 'OFF' },
    state: { pressure_units: -1.2, last_downsync_at: '2026-03-07T10:00:00.000Z' },
  });

  assert.equal(result.releaseType, 'NONE');
  assert.equal(result.shouldCreateIntent, false);
  assert.equal(result.shouldCreateDownsyncIntent, false);
  assert.equal(result.largeDownsyncTriggered, false);
  assert.equal(result.pressureReleaseTriggered, false);
});

test('evaluateAutoSyncPressurePolicy respects IMMEDIATE_ONLY mode', () => {
  const belowImmediate = evaluate({
    desiredPriceKrw: 95000,
    config: { ...FIXED_CONFIG, mode: 'IMMEDIATE_ONLY' },
    state: { pressure_units: -2, last_downsync_at: '2026-03-07T00:00:00.000Z' },
  });
  const immediate = evaluate({
    desiredPriceKrw: 89000,
    config: { ...FIXED_CONFIG, mode: 'IMMEDIATE_ONLY' },
    state: { pressure_units: -0.2, last_downsync_at: '2026-03-07T11:00:00.000Z' },
  });

  assert.equal(belowImmediate.releaseType, 'NONE');
  assert.equal(belowImmediate.shouldCreateIntent, false);
  assert.equal(immediate.releaseType, 'LARGE_DOWNSYNC');
  assert.equal(immediate.shouldCreateDownsyncIntent, true);
});

test('buildAutoSyncPressureSuccessPatch resets pressure and sets cooldown after a downsync', () => {
  const result = buildAutoSyncPressureSuccessPatch({
    previousState: {
      pressure_units: -1.7,
      last_gap_units: -0.8,
      last_seen_target_krw: 96000,
      last_seen_current_krw: 100000,
      last_auto_sync_at: '2026-03-07T10:00:00.000Z',
      last_upsync_at: '2026-03-07T09:00:00.000Z',
      last_downsync_at: '2026-03-07T08:00:00.000Z',
      cooldown_until: null,
    },
    beforePriceKrw: 100000,
    targetPriceKrw: 96000,
    now: '2026-03-07T12:00:00.000Z',
    config: FIXED_CONFIG,
  });

  assert.deepEqual(result, {
    pressureUnits: 0,
    lastGapUnits: 0,
    lastSeenTargetKrw: 96000,
    lastSeenCurrentKrw: 96000,
    lastAutoSyncAt: '2026-03-07T12:00:00.000Z',
    lastUpsyncAt: '2026-03-07T09:00:00.000Z',
    lastDownsyncAt: '2026-03-07T12:00:00.000Z',
    cooldownUntil: '2026-03-07T13:00:00.000Z',
  });
});
