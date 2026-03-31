import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveCompareThresholdPolicy,
  resolveVariantCompareState,
} from "../src/lib/shop/variant-compare-status.ts";

test("resolveCompareThresholdPolicy uses profile preset override when current product profile differs", () => {
  const policy = resolveCompareThresholdPolicy({
    policyThresholdProfile: "GENERAL",
    currentProductSyncProfile: "MARKET_LINKED",
    policyMinChangeKrw: 5000,
    policyMinChangeRate: 0.01,
  });

  assert.equal(policy.thresholdProfile, "MARKET_LINKED");
  assert.equal(policy.minChangeKrw, 500);
  assert.equal(policy.minChangeRate, 0.005);
});

test("resolveVariantCompareState returns THRESHOLD_HELD when only option delta is below threshold", () => {
  const state = resolveVariantCompareState({
    desiredBasePriceKrw: 3460000,
    publishedBasePriceKrw: 3460000,
    desiredAdditionalKrw: 5900,
    publishedAdditionalKrw: 6500,
    baseThresholdPolicy: { min_change_krw: 5000, min_change_rate: 0.01 },
    optionThresholdPolicy: { min_change_krw: 1000, min_change_rate: 0.01 },
  });

  assert.equal(state.status, "THRESHOLD_HELD");
  assert.equal(state.totalDiffKrw, 600);
  assert.equal(state.optionDiffKrw, 600);
  assert.equal(state.effectiveOptionThresholdKrw, 1000);
});

test("resolveVariantCompareState returns OUT_OF_SYNC when option delta exceeds threshold", () => {
  const state = resolveVariantCompareState({
    desiredBasePriceKrw: 3460000,
    publishedBasePriceKrw: 3460000,
    desiredAdditionalKrw: 8200,
    publishedAdditionalKrw: 6500,
    baseThresholdPolicy: { min_change_krw: 5000, min_change_rate: 0.01 },
    optionThresholdPolicy: { min_change_krw: 1000, min_change_rate: 0.01 },
  });

  assert.equal(state.status, "OUT_OF_SYNC");
  assert.equal(state.optionDiffKrw, 1700);
});

test("resolveVariantCompareState returns MATCH when desired and published totals are equal", () => {
  const state = resolveVariantCompareState({
    desiredBasePriceKrw: 3460000,
    publishedBasePriceKrw: 3460000,
    desiredAdditionalKrw: 6500,
    publishedAdditionalKrw: 6500,
    baseThresholdPolicy: { min_change_krw: 5000, min_change_rate: 0.01 },
    optionThresholdPolicy: { min_change_krw: 1000, min_change_rate: 0.01 },
  });

  assert.equal(state.status, "MATCH");
  assert.equal(state.totalDiffKrw, 0);
});


test("resolveVariantCompareState returns THRESHOLD_HELD when base delta is below threshold", () => {
  const state = resolveVariantCompareState({
    desiredBasePriceKrw: 3460500,
    publishedBasePriceKrw: 3460000,
    desiredAdditionalKrw: 0,
    publishedAdditionalKrw: 0,
    baseThresholdPolicy: { min_change_krw: 1000, min_change_rate: 0 },
    optionThresholdPolicy: { min_change_krw: 1000, min_change_rate: 0.01 },
  });

  assert.equal(state.status, "THRESHOLD_HELD");
  assert.equal(state.baseDiffKrw, 500);
  assert.equal(state.effectiveBaseThresholdKrw, 1000);
});
