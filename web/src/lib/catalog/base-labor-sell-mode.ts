export type BaseLaborSellMode = "RULE" | "MULTIPLIER";

type ResolveBaseLaborSellParams = {
  mode: BaseLaborSellMode;
  costKrw: number;
  multiplier?: number | null;
  pickRuleSell: (costKrw: number) => Promise<number> | number;
};

type BaseLaborSellConfigLike = {
  base_labor_sell_mode?: string | null;
  base_labor_sell_multiplier?: number | null;
};

type ResolvedBaseLaborSellConfig = {
  mode: BaseLaborSellMode;
  multiplier: number | null;
};

const DEFAULT_BASE_LABOR_SELL_CONFIG: ResolvedBaseLaborSellConfig = {
  mode: "RULE",
  multiplier: null,
};

export function resolveBaseLaborSellConfig(
  config: BaseLaborSellConfigLike | null | undefined
): ResolvedBaseLaborSellConfig {
  if (!config) return DEFAULT_BASE_LABOR_SELL_CONFIG;

  const mode = config.base_labor_sell_mode === "MULTIPLIER" ? "MULTIPLIER" : "RULE";
  const multiplier = Number(config.base_labor_sell_multiplier ?? Number.NaN);

  if (mode === "MULTIPLIER") {
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      return DEFAULT_BASE_LABOR_SELL_CONFIG;
    }

    return { mode: "MULTIPLIER", multiplier };
  }

  return DEFAULT_BASE_LABOR_SELL_CONFIG;
}

export async function resolveBaseLaborSell({
  mode,
  costKrw,
  multiplier,
  pickRuleSell,
}: ResolveBaseLaborSellParams): Promise<number> {
  const normalizedCost = Number(costKrw);
  if (!Number.isFinite(normalizedCost) || normalizedCost < 0) {
    throw new Error("costKrw must be a non-negative finite number");
  }

  if (mode === "MULTIPLIER") {
    const normalizedMultiplier = Number(multiplier);
    if (!Number.isFinite(normalizedMultiplier) || normalizedMultiplier <= 0) {
      throw new Error("multiplier must be a positive finite number in MULTIPLIER mode");
    }
    return normalizedCost * normalizedMultiplier;
  }

  return await pickRuleSell(normalizedCost);
}
