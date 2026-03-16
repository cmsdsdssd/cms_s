from pathlib import Path
root = Path(r'C:\Users\RICH\.gemini\antigravity\scratch\cms_s\web')

# 1) weight-grid-store helper
path = root / 'src/lib/shop/weight-grid-store.js'
text = path.read_text(encoding='utf-8')
if 'buildBootstrapSizeGridRowsFromSavedSelections' not in text:
    text += '''

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
    if (!materialCode or not False):
      pass
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
'''
    text = text.replace("if (!materialCode or not False):\n      pass\n", "")
    path.write_text(text, encoding='utf-8')

# 2) variants route imports
path = root / 'src/app/api/channel-products/variants/route.ts'
text = path.read_text(encoding='utf-8')
text = text.replace(
    'import { createPersistedSizeGridLookup, loadPersistedSizeGridRowsForScope, rebuildAndLoadPersistedSizeGridForScope } from "@/lib/shop/weight-grid-store.js";\n',
    'import { buildBootstrapSizeGridRowsFromSavedSelections, createPersistedSizeGridLookup, loadPersistedSizeGridRowsForScope, rebuildAndLoadPersistedSizeGridForScope, upsertPersistedSizeGridRows } from "@/lib/shop/weight-grid-store.js";\n'
)
anchor = '''    const observedOptionValues = buildObservedOptionValuePool({
      variants: result.variants.map((variant) => ({
        options: variant.options.map((option) => ({
          name: option.name,
          value: option.value,
        })),
      })),
      savedOptionCategories: filteredSavedOptionCategories,
    });
'''
insert = '''    const validEntryKeys = new Set(
      (result.variants ?? []).flatMap((variant) =>
        (variant.options ?? []).map((option) => mappingOptionEntryKey(String(option?.name ?? '').trim(), String(option?.value ?? '').trim())),
      ).filter(Boolean),
    );
    const axisPrefixes = Array.from(categoryProductNosForRead)
      .filter(Boolean)
      .sort((left, right) => {
        if (left === canonicalExternalProductNo) return -1;
        if (right === canonicalExternalProductNo) return 1;
        return left.localeCompare(right);
      })
      .map((productNo) => `${productNo}::`);
    const bootstrapAxisSelectionByEntryKey = {};
    for (const row of (otherReasonLogRes.data ?? [])) {
      const axisValue = String(row.axis_value ?? '').trim();
      const matchedPrefix = axisPrefixes.find((prefix) => axisValue.startsWith(prefix));
      if (!matchedPrefix) continue;
      const entryKey = axisValue.slice(matchedPrefix.length).trim();
      if (!entryKey || !validEntryKeys.has(entryKey)) continue;
      const axisKey = String(row.axis_key ?? '').trim().toUpperCase();
      const nextRow = row.new_row && typeof row.new_row === 'object' ? row.new_row : null;
      if (axisKey !== 'OPTION_AXIS_SELECTION' || !nextRow) continue;
      bootstrapAxisSelectionByEntryKey[entryKey] = {
        axis1_value: String(nextRow.axis1_value ?? '').trim() || null,
        axis2_value: String(nextRow.axis2_value ?? '').trim() || null,
      };
    }
    const hasPersistedChoices = persistedSizeLookup
      ? Array.from(persistedSizeLookup.choicesByMaterial.values()).some((choices) => (choices?.length ?? 0) > 0)
      : false;
    if (!hasPersistedChoices) {
      const bootstrapRows = buildBootstrapSizeGridRowsFromSavedSelections({
        channelId,
        masterItemId,
        externalProductNo: canonicalExternalProductNo,
        savedOptionCategories: filteredSavedOptionCategories,
        axisSelectionByEntryKey: bootstrapAxisSelectionByEntryKey,
        defaultMaterialCode: masterMaterialCode,
      });
      if (bootstrapRows.length > 0) {
        await upsertPersistedSizeGridRows({ sb, rows: bootstrapRows });
        persistedSizeLookup = createPersistedSizeGridLookup(bootstrapRows);
      }
    }

    const observedOptionValues = buildObservedOptionValuePool({
      variants: result.variants.map((variant) => ({
        options: variant.options.map((option) => ({
          name: option.name,
          value: option.value,
        })),
      })),
      savedOptionCategories: filteredSavedOptionCategories,
    });
'''
text = text.replace(anchor, insert, 1)
# remove later duplicate declarations
for block in [
'''    const validEntryKeys = new Set(
      (result.variants ?? []).flatMap((variant) =>
        (variant.options ?? []).map((option) => mappingOptionEntryKey(String(option?.name ?? "").trim(), String(option?.value ?? "").trim())),
      ).filter(Boolean),
    );
    const axisPrefixes = Array.from(categoryProductNosForRead)
      .filter(Boolean)
      .sort((left, right) => {
        if (left === canonicalExternalProductNo) return -1;
        if (right === canonicalExternalProductNo) return 1;
        return left.localeCompare(right);
      })
      .map((productNo) => `${productNo}::`);
''']:
    text = text.replace(block, '', 1)
path.write_text(text, encoding='utf-8')

# 3) recompute imports and bootstrap
path = root / 'src/app/api/pricing/recompute/route.ts'
text = path.read_text(encoding='utf-8')
text = text.replace(
    'import { createPersistedSizeGridLookup, loadPersistedSizeGridRowsForScope } from "@/lib/shop/weight-grid-store.js";\n',
    'import { buildBootstrapSizeGridRowsFromSavedSelections, createPersistedSizeGridLookup, loadPersistedSizeGridRowsForScope, upsertPersistedSizeGridRows } from "@/lib/shop/weight-grid-store.js";\n'
)
old = '''      const master = masterMap.get(masterItemId) ?? null;
      let persistedSizeLookup = persistedSizeLookupByScope.get(`${masterItemId}::${externalProductNo}`) ?? null;
'''
new = '''      const master = masterMap.get
