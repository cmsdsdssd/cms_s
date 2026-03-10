import { getMaterialFactor, normalizeMaterialCode } from "../material-factors.ts";

const toTrimmed = (value) => String(value ?? "").trim();
const toUpper = (value) => toTrimmed(value).toUpperCase();
const toFiniteNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const normalizeWeightCentigram = (value) => {
  const n = toFiniteNumber(value);
  if (n === null) return null;
  const centigram = Math.round(n * 100);
  if (centigram < 0 || centigram > 10000) return null;
  return centigram;
};

const centigramToWeight = (centigram) => Number((Number(centigram) / 100).toFixed(2));
const centigramToWeightString = (centigram) => centigramToWeight(centigram).toFixed(2);
const UNIVERSAL_SIZE_MAX_CENTIGRAM = 10000;


export const SIZE_PRICE_MODE = Object.freeze({
  MARKET_LINKED: "MARKET_LINKED",
  FIXED_DELTA: "FIXED_DELTA",
  LEGACY_ADDITIVE: "LEGACY_ADDITIVE",
});

export const SIZE_ROUNDING_MODE = Object.freeze({
  UP: "UP",
  NEAREST: "NEAREST",
  DOWN: "DOWN",
});

export const normalizeSizePriceMode = (value) => {
  const normalized = toUpper(value);
  if (normalized === SIZE_PRICE_MODE.MARKET_LINKED) return SIZE_PRICE_MODE.MARKET_LINKED;
  if (normalized === SIZE_PRICE_MODE.FIXED_DELTA) return SIZE_PRICE_MODE.FIXED_DELTA;
  return null;
};

export const normalizeSizeRoundingMode = (value) => {
  const normalized = toUpper(value);
  if (normalized === "CEIL" || normalized === SIZE_ROUNDING_MODE.UP) return SIZE_ROUNDING_MODE.UP;
  if (normalized === "ROUND" || normalized === SIZE_ROUNDING_MODE.NEAREST) return SIZE_ROUNDING_MODE.NEAREST;
  if (normalized === "FLOOR" || normalized === SIZE_ROUNDING_MODE.DOWN) return SIZE_ROUNDING_MODE.DOWN;
  return SIZE_ROUNDING_MODE.UP;
};

export const roundSizeDeltaKrw = (value, unit = 100, mode = SIZE_ROUNDING_MODE.UP) => {
  const amount = Number(value);
  const safeUnit = Number.isFinite(Number(unit)) && Number(unit) > 0 ? Math.round(Number(unit)) : 1;
  if (!Number.isFinite(amount)) return 0;
  const q = amount / safeUnit;
  if (mode === SIZE_ROUNDING_MODE.DOWN) return Math.floor(q) * safeUnit;
  if (mode === SIZE_ROUNDING_MODE.NEAREST) return Math.round(q) * safeUnit;
  return Math.ceil(q) * safeUnit;
};

const normalizeRuleRow = (raw) => {
  const categoryKey = toUpper(raw?.category_key ?? raw?.rule_type);
  if (categoryKey !== "SIZE") return null;
  const exactCentigram = normalizeWeightCentigram(raw?.additional_weight_g ?? raw?.weight_g ?? raw?.additional_weight_centigram != null ? Number(raw?.additional_weight_centigram) / 100 : null);
  const minCentigram = raw?.additional_weight_min_centigram != null
    ? Number(raw.additional_weight_min_centigram)
    : raw?.weight_min_centigram != null
      ? Number(raw.weight_min_centigram)
      : normalizeWeightCentigram(raw?.additional_weight_min_g ?? raw?.weight_min_g ?? raw?.additional_weight_g ?? raw?.weight_g);
  const maxCentigram = raw?.additional_weight_max_centigram != null
    ? Number(raw.additional_weight_max_centigram)
    : raw?.weight_max_centigram != null
      ? Number(raw.weight_max_centigram)
      : normalizeWeightCentigram(raw?.additional_weight_max_g ?? raw?.weight_max_g ?? raw?.additional_weight_g ?? raw?.weight_g);
  return {
    rule_id: toTrimmed(raw?.rule_id),
    channel_id: toTrimmed(raw?.channel_id),
    master_item_id: toTrimmed(raw?.master_item_id),
    external_product_no: toTrimmed(raw?.external_product_no),
    category_key: "SIZE",
    scope_material_code: normalizeMaterialCode(raw?.scope_material_code ?? raw?.material_code),
    additional_weight_centigram: exactCentigram,
    additional_weight_min_centigram: minCentigram,
    additional_weight_max_centigram: maxCentigram,
    size_price_mode: normalizeSizePriceMode(raw?.size_price_mode),
    fixed_delta_krw: toFiniteNumber(raw?.fixed_delta_krw),
    additive_delta_krw: Number.isFinite(Number(raw?.additive_delta_krw ?? raw?.delta_krw)) ? Math.round(Number(raw?.additive_delta_krw ?? raw?.delta_krw)) : 0,
    formula_multiplier: Number.isFinite(Number(raw?.formula_multiplier)) && Number(raw?.formula_multiplier) > 0 ? Number(raw?.formula_multiplier) : 1,
    formula_offset_krw: Number.isFinite(Number(raw?.formula_offset_krw)) ? Number(raw?.formula_offset_krw) : 0,
    rounding_unit_krw: Number.isFinite(Number(raw?.rounding_unit_krw)) && Number(raw?.rounding_unit_krw) > 0 ? Math.round(Number(raw?.rounding_unit_krw)) : 100,
    rounding_mode: normalizeSizeRoundingMode(raw?.rounding_mode),
    is_active: raw?.is_active !== false,
  };
};

const isRuleMatched = (row, materialCode, additionalWeightCentigram) => (
  row
  && row.is_active
  && row.scope_material_code === normalizeMaterialCode(materialCode)
  && Number.isFinite(row.additional_weight_min_centigram)
  && Number.isFinite(row.additional_weight_max_centigram)
  && additionalWeightCentigram >= row.additional_weight_min_centigram
  && additionalWeightCentigram <= row.additional_weight_max_centigram
);

const resolveScopedRows = (rows, masterItemId, externalProductNo, materialCode = null) => {
  const masterId = toTrimmed(masterItemId);
  const productNo = toTrimmed(externalProductNo);
  const normalizedMaterialCode = normalizeMaterialCode(materialCode);
  const normalized = (Array.isArray(rows) ? rows : [])
    .map((row) => normalizeRuleRow(row))
    .filter((row) => row && row.is_active && (!masterId || row.master_item_id === masterId));
  const materialRows = normalizedMaterialCode
    ? normalized.filter((row) => row.scope_material_code === normalizedMaterialCode)
    : normalized;
  const scopedRows = productNo ? materialRows.filter((row) => row.external_product_no === productNo) : [];
  if (scopedRows.length > 0) return { rows: scopedRows, scope_source: "PRODUCT_SCOPED" };
  return { rows: materialRows, scope_source: "MASTER_FALLBACK" };
};

const resolveTickForMaterial = (materialCode, marketContext) => {
  const factors = marketContext?.materialFactors ?? null;
  const normalizedCode = normalizeMaterialCode(materialCode);
  const factorRow = factors?.[normalizedCode] ?? null;
  const basis = String(factorRow?.price_basis ?? "").trim().toUpperCase();
  if (basis === "NONE") {
    return { tick_krw_per_g: 0, price_basis: "NONE" };
  }
  if (basis === "SILVER") {
    return { tick_krw_per_g: Math.round(Number(marketContext?.silverTickKrwPerG ?? 0)), price_basis: "SILVER" };
  }
  return { tick_krw_per_g: Math.round(Number(marketContext?.goldTickKrwPerG ?? 0)), price_basis: "GOLD" };
};

const computeMarketLinkedDelta = (row, materialCode, additionalWeightG, marketContext) => {
  const normalizedCode = normalizeMaterialCode(materialCode);
  const factorResult = getMaterialFactor({ materialCode: normalizedCode, factors: marketContext?.materialFactors ?? null });
  const tickDecision = resolveTickForMaterial(normalizedCode, marketContext);
  if (tickDecision.price_basis === "NONE") {
    return { valid: false, error_message: `price basis NONE for ${normalizedCode}` };
  }
  if (!(factorResult.purityRate > 0) || !(factorResult.adjustApplied > 0)) {
    return { valid: false, error_message: `material factor missing for ${normalizedCode}` };
  }
  if (!(tickDecision.tick_krw_per_g > 0)) {
    return { valid: false, error_message: `market tick missing for ${normalizedCode}` };
  }
  const extraMultiplier = Number.isFinite(Number(marketContext?.factorMultiplierByMaterialCode?.[normalizedCode]))
    ? Number(marketContext.factorMultiplierByMaterialCode[normalizedCode])
    : 1;
  const rawDelta = Number(additionalWeightG) * tickDecision.tick_krw_per_g * factorResult.effectiveFactor * row.formula_multiplier * extraMultiplier;
  const withOffset = rawDelta + row.formula_offset_krw;
  return {
    valid: true,
    computed_delta_krw: roundSizeDeltaKrw(withOffset, row.rounding_unit_krw, row.rounding_mode),
    snapshots: {
      price_basis_resolved: tickDecision.price_basis,
      effective_tick_krw_g: tickDecision.tick_krw_per_g,
      purity_rate_resolved: factorResult.purityRate,
      adjust_factor_resolved: factorResult.adjustApplied,
      factor_multiplier_applied: extraMultiplier,
      formula_multiplier_applied: row.formula_multiplier,
      formula_offset_krw_applied: row.formula_offset_krw,
      rounding_unit_krw_applied: row.rounding_unit_krw,
      rounding_mode_applied: row.rounding_mode,
    },
  };
};

export const resolveMarketLinkedSizeCell = ({
  rows,
  masterItemId,
  externalProductNo,
  materialCode,
  additionalWeightG,
  marketContext,
}) => {
  const additionalWeightCentigram = normalizeWeightCentigram(additionalWeightG);
  const normalizedMaterialCode = normalizeMaterialCode(materialCode);
  const scoped = resolveScopedRows(rows, masterItemId, externalProductNo, materialCode);
  if (!normalizedMaterialCode) {
    return { valid: false, computed_delta_krw: 0, source_rule_id: null, source_rule_ids: [], scope_source: scoped.scope_source, mode: null, error_message: 'material code missing' };
  }
  if (additionalWeightCentigram === null) {
    return { valid: false, computed_delta_krw: 0, source_rule_id: null, source_rule_ids: [], scope_source: scoped.scope_source, mode: null, error_message: 'additional weight invalid' };
  }
  if (additionalWeightCentigram === 0) {
    return { valid: true, computed_delta_krw: 0, source_rule_id: null, source_rule_ids: [], scope_source: scoped.scope_source, mode: null, error_message: null };
  }
  const matched = scoped.rows.filter((row) => isRuleMatched(row, normalizedMaterialCode, additionalWeightCentigram));
  if (matched.length === 0) {
    return { valid: false, computed_delta_krw: 0, source_rule_id: null, source_rule_ids: [], scope_source: scoped.scope_source, mode: null, error_message: 'size rule not found' };
  }
  const explicitModeRows = matched.filter((row) => row.size_price_mode !== null);
  if (explicitModeRows.length > 1) {
    return {
      valid: false,
      computed_delta_krw: 0,
      source_rule_id: null,
      source_rule_ids: explicitModeRows.map((row) => row.rule_id).filter(Boolean),
      scope_source: scoped.scope_source,
      mode: null,
      error_message: 'multiple active SIZE rows matched the same weight cell',
    };
  }
  if (explicitModeRows.length === 1) {
    const row = explicitModeRows[0];
    if (row.size_price_mode === SIZE_PRICE_MODE.FIXED_DELTA) {
      return {
        valid: true,
        computed_delta_krw: Math.round(row.fixed_delta_krw ?? row.additive_delta_krw ?? 0),
        source_rule_id: row.rule_id || null,
        source_rule_ids: row.rule_id ? [row.rule_id] : [],
        scope_source: scoped.scope_source,
        mode: SIZE_PRICE_MODE.FIXED_DELTA,
        error_message: null,
      };
    }
    const computed = computeMarketLinkedDelta(row, normalizedMaterialCode, additionalWeightCentigram / 100, marketContext);
    return {
      valid: computed.valid,
      computed_delta_krw: computed.valid ? Math.round(computed.computed_delta_krw ?? 0) : 0,
      source_rule_id: row.rule_id || null,
      source_rule_ids: row.rule_id ? [row.rule_id] : [],
      scope_source: scoped.scope_source,
      mode: SIZE_PRICE_MODE.MARKET_LINKED,
      error_message: computed.valid ? null : computed.error_message ?? 'market-linked size computation failed',
      ...(computed.valid ? computed.snapshots : {}),
    };
  }
  return {
    valid: true,
    computed_delta_krw: matched.reduce((sum, row) => sum + Math.round(row.additive_delta_krw ?? 0), 0),
    source_rule_id: matched[0]?.rule_id || null,
    source_rule_ids: matched.map((row) => row.rule_id).filter(Boolean),
    scope_source: scoped.scope_source,
    mode: SIZE_PRICE_MODE.LEGACY_ADDITIVE,
    error_message: null,
  };
};

export const buildMarketLinkedSizeGrid = ({
  rows,
  masterItemId,
  externalProductNo,
  materialCode,
  marketContext,
}) => {
  const scoped = resolveScopedRows(rows, masterItemId, externalProductNo, materialCode);
  const normalizedMaterialCode = normalizeMaterialCode(materialCode);
  const relevantRows = scoped.rows.filter((row) => row.scope_material_code === normalizedMaterialCode);
  const hasRelevantRows = relevantRows.length > 0;
  const cells = Array.from({ length: UNIVERSAL_SIZE_MAX_CENTIGRAM + 1 }, (_, centigram) => {
    const resolved = hasRelevantRows
      ? resolveMarketLinkedSizeCell({
          rows,
          masterItemId,
          externalProductNo,
          materialCode: normalizedMaterialCode,
          additionalWeightG: centigram / 100,
          marketContext,
        })
      : {
          valid: false,
          computed_delta_krw: 0,
          source_rule_id: null,
          source_rule_ids: [],
          scope_source: scoped.scope_source,
          mode: null,
          error_message: "size rule not found",
        };
    return {
      weight_g: centigramToWeight(centigram),
      weight_value: centigramToWeightString(centigram),
      ...resolved,
    };
  });
  return {
    material_code: normalizedMaterialCode,
    scope_source: scoped.scope_source,
    cells,
  };
};
