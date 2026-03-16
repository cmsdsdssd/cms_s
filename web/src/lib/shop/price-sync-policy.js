/**
 * @typedef {object} PriceSyncPolicy
 * @property {boolean} always_sync
 * @property {number} min_change_krw
 * @property {number} min_change_rate
 */

/**
 * @typedef {object} PriceSyncPolicyInput
 * @property {unknown} [always_sync]
 * @property {unknown} [min_change_krw]
 * @property {unknown} [min_change_rate]
 */

/** @type {Readonly<PriceSyncPolicy>} */
export const DEFAULT_PRICE_SYNC_POLICY = Object.freeze({
  always_sync: false,
  min_change_krw: 5000,
  min_change_rate: 0.02,
});

export const PRICE_SYNC_THRESHOLD_PROFILE = Object.freeze({
  GENERAL: "GENERAL",
  MARKET_LINKED: "MARKET_LINKED",
});

export const DEFAULT_PRICE_SYNC_THRESHOLD_PROFILE = PRICE_SYNC_THRESHOLD_PROFILE.GENERAL;

/** @type {Readonly<Record<string, Readonly<PriceSyncPolicy>>>} */
export const PRICE_SYNC_THRESHOLD_PROFILE_PRESETS = Object.freeze({
  [PRICE_SYNC_THRESHOLD_PROFILE.GENERAL]: Object.freeze({
    always_sync: false,
    min_change_krw: 5000,
    min_change_rate: 0.02,
  }),
  [PRICE_SYNC_THRESHOLD_PROFILE.MARKET_LINKED]: Object.freeze({
    always_sync: false,
    min_change_krw: 500,
    min_change_rate: 0.005,
  }),
});

const toBoolean = (value, fallback) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "y" || normalized === "yes") return true;
  if (normalized === "0" || normalized === "false" || normalized === "n" || normalized === "no") return false;
  return fallback;
};

const toNonNegativeInt = (value, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
};

const toNonNegativeRate = (value, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
};


/** @type {Readonly<PriceSyncPolicy>} */
export const DEFAULT_OPTION_ADDITIONAL_SYNC_POLICY = Object.freeze({
  always_sync: false,
  min_change_krw: 2000,
  min_change_rate: 0.02,
});

export const normalizeOptionAdditionalSyncPolicy = (policy, defaults = DEFAULT_OPTION_ADDITIONAL_SYNC_POLICY) =>
  normalizePriceSyncPolicy(policy, defaults);

/**
 * @param {{ currentAdditionalKrw?: unknown, nextAdditionalKrw?: unknown, policy?: PriceSyncPolicyInput, defaults?: PriceSyncPolicyInput }} [args]
 */
export const resolveEffectiveOptionAdditionalMinChangeKrw = ({ currentAdditionalKrw, policy, defaults } = {}) => {
  const normalizedPolicy = normalizeOptionAdditionalSyncPolicy(policy, defaults);
  const normalizedCurrentAdditionalKrw = normalizeCurrentPriceKrw(currentAdditionalKrw);
  const rateMinChangeKrw = normalizedCurrentAdditionalKrw > 0
    ? Math.round(normalizedCurrentAdditionalKrw * normalizedPolicy.min_change_rate)
    : null;
  return {
    flatMinChangeKrw: normalizedPolicy.min_change_krw,
    rateMinChangeKrw,
    effectiveMinChangeKrw: Math.max(normalizedPolicy.min_change_krw, rateMinChangeKrw ?? 0),
    effectiveMode: rateMinChangeKrw !== null ? 'MAX' : 'FLAT_ONLY',
    policy: normalizedPolicy,
  };
};

export const shouldSyncOptionAdditionalChange = ({ currentAdditionalKrw, nextAdditionalKrw, policy, defaults } = {}) => {
  const resolved = resolveEffectiveOptionAdditionalMinChangeKrw({ currentAdditionalKrw, policy, defaults });
  const normalizedCurrentAdditionalKrw = normalizeCurrentPriceKrw(currentAdditionalKrw);
  const normalizedNextAdditionalKrw = normalizeCurrentPriceKrw(nextAdditionalKrw);
  const additionalDeltaKrw = Math.abs(normalizedNextAdditionalKrw - normalizedCurrentAdditionalKrw);

  if (resolved.policy.always_sync) {
    return {
      should_sync: true,
      threshold_bypassed: true,
      additional_delta_krw: additionalDeltaKrw,
      flat_min_change_krw: resolved.flatMinChangeKrw,
      rate_min_change_krw: resolved.rateMinChangeKrw,
      effective_min_change_krw: resolved.effectiveMinChangeKrw,
      effective_mode: resolved.effectiveMode,
      policy: resolved.policy,
    };
  }

  if (additionalDeltaKrw === 0) {
    return {
      should_sync: false,
      threshold_bypassed: false,
      additional_delta_krw: 0,
      flat_min_change_krw: resolved.flatMinChangeKrw,
      rate_min_change_krw: resolved.rateMinChangeKrw,
      effective_min_change_krw: resolved.effectiveMinChangeKrw,
      effective_mode: resolved.effectiveMode,
      policy: resolved.policy,
    };
  }

  return {
    should_sync: additionalDeltaKrw >= resolved.effectiveMinChangeKrw,
    threshold_bypassed: false,
    additional_delta_krw: additionalDeltaKrw,
    flat_min_change_krw: resolved.flatMinChangeKrw,
    rate_min_change_krw: resolved.rateMinChangeKrw,
    effective_min_change_krw: resolved.effectiveMinChangeKrw,
    effective_mode: resolved.effectiveMode,
    policy: resolved.policy,
  };
};

export const normalizeCurrentPriceKrw = (value) => toNonNegativeInt(value, 0);

export const normalizePriceSyncThresholdProfile = (
  value,
  fallback = DEFAULT_PRICE_SYNC_THRESHOLD_PROFILE,
) => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === PRICE_SYNC_THRESHOLD_PROFILE.MARKET_LINKED) {
    return PRICE_SYNC_THRESHOLD_PROFILE.MARKET_LINKED;
  }
  if (normalized === PRICE_SYNC_THRESHOLD_PROFILE.GENERAL) {
    return PRICE_SYNC_THRESHOLD_PROFILE.GENERAL;
  }
  return normalizePriceSyncThresholdProfile(fallback, DEFAULT_PRICE_SYNC_THRESHOLD_PROFILE);
};

export const resolvePriceSyncThresholdProfilePolicy = (profile) => {
  const normalizedProfile = normalizePriceSyncThresholdProfile(profile);
  return PRICE_SYNC_THRESHOLD_PROFILE_PRESETS[normalizedProfile] ?? DEFAULT_PRICE_SYNC_POLICY;
};

/**
 * @param {PriceSyncPolicyInput | undefined} policy
 * @param {PriceSyncPolicyInput | undefined} [defaults=DEFAULT_PRICE_SYNC_POLICY]
 * @returns {PriceSyncPolicy}
 */
export const normalizePriceSyncPolicy = (policy, defaults = DEFAULT_PRICE_SYNC_POLICY) => {
  const normalizedDefaults = {
    always_sync: toBoolean(defaults?.always_sync, DEFAULT_PRICE_SYNC_POLICY.always_sync),
    min_change_krw: toNonNegativeInt(defaults?.min_change_krw, DEFAULT_PRICE_SYNC_POLICY.min_change_krw),
    min_change_rate: toNonNegativeRate(defaults?.min_change_rate, DEFAULT_PRICE_SYNC_POLICY.min_change_rate),
  };

  return {
    always_sync: toBoolean(policy?.always_sync, normalizedDefaults.always_sync),
    min_change_krw: toNonNegativeInt(policy?.min_change_krw, normalizedDefaults.min_change_krw),
    min_change_rate: toNonNegativeRate(policy?.min_change_rate, normalizedDefaults.min_change_rate),
  };
};

/**
 * @param {{ currentPriceKrw?: unknown, policy?: PriceSyncPolicyInput, defaults?: PriceSyncPolicyInput }} [args]
 */
export const resolveRateDerivedThresholdKrw = ({ currentPriceKrw, policy, defaults } = {}) => {
  const normalizedPolicy = normalizePriceSyncPolicy(policy, defaults);
  const normalizedCurrentPriceKrw = normalizeCurrentPriceKrw(currentPriceKrw);
  return Math.round(normalizedCurrentPriceKrw * normalizedPolicy.min_change_rate);
};

/**
 * @param {{ currentPriceKrw?: unknown, policy?: PriceSyncPolicyInput, defaults?: PriceSyncPolicyInput }} [args]
 */
export const resolveEffectiveMinChangeKrw = ({ currentPriceKrw, policy, defaults } = {}) => {
  const normalizedPolicy = normalizePriceSyncPolicy(policy, defaults);
  const rateDerivedThresholdKrw = resolveRateDerivedThresholdKrw({
    currentPriceKrw,
    policy: normalizedPolicy,
  });
  return Math.max(normalizedPolicy.min_change_krw, rateDerivedThresholdKrw);
};

/**
 * @param {{ currentPriceKrw?: unknown, nextPriceKrw?: unknown, policy?: PriceSyncPolicyInput, defaults?: PriceSyncPolicyInput }} [args]
 */
export const shouldSyncPriceChange = ({ currentPriceKrw, nextPriceKrw, policy, defaults } = {}) => {
  const normalizedPolicy = normalizePriceSyncPolicy(policy, defaults);
  const normalizedCurrentPriceKrw = normalizeCurrentPriceKrw(currentPriceKrw);
  const normalizedNextPriceKrw = normalizeCurrentPriceKrw(nextPriceKrw);
  const priceDeltaKrw = Math.abs(normalizedNextPriceKrw - normalizedCurrentPriceKrw);
  const effectiveMinChangeKrw = resolveEffectiveMinChangeKrw({
    currentPriceKrw: normalizedCurrentPriceKrw,
    policy: normalizedPolicy,
  });

  if (normalizedPolicy.always_sync) {
    return {
      should_sync: true,
      threshold_bypassed: true,
      price_delta_krw: priceDeltaKrw,
      effective_min_change_krw: effectiveMinChangeKrw,
      policy: normalizedPolicy,
    };
  }

  if (priceDeltaKrw === 0) {
    return {
      should_sync: false,
      threshold_bypassed: false,
      price_delta_krw: 0,
      effective_min_change_krw: effectiveMinChangeKrw,
      policy: normalizedPolicy,
    };
  }

  return {
    should_sync: priceDeltaKrw >= effectiveMinChangeKrw,
    threshold_bypassed: false,
    price_delta_krw: priceDeltaKrw,
    effective_min_change_krw: effectiveMinChangeKrw,
    policy: normalizedPolicy,
  };
};
