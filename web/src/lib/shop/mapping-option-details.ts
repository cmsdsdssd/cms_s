import { normalizeMaterialCode } from "@/lib/material-factors";
import {
  normalizeAdditionalWeightValue,
  normalizeDecorationCode,
  type OptionLaborRuleRow,
} from "@/lib/shop/option-labor-rules";
import { resolveCentralOptionMapping } from "@/lib/shop/channel-option-central-control.js";
import { normalizePlatingComboCode } from "@/lib/shop/sync-rules";

export type OptionDetailCategory = "MATERIAL" | "SIZE" | "COLOR_PLATING" | "DECOR";

export type MappingOptionAxis = {
  name: string;
  value: string;
};

export type MappingOptionSelection = {
  option_material_code: string | null;
  option_color_code: string | null;
  option_decoration_code: string | null;
  option_size_value: number | null;
};

export type MappingOptionAllowlistChoice = {
  value: string;
  label: string;
};

export type MappingOptionDecorChoice = MappingOptionAllowlistChoice & {
  decoration_master_id: string | null;
  decoration_model_name: string | null;
};

export type MappingOptionAllowlist = {
  materials: MappingOptionAllowlistChoice[];
  colors: MappingOptionAllowlistChoice[];
  decors: MappingOptionDecorChoice[];
  sizes_by_material: Record<string, MappingOptionAllowlistChoice[]>;
  is_empty: boolean;
};

export type SavedOptionCategoryRow = {
  option_name: string;
  option_value: string;
  category_key: "MATERIAL" | "SIZE" | "COLOR_PLATING" | "DECOR" | "OTHER" | "NOTICE";
};

export type SavedOptionCategoryRowWithDelta = SavedOptionCategoryRow & {
  sync_delta_krw?: number | null;
};

export type MappingOptionEntryRow = {
  option_name: string;
  option_value: string;
  axis_index: number;
  entry_key: string;
};

export type MappingCanonicalOptionRow = MappingOptionEntryRow & {
  category_key: SavedOptionCategoryRow["category_key"];
  resolved_category_key: "MATERIAL" | "SIZE" | "COLOR" | "DECOR" | "OTHER" | "NOTICE";
  sync_delta_krw_legacy: number;
  resolved_delta_krw: number;
  legacy_status: "VALID" | "LEGACY_OUT_OF_RANGE" | "UNRESOLVED";
  warnings: string[];
  source_rule_entry_ids: string[];
  material_code_resolved: string | null;
  material_label_resolved: string | null;
  size_weight_g_selected: number | null;
  color_code_selected: string | null;
  decor_master_item_id_selected: string | null;
  decor_model_name_selected: string | null;
  decor_material_code_snapshot: string | null;
  decor_weight_g_snapshot: number | null;
  decor_total_labor_cost_snapshot: number | null;
  other_delta_krw: number | null;
  other_reason: string | null;
  decor_extra_delta_krw: number | null;
  decor_final_amount_krw: number | null;
  notice_value_selected: string | null;
};

export type MappingOptionPrefillResult = MappingOptionSelection & {
  sources: Record<keyof MappingOptionSelection, "existing" | "classified" | "heuristic" | "empty">;
};

export type MappingOptionValidationResult =
  | { ok: true; value: MappingOptionSelection }
  | { ok: false; errors: string[]; value: MappingOptionSelection };

type NormalizedSelection = {
  option_material_code: string | null;
  option_color_code: string | null;
  option_decoration_code: string | null;
  option_size_value: string | null;
};

const EMPTY_ALLOWLIST: MappingOptionAllowlist = {
  materials: [],
  colors: [],
  decors: [],
  sizes_by_material: {},
  is_empty: true,
};

const toTrimmed = (value: unknown): string => String(value ?? "").trim();

const toRoundedOrNull = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

const normalizeOptionValue = (value: unknown): string =>
  toTrimmed(value).replace(/\s*\([+-][\d,]+원\)\s*$/u, "").trim();

export const normalizeMappingOptionValue = normalizeOptionValue;

export const mappingOptionEntryKey = (optionName: unknown, optionValue: unknown): string => {
  const normalizedName = toTrimmed(optionName);
  const normalizedValue = normalizeOptionValue(optionValue);
  return normalizedName && normalizedValue ? `${normalizedName}::${normalizedValue}` : "";
};

const weightStringToCentigram = (value: string | null): number | null => {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric * 100);
};

const normalizeMaterialSelection = (value: unknown): string | null => {
  const normalized = normalizeMaterialCode(toTrimmed(value));
  return normalized && normalized !== "00" ? normalized : null;
};

const normalizeColorSelection = (value: unknown): string | null => {
  const normalized = normalizePlatingComboCode(toTrimmed(value));
  return normalized || null;
};

const normalizeDecorSelection = (value: unknown): string | null => {
  return normalizeDecorationCode(toTrimmed(value));
};

const normalizeSizeSelection = (value: unknown): string | null => {
  const trimmed = toTrimmed(value);
  if (!trimmed) return null;
  const exact = normalizeAdditionalWeightValue(trimmed);
  if (exact) return exact;
  const match = trimmed.match(/\d+(?:\.\d+)?/);
  return match ? normalizeAdditionalWeightValue(match[0]) : null;
};

export const guessMappingOptionCategoryByName = (
  value: unknown,
): SavedOptionCategoryRow["category_key"] => {
  const normalized = toTrimmed(value).toLowerCase();
  if (!normalized) return "OTHER";
  if (/(재질|소재|material|금종|함량)/u.test(normalized)) return "MATERIAL";
  if (/(사이즈|size|호수|중량|weight|폭|길이)/u.test(normalized)) return "SIZE";
  if (/(색상|color|컬러|도금|plating)/u.test(normalized)) return "COLOR_PLATING";
  if (/(장식|decor|스톤|보석|팬던트|참)/u.test(normalized)) return "DECOR";
  if (/(공지|notice|안내|배송|유의)/u.test(normalized)) return "NOTICE";
  return "OTHER";
};

const normalizeSelection = (value: Partial<MappingOptionSelection> | null | undefined): NormalizedSelection => ({
  option_material_code: normalizeMaterialSelection(value?.option_material_code),
  option_color_code: normalizeColorSelection(value?.option_color_code),
  option_decoration_code: normalizeDecorSelection(value?.option_decoration_code),
  option_size_value: normalizeSizeSelection(value?.option_size_value),
});

const toSelection = (value: NormalizedSelection): MappingOptionSelection => ({
  option_material_code: value.option_material_code,
  option_color_code: value.option_color_code,
  option_decoration_code: value.option_decoration_code,
  option_size_value: value.option_size_value == null ? null : Number(value.option_size_value),
});

const buildCategoryMap = (rows: SavedOptionCategoryRow[]): Map<string, SavedOptionCategoryRow["category_key"]> => {
  const map = new Map<string, SavedOptionCategoryRow["category_key"]>();
  for (const row of rows ?? []) {
    const optionName = toTrimmed(row.option_name);
    const optionValue = normalizeOptionValue(row.option_value);
    if (!optionName || !optionValue) continue;
    map.set(mappingOptionEntryKey(optionName, optionValue), row.category_key);
  }
  return map;
};

const buildSizeSetByMaterial = (allowlist: MappingOptionAllowlist): Map<string, Set<string>> => {
  const map = new Map<string, Set<string>>();
  for (const [materialCode, rows] of Object.entries(allowlist.sizes_by_material ?? {})) {
    map.set(materialCode, new Set(rows.map((row) => row.value)));
  }
  return map;
};

const categoryKeyForAxis = (
  axis: MappingOptionAxis,
  categoryMap: Map<string, SavedOptionCategoryRow["category_key"]>,
): SavedOptionCategoryRow["category_key"] | null => {
  return categoryMap.get(mappingOptionEntryKey(axis.name, axis.value)) ?? null;
};

export const buildMappingOptionEntries = (args: {
  productOptions?: Array<{ option_name?: string | null; option_value?: Array<{ option_text?: string | null }> | null }>;
  variants?: Array<{ options?: Array<{ name?: string | null; value?: string | null }> | null }>;
}): MappingOptionEntryRow[] => {
  const next = new Map<string, MappingOptionEntryRow>();
  const axisIndexByName = new Map<string, number>();

  (args.productOptions ?? []).forEach((option, index) => {
    const optionName = toTrimmed(option.option_name);
    if (optionName && !axisIndexByName.has(optionName)) axisIndexByName.set(optionName, index);
  });
  (args.variants ?? []).forEach((variant) => {
    (variant.options ?? []).forEach((option, index) => {
      const optionName = toTrimmed(option.name);
      if (optionName && !axisIndexByName.has(optionName)) axisIndexByName.set(optionName, index);
    });
  });

  const register = (optionNameRaw: unknown, optionValueRaw: unknown, axisIndexRaw?: number | null) => {
    const optionName = toTrimmed(optionNameRaw);
    const optionValue = normalizeOptionValue(optionValueRaw);
    const entryKey = mappingOptionEntryKey(optionName, optionValue);
    if (!entryKey) return;
    const axisIndex = Number.isInteger(axisIndexRaw) && Number(axisIndexRaw) >= 0
      ? Number(axisIndexRaw)
      : (axisIndexByName.get(optionName) ?? Number.MAX_SAFE_INTEGER);
    const existing = next.get(entryKey);
    if (!existing || axisIndex < existing.axis_index) {
      next.set(entryKey, {
        option_name: optionName,
        option_value: optionValue,
        axis_index: axisIndex,
        entry_key: entryKey,
      });
    }
  };

  (args.productOptions ?? []).forEach((option, index) => {
    const optionName = toTrimmed(option.option_name);
    (option.option_value ?? []).forEach((value) => register(optionName, value?.option_text, index));
  });
  (args.variants ?? []).forEach((variant) => {
    (variant.options ?? []).forEach((option, index) => register(option.name, option.value, index));
  });

  return Array.from(next.values()).sort((a, b) => {
    if (a.axis_index !== b.axis_index) return a.axis_index - b.axis_index;
    const nameCompare = a.option_name.localeCompare(b.option_name, "ko");
    if (nameCompare !== 0) return nameCompare;
    return a.option_value.localeCompare(b.option_value, "ko");
  });
};

const buildSavedCategoryIndexes = (rows: SavedOptionCategoryRowWithDelta[]) => {
  const byEntryKey = new Map<string, SavedOptionCategoryRowWithDelta>();
  const byOptionName = new Map<string, SavedOptionCategoryRow["category_key"]>();
  for (const row of rows ?? []) {
    const entryKey = mappingOptionEntryKey(row.option_name, row.option_value);
    if (entryKey && !byEntryKey.has(entryKey)) byEntryKey.set(entryKey, row);
    const optionName = toTrimmed(row.option_name);
    if (optionName && !byOptionName.has(optionName)) byOptionName.set(optionName, row.category_key);
  }
  return { byEntryKey, byOptionName };
};

const findDecorRuleForOptionValue = (
  optionValue: string,
  rules: Array<Partial<OptionLaborRuleRow> | null | undefined>,
): Partial<OptionLaborRuleRow> | null => {
  const trimmed = toTrimmed(optionValue);
  const normalizedDecor = normalizeDecorSelection(trimmed);
  const activeRows = (rules ?? []).filter((rule) => rule && rule.is_active !== false && rule.category_key === "DECOR");

  const byMasterId = activeRows.filter((rule) => toTrimmed(rule?.decoration_master_id) === trimmed);
  if (byMasterId.length === 1) return byMasterId[0] ?? null;

  if (!normalizedDecor) return null;
  const byModelName = activeRows.filter((rule) => {
    return normalizeDecorSelection(rule?.decoration_model_name) === normalizedDecor;
  });
  return byModelName.length === 1 ? (byModelName[0] ?? null) : null;
};

export const buildCanonicalOptionRows = (args: {
  productOptions?: Array<{ option_name?: string | null; option_value?: Array<{ option_text?: string | null }> | null }>;
  variants?: Array<{ options?: Array<{ name?: string | null; value?: string | null }> | null }>;
  savedOptionCategories?: SavedOptionCategoryRowWithDelta[];
  rules?: Array<Partial<OptionLaborRuleRow> | null | undefined>;
  masterMaterialCode?: string | null;
  masterMaterialLabel?: string | null;
  otherReasonByEntryKey?: Record<string, string | null | undefined>;
  categoryOverrideByEntryKey?: Record<string, SavedOptionCategoryRow["category_key"] | null | undefined>;
  axisSelectionByEntryKey?: Record<string, {
    axis1_value?: string | null | undefined;
    axis2_value?: string | null | undefined;
    axis3_value?: string | null | undefined;
    decor_master_item_id?: string | null | undefined;
    decor_extra_delta_krw?: number | null | undefined;
    decor_final_amount_krw?: number | null | undefined;
  } | null | undefined>;
}): MappingCanonicalOptionRow[] => {
  const entries = buildMappingOptionEntries({
    productOptions: args.productOptions,
    variants: args.variants,
  });
  const { byEntryKey, byOptionName } = buildSavedCategoryIndexes(args.savedOptionCategories ?? []);

  return entries.map((entry) => {
    const saved = byEntryKey.get(entry.entry_key);
    const categoryOverride = args.categoryOverrideByEntryKey?.[entry.entry_key] ?? null;
    const categoryKey = categoryOverride
      ?? saved?.category_key
      ?? byOptionName.get(entry.option_name)
      ?? guessMappingOptionCategoryByName(entry.option_name);
    const legacyDelta = Math.round(Number(saved?.sync_delta_krw ?? 0));
    const persisted: Record<string, unknown> = {
      resolved_delta_krw: legacyDelta,
    };

    if (categoryKey === "SIZE") {
      const axisSelection = args.axisSelectionByEntryKey?.[entry.entry_key] ?? null;
      const axisMaterial = normalizeMaterialSelection(axisSelection?.axis1_value);
      const normalizedSize = normalizeSizeSelection(axisSelection?.axis2_value ?? entry.option_value);
      if (axisMaterial) {
        persisted.material_code_resolved = axisMaterial;
        persisted.material_label_resolved = axisMaterial;
      }
      persisted.size_weight_g_selected = normalizedSize == null ? null : Number(normalizedSize);
    } else if (categoryKey === "COLOR_PLATING") {
      const axisSelection = args.axisSelectionByEntryKey?.[entry.entry_key] ?? null;
      const axisMaterial = normalizeMaterialSelection(axisSelection?.axis1_value);
      if (axisMaterial) {
        persisted.material_code_resolved = axisMaterial;
        persisted.material_label_resolved = axisMaterial;
      }
      persisted.color_code_selected = normalizeColorSelection(axisSelection?.axis2_value ?? entry.option_value);
      const resolvedColorDeltaKrw = toRoundedOrNull(axisSelection?.axis3_value);
      if (resolvedColorDeltaKrw != null) {
        persisted.resolved_delta_krw = resolvedColorDeltaKrw;
      }
    } else if (categoryKey === "DECOR") {
      const axisSelection = args.axisSelectionByEntryKey?.[entry.entry_key] ?? null;
      const forcedDecorMasterId = toTrimmed(axisSelection?.decor_master_item_id) || null;
      const matchedDecorRule = forcedDecorMasterId
        ? ((args.rules ?? []).find((rule) => toTrimmed(rule?.decoration_master_id) === forcedDecorMasterId && rule?.is_active !== false && rule?.category_key === "DECOR") ?? null)
        : findDecorRuleForOptionValue(entry.option_value, args.rules ?? []);
      const axisDecorMaterial = normalizeMaterialSelection(axisSelection?.axis1_value);
      const axisDecorFinalAmount = toRoundedOrNull(axisSelection?.axis3_value);
      const axisDecorExtraDelta = axisDecorFinalAmount == null
        ? null
        : Math.round(Number(axisDecorFinalAmount) - Number(matchedDecorRule?.base_labor_cost_krw ?? 0));
      persisted.decor_master_item_id_selected = forcedDecorMasterId || toTrimmed(matchedDecorRule?.decoration_master_id) || null;
      persisted.decor_model_name_selected = toTrimmed(matchedDecorRule?.decoration_model_name) || toTrimmed(axisSelection?.axis2_value) || toTrimmed(axisSelection?.axis1_value) || null;
      persisted.decor_material_code_snapshot = axisDecorMaterial || toTrimmed(matchedDecorRule?.scope_material_code) || null;
      persisted.decor_weight_g_snapshot = matchedDecorRule?.additional_weight_g ?? null;
      persisted.decor_total_labor_cost_snapshot = matchedDecorRule?.base_labor_cost_krw ?? null;
      persisted.decor_extra_delta_krw = axisSelection?.decor_extra_delta_krw ?? axisDecorExtraDelta ?? matchedDecorRule?.additive_delta_krw ?? null;
      persisted.decor_final_amount_krw = axisSelection?.decor_final_amount_krw ?? axisDecorFinalAmount ?? null;
    } else if (categoryKey === "OTHER") {
      const axisSelection = args.axisSelectionByEntryKey?.[entry.entry_key] ?? null;
      const axisReason = toTrimmed(axisSelection?.axis2_value ?? axisSelection?.axis1_value);
      persisted.other_delta_krw = legacyDelta;
      persisted.other_reason = axisReason || toTrimmed(args.otherReasonByEntryKey?.[entry.entry_key]) || null;
    } else if (categoryKey === "NOTICE") {
      const axisSelection = args.axisSelectionByEntryKey?.[entry.entry_key] ?? null;
      persisted.notice_value_selected = toTrimmed(axisSelection?.axis1_value) || toTrimmed(entry.option_value) || null;
      persisted.resolved_delta_krw = 0;
    }

    const resolved = resolveCentralOptionMapping({
      category: categoryKey,
      masterMaterialCode: args.masterMaterialCode ?? null,
      masterMaterialLabel: args.masterMaterialLabel ?? null,
      rules: args.rules ?? [],
      persisted,
    }) as {
      category: "MATERIAL" | "SIZE" | "COLOR" | "DECOR" | "OTHER" | "NOTICE";
      material_code_resolved: string | null;
      material_label_resolved: string | null;
      size_weight_g_selected: number | null;
      color_code_selected: string | null;
      decor_master_item_id_selected: string | null;
      decor_model_name_selected: string | null;
      decor_material_code_snapshot: string | null;
      decor_weight_g_snapshot: number | null;
      decor_total_labor_cost_snapshot: number | null;
      other_delta_krw: number | null;
      other_reason: string | null;
      decor_extra_delta_krw: number | null;
      decor_final_amount_krw: number | null;
      notice_value_selected: string | null;
      resolved_delta_krw: number;
      source_rule_entry_ids: string[];
      legacy_status: "VALID" | "LEGACY_OUT_OF_RANGE" | "UNRESOLVED";
      warnings: string[];
    };

    return {
      ...entry,
      category_key: categoryKey,
      resolved_category_key: resolved.category,
      sync_delta_krw_legacy: legacyDelta,
      resolved_delta_krw: Math.round(Number(resolved.resolved_delta_krw ?? legacyDelta)),
      legacy_status: resolved.legacy_status,
      warnings: Array.isArray(resolved.warnings) ? resolved.warnings : [],
      source_rule_entry_ids: Array.isArray(resolved.source_rule_entry_ids) ? resolved.source_rule_entry_ids : [],
      material_code_resolved: resolved.material_code_resolved,
      material_label_resolved: resolved.material_label_resolved,
      size_weight_g_selected: resolved.size_weight_g_selected,
      color_code_selected: resolved.color_code_selected,
      decor_master_item_id_selected: resolved.decor_master_item_id_selected,
      decor_model_name_selected: resolved.decor_model_name_selected,
      decor_material_code_snapshot: resolved.decor_material_code_snapshot,
      decor_weight_g_snapshot: resolved.decor_weight_g_snapshot,
      decor_total_labor_cost_snapshot: resolved.decor_total_labor_cost_snapshot,
      other_delta_krw: resolved.other_delta_krw,
      other_reason: resolved.other_reason,
      decor_extra_delta_krw: resolved.decor_extra_delta_krw,
      decor_final_amount_krw: resolved.decor_final_amount_krw,
      notice_value_selected: resolved.notice_value_selected,
    };
  });
};

const maybePickMaterialFromAxes = (
  axes: MappingOptionAxis[],
  allowlist: MappingOptionAllowlist,
  categoryMap: Map<string, SavedOptionCategoryRow["category_key"]>,
  classifiedOnly: boolean,
): string | null => {
  const allowed = new Set(allowlist.materials.map((row) => row.value));
  for (const axis of axes) {
    const categoryKey = categoryKeyForAxis(axis, categoryMap);
    if (classifiedOnly && categoryKey !== "MATERIAL") continue;
    if (!classifiedOnly && categoryKey && categoryKey !== "MATERIAL") continue;
    const normalized = normalizeMaterialSelection(axis.value);
    if (normalized && allowed.has(normalized)) return normalized;
  }
  return null;
};

const maybePickColorFromAxes = (
  axes: MappingOptionAxis[],
  allowlist: MappingOptionAllowlist,
  categoryMap: Map<string, SavedOptionCategoryRow["category_key"]>,
  classifiedOnly: boolean,
): string | null => {
  const allowed = new Set(allowlist.colors.map((row) => row.value));
  for (const axis of axes) {
    const categoryKey = categoryKeyForAxis(axis, categoryMap);
    if (classifiedOnly && categoryKey !== "COLOR_PLATING") continue;
    if (!classifiedOnly && categoryKey && categoryKey !== "COLOR_PLATING") continue;
    const normalized = normalizeColorSelection(axis.value);
    if (normalized && allowed.has(normalized)) return normalized;
  }
  return null;
};

const maybePickDecorFromAxes = (
  axes: MappingOptionAxis[],
  allowlist: MappingOptionAllowlist,
  categoryMap: Map<string, SavedOptionCategoryRow["category_key"]>,
  classifiedOnly: boolean,
): string | null => {
  const allowed = new Set(allowlist.decors.map((row) => row.value));
  for (const axis of axes) {
    const categoryKey = categoryKeyForAxis(axis, categoryMap);
    if (classifiedOnly && categoryKey !== "DECOR") continue;
    if (!classifiedOnly && categoryKey && categoryKey !== "DECOR") continue;
    const normalized = normalizeDecorSelection(axis.value);
    if (normalized && allowed.has(normalized)) return normalized;
  }
  return null;
};

const maybePickSizeFromAxes = (
  axes: MappingOptionAxis[],
  allowlist: MappingOptionAllowlist,
  categoryMap: Map<string, SavedOptionCategoryRow["category_key"]>,
  classifiedOnly: boolean,
  selectedMaterial: string | null,
): { material: string | null; size: string | null } => {
  const byMaterial = buildSizeSetByMaterial(allowlist);
  for (const axis of axes) {
    const categoryKey = categoryKeyForAxis(axis, categoryMap);
    if (classifiedOnly && categoryKey !== "SIZE") continue;
    if (!classifiedOnly && categoryKey && categoryKey !== "SIZE") continue;
    const normalized = normalizeSizeSelection(axis.value);
    if (!normalized) continue;
    if (selectedMaterial) {
      if (byMaterial.get(selectedMaterial)?.has(normalized)) {
        return { material: selectedMaterial, size: normalized };
      }
      continue;
    }
    const matchedMaterials = Array.from(byMaterial.entries())
      .filter(([, sizeSet]) => sizeSet.has(normalized))
      .map(([materialCode]) => materialCode);
    if (matchedMaterials.length === 1) {
      return { material: matchedMaterials[0] ?? null, size: normalized };
    }
  }
  return { material: selectedMaterial, size: null };
};

export const resolveCanonicalExternalProductNo = (
  activeProductNos: Array<string | null | undefined>,
  requestedExternalProductNo: string,
): string => {
  const requested = toTrimmed(requestedExternalProductNo);
  const activeRows = Array.from(new Set((activeProductNos ?? []).map((row) => toTrimmed(row)).filter(Boolean)));
  if (!requested || activeRows.length === 0) return requested;
  if (activeRows.includes(requested)) return requested;
  return activeRows.find((value) => /^P/i.test(value)) ?? activeRows[0] ?? requested;
};

export const buildMappingOptionAllowlist = (
  rules: Array<Partial<OptionLaborRuleRow> | null | undefined>,
): MappingOptionAllowlist => {
  const materialSet = new Set<string>();
  const colorMap = new Map<string, MappingOptionAllowlistChoice>();
  const decorMap = new Map<string, MappingOptionDecorChoice>();
  const sizeSets = new Map<string, Set<string>>();

  for (const rule of rules ?? []) {
    if (!rule || rule.is_active === false) continue;
    const scopedMaterialCode = normalizeMaterialSelection(rule.scope_material_code);
    if (scopedMaterialCode) {
      materialSet.add(scopedMaterialCode);
      const scopedSizeSet = sizeSets.get(scopedMaterialCode) ?? new Set<string>();
      scopedSizeSet.add("0.00");
      sizeSets.set(scopedMaterialCode, scopedSizeSet);
    }
    if (rule.category_key === "SIZE") {
      const materialCode = scopedMaterialCode;
      const minValue = normalizeSizeSelection(rule.additional_weight_min_g ?? rule.additional_weight_g);
      const maxValue = normalizeSizeSelection(rule.additional_weight_max_g ?? rule.additional_weight_g);
      const minCentigram = weightStringToCentigram(minValue);
      const maxCentigram = weightStringToCentigram(maxValue);
      if (!materialCode || minCentigram == null || maxCentigram == null || minCentigram > maxCentigram) continue;
      materialSet.add(materialCode);
      const sizeSet = sizeSets.get(materialCode) ?? new Set<string>();
      for (let current = minCentigram; current <= maxCentigram; current += 1) {
        sizeSet.add((current / 100).toFixed(2));
      }
      sizeSets.set(materialCode, sizeSet);
      continue;
    }
    if (rule.category_key === "COLOR_PLATING") {
      const colorCode = normalizeColorSelection(rule.color_code);
      if (!colorCode) continue;
      colorMap.set(colorCode, { value: colorCode, label: colorCode });
      continue;
    }
    if (rule.category_key === "DECOR") {
      const decorationCode = normalizeDecorSelection(rule.decoration_model_name);
      const decorationLabel = toTrimmed(rule.decoration_model_name);
      if (!decorationCode || !decorationLabel) continue;
      decorMap.set(decorationCode, {
        value: decorationCode,
        label: decorationLabel,
        decoration_master_id: toTrimmed(rule.decoration_master_id) || null,
        decoration_model_name: decorationLabel,
      });
    }
  }

  const sizes_by_material = Object.fromEntries(
    Array.from(sizeSets.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([materialCode, sizeSet]) => [
        materialCode,
        Array.from(sizeSet)
          .sort((left, right) => Number(left) - Number(right))
          .map((value) => ({ value, label: `${value}g` })),
      ]),
  ) as Record<string, MappingOptionAllowlistChoice[]>;

  const materials = Array.from(materialSet)
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }));
  const colors = Array.from(colorMap.values()).sort((left, right) => left.label.localeCompare(right.label));
  const decors = Array.from(decorMap.values()).sort((left, right) => left.label.localeCompare(right.label));

  return {
    materials,
    colors,
    decors,
    sizes_by_material,
    is_empty: materials.length === 0 && colors.length === 0 && decors.length === 0,
  };
};

export const inferMappingOptionSelection = (args: {
  allowlist: MappingOptionAllowlist;
  axes?: MappingOptionAxis[];
  existing?: Partial<MappingOptionSelection> | null;
  categoryRows?: SavedOptionCategoryRow[];
}): MappingOptionPrefillResult => {
  const allowlist = args.allowlist ?? EMPTY_ALLOWLIST;
  const axes = (args.axes ?? []).map((axis) => ({ name: toTrimmed(axis.name), value: toTrimmed(axis.value) }));
  const existing = normalizeSelection(args.existing);
  const categoryMap = buildCategoryMap(args.categoryRows ?? []);
  const allowedMaterials = new Set(allowlist.materials.map((row) => row.value));
  const allowedColors = new Set(allowlist.colors.map((row) => row.value));
  const allowedDecors = new Set(allowlist.decors.map((row) => row.value));
  const allowedSizes = buildSizeSetByMaterial(allowlist);
  const classifiedMaterial = maybePickMaterialFromAxes(axes, allowlist, categoryMap, true);
  const classifiedColor = maybePickColorFromAxes(axes, allowlist, categoryMap, true);
  const classifiedDecor = maybePickDecorFromAxes(axes, allowlist, categoryMap, true);
  const heuristicMaterial = maybePickMaterialFromAxes(axes, allowlist, categoryMap, false);
  const heuristicColor = maybePickColorFromAxes(axes, allowlist, categoryMap, false);
  const heuristicDecor = maybePickDecorFromAxes(axes, allowlist, categoryMap, false);

  let material = existing.option_material_code;
  let color = existing.option_color_code;
  let decor = existing.option_decoration_code;
  let size = existing.option_size_value;
  const sources: MappingOptionPrefillResult["sources"] = {
    option_material_code: material ? "existing" : "empty",
    option_color_code: color ? "existing" : "empty",
    option_decoration_code: decor ? "existing" : "empty",
    option_size_value: size ? "existing" : "empty",
  };

  const sizeAllowedForMaterial = (materialCode: string | null, sizeValue: string | null): boolean => {
    if (!materialCode || !sizeValue) return false;
    return allowedSizes.get(materialCode)?.has(sizeValue) ?? false;
  };

  const replaceSelection = (
    currentValue: string | null,
    nextValue: string | null,
    source: keyof MappingOptionPrefillResult["sources"],
    nextSource: "classified" | "heuristic",
  ): string | null => {
    if (!nextValue || nextValue === currentValue) return currentValue;
    sources[source] = nextSource;
    return nextValue;
  };

  if (material && !allowedMaterials.has(material)) {
    material = replaceSelection(material, classifiedMaterial, "option_material_code", "classified");
    material = replaceSelection(material, heuristicMaterial, "option_material_code", "heuristic");
  }
  if (color && !allowedColors.has(color)) {
    color = replaceSelection(color, classifiedColor, "option_color_code", "classified");
    color = replaceSelection(color, heuristicColor, "option_color_code", "heuristic");
  }
  if (decor && !allowedDecors.has(decor)) {
    decor = replaceSelection(decor, classifiedDecor, "option_decoration_code", "classified");
    decor = replaceSelection(decor, heuristicDecor, "option_decoration_code", "heuristic");
  }

  if (size && !sizeAllowedForMaterial(material, size)) {
    const classifiedSize = maybePickSizeFromAxes(axes, allowlist, categoryMap, true, classifiedMaterial ?? material);
    const heuristicSize = maybePickSizeFromAxes(
      axes,
      allowlist,
      categoryMap,
      false,
      classifiedSize.material ?? heuristicMaterial ?? material,
    );

    if (classifiedSize.size) {
      if (classifiedSize.material && classifiedSize.material !== material) {
        material = replaceSelection(material, classifiedSize.material, "option_material_code", "classified");
      }
      size = replaceSelection(size, classifiedSize.size, "option_size_value", "classified");
    } else if (heuristicSize.size) {
      if (heuristicSize.material && heuristicSize.material !== material) {
        material = replaceSelection(material, heuristicSize.material, "option_material_code", "heuristic");
      }
      size = replaceSelection(size, heuristicSize.size, "option_size_value", "heuristic");
    }
  }

  if (!material) {
    if (classifiedMaterial) {
      material = classifiedMaterial;
      sources.option_material_code = "classified";
    }
  }
  if (!color) {
    if (classifiedColor) {
      color = classifiedColor;
      sources.option_color_code = "classified";
    }
  }
  if (!decor) {
    if (classifiedDecor) {
      decor = classifiedDecor;
      sources.option_decoration_code = "classified";
    }
  }
  if (!size) {
    const classified = maybePickSizeFromAxes(axes, allowlist, categoryMap, true, material);
    if (!material && classified.material) {
      material = classified.material;
      sources.option_material_code = "classified";
    }
    if (classified.size) {
      size = classified.size;
      sources.option_size_value = "classified";
    }
  }

  if (!material) {
    if (heuristicMaterial) {
      material = heuristicMaterial;
      sources.option_material_code = "heuristic";
    }
  }
  if (!color) {
    if (heuristicColor) {
      color = heuristicColor;
      sources.option_color_code = "heuristic";
    }
  }
  if (!decor) {
    if (heuristicDecor) {
      decor = heuristicDecor;
      sources.option_decoration_code = "heuristic";
    }
  }
  if (!size) {
    const heuristic = maybePickSizeFromAxes(axes, allowlist, categoryMap, false, material);
    if (!material && heuristic.material) {
      material = heuristic.material;
      sources.option_material_code = "heuristic";
    }
    if (heuristic.size) {
      size = heuristic.size;
      sources.option_size_value = "heuristic";
    }
  }

  return {
    ...toSelection({
      option_material_code: material,
      option_color_code: color,
      option_decoration_code: decor,
      option_size_value: size,
    }),
    sources,
  };
};

export const validateMappingOptionSelection = (args: {
  allowlist: MappingOptionAllowlist;
  current: Partial<MappingOptionSelection> | null | undefined;
  previous?: Partial<MappingOptionSelection> | null;
}): MappingOptionValidationResult => {
  const allowlist = args.allowlist ?? EMPTY_ALLOWLIST;
  const current = normalizeSelection(args.current);
  const previous = normalizeSelection(args.previous);
  const errors: string[] = [];

  const allowedMaterials = new Set(allowlist.materials.map((row) => row.value));
  const allowedColors = new Set(allowlist.colors.map((row) => row.value));
  const allowedDecors = new Set(allowlist.decors.map((row) => row.value));
  const allowedSizes = buildSizeSetByMaterial(allowlist);

  if (
    current.option_material_code
    && !allowedMaterials.has(current.option_material_code)
    && current.option_material_code !== previous.option_material_code
  ) {
    errors.push(`option_material_code '${current.option_material_code}' is not allowed by saved settings`);
  }
  if (
    current.option_color_code
    && !allowedColors.has(current.option_color_code)
    && current.option_color_code !== previous.option_color_code
  ) {
    errors.push(`option_color_code '${current.option_color_code}' is not allowed by saved settings`);
  }
  if (
    current.option_decoration_code
    && !allowedDecors.has(current.option_decoration_code)
    && current.option_decoration_code !== previous.option_decoration_code
  ) {
    errors.push(`option_decoration_code '${current.option_decoration_code}' is not allowed by saved settings`);
  }

  if (current.option_size_value) {
    const unchangedLegacy = current.option_size_value === previous.option_size_value
      && current.option_material_code === previous.option_material_code;
    if (!current.option_material_code) {
      if (!unchangedLegacy) errors.push("option_material_code is required when option_size_value is set");
    } else if (!allowedSizes.get(current.option_material_code)?.has(current.option_size_value) && !unchangedLegacy) {
      errors.push(`option_size_value '${current.option_size_value}' is not allowed for material '${current.option_material_code}'`);
    }
  }

  const value = toSelection(current);
  if (errors.length > 0) return { ok: false, errors, value };
  return { ok: true, value };
};
