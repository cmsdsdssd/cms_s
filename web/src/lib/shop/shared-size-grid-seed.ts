export type DefaultSizeRuleSeed = {
  channel_id: string;
  master_item_id: string;
  external_product_no: string;
  category_key: 'SIZE';
  scope_material_code: string;
  additional_weight_g: null;
  additional_weight_min_g: number;
  additional_weight_max_g: number;
  size_price_mode: 'MARKET_LINKED';
  formula_multiplier: number;
  formula_offset_krw: number;
  rounding_unit_krw: number;
  rounding_mode: 'UP';
  fixed_delta_krw: null;
  additive_delta_krw: 0;
  is_active: true;
};

export const buildDefaultSizeRuleSeeds = (args: {
  channelId: string;
  masterItemId: string;
  externalProductNo: string;
  materials: string[];
}): DefaultSizeRuleSeed[] => {
  return Array.from(new Set(args.materials.map((value) => String(value ?? '').trim()).filter(Boolean))).map((material) => ({
    channel_id: args.channelId,
    master_item_id: args.masterItemId,
    external_product_no: args.externalProductNo,
    category_key: 'SIZE',
    scope_material_code: material,
    additional_weight_g: null,
    additional_weight_min_g: 0.01,
    additional_weight_max_g: 100,
    size_price_mode: 'MARKET_LINKED',
    formula_multiplier: 1,
    formula_offset_krw: 0,
    rounding_unit_krw: 100,
    rounding_mode: 'UP',
    fixed_delta_krw: null,
    additive_delta_krw: 0,
    is_active: true,
  }));
};
