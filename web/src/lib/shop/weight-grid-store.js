import { buildMarketLinkedSizeGrid } from "./market-linked-size-grid.js";
import { normalizeMaterialCode } from "../material-factors.ts";
import { collapseSharedSizeGridRows } from "./shared-size-grid.ts";

const toTrimmed = (value) => String(value ?? "").trim();
const toWeightText = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "";
};
const chunk = (items, size) => {
  const next = [];
  for (let i = 0; i < items.length; i += size) next.push(items.slice(i, i + size));
  return next;
};

export const createPersistedSizeGridLookup = (rows) => {
  const byCell = new Map();
  const choicesByMaterial = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const materialCode = normalizeMaterialCode(row?.material_code);
    const weightText = toWeightText(row?.weight_g);
    if (!materialCode || !weightText) continue;
    const key = `${materialCode}::${weightText}`;
    byCell.set(key, row);
    if (row?.invalidated_reason) continue;
    const bucket = choicesByMaterial.get(materialCode) ?? [];
    bucket.push({ value: weightText, label: `${weightText}g`, delta_krw: Math.round(Number(row.computed_delta_krw ?? 0)) });
    choicesByMaterial.set(materialCode, bucket);
  }
  for (const [materialCode, choices] of choicesByMaterial.entries()) {
    const deduped = Array.from(new Map(choices.map((choice) => [choice.value, choice])).values())
      .sort((left, right) => Number(left.value) - Number(right.value));
    choicesByMaterial.set(materialCode, deduped);
  }
  return { byCell, choicesByMaterial };
};

export { collapseSharedSizeGridRows };

export const getPersistedSizeChoicesByMaterial = (lookup, materialCode) => {
  const normalized = normalizeMaterialCode(materialCode);
  if (!normalized) return [];
  return lookup?.choicesByMaterial?.get(normalized) ?? [];
};

export const resolvePersistedSizeGridCell = ({ lookup, materialCode, additionalWeightG }) => {
  const normalizedMaterialCode = normalizeMaterialCode(materialCode);
  const weightText = toWeightText(additionalWeightG);
  if (!normalizedMaterialCode) {
    return { valid: false, computed_delta_krw: 0, source_rule_id: null, source_rule_ids: [], mode: null, error_message: "material code missing" };
  }
  if (!weightText) {
    return { valid: false, computed_delta_krw: 0, source_rule_id: null, source_rule_ids: [], mode: null, error_message: "additional weight invalid" };
  }
  const row = lookup?.byCell?.get(`${normalizedMaterialCode}::${weightText}`) ?? null;
  if (!row) {
    return { valid: false, computed_delta_krw: 0, source_rule_id: null, source_rule_ids: [], mode: null, error_message: "size rule not found" };
  }
  if (row.invalidated_reason) {
    return {
      valid: false,
      computed_delta_krw: 0,
      source_rule_id: row.computed_source_rule_id ?? null,
      source_rule_ids: row.computed_source_rule_id ? [row.computed_source_rule_id] : [],
      mode: row.computed_formula_mode ?? null,
      error_message: String(row.invalidated_reason ?? "size grid invalid"),
    };
  }
  return {
    valid: true,
    computed_delta_krw: Math.round(Number(row.computed_delta_krw ?? 0)),
    source_rule_id: row.computed_source_rule_id ?? null,
    source_rule_ids: row.computed_source_rule_id ? [row.computed_source_rule_id] : [],
    mode: row.computed_formula_mode ?? null,
    error_message: null,
  };
};

const buildPersistedRowsForMaterial = ({ channelId, masterItemId, externalProductNo, materialCode, rules, marketContext }) => {
  const nowIso = new Date().toISOString();
  const grid = buildMarketLinkedSizeGrid({
    rows: rules,
    masterItemId,
    externalProductNo,
    materialCode,
    marketContext,
  });
  return (grid.cells ?? []).map((cell) => ({
    channel_id: channelId,
    master_item_id: masterItemId,
    external_product_no: externalProductNo,
    material_code: materialCode,
    weight_g: Number(cell.weight_g ?? 0),
    computed_delta_krw: Math.round(Number(cell.computed_delta_krw ?? 0)),
    computed_formula_mode: cell.mode ?? null,
    computed_source_rule_id: cell.source_rule_id ?? null,
    price_basis_resolved: cell.price_basis_resolved ?? null,
    effective_tick_krw_g: Number.isFinite(Number(cell.effective_tick_krw_g)) ? Math.round(Number(cell.effective_tick_krw_g)) : null,
    purity_rate_resolved: Number.isFinite(Number(cell.purity_rate_resolved)) ? Number(cell.purity_rate_resolved) : null,
    adjust_factor_resolved: Number.isFinite(Number(cell.adjust_factor_resolved)) ? Number(cell.adjust_factor_resolved) : null,
    factor_multiplier_applied: Number.isFinite(Number(cell.factor_multiplier_applied)) ? Number(cell.factor_multiplier_applied) : null,
    formula_multiplier_applied: Number.isFinite(Number(cell.formula_multiplier_applied)) ? Number(cell.formula_multiplier_applied) : null,
    formula_offset_krw_applied: Number.isFinite(Number(cell.formula_offset_krw_applied)) ? Math.round(Number(cell.formula_offset_krw_applied)) : null,
    rounding_unit_krw_applied: Number.isFinite(Number(cell.rounding_unit_krw_applied)) ? Math.round(Number(cell.rounding_unit_krw_applied)) : null,
    rounding_mode_applied: cell.rounding_mode_applied ?? null,
    tick_snapshot_at: nowIso,
    computed_at: nowIso,
    computation_version: "runtime-v1",
    invalidated_reason: cell.valid ? null : String(cell.error_message ?? "invalid size cell"),
    updated_at: nowIso,
  }));
};

export const rebuildPersistedSizeGridForScope = async ({ sb, channelId, masterItemId, externalProductNo, rules, marketContext }) => {
  const scopedRules = (Array.isArray(rules) ? rules : []).filter((row) => String(row?.category_key ?? "").trim().toUpperCase() === "SIZE" && row?.is_active !== false);
  const materials = Array.from(new Set(scopedRules.map((row) => normalizeMaterialCode(row?.scope_material_code)).filter(Boolean)));
  const rows = materials.flatMap((materialCode) => buildPersistedRowsForMaterial({
    channelId,
    masterItemId,
    externalProductNo,
    materialCode,
    rules: scopedRules,
    marketContext,
  }));

  const deleteRes = await sb
    .from("channel_option_weight_grid_v1")
    .delete()
    .eq("channel_id", channelId)
    .eq("master_item_id", masterItemId)
    .eq("external_product_no", externalProductNo);
  if (deleteRes.error) throw new Error(deleteRes.error.message ?? "size grid delete failed");

  for (const batch of chunk(rows, 1000)) {
    if (batch.length === 0) continue;
    const upsertRes = await sb
      .from("channel_option_weight_grid_v1")
      .upsert(batch, { onConflict: "channel_id,master_item_id,external_product_no,material_code,weight_g" });
    if (upsertRes.error) throw new Error(upsertRes.error.message ?? "size grid upsert failed");
  }

  return rows;
};

export const loadPersistedSizeGridRowsForScope = async ({ sb, channelId, masterItemId, externalProductNo }) => {
  const res = await sb
    .from("channel_option_weight_grid_v1")
    .select("grid_id, channel_id, master_item_id, external_product_no, material_code, weight_g, computed_delta_krw, computed_formula_mode, computed_source_rule_id, price_basis_resolved, effective_tick_krw_g, purity_rate_resolved, adjust_factor_resolved, factor_multiplier_applied, formula_multiplier_applied, formula_offset_krw_applied, rounding_unit_krw_applied, rounding_mode_applied, tick_snapshot_at, computed_at, computation_version, invalidated_reason")
    .eq("channel_id", channelId)
    .eq("master_item_id", masterItemId)
    .eq("external_product_no", externalProductNo)
    .order("material_code", { ascending: true })
    .order("weight_g", { ascending: true });
  if (res.error) throw new Error(res.error.message ?? "size grid load failed");
  return res.data ?? [];
};

export const rebuildAndLoadPersistedSizeGridForScope = async (args) => {
  const rows = await rebuildPersistedSizeGridForScope(args);
  return createPersistedSizeGridLookup(rows);
};


const entryKeyOf = (optionName, optionValue) => `${toTrimmed(optionName)}::${toTrimmed(optionValue)}`;

export const buildBootstrapSizeGridRowsFromSavedSelections = ({
  channelId,
  masterItemId,
  externalProductNo,
  savedOptionCategories,
  axisSelectionByEntryKey,
  defaultMaterialCode = null,
}) => {
  const nowIso = new Date().toISOString();
  const byCell = new Map();
  for (const row of Array.isArray(savedOptionCategories) ? savedOptionCategories : []) {
    if (String(row?.category_key ?? '').trim().toUpperCase() !== 'SIZE') continue;
    const entryKey = entryKeyOf(row?.option_name, row?.option_value);
    const selection = axisSelectionByEntryKey?.[entryKey] ?? null;
    const materialCode = normalizeMaterialCode(selection?.axis1_value ?? defaultMaterialCode);
    const weight = Number(selection?.axis2_value ?? Number.NaN);
    const delta = Number(row?.sync_delta_krw ?? Number.NaN);
    if (!materialCode || !Number.isFinite(weight) || !Number.isFinite(delta)) continue;
    const weightRounded = Number(weight.toFixed(2));
    const cellKey = `${materialCode}::${weightRounded.toFixed(2)}`;
    if (byCell.has(cellKey)) continue;
    byCell.set(cellKey, {
      channel_id: channelId,
      master_item_id: masterItemId,
      external_product_no: externalProductNo,
      material_code: materialCode,
      weight_g: weightRounded,
      computed_delta_krw: Math.round(delta),
      computed_formula_mode: 'LEGACY_BOOTSTRAP',
      computed_source_rule_id: null,
      price_basis_resolved: null,
      effective_tick_krw_g: null,
      purity_rate_resolved: null,
      adjust_factor_resolved: null,
      factor_multiplier_applied: null,
      formula_multiplier_applied: null,
      formula_offset_krw_applied: null,
      rounding_unit_krw_applied: null,
      rounding_mode_applied: null,
      tick_snapshot_at: nowIso,
      computed_at: nowIso,
      computation_version: 'legacy-bootstrap-v1',
      invalidated_reason: null,
      updated_at: nowIso,
    });
  }
  return Array.from(byCell.values()).sort((a, b) => {
    const materialCompare = String(a.material_code).localeCompare(String(b.material_code));
    if (materialCompare !== 0) return materialCompare;
    return Number(a.weight_g) - Number(b.weight_g);
  });
};

export const upsertPersistedSizeGridRows = async ({ sb, rows }) => {
  for (const batch of chunk(Array.isArray(rows) ? rows : [], 1000)) {
    if (batch.length === 0) continue;
    const upsertRes = await sb
      .from('channel_option_weight_grid_v1')
      .upsert(batch, { onConflict: 'channel_id,master_item_id,external_product_no,material_code,weight_g' });
    if (upsertRes.error) throw new Error(upsertRes.error.message ?? 'size grid upsert failed');
  }
};


export const loadSharedSizeGridRowsForChannel = async ({ sb, channelId }) => {
  const res = await sb
    .from("channel_option_weight_grid_v1")
    .select("grid_id, channel_id, master_item_id, external_product_no, material_code, weight_g, computed_delta_krw, computed_formula_mode, computed_source_rule_id, price_basis_resolved, effective_tick_krw_g, purity_rate_resolved, adjust_factor_resolved, factor_multiplier_applied, formula_multiplier_applied, formula_offset_krw_applied, rounding_unit_krw_applied, rounding_mode_applied, tick_snapshot_at, computed_at, computation_version, invalidated_reason")
    .eq("channel_id", channelId)
    .neq("computation_version", "legacy-shared-bootstrap-v1")
    .order("material_code", { ascending: true })
    .order("weight_g", { ascending: true });
  if (res.error) throw new Error(res.error.message ?? "shared size grid load failed");
  return collapseSharedSizeGridRows(res.data ?? []);
};
