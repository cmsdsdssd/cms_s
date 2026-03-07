import { resolveEffectiveMinChangeKrw } from './price-sync-policy.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toFiniteNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toMs = (value) => {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

const toIso = (value) => {
  if (typeof value === "string" && value.trim().length > 0) return value;
  if (value instanceof Date) return value.toISOString();
  return new Date(value ?? Date.now()).toISOString();
};

const toPositiveInt = (value, fallback, max) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(n)));
};

export const AUTO_SYNC_DOWNSYNC_POLICY_MODES = Object.freeze({
  OFF: "OFF",
  IMMEDIATE_ONLY: "IMMEDIATE_ONLY",
  FULL: "FULL",
});

export const DEFAULT_AUTO_SYNC_PRESSURE_POLICY = Object.freeze({
  mode: AUTO_SYNC_DOWNSYNC_POLICY_MODES.FULL,
  immediateDownUnits: 2,
  releaseUnits: 1.25,
  cooldownMinutes: 60,
  cooldownOverrideUnits: 1.5,
  stalenessHours: 12,
  pressureDecayFactor: 0.4,
  pressureClampAbs: 3,
  stalenessReleaseUnits: 0.75,
});

export const normalizeAutoSyncPressurePolicyConfig = (config) => {
  const rawMode = String(config?.mode ?? DEFAULT_AUTO_SYNC_PRESSURE_POLICY.mode).trim().toUpperCase();
  const mode = Object.values(AUTO_SYNC_DOWNSYNC_POLICY_MODES).includes(rawMode) ? rawMode : DEFAULT_AUTO_SYNC_PRESSURE_POLICY.mode;
  return {
    mode,
    immediateDownUnits: Math.max(1, toFiniteNumber(config?.immediateDownUnits, DEFAULT_AUTO_SYNC_PRESSURE_POLICY.immediateDownUnits)),
    releaseUnits: Math.max(0.5, toFiniteNumber(config?.releaseUnits, DEFAULT_AUTO_SYNC_PRESSURE_POLICY.releaseUnits)),
    cooldownMinutes: toPositiveInt(config?.cooldownMinutes, DEFAULT_AUTO_SYNC_PRESSURE_POLICY.cooldownMinutes, 24 * 60),
    cooldownOverrideUnits: Math.max(0.5, toFiniteNumber(config?.cooldownOverrideUnits, DEFAULT_AUTO_SYNC_PRESSURE_POLICY.cooldownOverrideUnits)),
    stalenessHours: toPositiveInt(config?.stalenessHours, DEFAULT_AUTO_SYNC_PRESSURE_POLICY.stalenessHours, 24 * 14),
    pressureDecayFactor: clamp(toFiniteNumber(config?.pressureDecayFactor, DEFAULT_AUTO_SYNC_PRESSURE_POLICY.pressureDecayFactor), 0, 1),
    pressureClampAbs: Math.max(1, toFiniteNumber(config?.pressureClampAbs, DEFAULT_AUTO_SYNC_PRESSURE_POLICY.pressureClampAbs)),
    stalenessReleaseUnits: Math.max(0.25, toFiniteNumber(config?.stalenessReleaseUnits, DEFAULT_AUTO_SYNC_PRESSURE_POLICY.stalenessReleaseUnits)),
  };
};

export const resolveAutoSyncPressurePolicyConfig = () => normalizeAutoSyncPressurePolicyConfig({
  mode: process.env.SHOP_SYNC_DOWNSYNC_POLICY_MODE,
  immediateDownUnits: process.env.SHOP_SYNC_DOWNSYNC_IMMEDIATE_UNITS,
  releaseUnits: process.env.SHOP_SYNC_DOWNSYNC_RELEASE_UNITS,
  cooldownMinutes: process.env.SHOP_SYNC_DOWNSYNC_COOLDOWN_MINUTES,
  cooldownOverrideUnits: process.env.SHOP_SYNC_DOWNSYNC_COOLDOWN_OVERRIDE_UNITS,
  stalenessHours: process.env.SHOP_SYNC_DOWNSYNC_STALENESS_HOURS,
  pressureDecayFactor: process.env.SHOP_SYNC_DOWNSYNC_DECAY_FACTOR,
  pressureClampAbs: process.env.SHOP_SYNC_DOWNSYNC_PRESSURE_CLAMP_ABS,
  stalenessReleaseUnits: process.env.SHOP_SYNC_DOWNSYNC_STALENESS_RELEASE_UNITS,
});

export const normalizeAutoSyncPressureState = (state) => ({
  pressureUnits: clamp(toFiniteNumber(state?.pressure_units, 0), -100, 100),
  lastGapUnits: clamp(toFiniteNumber(state?.last_gap_units, 0), -100, 100),
  lastSeenTargetKrw: Math.max(0, Math.round(toFiniteNumber(state?.last_seen_target_krw, 0))),
  lastSeenCurrentKrw: Math.max(0, Math.round(toFiniteNumber(state?.last_seen_current_krw, 0))),
  lastAutoSyncAt: typeof state?.last_auto_sync_at === "string" ? state.last_auto_sync_at : null,
  lastUpsyncAt: typeof state?.last_upsync_at === "string" ? state.last_upsync_at : null,
  lastDownsyncAt: typeof state?.last_downsync_at === "string" ? state.last_downsync_at : null,
  cooldownUntil: typeof state?.cooldown_until === "string" ? state.cooldown_until : null,
});

export const resolveAutoSyncThresholdUnitKrw = ({ currentPriceKrw, minChangeKrw, minChangeRate }) => {
  const threshold = resolveEffectiveMinChangeKrw({
    currentPriceKrw,
    policy: { min_change_krw: minChangeKrw, min_change_rate: minChangeRate },
  });
  return Math.max(1, Math.round(toFiniteNumber(threshold, 5000)));
};

export const evaluateAutoSyncPressurePolicy = ({
  currentPriceKrw,
  desiredPriceKrw,
  state,
  minChangeKrw,
  minChangeRate,
  now,
  config,
}) => {
  const resolvedConfig = config ?? resolveAutoSyncPressurePolicyConfig();
  const normalizedState = normalizeAutoSyncPressureState(state);
  const nowIso = toIso(now);
  const nowMs = Date.parse(nowIso);
  const thresholdUnitKrw = resolveAutoSyncThresholdUnitKrw({ currentPriceKrw, minChangeKrw, minChangeRate });
  const gapKrw = Math.round(toFiniteNumber(desiredPriceKrw, 0) - toFiniteNumber(currentPriceKrw, 0));
  const gapUnits = gapKrw / thresholdUnitKrw;
  const prevPressureUnits = normalizedState.pressureUnits;
  const nextState = {
    ...normalizedState,
    lastGapUnits: gapUnits,
    lastSeenTargetKrw: Math.max(0, Math.round(toFiniteNumber(desiredPriceKrw, 0))),
    lastSeenCurrentKrw: Math.max(0, Math.round(toFiniteNumber(currentPriceKrw, 0))),
  };

  let releaseType = "NONE";
  let shouldCreateIntent = false;
  let shouldCreateDownsyncIntent = false;
  let shouldCreateUpsyncIntent = false;
  let cooldownBlocked = false;
  let pressureDecayApplied = false;
  let pressureReleaseTriggered = false;
  let largeDownsyncTriggered = false;
  let stalenessReleaseTriggered = false;

  if (gapUnits >= 0) {
    nextState.pressureUnits = prevPressureUnits < 0
      ? clamp(prevPressureUnits * resolvedConfig.pressureDecayFactor, -resolvedConfig.pressureClampAbs, resolvedConfig.pressureClampAbs)
      : 0;
    pressureDecayApplied = nextState.pressureUnits !== prevPressureUnits;
    if (gapUnits >= 1) {
      releaseType = "UPSYNC";
      shouldCreateIntent = true;
      shouldCreateUpsyncIntent = true;
    }
    return { thresholdUnitKrw, gapKrw, gapUnits, releaseType, shouldCreateIntent, shouldCreateDownsyncIntent, shouldCreateUpsyncIntent, cooldownBlocked, pressureDecayApplied, pressureReleaseTriggered, largeDownsyncTriggered, stalenessReleaseTriggered, nextState };
  }

  const cooldownUntilMs = toMs(normalizedState.cooldownUntil);
  const inCooldown = cooldownUntilMs !== null && cooldownUntilMs > nowMs;
  const lastDownsyncAtMs = toMs(normalizedState.lastDownsyncAt);
  const stalenessDue = lastDownsyncAtMs !== null && (nowMs - lastDownsyncAtMs) >= (resolvedConfig.stalenessHours * 60 * 60 * 1000);
  const accumulatedPressureUnits = clamp((prevPressureUnits * resolvedConfig.pressureDecayFactor) + clamp(gapUnits, -1, 1), -resolvedConfig.pressureClampAbs, resolvedConfig.pressureClampAbs);
  nextState.pressureUnits = accumulatedPressureUnits;

  const mode = resolvedConfig.mode;
  const allowImmediateLargeDownsync = mode === AUTO_SYNC_DOWNSYNC_POLICY_MODES.IMMEDIATE_ONLY || mode === AUTO_SYNC_DOWNSYNC_POLICY_MODES.FULL;
  const allowPressureRelease = mode === AUTO_SYNC_DOWNSYNC_POLICY_MODES.FULL;

  if (allowImmediateLargeDownsync && gapUnits <= -resolvedConfig.immediateDownUnits) {
    releaseType = "LARGE_DOWNSYNC";
    shouldCreateIntent = true;
    shouldCreateDownsyncIntent = true;
    largeDownsyncTriggered = true;
  } else if (inCooldown && allowPressureRelease && gapUnits <= -resolvedConfig.cooldownOverrideUnits) {
    releaseType = "PRESSURE_DOWNSYNC";
    shouldCreateIntent = true;
    shouldCreateDownsyncIntent = true;
    pressureReleaseTriggered = true;
  } else if (inCooldown) {
    releaseType = "COOLDOWN_BLOCKED";
    cooldownBlocked = true;
  } else if (allowPressureRelease && accumulatedPressureUnits <= -resolvedConfig.releaseUnits) {
    releaseType = "PRESSURE_DOWNSYNC";
    shouldCreateIntent = true;
    shouldCreateDownsyncIntent = true;
    pressureReleaseTriggered = true;
  } else if (allowPressureRelease && stalenessDue && gapUnits <= -resolvedConfig.stalenessReleaseUnits) {
    releaseType = "STALE_DOWNSYNC";
    shouldCreateIntent = true;
    shouldCreateDownsyncIntent = true;
    stalenessReleaseTriggered = true;
  }

  return { thresholdUnitKrw, gapKrw, gapUnits, releaseType, shouldCreateIntent, shouldCreateDownsyncIntent, shouldCreateUpsyncIntent, cooldownBlocked, pressureDecayApplied, pressureReleaseTriggered, largeDownsyncTriggered, stalenessReleaseTriggered, nextState };
};

export const buildAutoSyncPressureStateRow = ({ channelId, channelProductId, masterItemId, externalProductNo, externalVariantCode, nextState, now }) => ({
  channel_id: channelId,
  channel_product_id: channelProductId,
  master_item_id: masterItemId || null,
  external_product_no: externalProductNo,
  external_variant_code: externalVariantCode || null,
  pressure_units: nextState.pressureUnits,
  last_gap_units: nextState.lastGapUnits,
  last_seen_target_krw: nextState.lastSeenTargetKrw,
  last_seen_current_krw: nextState.lastSeenCurrentKrw,
  last_auto_sync_at: nextState.lastAutoSyncAt,
  last_upsync_at: nextState.lastUpsyncAt,
  last_downsync_at: nextState.lastDownsyncAt,
  cooldown_until: nextState.cooldownUntil,
  updated_at: toIso(now),
});

export const buildAutoSyncPressureSuccessPatch = ({ previousState, beforePriceKrw, targetPriceKrw, now, config }) => {
  const resolvedConfig = config ?? resolveAutoSyncPressurePolicyConfig();
  const normalizedState = normalizeAutoSyncPressureState(previousState);
  const nowIso = toIso(now);
  const beforeRounded = Math.round(toFiniteNumber(beforePriceKrw, 0));
  const targetRounded = Math.round(toFiniteNumber(targetPriceKrw, 0));
  const isDownsync = targetRounded < beforeRounded;
  const isUpsync = targetRounded > beforeRounded;

  return {
    ...normalizedState,
    lastSeenTargetKrw: Math.max(0, targetRounded),
    lastSeenCurrentKrw: Math.max(0, targetRounded),
    lastGapUnits: 0,
    lastAutoSyncAt: nowIso,
    lastUpsyncAt: isUpsync ? nowIso : normalizedState.lastUpsyncAt,
    lastDownsyncAt: isDownsync ? nowIso : normalizedState.lastDownsyncAt,
    cooldownUntil: isDownsync ? new Date(Date.parse(nowIso) + (resolvedConfig.cooldownMinutes * 60 * 1000)).toISOString() : normalizedState.cooldownUntil,
    pressureUnits: isDownsync ? 0 : normalizedState.pressureUnits,
  };
};
