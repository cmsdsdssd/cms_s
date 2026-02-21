export type MaterialCode = string;

export type MaterialFactorConfigRow = {
  material_code: MaterialCode;
  purity_rate: number;
  material_adjust_factor: number;
  gold_adjust_factor?: number;
  price_basis?: "GOLD" | "SILVER" | "NONE";
};

export type MaterialFactorMap = Record<string, MaterialFactorConfigRow>;

export type MaterialFactorResult = {
  materialCode: MaterialCode;
  purityRate: number;
  adjustApplied: number;
  effectiveFactor: number;
};

const DEFAULT_ROWS: MaterialFactorConfigRow[] = [
  { material_code: "14", purity_rate: 0.585, material_adjust_factor: 1.1, price_basis: "GOLD" },
  { material_code: "18", purity_rate: 0.75, material_adjust_factor: 1.1, price_basis: "GOLD" },
  { material_code: "24", purity_rate: 1, material_adjust_factor: 1, price_basis: "GOLD" },
  { material_code: "925", purity_rate: 0.925, material_adjust_factor: 1, price_basis: "SILVER" },
  { material_code: "999", purity_rate: 1, material_adjust_factor: 1, price_basis: "SILVER" },
  { material_code: "00", purity_rate: 0, material_adjust_factor: 1, price_basis: "NONE" },
];

export function normalizeMaterialCode(raw: string | null | undefined): MaterialCode {
  const value = String(raw ?? "").trim().toUpperCase();
  if (value === "14" || value === "14K") return "14";
  if (value === "18" || value === "18K") return "18";
  if (value === "24" || value === "24K" || value === "PURE") return "24";
  if (value === "925" || value === "S925") return "925";
  if (value === "999" || value === "S999") return "999";
  if (value === "") return "00";
  return value;
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
      material_adjust_factor: Number(row.material_adjust_factor ?? row.gold_adjust_factor ?? 1),
      gold_adjust_factor: Number(row.gold_adjust_factor ?? row.material_adjust_factor ?? 1),
      price_basis: row.price_basis ?? map[row.material_code].price_basis,
    };
  }
  return map;
}

export function getMaterialFactor(args: {
  materialCode: string | null | undefined;
  factors?: MaterialFactorMap | null;
  marketAdjustApplied?: number | null;
  silverAdjustApplied?: number | null;
  materialAdjustOverride?: number | null;
  goldAdjustOverride?: number | null;
}): MaterialFactorResult {
  const materialCode = normalizeMaterialCode(args.materialCode);
  const factors = args.factors ?? buildMaterialFactorMap(null);
  const row =
    factors[materialCode] ??
    ({ material_code: materialCode, purity_rate: 0, material_adjust_factor: 1, price_basis: "NONE" } as MaterialFactorConfigRow);
  const purityRate = Number(row?.purity_rate ?? 0);

  const baseAdjust = Number(
    args.materialAdjustOverride ?? args.goldAdjustOverride ?? row?.material_adjust_factor ?? row?.gold_adjust_factor ?? 1
  );
  const basis = row?.price_basis ?? (materialCode === "00" ? "NONE" : "GOLD");
  let adjustApplied = baseAdjust;
  if (basis === "NONE") adjustApplied = 1;

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
