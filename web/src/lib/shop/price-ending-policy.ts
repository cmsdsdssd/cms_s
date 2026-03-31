export type PriceEndingDirection = "UP";

export type PriceEndingBand = {
  min_krw: number;
  max_krw: number | null;
  allowed_endings: number[];
  direction: PriceEndingDirection;
};

export type ResolvedEndedPrice = {
  applied: boolean;
  matchedBand: PriceEndingBand | null;
  preEndingSafeTargetKrw: number;
  finalEndedPriceKrw: number;
  appliedEndingKrw: number | null;
};

const toRoundedInt = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

const normalizeEnding = (value: unknown): number | null => {
  const parsed = toRoundedInt(value);
  if (parsed === null || parsed < 0 || parsed > 999) return null;
  return parsed;
};

const normalizeBand = (input: unknown): PriceEndingBand => {
  const row = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const minKrw = toRoundedInt(row.min_krw) ?? 0;
  const rawMax = row.max_krw;
  const maxKrw = rawMax == null || rawMax === '' ? null : toRoundedInt(rawMax);
  const direction = String(row.direction ?? 'UP').trim().toUpperCase();
  if (direction !== 'UP') throw new Error('base_price_ending_policy_json direction must be UP');
  const allowedEndings = Array.from(new Set(
    (Array.isArray(row.allowed_endings) ? row.allowed_endings : [])
      .map((value) => normalizeEnding(value))
      .filter((value): value is number => value != null),
  )).sort((left, right) => left - right);
  return {
    min_krw: Math.max(0, minKrw),
    max_krw: maxKrw,
    allowed_endings: allowedEndings,
    direction: 'UP',
  };
};

export function parsePriceEndingPolicy(input: unknown): PriceEndingBand[] {
  if (input == null || input === '') return [];
  if (!Array.isArray(input)) throw new Error('base_price_ending_policy_json must be an array');
  return input.map((band) => normalizeBand(band));
}

export function validatePriceEndingPolicy(bands: PriceEndingBand[]): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const normalizedBands = Array.isArray(bands) ? bands : [];
  for (const [index, band] of normalizedBands.entries()) {
    if (!Number.isFinite(band.min_krw) || band.min_krw < 0) errors.push(`bands[${index}].min_krw must be >= 0`);
    if (band.max_krw !== null && (!Number.isFinite(band.max_krw) || band.max_krw < band.min_krw)) {
      errors.push(`bands[${index}].max_krw must be null or >= min_krw`);
    }
    if (band.direction !== 'UP') errors.push(`bands[${index}].direction must be UP`);
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
  const orderedBands = [...normalizedBands].sort((left, right) => left.min_krw - right.min_krw);
  for (let index = 1; index < orderedBands.length; index += 1) {
    const previous = orderedBands[index - 1];
    const current = orderedBands[index];
    if (previous.max_krw === null || previous.max_krw >= current.min_krw) {
      errors.push('price ending bands must not overlap');
      break;
    }
  }
  return { ok: errors.length === 0, errors };
}

const findMatchingBand = (safeTargetKrw: number, bands: PriceEndingBand[]): PriceEndingBand | null => {
  for (const band of bands) {
    if (safeTargetKrw < band.min_krw) continue;
    if (band.max_krw !== null && safeTargetKrw > band.max_krw) continue;
    return band;
  }
  return null;
};

export function resolveEndedBasePrice(args: { safeTargetKrw: number; bands: PriceEndingBand[] | null; }): ResolvedEndedPrice {
  const safeTargetKrw = Math.max(0, Math.round(Number(args.safeTargetKrw ?? 0)));
  const bands = Array.isArray(args.bands) ? args.bands : [];
  const matchedBand = findMatchingBand(safeTargetKrw, bands);
  if (!matchedBand || matchedBand.allowed_endings.length === 0) {
    return {
      applied: false,
      matchedBand: null,
      preEndingSafeTargetKrw: safeTargetKrw,
      finalEndedPriceKrw: safeTargetKrw,
      appliedEndingKrw: null,
    };
  }

  const baseBlock = Math.floor(safeTargetKrw / 1000) * 1000;
  for (let blockOffset = 0; blockOffset < 10000; blockOffset += 1000) {
    const blockBase = baseBlock + blockOffset;
    for (const ending of matchedBand.allowed_endings) {
      const candidate = blockBase + ending;
      if (candidate >= safeTargetKrw) {
        return {
          applied: candidate !== safeTargetKrw,
          matchedBand,
          preEndingSafeTargetKrw: safeTargetKrw,
          finalEndedPriceKrw: candidate,
          appliedEndingKrw: ending,
        };
      }
    }
  }

  return {
    applied: false,
    matchedBand,
    preEndingSafeTargetKrw: safeTargetKrw,
    finalEndedPriceKrw: safeTargetKrw,
    appliedEndingKrw: null,
  };
}
