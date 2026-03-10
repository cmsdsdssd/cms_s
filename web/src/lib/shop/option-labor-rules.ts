import * as impl from "./option-labor-rules-impl.js";

export type OptionLaborRuleCategory = "MATERIAL" | "SIZE" | "COLOR_PLATING" | "DECOR" | "OTHER";

export type OptionLaborRuleRow = {
  rule_id: string;
  channel_id: string;
  master_item_id: string;
  external_product_no: string;
  category_key: OptionLaborRuleCategory;
  scope_material_code: string | null;
  additional_weight_g: number | null;
  additional_weight_min_g?: number | null;
  additional_weight_max_g?: number | null;
  size_price_mode?: "MARKET_LINKED" | "FIXED_DELTA" | null;
  formula_multiplier?: number | null;
  formula_offset_krw?: number | null;
  rounding_unit_krw?: number | null;
  rounding_mode?: "UP" | "NEAREST" | "DOWN" | "CEIL" | "ROUND" | "FLOOR" | null;
  fixed_delta_krw?: number | null;
  plating_enabled: boolean | null;
  color_code: string | null;
  decoration_master_id: string | null;
  decoration_model_name: string | null;
  base_labor_cost_krw: number;
  additive_delta_krw: number;
  is_active: boolean;
  note?: string | null;
};

export type OptionLaborRuleBuckets = {
  material: number;
  size: number;
  colorPlating: number;
  decor: number;
  other: number;
  total: number;
};

export type OptionLaborRuleMatchInput = {
  materialCode: string | null;
  additionalWeightG: number | null;
  platingEnabled: boolean;
  colorCode: string | null;
  decorationCode: string | null;
  decorationMasterId?: string | null;
};

export const OPTION_LABOR_RULE_CATEGORIES = impl.OPTION_LABOR_RULE_CATEGORIES as OptionLaborRuleCategory[];

export const normalizeOptionLaborRuleCategory = impl.normalizeOptionLaborRuleCategory as (value: unknown) => OptionLaborRuleCategory | null;
export const normalizeMaterialScopeCode = impl.normalizeMaterialScopeCode as (value: unknown) => string | null;
export const normalizeOptionLaborColorCode = impl.normalizeOptionLaborColorCode as (value: unknown) => string | null;
export const normalizeDecorationCode = impl.normalizeDecorationCode as (value: unknown) => string | null;
export const normalizeKrwInteger = impl.normalizeKrwInteger as (value: unknown, fallback?: number) => number;
export const normalizeAdditionalWeightValue = impl.normalizeAdditionalWeightValue as (value: unknown) => string | null;

export const hasAnyActiveOptionLaborRule = (rows: OptionLaborRuleRow[]): boolean =>
  ((impl as unknown as { hasActiveOptionLaborRules: (value: OptionLaborRuleRow[]) => boolean }).hasActiveOptionLaborRules)(rows);

export const normalizeAdditionalWeightG = impl.normalizeAdditionalWeightValue as (value: unknown) => string | null;

export const computeOptionLaborRuleBuckets = (
  rows: OptionLaborRuleRow[],
  input: OptionLaborRuleMatchInput,
  options?: {
    masterItemId?: string | null;
    externalProductNo?: string | null;
    marketContext?: {
      goldTickKrwPerG?: number | null;
      silverTickKrwPerG?: number | null;
      materialFactors?: Record<string, unknown> | null;
      factorMultiplierByMaterialCode?: Record<string, number> | null;
    } | null;
    persistedSizeLookup?: unknown;
  },
) =>
  ((impl as unknown as { computeOptionLaborBuckets: (rows: OptionLaborRuleRow[], context: OptionLaborRuleMatchInput, options?: {
    masterItemId?: string | null;
    externalProductNo?: string | null;
    marketContext?: {
      goldTickKrwPerG?: number | null;
      silverTickKrwPerG?: number | null;
      materialFactors?: Record<string, unknown> | null;
      factorMultiplierByMaterialCode?: Record<string, number> | null;
    } | null;
    persistedSizeLookup?: unknown;
  }) => {
    material: number;
    size: number;
    colorPlating: number;
    decor: number;
    other: number;
    total: number;
    matched: Record<string, { rule_id: string } | null>;
  } }).computeOptionLaborBuckets)(rows, input, options);

export const buildAdditionalWeightOptions = impl.buildAdditionalWeightOptions as () => Array<{
  centigram: number;
  value: string;
  label: string;
}>;
