import test from "node:test";
import assert from "node:assert/strict";

import { resolveBaseMaterialFinalKrw } from "../src/lib/shop/base-material-price.ts";

test("resolveBaseMaterialFinalKrw uses base material price when rule engines are disabled", () => {
  const result = resolveBaseMaterialFinalKrw({
    useRuleSetEngine: false,
    applyRule1: false,
    baseMaterialPrice: 1780000,
    materialRaw: 2500000,
    factor: 1.15,
    optionMaterialMultiplier: 1,
  });

  assert.equal(result, 1780000);
});

test("resolveBaseMaterialFinalKrw still uses rule1 path when enabled", () => {
  const result = resolveBaseMaterialFinalKrw({
    useRuleSetEngine: false,
    applyRule1: true,
    baseMaterialPrice: 1780000,
    materialRaw: 2500000,
    factor: 1.15,
    optionMaterialMultiplier: 1.2,
  });

  assert.equal(result, 3450000);
});
