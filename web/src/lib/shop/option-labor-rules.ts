import * as impl from "./option-labor-rules.js";

export type OptionLaborRuleCategory = "MATERIAL" | "SIZE" | "COLOR_PLATING" | "DECOR" | "OTHER";

export type OptionLaborRuleRow = {
  rule_id: string;
  channel_id: string;
  master_item_id: string;
  external_product_no: string;
  category_key: OptionLaborRuleCategory;
  scope_material_code: string | null;
  additional_weight_g: number | null;
  plating_enabled: boolean | null;
  color_code: string | null;
  decoration_master_id: string | null;
  decoration_model_name: string | null;
  base_labor_cost_krw: number;
  additive_delta_krw: number;
  is_active: boolean;
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
export const normalizeKrwInteger = impl.normalizeKrwInteger as (value: unknown, fallback?: number) => number;
export const normalizeAdditionalWeightValue = impl.normalizeAdditionalWeightValue as (value: unknown) => string | null;

export const hasAnyActiveOptionLaborRule = (rows: OptionLaborRuleRow[]): boolean =>
  ((impl as unknown as { hasActiveOptionLaborRules: (value: OptionLaborRuleRow[]) => boolean }).hasActiveOptionLaborRules)(rows);

export const normalizeAdditionalWeightG = impl.normalizeAdditionalWeightValue as (value: unknown) => string | null;

export const computeOptionLaborRuleBuckets = (rows: OptionLaborRuleRow[], input: OptionLaborRuleMatchInput) =>
  ((impl as unknown as { computeOptionLaborBuckets: (rows: OptionLaborRuleRow[], context: OptionLaborRuleMatchInput) => {
    material: number;
    size: number;
    colorPlating: number;
    decor: number;
    other: number;
    total: number;
    matched: Record<string, { rule_id: string } | null>;
  } }).computeOptionLaborBuckets)(rows, input);

export const buildAdditionalWeightOptions = impl.buildAdditionalWeightOptions as () => Array<{
  centigram: number;
  value: string;
  label: string;
}>;
