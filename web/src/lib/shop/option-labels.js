export const stripPriceDeltaSuffix = (text) =>
  String(text ?? '').replace(/\s*\([+-][\d,]+원\)\s*$/u, '').trim();

export const formatOptionDisplayLabel = (label, delta) => {
  const canonicalLabel = stripPriceDeltaSuffix(String(label ?? '').trim());
  if (!canonicalLabel) return '';

  const roundedDelta = Math.round(Number(delta ?? 0));
  if (!Number.isFinite(roundedDelta) || roundedDelta === 0) return canonicalLabel;

  const sign = roundedDelta >= 0 ? '+' : '-';
  const amount = Math.abs(roundedDelta).toLocaleString('ko-KR');
  return `${canonicalLabel} (${sign}${amount}원)`;
};
