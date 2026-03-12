import { normalizePriceSyncThresholdProfile } from './price-sync-policy.js';
import './price-sync-policy.js';

export const DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE = 'GENERAL';

const isKnownCurrentProductSyncProfile = (value) => {
  const profile = String(value ?? "").trim().toUpperCase();
  return profile === 'GENERAL' || profile === 'MARKET_LINKED';
};

export const normalizeCurrentProductSyncProfile = (
  value,
  fallback = DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE,
) => normalizePriceSyncThresholdProfile(value, fallback);

export const resolveCurrentProductSyncProfile = (
  rows,
  fallback = DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE,
) => {
  const normalizedFallback = normalizeCurrentProductSyncProfile(fallback);
  let resolvedProfile = null;

  for (const row of Array.isArray(rows) ? rows : []) {
    const rawProfile = row && typeof row === 'object' ? row.current_product_sync_profile : undefined;
    if (rawProfile == null || String(rawProfile).trim() === "") continue;
    if (!isKnownCurrentProductSyncProfile(rawProfile)) return normalizedFallback;

    const normalizedProfile = normalizeCurrentProductSyncProfile(rawProfile, normalizedFallback);
    if (resolvedProfile === null) {
      resolvedProfile = normalizedProfile;
      continue;
    }
    if (resolvedProfile !== normalizedProfile) return normalizedFallback;
  }

  return resolvedProfile ?? normalizedFallback;
};

export const buildCurrentProductSyncProfileByMaster = (
  rows,
  fallback = DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE,
) => {
  const rowsByMaster = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const masterItemId = String(row?.master_item_id ?? "").trim();
    if (!masterItemId) continue;
    const bucket = rowsByMaster.get(masterItemId) ?? [];
    bucket.push(row);
    rowsByMaster.set(masterItemId, bucket);
  }

  const profileByMaster = new Map();
  for (const [masterItemId, masterRows] of rowsByMaster.entries()) {
    profileByMaster.set(masterItemId, resolveCurrentProductSyncProfile(masterRows, fallback));
  }
  return profileByMaster;
};

export const resolveCurrentProductSyncProfileForWrite = ({
  incomingProfile,
  hasIncomingProfile,
  existingRows,
  fallback = DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE,
}) => {
  if (hasIncomingProfile) {
    return normalizeCurrentProductSyncProfile(incomingProfile, fallback);
  }
  for (const row of Array.isArray(existingRows) ? existingRows : []) {
    const rawProfile = row && typeof row === 'object' ? row.current_product_sync_profile : undefined;
    if (!isKnownCurrentProductSyncProfile(rawProfile)) continue;
    return normalizeCurrentProductSyncProfile(rawProfile, fallback);
  }
  return normalizeCurrentProductSyncProfile(fallback);
};

export const buildCurrentProductSyncProfileIndex = (
  rows,
  keyOf,
  fallback = DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE,
) => {
  const rowsByKey = new Map();
  if (typeof keyOf !== 'function') return rowsByKey;

  for (const row of Array.isArray(rows) ? rows : []) {
    const key = String(keyOf(row) ?? '').trim();
    if (!key) continue;
    const bucket = rowsByKey.get(key) ?? [];
    bucket.push(row);
    rowsByKey.set(key, bucket);
  }

  const profileByKey = new Map();
  for (const [key, scopedRows] of rowsByKey.entries()) {
    profileByKey.set(key, resolveCurrentProductSyncProfile(scopedRows, fallback));
  }
  return profileByKey;
};

export const resolveEffectiveCurrentProductSyncProfile = ({
  channelProfile,
  currentProductProfile,
}) => {
  const normalizedChannelProfile = normalizeCurrentProductSyncProfile(channelProfile);
  if (!isKnownCurrentProductSyncProfile(currentProductProfile)) return normalizedChannelProfile;
  return normalizeCurrentProductSyncProfile(currentProductProfile, normalizedChannelProfile);
};
