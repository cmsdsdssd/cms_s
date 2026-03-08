export const looksCanonicalProductNo = (value: unknown): boolean => /^P/i.test(String(value ?? '').trim());

export const isBaseVariantCode = (value: unknown): boolean => String(value ?? '').trim().length === 0;

export const shouldPreferCanonicalProductNo = (currentProductNo: string, nextProductNo: string): boolean => {
  const current = String(currentProductNo ?? '').trim();
  const next = String(nextProductNo ?? '').trim();
  if (!current && next) return true;
  if (!next) return false;
  const currentCanonical = looksCanonicalProductNo(current);
  const nextCanonical = looksCanonicalProductNo(next);
  if (nextCanonical !== currentCanonical) return nextCanonical;
  return next.localeCompare(current) < 0;
};

export const resolveCanonicalProductNo = (values: unknown[], fallback = ''): string => {
  let canonical = '';
  for (const value of Array.isArray(values) ? values : []) {
    const productNo = String(value ?? '').trim();
    if (!productNo) continue;
    if (shouldPreferCanonicalProductNo(canonical, productNo)) canonical = productNo;
  }
  return canonical || String(fallback ?? '').trim();
};

export const buildCanonicalBaseProductByMaster = (
  rows: Array<{ master_item_id?: unknown; external_product_no?: unknown; external_variant_code?: unknown }>,
): Map<string, string> => {
  const result = new Map<string, string>();
  for (const row of Array.isArray(rows) ? rows : []) {
    const masterItemId = String(row?.master_item_id ?? '').trim();
    const externalProductNo = String(row?.external_product_no ?? '').trim();
    const externalVariantCode = String(row?.external_variant_code ?? '').trim();
    if (!masterItemId || !externalProductNo || externalVariantCode) continue;
    const current = result.get(masterItemId) ?? '';
    if (shouldPreferCanonicalProductNo(current, externalProductNo)) {
      result.set(masterItemId, externalProductNo);
    }
  }
  return result;
};
