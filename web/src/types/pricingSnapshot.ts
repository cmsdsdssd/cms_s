export type PricingSnapshotExplainRow = {
  channel_id: string;
  master_item_id: string;
  channel_product_id: string;
  external_variant_code: string | null;
  master_base_price_krw: number;
  shop_margin_multiplier: number;
  price_after_margin_krw: number;
  base_adjust_krw: number;
  delta_material_krw: number;
  delta_size_krw: number;
  delta_color_krw: number;
  delta_decor_krw: number;
  delta_other_krw: number;
  delta_total_krw: number;
  final_target_price_krw: number;
  compute_request_id: string;
  computed_at: string;
};

export type PricingSnapshotExplainResponse = {
  data: PricingSnapshotExplainRow;
};
