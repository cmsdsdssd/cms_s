import { buildCurrentProductSyncProfileByMaster } from './current-product-sync-profile.js';
import { addCadenceMinutes, resolveSyncCadenceMinutes } from './sync-cadence-policy.js';

const toMs = (value) => {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

const uniqueSorted = (values) => Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));

export const resolveMasterScheduleDecision = ({
  existingRow,
  effectiveProfile,
  cadenceMinutes,
  now,
  forceDue = false,
}) => {
  const nowIso = typeof now === 'string' && now.trim().length > 0 ? now : new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  const existingNextMs = toMs(existingRow?.next_due_at);
  const lastEvaluatedAt = typeof existingRow?.last_evaluated_at === 'string' ? existingRow.last_evaluated_at : null;
  const lastEvaluatedMs = toMs(lastEvaluatedAt);
  const profileChanged = String(existingRow?.effective_sync_profile ?? '').trim() !== effectiveProfile;
  const cadenceChanged = Number(existingRow?.cadence_minutes ?? Number.NaN) !== cadenceMinutes;

  if (!existingRow) {
    return {
      isDue: true,
      nextDueAt: nowIso,
      shouldPersistSeed: false,
    };
  }

  let nextDueMs = existingNextMs;
  let shouldPersistSeed = false;

  if (profileChanged || cadenceChanged || nextDueMs === null) {
    shouldPersistSeed = true;
    nextDueMs = lastEvaluatedMs === null
      ? nowMs
      : Date.parse(addCadenceMinutes(lastEvaluatedAt, cadenceMinutes));
  }

  if (forceDue) {
    return {
      isDue: true,
      nextDueAt: new Date(nextDueMs ?? nowMs).toISOString(),
      shouldPersistSeed,
    };
  }

  return {
    isDue: (nextDueMs ?? nowMs) <= nowMs,
    nextDueAt: new Date(nextDueMs ?? nowMs).toISOString(),
    shouldPersistSeed,
  };
};

export const buildScopedSyncPlan = ({
  channelId,
  activeMapRows,
  existingScheduleRows,
  now,
  forceFullSync = false,
}) => {
  const nowIso = typeof now === 'string' && now.trim().length > 0 ? now : new Date().toISOString();
  const rows = Array.isArray(activeMapRows) ? activeMapRows : [];
  const profileByMaster = buildCurrentProductSyncProfileByMaster(rows);
  const scheduleByMaster = new Map(
    (Array.isArray(existingScheduleRows) ? existingScheduleRows : [])
      .map((row) => [String(row?.master_item_id ?? '').trim(), row]),
  );

  const channelProductIdsByMaster = new Map();
  for (const row of rows) {
    const masterItemId = String(row?.master_item_id ?? '').trim();
    const channelProductId = String(row?.channel_product_id ?? '').trim();
    if (!masterItemId || !channelProductId) continue;
    const bucket = channelProductIdsByMaster.get(masterItemId) ?? [];
    bucket.push(channelProductId);
    channelProductIdsByMaster.set(masterItemId, bucket);
  }

  const seedRows = [];
  const dueMasterIds = [];

  for (const [masterItemId] of channelProductIdsByMaster.entries()) {
    const effectiveProfile = profileByMaster.get(masterItemId) ?? 'GENERAL';
    const cadenceMinutes = resolveSyncCadenceMinutes(effectiveProfile);
    const existingRow = scheduleByMaster.get(masterItemId) ?? null;
    const decision = resolveMasterScheduleDecision({
      existingRow,
      effectiveProfile,
      cadenceMinutes,
      now: nowIso,
      forceDue: forceFullSync,
    });

    if (decision.shouldPersistSeed) {
      seedRows.push({
        channel_id: channelId,
        master_item_id: masterItemId,
        effective_sync_profile: effectiveProfile,
        cadence_minutes: cadenceMinutes,
        next_due_at: decision.nextDueAt,
        last_evaluated_at: existingRow?.last_evaluated_at ?? null,
        last_evaluated_run_id: existingRow?.last_evaluated_run_id ?? null,
        last_evaluated_compute_request_id: existingRow?.last_evaluated_compute_request_id ?? null,
        last_evaluated_reason: existingRow?.last_evaluated_reason ?? null,
      });
    }

    if (decision.isDue) {
      dueMasterIds.push(masterItemId);
    }
  }

  const dueChannelProductIds = uniqueSorted(
    dueMasterIds.flatMap((masterItemId) => channelProductIdsByMaster.get(masterItemId) ?? []),
  );

  return {
    profileByMaster,
    dueMasterIds: uniqueSorted(dueMasterIds),
    dueChannelProductIds,
    seedRows,
  };
};

export const buildFinalizedScheduleRows = ({
  channelId,
  masterItemIds,
  profileByMaster,
  now,
  runId,
  computeRequestId,
  reason,
}) => {
  const nowIso = typeof now === 'string' && now.trim().length > 0 ? now : new Date().toISOString();
  return uniqueSorted(Array.isArray(masterItemIds) ? masterItemIds : []).map((masterItemId) => {
    const effectiveProfile = profileByMaster.get(masterItemId) ?? 'GENERAL';
    const cadenceMinutes = resolveSyncCadenceMinutes(effectiveProfile);
    return {
      channel_id: channelId,
      master_item_id: masterItemId,
      effective_sync_profile: effectiveProfile,
      cadence_minutes: cadenceMinutes,
      next_due_at: addCadenceMinutes(nowIso, cadenceMinutes),
      last_evaluated_at: nowIso,
      last_evaluated_run_id: runId || null,
      last_evaluated_compute_request_id: computeRequestId || null,
      last_evaluated_reason: reason || 'DUE',
    };
  });
};
