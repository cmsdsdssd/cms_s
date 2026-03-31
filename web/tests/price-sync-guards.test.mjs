import test from "node:test";
import assert from "node:assert/strict";

import { shouldAllowAutoMarketUplift } from "../src/lib/shop/price-sync-guards.js";

test("shouldAllowAutoMarketUplift blocks V2 market uplift even with valid numbers", () => {
  assert.equal(shouldAllowAutoMarketUplift({
    pricingAlgoVersion: "REVERSE_FEE_V2",
    baseTotalPreMarginKrw: 2000000,
    marketAfterMarginKrw: 2400000,
    baseTargetKrw: 2400000,
  }), false);
});

test("shouldAllowAutoMarketUplift allows sane legacy market uplift", () => {
  assert.equal(shouldAllowAutoMarketUplift({
    pricingAlgoVersion: "LEGACY_V1",
    baseTotalPreMarginKrw: 2000000,
    marketAfterMarginKrw: 2400000,
    baseTargetKrw: 2300000,
  }), true);
});

test("shouldAllowAutoMarketUplift fails closed on invalid values", () => {
  assert.equal(shouldAllowAutoMarketUplift({
    pricingAlgoVersion: "LEGACY_V1",
    baseTotalPreMarginKrw: null,
    marketAfterMarginKrw: 2400000,
    baseTargetKrw: 2300000,
  }), false);
  assert.equal(shouldAllowAutoMarketUplift({
    pricingAlgoVersion: "LEGACY_V1",
    baseTotalPreMarginKrw: 2000000,
    marketAfterMarginKrw: -1,
    baseTargetKrw: 2300000,
  }), false);
});


test("shouldAllowAutoMarketUplift blocks obviously abnormal legacy uplift", () => {
  assert.equal(shouldAllowAutoMarketUplift({
    pricingAlgoVersion: "LEGACY_V1",
    baseTotalPreMarginKrw: 2000000,
    marketAfterMarginKrw: 5000000,
    baseTargetKrw: 2300000,
  }), false);
});
