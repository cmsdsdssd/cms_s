export const VARIATION_TAG = "/변형/";
const LEGACY_VARIATION_TAG = "[변형]";

export function hasVariationTag(memo?: string | null): boolean {
  const value = String(memo ?? "").trimStart();
  return value.startsWith(VARIATION_TAG) || value.startsWith(LEGACY_VARIATION_TAG);
}

export function ensureVariationTag(memo: string): string {
  const value = String(memo ?? "");
  if (hasVariationTag(value)) return value;
  const trimmedStart = value.trimStart();
  return trimmedStart ? `${VARIATION_TAG} ${trimmedStart}` : VARIATION_TAG;
}

export function removeVariationTag(memo: string): string {
  const value = String(memo ?? "");
  const trimmed = value.trimStart();
  if (!hasVariationTag(trimmed)) return value;
  const rest = trimmed.startsWith(VARIATION_TAG)
    ? trimmed.slice(VARIATION_TAG.length).trimStart()
    : trimmed.slice(LEGACY_VARIATION_TAG.length).trimStart();
  return rest;
}

export function toggleVariationTag(memo: string, on: boolean): string {
  return on ? ensureVariationTag(memo) : removeVariationTag(memo);
}
