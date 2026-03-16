export function resolveBaseMaterialFinalKrw(args: {
  useRuleSetEngine: boolean;
  applyRule1: boolean;
  baseMaterialPrice: number;
  materialRaw: number;
  factor: number;
  optionMaterialMultiplier: number;
}): number {
  if (args.useRuleSetEngine) return args.baseMaterialPrice;
  if (args.applyRule1) return args.materialRaw * args.factor * args.optionMaterialMultiplier;
  return args.baseMaterialPrice;
}
