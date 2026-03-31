import {
  normalizePriceSyncThresholdProfile,
  resolveEffectiveMinChangeKrw,
  resolveEffectiveOptionAdditionalMinChangeKrw,
  resolvePriceSyncThresholdProfilePolicy,
} from "./price-sync-policy.js";

export type VariantCompareStatus = "MATCH" | "THRESHOLD_HELD" | "OUT_OF_SYNC" | "UNAVAILABLE";

export type CompareThresholdPolicy = {
  thresholdProfile: "GENERAL" | "MARKET_LINKED";
  minChangeKrw: number;
  minChangeRate: number;
};

type ThresholdPolicyInput = {
  min_change_krw?: unknown;
  min_change_rate?: unknown;
};

type ResolveCompareThresholdPolicyArgs = {
  policyThresholdProfile?: unknown;
  currentProductSyncProfile?: unknown;
  policyMinChangeKrw?: unknown;
  policyMinChangeRate?: unknown;
};

type ResolveVariantCompareStateArgs = {
  desiredBasePriceKrw?: unknown;
  publishedBasePriceKrw?: unknown;
  desiredAdditionalKrw?: unknown;
  publishedAdditionalKrw?: unknown;
  baseThresholdPolicy?: ThresholdPolicyInput | null;
  optionThresholdPolicy?: ThresholdPolicyInput | null;
};

export type VariantCompareState = {
  status: VariantCompareStatus;
  desiredTotalKrw: number | null;
  publishedTotalKrw: number | null;
  totalDiffKrw: number | null;
  baseDiffKrw: number | null;
  optionDiffKrw: number | null;
  effectiveBaseThresholdKrw: number | null;
  effectiveOptionThresholdKrw: number | null;
};

const toRoundedInt = (value: unknown): number | null => {
  const numeric = Number(value ?? Number.NaN);
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
};

export function resolveCompareThresholdPolicy(args: ResolveCompareThresholdPolicyArgs): CompareThresholdPolicy {
  const policyThresholdProfile = normalizePriceSyncThresholdProfile(args.policyThresholdProfile);
  const policyMinChangeKrw = toRoundedInt(args.policyMinChangeKrw) ?? resolvePriceSyncThresholdProfilePolicy(policyThresholdProfile).min_change_krw;
  const policyMinChangeRate = Number(args.policyMinChangeRate ?? Number.NaN);
  const normalizedPolicyMinChangeRate = Number.isFinite(policyMinChangeRate)
    ? policyMinChangeRate
    : resolvePriceSyncThresholdProfilePolicy(policyThresholdProfile).min_change_rate;

  const currentProductSyncProfile = String(args.currentProductSyncProfile ?? "").trim();
  if (!currentProductSyncProfile) {
    return {
      thresholdProfile: policyThresholdProfile,
      minChangeKrw: policyMinChangeKrw,
      minChangeRate: normalizedPolicyMinChangeRate,
    };
  }

  const effectiveThresholdProfile = normalizePriceSyncThresholdProfile(currentProductSyncProfile);
  if (effectiveThresholdProfile === policyThresholdProfile) {
    return {
      thresholdProfile: policyThresholdProfile,
      minChangeKrw: policyMinChangeKrw,
      minChangeRate: normalizedPolicyMinChangeRate,
    };
  }

  const preset = resolvePriceSyncThresholdProfilePolicy(effectiveThresholdProfile);
  return {
    thresholdProfile: effectiveThresholdProfile,
    minChangeKrw: preset.min_change_krw,
    minChangeRate: preset.min_change_rate,
  };
}

export function resolveVariantCompareState(args: ResolveVariantCompareStateArgs): VariantCompareState {
  const desiredBasePriceKrw = toRoundedInt(args.desiredBasePriceKrw);
  const publishedBasePriceKrw = toRoundedInt(args.publishedBasePriceKrw);
  const desiredAdditionalKrw = toRoundedInt(args.desiredAdditionalKrw);
  const publishedAdditionalKrw = toRoundedInt(args.publishedAdditionalKrw);

  if (
    desiredBasePriceKrw === null
    || publishedBasePriceKrw === null
    || desiredAdditionalKrw === null
    || publishedAdditionalKrw === null
  ) {
    return {
      status: "UNAVAILABLE",
      desiredTotalKrw: null,
      publishedTotalKrw: null,
      totalDiffKrw: null,
      baseDiffKrw: null,
      optionDiffKrw: null,
      effectiveBaseThresholdKrw: null,
      effectiveOptionThresholdKrw: null,
    };
  }

  const desiredTotalKrw = desiredBasePriceKrw + desiredAdditionalKrw;
  const publishedTotalKrw = publishedBasePriceKrw + publishedAdditionalKrw;
  const baseDiffKrw = Math.abs(desiredBasePriceKrw - publishedBasePriceKrw);
  const optionDiffKrw = Math.abs(desiredAdditionalKrw - publishedAdditionalKrw);
  const totalDiffKrw = Math.abs(desiredTotalKrw - publishedTotalKrw);

  if (totalDiffKrw === 0) {
    return {
      status: "MATCH",
      desiredTotalKrw,
      publishedTotalKrw,
      totalDiffKrw,
      baseDiffKrw,
      optionDiffKrw,
      effectiveBaseThresholdKrw: 0,
      effectiveOptionThresholdKrw: 0,
    };
  }

  const effectiveBaseThresholdKrw = resolveEffectiveMinChangeKrw({
    currentPriceKrw: publishedBasePriceKrw,
    policy: args.baseThresholdPolicy ?? undefined,
  });
  const optionThreshold = resolveEffectiveOptionAdditionalMinChangeKrw({
    currentAdditionalKrw: publishedAdditionalKrw,
    policy: args.optionThresholdPolicy ?? undefined,
  });
  const effectiveOptionThresholdKrw = optionThreshold.effectiveMinChangeKrw;
  const baseHeld = baseDiffKrw === 0 || baseDiffKrw < effectiveBaseThresholdKrw;
  const optionHeld = optionDiffKrw === 0 || optionDiffKrw < effectiveOptionThresholdKrw;

  return {
    status: baseHeld && optionHeld ? "THRESHOLD_HELD" : "OUT_OF_SYNC",
    desiredTotalKrw,
    publishedTotalKrw,
    totalDiffKrw,
    baseDiffKrw,
    optionDiffKrw,
    effectiveBaseThresholdKrw,
    effectiveOptionThresholdKrw,
  };
}
