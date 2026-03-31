export type PriceEndingPolicyEditorRow = {
  min_krw: string;
  max_krw: string;
  allowed_endings: string;
};

type PriceEndingPolicyBand = {
  min_krw: number;
  max_krw: number | null;
  allowed_endings: number[];
  direction: "UP";
};

const normalizeNumberText = (value: unknown): string => String(value ?? "").replaceAll(",", "").trim();
const normalizeText = (value: unknown): string => String(value ?? "").trim();

const toRoundedInt = (value: unknown): number | null => {
  const normalized = normalizeNumberText(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

const normalizeEnding = (value: unknown): number | null => {
  const parsed = toRoundedInt(value);
  if (parsed === null || parsed < 0 || parsed > 999) return null;
  return parsed;
};

const normalizeBand = (input: unknown, index: number): PriceEndingPolicyBand => {
  const row = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const minKrw = toRoundedInt(row.min_krw) ?? 0;
  const rawMax = row.max_krw;
  const maxKrw = rawMax == null || rawMax === "" ? null : toRoundedInt(rawMax);
  const direction = String(row.direction ?? "UP").trim().toUpperCase();
  if (direction !== "UP") throw new Error(`bands[${index}].direction must be UP`);
  const allowedEndings = Array.from(new Set(
    (Array.isArray(row.allowed_endings) ? row.allowed_endings : [])
      .map((value) => normalizeEnding(value))
      .filter((value): value is number => value != null),
  )).sort((left, right) => left - right);
  return {
    min_krw: Math.max(0, minKrw),
    max_krw: maxKrw,
    allowed_endings: allowedEndings,
    direction: "UP",
  };
};

const validateBands = (bands: PriceEndingPolicyBand[]): string[] => {
  const errors: string[] = [];
  for (const [index, band] of bands.entries()) {
    if (!Number.isFinite(band.min_krw) || band.min_krw < 0) errors.push(`bands[${index}].min_krw must be >= 0`);
    if (band.max_krw !== null && (!Number.isFinite(band.max_krw) || band.max_krw < band.min_krw)) {
      errors.push(`bands[${index}].max_krw must be null or >= min_krw`);
    }
    if (band.direction !== "UP") errors.push(`bands[${index}].direction must be UP`);
    if (!Array.isArray(band.allowed_endings) || band.allowed_endings.length === 0) {
      errors.push(`bands[${index}].allowed_endings must contain at least one ending`);
    }
    for (const ending of band.allowed_endings) {
      if (!Number.isInteger(ending) || ending < 0 || ending > 999) {
        errors.push(`bands[${index}].allowed_endings must contain integers between 0 and 999`);
        break;
      }
    }
  }

  const orderedBands = [...bands].sort((left, right) => left.min_krw - right.min_krw);
  for (let index = 1; index < orderedBands.length; index += 1) {
    const previous = orderedBands[index - 1];
    const current = orderedBands[index];
    if (previous.max_krw === null || previous.max_krw >= current.min_krw) {
      errors.push("price ending bands must not overlap");
      break;
    }
  }

  return errors;
};

export function createPriceEndingPolicyEditorRow(): PriceEndingPolicyEditorRow {
  return { min_krw: "", max_krw: "", allowed_endings: "" };
}

export function priceEndingPolicyBandsToEditorRows(input: unknown): PriceEndingPolicyEditorRow[] {
  if (!Array.isArray(input)) return [];
  return input.map((band, index) => normalizeBand(band, index)).map((band) => ({
    min_krw: String(band.min_krw),
    max_krw: band.max_krw == null ? "" : String(band.max_krw),
    allowed_endings: band.allowed_endings.join(", "),
  }));
}

export function priceEndingPolicyEditorRowsToBands(rows: PriceEndingPolicyEditorRow[]): PriceEndingPolicyBand[] {
  const rawBands = (Array.isArray(rows) ? rows : []).flatMap((row, index) => {
    const minKrw = normalizeNumberText(row.min_krw);
    const maxKrw = normalizeNumberText(row.max_krw);
    const allowedEndingsInput = normalizeText(row.allowed_endings);

    if (!minKrw && !maxKrw && !allowedEndingsInput) return [];
    if (!minKrw) throw new Error(`bands[${index}].min_krw is required`);
    if (!allowedEndingsInput) throw new Error(`bands[${index}].allowed_endings is required`);

    const allowedEndings = allowedEndingsInput
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (allowedEndings.length === 0) {
      throw new Error(`bands[${index}].allowed_endings is required`);
    }

    return [{
      min_krw: minKrw,
      max_krw: maxKrw || null,
      allowed_endings: allowedEndings,
      direction: "UP",
    }];
  });

  const bands = rawBands.map((band, index) => normalizeBand(band, index));
  const errors = validateBands(bands);
  if (errors.length > 0) {
    throw new Error(errors[0]);
  }
  return bands;
}
