import {
  DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE,
  normalizeCurrentProductSyncProfile,
} from './current-product-sync-profile.js';

export const SYNC_CADENCE_MINUTES = Object.freeze({
  GENERAL: 120,
  MARKET_LINKED: 5,
});

export const normalizeSyncCadenceProfile = (value, fallback = DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE) =>
  normalizeCurrentProductSyncProfile(value, fallback);

export const resolveSyncCadenceMinutes = (profile) => {
  const normalized = normalizeSyncCadenceProfile(profile);
  return SYNC_CADENCE_MINUTES[normalized] ?? SYNC_CADENCE_MINUTES[DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE];
};

export const addCadenceMinutes = (isoString, cadenceMinutes) => {
  const baseMs = Date.parse(typeof isoString === 'string' ? isoString : '');
  const nowMs = Number.isFinite(baseMs) ? baseMs : Date.now();
  return new Date(nowMs + (Math.max(1, Math.floor(Number(cadenceMinutes) || 0)) * 60 * 1000)).toISOString();
};
