export type MaterialCode = "14" | "18" | "24" | "925" | "999" | "00";

export type MaterialFactorConfigRow = {
  material_code: MaterialCode;
  purity_rate: number;
  gold_adjust_factor: number;
};

export type MaterialFactorMap = Record<MaterialCode, MaterialFactorConfigRow>;

export type MaterialFactorResult = {
  materialCode: MaterialCode;
  purityRate: number;
  adjustApplied: number;
  effectiveFactor: number;
};

const DEFAULT_ROWS: MaterialFactorConfigRow[] = [
  { material_code: "14", purity_rate: 0.585, gold_adjust_factor: 1.1 },
  { material_code: "18", purity_rate: 0.75, gold_adjust_factor: 1.1 },
  { material_code: "24", purity_rate: 1, gold_adjust_factor: 1 },
  { material_code: "925", purity_rate: 0.925, gold_adjust_factor: 1 },
  { material_code: "999", purity_rate: 1, gold_adjust_factor: 1 },
  { material_code: "00", purity_rate: 0, gold_adjust_factor: 1 },
];

export function normalizeMaterialCode(raw: string | null | undefined): MaterialCode {
  const value = String(raw ?? "").trim().toUpperCase();
  if (value === "14" || value === "14K") return "14";
  if (value === "18" || value === "18K") return "18";
  if (value === "24" || value === "24K" || value === "PURE") return "24";
  if (value === "925" || value === "S925") return "925";
  if (value === "999" || value === "S999") return "999";
  return "00";
}

export function buildMaterialFactorMap(
  rows: Array<MaterialFactorConfigRow | null | undefined> | null | undefined
): MaterialFactorMap {
  const map = Object.fromEntries(DEFAULT_ROWS.map((row) => [row.material_code, row])) as MaterialFactorMap;
  for (const row of rows ?? []) {
    if (!row) continue;
    map[row.material_code] = {
      material_code: row.material_code,
      purity_rate: Number(row.purity_rate ?? 0),
      gold_adjust_factor: Number(row.gold_adjust_factor ?? 1),
    };
  }
  return map;
}

export function getMaterialFactor(args: {
  materialCode: string | null | undefined;
  factors?: MaterialFactorMap | null;
  silverAdjustApplied?: number | null;
  goldAdjustOverride?: number | null;
}): MaterialFactorResult {
  const materialCode = normalizeMaterialCode(args.materialCode);
  const factors = args.factors ?? buildMaterialFactorMap(null);
  const row = factors[materialCode];
  const purityRate = Number(row?.purity_rate ?? 0);

  let adjustApplied = 1;
  if (materialCode === "14" || materialCode === "18" || materialCode === "24") {
    adjustApplied = Number(args.goldAdjustOverride ?? row?.gold_adjust_factor ?? 1);
  } else if (materialCode === "925" || materialCode === "999") {
    adjustApplied = Number(args.silverAdjustApplied ?? 1);
  }

  if (!Number.isFinite(adjustApplied) || adjustApplied <= 0) adjustApplied = 1;
  const effectiveFactor = purityRate * adjustApplied;

  return {
    materialCode,
    purityRate,
    adjustApplied,
    effectiveFactor,
  };
}

export function calcCommodityDueG(args: {
  netWeightG: number;
  materialCode: string | null | undefined;
  factors?: MaterialFactorMap | null;
  silverAdjustApplied?: number | null;
}): number {
  const netWeightG = Number(args.netWeightG ?? 0);
  if (!Number.isFinite(netWeightG) || netWeightG <= 0) return 0;
  const factor = getMaterialFactor(args).effectiveFactor;
  return netWeightG * factor;
}

export function calcMaterialAmountSellKrw(args: {
  netWeightG: number;
  tickPriceKrwPerG: number;
  materialCode: string | null | undefined;
  factors?: MaterialFactorMap | null;
  silverAdjustApplied?: number | null;
}): number {
  const net = Number(args.netWeightG ?? 0);
  const tick = Number(args.tickPriceKrwPerG ?? 0);
  if (!Number.isFinite(net) || !Number.isFinite(tick) || net <= 0 || tick <= 0) return 0;
  const effective = getMaterialFactor(args).effectiveFactor;
  return Math.round(net * tick * effective);
}
