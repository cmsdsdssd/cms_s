import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFinalizedScheduleRows,
  buildScopedSyncPlan,
  resolveMasterScheduleDecision,
} from '../src/lib/shop/sync-scheduler.js';
import { resolveSyncCadenceMinutes } from '../src/lib/shop/sync-cadence-policy.js';

test('resolveSyncCadenceMinutes returns expected defaults', () => {
  assert.equal(resolveSyncCadenceMinutes('GENERAL'), 120);
  assert.equal(resolveSyncCadenceMinutes('MARKET_LINKED'), 5);
  assert.equal(resolveSyncCadenceMinutes('unknown'), 120);
});

test('missing schedule rows are immediately due', () => {
  const decision = resolveMasterScheduleDecision({
    existingRow: null,
    effectiveProfile: 'GENERAL',
    cadenceMinutes: 120,
    now: '2026-03-13T00:00:00.000Z',
  });
  assert.equal(decision.isDue, true);
});

test('GENERAL schedule due after next_due_at passes', () => {
  const decision = resolveMasterScheduleDecision({
    existingRow: {
      effective_sync_profile: 'GENERAL',
      cadence_minutes: 120,
      next_due_at: '2026-03-13T01:59:00.000Z',
      last_evaluated_at: '2026-03-13T00:00:00.000Z',
    },
    effectiveProfile: 'GENERAL',
    cadenceMinutes: 120,
    now: '2026-03-13T02:00:00.000Z',
  });
  assert.equal(decision.isDue, true);
});

test('profile change from MARKET_LINKED to GENERAL defers due using last evaluated at', () => {
  const decision = resolveMasterScheduleDecision({
    existingRow: {
      effective_sync_profile: 'MARKET_LINKED',
      cadence_minutes: 5,
      next_due_at: '2026-03-13T00:10:00.000Z',
      last_evaluated_at: '2026-03-13T00:00:00.000Z',
    },
    effectiveProfile: 'GENERAL',
    cadenceMinutes: 120,
    now: '2026-03-13T01:00:00.000Z',
  });
  assert.equal(decision.isDue, false);
  assert.equal(decision.shouldPersistSeed, true);
  assert.equal(decision.nextDueAt, '2026-03-13T02:00:00.000Z');
});

test('buildScopedSyncPlan returns only due master scope', () => {
  const plan = buildScopedSyncPlan({
    channelId: 'channel-1',
    now: '2026-03-13T02:00:00.000Z',
    forceFullSync: false,
    activeMapRows: [
      { channel_product_id: 'cp-1', master_item_id: 'm-1', current_product_sync_profile: 'GENERAL' },
      { channel_product_id: 'cp-2', master_item_id: 'm-2', current_product_sync_profile: 'MARKET_LINKED' },
    ],
    existingScheduleRows: [
      {
        master_item_id: 'm-1',
        effective_sync_profile: 'GENERAL',
        cadence_minutes: 120,
        next_due_at: '2026-03-13T01:00:00.000Z',
        last_evaluated_at: '2026-03-12T23:00:00.000Z',
      },
      {
        master_item_id: 'm-2',
        effective_sync_profile: 'MARKET_LINKED',
        cadence_minutes: 5,
        next_due_at: '2026-03-13T02:03:00.000Z',
        last_evaluated_at: '2026-03-13T01:58:00.000Z',
      },
    ],
  });

  assert.deepEqual(plan.dueMasterIds, ['m-1']);
  assert.deepEqual(plan.dueChannelProductIds, ['cp-1']);
});

test('buildFinalizedScheduleRows advances next_due_at by profile cadence', () => {
  const rows = buildFinalizedScheduleRows({
    channelId: 'channel-1',
    masterItemIds: ['m-1', 'm-2'],
    profileByMaster: new Map([
      ['m-1', 'GENERAL'],
      ['m-2', 'MARKET_LINKED'],
    ]),
    now: '2026-03-13T00:00:00.000Z',
    runId: 'run-1',
    computeRequestId: 'compute-1',
    reason: 'DUE',
  });

  assert.equal(rows[0].next_due_at, '2026-03-13T02:00:00.000Z');
  assert.equal(rows[1].next_due_at, '2026-03-13T00:05:00.000Z');
});
