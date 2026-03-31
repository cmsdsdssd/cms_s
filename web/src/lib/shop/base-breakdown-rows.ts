type SnapshotLike = {
  material_raw_krw?: unknown;
  material_final_krw?: unknown;
  material_code_effective?: unknown;
  material_basis_resolved?: unknown;
  material_purity_rate_resolved?: unknown;
  material_adjust_factor_resolved?: unknown;
  material_factor_multiplier_used?: unknown;
  tick_gold_krw_g?: unknown;
  tick_silver_krw_g?: unknown;
  effective_tick_krw_g?: unknown;
  tick_as_of?: unknown;
  net_weight_g?: unknown;
  shop_margin_multiplier?: unknown;
  labor_sell_total_krw?: unknown;
  labor_sell_total_plus_absorb_krw?: unknown;
  absorb_total_krw?: unknown;
  absorb_total_raw_krw?: unknown;
  absorb_total_applied_krw?: unknown;
  absorb_total_krw_raw?: unknown;
  absorb_total_krw_applied?: unknown;
  material_pre_fee_krw?: unknown;
  labor_cost_applied_krw?: unknown;
  labor_pre_fee_krw?: unknown;
  fixed_pre_fee_krw?: unknown;
  candidate_pre_fee_krw?: unknown;
  candidate_price_krw?: unknown;
  fee_rate?: unknown;
  min_margin_rate_total?: unknown;
  gm_material_rate?: unknown;
  gm_labor_rate?: unknown;
  gm_fixed_rate?: unknown;
  cost_sum_krw?: unknown;
  min_margin_price_krw?: unknown;
  guardrail_price_krw?: unknown;
  guardrail_reason_code?: unknown;
  rounded_target_price_krw?: unknown;
  rounding_unit_used?: unknown;
  rounding_mode_used?: unknown;
  override_price_krw?: unknown;
  floor_price_krw?: unknown;
  floor_clamped?: unknown;
  final_target_price_krw?: unknown;
  final_target_price_v2_krw?: unknown;
  current_channel_price_krw?: unknown;
  diff_krw?: unknown;
  diff_pct?: unknown;
  computed_at?: unknown;
  labor_component_json?: unknown;
  breakdown_json?: unknown;
  labor_sell_master_krw?: unknown;
  labor_sell_decor_krw?: unknown;
  master_labor_base_sell_krw?: unknown;
  master_labor_center_sell_krw?: unknown;
  master_labor_sub1_sell_krw?: unknown;
  master_labor_sub2_sell_krw?: unknown;
  master_plating_sell_krw?: unknown;
  absorb_base_labor_krw?: unknown;
  absorb_stone_labor_krw?: unknown;
  absorb_plating_krw?: unknown;
  absorb_etc_krw?: unknown;
};

export type BaseBreakdownRow = {
  label: string;
  amountKrw: number;
  detail: string | null;
};

export type DetailedLaborComponent = {
  key: string;
  label: string;
  costExcludingAbsorbKrw: number | null;
  sellExcludingAbsorbKrw: number | null;
  absorbRawKrw: number | null;
  absorbAppliedKrw: number | null;
  costIncludingAbsorbKrw: number | null;
  sellIncludingAbsorbKrw: number | null;
};

export type DetailedBaseBreakdown = {
  marketTickLabel: string | null;
  marketTickKrwPerG: number | null;
  marketTickAsOf: string | null;
  materialCodeEffective: string | null;
  netWeightG: number | null;
  purityRate: number | null;
  adjustFactor: number | null;
  effectiveFactor: number | null;
  convertedWeightG: number | null;
  materialPriceKrw: number | null;
  materialMarginRate: number | null;
  fixedMarginRate: number | null;
  materialMarginAmountKrw: number | null;
  materialPriceAfterMarginKrw: number | null;
  laborTotalExcludingAbsorbKrw: number | null;
  laborTotalAbsorbRawKrw: number | null;
  laborTotalAbsorbAppliedKrw: number | null;
  laborTotalIncludingAbsorbKrw: number | null;
  laborMarginRate: number | null;
  laborMarginAmountKrw: number | null;
  laborPriceAfterMarginKrw: number | null;
  laborMasterSellKrw: number | null;
  laborStoneSellKrw: number | null;
  laborDecorSellKrw: number | null;
  laborBaseSellKrw: number | null;
  laborCenterSellKrw: number | null;
  laborSub1SellKrw: number | null;
  laborSub2SellKrw: number | null;
  laborPlatingSellKrw: number | null;
  absorbBaseLaborKrw: number | null;
  absorbStoneLaborKrw: number | null;
  absorbPlatingKrw: number | null;
  absorbEtcKrw: number | null;
  fixedPreFeeKrw: number | null;
  candidatePreFeeKrw: number | null;
  costSumKrw: number | null;
  feeRate: number | null;
  feeMarginAmountKrw: number | null;
  candidatePriceKrw: number | null;
  guardrailRate: number | null;
  guardrailPriceKrw: number | null;
  guardrailReasonCode: string | null;
  roundedTargetPriceKrw: number | null;
  roundingUnitKrw: number | null;
  roundingMode: string | null;
  selectedPriceKrw: number | null;
  selectedPriceBasis: string | null;
  storefrontPriceKrw: number | null;
  storefrontPriceSource: string | null;
  storefrontDiffKrw: number | null;
  storefrontDiffPct: number | null;
  storefrontSyncPass: boolean | null;
  storefrontCompareStatus: "MATCH" | "THRESHOLD_HELD" | "OUT_OF_SYNC" | "UNAVAILABLE";
  laborComponents: DetailedLaborComponent[];
};

const LABOR_COMPONENT_LABELS: Record<string, string> = {
  BASE_LABOR: '기본 공임',
  STONE_LABOR: '석 공임',
  PLATING: '도금 공임',
  ETC: '기타 공임',
  DECOR: '장식 공임',
};

const toRoundedInt = (value: unknown): number | null => {
  const numeric = Number(value ?? Number.NaN);
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
};

const toNumberOrNull = (value: unknown): number | null => {
  const numeric = Number(value ?? Number.NaN);
  return Number.isFinite(numeric) ? numeric : null;
};

const toStringOrNull = (value: unknown): string | null => {
  const text = String(value ?? '').trim();
  return text || null;
};

const toBooleanOrNull = (value: unknown): boolean | null => {
  if (value === true || value === false) return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
};

const sumRoundedInts = (values: Array<number | null | undefined>): number | null => {
  let total = 0;
  let hasValue = false;
  for (const value of values) {
    if (value == null || !Number.isFinite(value)) continue;
    total += Math.round(value);
    hasValue = true;
  }
  return hasValue ? total : null;
};

const readBreakdownNumber = (snapshot: SnapshotLike, key: string): number | null => {
  const breakdown = snapshot.breakdown_json;
  if (!breakdown || typeof breakdown !== 'object' || Array.isArray(breakdown)) return null;
  return toRoundedInt((breakdown as Record<string, unknown>)[key]);
};

const deriveMarginRate = (baseAmount: number | null, preFeeAmount: number | null): number | null => {
  if (baseAmount == null || preFeeAmount == null || baseAmount <= 0 || preFeeAmount < baseAmount) return null;
  return (preFeeAmount - baseAmount) / baseAmount;
};

const deriveFeeRate = (candidatePreFeeKrw: number | null, candidatePriceKrw: number | null): number | null => {
  if (candidatePreFeeKrw == null || candidatePriceKrw == null || candidatePriceKrw <= 0 || candidatePreFeeKrw > candidatePriceKrw) return null;
  return 1 - (candidatePreFeeKrw / candidatePriceKrw);
};

const deriveGuardrailRate = (costSumKrw: number | null, feeRate: number | null, guardrailPriceKrw: number | null): number | null => {
  if (costSumKrw == null || feeRate == null || guardrailPriceKrw == null || guardrailPriceKrw <= 0) return null;
  return 1 - feeRate - (costSumKrw / guardrailPriceKrw);
};

const nearlyEqual = (left: number | null, right: number | null): boolean => (
  left !== null && right !== null && Math.abs(left - right) < 1
);

const resolveSelectedPriceBasis = (args: {
  selectedPriceKrw: number | null;
  overridePriceKrw: number | null;
  floorPriceKrw: number | null;
  floorClamped: boolean | null;
  guardrailPriceKrw: number | null;
  roundedTargetPriceKrw: number | null;
  candidatePriceKrw: number | null;
  publishedBasePriceKrw: number | null;
}): string | null => {
  const selected = args.selectedPriceKrw;
  if (selected === null) return null;
  if (nearlyEqual(selected, args.overridePriceKrw)) return 'override';
  if (args.floorClamped && nearlyEqual(selected, args.floorPriceKrw)) return 'floor';
  if (nearlyEqual(selected, args.guardrailPriceKrw)) return 'guardrail';
  if (nearlyEqual(selected, args.roundedTargetPriceKrw)) return 'rounding';
  if (nearlyEqual(selected, args.candidatePriceKrw)) return 'candidate';
  if (nearlyEqual(selected, args.publishedBasePriceKrw)) return 'published';
  return null;
};

const parseLaborComponents = (value: unknown): DetailedLaborComponent[] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, Record<string, unknown>>)
    .map(([key, component]) => ({
      key,
      label: LABOR_COMPONENT_LABELS[key] ?? key,
      costExcludingAbsorbKrw: toRoundedInt(component?.labor_cost_krw),
      sellExcludingAbsorbKrw: toRoundedInt(component?.labor_sell_krw),
      absorbRawKrw: toRoundedInt(component?.labor_absorb_raw_krw),
      absorbAppliedKrw: toRoundedInt(component?.labor_absorb_applied_krw),
      costIncludingAbsorbKrw: toRoundedInt(component?.labor_cost_plus_absorb_krw),
      sellIncludingAbsorbKrw: toRoundedInt(component?.labor_sell_plus_absorb_krw),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'ko'));
};

export function buildBaseBreakdownRows(args: {
  publishedBasePriceKrw: number | null | undefined;
  targetPriceRawKrw?: number | null | undefined;
  snapshot?: SnapshotLike | null | undefined;
}): BaseBreakdownRow[] {
  const rows: BaseBreakdownRow[] = [];
  const publishedBasePriceKrw = toRoundedInt(args.publishedBasePriceKrw);
  const targetPriceRawKrw = toRoundedInt(args.targetPriceRawKrw);
  const snapshot = args.snapshot ?? null;

  const pushRow = (label: string, amount: unknown, detail?: string | null) => {
    const amountKrw = toRoundedInt(amount);
    if (amountKrw === null) return;
    rows.push({ label, amountKrw, detail: detail ?? null });
  };

  if (snapshot) {
    const materialCode = toStringOrNull(snapshot.material_code_effective);
    const hasV2SelectedPrice = toRoundedInt(snapshot.final_target_price_v2_krw) !== null;
    pushRow('소재 구성', snapshot.material_final_krw, materialCode ? materialCode + ' 기준' : null);
    pushRow('공임 구성', snapshot.labor_cost_applied_krw ?? snapshot.labor_sell_total_plus_absorb_krw);
    pushRow('고정 구성', snapshot.fixed_pre_fee_krw);
    pushRow('후보 기준가', snapshot.candidate_price_krw);
    pushRow('가드레일', snapshot.guardrail_price_krw, toStringOrNull(snapshot.guardrail_reason_code));
    if (!hasV2SelectedPrice) pushRow('반올림', snapshot.rounded_target_price_krw);
  } else if (targetPriceRawKrw !== null) {
    pushRow('계산 목표가', targetPriceRawKrw, 'publish raw target');
  }

  if (publishedBasePriceKrw !== null) {
    pushRow('게시 기준가', publishedBasePriceKrw);
  }

  return rows;
}

export function buildDetailedBaseBreakdown(args: {
  snapshot?: SnapshotLike | null | undefined;
  publishedBasePriceKrw?: number | null | undefined;
}): DetailedBaseBreakdown | null {
  const snapshot = args.snapshot ?? null;
  if (!snapshot) return null;

  const materialBasis = toStringOrNull(snapshot.material_basis_resolved);
  const effectiveTick = toRoundedInt(snapshot.effective_tick_krw_g);
  const goldTick = toRoundedInt(snapshot.tick_gold_krw_g);
  const silverTick = toRoundedInt(snapshot.tick_silver_krw_g);
  const marketTickKrwPerG = effectiveTick ?? (materialBasis === 'GOLD' ? goldTick : materialBasis === 'SILVER' ? silverTick : null);
  const purityRate = toNumberOrNull(snapshot.material_purity_rate_resolved);
  const adjustFactor = toNumberOrNull(snapshot.material_adjust_factor_resolved);
  const fallbackFactor = toNumberOrNull(snapshot.material_factor_multiplier_used);
  const effectiveFactor = purityRate !== null || adjustFactor !== null
    ? (purityRate ?? 1) * (adjustFactor ?? 1)
    : fallbackFactor;
  const netWeightG = toNumberOrNull(snapshot.net_weight_g);
  const convertedWeightG = netWeightG !== null && effectiveFactor !== null ? netWeightG * effectiveFactor : null;
  const laborComponents = parseLaborComponents(snapshot.labor_component_json);

  const materialPriceKrw = toRoundedInt(snapshot.material_final_krw);
  const materialAfterMarginKrw = toRoundedInt(snapshot.material_pre_fee_krw);
  const laborAbsorbRawKrw = toRoundedInt(snapshot.absorb_total_raw_krw ?? snapshot.absorb_total_krw_raw ?? snapshot.absorb_total_krw);
  const laborAbsorbAppliedKrw = toRoundedInt(snapshot.absorb_total_applied_krw ?? snapshot.absorb_total_krw_applied ?? snapshot.absorb_total_krw);
  const laborCostExcludingAbsorbFromComponentsKrw = sumRoundedInts(laborComponents.map((component) => component.costExcludingAbsorbKrw));
  const laborCostIncludingAbsorbFromComponentsKrw = sumRoundedInts(laborComponents.map((component) => component.costIncludingAbsorbKrw));
  const laborCostIncludingAbsorbKrw = toRoundedInt(snapshot.labor_cost_applied_krw) ?? laborCostIncludingAbsorbFromComponentsKrw;
  const laborCostExcludingAbsorbKrw = laborCostIncludingAbsorbKrw !== null && laborAbsorbAppliedKrw !== null
    ? Math.max(0, laborCostIncludingAbsorbKrw - laborAbsorbAppliedKrw)
    : laborCostExcludingAbsorbFromComponentsKrw;
  const laborExcludingAbsorbKrw = laborCostExcludingAbsorbKrw ?? toRoundedInt(snapshot.labor_sell_total_krw);
  const laborIncludingAbsorbKrw = laborCostIncludingAbsorbKrw ?? toRoundedInt(snapshot.labor_sell_total_plus_absorb_krw) ?? laborExcludingAbsorbKrw;
  const laborAfterMarginKrw = toRoundedInt(snapshot.labor_pre_fee_krw);
  const candidatePreFeeKrw = toRoundedInt(snapshot.candidate_pre_fee_krw);
  const candidatePriceKrw = toRoundedInt(snapshot.candidate_price_krw);
  const selectedPriceV2Krw = toRoundedInt(snapshot.final_target_price_v2_krw);
  const costSumKrw = toRoundedInt(snapshot.cost_sum_krw);
  const marginMultiplier = toNumberOrNull(snapshot.shop_margin_multiplier);
  const legacyMarginRate = marginMultiplier !== null ? marginMultiplier - 1 : null;
  const materialMarginRate = toNumberOrNull(snapshot.gm_material_rate) ?? deriveMarginRate(materialPriceKrw, materialAfterMarginKrw) ?? legacyMarginRate;
  const laborMarginRate = toNumberOrNull(snapshot.gm_labor_rate) ?? deriveMarginRate(laborIncludingAbsorbKrw, laborAfterMarginKrw) ?? legacyMarginRate;
  const fixedMarginRate = toNumberOrNull(snapshot.gm_fixed_rate) ?? deriveMarginRate(costSumKrw != null && materialAfterMarginKrw != null && laborAfterMarginKrw != null && candidatePreFeeKrw != null ? Math.max(0, candidatePreFeeKrw - materialAfterMarginKrw - laborAfterMarginKrw) : null, toRoundedInt(snapshot.fixed_pre_fee_krw)) ?? legacyMarginRate;
  const feeRate = toNumberOrNull(snapshot.fee_rate) ?? deriveFeeRate(candidatePreFeeKrw, candidatePriceKrw);
  const guardrailRate = toNumberOrNull(snapshot.min_margin_rate_total) ?? deriveGuardrailRate(costSumKrw, feeRate, toRoundedInt(snapshot.guardrail_price_krw ?? snapshot.min_margin_price_krw));
  const selectedPriceKrw = toRoundedInt(snapshot.final_target_price_v2_krw ?? snapshot.final_target_price_krw ?? args.publishedBasePriceKrw);
  const liveStorefrontPriceKrw = toRoundedInt(snapshot.current_channel_price_krw);
  const storefrontPriceSource = liveStorefrontPriceKrw !== null ? 'LIVE' : toRoundedInt(args.publishedBasePriceKrw) !== null ? 'PUBLISHED_PREVIEW' : null;
  const storefrontPriceKrw = liveStorefrontPriceKrw ?? toRoundedInt(args.publishedBasePriceKrw);
  const storefrontDiffKrw = toRoundedInt(snapshot.diff_krw ?? (selectedPriceKrw !== null && storefrontPriceKrw !== null ? selectedPriceKrw - storefrontPriceKrw : null));
  const storefrontDiffPct = toNumberOrNull(snapshot.diff_pct);
  const storefrontSyncPass = storefrontDiffKrw === null ? null : Math.abs(storefrontDiffKrw) < 1;
  const storefrontCompareStatus = storefrontPriceKrw == null || selectedPriceKrw == null
    ? "UNAVAILABLE"
    : storefrontSyncPass
      ? "MATCH"
      : "OUT_OF_SYNC";
  const laborComponentByKey = new Map(laborComponents.map((component) => [component.key, component]));
  const baseLaborComponent = laborComponentByKey.get('BASE_LABOR') ?? null;
  const stoneLaborComponent = laborComponentByKey.get('STONE_LABOR') ?? null;
  const platingLaborComponent = laborComponentByKey.get('PLATING') ?? null;
  const decorLaborComponent = laborComponentByKey.get('DECOR') ?? null;
  const etcLaborComponent = laborComponentByKey.get('ETC') ?? null;

  return {
    marketTickLabel: materialBasis,
    marketTickKrwPerG,
    marketTickAsOf: toStringOrNull((snapshot as { tick_as_of?: unknown }).tick_as_of) ?? toStringOrNull(snapshot.computed_at),
    materialCodeEffective: toStringOrNull(snapshot.material_code_effective),
    netWeightG,
    purityRate,
    adjustFactor,
    effectiveFactor,
    convertedWeightG,
    materialPriceKrw,
    materialMarginRate,
    materialMarginAmountKrw: materialPriceKrw !== null && materialAfterMarginKrw !== null ? materialAfterMarginKrw - materialPriceKrw : null,
    materialPriceAfterMarginKrw: materialAfterMarginKrw,
    laborTotalExcludingAbsorbKrw: laborExcludingAbsorbKrw,
    laborTotalAbsorbRawKrw: laborAbsorbRawKrw,
    laborTotalAbsorbAppliedKrw: laborAbsorbAppliedKrw,
    laborTotalIncludingAbsorbKrw: laborIncludingAbsorbKrw,
    laborMarginRate,
    laborMarginAmountKrw: laborIncludingAbsorbKrw !== null && laborAfterMarginKrw !== null ? laborAfterMarginKrw - laborIncludingAbsorbKrw : null,
    laborPriceAfterMarginKrw: laborAfterMarginKrw,
    laborMasterSellKrw: toRoundedInt(snapshot.labor_sell_master_krw) ?? readBreakdownNumber(snapshot, 'labor_sot_master_sell_krw') ?? (((baseLaborComponent?.sellIncludingAbsorbKrw ?? 0) + (stoneLaborComponent?.sellIncludingAbsorbKrw ?? 0) + (platingLaborComponent?.sellIncludingAbsorbKrw ?? 0) + (etcLaborComponent?.sellIncludingAbsorbKrw ?? 0)) || null),
    laborStoneSellKrw: stoneLaborComponent?.sellIncludingAbsorbKrw ?? null,
    laborDecorSellKrw: toRoundedInt(snapshot.labor_sell_decor_krw) ?? readBreakdownNumber(snapshot, 'labor_sot_decor_sell_krw') ?? decorLaborComponent?.sellIncludingAbsorbKrw ?? null,
    laborBaseSellKrw: toRoundedInt(snapshot.master_labor_base_sell_krw) ?? baseLaborComponent?.sellIncludingAbsorbKrw ?? null,
    laborCenterSellKrw: toRoundedInt(snapshot.master_labor_center_sell_krw),
    laborSub1SellKrw: toRoundedInt(snapshot.master_labor_sub1_sell_krw),
    laborSub2SellKrw: toRoundedInt(snapshot.master_labor_sub2_sell_krw),
    laborPlatingSellKrw: toRoundedInt(snapshot.master_plating_sell_krw) ?? platingLaborComponent?.sellIncludingAbsorbKrw ?? null,
    absorbBaseLaborKrw: toRoundedInt(snapshot.absorb_base_labor_krw) ?? baseLaborComponent?.absorbAppliedKrw ?? null,
    absorbStoneLaborKrw: toRoundedInt(snapshot.absorb_stone_labor_krw) ?? stoneLaborComponent?.absorbAppliedKrw ?? null,
    absorbPlatingKrw: toRoundedInt(snapshot.absorb_plating_krw) ?? platingLaborComponent?.absorbAppliedKrw ?? null,
    absorbEtcKrw: toRoundedInt(snapshot.absorb_etc_krw) ?? etcLaborComponent?.absorbAppliedKrw ?? null,
    fixedMarginRate,
    fixedPreFeeKrw: toRoundedInt(snapshot.fixed_pre_fee_krw),
    candidatePreFeeKrw,
    costSumKrw,
    feeRate,
    feeMarginAmountKrw: candidatePreFeeKrw !== null && candidatePriceKrw !== null ? candidatePriceKrw - candidatePreFeeKrw : null,
    candidatePriceKrw,
    guardrailRate,
    guardrailPriceKrw: toRoundedInt(snapshot.guardrail_price_krw ?? snapshot.min_margin_price_krw),
    guardrailReasonCode: toStringOrNull(snapshot.guardrail_reason_code),
    roundedTargetPriceKrw: selectedPriceV2Krw !== null ? null : toRoundedInt(snapshot.rounded_target_price_krw),
    roundingUnitKrw: toRoundedInt((snapshot as { rounding_unit_used?: unknown }).rounding_unit_used),
    roundingMode: toStringOrNull((snapshot as { rounding_mode_used?: unknown }).rounding_mode_used),
    selectedPriceKrw,
    selectedPriceBasis: resolveSelectedPriceBasis({
      selectedPriceKrw,
      overridePriceKrw: toRoundedInt(snapshot.override_price_krw),
      floorPriceKrw: toRoundedInt(snapshot.floor_price_krw),
      floorClamped: toBooleanOrNull(snapshot.floor_clamped),
      guardrailPriceKrw: toRoundedInt(snapshot.guardrail_price_krw ?? snapshot.min_margin_price_krw),
      roundedTargetPriceKrw: selectedPriceV2Krw !== null ? null : toRoundedInt(snapshot.rounded_target_price_krw),
      candidatePriceKrw,
      publishedBasePriceKrw: toRoundedInt(args.publishedBasePriceKrw),
    }),
    storefrontPriceKrw,
    storefrontPriceSource,
    storefrontDiffKrw,
    storefrontDiffPct,
    storefrontSyncPass,
    storefrontCompareStatus,
    laborComponents,
  };
}
