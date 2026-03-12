import test from 'node:test';
import assert from 'node:assert/strict';

import {
  stripPriceDeltaSuffix,
  formatDeltaDisplay,
  buildOptionAxisFromCanonicalRows,
  buildOptionAxisBreakdownFromPublishedVariants,
  buildOptionEntryRowsFromBreakdown,
  buildOptionAxisFromPublishedEntries,
  buildVariantBreakdownFromCanonicalRows,
  validateAdditiveBreakdown,
} from '../src/lib/shop/single-sot-pricing.js';

test('stripPriceDeltaSuffix removes trailing delta labels only', () => {
  assert.equal(stripPriceDeltaSuffix('14K-로즈골드(P) (+199,600원)'), '14K-로즈골드(P)');
  assert.equal(stripPriceDeltaSuffix('14K-화이트골드(W)'), '14K-화이트골드(W)');
});

test('formatDeltaDisplay formats signed deltas consistently', () => {
  assert.equal(formatDeltaDisplay(0), '0');
  assert.equal(formatDeltaDisplay(199600), '+199,600');
  assert.equal(formatDeltaDisplay(-5000), '-5,000');
});

test('buildOptionAxisBreakdownFromPublishedVariants uses published additional amounts as truth', () => {
  const breakdown = buildOptionAxisBreakdownFromPublishedVariants([
    {
      variantCode: 'V1',
      publishedAdditionalAmountKrw: 199600,
      options: [
        { name: '14K/18K', value: '14K' },
        { name: '색상', value: '로즈골드(P)' },
      ],
    },
    {
      variantCode: 'V2',
      publishedAdditionalAmountKrw: 554500,
      options: [
        { name: '14K/18K', value: '14K' },
        { name: '색상', value: '옐로우골드(Y)' },
      ],
    },
    {
      variantCode: 'V3',
      publishedAdditionalAmountKrw: 1110800,
      options: [
        { name: '14K/18K', value: '14K' },
        { name: '색상', value: '화이트골드(W)' },
      ],
    },
    {
      variantCode: 'V4',
      publishedAdditionalAmountKrw: 199600,
      options: [
        { name: '14K/18K', value: '18K' },
        { name: '색상', value: '로즈골드(P)' },
      ],
    },
  ]);

  assert.equal(breakdown.firstAxisName, '14K/18K');
  assert.equal(breakdown.secondAxisName, '색상');
  assert.deepEqual(breakdown.firstAxisValues, [
    { label: '14K', delta_krw: 199600, delta_display: '+199,600' },
    { label: '18K', delta_krw: 199600, delta_display: '+199,600' },
  ]);
  assert.deepEqual(breakdown.secondAxisValues, [
    { label: '로즈골드(P)', delta_krw: 0, delta_display: '0' },
    { label: '옐로우골드(Y)', delta_krw: 354900, delta_display: '+354,900' },
    { label: '화이트골드(W)', delta_krw: 911200, delta_display: '+911,200' },
  ]);
  assert.equal(breakdown.byVariant.find((row) => row.variant_code === 'V3')?.total_delta_krw, 1110800);
});


test('buildOptionEntryRowsFromBreakdown and buildOptionAxisFromPublishedEntries round-trip publish option entries', () => {
  const rows = buildOptionEntryRowsFromBreakdown({
    channelId: 'c1',
    masterItemId: 'm1',
    externalProductNo: '13',
    publishVersion: 'pub-1',
    computedAt: '2026-03-11T00:00:00.000Z',
    breakdown: {
      firstAxisName: '14K/18K',
      secondAxisName: '색상',
      firstAxisValues: [
        { label: '14K', delta_krw: 0 },
        { label: '18K', delta_krw: 0 },
      ],
      secondAxisValues: [
        { label: '로즈골드(P)', delta_krw: 199600 },
        { label: '화이트골드(W)', delta_krw: 1110800 },
      ],
    },
  });

  assert.equal(rows.length, 4);
  const axis = buildOptionAxisFromPublishedEntries(rows);
  assert.equal(axis.first.name, '14K/18K');
  assert.equal(axis.second.name, '색상');
  assert.deepEqual(axis.second.values, [
    { label: '로즈골드(P)', delta_krw: 199600, delta_display: '+199,600' },
    { label: '화이트골드(W)', delta_krw: 1110800, delta_display: '+1,110,800' },
  ]);
});

test('buildOptionAxisFromCanonicalRows preserves dynamic axes beyond two axes', () => {
  const axis = buildOptionAxisFromCanonicalRows([
    { axis_index: 1, option_name: '사이즈', option_value: '0.08g', resolved_delta_krw: 3500 },
    { axis_index: 2, option_name: '색상/도금', option_value: '[도] G', resolved_delta_krw: 1100 },
    { axis_index: 3, option_name: '장식', option_value: 'D-100', resolved_delta_krw: 25000 },
  ]);

  assert.deepEqual(axis.axes.map((entry) => entry.name), ['사이즈', '색상/도금', '장식']);
  assert.equal(axis.third.name, '장식');
  assert.equal(axis.third.values[0]?.delta_krw, 25000);
});

test('buildVariantBreakdownFromCanonicalRows sums rule-backed deltas across three axes', () => {
  const breakdown = buildVariantBreakdownFromCanonicalRows({
    canonicalRows: [
      { axis_index: 1, option_name: '사이즈', option_value: '0.08g', resolved_delta_krw: 3500 },
      { axis_index: 2, option_name: '색상/도금', option_value: '[도] G', resolved_delta_krw: 1100 },
      { axis_index: 3, option_name: '장식', option_value: 'D-100', resolved_delta_krw: 25000 },
    ],
    variants: [
      {
        variantCode: 'V1',
        options: [
          { name: '사이즈', value: '0.08g' },
          { name: '색상/도금', value: '[도] G' },
          { name: '장식', value: 'D-100' },
        ],
      },
    ],
  });

  assert.equal(breakdown.axes.length, 3);
  assert.equal(breakdown.byVariant[0]?.total_delta_krw, 29600);
  assert.equal(breakdown.byVariant[0]?.third_value, 'D-100');
});


test('validateAdditiveBreakdown rejects combination-only pricing exceptions', () => {
  const valid = validateAdditiveBreakdown({
    firstAxisValues: [{ label: '14K', delta_krw: 0 }, { label: '18K', delta_krw: 20000 }],
    secondAxisValues: [{ label: '로즈', delta_krw: 300 }, { label: '화이트', delta_krw: 32400 }],
    byVariant: [
      { variant_code: 'A', first_value: '14K', second_value: '로즈', total_delta_krw: 300 },
      { variant_code: 'B', first_value: '18K', second_value: '화이트', total_delta_krw: 52400 },
    ],
  });
  assert.equal(valid.ok, true);

  const invalid = validateAdditiveBreakdown({
    firstAxisValues: [{ label: '14K', delta_krw: 0 }, { label: '18K', delta_krw: 20000 }],
    secondAxisValues: [{ label: '로즈', delta_krw: 300 }, { label: '화이트', delta_krw: 32400 }],
    byVariant: [
      { variant_code: 'A', first_value: '14K', second_value: '로즈', total_delta_krw: 300 },
      { variant_code: 'B', first_value: '18K', second_value: '화이트', total_delta_krw: 61000 },
    ],
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.violations[0].variant_code, 'B');
  assert.equal(invalid.violations[0].expected_total_delta_krw, 52400);
});
