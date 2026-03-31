export type CatalogSaveStoneSource = "SELF" | "FACTORY";

export type CatalogSaveNormalizationInput = {
  laborBaseCost: number;
  laborCenterCost: number;
  laborSub1Cost: number;
  laborSub2Cost: number;
  platingCost: number;
  centerStoneSourceDefault: CatalogSaveStoneSource;
  sub1StoneSourceDefault: CatalogSaveStoneSource;
  sub2StoneSourceDefault: CatalogSaveStoneSource;
  centerSelfMargin: number;
  sub1SelfMargin: number;
  sub2SelfMargin: number;
};

export type CatalogSaveNormalizationResult = {
  laborBaseSell: number;
  laborCenterSell: number;
  laborSub1Sell: number;
  laborSub2Sell: number;
  platingSell: number;
};

type CatalogSaveNormalizationDeps = {
  resolveBaseLaborSell: (costKrw: number) => Promise<number>;
  resolveStoneSell: (params: {
    role: "CENTER" | "SUB1" | "SUB2";
    source: CatalogSaveStoneSource;
    costKrw: number;
    marginKrw: number;
  }) => Promise<number>;
  resolvePlatingSell: (costKrw: number) => Promise<number>;
};

export async function normalizeCatalogSaveSnapshot(
  input: CatalogSaveNormalizationInput,
  deps: CatalogSaveNormalizationDeps
): Promise<CatalogSaveNormalizationResult> {
  try {
    const [laborBaseSell, laborCenterSell, laborSub1Sell, laborSub2Sell, platingSell] = await Promise.all([
      deps.resolveBaseLaborSell(input.laborBaseCost),
      deps.resolveStoneSell({
        role: "CENTER",
        source: input.centerStoneSourceDefault,
        costKrw: input.laborCenterCost,
        marginKrw: input.centerSelfMargin,
      }),
      deps.resolveStoneSell({
        role: "SUB1",
        source: input.sub1StoneSourceDefault,
        costKrw: input.laborSub1Cost,
        marginKrw: input.sub1SelfMargin,
      }),
      deps.resolveStoneSell({
        role: "SUB2",
        source: input.sub2StoneSourceDefault,
        costKrw: input.laborSub2Cost,
        marginKrw: input.sub2SelfMargin,
      }),
      deps.resolvePlatingSell(input.platingCost),
    ]);

    return {
      laborBaseSell,
      laborCenterSell,
      laborSub1Sell,
      laborSub2Sell,
      platingSell,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown save normalization failure";
    throw new Error("Save-time normalization failed: " + message);
  }
}
