from pathlib import Path
p = Path(r'C:\Users\RICH\.gemini\antigravity\scratch\cms_s\web\src\lib\shop\weight-grid-store.js')
text = p.read_text(encoding='utf-8')
if 'buildBootstrapSizeGridRowsFromSavedSelections' in text:
    raise SystemExit('helper already exists')
append = """

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
"""
p.write_text(text + append, encoding='utf-8')
