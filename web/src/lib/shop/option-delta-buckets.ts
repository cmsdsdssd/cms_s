export type OptionRuleCategoryFlags = {
  material: boolean;
  size: boolean;
  colorPlating: boolean;
  decor: boolean;
  other: boolean;
};

export type OptionDeltaBucketInput = {
  useOptionLaborRuleEngine: boolean;
  activeRuleCategories: OptionRuleCategoryFlags;
  optionLaborRuleResult: {
    material?: number | null;
    size?: number | null;
    colorPlating?: number | null;
    decor?: number | null;
    other?: number | null;
  } | null;
  ruleDeltas: {
    material: number;
    size: number;
    color: number;
    decor: number;
  };
  categoryScopedDeltaBuckets: {
    material: number;
    size: number;
    colorPlating: number;
    decor: number;
    other: number;
    total: number;
  };
  colorComboBaseDelta: number;
  colorAxisResolvedAmount?: number;
  sizePriceOverrideEnabled: boolean;
  sizePriceOverrideKrw: number | null;
  baseOptionDelta: number;
};

export type OptionDeltaBucketResult = {
  material: number;
  size: number;
  color: number;
  decor: number;
  other: number;
  total: number;
  source: "COMPUTED" | "OPTION_LABOR_RULE_ENGINE";
};

const round = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

export const hasActiveRuleCategory = (rows: Array<{ category_key?: unknown; is_active?: unknown }> | null | undefined, categoryKey: string): boolean => {
  const normalizedCategory = String(categoryKey ?? '').trim().toUpperCase();
  return Boolean((rows ?? []).some((row) => row?.is_active !== false && String(row?.category_key ?? '').trim().toUpperCase() === normalizedCategory));
};

export const composeOptionDeltaBuckets = (input: OptionDeltaBucketInput): OptionDeltaBucketResult => {
  const source: OptionDeltaBucketResult['source'] = input.useOptionLaborRuleEngine ? 'OPTION_LABOR_RULE_ENGINE' : 'COMPUTED';
  const fromRuleOrFallback = (enabled: boolean, ruleValue: unknown, fallback: number): number => (
    input.useOptionLaborRuleEngine && enabled ? round(ruleValue) : round(fallback)
  );

  const material = fromRuleOrFallback(
    input.activeRuleCategories.material,
    input.optionLaborRuleResult?.material,
    input.ruleDeltas.material + input.categoryScopedDeltaBuckets.material,
  );

  let size = fromRuleOrFallback(
    input.activeRuleCategories.size,
    input.optionLaborRuleResult?.size,
    input.ruleDeltas.size + input.categoryScopedDeltaBuckets.size,
  );
  if (input.sizePriceOverrideEnabled && input.sizePriceOverrideKrw !== null) {
    size = round(input.sizePriceOverrideKrw);
  }

  let color = fromRuleOrFallback(
    input.activeRuleCategories.colorPlating,
    round(input.colorComboBaseDelta) + round(input.optionLaborRuleResult?.colorPlating),
    round(input.colorComboBaseDelta) + input.ruleDeltas.color + input.categoryScopedDeltaBuckets.colorPlating,
  );
  if (Number.isFinite(Number(input.colorAxisResolvedAmount ?? Number.NaN))) {
    color = round(input.colorAxisResolvedAmount);
  }

  const decor = fromRuleOrFallback(
    input.activeRuleCategories.decor,
    input.optionLaborRuleResult?.decor,
    input.ruleDeltas.decor + input.categoryScopedDeltaBuckets.decor,
  );

  const other = fromRuleOrFallback(
    input.activeRuleCategories.other,
    input.optionLaborRuleResult?.other,
    input.baseOptionDelta + input.categoryScopedDeltaBuckets.other,
  );

  return {
    material,
    size,
    color,
    decor,
    other,
    total: material + size + color + decor + other,
    source,
  };
};


export type SavedOptionCategoryDeltaRow = {
  option_name?: string | null;
  option_value?: string | null;
  category_key?: string | null;
  sync_delta_krw?: number | null;
};

export type VariantOptionAxis = {
  name?: string | null;
  value?: string | null;
};

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const normalizeCategoryKey = (value: unknown): string => normalizeText(value).toUpperCase();

export const buildSavedCategoryBucketsFromVariantOptions = (
  variantOptions: VariantOptionAxis[] | null | undefined,
  savedRows: SavedOptionCategoryDeltaRow[] | null | undefined,
) => {
  const savedDeltaByEntryKey = new Map<string, { categoryKey: string; delta: number }>();
  for (const row of savedRows ?? []) {
    const entryKey = `${normalizeText(row.option_name)}::${normalizeText(row.option_value)}`;
    if (entryKey === '::') continue;
    savedDeltaByEntryKey.set(entryKey, {
      categoryKey: normalizeCategoryKey(row.category_key),
      delta: round(row.sync_delta_krw),
    });
  }

  const buckets = {
    material: 0,
    size: 0,
    colorPlating: 0,
    decor: 0,
    other: 0,
    total: 0,
  };

  for (const option of variantOptions ?? []) {
    const key = `${normalizeText(option?.name)}::${normalizeText(option?.value)}`;
    const matched = savedDeltaByEntryKey.get(key);
    if (!matched) continue;
    switch (matched.categoryKey) {
      case 'MATERIAL':
        buckets.material += matched.delta;
        break;
      case 'SIZE':
        buckets.size += matched.delta;
        break;
      case 'COLOR_PLATING':
        buckets.colorPlating += matched.delta;
        break;
      case 'DECOR':
        buckets.decor += matched.delta;
        break;
      case 'OTHER':
      case 'NOTICE':
      default:
        buckets.other += matched.delta;
        break;
    }
  }

  buckets.total = buckets.material + buckets.size + buckets.colorPlating + buckets.decor + buckets.other;
  return buckets;
};
