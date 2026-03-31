import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const settingsSource = readFileSync(join(process.cwd(), "src", "app", "(app)", "settings", "page.tsx"), "utf8");
const apiSource = readFileSync(join(process.cwd(), "src", "app", "api", "base-labor-sell-config", "route.ts"), "utf8");

test("main settings page owns base labor multiplier controls", () => {
  assert.equal(settingsSource.includes('activeGlobalRuleTab === "BASE_FACTORY"'), true);
  assert.equal(settingsSource.includes("baseLaborSellMode"), true);
  assert.equal(settingsSource.includes("baseLaborSellMultiplier"), true);
  assert.equal(settingsSource.includes("판매가 계산 방식"), true);
  assert.equal(settingsSource.includes("배수"), true);
});

test("base labor settings use dedicated global config API", () => {
  assert.equal(apiSource.includes('.from("cms_market_tick_config")'), true);
  assert.equal(apiSource.includes("base_labor_sell_mode"), true);
  assert.equal(apiSource.includes("base_labor_sell_multiplier"), true);
  assert.equal(apiSource.includes('eq("config_key", "DEFAULT")'), true);
  assert.equal(settingsSource.includes('/api/base-labor-sell-config'), true);
});
