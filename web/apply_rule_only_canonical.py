from pathlib import Path
root = Path(r'C:\Users\RICH\.gemini\antigravity\scratch\cms_s\web')

# 1) add rule-only canonical input helper
p = root / 'src/lib/shop/mapping-option-details.ts'
text = p.read_text(encoding='utf-8')
if 'deriveRuleOnlyCanonicalInputs' not in text:
    insert_after = '  return {\n    materials: Array.from(materials).sort((left, right) => left.localeCompare(right)),\n    sizes: Array.from(sizes).sort((left, right) => Number(left) - Number(right)),\n    colors: Array.from(colors).sort((left, right) => getPlatingComboSortOrder(left) - getPlatingComboSortOrder(right) || left.localeCompare(right)),\n    decors: Array.from(decors).sort((left, right) => left.localeCompare(right)),\n  };\n};\n\n'
    helper = '''const pickMostCommon = (values: string[]): string | null => {
  const freq = new Map<string, number>();
  for (const value of values.filter(Boolean)) {
    freq.set(value, (freq.get(value) ?? 0) + 1);
  }
  return Array.from(freq.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
};

export const deriveRuleOnlyCanonicalInputs = (args: {
  variants?: Array<{ variantCode?: string | null; options?: Array<{ name?: string | null; value?: string | null }> | null }>;
  mappings?: Array<Partial<MappingOptionSelection> & { external_variant_code?: string | null }>;
  rules?: Array<Partial<OptionLaborRuleRow> | null | undefined>;
  masterMaterialCode?: string | null;
}): {
  savedOptionCategories: SavedOptionCategoryRowWithDelta[];
  categoryOverrideByEntryKey: Record<string, SavedOptionCategoryRow["category_key"]>;
  axisSelectionByEntryKey: Record<string, {
    axis1_value?: string | null;
    axis2_value?: string | null;
    axis3_value?: string | null;
    decor_master_item_id?: string | null;
    decor_extra_delta_krw?: number | null;
    decor_final_amount_krw?: number | null;
  }>;
  otherReasonByEntryKey: Record<string, string>;
} => {
  const entries = buildMappingOptionEntries({ variants: args.variants?.map((variant) => ({ options: variant.options })) ?? [] });
  const variantEntryKeys = new Map<string, Set<string>>();
  for (const variant of args.variants ?? []) {
    const variantCode = normalizeVariantCode(String(variant?.variantCode ?? ''));
    if (!variantCode) continue;
    const keys = new Set<string>();
    for (const option of variant.options ?? []) {
      const key = mappingOptionEntryKey(option?.name, option?.value);
      if (key) keys.add(key);
    }
    variantEntryKeys.set(variantCode, keys);
  }
  const mappingsByEntryKey = new Map<string, Array<Partial<MappingOptionSelection>>>();
  for (const mapping of args.mappings ?? []) {
    const variantCode = normalizeVariantCode(String(mapping?.external_variant_code ?? ''));
    const keys = variantEntryKeys.get(variantCode);
    if (!keys) continue;
    for (const key of keys) {
      const bucket = mappingsByEntryKey.get(key) ?? [];
      bucket.push(mapping);
      mappingsByEntryKey.set(key, bucket);
    }
  }

  const savedOptionCategories: SavedOptionCategoryRowWithDelta[] = [];
  const categoryOverrideByEntryKey: Record<string, SavedOptionCategoryRow["category_key"]> = {};
  const axisSelectionByEntryKey: Record<string, { axis1_value?: string | null; axis2_value?: string | null; axis3_value?: string | null; decor_master_item_id?: string | null; decor_extra_delta_krw?: number | null; decor_final_amount_krw?: number | null; }> = {};
  const otherReasonByEntryKey: Record<string, string> = {};

  for (const entry of entries) {
    const matchingMappings = mappingsByEntryKey.get(entry.entry_key) ?? [];
    const materialChoices = matchingMappings.map((row) => normalizeMaterialSelection(row.option_material_code)).filter((value): value is string => Boolean(value));
    const colorChoices = matchingMappings.map((row) => normalizeColorSelection(row.option_color_code)).filter((value): value is string => Boolean(value));
    const decorChoices = matchingMappings.map((row) => normalizeDecorSelection(row.option_decoration_code)).filter((value): value is string => Boolean(value));
    const sizeChoices = matchingMappings
      .map((row) => row.option_size_value == null ? null : normalizeSizeSelection(row.option_size_value))
      .filter((value): value is string => Boolean(value));

    const guessedCategory = guessMappingOptionCategoryByName(entry.option_name);
    const materialFromValue = normalizeMaterialSelection(entry.option_value);
    const colorFromValue = normalizeColorSelection(entry.option_value);
    const decorRule = findDecorRuleForOptionValue(entry.option_value, args.rules ?? []);

    let categoryKey: SavedOptionCategoryRow["category_key"] = guessedCategory;
    if (materialFromValue && materialChoices.includes(materialFromValue)) {
      categoryKey = 'MATERIAL';
    } else if (guessedCategory == 'SIZE' or False):
      pass
    if (categoryKey !== 'MATERIAL') {
      if (guessedCategory === 'SIZE' || sizeChoices.length > 0) {
        categoryKey = 'SIZE';
      } else if ((guessedCategory === 'COLOR_PLATING' || Boolean(colorFromValue)) && colorChoices.length > 0) {
        categoryKey = 'COLOR_PLATING';
      } else if ((guessedCategory === 'DECOR' || Boolean(decorRule)) && (decorChoices.length > 0 || decorRule)) {
        categoryKey = 'DECOR';
      } else if (guessedCategory === 'NOTICE') {
        categoryKey = 'NOTICE';
      } else if (guessedCategory !== 'OTHER') {
        categoryKey = guessedCategory;
      } else {
        categoryKey = 'OTHER';
      }
    }

    savedOptionCategories.push({
      option_name: entry.option_name,
      option_value: entry.option_value,
      category_key: categoryKey,
      sync_delta_krw: null,
    });
    categoryOverrideByEntryKey[entry.entry_key] = categoryKey;

    const materialChoice = pickMostCommon(materialChoices) ?? normalizeMaterialSelection(args.masterMaterialCode) ?? null;
    if (categoryKey === 'SIZE') {
      const sizeChoice = pickMostCommon(sizeChoices);
      axisSelectionByEntryKey[entry.entry_key] = {
        axis1_value: materialChoice,
        axis2_value: sizeChoice,
      };
    } else if (categoryKey === 'COLOR_PLATING') {
      const colorChoice = pickMostCommon(colorChoices) ?? colorFromValue;
      axisSelectionByEntryKey[entry.entry_key] = {
        axis1_value: materialChoice,
        axis2_value: colorChoice,
      };
    } else if (categoryKey === 'DECOR') {
      axisSelectionByEntryKey[entry.entry_key] = {
        axis1_value: materialChoice,
        decor_master_item_id: toTrimmed(decorRule?.decoration_master_id) || null,
      };
    }
  }

  return {
    savedOptionCategories,
    categoryOverrideByEntryKey,
    axisSelectionByEntryKey,
    otherReasonByEntryKey,
  };
};

'''
    helper = helper.replace("    } else if (guessedCategory == 'SIZE' or False):\n      pass\n", '')
    if insert_after not in text:
      raise SystemExit('insert location not found in mapping-option-details')
    text = text.replace(insert_after, insert_after + helper, 1)
    p.write_text(text, encoding='utf-8')

# 2) variants route use helper instead of category/log semantics
p = root / 'src/app/api/channel-products/variants/route.ts'
text = p.read_text(encoding='utf-8')
text = text.replace('  inferMappingOptionSelection,\n', '  inferMappingOptionSelection,\n  deriveRuleOnlyCanonicalInputs,\n')
text = text.replace('      otherReasonByEntryKey,\n      categoryOverrideByEntryKey,\n      axisSelectionByEntryKey,\n      colorBaseDeltaByCode,\n    });\n', '      otherReasonByEntryKey: ruleOnlyCanonicalInputs.otherReasonByEntryKey,\n      categoryOverrideByEntryKey: ruleOnlyCanonicalInputs.categoryOverrideByEntryKey,\n      axisSelectionByEntryKey: ruleOnlyCanonicalInputs.axisSelectionByEntryKey,\n      colorBaseDeltaByCode,\n    });\n')
# inject helper before allowlist
anchor = '    const observedOptionValues = buildObservedOptionValuePool({\n'
insert = '''    const ruleOnlyCanonicalInputs = deriveRuleOnlyCanonicalInputs({
      variants: result.variants.map((variant) => ({
        variantCode: String(variant.variantCode ?? ''),
        options: variant.options,
      })),
      mappings: activeRows.filter((r
