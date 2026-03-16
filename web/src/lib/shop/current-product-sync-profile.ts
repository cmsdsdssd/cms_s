import { normalizePriceSyncThresholdProfile } from '@/lib/shop/price-sync-policy';

export type CurrentProductSyncProfile = 'GENERAL' | 'MARKET_LINKED';

type ProfileRow = {
  master_item_id?: string | null;
  current_product_sync_profile?: string | null;
};

export const DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE: CurrentProductSyncProfile = 'GENERAL';

export const formatCurrentProductSyncProfileLabel = (profile: CurrentProductSyncProfile): string => {
  return profile === 'MARKET_LINKED' ? '시장연동형' : '일반형';
};

export const describeCurrentProductSyncProfile = (profile: CurrentProductSyncProfile): string => {
  return profile === 'MARKET_LINKED'
    ? '시세 기준 uplift와 시장연동 threshold를 우선 적용합니다.'
    : '기본 threshold와 일반 상품 기준으로 계산과 자동 동기화를 진행합니다.';
};

const isKnownCurrentProductSyncProfile = (value: unknown): value is CurrentProductSyncProfile => {
  const profile = String(value ?? '').trim().toUpperCase();
  return profile === 'GENERAL' || profile === 'MARKET_LINKED';
};

export const normalizeCurrentProductSyncProfile = (
  value: unknown,
  fallback: CurrentProductSyncProfile = DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE,
): CurrentProductSyncProfile => {
  return normalizePriceSyncThresholdProfile(value, fallback as "GENERAL") as CurrentProductSyncProfile;
};

export const resolveCurrentProductSyncProfile = (
  rows: ProfileRow[],
  fallback: CurrentProductSyncProfile = DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE,
): CurrentProductSyncProfile => {
  const normalizedFallback = normalizeCurrentProductSyncProfile(fallback);
  let resolvedProfile: CurrentProductSyncProfile | null = null;

  for (const row of Array.isArray(rows) ? rows : []) {
    const rawProfile = row && typeof row === 'object' ? row.current_product_sync_profile : undefined;
    if (rawProfile == null || String(rawProfile).trim() === '') continue;
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

export const buildCurrentProductSyncProfileByMaster = <T extends ProfileRow>(
  rows: T[],
  fallback: CurrentProductSyncProfile = DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE,
): Map<string, CurrentProductSyncProfile> => {
  const rowsByMaster = new Map<string, T[]>();

  for (const row of Array.isArray(rows) ? rows : []) {
    const masterItemId = String(row?.master_item_id ?? '').trim();
    if (!masterItemId) continue;
    const bucket = rowsByMaster.get(masterItemId) ?? [];
    bucket.push(row);
    rowsByMaster.set(masterItemId, bucket);
  }

  const profileByMaster = new Map<string, CurrentProductSyncProfile>();
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
}: {
  incomingProfile?: unknown;
  hasIncomingProfile: boolean;
  existingRows: ProfileRow[];
  fallback?: CurrentProductSyncProfile;
}): CurrentProductSyncProfile => {
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

export const buildCurrentProductSyncProfileIndex = <T extends ProfileRow>(
  rows: T[],
  keyOf: (row: T) => unknown,
  fallback: CurrentProductSyncProfile = DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE,
): Map<string, CurrentProductSyncProfile> => {
  const rowsByKey = new Map<string, T[]>();

  for (const row of Array.isArray(rows) ? rows : []) {
    const key = String(keyOf(row) ?? '').trim();
    if (!key) continue;
    const bucket = rowsByKey.get(key) ?? [];
    bucket.push(row);
    rowsByKey.set(key, bucket);
  }

  const profileByKey = new Map<string, CurrentProductSyncProfile>();
  for (const [key, scopedRows] of rowsByKey.entries()) {
    profileByKey.set(key, resolveCurrentProductSyncProfile(scopedRows, fallback));
  }
  return profileByKey;
};

export const resolveEffectiveCurrentProductSyncProfile = ({
  channelProfile,
  currentProductProfile,
}: {
  channelProfile?: unknown;
  currentProductProfile?: unknown;
}): CurrentProductSyncProfile => {
  const normalizedChannelProfile = normalizeCurrentProductSyncProfile(channelProfile);
  if (!isKnownCurrentProductSyncProfile(currentProductProfile)) return normalizedChannelProfile;
  return normalizeCurrentProductSyncProfile(currentProductProfile, normalizedChannelProfile);
};
