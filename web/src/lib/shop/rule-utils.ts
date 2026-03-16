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

export const STANDARD_PLATING_BASE_CODES = ["P", "G", "W", "B"] as const;
export const PLATING_PREFIX = "[도]";
const PLATING_PREFIX_PATTERN = /^\[도\]\s*/iu;

export const STANDARD_PLATING_COMBO_CODES = [
  "P",
  "G",
  "W",
  "B",
  "PG",
  "PW",
  "PB",
  "GW",
  "GB",
  "WB",
  "PGW",
  "PGB",
  "PWB",
  "GWB",
  "PGWB",
] as const;

const extractPlatingLetters = (value: string | null | undefined): string[] => {
  const text = String(value ?? "").trim().toUpperCase();
  if (!text) return [];
  const letterSet = new Set(text.replace(/[^PGWB]/g, "").split("").filter((ch) => ch.length > 0));
  return STANDARD_PLATING_BASE_CODES.filter((code) => letterSet.has(code));
};

const hasExplicitPlatingPrefix = (value: string | null | undefined): boolean => {
  const text = String(value ?? "").trim();
  return PLATING_PREFIX_PATTERN.test(text);
};

const stripPlatingPrefix = (value: string | null | undefined): string => {
  return String(value ?? "").trim().replace(PLATING_PREFIX_PATTERN, "").trim();
};

const looksLegacyImplicitPlatingCode = (value: string | null | undefined): boolean => {
  const text = String(value ?? "").trim().toUpperCase();
  if (!text) return false;
  if (hasExplicitPlatingPrefix(text)) return false;
  return /^[PGWB]+$/u.test(text);
};

export const isPlatingComboCode = (value: string | null | undefined): boolean => {
  const letters = extractPlatingLetters(value);
  if (letters.length === 0) return false;
  return hasExplicitPlatingPrefix(value) || looksLegacyImplicitPlatingCode(value);
};

export const normalizePlatingBaseCode = (value: string | null | undefined): string => {
  const letters = extractPlatingLetters(value);
  return letters.join("+");
};

export const normalizePlatingCatalogComboKey = (value: string | null | undefined): string => {
  const baseCode = normalizePlatingBaseCode(value);
  if (!baseCode) return "";
  return hasExplicitPlatingPrefix(value) ? `${PLATING_PREFIX} ${baseCode}` : baseCode;
};

export const formatPlatingComboLabel = (value: string | null | undefined): string => {
  return normalizePlatingCatalogComboKey(value);
};

export const normalizePlatingComboCode = (value: string | null | undefined): string => {
  const baseCode = normalizePlatingBaseCode(value);
  if (!baseCode) return "";
  return isPlatingComboCode(value) ? `${PLATING_PREFIX} ${baseCode}` : baseCode;
};

const STANDARD_PLATING_SORT_ORDER = new Map(
  STANDARD_PLATING_COMBO_CODES.map((code, index) => [normalizePlatingCatalogComboKey(code), (index + 1) * 10] as const),
);

const toFiniteSortOrder = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
};

export const getPlatingComboSortOrder = (value: string | null | undefined): number => {
  const normalized = normalizePlatingCatalogComboKey(value);
  if (!normalized) return Number.MAX_SAFE_INTEGER;
  const baseCode = stripPlatingPrefix(normalized);
  const baseOrder = STANDARD_PLATING_SORT_ORDER.get(baseCode) ?? Number.MAX_SAFE_INTEGER - 2000;
  return hasExplicitPlatingPrefix(normalized) ? baseOrder + 1000 : baseOrder;
};

export type PlatingComboChoice = {
  value: string;
  label: string;
  delta_krw: number | null;
  sort_order: number;
};

type PlatingComboCatalogRowLike = {
  combo_key?: string | null;
  display_name?: string | null;
  base_delta_krw?: number | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

export const buildPlatingComboChoices = (args?: {
  catalogRows?: PlatingComboCatalogRowLike[] | null;
  fallbackValues?: Array<string | null | undefined>;
  includeStandard?: boolean;
}): PlatingComboChoice[] => {
  const choices = new Map<string, PlatingComboChoice>();

  const register = (input: {
    rawValue: string | null | undefined;
    label?: string | null | undefined;
    delta_krw?: number | null | undefined;
    sort_order?: number | null | undefined;
    preferred?: boolean;
  }) => {
    const normalizedValue = normalizePlatingCatalogComboKey(input.rawValue);
    if (!normalizedValue) return;
    const nextChoice: PlatingComboChoice = {
      value: normalizedValue,
      label: normalizePlatingCatalogComboKey(String(input.label ?? "").trim()) || String(input.label ?? "").trim() || formatPlatingComboLabel(normalizedValue) || normalizedValue,
      delta_krw: Number.isFinite(Number(input.delta_krw)) ? Math.round(Number(input.delta_krw)) : null,
      sort_order: toFiniteSortOrder(input.sort_order, getPlatingComboSortOrder(normalizedValue)),
    };
    const existing = choices.get(normalizedValue);
    if (!existing) {
      choices.set(normalizedValue, nextChoice);
      return;
    }
    const shouldReplace = input.preferred === true
      || nextChoice.sort_order < existing.sort_order
      || (nextChoice.sort_order === existing.sort_order && nextChoice.label.length > existing.label.length);
    if (shouldReplace) {
      choices.set(normalizedValue, nextChoice);
    }
  };

  for (const row of args?.catalogRows ?? []) {
    if (row?.is_active === false) continue;
    register({
      rawValue: row?.combo_key,
      label: row?.display_name,
      delta_krw: row?.base_delta_krw,
      sort_order: row?.sort_order,
      preferred: true,
    });
  }

  if (args?.includeStandard !== false) {
    for (const code of STANDARD_PLATING_COMBO_CODES) {
      register({ rawValue: code, label: code, delta_krw: 0, sort_order: getPlatingComboSortOrder(code) });
      register({
        rawValue: `${PLATING_PREFIX} ${code}`,
        label: `${PLATING_PREFIX} ${code}`,
        delta_krw: 0,
        sort_order: getPlatingComboSortOrder(`${PLATING_PREFIX} ${code}`),
      });
    }
  }

  for (const value of args?.fallbackValues ?? []) {
    register({ rawValue: value, label: value, delta_krw: null, sort_order: getPlatingComboSortOrder(value) });
  }

  return Array.from(choices.values()).sort((left, right) => {
    if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
    const labelCompare = left.label.localeCompare(right.label);
    if (labelCompare !== 0) return labelCompare;
    return left.value.localeCompare(right.value);
  });
};

