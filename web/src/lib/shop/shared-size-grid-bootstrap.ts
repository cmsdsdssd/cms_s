export const buildSharedSizeGridSeedsFromLegacySources = (args: {
  channelId: string;
  masterItemId: string;
  externalProductNo: string;
  materialCode: string;
  weights: number[];
  deltas: number[];
}) => {
  const materialCode = String(args.materialCode ?? '').trim();
  const weights = Array.from(new Set((args.weights ?? []).map((value) => Number(Number(value).toFixed(2))).filter((value) => Number.isFinite(value) && value >= 0))).sort((a, b) => a - b);
  const deltas = Array.from(new Set((args.deltas ?? []).map((value) => Math.max(0, Math.round(Number(value))))).values()).sort((a, b) => a - b);
  const count = Math.min(weights.length, deltas.length);
  const nowIso = new Date().toISOString();
  return Array.from({ length: count }, (_, index) => ({
    channel_id: args.channelId,
    master_item_id: args.masterItemId,
    external_product_no: args.externalProductNo,
    material_code: materialCode,
    weight_g: weights[index],
    computed_delta_krw: deltas[index],
    computed_formula_mode: 'LEGACY_SHARED_BOOTSTRAP',
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
    computation_version: 'legacy-shared-bootstrap-v1',
    invalidated_reason: null,
    updated_at: nowIso,
  }));
};
