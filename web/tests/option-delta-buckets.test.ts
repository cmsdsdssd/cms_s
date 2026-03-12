import test from "node:test";
import assert from "node:assert/strict";

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildSavedCategoryBucketsFromVariantOptions,
  composeOptionDeltaBuckets,
} = require("../src/lib/shop/option-delta-buckets.ts") as typeof import("../src/lib/shop/option-delta-buckets");

test("composeOptionDeltaBuckets keeps saved category deltas for categories without labor rules", () => {
  const result = composeOptionDeltaBuckets({
    useOptionLaborRuleEngine: true,
    activeRuleCategories: {
      material: false,
      size: false,
      colorPlating: true,
      decor: false,
      other: false,
    },
    optionLaborRuleResult: {
      material: 0,
      size: 0,
      colorPlating: 0,
      decor: 0,
      other: 0,
    },
    ruleDeltas: {
      material: 0,
      size: 0,
      color: 0,
      decor: 0,
    },
    categoryScopedDeltaBuckets: {
      material: 0,
      size: 29200,
      colorPlating: 3000,
      decor: 2000,
      other: 0,
      total: 34200,
    },
    colorComboBaseDelta: 0,
    colorAxisResolvedAmount: 3000,
    sizePriceOverrideEnabled: false,
    sizePriceOverrideKrw: null,
    baseOptionDelta: 0,
  });

  assert.deepEqual(result, {
    material: 0,
    size: 29200,
    color: 3000,
    decor: 2000,
    other: 0,
    total: 34200,
    source: "OPTION_LABOR_RULE_ENGINE",
  });
});

test("composeOptionDeltaBuckets lets explicit rule categories override saved deltas", () => {
  const result = composeOptionDeltaBuckets({
    useOptionLaborRuleEngine: true,
    activeRuleCategories: {
      material: false,
      size: true,
      colorPlating: true,
      decor: true,
      other: false,
    },
    optionLaborRuleResult: {
      material: 0,
      size: 15000,
      colorPlating: 7000,
      decor: 5000,
      other: 0,
    },
    ruleDeltas: {
      material: 0,
      size: 0,
      color: 0,
      decor: 0,
    },
    categoryScopedDeltaBuckets: {
      material: 0,
      size: 29200,
      colorPlating: 3000,
      decor: 2000,
      other: 0,
      total: 34200,
    },
    colorComboBaseDelta: 0,
    colorAxisResolvedAmount: undefined,
    sizePriceOverrideEnabled: false,
    sizePriceOverrideKrw: null,
    baseOptionDelta: 0,
  });

  assert.deepEqual(result, {
    material: 0,
    size: 15000,
    color: 7000,
    decor: 5000,
    other: 0,
    total: 27000,
    source: "OPTION_LABOR_RULE_ENGINE",
  });
});


test("buildSavedCategoryBucketsFromVariantOptions sums per-option saved rows for actual variant axes", () => {
  const result = buildSavedCategoryBucketsFromVariantOptions(
    [
      { name: "소재", value: "925실버" },
      { name: "사이즈", value: "5호" },
      { name: "색상", value: "골드" },
      { name: "장식", value: "붕어장식" },
      { name: "분류", value: "분류" },
    ],
    [
      { option_name: "소재", option_value: "925실버", category_key: "MATERIAL", sync_delta_krw: 0 },
      { option_name: "사이즈", option_value: "5호", category_key: "SIZE", sync_delta_krw: 29200 },
      { option_name: "색상", option_value: "골드", category_key: "COLOR_PLATING", sync_delta_krw: 3000 },
      { option_name: "장식", option_value: "붕어장식", category_key: "OTHER", sync_delta_krw: 2000 },
      { option_name: "분류", option_value: "분류", category_key: "OTHER", sync_delta_krw: 0 },
    ],
  );

  assert.deepEqual(result, {
    material: 0,
    size: 29200,
    colorPlating: 3000,
    decor: 0,
    other: 2000,
    total: 34200,
  });
});
