import { formatOptionDisplayLabel, stripPriceDeltaSuffix } from './option-labels.js';

export { stripPriceDeltaSuffix } from './option-labels.js';

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

const normalizeAxisValue = (value) => stripPriceDeltaSuffix(String(value ?? '').trim());

const normalizeAxis = (axis, index) => {
  const name = String(axis?.name ?? '').trim();
  const values = Array.isArray(axis?.values)
    ? axis.values
        .map((value) => {
          const label = stripPriceDeltaSuffix(String(value?.label ?? '').trim());
          const delta = Math.round(Number(value?.delta_krw ?? Number.NaN));
          if (!label || !Number.isFinite(delta)) return null;
          return {
            label,
            delta_krw: delta,
            delta_display: formatDeltaDisplay(delta),
            display_label: formatOptionDisplayLabel(label, delta),
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.label.localeCompare(b.label, 'ko'))
    : [];
  return { index, name, values };
};

const resolveAxesFromBreakdown = (breakdown) => {
  if (Array.isArray(breakdown?.axes) && breakdown.axes.length > 0) {
    return breakdown.axes
      .map((axis, index) => normalizeAxis(axis, index + 1))
      .filter((axis) => axis.name);
  }
  const candidates = [
    { name: breakdown?.firstAxisName, values: breakdown?.firstAxisValues },
    { name: breakdown?.secondAxisName, values: breakdown?.secondAxisValues },
    { name: breakdown?.thirdAxisName, values: breakdown?.thirdAxisValues },
  ];
  return candidates
    .map((axis, index) => normalizeAxis(axis, index + 1))
    .filter((axis) => axis.name);
};

const buildBreakdownShape = (axes, byVariant) => ({
  axes,
  first: axes[0] ?? { index: 1, name: '', values: [] },
  second: axes[1] ?? { index: 2, name: '', values: [] },
  third: axes[2] ?? { index: 3, name: '', values: [] },
  firstAxisName: axes[0]?.name ?? '',
  secondAxisName: axes[1]?.name ?? '',
  thirdAxisName: axes[2]?.name ?? '',
  firstAxisValues: axes[0]?.values ?? [],
  secondAxisValues: axes[1]?.values ?? [],
  thirdAxisValues: axes[2]?.values ?? [],
  byVariant,
});

const buildAxisValuesForRow = (row, axisNames = []) => {
  if (Array.isArray(row?.axis_values) && row.axis_values.length > 0) {
    return row.axis_values
      .map((axisValue, index) => ({
        index: Number(axisValue?.index ?? index + 1),
        name: String(axisValue?.name ?? '').trim(),
        value: normalizeAxisValue(axisValue?.value ?? axisValue?.label ?? ''),
      }))
      .filter((axisValue) => axisValue.name && axisValue.value);
  }
  const fallback = [
    { name: axisNames[0] ?? '', value: row?.first_value ?? '' },
    { name: axisNames[1] ?? '', value: row?.second_value ?? '' },
    { name: axisNames[2] ?? '', value: row?.third_value ?? '' },
  ];
  return fallback
    .map((axisValue, index) => ({
      index: index + 1,
      name: String(axisValue.name ?? '').trim(),
      value: normalizeAxisValue(axisValue.value),
    }))
    .filter((axisValue) => axisValue.name && axisValue.value);
};

const buildCartesianVariantBreakdown = (axes) => {
  if (!Array.isArray(axes) || axes.length === 0) return [];
  const normalizedAxes = axes.filter((axis) => axis.name && Array.isArray(axis.values) && axis.values.length > 0);
  if (normalizedAxes.length === 0) return [];

  const rows = [];
  const walk = (axisIndex, pickedValues) => {
    if (axisIndex >= normalizedAxes.length) {
      rows.push({
        axis_values: pickedValues.map((picked, index) => ({
          index: index + 1,
          name: picked.name,
          value: picked.label,
        })),
        first_value: pickedValues[0]?.label ?? '',
        second_value: pickedValues[1]?.label ?? '',
        third_value: pickedValues[2]?.label ?? '',
        total_delta_krw: pickedValues.reduce((sum, picked) => sum + Math.round(Number(picked.delta_krw ?? 0)), 0),
      });
      return;
    }
    const axis = normalizedAxes[axisIndex];
    for (const value of axis.values) {
      walk(axisIndex + 1, [...pickedValues, { name: axis.name, ...value }]);
    }
  };

  walk(0, []);
  return rows.map((row, index) => ({
    variant_code: `axis-${index + 1}`,
    ...row,
  }));
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
  const axes = resolveAxesFromBreakdown(breakdown);
  for (const axis of axes) {
    const normalizedAxisName = String(axis?.name ?? '').trim();
    if (!normalizedAxisName) continue;
    for (const value of Array.isArray(axis?.values) ? axis.values : []) {
      const label = String(value?.label ?? '').trim();
      const delta = Math.round(Number(value?.delta_krw ?? Number.NaN));
      if (!label || !Number.isFinite(delta)) continue;
      rows.push({
        channel_id: channelId,
        master_item_id: masterItemId,
        external_product_no: externalProductNo,
        option_axis_index: Number(axis.index ?? rows.length + 1),
        option_name: normalizedAxisName,
        option_value: label,
        publish_version: publishVersion,
        published_delta_krw: delta,
        computed_at: computedAt,
        updated_at: computedAt,
      });
    }
  }
  return rows;
};

export const buildOptionAxisFromPublishedEntries = (entries) => {
  const grouped = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const axisIndex = Number(entry?.option_axis_index ?? Number.NaN);
    const optionName = String(entry?.option_name ?? '').trim();
    const optionValue = stripPriceDeltaSuffix(String(entry?.option_value ?? '').trim());
    const delta = Math.round(Number(entry?.published_delta_krw ?? Number.NaN));
    if (!Number.isFinite(axisIndex) || !optionName || !optionValue || !Number.isFinite(delta)) continue;
    const prev = grouped.get(axisIndex) ?? { index: axisIndex, name: optionName, values: new Map() };
    if (!prev.values.has(optionValue)) {
      prev.values.set(optionValue, {
        label: optionValue,
        delta_krw: delta,
        delta_display: formatDeltaDisplay(delta),
        display_label: formatOptionDisplayLabel(optionValue, delta),
      });
    }
    grouped.set(axisIndex, prev);
  }
  const axes = Array.from(grouped.values())
    .sort((a, b) => a.index - b.index)
    .map((axis) => ({
      index: axis.index,
      name: axis.name,
      values: Array.from(axis.values.values()).sort((a, b) => a.label.localeCompare(b.label, 'ko')),
    }));
  return buildBreakdownShape(axes, []);
};

export const buildOptionAxisFromCanonicalRows = (rows) => {
  const grouped = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const axisIndex = Number(row?.axis_index ?? Number.NaN);
    const optionName = String(row?.option_name ?? '').trim();
    const optionValue = stripPriceDeltaSuffix(String(row?.option_value ?? '').trim());
    const delta = Math.round(Number(row?.resolved_delta_krw ?? Number.NaN));
    if (!Number.isFinite(axisIndex) || !optionName || !optionValue || !Number.isFinite(delta)) continue;
    const key = String(axisIndex);
    const prev = grouped.get(key) ?? { index: axisIndex, name: optionName, values: new Map() };
    if (!prev.values.has(optionValue)) {
      prev.values.set(optionValue, {
        label: optionValue,
        delta_krw: delta,
        delta_display: formatDeltaDisplay(delta),
        display_label: formatOptionDisplayLabel(optionValue, delta),
      });
    }
    grouped.set(key, prev);
  }
  const axes = Array.from(grouped.values())
    .sort((a, b) => a.index - b.index)
    .map((axis) => ({
      index: axis.index,
      name: axis.name,
      values: Array.from(axis.values.values()).sort((a, b) => a.label.localeCompare(b.label, 'ko')),
    }));
  return {
    axes,
    first: axes[0] ?? { index: 1, name: '', values: [] },
    second: axes[1] ?? { index: 2, name: '', values: [] },
    third: axes[2] ?? { index: 3, name: '', values: [] },
  };
};


export const buildVariantBreakdownFromPublishedEntries = (entries) => {
  const axis = buildOptionAxisFromPublishedEntries(entries);
  const byVariant = buildCartesianVariantBreakdown(axis.axes);
  return buildBreakdownShape(axis.axes, byVariant);
};


export const selectStorefrontBreakdownSource = ({
  canonicalOptionRows,
  canonicalVariants,
  optionEntryRows,
}) => {
  const publishedCount = Array.isArray(optionEntryRows) ? optionEntryRows.length : 0;
  if (publishedCount > 0) {
    const axis = buildOptionAxisFromPublishedEntries(optionEntryRows);
    const breakdown = buildVariantBreakdownFromPublishedEntries(optionEntryRows);
    return {
      axis,
      breakdown,
      previewSource: 'published_entries',
    };
  }

  const axis = buildOptionAxisFromCanonicalRows(canonicalOptionRows);
  if (axis.axes.length > 0) {
    const breakdown = buildVariantBreakdownFromCanonicalRows({
      variants: canonicalVariants,
      canonicalRows: canonicalOptionRows,
    });
    return {
      axis,
      breakdown,
      previewSource: 'canonical_rows',
    };
  }

  return {
    axis: buildBreakdownShape([], []),
    breakdown: buildBreakdownShape([], []),
    previewSource: 'published_entries',
  };
};

export const buildVariantBreakdownFromCanonicalRows = ({ variants, canonicalRows }) => {
  const axis = buildOptionAxisFromCanonicalRows(canonicalRows);
  const deltaByEntryKey = new Map(
    (Array.isArray(canonicalRows) ? canonicalRows : [])
      .map((row) => [
        `${String(row?.option_name ?? '').trim()}::${stripPriceDeltaSuffix(String(row?.option_value ?? '').trim())}`,
        Math.round(Number(row?.resolved_delta_krw ?? 0)),
      ])
      .filter(([entryKey]) => String(entryKey).trim().length > 0),
  );
  const byVariant = (Array.isArray(variants) ? variants : []).map((variant, index) => {
    const axisValues = (Array.isArray(variant?.options) ? variant.options : []).map((option, optionIndex) => ({
      index: optionIndex + 1,
      name: String(option?.name ?? '').trim(),
      value: stripPriceDeltaSuffix(String(option?.value ?? '').trim()),
    })).filter((axisValue) => axisValue.name && axisValue.value);
    const totalDelta = axisValues.reduce((sum, axisValue) => (
      sum + Math.round(Number(deltaByEntryKey.get(`${axisValue.name}::${axisValue.value}`) ?? 0))
    ), 0);
    return {
      variant_code: String(variant?.variantCode ?? variant?.variant_code ?? `axis-${index + 1}`).trim() || `axis-${index + 1}`,
      axis_values: axisValues,
      first_value: axisValues[0]?.value ?? '',
      second_value: axisValues[1]?.value ?? '',
      third_value: axisValues[2]?.value ?? '',
      total_delta_krw: totalDelta,
    };
  });
  return {
    axes: axis.axes,
    firstAxisName: axis.first?.name ?? '',
    secondAxisName: axis.second?.name ?? '',
    thirdAxisName: axis.third?.name ?? '',
    firstAxisValues: axis.first?.values ?? [],
    secondAxisValues: axis.second?.values ?? [],
    thirdAxisValues: axis.third?.values ?? [],
    byVariant,
  };
};

export const validateAdditiveBreakdown = (breakdown) => {
  const axes = resolveAxesFromBreakdown(breakdown);
  const axisNames = axes.map((axis) => axis.name);
  const axisDeltaByName = new Map(
    axes.map((axis) => [
      axis.name,
      new Map(
        (Array.isArray(axis.values) ? axis.values : [])
          .map((row) => [String(row?.label ?? '').trim(), Math.round(Number(row?.delta_krw ?? Number.NaN))])
          .filter(([label, delta]) => label && Number.isFinite(delta)),
      ),
    ]),
  );
  const violations = [];
  for (const row of Array.isArray(breakdown?.byVariant) ? breakdown.byVariant : []) {
    const axisValues = buildAxisValuesForRow(row, axisNames);
    const totalDelta = Math.round(Number(row?.total_delta_krw ?? Number.NaN));
    if (axisValues.length === 0 || !Number.isFinite(totalDelta)) continue;
    let expected = 0;
    let missing = false;
    for (const axisValue of axisValues) {
      const deltaByValue = axisDeltaByName.get(axisValue.name);
      const axisDelta = deltaByValue?.get(axisValue.value);
      if (!Number.isFinite(axisDelta)) {
        missing = true;
        break;
      }
      expected += Math.round(Number(axisDelta));
    }
    if (missing) {
      violations.push({
        variant_code: String(row?.variant_code ?? '').trim(),
        first_value: axisValues[0]?.value ?? '',
        second_value: axisValues[1]?.value ?? '',
        third_value: axisValues[2]?.value ?? '',
        axis_values: axisValues,
        total_delta_krw: totalDelta,
        expected_total_delta_krw: null,
        reason: 'MISSING_AXIS_DELTA',
      });
      continue;
    }
    if (expected !== totalDelta) {
      violations.push({
        variant_code: String(row?.variant_code ?? '').trim(),
        first_value: axisValues[0]?.value ?? '',
        second_value: axisValues[1]?.value ?? '',
        third_value: axisValues[2]?.value ?? '',
        axis_values: axisValues,
        total_delta_krw: totalDelta,
        expected_total_delta_krw: expected,
        reason: 'NON_ADDITIVE_VARIANT_DELTA',
      });
    }
  }
  return {
    ok: violations.length === 0,
    violations,
  };
};

export const buildOptionAxisBreakdownFromPublishedVariants = (variants) => {
  const normalizedVariants = Array.isArray(variants) ? variants : [];
  const axisNames = [];
  for (const variant of normalizedVariants) {
    for (const option of Array.isArray(variant?.options) ? variant.options : []) {
      const optionName = String(option?.name ?? '').trim();
      if (optionName && !axisNames.includes(optionName)) axisNames.push(optionName);
    }
  }

  const variantAxis = new Map();
  for (const variant of normalizedVariants) {
    const code = String(variant.variantCode ?? '').trim();
    if (!code) continue;
    const axisValuesByName = new Map();
    for (const axisName of axisNames) {
      const raw = (Array.isArray(variant?.options) ? variant.options : []).find((option) => String(option?.name ?? '').trim() === axisName)?.value ?? '';
      const normalizedValue = normalizeAxisValue(raw);
      if (normalizedValue) axisValuesByName.set(axisName, normalizedValue);
    }
    variantAxis.set(code, {
      axisValuesByName,
      axisValues: axisNames
        .map((axisName, index) => ({
          index: index + 1,
          name: axisName,
          value: axisValuesByName.get(axisName) ?? '',
        }))
        .filter((axisValue) => axisValue.value),
      totalDelta: Math.round(Number(variant.publishedAdditionalAmountKrw ?? 0)),
    });
  }

  const axisDeltaMaps = axisNames.map(() => new Map());
  axisNames.forEach((axisName, axisIndex) => {
    const residualsByValue = new Map();
    for (const row of variantAxis.values()) {
      const axisValue = row.axisValuesByName.get(axisName) ?? '';
      if (!axisValue) continue;
      let priorDelta = 0;
      for (let priorIndex = 0; priorIndex < axisIndex; priorIndex += 1) {
        const priorAxisName = axisNames[priorIndex];
        const priorValue = row.axisValuesByName.get(priorAxisName) ?? '';
        const priorAxisDelta = axisDeltaMaps[priorIndex].get(priorValue);
        if (priorValue && Number.isFinite(priorAxisDelta)) {
          priorDelta += Math.round(Number(priorAxisDelta));
        }
      }
      const residual = row.totalDelta - priorDelta;
      const prev = residualsByValue.get(axisValue) ?? new Set();
      prev.add(residual);
      residualsByValue.set(axisValue, prev);
    }
    for (const [value, residuals] of residualsByValue.entries()) {
      const normalizedResiduals = Array.from(residuals)
        .map((residual) => Math.round(Number(residual)))
        .filter((residual) => Number.isFinite(residual));
      if (normalizedResiduals.length === 0) continue;
      axisDeltaMaps[axisIndex].set(value, Math.min(...normalizedResiduals));
    }
  });

  const axes = axisNames.map((axisName, axisIndex) => ({
    index: axisIndex + 1,
    name: axisName,
    values: Array.from(axisDeltaMaps[axisIndex].entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'ko'))
      .map(([label, delta]) => ({ label, delta_krw: delta, delta_display: formatDeltaDisplay(delta) })),
  }));

  const byVariant = Array.from(variantAxis.entries())
    .map(([variantCode, row]) => ({
      variant_code: variantCode,
      axis_values: row.axisValues,
      first_value: row.axisValues[0]?.value ?? '',
      second_value: row.axisValues[1]?.value ?? '',
      third_value: row.axisValues[2]?.value ?? '',
      total_delta_krw: row.totalDelta,
    }))
    .sort((a, b) => a.variant_code.localeCompare(b.variant_code));

  return buildBreakdownShape(axes, byVariant);
};
