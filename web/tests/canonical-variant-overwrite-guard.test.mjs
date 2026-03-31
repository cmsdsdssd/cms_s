import test from "node:test";
import assert from "node:assert/strict";

import { canOverwriteCanonicalVariantPublishRows } from "../src/lib/shop/single-sot-pricing.js";

test("canOverwriteCanonicalVariantPublishRows allows overwrite when canonical semantics match published variants", () => {
  const allowed = canOverwriteCanonicalVariantPublishRows({
    publishedVariants: [
      {
        variantCode: "V1",
        publishedAdditionalAmountKrw: 9500,
        options: [{ name: "사이즈", value: "1호" }],
      },
      {
        variantCode: "V2",
        publishedAdditionalAmountKrw: 15000,
        options: [{ name: "사이즈", value: "2호" }],
      },
    ],
    canonicalBreakdown: {
      axes: [
        {
          index: 1,
          name: "사이즈",
          values: [
            { label: "1호", delta_krw: 9500 },
            { label: "2호", delta_krw: 15000 },
          ],
        },
      ],
      byVariant: [
        { variant_code: "V1", axis_values: [{ index: 1, name: "사이즈", value: "1호" }], total_delta_krw: 9500 },
        { variant_code: "V2", axis_values: [{ index: 1, name: "사이즈", value: "2호" }], total_delta_krw: 15000 },
      ],
    },
    optionRoundingUnit: 500,
    optionRoundingMode: "CEIL",
  });

  assert.equal(allowed, true);
});

test("canOverwriteCanonicalVariantPublishRows rejects overwrite when canonical semantics change published variants", () => {
  const allowed = canOverwriteCanonicalVariantPublishRows({
    publishedVariants: [
      {
        variantCode: "V1",
        publishedAdditionalAmountKrw: 9500,
        options: [{ name: "사이즈", value: "1호" }],
      },
      {
        variantCode: "V2",
        publishedAdditionalAmountKrw: 15000,
        options: [{ name: "사이즈", value: "2호" }],
      },
    ],
    canonicalBreakdown: {
      axes: [
        {
          index: 1,
          name: "사이즈",
          values: [
            { label: "1호", delta_krw: 13500 },
            { label: "2호", delta_krw: 19000 },
          ],
        },
      ],
      byVariant: [
        { variant_code: "V1", axis_values: [{ index: 1, name: "사이즈", value: "1호" }], total_delta_krw: 13500 },
        { variant_code: "V2", axis_values: [{ index: 1, name: "사이즈", value: "2호" }], total_delta_krw: 19000 },
      ],
    },
    optionRoundingUnit: 500,
    optionRoundingMode: "CEIL",
  });

  assert.equal(allowed, false);
});

test("canOverwriteCanonicalVariantPublishRows rejects overwrite when canonical variant coverage is incomplete", () => {
  const allowed = canOverwriteCanonicalVariantPublishRows({
    publishedVariants: [
      {
        variantCode: "V1",
        publishedAdditionalAmountKrw: 9500,
        options: [{ name: "사이즈", value: "1호" }],
      },
      {
        variantCode: "V2",
        publishedAdditionalAmountKrw: 15000,
        options: [{ name: "사이즈", value: "2호" }],
      },
    ],
    canonicalBreakdown: {
      axes: [
        {
          index: 1,
          name: "사이즈",
          values: [{ label: "1호", delta_krw: 9200 }],
        },
      ],
      byVariant: [
        { variant_code: "V1", axis_values: [{ index: 1, name: "사이즈", value: "1호" }], total_delta_krw: 9500 },
      ],
    },
    optionRoundingUnit: 500,
    optionRoundingMode: "CEIL",
  });

  assert.equal(allowed, false);
});
