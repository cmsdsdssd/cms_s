import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveBaseLaborSell, resolveBaseLaborSellConfig } from "../src/lib/catalog/base-labor-sell-mode.ts";

const testDir = dirname(fileURLToPath(import.meta.url));
const catalogSource = readFileSync(resolve(testDir, "../src/app/(app)/catalog/page.tsx"), "utf8");

test("resolveBaseLaborSell returns cost times multiplier in MULTIPLIER mode", async () => {
  const result = await resolveBaseLaborSell({
    mode: "MULTIPLIER",
    costKrw: 12000,
    multiplier: 1.5,
    pickRuleSell: async () => 99999,
  });

  assert.equal(result, 18000);
});

test("resolveBaseLaborSell delegates to rule pick callback in RULE mode", async () => {
  let calledCost = null;

  const result = await resolveBaseLaborSell({
    mode: "RULE",
    costKrw: 8700,
    multiplier: 3,
    pickRuleSell: async (costKrw) => {
      calledCost = costKrw;
      return costKrw + 1300;
    },
  });

  assert.equal(calledCost, 8700);
  assert.equal(result, 10000);
});

test("resolveBaseLaborSell rejects invalid multiplier input", async () => {
  await assert.rejects(() =>
    resolveBaseLaborSell({
      mode: "MULTIPLIER",
      costKrw: 12000,
      multiplier: Number.NaN,
      pickRuleSell: async () => 0,
    })
  );
});

test("resolveBaseLaborSellConfig returns MULTIPLIER only for a valid positive multiplier", () => {
  const result = resolveBaseLaborSellConfig({
    base_labor_sell_mode: "MULTIPLIER",
    base_labor_sell_multiplier: 2,
  });

  assert.deepEqual(result, { mode: "MULTIPLIER", multiplier: 2 });
});

test("resolveBaseLaborSellConfig fails closed to RULE for missing or invalid config", () => {
  assert.deepEqual(resolveBaseLaborSellConfig(null), { mode: "RULE", multiplier: null });
  assert.deepEqual(resolveBaseLaborSellConfig({ base_labor_sell_mode: "MULTIPLIER", base_labor_sell_multiplier: Number.NaN }), { mode: "RULE", multiplier: null });
  assert.deepEqual(resolveBaseLaborSellConfig({ base_labor_sell_mode: "RULE", base_labor_sell_multiplier: 2 }), { mode: "RULE", multiplier: null });
});

test("catalog base labor reads settings-owned config and not shopping pricing policies", () => {
  assert.equal(catalogSource.includes('fetch("/api/base-labor-sell-config", { cache: "no-store" })'), true);
  assert.equal(catalogSource.includes('const resolvedBaseLaborSellConfig = resolveBaseLaborSellConfig(baseLaborSellConfigQuery.data);'), true);
  assert.equal(catalogSource.includes('mode: resolvedBaseLaborSellConfig.mode'), true);
  assert.equal(catalogSource.includes('multiplier: resolvedBaseLaborSellConfig.multiplier'), true);
  assert.equal(catalogSource.includes('/api/pricing-policies'), false);
  assert.equal(catalogSource.includes('.from("pricing_policy")'), false);
});
