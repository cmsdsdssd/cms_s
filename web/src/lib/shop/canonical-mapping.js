export const looksCanonicalProductNo = (value) => /^P/i.test(String(value ?? '').trim());

export const isBaseVariantCode = (value) => String(value ?? '').trim().length === 0;

export const shouldPreferCanonicalProductNo = (currentProductNo, nextProductNo) => {
  const current = String(currentProductNo ?? '').trim();
  const next = String(nextProductNo ?? '').trim();
  if (!current && next) return true;
  if (!next) return false;
  const currentCanonical = looksCanonicalProductNo(current);
  const nextCanonical = looksCanonicalProductNo(next);
  if (nextCanonical != currentCanonical) return nextCanonical;
  return next.localeCompare(current) < 0;
};

export const resolveCanonicalProductNo = (values, fallback = '') => {
  let canonical = '';
  for (const value of Array.isArray(values) ? values : []) {
    const productNo = String(value ?? '').trim();
    if (!productNo) continue;
    if (shouldPreferCanonicalProductNo(canonical, productNo)) canonical = productNo;
  }
  return canonical || String(fallback ?? '').trim();
};

export const buildCanonicalBaseProductByMaster = (rows) => {
  const result = new Map();
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
