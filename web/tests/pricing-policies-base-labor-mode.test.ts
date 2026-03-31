import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const routeSource = readFileSync(join(process.cwd(), "src", "app", "api", "pricing-policies", "route.ts"), "utf8");
const updateSource = readFileSync(join(process.cwd(), "src", "app", "api", "pricing-policies", "[id]", "route.ts"), "utf8");
const factorsSource = readFileSync(join(process.cwd(), "src", "app", "(app)", "settings", "shopping", "factors", "page.tsx"), "utf8");

test("shopping pricing policy APIs do not own base labor multiplier", () => {
  assert.equal(routeSource.includes("base_labor_sell_mode"), false);
  assert.equal(routeSource.includes("base_labor_sell_multiplier"), false);
  assert.equal(updateSource.includes("base_labor_sell_mode"), false);
  assert.equal(updateSource.includes("base_labor_sell_multiplier"), false);
});

test("shopping factors page does not expose base labor multiplier controls", () => {
  assert.equal(factorsSource.includes("baseLaborSellMode"), false);
  assert.equal(factorsSource.includes("baseLaborSellMultiplier"), false);
  assert.equal(factorsSource.includes("공임 판매 계산 방식"), false);
  assert.equal(factorsSource.includes("공임 판매 배수"), false);
});
