import { resolveMarketLinkedSizeCell } from "./market-linked-size-grid.js";
import { resolvePersistedSizeGridCell } from "./weight-grid-store.js";
import { isPlatingComboCode, normalizePlatingComboCode } from "./sync-rules.ts";

const CATEGORY_KEYS = ["MATERIAL", "SIZE", "COLOR_PLATING", "DECOR", "OTHER"];

export const OPTION_LABOR_RULE_CATEGORIES = CATEGORY_KEYS;

export const OPTION_LABOR_RULE_CATEGORY_LABELS = {
  MATERIAL: "소재",
  SIZE: "사이즈",
  COLOR_PLATING: "색상",
  DECOR: "장식",
  OTHER: "기타",
};

const WEIGHT_MIN_CENTIGRAM = 0;
const WEIGHT_MAX_CENTIGRAM = 10000;
const LABOR_AMOUNT_STEP_KRW = 100;

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
  const normalized = normalizePlatingComboCode(value);
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
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const centigram = normalizeAdditionalWeightCentigram(value);
  return centigram === null ? null : centigramToWeightString(centigram);
};

export const buildAdditionalWeightOptions = () => {
  if (additionalWeightOptionsCache) return additionalWeightOptionsCache;
  const optionCount = WEIGHT_MAX_CENTIGRAM - WEIGHT_MIN_CENTIGRAM + 1;
  additionalWeightOptionsCache = Array.from({ length: optionCount }, (_, index) => {
    const centigram = WEIGHT_MIN_CENTIGRAM + index;
    const value = centigramToWeightString(centigram) ?? '0.00';
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
  const exactWeightValue = normalizeAdditionalWeightValue(row?.additional_weight_g);
  const minWeightValue = normalizeAdditionalWeightValue(row?.additional_weight_min_g);
  const maxWeightValue = normalizeAdditionalWeightValue(row?.additional_weight_max_g);
  const effectiveMinWeightValue = minWeightValue ?? exactWeightValue;
  const effectiveMaxWeightValue = maxWeightValue ?? exactWeightValue;
  const effectiveMinCentigram = normalizeAdditionalWeightCentigram(effectiveMinWeightValue);
  const effectiveMaxCentigram = normalizeAdditionalWeightCentigram(effectiveMaxWeightValue);
  return {
    ...row,
    category_key: categoryKey,
    scope_material_code: normalizeMaterialScopeCode(row?.scope_material_code),
    color_code: normalizeOptionLaborColorCode(row?.color_code),
    decoration_model_name: String(row?.decoration_model_name ?? "").trim() || null,
    decoration_code: normalizeDecorationCode(row?.decoration_model_name),
    additional_weight_value: exactWeightValue,
    additional_weight_min_value: effectiveMinWeightValue,
    additional_weight_max_value: effectiveMaxWeightValue,
    additional_weight_min_centigram: effectiveMinCentigram,
    additional_weight_max_centigram: effectiveMaxCentigram,
    master_item_id: String(row?.master_item_id ?? '').trim() || null,
    external_product_no: String(row?.external_product_no ?? '').trim() || null,
    size_price_mode: String(row?.size_price_mode ?? '').trim().toUpperCase() || null,
    fixed_delta_krw: Number.isFinite(Number(row?.fixed_delta_krw)) ? Math.round(Number(row?.fixed_delta_krw)) : null,
    formula_multiplier: Number.isFinite(Number(row?.formula_multiplier)) ? Number(row?.formula_multiplier) : null,
    formula_offset_krw: Number.isFinite(Number(row?.formula_offset_krw)) ? Number(row?.formula_offset_krw) : null,
    rounding_unit_krw: Number.isFinite(Number(row?.rounding_unit_krw)) ? Math.round(Number(row?.rounding_unit_krw)) : null,
    rounding_mode: String(row?.rounding_mode ?? '').trim().toUpperCase() || null,
    base_labor_cost_krw: normalizeKrwInteger(row?.base_labor_cost_krw, 0),
    additive_delta_krw: normalizeKrwInteger(
      Math.round(normalizeKrwInteger(row?.additive_delta_krw, 0) / LABOR_AMOUNT_STEP_KRW) * LABOR_AMOUNT_STEP_KRW,
      0,
    ),
    is_active: row?.is_active !== false,
    note: String(row?.note ?? "").trim() || null,
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

const findRules = (rows, matcher) => {
  const matches = [];
  for (const raw of rows) {
    const row = normalizeRuleRow(raw);
    if (!row || !row.is_active) continue;
    if (matcher(row)) matches.push(row);
  }
  return matches;
};

const isSizeRangeMatched = (row, additionalWeightCentigram) => {
  if (!Number.isFinite(additionalWeightCentigram)) return false;
  const min = Number(row.additional_weight_min_centigram);
  const max = Number(row.additional_weight_max_centigram);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return false;
  return additionalWeightCentigram >= min && additionalWeightCentigram <= max;
};

export const resolveOptionLaborRuleMatches = (rows, context) => {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const materialCode = normalizeMaterialScopeCode(context?.materialCode);
  const additionalWeightValue = normalizeAdditionalWeightValue(context?.additionalWeightG);
  const additionalWeightCentigram = normalizeAdditionalWeightCentigram(context?.additionalWeightG);
  const platingEnabled = context?.platingEnabled === true || isPlatingComboCode(context?.colorCode);
  const colorCode = normalizeOptionLaborColorCode(context?.colorCode);
  const decorationCode = normalizeDecorationCode(context?.decorationCode);
  const decorationMasterId = String(context?.decorationMasterId ?? "").trim();

  const material = findRule(sourceRows, (row) => row.category_key === "MATERIAL");

  const sizeRules = additionalWeightValue
    ? findRules(
      sourceRows,
      (row) => row.category_key === "SIZE"
        && row.scope_material_code === materialCode
        && isSizeRangeMatched(row, additionalWeightCentigram),
    )
    : [];
  const size = sizeRules[0] ?? null;

  const colorPlatingExactRules = colorCode
    ? findRules(
      sourceRows,
      (row) => row.category_key === "COLOR_PLATING"
        && row.scope_material_code === materialCode
        && Boolean(row.plating_enabled) === platingEnabled
        && row.color_code === colorCode,
    )
    : [];
  const colorPlatingFallbackRules = findRules(
    sourceRows,
    (row) => row.category_key === "COLOR_PLATING"
      && row.scope_material_code === materialCode
      && Boolean(row.plating_enabled) === platingEnabled
      && !row.color_code,
  );
  const colorPlatingRules = colorPlatingExactRules.length > 0 ? colorPlatingExactRules : colorPlatingFallbackRules;
  const colorPlating = colorPlatingRules[0] ?? null;

  const decorRules = findRules(
    sourceRows,
    (row) => row.category_key === "DECOR"
      && (
        (decorationMasterId && String(row.decoration_master_id ?? "").trim() === decorationMasterId)
        || (decorationCode && row.decoration_code === decorationCode)
      ),
  );
  const decor = decorRules[0] ?? null;

  const otherRows = findRules(sourceRows, (row) => row.category_key === "OTHER");
  const other = otherRows[0] ?? null;

  return { material, size, sizeRules, colorPlating, colorPlatingRules, decor, decorRules, other, otherRows };
};

export const computeOptionLaborBuckets = (rows, context, options = {}) => {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const matched = resolveOptionLaborRuleMatches(sourceRows, context);
  const sizeRules = Array.isArray(matched.sizeRules) ? matched.sizeRules : (matched.size ? [matched.size] : []);
  const materialCode = normalizeMaterialScopeCode(context?.materialCode);
  const colorPlatingRules = Array.isArray(matched.colorPlatingRules)
    ? matched.colorPlatingRules
    : (matched.colorPlating ? [matched.colorPlating] : []);
  const decorRules = Array.isArray(matched.decorRules) ? matched.decorRules : (matched.decor ? [matched.decor] : []);
  const material = 0;
  const hasExplicitSizeMode = sizeRules.some((row) => String(row?.size_price_mode ?? '').trim().length > 0 || row?.fixed_delta_krw != null);
  const resolvedSizeCell = hasExplicitSizeMode
    ? (options?.persistedSizeLookup
      ? resolvePersistedSizeGridCell({
        lookup: options.persistedSizeLookup,
        materialCode,
        additionalWeightG: context?.additionalWeightG,
      })
      : resolveMarketLinkedSizeCell({
        rows: sourceRows,
        masterItemId: options?.masterItemId ?? null,
        externalProductNo: options?.externalProductNo ?? null,
        materialCode,
        additionalWeightG: context?.additionalWeightG,
        marketContext: options?.marketContext ?? null,
      }))
    : null;
  const size = resolvedSizeCell
    ? (resolvedSizeCell.valid ? Math.round(resolvedSizeCell.computed_delta_krw ?? 0) : 0)
    : sizeRules.reduce((sum, row) => sum + normalizeKrwInteger(row.additive_delta_krw, 0), 0);
  const colorPlating = colorPlatingRules.reduce((sum, row) => sum + normalizeKrwInteger(row.additive_delta_krw, 0), 0);
  const decor = decorRules.reduce((sum, row) => {
    return sum + normalizeKrwInteger(row.base_labor_cost_krw, 0) + normalizeKrwInteger(row.additive_delta_krw, 0);
  }, 0);
  const other = Array.isArray(matched.otherRows)
    ? matched.otherRows.reduce((sum, row) => sum + normalizeKrwInteger(row.additive_delta_krw, 0), 0)
    : (matched.other ? normalizeKrwInteger(matched.other.additive_delta_krw, 0) : 0);
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
