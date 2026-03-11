export const stripPriceDeltaSuffix = (text) =>
  String(text ?? '').replace(/\s*\([+-][\d,]+원\)\s*$/u, '').trim();

export const formatDeltaDisplay = (delta) => {
  const rounded = Math.round(Number(delta ?? 0));
  if (!Number.isFinite(rounded) || rounded === 0) return '0';
  return `${rounded >= 0 ? '+' : '-'}${Math.abs(rounded).toLocaleString('ko-KR')}`;
};

export const pickRepresentativeDelta = (deltas) => {
  const values = Array.from(deltas instanceof Set ? deltas.values() : [])
    .map((v) => Math.round(Number(v)))
    .filter((v) => Number.isFinite(v));
  if (values.length === 0) return 0;
  const freq = new Map();
  for (const value of values) freq.set(value, (freq.get(value) ?? 0) + 1);
  const ranked = Array.from(freq.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    const absDiff = Math.abs(a[0]) - Math.abs(b[0]);
    if (absDiff !== 0) return absDiff;
    return a[0] - b[0];
  });
  return ranked[0]?.[0] ?? 0;
};

export const buildOptionEntryRowsFromBreakdown = ({
  channelId,
  masterItemId,
  externalProductNo,
  publishVersion,
  breakdown,
  computedAt,
}) => {
  const rows = [];
  const pushAxis = (axisIndex, axisName, values) => {
    const normalizedAxisName = String(axisName ?? '').trim();
    if (!normalizedAxisName) return;
    for (const value of Array.isArray(values) ? values : []) {
      const label = String(value?.label ?? '').trim();
      const delta = Math.round(Number(value?.delta_krw ?? Number.NaN));
      if (!label || !Number.isFinite(delta)) continue;
      rows.push({
        channel_id: channelId,
        master_item_id: masterItemId,
        external_product_no: externalProductNo,
        option_axis_index: axisIndex,
        option_name: normalizedAxisName,
        option_value: label,
        publish_version: publishVersion,
        published_delta_krw: delta,
        computed_at: computedAt,
        updated_at: computedAt,
      });
    }
  };
  pushAxis(1, breakdown?.firstAxisName, breakdown?.firstAxisValues);
  pushAxis(2, breakdown?.secondAxisName, breakdown?.secondAxisValues);
  return rows;
};

export const buildOptionAxisFromPublishedEntries = (entries) => {
  const grouped = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const axisIndex = Number(entry?.option_axis_index ?? Number.NaN);
    const optionName = String(entry?.option_name ?? '').trim();
    const optionValue = String(entry?.option_value ?? '').trim();
    const delta = Math.round(Number(entry?.published_delta_krw ?? Number.NaN));
    if (!Number.isFinite(axisIndex) || !optionName || !optionValue || !Number.isFinite(delta)) continue;
    const key = String(axisIndex);
    const prev = grouped.get(key) ?? { name: optionName, values: [] };
    prev.values.push({ label: optionValue, delta_krw: delta, delta_display: formatDeltaDisplay(delta) });
    grouped.set(key, prev);
  }
  const first = grouped.get('1') ?? { name: '', values: [] };
  const second = grouped.get('2') ?? { name: '', values: [] };
  first.values.sort((a, b) => a.label.localeCompare(b.label, 'ko'));
  second.values.sort((a, b) => a.label.localeCompare(b.label, 'ko'));
  return {
    first: first,
    second: second,
  };
};

export const buildOptionAxisBreakdownFromPublishedVariants = (variants) => {
  const normalizedVariants = Array.isArray(variants) ? variants : [];
  const firstAxisName = String(normalizedVariants.find((v) => (v.options ?? []).length > 0)?.options?.[0]?.name ?? '').trim();
  const secondAxisName = String(normalizedVariants.find((v) => (v.options ?? []).length > 1)?.options?.[1]?.name ?? '').trim();

  const variantAxis = new Map();
  for (const variant of normalizedVariants) {
    const code = String(variant.variantCode ?? '').trim();
    if (!code) continue;
    const firstRaw = (variant.options ?? []).find((o) => String(o?.name ?? '').trim() === firstAxisName)?.value ?? '';
    const secondRaw = (variant.options ?? []).find((o) => String(o?.name ?? '').trim() === secondAxisName)?.value ?? '';
    const totalDelta = Math.round(Number(variant.publishedAdditionalAmountKrw ?? 0));
    variantAxis.set(code, {
      first: stripPriceDeltaSuffix(String(firstRaw)),
      second: stripPriceDeltaSuffix(String(secondRaw)),
      totalDelta,
    });
  }

  const firstAxisBaseDeltaByValue = new Map();
  for (const row of variantAxis.values()) {
    if (!row.first) continue;
    const prev = firstAxisBaseDeltaByValue.get(row.first);
    if (prev == null || row.totalDelta < prev) {
      firstAxisBaseDeltaByValue.set(row.first, row.totalDelta);
    }
  }

  const secondResidualByValue = new Map();
  for (const row of variantAxis.values()) {
    if (!row.first || !row.second) continue;
    const firstDelta = firstAxisBaseDeltaByValue.get(row.first);
    if (firstDelta == null) continue;
    const residual = row.totalDelta - firstDelta;
    const prev = secondResidualByValue.get(row.second) ?? new Set();
    prev.add(residual);
    secondResidualByValue.set(row.second, prev);
  }

  const secondAxisDeltaByValue = new Map();
  for (const [value, deltas] of secondResidualByValue.entries()) {
    secondAxisDeltaByValue.set(value, pickRepresentativeDelta(deltas));
  }

  return {
    firstAxisName,
    secondAxisName,
    firstAxisValues: Array.from(firstAxisBaseDeltaByValue.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, delta]) => ({ label, delta_krw: delta, delta_display: formatDeltaDisplay(delta) })),
    secondAxisValues: Array.from(secondAxisDeltaByValue.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, delta]) => ({ label, delta_krw: delta, delta_display: formatDeltaDisplay(delta) })),
    byVariant: Array.from(variantAxis.entries())
      .map(([variantCode, row]) => ({
        variant_code: variantCode,
        first_value: row.first,
        second_value: row.second,
        total_delta_krw: row.totalDelta,
      }))
      .sort((a, b) => a.variant_code.localeCompare(b.variant_code)),
  };
};
