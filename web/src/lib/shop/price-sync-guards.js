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
