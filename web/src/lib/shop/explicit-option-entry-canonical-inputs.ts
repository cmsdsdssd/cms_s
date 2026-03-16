export type ExplicitOptionEntryRow = {
  option_name: string;
  option_value: string;
  category_key: 'MATERIAL' | 'SIZE' | 'COLOR_PLATING' | 'DECOR' | 'ADDON' | 'OTHER' | 'NOTICE';
  material_registry_code?: string | null;
  weight_g?: number | null;
  combo_code?: string | null;
  color_bucket_id?: string | null;
  decor_master_id?: string | null;
  addon_master_id?: string | null;
  other_reason_code?: string | null;
  explicit_delta_krw?: number | null;
  notice_code?: string | null;
};

type CanonicalCompatibleCategory = 'MATERIAL' | 'SIZE' | 'COLOR_PLATING' | 'DECOR' | 'ADDON' | 'OTHER' | 'NOTICE';

const toTrimmed = (value: unknown): string => String(value ?? '').trim();
const toEntryKey = (optionName: string, optionValue: string): string => {
  const name = toTrimmed(optionName);
  const value = toTrimmed(optionValue);
  return name && value ? `${name}::${value}` : '';
};

export const buildCanonicalInputsFromExplicitOptionEntries = (args: {
  rows: ExplicitOptionEntryRow[];
  colorBucketDeltaById?: Record<string, number>;
  addonAmountById?: Record<string, number>;
}): {
  savedOptionCategories: Array<{ option_name: string; option_value: string; category_key: CanonicalCompatibleCategory; sync_delta_krw: number | null }>;
  categoryOverrideByEntryKey: Record<string, CanonicalCompatibleCategory>;
  axisSelectionByEntryKey: Record<string, { axis1_value?: string | null; axis2_value?: string | null; axis3_value?: string | null; decor_master_item_id?: string | null }>;
  otherReasonByEntryKey: Record<string, string>;
} => {
  const savedOptionCategories: Array<{
    option_name: string;
    option_value: string;
    category_key: CanonicalCompatibleCategory;
    sync_delta_krw: number | null;
  }> = [];
  const categoryOverrideByEntryKey: Record<string, CanonicalCompatibleCategory> = {};
  const axisSelectionByEntryKey: Record<string, {
    axis1_value?: string | null;
    axis2_value?: string | null;
    axis3_value?: string | null;
    decor_master_item_id?: string | null;
  }> = {};
  const otherReasonByEntryKey: Record<string, string> = {};

  for (const row of args.rows ?? []) {
    const option_name = toTrimmed(row.option_name);
    const option_value = toTrimmed(row.option_value);
    const entryKey = toEntryKey(option_name, option_value);
    if (!entryKey) continue;

    savedOptionCategories.push({
      option_name,
      option_value,
      category_key: row.category_key,
      sync_delta_krw: row.category_key === 'OTHER' ? Math.round(Number(row.explicit_delta_krw ?? 0)) : null,
    });
    categoryOverrideByEntryKey[entryKey] = row.category_key;

    if (row.category_key === 'SIZE') {
      axisSelectionByEntryKey[entryKey] = {
        axis2_value: row.weight_g == null ? null : Number(row.weight_g).toFixed(2),
      };
      continue;
    }

    if (row.category_key === 'COLOR_PLATING') {
      const bucketDelta = row.color_bucket_id ? args.colorBucketDeltaById?.[row.color_bucket_id] ?? null : null;
      axisSelectionByEntryKey[entryKey] = {
        axis2_value: toTrimmed(row.combo_code) || null,
        axis3_value: bucketDelta == null ? null : String(Math.round(bucketDelta)),
      };
      continue;
    }

    if (row.category_key === 'DECOR') {
      axisSelectionByEntryKey[entryKey] = {
        decor_master_item_id: toTrimmed(row.decor_master_id) || null,
      };
      continue;
    }

    if (row.category_key === 'ADDON') {
      const addonAmount = row.addon_master_id ? args.addonAmountById?.[row.addon_master_id] ?? null : null;
      axisSelectionByEntryKey[entryKey] = {
        axis1_value: toTrimmed(row.addon_master_id) || null,
        axis3_value: addonAmount == null ? null : String(Math.round(addonAmount)),
      };
      continue;
    }

    if (row.category_key === 'NOTICE') {
      axisSelectionByEntryKey[entryKey] = {
        axis1_value: toTrimmed(row.notice_code) || null,
      };
      continue;
    }

    if (row.category_key === 'OTHER') {
      const otherReason = toTrimmed(row.other_reason_code);
      if (otherReason) otherReasonByEntryKey[entryKey] = otherReason;
    }
  }

  return {
    savedOptionCategories,
    categoryOverrideByEntryKey,
    axisSelectionByEntryKey,
    otherReasonByEntryKey,
  };
};
