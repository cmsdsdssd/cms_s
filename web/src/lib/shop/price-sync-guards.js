export const CRON_TICK_ERROR_PREFIX = "CRON_TICK:";

export const parseCronTickReason = (errorMessage) => {
  const raw = String(errorMessage ?? "").trim();
  if (!raw.toUpperCase().startsWith(CRON_TICK_ERROR_PREFIX)) return null;
  const reason = raw.slice(CRON_TICK_ERROR_PREFIX.length).trim();
  return reason || null;
};

export const isCronTickError = (errorMessage) => parseCronTickReason(errorMessage) !== null;

export const restoreVariantTargetFromRawDelta = ({
  targetPrice,
  baseFinalTarget,
  baseRawTarget,
  variantRawTarget,
}) => {
  const normalizedTarget = Math.round(Number(targetPrice));
  const normalizedBaseFinal = Math.round(Number(baseFinalTarget));
  const normalizedBaseRaw = Number(baseRawTarget);
  const normalizedVariantRaw = Number(variantRawTarget);

  if (!Number.isFinite(normalizedTarget)) return Number.NaN;
  if (!Number.isFinite(normalizedBaseFinal)) return normalizedTarget;
  if (!Number.isFinite(normalizedBaseRaw) || !Number.isFinite(normalizedVariantRaw)) return normalizedTarget;

  const rawDelta = Math.round(normalizedVariantRaw - normalizedBaseRaw);
  if (rawDelta === 0) return normalizedTarget;
  if (normalizedTarget !== normalizedBaseFinal) return normalizedTarget;
  return normalizedBaseFinal + rawDelta;
};


const normalizeRoundedPositiveInt = (value) => {
  const numeric = Number(value ?? Number.NaN);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  return rounded > 0 ? rounded : null;
};

export const shouldAllowAutoMarketUplift = ({
  pricingAlgoVersion,
  baseTotalPreMarginKrw,
  marketAfterMarginKrw,
  baseTargetKrw,
}) => {
  const normalizedPricingAlgoVersion = String(pricingAlgoVersion ?? "").trim().toUpperCase();
  const normalizedBaseTotalPreMarginKrw = normalizeRoundedPositiveInt(baseTotalPreMarginKrw);
  const normalizedMarketAfterMarginKrw = normalizeRoundedPositiveInt(marketAfterMarginKrw);
  const normalizedBaseTargetKrw = normalizeRoundedPositiveInt(baseTargetKrw);

  if (normalizedPricingAlgoVersion === "REVERSE_FEE_V2") return false;
  if (
    normalizedBaseTotalPreMarginKrw === null
    || normalizedMarketAfterMarginKrw === null
    || normalizedBaseTargetKrw === null
  ) {
    return false;
  }
  if (normalizedMarketAfterMarginKrw < normalizedBaseTotalPreMarginKrw) return false;

  const sanityCeilingKrw = Math.max(normalizedBaseTotalPreMarginKrw, normalizedBaseTargetKrw) * 2;
  return normalizedMarketAfterMarginKrw <= sanityCeilingKrw;
};
