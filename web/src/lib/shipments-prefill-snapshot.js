const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

export const SNAPSHOT_META_SOURCE = "RECEIPT_MATCH_SNAPSHOT";
export const LEGACY_ETC_REMAINDER_TYPE = "LEGACY_ETC_REMAINDER";

const roundKrw = (value) => {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return Math.round(value);
  return Math.ceil(value / 100) * 100;
};

const parseNumberish = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replaceAll(",", "").trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const toMetaRecord = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
};

const isPlatingLikeItem = (item) => {
  const type = toUpperToken(item?.type);
  const label = String(item?.label ?? "");
  return type === "PLATING_MASTER" || type.includes("PLATING") || label.includes("도금");
};

const getItemTypeKey = (item) => toUpperToken(item?.type);

const ensureItemIds = (items) => {
  if (!Array.isArray(items)) return [];
  return items.reduce((acc, item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return acc;
    const record = { ...item };
    const id = toStableExtraLaborItemId(record, index);
    acc.push({ ...record, id });
    return acc;
  }, []);
};

const buildAutoItem = ({ type, label, amount, cost = 0, margin = null, meta = null, index = 0 }) => {
  const roundedAmount = Math.max(roundKrw(amount), 0);
  if (roundedAmount <= 0) return null;
  const roundedCost = Math.max(roundKrw(cost), 0);
  const roundedMargin = margin === null ? roundedAmount - roundedCost : roundKrw(margin);
  const nextMeta = {
    ...(toMetaRecord(meta) ?? {}),
    source: SNAPSHOT_META_SOURCE,
    cost_krw: roundedCost,
    sell_krw: roundedAmount,
    margin_krw: roundedMargin,
  };
  const record = {
    type,
    label,
    amount: String(roundedAmount),
    meta: nextMeta,
  };
  return {
    ...record,
    id: toStableExtraLaborItemId(record, index),
  };
};

const toUpperToken = (value) => String(value ?? "").trim().toUpperCase();

const stableHash = (input) => {
  const text = String(input ?? "");
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0).toString(36);
};

const stableSortValue = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => stableSortValue(entry));
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableSortValue(value[key]);
        return acc;
      }, {});
  }
  return value;
};

export const stableStringify = (value) => JSON.stringify(stableSortValue(value));

export const toStableExtraLaborItemId = (item, index = 0) => {
  const existingId = String(item?.id ?? "").trim();
  if (existingId) return existingId;

  const record =
    item && typeof item === "object" && !Array.isArray(item)
      ? item
      : {};
  const meta =
    record.meta && typeof record.meta === "object" && !Array.isArray(record.meta)
      ? record.meta
      : null;

  const seed = [
    toUpperToken(record.type),
    toUpperToken(record.label),
    String(record.amount ?? ""),
    toUpperToken(meta?.source),
    toUpperToken(meta?.bucket),
    toUpperToken(meta?.absorb_item_id),
    toUpperToken(meta?.reason),
    String(index),
  ].join("|");

  return `eli_${stableHash(seed)}`;
};

export const normalizeExtraLaborItemsWithStableIds = (value) => {
  if (!Array.isArray(value)) return [];
  return value.reduce((acc, item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return acc;
    const record = { ...item };
    const id = toStableExtraLaborItemId(record, index);
    acc.push({ ...record, id });
    return acc;
  }, []);
};

export const buildLaborSnapshotHash = (snapshot) => {
  return stableHash(stableStringify(snapshot));
};

export const sumRoundedExtraLaborAmounts = (items) => {
  if (!Array.isArray(items)) return 0;
  const total = items.reduce((sum, item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return sum;
    return sum + parseNumberish(item.amount);
  }, 0);
  return roundKrw(total);
};

export const materializeSnapshotPolicyItems = ({ items, policyMeta }) => {
  const next = ensureItemIds(items);
  const normalizedPolicyMeta = toMetaRecord(policyMeta);

  if (!next.some((item) => isPlatingLikeItem(item))) {
    const policyPlatingSell = Math.max(roundKrw(parseNumberish(normalizedPolicyMeta?.plating_sell_krw)), 0);
    const policyAbsorbPlating = Math.max(roundKrw(parseNumberish(normalizedPolicyMeta?.absorb_plating_krw)), 0);
    const policyPlatingCost = Math.max(roundKrw(parseNumberish(normalizedPolicyMeta?.plating_cost_krw)), 0);
    const platingSell = Math.max(roundKrw(policyPlatingSell + policyAbsorbPlating), 0);
    const platingAmount = platingSell > 0 ? platingSell : policyPlatingCost;
    const platingItem = buildAutoItem({
      type: "PLATING_MASTER",
      label: "도금",
      amount: platingAmount,
      cost: policyPlatingCost,
      meta: {
        bucket: "PLATING",
        policy_key: "plating",
      },
      index: next.length,
    });
    if (platingItem) next.push(platingItem);
  }

  return next;
};

export const upsertLegacyEtcRemainderItem = ({ items, amount, label = "Legacy ETC remainder" }) => {
  const roundedAmount = Math.max(roundKrw(parseNumberish(amount)), 0);
  if (roundedAmount <= 0) return ensureItemIds(items);

  const normalized = ensureItemIds(items);
  const existingIndex = normalized.findIndex((item) => {
    const type = getItemTypeKey(item);
    if (type === LEGACY_ETC_REMAINDER_TYPE) return true;
    const meta = toMetaRecord(item.meta);
    return toUpperToken(meta?.policy_key) === "LEGACY_ETC_REMAINDER";
  });

  const nextItem = buildAutoItem({
    type: LEGACY_ETC_REMAINDER_TYPE,
    label,
    amount: roundedAmount,
    meta: {
      bucket: "ETC",
      policy_key: "legacy_etc_remainder",
    },
    index: existingIndex >= 0 ? existingIndex : normalized.length,
  });
  if (!nextItem) return normalized;

  if (existingIndex < 0) return [...normalized, nextItem];

  const current = normalized[existingIndex];
  if (String(current.amount ?? "") === String(nextItem.amount ?? "")) {
    return normalized;
  }

  const next = [...normalized];
  next[existingIndex] = {
    ...current,
    ...nextItem,
    id: current.id,
  };
  return next;
};

export const applyLaborHydrationPatch = ({ current, patch, dirty }) => {
  const baseDirty = Boolean(dirty?.base);
  const otherDirty = Boolean(dirty?.other);
  const extraDirty = Boolean(dirty?.extra);
  return {
    baseLabor: baseDirty ? current.baseLabor : (patch.baseLabor ?? current.baseLabor),
    otherLaborCost:
      otherDirty || extraDirty
        ? current.otherLaborCost
        : (patch.otherLaborCost ?? current.otherLaborCost),
    extraLaborItems: extraDirty ? current.extraLaborItems : (patch.extraLaborItems ?? current.extraLaborItems),
  };
};
