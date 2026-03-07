const CATEGORY_KEYS = ["MATERIAL", "SIZE", "COLOR_PLATING", "DECOR", "OTHER"];

export const OPTION_LABOR_RULE_CATEGORIES = CATEGORY_KEYS;

export const OPTION_LABOR_RULE_CATEGORY_LABELS = {
  MATERIAL: "소재",
  SIZE: "사이즈",
  COLOR_PLATING: "색상",
  DECOR: "장식",
  OTHER: "기타",
};

const WEIGHT_MIN_CENTIGRAM = 1;
const WEIGHT_MAX_CENTIGRAM = 10000;

let additionalWeightOptionsCache = null;

const toFiniteNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const normalizeOptionLaborRuleCategory = (value) => {
  const categoryKey = String(value ?? "").trim().toUpperCase();
  return CATEGORY_KEYS.includes(categoryKey) ? categoryKey : null;
};

export const normalizeMaterialScopeCode = (value) => {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || null;
};

export const normalizeOptionLaborColorCode = (value) => {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || null;
};

export const normalizeDecorationCode = (value) => {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || null;
};

export const normalizeKrwInteger = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

export const normalizeAdditionalWeightCentigram = (value) => {
  const n = toFiniteNumber(value);
  if (n === null) return null;
  const centigram = Math.round(n * 100);
  if (centigram < WEIGHT_MIN_CENTIGRAM || centigram > WEIGHT_MAX_CENTIGRAM) return null;
  return centigram;
};

export const centigramToWeightString = (centigram) => {
  const safe = Number(centigram);
  if (!Number.isFinite(safe)) return null;
  return (safe / 100).toFixed(2);
};

export const normalizeAdditionalWeightValue = (value) => {
  const centigram = normalizeAdditionalWeightCentigram(value);
  return centigram === null ? null : centigramToWeightString(centigram);
};

export const buildAdditionalWeightOptions = () => {
  if (additionalWeightOptionsCache) return additionalWeightOptionsCache;
  additionalWeightOptionsCache = Array.from({ length: WEIGHT_MAX_CENTIGRAM }, (_, index) => {
    const centigram = index + 1;
    const value = centigramToWeightString(centigram);
    return {
      centigram,
      value,
      label: `${value}g`,
    };
  });
  return additionalWeightOptionsCache;
};

const normalizeRuleRow = (row) => {
  const categoryKey = normalizeOptionLaborRuleCategory(row?.category_key);
  if (!categoryKey) return null;
  const additionalWeightValue = normalizeAdditionalWeightValue(row?.additional_weight_g);
  return {
    ...row,
    category_key: categoryKey,
    scope_material_code: normalizeMaterialScopeCode(row?.scope_material_code),
    color_code: normalizeOptionLaborColorCode(row?.color_code),
    decoration_model_name: String(row?.decoration_model_name ?? "").trim() || null,
    decoration_code: normalizeDecorationCode(row?.decoration_model_name),
    additional_weight_value: additionalWeightValue,
    base_labor_cost_krw: normalizeKrwInteger(row?.base_labor_cost_krw, 0),
    additive_delta_krw: normalizeKrwInteger(row?.additive_delta_krw, 0),
    is_active: row?.is_active !== false,
  };
};

export const hasActiveOptionLaborRules = (rows) =>
  Array.isArray(rows) && rows.some((row) => normalizeRuleRow(row)?.is_active === true);

const findRule = (rows, matcher) => {
  for (const raw of rows) {
    const row = normalizeRuleRow(raw);
    if (!row || !row.is_active) continue;
    if (matcher(row)) return row;
  }
  return null;
};

export const resolveOptionLaborRuleMatches = (rows, context) => {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const materialCode = normalizeMaterialScopeCode(context?.materialCode);
  const additionalWeightValue = normalizeAdditionalWeightValue(context?.additionalWeightG);
  const platingEnabled = context?.platingEnabled === true;
  const colorCode = normalizeOptionLaborColorCode(context?.colorCode);
  const decorationCode = normalizeDecorationCode(context?.decorationCode);
  const decorationMasterId = String(context?.decorationMasterId ?? "").trim();

  const material = findRule(sourceRows, (row) => row.category_key === "MATERIAL");

  const size = additionalWeightValue
    ? findRule(
      sourceRows,
      (row) => row.category_key === "SIZE"
        && row.scope_material_code === materialCode
        && row.additional_weight_value === additionalWeightValue,
    )
    : null;

  const colorPlating = findRule(
    sourceRows,
    (row) => row.category_key === "COLOR_PLATING"
      && Boolean(row.plating_enabled) === platingEnabled
      && (!row.color_code || row.color_code === colorCode),
  );

  const decor = findRule(
    sourceRows,
    (row) => row.category_key === "DECOR"
      && (
        (decorationMasterId && String(row.decoration_master_id ?? "").trim() === decorationMasterId)
        || (decorationCode && row.decoration_code === decorationCode)
      ),
  );

  const other = findRule(sourceRows, (row) => row.category_key === "OTHER");

  return { material, size, colorPlating, decor, other };
};

export const computeOptionLaborBuckets = (rows, context) => {
  const matched = resolveOptionLaborRuleMatches(rows, context);
  const material = 0;
  const size = matched.size ? normalizeKrwInteger(matched.size.additive_delta_krw, 0) : 0;
  const colorPlating = matched.colorPlating ? normalizeKrwInteger(matched.colorPlating.additive_delta_krw, 0) : 0;
  const decor = matched.decor
    ? normalizeKrwInteger(matched.decor.base_labor_cost_krw, 0) + normalizeKrwInteger(matched.decor.additive_delta_krw, 0)
    : 0;
  const other = matched.other ? normalizeKrwInteger(matched.other.additive_delta_krw, 0) : 0;
  return {
    material,
    size,
    colorPlating,
    decor,
    other,
    total: material + size + colorPlating + decor + other,
    matched,
  };
};
