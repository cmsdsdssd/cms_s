import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const routeSource = readFileSync(join(process.cwd(), "src", "app", "api", "pricing-policies", "route.ts"), "utf8");
const updateSource = readFileSync(join(process.cwd(), "src", "app", "api", "pricing-policies", "[id]", "route.ts"), "utf8");
const factorsSource = readFileSync(join(process.cwd(), "src", "app", "(app)", "settings", "shopping", "factors", "page.tsx"), "utf8");

test("shopping pricing policy APIs do not own base ending policy editor", () => {
  assert.equal(routeSource.includes("base_price_ending_policy_json"), false);
  assert.equal(updateSource.includes("base_price_ending_policy_json"), false);
});

test("shopping factors page does not expose base ending policy editor", () => {
  assert.equal(factorsSource.includes("basePriceEndingPolicyRows"), false);
  assert.equal(factorsSource.includes("끝자리 올림 밴드"), false);
});
