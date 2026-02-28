export type ShopRoundingMode = "CEIL" | "ROUND" | "FLOOR";

export type MaterialFactorConfigRow = {
  material_code: string;
  purity_rate: number | null;
  material_adjust_factor: number | null;
  gold_adjust_factor: number | null;
};

export type SyncRuleSetRow = {
  rule_set_id: string;
  channel_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

export type SyncRuleR1Row = {
  rule_id: string;
  rule_set_id: string;
  source_material_code: string | null;
  target_material_code: string;
  match_category_code: string | null;
  weight_min_g: number | null;
  weight_max_g: number | null;
  option_weight_multiplier: number;
  rounding_unit: number;
  rounding_mode: ShopRoundingMode;
  priority: number;
  is_active: boolean;
};

export type SyncRuleR2Row = {
  rule_id: string;
  rule_set_id: string;
  linked_r1_rule_id: string | null;
  match_material_code: string | null;
  match_category_code: string | null;
  weight_min_g: number;
  weight_max_g: number;
  option_range_expr: string;
  margin_min_krw: number | null;
  margin_max_krw: number | null;
  delta_krw: number;
  rounding_unit: number;
  rounding_mode: ShopRoundingMode;
  priority: number;
  is_active: boolean;
};

export type SyncRuleR3Row = {
  rule_id: string;
  rule_set_id: string;
  color_code: string;
  margin_min_krw: number;
  margin_max_krw: number;
  delta_krw: number;
  rounding_unit: number;
  rounding_mode: ShopRoundingMode;
  priority: number;
  is_active: boolean;
};

export type SyncRuleR4Row = {
  rule_id: string;
  rule_set_id: string;
  linked_r1_rule_id: string | null;
  match_decoration_code: string;
  match_material_code: string | null;
  match_color_code: string | null;
  match_category_code: string | null;
  delta_krw: number;
  rounding_unit: number;
  rounding_mode: ShopRoundingMode;
  priority: number;
  is_active: boolean;
};

export const toNum = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const normalizeRoundingUnit = (value: unknown, fallback = 100): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.round(n);
};

export const roundByRule = (value: number, unitRaw: unknown, modeRaw: unknown): number => {
  const unit = normalizeRoundingUnit(unitRaw, 100);
  const mode = String(modeRaw ?? "ROUND").toUpperCase();
  const ratio = value / unit;
  if (mode === "CEIL") return Math.ceil(ratio) * unit;
  if (mode === "FLOOR") return Math.floor(ratio) * unit;
  return Math.round(ratio) * unit;
};

export const isRangeMatched = (min: number | null, max: number | null, value: number): boolean => {
  if (min !== null && value < min) return false;
  if (max !== null && value > max) return false;
  return true;
};

export const parseOptionRangeExpr = (expr: string): ((value: number | null) => boolean) => {
  const text = String(expr ?? "").trim();
  if (!text) return () => false;

  const normalized = text.replace(/\s+/g, "");
  const rangeMatch = normalized.match(/^(-?\d+(?:\.\d+)?)[~\-](-?\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    const a = Number(rangeMatch[1]);
    const b = Number(rangeMatch[2]);
    const low = Math.min(a, b);
    const high = Math.max(a, b);
    return (value) => value !== null && Number.isFinite(value) && value >= low && value <= high;
  }

  const list = normalized
    .split(",")
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));
  if (list.length > 0) {
    return (value) => value !== null && list.includes(value);
  }

  const single = Number(normalized);
  if (Number.isFinite(single)) {
    return (value) => value !== null && value === single;
  }

  return () => false;
};

export const buildMaterialPurityMap = (rows: MaterialFactorConfigRow[]): Map<string, number> => {
  const map = new Map<string, number>();
  for (const row of rows) {
    const code = String(row.material_code ?? "").trim().toUpperCase();
    const purity = Number(row.purity_rate);
    if (!code || !Number.isFinite(purity) || purity < 0) continue;
    map.set(code, purity);
  }
  return map;
};

export const getMaterialPurityFromMap = (map: Map<string, number>, materialCodeRaw: string | null | undefined, fallback = 0): number => {
  const code = String(materialCodeRaw ?? "").trim().toUpperCase();
  if (!code) return fallback;
  return map.get(code) ?? fallback;
};

export const isSilverMaterial = (materialCodeRaw: string | null | undefined): boolean => {
  const code = String(materialCodeRaw ?? "").trim().toUpperCase();
  return code === "925" || code === "999";
};
