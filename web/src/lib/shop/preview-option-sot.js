import { normalizePlatingComboCode } from './sync-rules.ts';
import { composeOptionDeltaBuckets, hasActiveRuleCategory } from './option-delta-buckets.ts';
import {
  computeOptionLaborRuleBuckets,
  hasAnyActiveOptionLaborRule,
} from './option-labor-rules.ts';

const round = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

export const composePreviewOptionSotDeltas = (args) => {
  const optionLaborRows = Array.isArray(args?.optionLaborRows) ? args.optionLaborRows : [];
  const useOptionLaborRuleEngine = hasAnyActiveOptionLaborRule(optionLaborRows);
  if (!useOptionLaborRuleEngine) {
    return {
      useOptionLaborRuleEngine: false,
      bucketSource: 'LEGACY_SYNC_RULES',
      material_delta_krw: 0,
      size_delta_krw: 0,
      color_delta_krw: 0,
      decor_delta_krw: 0,
      other_delta_krw: 0,
      total_delta_krw: 0,
      color_base_delta_krw: 0,
      color_exception_delta_krw: 0,
      color_resolved_delta_krw: null,
      sot_status: null,
      sot_warnings: [],
    };
  }

  const optionLaborRuleResult = computeOptionLaborRuleBuckets(optionLaborRows, args?.context, {
    masterItemId: args?.masterItemId ?? null,
    externalProductNo: args?.externalProductNo ?? null,
    marketContext: args?.marketContext ?? null,
  });

  const normalizedColorCode = normalizePlatingComboCode(String(args?.context?.colorCode ?? ''));
  const colorBaseDeltaKrw = normalizedColorCode
    ? round(args?.colorBaseDeltaByCode?.[normalizedColorCode] ?? 0)
    : 0;

  const colorResolvedDeltaKrw = normalizedColorCode ? colorBaseDeltaKrw : null;
  const sotStatus = normalizedColorCode ? 'VALID' : null;
  const sotWarnings = [];

  const activeRuleCategories = {
    material: hasActiveRuleCategory(optionLaborRows, 'MATERIAL'),
    size: hasActiveRuleCategory(optionLaborRows, 'SIZE'),
    colorPlating: hasActiveRuleCategory(optionLaborRows, 'COLOR_PLATING'),
    decor: hasActiveRuleCategory(optionLaborRows, 'DECOR'),
    other: hasActiveRuleCategory(optionLaborRows, 'OTHER'),
  };

  const composed = composeOptionDeltaBuckets({
    useOptionLaborRuleEngine,
    activeRuleCategories,
    optionLaborRuleResult,
    ruleDeltas: {
      material: 0,
      size: 0,
      color: 0,
      decor: 0,
    },
    categoryScopedDeltaBuckets: {
      material: 0,
      size: 0,
      colorPlating: 0,
      decor: 0,
      other: 0,
      total: 0,
    },
    colorComboBaseDelta: colorBaseDeltaKrw,
    colorAxisResolvedAmount: colorResolvedDeltaKrw ?? undefined,
    sizePriceOverrideEnabled: false,
    sizePriceOverrideKrw: null,
    baseOptionDelta: 0,
  });

  return {
    useOptionLaborRuleEngine,
    bucketSource: 'OPTION_LABOR_RULES',
    material_delta_krw: round(composed.material),
    size_delta_krw: round(composed.size),
    color_delta_krw: round(composed.color),
    decor_delta_krw: round(composed.decor),
    other_delta_krw: round(composed.other),
    total_delta_krw: round(composed.total),
    color_base_delta_krw: colorBaseDeltaKrw,
    color_exception_delta_krw: 0,
    color_resolved_delta_krw: colorResolvedDeltaKrw,
    sot_status: sotStatus,
    sot_warnings: sotWarnings,
  };
};
