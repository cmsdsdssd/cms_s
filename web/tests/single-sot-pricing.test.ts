import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOptionAxisBreakdownFromPublishedVariants,
  buildOptionAxisFromPublishedEntries,
  buildOptionEntryRowsFromBreakdown,
  selectStorefrontBreakdownSource,
  validateAdditiveBreakdown,
} from "../src/lib/shop/single-sot-pricing.js";

test("multi-axis published variants remain additive when third axis carries extra delta", () => {
  const breakdown = buildOptionAxisBreakdownFromPublishedVariants([
    {
      variantCode: "v1",
      options: [
        { name: "소재", value: "925실버" },
        { name: "사이즈", value: "1호" },
        { name: "색상", value: "골드" },
      ],
      publishedAdditionalAmountKrw: 3000,
    },
    {
      variantCode: "v2",
      options: [
        { name: "소재", value: "925실버" },
        { name: "사이즈", value: "1호" },
        { name: "색상", value: "핑크" },
      ],
      publishedAdditionalAmountKrw: 7000,
    },
    {
      variantCode: "v3",
      options: [
        { name: "소재", value: "925실버" },
        { name: "사이즈", value: "2호" },
        { name: "색상", value: "골드" },
      ],
      publishedAdditionalAmountKrw: 3000,
    },
    {
      variantCode: "v4",
      options: [
        { name: "소재", value: "925실버" },
        { name: "사이즈", value: "2호" },
        { name: "색상", value: "핑크" },
      ],
      publishedAdditionalAmountKrw: 7000,
    },
  ]);

  assert.equal(validateAdditiveBreakdown(breakdown).ok, true);
  assert.equal(breakdown.axes.length, 3);
  assert.deepEqual(
    breakdown.axes.map((axis: { name: string; values: Array<{ label: string; delta_krw: number }> }) => ({ name: axis.name, values: axis.values.map((value: { label: string; delta_krw: number }) => [value.label, value.delta_krw]) })),
    [
      { name: "소재", values: [["925실버", 3000]] },
      { name: "사이즈", values: [["1호", 0], ["2호", 0]] },
      { name: "색상", values: [["골드", 0], ["핑크", 4000]] },
    ],
  );
});

test("buildOptionEntryRowsFromBreakdown emits rows for every axis", () => {
  const rows = buildOptionEntryRowsFromBreakdown({
    channelId: "channel-1",
    masterItemId: "master-1",
    externalProductNo: "33",
    publishVersion: "publish-1",
    computedAt: "2026-03-12T00:00:00.000Z",
    breakdown: {
      axes: [
        { name: "소재", values: [{ label: "925실버", delta_krw: 3000 }] },
        { name: "사이즈", values: [{ label: "1호", delta_krw: 0 }] },
        { name: "색상", values: [{ label: "핑크", delta_krw: 4000 }] },
      ],
      byVariant: [],
    },
  });

  assert.deepEqual(
    rows.map((row) => [row.option_axis_index, row.option_name, row.option_value, row.published_delta_krw]),
    [
      [1, "소재", "925실버", 3000],
      [2, "사이즈", "1호", 0],
      [3, "색상", "핑크", 4000],
    ],
  );
});


test("buildOptionAxisFromPublishedEntries adds display-only labels while preserving canonical labels", () => {
  const axis = buildOptionAxisFromPublishedEntries([
    { option_axis_index: 1, option_name: "사이즈", option_value: "1호 (+1,000원)", published_delta_krw: 1000 },
    { option_axis_index: 1, option_name: "사이즈", option_value: "2호", published_delta_krw: 0 },
  ]);

  assert.deepEqual(axis.axes, [
    {
      index: 1,
      name: "사이즈",
      values: [
        { label: "1호", delta_krw: 1000, delta_display: "+1,000", display_label: "1호 (+1,000원)" },
        { label: "2호", delta_krw: 0, delta_display: "0", display_label: "2호" },
      ],
    },
  ]);
});


test("prefer published storefront source when both published and canonical data exist", () => {
  const result = selectStorefrontBreakdownSource({
    canonicalOptionRows: [
      { axis_index: 1, option_name: "색상", option_value: "골드", resolved_delta_krw: 0 },
    ],
    canonicalVariants: [
      { variantCode: "V1", options: [{ name: "색상", value: "골드" }] },
    ],
    optionEntryRows: [
      { option_axis_index: 1, option_name: "색상", option_value: "골드", published_delta_krw: 3000 },
    ],
  });

  assert.equal(result.previewSource, "published_entries");
  assert.equal(result.breakdown.byVariant[0]?.total_delta_krw, 3000);
  assert.equal(result.axis.axes[0]?.values[0]?.delta_krw, 3000);
});

test("do not fall back to canonical rows when published entries are missing", () => {
  const result = selectStorefrontBreakdownSource({
    canonicalOptionRows: [
      { axis_index: 1, option_name: "색상", option_value: "골드", resolved_delta_krw: 0 },
    ],
    canonicalVariants: [
      { variantCode: "V1", options: [{ name: "색상", value: "골드" }] },
    ],
    optionEntryRows: [],
  });

  assert.equal(result.previewSource, "missing_published_entries");
  assert.equal(result.axis.axes.length, 0);
  assert.equal(result.breakdown.byVariant.length, 0);
});
