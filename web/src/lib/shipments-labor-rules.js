const AUTO_EVIDENCE_TYPES = new Set(["COST_BASIS", "MARGINS", "WARN"]);

const toType = (type) => String(type ?? "").trim().toUpperCase();
const toLabel = (label) => String(label ?? "").trim().toUpperCase();

export const isBomReferenceTypeValue = (type) => {
  const normalized = toType(type);
  return normalized === "BOM_DEFAULT" || normalized.startsWith("BOM_COMPONENT:");
};

export const isMaterialMasterTypeValue = (type) => toType(type).startsWith("MATERIAL_MASTER:");

export const isPlatingMasterTypeValue = (type) => toType(type) === "PLATING_MASTER";

export const isAdjustmentTypeValue = (type) => toType(type) === "ADJUSTMENT";

export const isAutoEvidenceByTypeLabel = (type, label) => {
  const normalizedType = toType(type);
  const normalizedLabel = toLabel(label);
  if (AUTO_EVIDENCE_TYPES.has(normalizedType)) return true;
  return (
    normalizedLabel.includes("COST_BASIS") ||
    normalizedLabel.includes("MARGIN") ||
    normalizedLabel.includes("WARN")
  );
};

export const isCoreVisibleEtcItem = (item) => {
  const type = toType(item?.type);
  const label = String(item?.label ?? "");
  if (isBomReferenceTypeValue(type)) return false;
  if (type === "STONE_LABOR") return false;
  if (type === "VENDOR_DELTA") return false;
  if (type === "CUSTOM_VARIATION") return false;
  if (isAutoEvidenceByTypeLabel(type, label)) return false;
  return true;
};

export const isEtcSummaryEligibleItem = (item) => {
  if (!isCoreVisibleEtcItem(item)) return false;
  return !isAdjustmentTypeValue(item?.type);
};

export const shouldKeepOnAutoMerge = (item, isAutoManagedExtraLaborItem) => {
  const type = toType(item?.type);
  const meta = item?.meta && typeof item.meta === "object" && !Array.isArray(item.meta) ? item.meta : null;
  const source = toType(meta?.source);
  if (isPlatingMasterTypeValue(type)) return true;
  if (source === "PRICING_POLICY_META") return false;
  return !isAutoManagedExtraLaborItem(item);
};
